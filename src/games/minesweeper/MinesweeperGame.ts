import { PlaceholderGame } from '@/games/shared/PlaceholderGame';
import { GameManifest } from '@/lib/types';

export class MinesweeperGame extends PlaceholderGame {
  constructor() {
    const manifest: GameManifest = {
      id: 'minesweeper',
      title: 'Minesweeper',
      thumbnail: '/games/minesweeper/minesweeper-thumb.svg',
      inputSchema: ['keyboard', 'touch'],
      assetBudgetKB: 60,
      tier: 0,
      description: 'Clear the board without hitting mines. Coming soon!'
    };
    super(manifest);
  }
}
