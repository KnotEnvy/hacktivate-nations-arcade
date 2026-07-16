import { GameSaveSync, hashSavePayload } from '@/services/GameSaveSync';
import type { SupabaseArcadeService } from '@/services/SupabaseArcadeService';

const USER = 'user-1';
const KEY = `dungeon-crawl-save:${USER}`;
const GUEST_KEY = 'dungeon-crawl-save:guest';
const META_KEY = `hacktivate-game-save-sync-v1:${USER}:dungeon-crawl`;
const TOKEN = 'token-123';

const LOCAL_SAVE = JSON.stringify({ version: 2, characters: { fighter: { level: 3 } } });
const SERVER_SAVE = { version: 2, characters: { mage: { level: 7 } } };

const makeService = (overrides: Partial<{
  server: { payload: unknown; updated_at: string } | null;
  pushedAt: string;
}> = {}) =>
  ({
    fetchGameSave: jest.fn().mockResolvedValue(overrides.server ?? null),
    upsertGameSave: jest
      .fn()
      .mockResolvedValue(overrides.pushedAt ?? '2026-07-15T10:00:00.000Z'),
  }) as unknown as jest.Mocked<SupabaseArcadeService>;

const readMeta = () =>
  JSON.parse(localStorage.getItem(META_KEY) ?? 'null') as {
    lastSyncedHash: string | null;
    serverUpdatedAt: string | null;
    guestMigrationResolved: boolean;
  } | null;

const seedSyncedMeta = (localRaw: string, serverUpdatedAt: string) => {
  localStorage.setItem(
    META_KEY,
    JSON.stringify({
      lastSyncedHash: hashSavePayload(localRaw),
      serverUpdatedAt,
      guestMigrationResolved: false,
    })
  );
};

