import { createSupabaseServerClient } from '@/lib/supabase';
import { TextDecoder, TextEncoder } from 'util';
import { ReadableStream, TransformStream, WritableStream } from 'stream/web';

Object.assign(globalThis, {
  TextEncoder,
  TextDecoder,
  ReadableStream,
  TransformStream,
  WritableStream,
});

jest.mock('@/lib/supabase', () => ({
  createSupabaseServerClient: jest.fn(),
}));

const mockedCreateSupabaseServerClient = jest.mocked(createSupabaseServerClient);

const user = {
  id: '11111111-1111-1111-1111-111111111111',
  email: 'player@example.com',
  user_metadata: {},
};

const createMaybeSingleQuery = (data: unknown) => ({
  eq: jest.fn(() => ({
    maybeSingle: jest.fn().mockResolvedValue({ data, error: null }),
  })),
});

const createEqQuery = (data: unknown) => ({
  eq: jest.fn().mockResolvedValue({ data, error: null }),
});

const createChallengeQuery = (data: unknown) => ({
  eq: jest.fn(() => ({
    gte: jest.fn().mockResolvedValue({ data, error: null }),
  })),
});

const createPrivilegedClient = (options?: {
  challengeRows?: unknown[];
  achievementRows?: unknown[];
  rpcResult?: unknown;
  rpcError?: { message: string } | null;
  playerState?: Partial<{
    level: number;
    experience: number;
    total_play_time: number;
    games_played: number;
    unlocked_tiers: number[];
    unlocked_games: string[];
    stats: Record<string, unknown>;
    settings: Record<string, unknown>;
  }>;
  wallet?: Partial<{
    balance: number;
    lifetime_earned: number;
  }>;
}) => {
  const challengeRows = options?.challengeRows ?? [];
  const achievementRows = options?.achievementRows ?? [];
  const playerState = {
    user_id: user.id,
    level: 1,
    experience: 0,
    total_play_time: 0,
    games_played: 0,
    unlocked_tiers: [0],
    unlocked_games: ['runner'],
    stats: {},
    settings: {},
    ...options?.playerState,
  };
  const wallet = {
    user_id: user.id,
    balance: 10,
    lifetime_earned: 10,
    ...options?.wallet,
  };

  const from = jest.fn((table: string) => {
    switch (table) {
      case 'profiles':
        return {
          select: jest.fn(() =>
            createMaybeSingleQuery({
              id: user.id,
              username: 'Player',
              avatar: null,
            })
          ),
        };
      case 'player_state':
        return {
          select: jest.fn(() => createMaybeSingleQuery(playerState)),
        };
      case 'wallets':
        return {
          select: jest.fn(() => createMaybeSingleQuery(wallet)),
        };
      case 'challenge_assignments':
        return {
          select: jest.fn(() => createChallengeQuery(challengeRows)),
        };
      case 'achievements':
        return {
          select: jest.fn(() => createEqQuery(achievementRows)),
        };
      default:
        throw new Error(`Unexpected table in test: ${table}`);
    }
  });

  const rpc = jest.fn().mockResolvedValue({
    data: options?.rpcResult ?? null,
    error: options?.rpcError ?? null,
  });

  return {
    from,
    rpc,
  };
};

const createAuthClient = () => ({
  auth: {
    getUser: jest.fn().mockResolvedValue({
      data: { user },
      error: null,
    }),
  },
});

