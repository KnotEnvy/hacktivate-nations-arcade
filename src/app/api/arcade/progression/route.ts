import { NextResponse } from 'next/server';
import { AVAILABLE_GAMES } from '@/data/Games';
import { createSupabaseServerClient } from '@/lib/supabase';
import type { Json } from '@/lib/supabase.types';
import {
  hasImplementedGamesInTier,
  isGameImplemented,
  sanitizeUnlockedGameIds,
} from '@/lib/gameCatalog';
import {
  buildTrustedChallengeProgressUpdate,
  buildTrustedSessionProgressionState,
  calculateTrustedGameReward,
  validateAchievementIds,
  validateTrustedChallengeSync,
  validateTrustedGameSession,
  getAchievementDefinition,
  getTrustedProgressionSettings,
  getTrustedSessionAchievementIds,
} from '@/lib/trustedProgression';
import {
  DEFAULT_UNLOCKED_GAME_IDS,
  getNextGameUnlockCost,
  getPaidUnlockedCountInTier,
  getTierUnlockCost,
  isDefaultUnlockedGame,
} from '@/lib/unlocks';
import { UserService } from '@/services/UserServices';

export const dynamic = 'force-dynamic';

type ProgressionAction =
  | {
      action: 'record-session';
      gameId: string;
      score: number;
      pickups: number;
      timePlayedMs: number;
      metrics?: Record<string, number>;
      clientMutationId?: string;
    }
  | {
      action: 'claim-achievements';
      achievementIds: string[];
    }
  | {
      action: 'sync-challenges';
      challenges: Array<{
        challengeId: string;
        progress: number;
        completed: boolean;
      }>;
    }
  | {
      action: 'claim-challenge';
      challengeId: string;
      progress: number;
    }
  | {
      action: 'unlock-tier';
      tier: number;
    }
  | {
      action: 'unlock-game';
      gameId: string;
    };

const jsonError = (message: string, status: number) =>
  NextResponse.json({ error: message }, { status });

const getDisplayName = (user: {
  email?: string;
  user_metadata?: { preferred_username?: string; username?: string };
}) =>
  user.user_metadata?.preferred_username ||
  user.user_metadata?.username ||
  user.email?.split('@')[0] ||
  'Player';

const parseBearerToken = (request: Request): string | null => {
  const header = request.headers.get('authorization');
  if (!header) {
    return null;
  }

  const [scheme, token] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    return null;
  }

  return token;
};

const ensureWalletRow = async (
  client: ReturnType<typeof createSupabaseServerClient>,
  userId: string
) => {
  const { data: existing } = await client
    .from('wallets')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (existing) {
    return existing;
  }

  const { data, error } = await client
    .from('wallets')
    .upsert(
      {
        user_id: userId,
        balance: 0,
        lifetime_earned: 0,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to ensure wallet row: ${error.message}`);
  }

  return data;
};

const ensurePlayerStateRow = async (
  client: ReturnType<typeof createSupabaseServerClient>,
  userId: string
) => {
  const { data: existing } = await client
    .from('player_state')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (existing) {
    return existing;
  }

  const { data, error } = await client
    .from('player_state')
    .upsert(
      {
        user_id: userId,
        level: 1,
        experience: 0,
        total_play_time: 0,
        games_played: 0,
        unlocked_tiers: [0],
        unlocked_games: Array.from(DEFAULT_UNLOCKED_GAME_IDS),
        stats: {},
        settings: {},
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to ensure player state row: ${error.message}`);
  }

  return data;
};

