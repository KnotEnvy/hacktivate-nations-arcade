// ===== src/games/tapdodge/entities/Player.ts =====
//
// The ship: a compact wedge with a cockpit and two engine nozzles. It is
// always either ON a lane centre or travelling to one — there is no free
// position, so it can never straddle two lanes and clip two hazards.
//
// Poses, each readable at a glance:
//   hop    banks up to ±0.25 rad toward the new lane
//   jump   rises toward the camera (grows, shadow drops away), squashes on
//          landing — clears LOW beams
//   duck   flattens onto the road with a tight dark shadow and skid marks —
//          passes under HIGH beams
//
// Lateral motion runs on real time so a hop always feels the same; the dodge
// runs on world time so slow-motion stretches it along with the beam.

import { SHIP } from '../systems/palette';
import { wedgePath } from '../systems/icons';
import { Rect, SHIP_Y, clampLane, laneCenter } from '../systems/layout';

export type DodgeKind = 'jump' | 'duck';

export const DODGE_TIME = 0.45;
export const DODGE_COOLDOWN = 0.25;
export const SHIP_HITBOX = 30;
const SHIP_W = 34;
const SHIP_H = 40;

/** Hop: exponential approach, never slower than HOP_MIN_V px/s. */
const HOP_K = 22;
const HOP_MIN_V = 700;
const BANK_MAX = 0.25;
const LAND_SQUASH = 0.14;
const TRAIL_POINTS = 7;
const TRAIL_EVERY = 0.02;

export interface ShipLook {
  speedFactor: number;
  shield: boolean;
  ghost: boolean;
  time: number;
}

export class Player {
  lane = 2;
  x = laneCenter(2);
  readonly y = SHIP_Y;
  vx = 0;
  dodge: DodgeKind | null = null;
  dodgeT = 0;
  cooldown = 0;
  /** Dodges begun this run (tests pin that a held key starts only one). */
  dodgesStarted = 0;
  invuln = 0;
  private invulnSpan = 0;
  private bank = 0;
  private squash = 0;
  private trail: Array<{ x: number; y: number }> = [];
  private trailTimer = 0;

  reset(): void {
    this.lane = 2;
    this.x = laneCenter(2);
    this.vx = 0;
    this.dodge = null;
    this.dodgeT = 0;
    this.cooldown = 0;
    this.dodgesStarted = 0;
    this.invuln = 0;
    this.invulnSpan = 0;
    this.bank = 0;
    this.squash = 0;
    this.trail = [];
    this.trailTimer = 0;
  }

  /** One lane left (-1) or right (+1). Returns whether the lane changed. */
  hop(dir: number): boolean {
    return this.steerTo(this.lane + dir);
  }

  steerTo(lane: number): boolean {
    const next = clampLane(lane);
    if (next === this.lane) return false;
    this.lane = next;
    return true;
  }

  canDodge(): boolean {
    return this.dodge === null && this.cooldown <= 0;
  }

  startDodge(kind: DodgeKind): boolean {
    if (!this.canDodge()) return false;
    this.dodge = kind;
    this.dodgeT = DODGE_TIME;
    this.dodgesStarted++;
    return true;
  }

  isJumping(): boolean {
    return this.dodge === 'jump';
  }

  isDucking(): boolean {
    return this.dodge === 'duck';
  }

  setInvulnerable(seconds: number): void {
    if (seconds > this.invuln) {
      this.invuln = seconds;
      this.invulnSpan = seconds;
    }
  }

  isInvulnerable(): boolean {
    return this.invuln > 0;
  }

  /** Exactly on its lane centre. */
  settled(): boolean {
    return this.x === laneCenter(this.lane);
  }

  hitbox(): Rect {
    const h = SHIP_HITBOX / 2;
    return { x: this.x - h, y: this.y - h, w: SHIP_HITBOX, h: SHIP_HITBOX };
  }

  /**
   * `dt` real seconds, `wdt` world seconds, `dy` how far the road moved
   * (the trail scrolls away with it).
   */
  update(dt: number, wdt: number, dy: number): void {
    const target = laneCenter(this.lane);
    const dx = target - this.x;
    if (Math.abs(dx) < 0.5) {
      this.x = target;
      this.vx = 0;
    } else if (dt > 0) {
      const v = Math.max(HOP_MIN_V, Math.abs(dx) * HOP_K);
      const step = Math.sign(dx) * Math.min(Math.abs(dx), v * dt);
      this.x += step;
      this.vx = step / dt;
      if (Math.abs(target - this.x) < 0.5) this.x = target;
    }

    const bankTo = Math.max(-1, Math.min(1, this.vx / 1400)) * BANK_MAX;
    this.bank += (bankTo - this.bank) * Math.min(1, dt * 18);

    if (this.dodge) {
      this.dodgeT -= wdt;
      if (this.dodgeT <= 0) {
        if (this.dodge === 'jump') this.squash = LAND_SQUASH;
        this.dodge = null;
        this.dodgeT = 0;
        this.cooldown = DODGE_COOLDOWN;
      }
    } else if (this.cooldown > 0) {
      this.cooldown = Math.max(0, this.cooldown - wdt);
    }

    this.squash = Math.max(0, this.squash - dt);
    this.invuln = Math.max(0, this.invuln - dt);

    for (const p of this.trail) p.y += dy;
    this.trailTimer += dt;
    if (this.trailTimer >= TRAIL_EVERY) {
      this.trailTimer = 0;
      this.trail.push({ x: this.x, y: this.y + SHIP_H * 0.35 });
      if (this.trail.length > TRAIL_POINTS) this.trail.shift();
    }
  }

