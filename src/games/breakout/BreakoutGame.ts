import { PlaceholderGame } from '@/games/shared/PlaceholderGame';
import { GameManifest } from '@/lib/types';

export class BreakoutGame extends PlaceholderGame {
  constructor() {
    const manifest: GameManifest = {
      id: 'breakout',
      title: 'Mini Breakout',
      thumbnail: '/games/breakout/breakout-thumb.svg',
      inputSchema: ['keyboard', 'touch'],
      assetBudgetKB: 60,
      tier: 0,
      description: 'Break bricks with a paddle. Coming soon!'
    };
    super(manifest);
  }
}
