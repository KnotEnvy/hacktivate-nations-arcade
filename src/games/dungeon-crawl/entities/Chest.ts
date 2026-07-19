// ===== src/games/dungeon-crawl/entities/Chest.ts =====
// Wave M — locked strongboxes. Indestructible furniture: no blast or blade
// opens one, only a thief's picks or a spent key. Contents roll on the LIVE
// rng at the moment of opening (systems/ThiefSkills owns that flow).

export class Chest {
  opened = false;
  /** Failed-pick feedback timer — TileRenderer jiggles the box while > 0. */
  jiggle = 0;
  readonly x: number;
  readonly y: number;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  get radius(): number {
    return 12;
  }
}
