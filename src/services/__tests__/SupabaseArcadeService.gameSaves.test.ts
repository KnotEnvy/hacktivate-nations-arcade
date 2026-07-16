import { SupabaseArcadeService } from '@/services/SupabaseArcadeService';

const PAYLOAD = { version: 2, characters: {} };

const makeClient = (options: {
  row?: { payload: unknown; updated_at: string } | null;
  rpcData?: unknown;
  rpcError?: { message: string } | null;
} = {}) => {
  const maybeSingle = jest
    .fn()
    .mockResolvedValue({ data: options.row ?? null, error: null });
  const secondEq = jest.fn(() => ({ maybeSingle }));
  const firstEq = jest.fn(() => ({ eq: secondEq }));
  const select = jest.fn(() => ({ eq: firstEq }));
  const from = jest.fn(() => ({ select }));
  const rpc = jest.fn().mockResolvedValue({
    data: 'rpcData' in options ? options.rpcData : '2026-07-15T10:00:00.000Z',
    error: options.rpcError ?? null,
  });

  return { client: { from, rpc }, from, select, firstEq, secondEq, rpc };
};

describe('SupabaseArcadeService game saves', () => {
  test('fetchGameSave reads the (user, game) row', async () => {
    const row = { payload: PAYLOAD, updated_at: '2026-07-14T00:00:00.000Z' };
    const { client, from, select, firstEq, secondEq } = makeClient({ row });
    const service = new SupabaseArcadeService(client as never);

    const result = await service.fetchGameSave('user-1', 'dungeon-crawl');

    expect(from).toHaveBeenCalledWith('game_saves');
    expect(select).toHaveBeenCalledWith('payload, updated_at');
    expect(firstEq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(secondEq).toHaveBeenCalledWith('game_id', 'dungeon-crawl');
    expect(result).toEqual(row);
  });

  test('upsertGameSave calls the RPC and returns the server timestamp', async () => {
    const { client, rpc } = makeClient();
    const service = new SupabaseArcadeService(client as never);

    const updatedAt = await service.upsertGameSave('dungeon-crawl', PAYLOAD as never);

    expect(rpc).toHaveBeenCalledWith('upsert_game_save', {
      _game_id: 'dungeon-crawl',
      _payload: PAYLOAD,
    });
    expect(updatedAt).toBe('2026-07-15T10:00:00.000Z');
  });

  test('upsertGameSave rejects when the RPC returns no timestamp', async () => {
    const { client } = makeClient({ rpcData: null });
    const service = new SupabaseArcadeService(client as never);

    await expect(
      service.upsertGameSave('dungeon-crawl', PAYLOAD as never)
    ).rejects.toThrow('did not return a server timestamp');
  });
});