const createRequest = (payload: Record<string, unknown>) =>
  new Request('http://localhost/api/arcade/progression', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer token-123',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

const ensureEdgeRuntimeFetchGlobals = async () => {
  if (
    typeof globalThis.Request !== 'undefined' &&
    typeof globalThis.Response !== 'undefined' &&
    typeof globalThis.Headers !== 'undefined'
  ) {
    return;
  }

  const edgeRuntimeFetch = await import(
    'next/dist/compiled/@edge-runtime/primitives/fetch'
  );

  Object.assign(globalThis, {
    Request: edgeRuntimeFetch.Request,
    Response: edgeRuntimeFetch.Response,
    Headers: edgeRuntimeFetch.Headers,
  });
};

const loadRoute = async () => {
  await ensureEdgeRuntimeFetchGlobals();
  return import('@/app/api/arcade/progression/route');
};

describe('POST /api/arcade/progression', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  test('records a trusted session through the atomic commit RPC', async () => {
    const privilegedClient = createPrivilegedClient({
      challengeRows: [
        {
          challenge_id: 'daily-2026-04-14-cross_high_scorer',
          progress: 0,
          completed_at: null,
        },
      ],
      rpcResult: [
        {
          balance: 125,
          reward_awarded: 115,
          duplicate: false,
          achievement_ids: ['first_game', 'speed_demon'],
          challenge_updates_applied: 1,
        },
      ],
    });

    mockedCreateSupabaseServerClient
      .mockReturnValueOnce(createAuthClient() as never)
      .mockReturnValueOnce(privilegedClient as never);
    const { POST } = await loadRoute();

    const response = await POST(
      createRequest({
        action: 'record-session',
        gameId: 'runner',
        score: 6000,
        pickups: 5,
        timePlayedMs: 12000,
        metrics: {
          speed: 3,
          combo: 15,
        },
        clientMutationId: 'mut-1',
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      balance: 125,
      rewardAwarded: 115,
      duplicate: false,
      achievementIds: ['first_game', 'speed_demon'],
      diagnostics: {
        challengeUpdatesApplied: 1,
        mutationId: 'mut-1',
      },
    });

    expect(privilegedClient.rpc).toHaveBeenCalledWith(
      'commit_trusted_game_session',
      expect.objectContaining({
        _user_id: user.id,
        _game_id: 'runner',
        _score: 6000,
        _client_mutation_id: 'mut-1',
        _achievement_unlocks: expect.arrayContaining([
          expect.objectContaining({ achievementId: 'first_game' }),
        ]),
        _challenge_updates: [
          expect.objectContaining({
            challengeId: 'daily-2026-04-14-cross_high_scorer',
            progress: 5000,
          }),
        ],
      })
    );
  });

  test('passes duplicate replay results through from the atomic RPC', async () => {
    const privilegedClient = createPrivilegedClient({
      rpcResult: [
        {
          balance: 10,
          reward_awarded: 0,
          duplicate: true,
          achievement_ids: null,
          challenge_updates_applied: 0,
        },
      ],
    });

    mockedCreateSupabaseServerClient
      .mockReturnValueOnce(createAuthClient() as never)
      .mockReturnValueOnce(privilegedClient as never);
    const { POST } = await loadRoute();

    const response = await POST(
      createRequest({
        action: 'record-session',
        gameId: 'runner',
        score: 1000,
        pickups: 1,
        timePlayedMs: 5000,
        clientMutationId: 'dup-1',
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      balance: 10,
      rewardAwarded: 0,
      duplicate: true,
      achievementIds: [],
      diagnostics: {
        challengeUpdatesApplied: 0,
        mutationId: 'dup-1',
      },
    });
  });

  test('returns a 500 when the atomic commit RPC fails', async () => {
    const privilegedClient = createPrivilegedClient({
      rpcError: { message: 'function public.commit_trusted_game_session does not exist' },
    });

    mockedCreateSupabaseServerClient
      .mockReturnValueOnce(createAuthClient() as never)
      .mockReturnValueOnce(privilegedClient as never);
    const { POST } = await loadRoute();

    const response = await POST(
      createRequest({
        action: 'record-session',
        gameId: 'runner',
        score: 1000,
        pickups: 1,
        timePlayedMs: 5000,
      })
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error:
        'Failed to commit trusted game session atomically: function public.commit_trusted_game_session does not exist',
    });
  });
});