const ensureProfileRow = async (
  client: ReturnType<typeof createSupabaseServerClient>,
  user: {
    id: string;
    email?: string;
    user_metadata?: { preferred_username?: string; username?: string; avatar?: string };
  }
) => {
  const { data: existing } = await client
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (existing) {
    return existing;
  }

  const { data, error } = await client
    .from('profiles')
    .upsert(
      {
        id: user.id,
        username: getDisplayName(user),
        avatar: user.user_metadata?.avatar ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    )
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to ensure profile row: ${error.message}`);
  }

  return data;
};

const ensureUserRows = async (
  client: ReturnType<typeof createSupabaseServerClient>,
  user: {
    id: string;
    email?: string;
    user_metadata?: { preferred_username?: string; username?: string; avatar?: string };
  }
) => {
  await ensureProfileRow(client, user);
  const [playerState, wallet] = await Promise.all([
    ensurePlayerStateRow(client, user.id),
    ensureWalletRow(client, user.id),
  ]);

  return { playerState, wallet };
};

const upsertWalletBalance = async (
  client: ReturnType<typeof createSupabaseServerClient>,
  userId: string,
  balance: number,
  lifetimeEarned: number
) => {
  const { data, error } = await client
    .from('wallets')
    .upsert(
      {
        user_id: userId,
        balance,
        lifetime_earned: lifetimeEarned,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update wallet: ${error.message}`);
  }

  return data;
};

