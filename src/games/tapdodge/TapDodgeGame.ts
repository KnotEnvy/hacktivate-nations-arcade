import { PlaceholderGame } from '@/games/shared/PlaceholderGame';
import { GameManifest } from '@/lib/types';

export class TapDodgeGame extends PlaceholderGame {
  constructor() {
    const manifest: GameManifest = {
      id: 'tapdodge',
      title: 'Tap Dodge',
      thumbnail: '/games/tapdodge/tapdodge-thumb.svg',
      inputSchema: ['touch'],
      assetBudgetKB: 60,
      tier: 0,
      description: 'Tap to dodge obstacles. Coming soon!'
    };
    super(manifest);
  }
}