describe('GameSaveSync', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('first promotion: pushes an existing local save when the server has none', async () => {
    localStorage.setItem(KEY, LOCAL_SAVE);
    const service = makeService({ server: null });

    const offers = await new GameSaveSync(USER).reconcile(service, TOKEN);

    expect(offers).toEqual([]);
    expect(service.upsertGameSave).toHaveBeenCalledWith(
      'dungeon-crawl',
      JSON.parse(LOCAL_SAVE),
      { accessToken: TOKEN }
    );
    expect(readMeta()).toMatchObject({
      lastSyncedHash: hashSavePayload(LOCAL_SAVE),
      serverUpdatedAt: '2026-07-15T10:00:00.000Z',
    });
  });

  test('adopts the server save when this device has none', async () => {
    const service = makeService({
      server: { payload: SERVER_SAVE, updated_at: '2026-07-14T08:00:00.000Z' },
    });

    await new GameSaveSync(USER).reconcile(service, TOKEN);

    expect(localStorage.getItem(KEY)).toBe(JSON.stringify(SERVER_SAVE));
    expect(service.upsertGameSave).not.toHaveBeenCalled();
    expect(readMeta()?.serverUpdatedAt).toBe('2026-07-14T08:00:00.000Z');
  });

  test('adopts the server save when only the server changed since last sync', async () => {
    localStorage.setItem(KEY, LOCAL_SAVE);
    seedSyncedMeta(LOCAL_SAVE, '2026-07-13T00:00:00.000Z');
    const service = makeService({
      server: { payload: SERVER_SAVE, updated_at: '2026-07-14T00:00:00.000Z' },
    });

    await new GameSaveSync(USER).reconcile(service, TOKEN);

    expect(localStorage.getItem(KEY)).toBe(JSON.stringify(SERVER_SAVE));
    expect(service.upsertGameSave).not.toHaveBeenCalled();
  });

  test('pushes when only the local save changed since last sync', async () => {
    const oldLocal = JSON.stringify({ version: 2, characters: {} });
    localStorage.setItem(KEY, LOCAL_SAVE);
    seedSyncedMeta(oldLocal, '2026-07-13T00:00:00.000Z');
    const service = makeService({
      server: { payload: SERVER_SAVE, updated_at: '2026-07-13T00:00:00.000Z' },
    });

    await new GameSaveSync(USER).reconcile(service, TOKEN);

    expect(service.upsertGameSave).toHaveBeenCalledWith(
      'dungeon-crawl',
      JSON.parse(LOCAL_SAVE),
      { accessToken: TOKEN }
    );
    expect(localStorage.getItem(KEY)).toBe(LOCAL_SAVE);
  });

  test('server wins when both sides changed (two-device conflict)', async () => {
    const oldLocal = JSON.stringify({ version: 2, characters: {} });
    localStorage.setItem(KEY, LOCAL_SAVE);
    seedSyncedMeta(oldLocal, '2026-07-13T00:00:00.000Z');
    const service = makeService({
      server: { payload: SERVER_SAVE, updated_at: '2026-07-15T00:00:00.000Z' },
    });

    await new GameSaveSync(USER).reconcile(service, TOKEN);

    expect(localStorage.getItem(KEY)).toBe(JSON.stringify(SERVER_SAVE));
    expect(service.upsertGameSave).not.toHaveBeenCalled();
  });

  test('no-ops when neither side changed', async () => {
    localStorage.setItem(KEY, LOCAL_SAVE);
    seedSyncedMeta(LOCAL_SAVE, '2026-07-13T00:00:00.000Z');
    const service = makeService({
      server: { payload: JSON.parse(LOCAL_SAVE), updated_at: '2026-07-13T00:00:00.000Z' },
    });

    await new GameSaveSync(USER).reconcile(service, TOKEN);

    expect(service.upsertGameSave).not.toHaveBeenCalled();
    expect(localStorage.getItem(KEY)).toBe(LOCAL_SAVE);
  });

  test('offers a one-time guest migration when only a guest save exists', async () => {
    localStorage.setItem(GUEST_KEY, LOCAL_SAVE);
    const sync = new GameSaveSync(USER);
    const service = makeService({ server: null });

    const offers = await sync.reconcile(service, TOKEN);
    expect(offers).toEqual([{ gameId: 'dungeon-crawl', title: 'Dungeon Crawl' }]);

    sync.declineGuestSave('dungeon-crawl');
    expect(await sync.reconcile(service, TOKEN)).toEqual([]);
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  test('adopting the guest save copies it into the account slot and marks it resolved', async () => {
    localStorage.setItem(GUEST_KEY, LOCAL_SAVE);
    const sync = new GameSaveSync(USER);

    expect(sync.adoptGuestSave('dungeon-crawl')).toBe(true);

    expect(localStorage.getItem(KEY)).toBe(LOCAL_SAVE);
    expect(localStorage.getItem(GUEST_KEY)).toBe(LOCAL_SAVE);
    expect(readMeta()?.guestMigrationResolved).toBe(true);

    const service = makeService({ server: null });
    await sync.pushIfChanged(service, TOKEN, 'dungeon-crawl');
    expect(service.upsertGameSave).toHaveBeenCalledTimes(1);
  });

  test('pushIfChanged skips unchanged saves and scopes to a game id', async () => {
    localStorage.setItem(KEY, LOCAL_SAVE);
    seedSyncedMeta(LOCAL_SAVE, '2026-07-13T00:00:00.000Z');
    const service = makeService();

    await new GameSaveSync(USER).pushIfChanged(service, TOKEN);
    expect(service.upsertGameSave).not.toHaveBeenCalled();

    await new GameSaveSync(USER).pushIfChanged(service, TOKEN, 'some-other-game');
    expect(service.upsertGameSave).not.toHaveBeenCalled();

    localStorage.setItem(KEY, JSON.stringify({ version: 2, characters: { thief: {} } }));
    await new GameSaveSync(USER).pushIfChanged(service, TOKEN, 'dungeon-crawl');
    expect(service.upsertGameSave).toHaveBeenCalledTimes(1);
  });

  test('a failed push warns, leaves the meta intact, and retries next time', async () => {
    localStorage.setItem(KEY, LOCAL_SAVE);
    const failing = makeService();
    failing.upsertGameSave.mockRejectedValueOnce(new Error('network down'));

    const sync = new GameSaveSync(USER);
    await sync.pushIfChanged(failing, TOKEN);

    expect(readMeta()).toBeNull();

    await sync.pushIfChanged(failing, TOKEN);
    expect(failing.upsertGameSave).toHaveBeenCalledTimes(2);
    expect(readMeta()?.lastSyncedHash).toBe(hashSavePayload(LOCAL_SAVE));
  });

  test('never pushes corrupt or non-object local payloads', async () => {
    localStorage.setItem(KEY, 'not-json{');
    const service = makeService();

    await new GameSaveSync(USER).pushIfChanged(service, TOKEN);
    await new GameSaveSync(USER).reconcile(service, TOKEN);

    expect(service.upsertGameSave).not.toHaveBeenCalled();
  });
});
