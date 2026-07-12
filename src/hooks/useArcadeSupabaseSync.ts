'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import type { Session } from '@supabase/supabase-js';
import { getChallengeTemplate } from '@/lib/challenges';
import { DEFAULT_UNLOCKED_GAME_IDS } from '@/lib/unlocks';
import type { SupabaseArcadeService } from '@/services/SupabaseArcadeService';
import {
  SupabaseSyncOutbox,
  type SyncOutboxDiagnostics,
} from '@/services/SupabaseSyncOutbox';
import type { AchievementService } from '@/services/AchievementService';
import type { ChallengeService } from '@/services/ChallengeService';
import type { CurrencyService } from '@/services/CurrencyService';
import { UserService, type UserStats } from '@/services/UserServices';

const LOCAL_OWNER_KEY = 'hacktivate-session-owner';

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
  isAccountHydrating: boolean;
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
  const [isAccountHydrating, setIsAccountHydrating] = useState(false);
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
    syncOutbox.setOwner(session?.user.id ?? null);
    setPendingSyncCount(syncOutbox.getPendingCount());
    setSyncDiagnostics(syncOutbox.getDiagnostics());
  }, [session?.user.id, syncOutbox]);

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
      // Unlock writes are authoritative route mutations; this callback now
      // schedules profile metadata only while preserving the hook contract.
      void overrides;
      if (!supabaseService || !session) return;
      const accessToken = session.access_token;
      if (!accessToken || isHydratingRef.current) return;

      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }

      syncTimeoutRef.current = window.setTimeout(() => {
        const profileData = userService.getProfile();

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

      }, 600);
    },
    [enqueueSyncOnly, session, supabaseService, userService]
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
      setIsAccountHydrating(false);
      return () => {
        mounted = false;
      };
    }

    const init = async () => {
      try {
        const [supabaseModule, serviceModule] = await Promise.all([
          import('@/lib/supabase'),
          import('@/services/SupabaseArcadeService'),
        ]);
        const client = supabaseModule.getSupabaseBrowserClient();
        if (!mounted) return;
        setSupabaseService(new serviceModule.SupabaseArcadeService(client));
      } catch (error) {
        console.warn('Supabase unavailable; staying offline:', error);
        setSupabaseService(null);
        if (mounted) {
          setIsAccountHydrating(false);
        }
      }
    };

    void init();
    return () => {
      mounted = false;
    };
  }, [session]);

  useEffect(() => {
    hasHydratedRef.current = false;
    setIsAccountHydrating(Boolean(session?.user.id));
  }, [session?.user.id]);

  useEffect(() => {
    if (typeof window === 'undefined' || !session?.user.id) {
      return;
    }
    const nextOwner = session.user.id;
    const storedOwner = localStorage.getItem(LOCAL_OWNER_KEY);
    if (!storedOwner || storedOwner !== nextOwner) {
      resetLocalState();
    }
    localStorage.setItem(LOCAL_OWNER_KEY, nextOwner);
  }, [resetLocalState, session?.user.id]);

  useEffect(() => {
    if (!supabaseService || !session) return;
    const accessToken = session.access_token;
    if (!accessToken) {
      console.warn('Supabase hydration skipped: missing access token.');
      setIsAccountHydrating(false);
      return;
    }
    if (hasHydratedRef.current) return;

    let active = true;
    const hydrate = async () => {
      isHydratingRef.current = true;
      setIsAccountHydrating(true);
      try {
        const userId = session.user.id;
        const fallbackUsername =
          session.user.user_metadata?.preferred_username ||
          `Player-${session.user.id.slice(0, 6)}`;
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

        let nextProfile = UserService.createDefaultProfile({
          username: fallbackUsername,
        });
        let nextStats: UserStats = UserService.createDefaultStats();

        if (profileRow) {
          nextProfile = {
            ...nextProfile,
            username: profileRow.username || fallbackUsername,
            avatar: profileRow.avatar ?? nextProfile.avatar,
            joinedAt: profileRow.created_at ? new Date(profileRow.created_at) : nextProfile.joinedAt,
          };
        } else {
          nextProfile = {
            ...nextProfile,
            username: fallbackUsername,
          };
          await supabaseService.upsertProfile(
            {
              id: userId,
              username: fallbackUsername,
              avatar: nextProfile.avatar,
            },
            { accessToken }
          );
        }

        let hydratedPlayerState = playerStateRow;
        let hydratedWallet = walletRow;
        if (!hydratedPlayerState || !hydratedWallet) {
          const bootstrap = await supabaseService.bootstrapTrusted({ accessToken });
          hydratedPlayerState = bootstrap.playerState;
          hydratedWallet = bootstrap.wallet;
        }

        if (hydratedPlayerState) {
          const statsPayload =
            hydratedPlayerState.stats && typeof hydratedPlayerState.stats === 'object'
              ? (hydratedPlayerState.stats as Partial<UserStats>)
              : {};

          nextStats = {
            ...nextStats,
            ...statsPayload,
            gamesPlayed: hydratedPlayerState.games_played,
          };

          nextProfile = {
            ...nextProfile,
            level: hydratedPlayerState.level,
            experience: hydratedPlayerState.experience,
            totalPlayTime: hydratedPlayerState.total_play_time,
            gamesPlayed: hydratedPlayerState.games_played,
            lastActiveAt: hydratedPlayerState.last_active_at
              ? new Date(hydratedPlayerState.last_active_at)
              : nextProfile.lastActiveAt,
          };

          const tiers = Array.from(new Set([0, ...(hydratedPlayerState.unlocked_tiers ?? [])]));
          const games = Array.from(
            new Set([...DEFAULT_UNLOCKED_GAME_IDS, ...(hydratedPlayerState.unlocked_games ?? [])])
          );
          saveUnlockState(tiers, games, { sync: false });
        }

        currencyService.setBalance(hydratedWallet.balance);
        nextProfile = { ...nextProfile, totalCoins: hydratedWallet.balance };

        if (achievementRows.length > 0) {
          achievementService.setUnlockedAchievements(
            achievementRows.map(row => ({
              id: row.achievement_id,
              unlockedAt: row.unlocked_at,
            }))
          );
          nextStats = { ...nextStats, achievementsUnlocked: achievementRows.length };
        } else {
          achievementService.setUnlockedAchievements([]);
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
          if (typeof window !== 'undefined') {
            localStorage.removeItem('hacktivate-challenges');
          }
          challengeService.init();
          const localChallenges = challengeService.getChallenges();
          if (localChallenges.length > 0) {
            await supabaseService.syncChallengesTrusted(
              localChallenges.map(challenge => ({
                challengeId: challenge.id,
                progress: challenge.progress,
                completed: challenge.completed,
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
        if (!active) {
          return;
        }
        isHydratingRef.current = false;
        hasHydratedRef.current = true;
        setIsAccountHydrating(false);
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
    isAccountHydrating,
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
