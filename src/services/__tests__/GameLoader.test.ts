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
});

