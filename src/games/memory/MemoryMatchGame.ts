import { PlaceholderGame } from '@/games/shared/PlaceholderGame';
import { GameManifest } from '@/lib/types';

export class MemoryMatchGame extends PlaceholderGame {
  constructor() {
    const manifest: GameManifest = {
      id: 'memory',
      title: 'Memory Match',
      thumbnail: '/games/memory/memory-thumb.svg',
      inputSchema: ['touch'],
      assetBudgetKB: 60,
      tier: 0,
      description: 'Flip cards to find pairs. Coming soon!'
    };
    super(manifest);
  }
}
