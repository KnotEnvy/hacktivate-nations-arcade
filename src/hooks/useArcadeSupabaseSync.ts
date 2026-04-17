'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { Json } from '@/lib/supabase.types';
import { getSupabaseBrowserClient } from '@/lib/supabase';
import { getChallengeTemplate } from '@/lib/challenges';
import { DEFAULT_UNLOCKED_GAME_IDS } from '@/lib/unlocks';
import { SupabaseArcadeService } from '@/services/SupabaseArcadeService';
import {
  SupabaseSyncOutbox,
  type SyncOutboxDiagnostics,
} from '@/services/SupabaseSyncOutbox';
import type { AchievementService } from '@/services/AchievementService';
import type { ChallengeService } from '@/services/ChallengeService';
import type { CurrencyService } from '@/services/CurrencyService';
import type { UserService, UserStats } from '@/services/UserServices';

const LOCAL_OWNER_KEY = 'hacktivate-session-owner';
const LOCAL_OWNER_GUEST = 'guest';

type UnlockSyncOverrides = {
  unlockedTiers?: number[];
  unlockedGames?: string[];
};

type SyncOperation = Parameters<SupabaseSyncOutbox['enqueue']>[0];

interface UnlockState {
  tiers: number[];
  games: string[];
}

interface UseArcadeSupabaseSyncOptions {
  session: Session | null;
  achievementService: AchievementService;
  challengeService: ChallengeService;
  currencyService: CurrencyService;
  userService: UserService;
  unlocksRef: MutableRefObject<UnlockState>;
  saveUnlockState: (
    tiers: number[],
    games: string[],
    options?: { sync?: boolean }
  ) => void;
  resetLocalState: () => void;
}

interface UseArcadeSupabaseSyncResult {
  supabaseService: SupabaseArcadeService | null;
  pendingSyncCount: number;
  isSyncingPending: boolean;
  isBrowserOffline: boolean;
  syncDiagnostics: SyncOutboxDiagnostics;
  isHydratingRef: MutableRefObject<boolean>;
  runWhileHydrating: (callback: () => void) => void;
  schedulePlayerSync: (overrides?: UnlockSyncOverrides) => void;
  queueSyncOperation: (operation: SyncOperation) => void;
  retryPendingSyncs: () => Promise<void>;
  reconcileTrustedBalance: (balance: number) => void;
}