  // ------------------------------------------------------------ render

  render(ctx: CanvasRenderingContext2D, look: ShipLook): void {
    const lift =
      this.dodge === 'jump'
        ? Math.sin(Math.PI * (1 - this.dodgeT / DODGE_TIME))
        : 0;
    let sx = 1 + 0.24 * lift;
    let sy = sx;
    if (this.dodge === 'duck') {
      sx = 1.16;
      sy = 0.72;
    } else if (this.squash > 0) {
      const k = this.squash / LAND_SQUASH;
      sx = 1 + 0.12 * k;
      sy = 1 - 0.14 * k;
    }

    // Blink at 8Hz while invulnerable after a hit.
    let alpha = 1;
    if (this.invuln > 0 && this.invulnSpan > 0) {
      const t = this.invulnSpan - this.invuln;
      alpha = Math.floor(t * 16) % 2 === 0 ? 1 : 0.25;
    }
    if (look.ghost) alpha *= 0.42;

    this.renderTrail(ctx, alpha);

    // Shadow: far and faint in a jump, tight and dark in a duck.
    ctx.save();
    const ducking = this.dodge === 'duck';
    const shOff = ducking ? 3 : 9 + 16 * lift;
    const shScale = ducking ? 1.2 : 1 - 0.35 * lift;
    ctx.globalAlpha = (ducking ? 0.6 : 0.34 - 0.14 * lift) * alpha;
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.ellipse(
      this.x,
      this.y + shOff,
      (SHIP_W / 2) * shScale,
      (SHIP_H / 3.2) * shScale * (ducking ? 0.7 : 1),
      0,
      0,
      Math.PI * 2
    );
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(this.x, this.y);
    ctx.rotate(this.bank);
    ctx.scale(sx, sy);

    // The one glow.
    const glow = ctx.createRadialGradient(0, 4, 2, 0, 4, 34);
    glow.addColorStop(0, 'rgba(98, 230, 255, 0.28)');
    glow.addColorStop(1, 'rgba(98, 230, 255, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(-34, -30, 68, 68);

    this.renderFlames(ctx, look);

    wedgePath(ctx, 0, 0, SHIP_W, SHIP_H);
    const hull = ctx.createLinearGradient(0, -SHIP_H / 2, 0, SHIP_H / 2);
    hull.addColorStop(0, SHIP.hull);
    hull.addColorStop(1, SHIP.hullShade);
    ctx.fillStyle = hull;
    ctx.fill();
    ctx.strokeStyle = SHIP.outline;
    ctx.lineWidth = 1.5;
    if (look.ghost) ctx.setLineDash([4, 3]);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = SHIP.cockpit;
    ctx.beginPath();
    ctx.ellipse(0, -3, 4.5, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.fillRect(-1.5, -8, 2, 4);

    if (ducking) {
      // Skid marks either side: this ship is down on the road.
      ctx.strokeStyle = SHIP.cockpit;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-SHIP_W / 2 - 5, 2);
      ctx.lineTo(-SHIP_W / 2 - 5, 16);
      ctx.moveTo(SHIP_W / 2 + 5, 2);
      ctx.lineTo(SHIP_W / 2 + 5, 16);
      ctx.stroke();
    }
    ctx.restore();

    if (look.shield) {
      ctx.save();
      const r = 29 + Math.sin(look.time * 4) * 1.2;
      ctx.fillStyle = 'rgba(111, 232, 255, 0.08)';
      ctx.strokeStyle = 'rgba(111, 232, 255, 0.85)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(this.x, this.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }

  private renderFlames(ctx: CanvasRenderingContext2D, look: ShipLook): void {
    const len =
      7 +
      10 * Math.max(0, look.speedFactor - 1) +
      Math.sin(look.time * 40) * 1.5;
    for (const nx of [-7, 7]) {
      const top = SHIP_H * 0.32;
      const g = ctx.createLinearGradient(0, top, 0, top + len);
      g.addColorStop(0, SHIP.flame);
      g.addColorStop(1, 'rgba(140, 245, 255, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(nx - 3.5, top);
      ctx.lineTo(nx + 3.5, top);
      ctx.lineTo(nx, top + len);
      ctx.closePath();
      ctx.fill();
    }
  }

  private renderTrail(ctx: CanvasRenderingContext2D, alpha: number): void {
    const n = this.trail.length;
    if (n < 2) return;
    ctx.save();
    ctx.strokeStyle = SHIP.glow;
    ctx.lineCap = 'round';
    for (let i = 1; i < n; i++) {
      const a = this.trail[i - 1];
      const b = this.trail[i];
      const k = i / n;
      ctx.globalAlpha = 0.22 * k * alpha;
      ctx.lineWidth = 2 + 5 * k;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    ctx.restore();
  }
}
