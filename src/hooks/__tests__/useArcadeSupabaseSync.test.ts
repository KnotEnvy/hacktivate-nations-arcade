import { act, renderHook, waitFor } from '@testing-library/react';
import type { Session } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from '@/lib/supabase';
import { SupabaseArcadeService } from '@/services/SupabaseArcadeService';
import { useArcadeSupabaseSync } from '@/hooks/useArcadeSupabaseSync';

jest.mock('@/lib/supabase', () => ({
  getSupabaseBrowserClient: jest.fn(),
}));

const mockedGetSupabaseBrowserClient = jest.mocked(getSupabaseBrowserClient);
const OUTBOX_STORAGE_KEY = 'hacktivate-supabase-sync-outbox-v1';

type HookOptions = Parameters<typeof useArcadeSupabaseSync>[0];

const createSession = (userId = 'user-1'): Session =>
  ({
    access_token: 'token-123',
    user: {
      id: userId,
      email: 'player@example.com',
      user_metadata: {},
    },
  }) as Session;

const createServices = () => {
  const challengeCallbacks: Array<(value: Array<{ id: string; progress: number; completed: boolean }>) => void> = [];
  const userCallbacks: Array<() => void> = [];

  const challengeService = {
    onChallengesChanged: jest.fn(callback => {
      challengeCallbacks.push(callback);
      return () => {
        const index = challengeCallbacks.indexOf(callback);
        if (index >= 0) {
          challengeCallbacks.splice(index, 1);
        }
      };
    }),
    getChallenges: jest.fn(() => []),
    setChallenges: jest.fn(),
  };

  const achievementService = {
    setUnlockedAchievements: jest.fn(),
    getUnlockedAchievementIds: jest.fn(() => []),
  };

  const currencyService = {
    setBalance: jest.fn(),
    getCurrentCoins: jest.fn(() => 25),
  };

  const profile = {
    username: 'Player',
    avatar: '🕹️',
    level: 3,
    experience: 320,
    totalPlayTime: 180,
    gamesPlayed: 7,
    totalCoins: 25,
    joinedAt: new Date('2026-01-01T00:00:00.000Z'),
    lastActiveAt: new Date('2026-04-15T00:00:00.000Z'),
  };

  const stats = {
    gamesPlayed: 7,
    coinsEarned: 120,
    achievementsUnlocked: 0,
    challengesCompleted: 0,
  };

  const userService = {
    getProfile: jest.fn(() => profile),
    getStats: jest.fn(() => stats),
    setProfile: jest.fn(),
    setStats: jest.fn(),
    updateProfile: jest.fn(),
    onUserDataChanged: jest.fn(callback => {
      userCallbacks.push(callback);
      return () => {
        const index = userCallbacks.indexOf(callback);
        if (index >= 0) {
          userCallbacks.splice(index, 1);
        }
      };
    }),
  };

  return {
    achievementService,
    challengeService,
    currencyService,
    userService,
  };
};

const mockHydrationQueries = () => {
  jest
    .spyOn(SupabaseArcadeService.prototype, 'fetchProfile')
    .mockResolvedValue({
      id: 'user-1',
      username: 'ServerPlayer',
      avatar: '🎮',
      created_at: '2026-01-01T00:00:00.000Z',
    } as never);
  jest
    .spyOn(SupabaseArcadeService.prototype, 'fetchPlayerState')
    .mockResolvedValue({
      user_id: 'user-1',
      level: 4,
      experience: 450,
      total_play_time: 240,
      games_played: 9,
      last_active_at: '2026-04-15T00:00:00.000Z',
      unlocked_tiers: [0],
      unlocked_games: ['runner'],
      stats: { coinsEarned: 140, achievementsUnlocked: 1, challengesCompleted: 0 },
    } as never);
  jest
    .spyOn(SupabaseArcadeService.prototype, 'fetchWallet')
    .mockResolvedValue({
      user_id: 'user-1',
      balance: 25,
      lifetime_earned: 140,
    } as never);
  jest
    .spyOn(SupabaseArcadeService.prototype, 'fetchAchievements')
    .mockResolvedValue([]);
  jest
    .spyOn(SupabaseArcadeService.prototype, 'fetchChallenges')
    .mockResolvedValue([]);
};

const flushEffects = async () => {
  await act(async () => {
    await Promise.resolve();
  });
};

const renderSupabaseSyncHook = (
  overrides: Partial<HookOptions> = {}
) => {
  const services = createServices();
  const session = createSession();
  const saveUnlockState = jest.fn();
  const resetLocalState = jest.fn();

  const options: HookOptions = {
    session,
    achievementService: services.achievementService as never,
    challengeService: services.challengeService as never,
    currencyService: services.currencyService as never,
    userService: services.userService as never,
    unlocksRef: {
      current: {
        tiers: [0],
        games: ['runner'],
      },
    },
    saveUnlockState,
    resetLocalState,
    ...overrides,
  };

  const hook = renderHook(() => useArcadeSupabaseSync(options));
  return {
    ...hook,
    options,
    services,
    saveUnlockState,
    resetLocalState,
  };
};

