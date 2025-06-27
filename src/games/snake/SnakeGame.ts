import { PlaceholderGame } from '@/games/shared/PlaceholderGame';
import { GameManifest } from '@/lib/types';

export class SnakeGame extends PlaceholderGame {
  constructor() {
    const manifest: GameManifest = {
      id: 'snake',
      title: 'Snake',
      thumbnail: '/games/snake/snake-thumb.svg',
      inputSchema: ['keyboard', 'touch'],
      assetBudgetKB: 60,
      tier: 0,
      description: 'Classic snake action. Coming soon!'
    };
    super(manifest);
  }
}
