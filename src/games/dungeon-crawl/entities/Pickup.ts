// ===== src/games/dungeon-crawl/entities/Pickup.ts =====
// Floor loot. Gold can be magnetized (Coin Magnet relic); everything else
// waits to be walked over. DungeonCrawlGame applies effects on collection.

import { PICKUPS } from '../data/constants';
import { PickupKind } from '../dungeon/DungeonGenerator';

export class Pickup {
  alive = true;
  kind: PickupKind;
  x: number;
  y: number;
  bobPhase: number;

  constructor(kind: PickupKind, x: number, y: number) {
    this.kind = kind;
    this.x = x;
    this.y = y;
    this.bobPhase = Math.random() * Math.PI * 2;
  }

  get radius(): number {
    switch (this.kind) {
      case 'relic-shrine':
        return 16;
      case 'gold':
        return 7;
      default:
        return 10;
    }
  }

  /** Collection radius is friendlier than the visual radius. */
  get collectRadius(): number {
    return this.radius + 12;
  }

  update(dt: number, playerX: number, playerY: number, magnet: boolean): void {
    this.bobPhase += dt * 4;
    if (magnet && this.kind === 'gold') {
      const dx = playerX - this.x;
      const dy = playerY - this.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 0.001 && dist < PICKUPS.MAGNET_RADIUS) {
        const pull = PICKUPS.MAGNET_SPEED * (1 - dist / PICKUPS.MAGNET_RADIUS + 0.3);
        this.x += (dx / dist) * pull * dt;
        this.y += (dy / dist) * pull * dt;
      }
    }
  }
}