describe('useArcadeSupabaseSync', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockedGetSupabaseBrowserClient.mockReturnValue({} as never);
    mockHydrationQueries();
    jest
      .spyOn(SupabaseArcadeService.prototype, 'syncChallengesTrusted')
      .mockResolvedValue({ synced: 0 });
    jest
      .spyOn(SupabaseArcadeService.prototype, 'upsertProfile')
      .mockResolvedValue({ id: 'user-1' } as never);
    jest
      .spyOn(SupabaseArcadeService.prototype, 'upsertPlayerState')
      .mockResolvedValue({ user_id: 'user-1' } as never);
    jest
      .spyOn(SupabaseArcadeService.prototype, 'unlockGameTrusted')
      .mockResolvedValue({
        balance: 77,
        unlockedTiers: [0, 2],
        unlockedGames: ['runner', 'space'],
      });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('queues profile and player-state sync writes when debounced sync fails', async () => {
    jest.useFakeTimers();
    jest
      .spyOn(SupabaseArcadeService.prototype, 'upsertProfile')
      .mockRejectedValue(new Error('profile write failed'));
    jest
      .spyOn(SupabaseArcadeService.prototype, 'upsertPlayerState')
      .mockRejectedValue(new Error('state write failed'));

    const { result, services } = renderSupabaseSyncHook();

    await flushEffects();
    await waitFor(() => {
      expect(result.current.supabaseService).not.toBeNull();
    });
    await waitFor(() => {
      expect(services.userService.setProfile).toHaveBeenCalled();
      expect(services.userService.setStats).toHaveBeenCalled();
    });

    act(() => {
      result.current.schedulePlayerSync();
      jest.advanceTimersByTime(600);
    });
    await flushEffects();

    await waitFor(() => {
      expect(result.current.pendingSyncCount).toBe(2);
    });

    const queued = JSON.parse(localStorage.getItem(OUTBOX_STORAGE_KEY) ?? '[]') as Array<{
      kind: string;
    }>;
    expect(queued.map(entry => entry.kind)).toEqual([
      'profile-sync',
      'player-state-sync',
    ]);
  });

  it('flushes queued trusted unlocks and reconciles balance plus unlock state', async () => {
    const { result, services, saveUnlockState } = renderSupabaseSyncHook();

    await flushEffects();
    await waitFor(() => {
      expect(result.current.supabaseService).not.toBeNull();
    });

    await act(async () => {
      result.current.queueSyncOperation({
        kind: 'trusted-game-unlock',
        payload: { gameId: 'space' },
      });
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.pendingSyncCount).toBe(0);
    });

    expect(SupabaseArcadeService.prototype.unlockGameTrusted).toHaveBeenCalledWith(
      'space',
      { accessToken: 'token-123' }
    );
    expect(services.currencyService.setBalance).toHaveBeenLastCalledWith(77);
    expect(services.userService.updateProfile).toHaveBeenLastCalledWith({
      totalCoins: 77,
    });
    expect(saveUnlockState).toHaveBeenLastCalledWith(
      [0, 2],
      ['runner', 'space'],
      { sync: false }
    );
  });

  it('queues rich trusted session payloads without dropping gameplay metrics', async () => {
    const session = {
      ...createSession(),
      access_token: '',
    } as Session;
    const { result } = renderSupabaseSyncHook({ session });

    await flushEffects();
    await waitFor(() => {
      expect(result.current.supabaseService).not.toBeNull();
    });

    const richSessionRecord = {
      kind: 'trusted-session-record',
      payload: {
        gameId: 'runner',
        score: 999.8,
        pickups: 14.2,
        timePlayedMs: 12_345,
        metrics: {
          distance: 5_000,
          combo: 20,
          powerup_types: 4,
        },
        clientMutationId: 'session-queue-1',
      },
    } as Parameters<typeof result.current.queueSyncOperation>[0];

    act(() => {
      result.current.queueSyncOperation(richSessionRecord);
    });

    await flushEffects();

    expect(result.current.pendingSyncCount).toBe(1);
    const queued = JSON.parse(
      localStorage.getItem(OUTBOX_STORAGE_KEY) ?? '[]'
    ) as Array<{ kind: string; payload?: Record<string, unknown> }>;
    expect(queued).toHaveLength(1);
    expect(queued[0]).toMatchObject({
      kind: 'trusted-session-record',
      payload: richSessionRecord.payload,
    });
  });

  it('resets local state when the authenticated owner changes', async () => {
    localStorage.setItem('hacktivate-session-owner', 'guest');
    const session = createSession('signed-in-user');
    const resetLocalState = jest.fn();

    renderSupabaseSyncHook({
      session,
      resetLocalState,
    });

    await waitFor(() => {
      expect(resetLocalState).toHaveBeenCalledTimes(1);
    });
    expect(localStorage.getItem('hacktivate-session-owner')).toBe('signed-in-user');
  });
});
