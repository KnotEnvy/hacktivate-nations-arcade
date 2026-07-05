// ===== src/games/dungeon-crawl/entities/Urn.ts =====
// v2 — destructible clay urns scattered through rooms. One hit breaks them;
// DungeonCrawlGame rolls the loot (gold / heart / dagger) on break.

export class Urn {
  alive = true;
  readonly x: number;
  readonly y: number;
  readonly variant: number; // 0..2 picks a sprite shape

  constructor(x: number, y: number, variant: number) {
    this.x = x;
    this.y = y;
    this.variant = variant;
  }

  get radius(): number {
    return 11;
  }
}