export function useArcadeSupabaseSync({
  session,
  achievementService,
  challengeService,
  currencyService,
  userService,
  unlocksRef,
  saveUnlockState,
  resetLocalState,
}: UseArcadeSupabaseSyncOptions): UseArcadeSupabaseSyncResult {
  const [syncOutbox] = useState(() => new SupabaseSyncOutbox());
  const [supabaseService, setSupabaseService] = useState<SupabaseArcadeService | null>(null);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [isSyncingPending, setIsSyncingPending] = useState(false);
  const [isBrowserOffline, setIsBrowserOffline] = useState(
    () => typeof navigator !== 'undefined' && navigator.onLine === false
  );
  const [syncDiagnostics, setSyncDiagnostics] = useState<SyncOutboxDiagnostics>(() =>
    syncOutbox.getDiagnostics()
  );
  const saveUnlockStateRef = useRef(saveUnlockState);
  const syncTimeoutRef = useRef<number | null>(null);
  const challengeSyncTimeoutRef = useRef<number | null>(null);
  const flushOutboxInProgressRef = useRef(false);
  const isHydratingRef = useRef(false);
  const hasHydratedRef = useRef(false);

  useEffect(() => {
    saveUnlockStateRef.current = saveUnlockState;
  }, [saveUnlockState]);

  const enqueueSyncOnly = useCallback(
    (operation: SyncOperation) => {
      syncOutbox.enqueue(operation);
      setPendingSyncCount(syncOutbox.getPendingCount());
    },
    [syncOutbox]
  );

  const runWhileHydrating = useCallback((callback: () => void) => {
    const wasHydrating = isHydratingRef.current;
    isHydratingRef.current = true;
    try {
      callback();
    } finally {
      isHydratingRef.current = wasHydrating;
    }
  }, []);

  const schedulePlayerSync = useCallback(
    (overrides?: UnlockSyncOverrides) => {
      if (!supabaseService || !session) return;
      const accessToken = session.access_token;
      if (!accessToken || isHydratingRef.current) return;

      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }

      syncTimeoutRef.current = window.setTimeout(() => {
        const profileData = userService.getProfile();
        const stats = userService.getStats();
        const lastActiveAt =
          profileData.lastActiveAt && profileData.lastActiveAt.getTime() > 0
            ? profileData.lastActiveAt.toISOString()
            : null;
        const nextUnlockedTiers = overrides?.unlockedTiers ?? unlocksRef.current.tiers;
        const nextUnlockedGames = overrides?.unlockedGames ?? unlocksRef.current.games;

        void supabaseService
          .upsertProfile(
            {
              id: session.user.id,
              username: profileData.username,
              avatar: profileData.avatar,
            },
            { accessToken }
          )
          .catch(error => {
            console.warn('Supabase profile sync failed:', error);
            enqueueSyncOnly({
              kind: 'profile-sync',
              payload: {
                id: session.user.id,
                username: profileData.username,
                avatar: profileData.avatar,
              },
            });
          });

        void supabaseService
          .upsertPlayerState(
            {
              userId: session.user.id,
              level: profileData.level,
              experience: profileData.experience,
              totalPlayTime: profileData.totalPlayTime,
              gamesPlayed: stats.gamesPlayed,
              lastActiveAt,
              unlockedTiers: nextUnlockedTiers,
              unlockedGames: nextUnlockedGames,
              stats: stats as unknown as Json,
            },
            { accessToken }
          )
          .catch(error => {
            console.warn('Supabase player state sync failed:', error);
            enqueueSyncOnly({
              kind: 'player-state-sync',
              payload: {
                userId: session.user.id,
                level: profileData.level,
                experience: profileData.experience,
                totalPlayTime: profileData.totalPlayTime,
                gamesPlayed: stats.gamesPlayed,
                lastActiveAt,
                unlockedTiers: nextUnlockedTiers,
                unlockedGames: nextUnlockedGames,
                stats: stats as unknown as Json,
              },
            });
          });
      }, 600);
    },
    [enqueueSyncOnly, session, supabaseService, unlocksRef, userService]
  );

  const reconcileTrustedBalance = useCallback(
    (balance: number) => {
      runWhileHydrating(() => {
        currencyService.setBalance(balance);
        userService.updateProfile({ totalCoins: balance });
      });
    },
    [currencyService, runWhileHydrating, userService]
  );

  const flushPendingSyncs = useCallback(async () => {
    if (
      !supabaseService ||
      !session?.access_token ||
      flushOutboxInProgressRef.current
    ) {
      return;
    }

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setIsBrowserOffline(true);
      setIsSyncingPending(false);
      return;
    }

    flushOutboxInProgressRef.current = true;
    setIsSyncingPending(true);

    try {
      await syncOutbox.flush(supabaseService, session.access_token, {
        onBalanceReconciled: reconcileTrustedBalance,
        onUnlockStateReconciled: (tiers, games) => {
          saveUnlockStateRef.current(tiers, games, { sync: false });
        },
      });
    } finally {
      flushOutboxInProgressRef.current = false;
      setPendingSyncCount(syncOutbox.getPendingCount());
      setSyncDiagnostics(syncOutbox.getDiagnostics());
      setIsSyncingPending(false);
    }
  }, [
    reconcileTrustedBalance,
    session?.access_token,
    supabaseService,
    syncOutbox,
  ]);

  const queueSyncOperation = useCallback(
    (operation: SyncOperation) => {
      enqueueSyncOnly(operation);

      if (
        supabaseService &&
        session?.access_token &&
        (typeof navigator === 'undefined' || navigator.onLine !== false)
      ) {
        void flushPendingSyncs();
      }
    },
    [enqueueSyncOnly, flushPendingSyncs, session?.access_token, supabaseService]
  );

  const retryPendingSyncs = useCallback(async () => {
    await flushPendingSyncs();
  }, [flushPendingSyncs]);

  useEffect(() => {
    const unsubscribe = syncOutbox.onChanged(queue => {
      setPendingSyncCount(queue.length);
      setSyncDiagnostics(syncOutbox.getDiagnostics());
    });
    return unsubscribe;
  }, [syncOutbox]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const syncOnlineState = () => {
      setIsBrowserOffline(navigator.onLine === false);
    };

    syncOnlineState();
    window.addEventListener('online', syncOnlineState);
    window.addEventListener('offline', syncOnlineState);

    return () => {
      window.removeEventListener('online', syncOnlineState);
      window.removeEventListener('offline', syncOnlineState);
    };
  }, []);

  useEffect(() => {
    if (!supabaseService || !session?.access_token) {
      setIsSyncingPending(false);
      return;
    }

    void flushPendingSyncs();

    const flushOnReconnect = () => {
      void flushPendingSyncs();
    };
    const interval = window.setInterval(() => {
      void flushPendingSyncs();
    }, 15000);

    window.addEventListener('online', flushOnReconnect);
    return () => {
      window.removeEventListener('online', flushOnReconnect);
      window.clearInterval(interval);
    };
  }, [flushPendingSyncs, session?.access_token, supabaseService]);

  useEffect(() => {
    if (!supabaseService || !session) return;
    const accessToken = session.access_token;
    if (!accessToken) {
      console.warn('Supabase challenge sync skipped: missing access token.');
      return;
    }

    const unsubscribe = challengeService.onChallengesChanged(next => {
      if (isHydratingRef.current) return;
      if (challengeSyncTimeoutRef.current) {
        clearTimeout(challengeSyncTimeoutRef.current);
      }
      challengeSyncTimeoutRef.current = window.setTimeout(() => {
        const payload = next.map(challenge => ({
          challengeId: challenge.id,
          progress: challenge.progress,
          completed: challenge.completed,
        }));
        void supabaseService
          .syncChallengesTrusted(payload, { accessToken })
          .catch(error => {
            console.warn('Supabase challenge sync failed:', error);
            queueSyncOperation({
              kind: 'trusted-challenge-sync',
              payload,
            });
          });
      }, 500);
    });

    return () => {
      unsubscribe();
      if (challengeSyncTimeoutRef.current) {
        clearTimeout(challengeSyncTimeoutRef.current);
        challengeSyncTimeoutRef.current = null;
      }
    };
  }, [challengeService, queueSyncOperation, session, supabaseService]);

  useEffect(() => {
    let mounted = true;
    if (!session) {
      setSupabaseService(null);
      return () => {
        mounted = false;
      };
    }

    const init = async () => {
      try {
        const client = getSupabaseBrowserClient();
        if (!mounted) return;
        setSupabaseService(new SupabaseArcadeService(client));
      } catch (error) {
        console.warn('Supabase unavailable; staying offline:', error);
        setSupabaseService(null);
      }
    };

    void init();
    return () => {
      mounted = false;
    };
  }, [session]);

  useEffect(() => {
    hasHydratedRef.current = false;
  }, [session?.user.id]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const nextOwner = session?.user.id ?? LOCAL_OWNER_GUEST;
    const storedOwner = localStorage.getItem(LOCAL_OWNER_KEY);
    const currentOwner = storedOwner ?? LOCAL_OWNER_GUEST;
    if (!storedOwner) {
      localStorage.setItem(LOCAL_OWNER_KEY, currentOwner);
    }
    if (currentOwner !== nextOwner) {
      resetLocalState();
      localStorage.setItem(LOCAL_OWNER_KEY, nextOwner);
    }
  }, [resetLocalState, session?.user.id]);

  useEffect(() => {
    if (!supabaseService || !session) return;
    const accessToken = session.access_token;
    if (!accessToken) {
      console.warn('Supabase hydration skipped: missing access token.');
      return;
    }
    if (hasHydratedRef.current) return;

    let active = true;
    const hydrate = async () => {
      isHydratingRef.current = true;
      try {
        const userId = session.user.id;
        const [
          profileRow,
          playerStateRow,
          walletRow,
          achievementRows,
          challengeRows,
        ] = await Promise.all([
          supabaseService.fetchProfile(userId, { accessToken }),
          supabaseService.fetchPlayerState(userId, { accessToken }),
          supabaseService.fetchWallet(userId, { accessToken }),
          supabaseService.fetchAchievements(userId, { accessToken }),
          supabaseService.fetchChallenges(userId, { accessToken }),
        ]);

        if (!active) return;

        const localProfile = userService.getProfile();
        const localStats = userService.getStats();
        let nextProfile = { ...localProfile };
        let nextStats: UserStats = { ...localStats };

        if (profileRow) {
          nextProfile = {
            ...nextProfile,
            username: profileRow.username || nextProfile.username,
            avatar: profileRow.avatar ?? nextProfile.avatar,
            joinedAt: profileRow.created_at ? new Date(profileRow.created_at) : nextProfile.joinedAt,
          };
        } else {
          await supabaseService.upsertProfile(
            {
              id: userId,
              username: nextProfile.username,
              avatar: nextProfile.avatar,
            },
            { accessToken }
          );
        }

        if (playerStateRow) {
          const statsPayload =
            playerStateRow.stats && typeof playerStateRow.stats === 'object'
              ? (playerStateRow.stats as Partial<UserStats>)
              : {};

          nextStats = {
            ...nextStats,
            ...statsPayload,
            gamesPlayed: playerStateRow.games_played,
          };

          nextProfile = {
            ...nextProfile,
            level: playerStateRow.level,
            experience: playerStateRow.experience,
            totalPlayTime: playerStateRow.total_play_time,
            gamesPlayed: playerStateRow.games_played,
            lastActiveAt: playerStateRow.last_active_at
              ? new Date(playerStateRow.last_active_at)
              : nextProfile.lastActiveAt,
          };

          const tiers = Array.from(new Set([0, ...(playerStateRow.unlocked_tiers ?? [])]));
          const games = Array.from(
            new Set([...DEFAULT_UNLOCKED_GAME_IDS, ...(playerStateRow.unlocked_games ?? [])])
          );
          saveUnlockState(tiers, games);
        } else {
          await supabaseService.upsertPlayerState(
            {
              userId,
              level: nextProfile.level,
              experience: nextProfile.experience,
              totalPlayTime: nextProfile.totalPlayTime,
              gamesPlayed: nextStats.gamesPlayed,
              lastActiveAt:
                nextProfile.lastActiveAt && nextProfile.lastActiveAt.getTime() > 0
                  ? nextProfile.lastActiveAt.toISOString()
                  : null,
              unlockedTiers: unlocksRef.current.tiers,
              unlockedGames: unlocksRef.current.games,
              stats: nextStats as unknown as Json,
            },
            { accessToken }
          );
        }

        if (walletRow) {
          currencyService.setBalance(walletRow.balance);
          nextProfile = { ...nextProfile, totalCoins: walletRow.balance };
        } else {
          await supabaseService.upsertWallet(
            {
              userId,
              balance: currencyService.getCurrentCoins(),
              lifetimeEarned: nextStats.coinsEarned,
            },
            { accessToken }
          );
        }

        if (achievementRows.length > 0) {
          achievementService.setUnlockedAchievements(
            achievementRows.map(row => ({
              id: row.achievement_id,
              unlockedAt: row.unlocked_at,
            }))
          );
          nextStats = { ...nextStats, achievementsUnlocked: achievementRows.length };
        } else {
          const localAchievementIds = achievementService.getUnlockedAchievementIds();
          if (localAchievementIds.length > 0) {
            await Promise.all(
              localAchievementIds.map(achievementId =>
                supabaseService.upsertAchievement(
                  {
                    userId,
                    achievementId,
                  },
                  { accessToken }
                )
              )
            );
          }
        }

        if (challengeRows.length > 0) {
          const mapped = challengeRows.map(row => ({
            id: row.challenge_id,
            title: row.title,
            description: row.description,
            type: row.type,
            gameId: row.game_id ?? undefined,
            target: row.target,
            progress: row.progress,
            reward: row.reward,
            completed: !!row.completed_at || row.progress >= row.target,
            expiresAt: new Date(row.expires_at),
            requirement: getChallengeTemplate(row.challenge_id)?.requirement,
          }));
          challengeService.setChallenges(mapped);
          nextStats = {
            ...nextStats,
            challengesCompleted: mapped.filter(challenge => challenge.completed).length,
          };
        } else {
          const localChallenges = challengeService.getChallenges();
          if (localChallenges.length > 0) {
            await supabaseService.upsertChallenges(
              localChallenges.map(challenge => ({
                userId,
                challengeId: challenge.id,
                title: challenge.title,
                description: challenge.description,
                type: challenge.type,
                gameId: challenge.gameId ?? null,
                target: challenge.target,
                progress: challenge.progress,
                reward: challenge.reward,
                completedAt: challenge.completed ? new Date().toISOString() : null,
                expiresAt: challenge.expiresAt.toISOString(),
              })),
              { accessToken }
            );
          }
        }

        userService.setProfile(nextProfile);
        userService.setStats(nextStats);
      } catch (error) {
        console.warn('Supabase hydration failed:', error);
      } finally {
        isHydratingRef.current = false;
        hasHydratedRef.current = true;
      }
    };

    void hydrate();
    return () => {
      active = false;
    };
  }, [
    achievementService,
    challengeService,
    currencyService,
    saveUnlockState,
    session,
    supabaseService,
    unlocksRef,
    userService,
  ]);

  useEffect(() => {
    if (!supabaseService || !session) return;
    if (!session.access_token) {
      console.warn('Supabase sync skipped: missing access token.');
      return;
    }

    schedulePlayerSync();
    const unsubscribe = userService.onUserDataChanged(() => {
      schedulePlayerSync();
    });

    return () => {
      unsubscribe();
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
        syncTimeoutRef.current = null;
      }
    };
  }, [schedulePlayerSync, session, supabaseService, userService]);

  return {
    supabaseService,
    pendingSyncCount,
    isSyncingPending,
    isBrowserOffline,
    syncDiagnostics,
    isHydratingRef,
    runWhileHydrating,
    schedulePlayerSync,
    queueSyncOperation,
    retryPendingSyncs,
    reconcileTrustedBalance,
  };
}
