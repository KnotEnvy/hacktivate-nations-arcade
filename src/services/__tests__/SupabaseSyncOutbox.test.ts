import { SupabaseSyncOutbox } from '@/services/SupabaseSyncOutbox';
import type { SupabaseArcadeService } from '@/services/SupabaseArcadeService';

const makeServiceMock = () =>
  ({
    upsertProfile: jest.fn().mockResolvedValue({}),
    upsertPlayerState: jest.fn().mockResolvedValue({}),
    syncChallengesTrusted: jest.fn().mockResolvedValue({ synced: 1 }),
    recordTrustedGameSession: jest
      .fn()
      .mockResolvedValue({ balance: 120, rewardAwarded: 20 }),
    claimAchievements: jest
      .fn()
      .mockResolvedValue({ balance: 160, rewardAwarded: 40, achievementIds: [] }),
    claimChallenge: jest
      .fn()
      .mockResolvedValue({ balance: 180, rewardAwarded: 20, alreadyClaimed: false }),
    unlockTierTrusted: jest
      .fn()
      .mockResolvedValue({ balance: 90, unlockedTiers: [0, 1], unlockedGames: ['runner'] }),
    unlockGameTrusted: jest.fn().mockResolvedValue({
      balance: 70,
      unlockedTiers: [0, 1],
      unlockedGames: ['runner', 'snake'],
    }),
  }) as unknown as jest.Mocked<SupabaseArcadeService>;

describe('SupabaseSyncOutbox', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.restoreAllMocks();
  });

  test('merges replaceable operations and preserves queued session records', () => {
    const outbox = new SupabaseSyncOutbox();

    outbox.enqueue({
      kind: 'profile-sync',
      payload: { id: 'user-1', username: 'First' },
    });
    outbox.enqueue({
      kind: 'profile-sync',
      payload: { id: 'user-1', username: 'Second' },
    });
    outbox.enqueue({
      kind: 'trusted-achievement-claim',
      payload: { achievementIds: ['first_jump'] },
    });
    outbox.enqueue({
      kind: 'trusted-achievement-claim',
      payload: { achievementIds: ['coin_collector', 'first_jump'] },
    });
    outbox.enqueue({
      kind: 'trusted-session-record',
      payload: {
        gameId: 'runner',
        score: 100,
        pickups: 4,
        clientMutationId: 'session-1',
      },
    });
    outbox.enqueue({
      kind: 'trusted-session-record',
      payload: {
        gameId: 'runner',
        score: 200,
        pickups: 6,
        clientMutationId: 'session-2',
      },
    });

    const items = outbox.getItems();

    expect(items).toHaveLength(4);
    expect(items.find(item => item.kind === 'profile-sync')?.payload).toEqual({
      id: 'user-1',
      username: 'Second',
    });
    expect(
      items.find(item => item.kind === 'trusted-achievement-claim')?.payload
    ).toEqual({
      achievementIds: ['first_jump', 'coin_collector'],
    });
    expect(
      items.filter(item => item.kind === 'trusted-session-record')
    ).toHaveLength(2);
  });

  test('flush replays queued operations and reconciles balances/unlocks', async () => {
    const outbox = new SupabaseSyncOutbox();
    const service = makeServiceMock();
    const balances: number[] = [];
    const unlocks: Array<{ tiers: number[]; games: string[] }> = [];

    outbox.enqueue({
      kind: 'trusted-session-record',
      payload: {
        gameId: 'runner',
        score: 100,
        pickups: 4,
        clientMutationId: 'session-1',
      },
    });
    outbox.enqueue({
      kind: 'trusted-game-unlock',
      payload: { gameId: 'snake' },
    });

    const result = await outbox.flush(service, 'token', {
      onBalanceReconciled: balance => balances.push(balance),
      onUnlockStateReconciled: (tiers, games) => unlocks.push({ tiers, games }),
    });

    expect(result).toEqual({ processed: 2, remaining: 0 });
    expect(service.recordTrustedGameSession).toHaveBeenCalledWith(
      {
        gameId: 'runner',
        score: 100,
        pickups: 4,
        clientMutationId: 'session-1',
      },
      { accessToken: 'token' }
    );
    expect(service.unlockGameTrusted).toHaveBeenCalledWith('snake', {
      accessToken: 'token',
    });
    expect(balances).toEqual([120, 70]);
    expect(unlocks).toEqual([
      {
        tiers: [0, 1],
        games: ['runner', 'snake'],
      },
    ]);
    expect(outbox.getPendingCount()).toBe(0);
  });

  test('flush stops at the first failure and leaves the failed item queued', async () => {
    const outbox = new SupabaseSyncOutbox();
    const service = makeServiceMock();
    service.recordTrustedGameSession.mockRejectedValueOnce(
      new Error('network down')
    );

    outbox.enqueue({
      kind: 'trusted-session-record',
      payload: {
        gameId: 'runner',
        score: 100,
        pickups: 4,
        clientMutationId: 'session-1',
      },
    });
    outbox.enqueue({
      kind: 'trusted-achievement-claim',
      payload: { achievementIds: ['first_jump'] },
    });

    const result = await outbox.flush(service, 'token');
    const [remaining] = outbox.getItems();

    expect(result).toEqual({ processed: 0, remaining: 2 });
    expect(remaining.kind).toBe('trusted-session-record');
    expect(remaining.retryCount).toBe(1);
    expect(remaining.lastError).toContain('network down');
    expect(service.claimAchievements).not.toHaveBeenCalled();
  });
});
