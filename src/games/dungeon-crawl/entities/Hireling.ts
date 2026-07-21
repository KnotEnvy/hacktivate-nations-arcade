// ===== src/games/dungeon-crawl/entities/Hireling.ts =====
// Wave O — THE SELLSWORD: the temple's hired blade, one per expedition. A
// deliberately SIMPLE body: position, hit points and timers. All behavior
// (following, striking, taking touch damage) resolves in Combat beside the
// entity turn — no faction concept ever enters Enemy or the damage funnel.
// Enemies never TARGET the sellsword; it gets hurt only by wading into them.

import { HIRELING } from '../data/constants';

export class Hireling {
  x = 0;
  y = 0;
  readonly radius = 9;
  readonly size = 14; // collision box for map movement (the player's shape)
  hp: number = HIRELING.HP;
  readonly maxHp: number = HIRELING.HP;
  alive = true;
  /** Facing for the sprite (flips toward the current foe / travel). */
  faceX = 0;
  faceY = 1;
  swingAnim = 0; // visual tail after a strike
  flash = 0; // hurt feedback (view-only)
  strikeCooldown = 0;
  hurtCooldown = 0;

  /** A new floor: fall in beside the hero (run state persists). */
  placeAt(x: number, y: number): void {
    this.x = x;
    this.y = y;
    this.strikeCooldown = 0;
    this.hurtCooldown = 0;
    this.swingAnim = 0;
    this.flash = 0;
  }

  tickTimers(dt: number): void {
    if (this.strikeCooldown > 0) this.strikeCooldown = Math.max(0, this.strikeCooldown - dt);
    if (this.hurtCooldown > 0) this.hurtCooldown = Math.max(0, this.hurtCooldown - dt);
    if (this.swingAnim > 0) this.swingAnim = Math.max(0, this.swingAnim - dt);
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt);
  }
}