const updateUnlockState = async (
  client: ReturnType<typeof createSupabaseServerClient>,
  userId: string,
  currentPlayerState: Awaited<ReturnType<typeof ensurePlayerStateRow>>,
  unlockedTiers: number[],
  unlockedGames: string[]
) => {
  const { data, error } = await client
    .from('player_state')
    .upsert(
      {
        ...currentPlayerState,
        user_id: userId,
        unlocked_tiers: unlockedTiers,
        unlocked_games: unlockedGames,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update unlock state: ${error.message}`);
  }

  return data;
};

const isDailyChallengeMultiplierActive = (
  challenges: Array<{ type: string; progress: number; target: number; completed_at: string | null }>
) => {
  const activeDailyChallenges = challenges.filter(challenge => challenge.type === 'daily');
  return (
    activeDailyChallenges.length > 0 &&
    activeDailyChallenges.every(
      challenge =>
        Boolean(challenge.completed_at) || challenge.progress >= challenge.target
    )
  );
};

const getRpcRow = <TRow>(data: TRow | TRow[] | null): TRow | null => {
  if (Array.isArray(data)) {
    return data[0] ?? null;
  }

  return data;
};

export async function POST(request: Request) {
  try {
    const accessToken = parseBearerToken(request);
    if (!accessToken) {
      return jsonError('Missing bearer token.', 401);
    }

    const authClient = createSupabaseServerClient({ accessToken });
    const { data: authData, error: authError } = await authClient.auth.getUser();
    if (authError || !authData.user) {
      return jsonError('Authentication failed.', 401);
    }

    const privilegedClient = createSupabaseServerClient({ useServiceRole: true });
    const user = authData.user;
    const payload = (await request.json()) as ProgressionAction;
    const { playerState, wallet } = await ensureUserRows(privilegedClient, user);

    switch (payload.action) {
      case 'record-session': {
        const session = validateTrustedGameSession(payload);
        const mutationId = session.clientMutationId ?? null;

        const { data: challengeRows, error: challengeError } = await privilegedClient
          .from('challenge_assignments')
          .select('*')
          .eq('user_id', user.id)
          .gte('expires_at', new Date().toISOString());

        if (challengeError) {
          throw new Error(`Failed to load active challenges: ${challengeError.message}`);
        }

        const reward = calculateTrustedGameReward({
          level: playerState.level,
          score: session.score,
          pickups: session.pickups,
          dailyChallengeMultiplierActive: isDailyChallengeMultiplierActive(
            challengeRows ?? []
          ),
        });

        const nextSettings = getTrustedProgressionSettings(playerState.settings);

        const nextProgressionState = buildTrustedSessionProgressionState({
          currentStats: playerState.stats,
          currentSettings: nextSettings,
          currentGamesPlayed: playerState.games_played,
          currentTotalPlayTime: playerState.total_play_time,
          session,
          rewardAwarded: reward,
        });
        const nextPlayerStateSettings = {
          ...(typeof playerState.settings === 'object' && playerState.settings !== null
            ? (playerState.settings as Record<string, unknown>)
            : {}),
          processedSessionMutationIds:
            nextProgressionState.settings.processedSessionMutationIds,
          playedGameIds: nextProgressionState.settings.playedGameIds,
            bestScoresByGame: nextProgressionState.settings.bestScoresByGame,
        };

        const { data: existingAchievementRows, error: existingAchievementError } =
          await privilegedClient
            .from('achievements')
            .select('achievement_id')
            .eq('user_id', user.id);

        if (existingAchievementError) {
          throw new Error(
            `Failed to load existing achievements: ${existingAchievementError.message}`
          );
        }

        const achievementIds = getTrustedSessionAchievementIds({
          session,
          totalPlayTime: nextProgressionState.totalPlayTime,
          stats: nextProgressionState.stats,
          settings: nextProgressionState.settings,
          existingAchievementIds: (existingAchievementRows ?? []).map(
            row => row.achievement_id
          ),
        });

        const challengeUpdates = (challengeRows ?? [])
          .map(row =>
            buildTrustedChallengeProgressUpdate({
              challengeId: row.challenge_id,
              currentProgress: row.progress,
              session,
              rewardAwarded: reward,
            })
          )
          .filter(
            (
              update
            ): update is NonNullable<typeof update> =>
              Boolean(update)
          )
          .filter(update => {
            const existingRow = (challengeRows ?? []).find(
                row => row.challenge_id === update.challengeId
              );
            return (
              existingRow &&
              (existingRow.progress !== update.progress ||
                Boolean(existingRow.completed_at) !== update.completed)
            );
          });

        const achievementUnlockPayload = achievementIds.map(achievementId => {
          const achievement = getAchievementDefinition(achievementId);
          return {
            achievementId,
            progress: achievement?.requirement.value ?? null,
            reward: achievement?.reward ?? 0,
          };
        });
        const challengeUpdatePayload = challengeUpdates.map(update => ({
          challengeId: update.challengeId,
          title: update.title,
          description: update.description,
          type: update.type,
          gameId: update.gameId,
          target: update.target,
          progress: update.progress,
          reward: update.reward,
          expiresAt: update.expiresAt,
        }));
        const { data: rpcData, error: rpcError } = await privilegedClient.rpc(
          'commit_trusted_game_session',
          {
          _user_id: user.id,
          _game_id: session.gameId,
          _score: session.score,
          _reward_awarded: reward,
          _games_played: nextProgressionState.gamesPlayed,
          _total_play_time: nextProgressionState.totalPlayTime,
          _stats: nextProgressionState.stats as unknown as Json,
          _settings: nextPlayerStateSettings as Json,
          _achievement_unlocks: achievementUnlockPayload as unknown as Json,
          _challenge_updates: challengeUpdatePayload as unknown as Json,
          _client_mutation_id: mutationId,
          }
        );

        if (rpcError) {
          throw new Error(
            `Failed to commit trusted game session atomically: ${rpcError.message}`
          );
        }

        const rpcResult = getRpcRow(
          rpcData
        );

        if (!rpcResult) {
          throw new Error('Trusted session commit did not return a result row.');
        }

        return NextResponse.json({
          balance: rpcResult.balance,
          rewardAwarded: rpcResult.reward_awarded,
          duplicate: rpcResult.duplicate,
          achievementIds: rpcResult.achievement_ids ?? [],
          diagnostics: {
            challengeUpdatesApplied: rpcResult.challenge_updates_applied,
            mutationId,
          },
        });
      }
      case 'claim-achievements': {
        const achievementIds = validateAchievementIds(payload.achievementIds);
        if (achievementIds.length === 0) {
          return NextResponse.json({
            achievementIds: [],
            balance: wallet.balance,
            rewardAwarded: 0,
          });
        }

        const { data: existingRows, error: existingError } = await privilegedClient
          .from('achievements')
          .select('achievement_id')
          .eq('user_id', user.id)
          .in('achievement_id', achievementIds);

        if (existingError) {
          throw new Error(`Failed to load achievements: ${existingError.message}`);
        }

        const existingIds = new Set(
          (existingRows ?? []).map(row => row.achievement_id)
        );
        const newIds = achievementIds.filter(id => !existingIds.has(id));

        if (newIds.length === 0) {
          return NextResponse.json({
            achievementIds: [],
            balance: wallet.balance,
            rewardAwarded: 0,
          });
        }

        const now = new Date().toISOString();
        const rewardAwarded = newIds.reduce((total, achievementId) => {
          const achievement = getAchievementDefinition(achievementId);
          return total + (achievement?.reward ?? 0);
        }, 0);

        const { error: upsertError } = await privilegedClient
          .from('achievements')
          .upsert(
            newIds.map(achievementId => {
              const achievement = getAchievementDefinition(achievementId);
              return {
                user_id: user.id,
                achievement_id: achievementId,
                progress: achievement?.requirement.value ?? null,
                unlocked_at: now,
                updated_at: now,
              };
            }),
            { onConflict: 'user_id,achievement_id' }
          );

        if (upsertError) {
          throw new Error(`Failed to upsert achievements: ${upsertError.message}`);
        }

        const updatedWallet = await upsertWalletBalance(
          privilegedClient,
          user.id,
          wallet.balance + rewardAwarded,
          wallet.lifetime_earned + rewardAwarded
        );

        return NextResponse.json({
          achievementIds: newIds,
          balance: updatedWallet.balance,
          rewardAwarded,
        });
      }
      case 'sync-challenges': {
        const validatedChallenges = validateTrustedChallengeSync(payload.challenges);
        if (validatedChallenges.length === 0) {
          return NextResponse.json({ synced: 0 });
        }

        const challengeIds = validatedChallenges.map(challenge => challenge.challengeId);
        const { data: existingRows, error: existingError } = await privilegedClient
          .from('challenge_assignments')
          .select('challenge_id, progress, completed_at')
          .eq('user_id', user.id)
          .in('challenge_id', challengeIds);

        if (existingError) {
          throw new Error(`Failed to load challenges: ${existingError.message}`);
        }

        const existingById = new Map(
          (existingRows ?? []).map(row => [row.challenge_id, row])
        );

        const { error: syncError } = await privilegedClient
          .from('challenge_assignments')
          .upsert(
            validatedChallenges.map(challenge => {
              const existing = existingById.get(challenge.challengeId);
              return {
                user_id: user.id,
                challenge_id: challenge.challengeId,
                title: challenge.title,
                description: challenge.description,
                type: challenge.type,
                game_id: challenge.gameId,
                target: challenge.target,
                progress: Math.max(existing?.progress ?? 0, challenge.progress),
                reward: challenge.reward,
                completed_at: existing?.completed_at ?? null,
                expires_at: challenge.expiresAt,
                updated_at: new Date().toISOString(),
              };
            }),
            { onConflict: 'user_id,challenge_id' }
          );

        if (syncError) {
          throw new Error(`Failed to sync challenges: ${syncError.message}`);
        }

        return NextResponse.json({ synced: validatedChallenges.length });
      }
      case 'claim-challenge': {
        const [validatedChallenge] = validateTrustedChallengeSync([
          {
            challengeId: payload.challengeId,
            progress: payload.progress,
            completed: true,
          },
        ]);

        const { data: existingRow, error: existingError } = await privilegedClient
          .from('challenge_assignments')
          .select('*')
          .eq('user_id', user.id)
          .eq('challenge_id', validatedChallenge.challengeId)
          .maybeSingle();

        if (existingError) {
          throw new Error(`Failed to load challenge: ${existingError.message}`);
        }

        const nextProgress = Math.max(
          existingRow?.progress ?? 0,
          validatedChallenge.progress
        );
        if (nextProgress < validatedChallenge.target) {
          return jsonError('Challenge progress has not met the target yet.', 409);
        }

        const alreadyClaimed = Boolean(existingRow?.completed_at);
        const rewardAwarded = alreadyClaimed
          ? 0
          : Math.floor(
              validatedChallenge.reward *
                UserService.getPerkModifiersForLevel(playerState.level)
                  .challengeRewardMultiplier
            );

        const completedAt = existingRow?.completed_at ?? new Date().toISOString();
        const { error: challengeError } = await privilegedClient
          .from('challenge_assignments')
          .upsert(
            {
              user_id: user.id,
              challenge_id: validatedChallenge.challengeId,
              title: validatedChallenge.title,
              description: validatedChallenge.description,
              type: validatedChallenge.type,
              game_id: validatedChallenge.gameId,
              target: validatedChallenge.target,
              progress: nextProgress,
              reward: validatedChallenge.reward,
              completed_at: completedAt,
              expires_at: validatedChallenge.expiresAt,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'user_id,challenge_id' }
          );

        if (challengeError) {
          throw new Error(`Failed to claim challenge: ${challengeError.message}`);
        }

        const updatedWallet =
          rewardAwarded > 0
            ? await upsertWalletBalance(
                privilegedClient,
                user.id,
                wallet.balance + rewardAwarded,
                wallet.lifetime_earned + rewardAwarded
              )
            : wallet;

        return NextResponse.json({
          alreadyClaimed,
          balance: updatedWallet.balance,
          rewardAwarded,
        });
      }
      case 'unlock-tier': {
        const tier = Math.max(0, Math.floor(payload.tier));
        if (!hasImplementedGamesInTier(tier)) {
          return jsonError('Tier has no registered games to unlock.', 400);
        }

        const unlockedTiers = Array.from(
          new Set([0, ...(playerState.unlocked_tiers ?? [])])
        ).sort((left, right) => left - right);

        if (unlockedTiers.includes(tier)) {
          return NextResponse.json({
            balance: wallet.balance,
            unlockedGames: sanitizeUnlockedGameIds(playerState.unlocked_games ?? []),
            unlockedTiers,
          });
        }

        const cost = getTierUnlockCost(tier);
        if (wallet.balance < cost) {
          return jsonError('Not enough coins to unlock this tier.', 409);
        }

        const nextUnlockedTiers = [...unlockedTiers, tier].sort(
          (left, right) => left - right
        );
        await updateUnlockState(
          privilegedClient,
          user.id,
          playerState,
          nextUnlockedTiers,
          sanitizeUnlockedGameIds(playerState.unlocked_games ?? [])
        );
        const updatedWallet = await upsertWalletBalance(
          privilegedClient,
          user.id,
          wallet.balance - cost,
          wallet.lifetime_earned
        );

        return NextResponse.json({
          balance: updatedWallet.balance,
          unlockedGames: sanitizeUnlockedGameIds(playerState.unlocked_games ?? []),
          unlockedTiers: nextUnlockedTiers,
        });
      }
      case 'unlock-game': {
        const game = AVAILABLE_GAMES.find(entry => entry.id === payload.gameId);
        if (!game || !isGameImplemented(game.id)) {
          return jsonError('Game is not registered for unlock purchases.', 400);
        }
        if (isDefaultUnlockedGame(game.id)) {
          return jsonError('Default games do not require purchase.', 400);
        }

        const unlockedTiers = Array.from(
          new Set([0, ...(playerState.unlocked_tiers ?? [])])
        );
        if (!unlockedTiers.includes(game.tier)) {
          return jsonError('Unlock the tier before purchasing this game.', 409);
        }

        const currentUnlockedGames = sanitizeUnlockedGameIds(
          playerState.unlocked_games ?? []
        );
        if (currentUnlockedGames.includes(game.id)) {
          return NextResponse.json({
            balance: wallet.balance,
            unlockedGames: currentUnlockedGames,
            unlockedTiers: unlockedTiers.sort((left, right) => left - right),
          });
        }

        const cost = getNextGameUnlockCost(
          game.tier,
          getPaidUnlockedCountInTier(game.tier, currentUnlockedGames)
        );
        if (wallet.balance < cost) {
          return jsonError('Not enough coins to unlock this game.', 409);
        }

        const nextUnlockedGames = sanitizeUnlockedGameIds([
          ...currentUnlockedGames,
          game.id,
        ]);
        await updateUnlockState(
          privilegedClient,
          user.id,
          playerState,
          unlockedTiers.sort((left, right) => left - right),
          nextUnlockedGames
        );
        const updatedWallet = await upsertWalletBalance(
          privilegedClient,
          user.id,
          wallet.balance - cost,
          wallet.lifetime_earned
        );

        return NextResponse.json({
          balance: updatedWallet.balance,
          unlockedGames: nextUnlockedGames,
          unlockedTiers: unlockedTiers.sort((left, right) => left - right),
        });
      }
      default:
        return jsonError('Unsupported progression action.', 400);
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Trusted progression request failed.';
    return jsonError(message, 500);
  }
}
