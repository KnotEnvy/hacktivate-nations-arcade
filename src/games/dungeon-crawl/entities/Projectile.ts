// ===== src/games/dungeon-crawl/entities/Projectile.ts =====
// Shared projectile pool for sorcerer/boss bolts and player daggers. Straight
// flight, dies on walls; DungeonCrawlGame owns hit resolution.

import { TileMap } from '../dungeon/TileMap';
import type { DeathCause } from '../systems/Combat';

export type ProjectileKind = 'bolt' | 'dagger';

export class Projectile {
  alive = true;
  x: number;
  y: number;
  vx: number;
  vy: number;
  kind: ProjectileKind;
  damage: number;
  pierce: boolean;
  age = 0;
  hitIds = new Set<number>(); // enemies already hit (piercing daggers)
  // v2 — homing turn rate in radians/sec (0 = straight; Hollow King bolts).
  homing = 0;
  // v4 Wave D — recap cause when this hostile bolt lands (default: sorcery).
  cause?: DeathCause;

  constructor(
    kind: ProjectileKind,
    x: number,
    y: number,
    vx: number,
    vy: number,
    damage: number,
    pierce = false,
    homing = 0,
  ) {
    this.kind = kind;
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.damage = damage;
    this.pierce = pierce;
    this.homing = homing;
  }

  get radius(): number {
    return this.kind === 'bolt' ? 5 : 4;
  }

  update(dt: number, map: TileMap, targetX?: number, targetY?: number): void {
    if (!this.alive) return;
    this.age += dt;

    // Homing bolts steer toward the target by at most `homing` rad/s. Homing
    // fades out after 3s so a dodged bolt eventually sails past.
    if (this.homing > 0 && targetX !== undefined && targetY !== undefined && this.age < 3) {
      const speed = Math.hypot(this.vx, this.vy) || 1;
      const current = Math.atan2(this.vy, this.vx);
      const desired = Math.atan2(targetY - this.y, targetX - this.x);
      let delta = desired - current;
      while (delta > Math.PI) delta -= Math.PI * 2;
      while (delta < -Math.PI) delta += Math.PI * 2;
      const maxTurn = this.homing * dt;
      const turned = current + Math.max(-maxTurn, Math.min(maxTurn, delta));
      this.vx = Math.cos(turned) * speed;
      this.vy = Math.sin(turned) * speed;
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;
    const { tx, ty } = map.tileAtWorld(this.x, this.y);
    if (map.isSolidAt(tx, ty)) this.alive = false;
    if (this.age > 6) this.alive = false; // hard TTL safety net
  }
}
