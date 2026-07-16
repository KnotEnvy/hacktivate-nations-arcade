import { SupabaseArcadeService } from '@/services/SupabaseArcadeService';
import { MAX_TRUSTED_TIME_PLAYED_MS } from '@/lib/trustedProgression';

describe('SupabaseArcadeService.recordTrustedGameSession', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test('clamps timePlayedMs to the trusted cap so oversized sessions still bank', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ balance: 100, rewardAwarded: 10 }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const service = new SupabaseArcadeService({} as never);
    await service.recordTrustedGameSession(
      {
        gameId: 'dungeon-crawl',
        score: 5000,
        pickups: 12,
        timePlayedMs: MAX_TRUSTED_TIME_PLAYED_MS + 90_000_000,
        clientMutationId: 'overnight-session',
      },
      { accessToken: 'token-123' }
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.timePlayedMs).toBe(MAX_TRUSTED_TIME_PLAYED_MS);
    expect(body.clientMutationId).toBe('overnight-session');
  });
});
