import { GameLoader } from '@/services/GameLoader';
import type { GameModule } from '@/games/shared/GameModule';

function makeStubGame(id: string): GameModule {
  return {
    manifest: {
      id,
      title: 'Stub',
      thumbnail: '/stub.png',
      inputSchema: ['keyboard'],
      assetBudgetKB: 1,
      tier: 0,
      description: 'stub',
    },
    init: () => void 0,
    update: () => void 0,
    render: () => void 0,
  };
}

describe('GameLoader', () => {
  test('registers and loads games', async () => {
    const loader = new GameLoader();
    loader.registerGame('dummy', async () => makeStubGame('dummy'));

    expect(loader.getAvailableGames()).toContain('dummy');

    const game = await loader.loadGame('dummy');
    expect(game).not.toBeNull();
    expect(game!.manifest.id).toBe('dummy');
  });

  test('returns null for unknown game id', async () => {
    const loader = new GameLoader();
    const game = await loader.loadGame('missing');
    expect(game).toBeNull();
  });

  test('preloads a game once and still creates fresh instances when loaded', async () => {
    const loader = new GameLoader();
    const factory = jest
      .fn<Promise<GameModule>, []>()
      .mockImplementation(async () => makeStubGame('dummy'));

    loader.registerGame('dummy', factory);

    await Promise.all([
      loader.preloadGame('dummy'),
      loader.preloadGame('dummy'),
    ]);

    expect(factory).toHaveBeenCalledTimes(1);

    const game = await loader.loadGame('dummy');
    expect(game?.manifest.id).toBe('dummy');
    expect(factory).toHaveBeenCalledTimes(2);
  });
});
