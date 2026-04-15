import { ECONOMY } from '@/lib/constants';
import {
  buildTrustedChallengeProgressUpdate,
  buildTrustedSessionProgressionState,
  calculateTrustedGameReward,
  getTrustedSessionAchievementIds,
  validateAchievementIds,
  validateTrustedChallengeSync,
  validateTrustedGameSession,
  type TrustedGameSessionInput,
} from '@/lib/trustedProgression';
import { UserService } from '@/services/UserServices';

describe('trustedProgression helpers', () => {
  test('validateTrustedGameSession floors core metrics and tolerates richer telemetry', () => {
    const payload: TrustedGameSessionInput & {
      timePlayedMs: number;
      clientMutationId: string;
      metrics: Record<string, number>;
    } = {
      gameId: 'runner',
      score: 123.9,
      pickups: 9.7,
      timePlayedMs: 4321.8,
      clientMutationId: 'session-1',
      metrics: {
        distance: 2400.4,
        combo: 8.9,
        powerup_types: 3.1,
      },
    };

    expect(validateTrustedGameSession(payload)).toEqual({
      gameId: 'runner',
      score: 123,
      pickups: 9,
      timePlayedMs: 4321,
      clientMutationId: 'session-1',
      metrics: {
        distance: 2400.4,
        combo: 8.9,
        powerup_types: 3.1,
      },
    });
  });

  test('validateTrustedGameSession rejects malformed numeric values', () => {
    expect(() =>
      validateTrustedGameSession({
        gameId: 'runner',
        score: -1,
        pickups: 1,
      } as TrustedGameSessionInput)
    ).toThrow('score must be a non-negative number.');

    expect(() =>
      validateTrustedGameSession({
        gameId: 'runner',
        score: 10,
        pickups: Number.POSITIVE_INFINITY,
      } as TrustedGameSessionInput)
    ).toThrow('pickups must be a non-negative number.');
  });

  test('validateTrustedGameSession rejects unknown games', () => {
    expect(() =>
      validateTrustedGameSession({
        gameId: 'not-a-game',
        score: 10,
        pickups: 1,
      })
    ).toThrow('Game is not registered for trusted progression writes.');
  });

  test('calculateTrustedGameReward applies level perks and daily multiplier', () => {
    const level = 20;
    const score = 12_345;
    const pickups = 4;
    const baseReward = Math.floor(score / ECONOMY.SCORE_TO_COINS_RATIO) + pickups * ECONOMY.PICKUP_COIN_VALUE;
    const expectedWithoutDaily = Math.max(
      Math.floor(baseReward * UserService.getPerkModifiersForLevel(level).coinMultiplier) +
        Math.floor(score / 1000) *
          UserService.getPerkModifiersForLevel(level).bonusCoinsPerScore,
      UserService.getPerkModifiersForLevel(level).minCoinsPerGame
    );

    const withoutDaily = calculateTrustedGameReward({
      level,
      score,
      pickups,
      dailyChallengeMultiplierActive: false,
    });
    const withDaily = calculateTrustedGameReward({
      level,
      score,
      pickups,
      dailyChallengeMultiplierActive: true,
    });

    expect(withoutDaily).toBe(expectedWithoutDaily);
    expect(withDaily).toBeGreaterThan(withoutDaily);
    expect(withDaily).toBe(
      Math.max(
        Math.floor(baseReward * UserService.getPerkModifiersForLevel(level).coinMultiplier * ECONOMY.DAILY_CHALLENGE_MULTIPLIER) +
          Math.floor(score / 1000) *
            UserService.getPerkModifiersForLevel(level).bonusCoinsPerScore,
        UserService.getPerkModifiersForLevel(level).minCoinsPerGame
      )
    );
  });

  test('validateAchievementIds deduplicates known ids and rejects unknown ids', () => {
    expect(validateAchievementIds(['first_jump', 'first_jump', 'coin_collector'])).toEqual([
      'first_jump',
      'coin_collector',
    ]);

    expect(() => validateAchievementIds(['first_jump', 'made-up-achievement'])).toThrow(
      'Unknown achievement id: made-up-achievement'
    );
  });

  test('validateTrustedChallengeSync validates template-backed daily challenges', () => {
    const [validated] = validateTrustedChallengeSync([
      {
        challengeId: 'daily-2026-04-14-runner_coin_collector',
        progress: 49.9,
        completed: false,
      },
    ]);

    expect(validated).toEqual({
      challengeId: 'daily-2026-04-14-runner_coin_collector',
      title: 'Coin Collector',
      description: 'Collect 50 coins in a single run',
      type: 'daily',
      gameId: 'runner',
      target: 50,
      progress: 49,
      reward: 300,
      completed: false,
      expiresAt: '2026-04-15T00:00:00.000Z',
    });
  });

  test('validateTrustedChallengeSync rejects malformed progress values', () => {
    expect(() =>
      validateTrustedChallengeSync([
        {
          challengeId: 'daily-2026-04-14-runner_coin_collector',
          progress: Number.NaN,
          completed: false,
        },
      ])
    ).toThrow('challenge progress must be a non-negative number.');
  });

  test('validateTrustedChallengeSync rejects malformed challenge ids', () => {
    expect(() =>
      validateTrustedChallengeSync([
        {
          challengeId: 'not-a-daily-id',
          progress: 1,
          completed: false,
        },
      ])
    ).toThrow('Unknown challenge id: not-a-daily-id');
  });

  test('buildTrustedSessionProgressionState rolls cumulative stats and cross-game settings forward', () => {
    const progression = buildTrustedSessionProgressionState({
      currentStats: {
        totalDistance: 1200,
        maxSpeed: 2,
        maxCombo: 6,
        totalJumps: 9,
        powerupsUsed: 3,
        achievementsUnlocked: 1,
        challengesCompleted: 0,
        gamesPlayed: 4,
        coinsEarned: 90,
      },
      currentSettings: {
        playedGameIds: ['runner'],
        bestScoresByGame: { runner: 500 },
      },
      currentGamesPlayed: 4,
      currentTotalPlayTime: 120,
      session: validateTrustedGameSession({
        gameId: 'snake',
        score: 1500,
        pickups: 8,
        timePlayedMs: 32_000,
        metrics: {
          distance: 900,
          speed: 3.5,
          combo: 10,
          jumps: 2,
          powerupsUsed: 4,
        },
      }),
      rewardAwarded: 40,
    });

    expect(progression).toEqual({
      gamesPlayed: 5,
      totalPlayTime: 152,
      stats: {
        totalDistance: 1200,
        maxSpeed: 3.5,
        maxCombo: 10,
        totalJumps: 11,
        powerupsUsed: 7,
        achievementsUnlocked: 1,
        challengesCompleted: 0,
        gamesPlayed: 5,
        coinsEarned: 130,
      },
      settings: {
        processedSessionMutationIds: [],
        playedGameIds: ['runner', 'snake'],
        bestScoresByGame: { runner: 500, snake: 1500 },
      },
    });
  });

  test('getTrustedSessionAchievementIds unlocks server-derivable session and cross-game achievements', () => {
    const session = validateTrustedGameSession({
      gameId: 'snake',
      score: 1500,
      pickups: 3,
      timePlayedMs: 20_000,
      metrics: {
        jumps: 1,
      },
    });

    const achievementIds = getTrustedSessionAchievementIds({
      session,
      totalPlayTime: 1805,
      stats: {
        totalDistance: 0,
        maxSpeed: 0,
        maxCombo: 0,
        totalJumps: 52,
        powerupsUsed: 0,
        achievementsUnlocked: 0,
        challengesCompleted: 0,
        gamesPlayed: 10,
        coinsEarned: 10_050,
      },
      settings: {
        processedSessionMutationIds: [],
        playedGameIds: ['runner', 'snake', 'puzzle', 'memory', 'space'],
        bestScoresByGame: {
          runner: 1200,
          snake: 1500,
          puzzle: 1800,
        },
      },
      existingAchievementIds: ['first_game'],
    });

    expect(achievementIds).toEqual(
      expect.arrayContaining([
        'snake_rookie',
        'snake_veteran',
        'dedicated_player',
        'rich_player',
        'jump_fanatic',
        'seasoned_gamer',
        'game_explorer',
        'arcade_master',
      ])
    );
    expect(achievementIds).not.toContain('first_game');
  });

  test('buildTrustedChallengeProgressUpdate advances active template-backed progress from the trusted session', () => {
    const update = buildTrustedChallengeProgressUpdate({
      challengeId: 'daily-2026-04-14-cross_coin_hunter',
      currentProgress: 460,
      session: validateTrustedGameSession({
        gameId: 'runner',
        score: 5000,
        pickups: 4,
        timePlayedMs: 61_000,
      }),
      rewardAwarded: 75,
    });

    expect(update).toEqual({
      challengeId: 'daily-2026-04-14-cross_coin_hunter',
      title: 'Coin Hunter',
      description: 'Earn 500 coins from any source',
      type: 'daily',
      gameId: null,
      target: 500,
      progress: 500,
      reward: 100,
      completed: true,
      expiresAt: '2026-04-15T00:00:00.000Z',
    });
  });
});
