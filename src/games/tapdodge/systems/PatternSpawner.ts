// ===== src/games/tapdodge/systems/PatternSpawner.ts =====
//
// Rows, not dice. Every spawn is one ROW drawn from a small pattern table —
// a single hazard, a pair, a wall with one gap, a drone that patrols inside
// its own lane, a full-width laser, a line of coins — and three rules hold
// for every row it ever produces:
//
//   1. at least one lane is safe;
//   2. from ANY safe lane of the previous row, a safe lane of this row is at
//      most MAX_SAFE_STEP (2) lanes away;
//   3. the clear road between the previous row's back edge and this row's
//      front edge is never under MIN_ROW_GAP — ROW_FLOOR_SECONDS of travel
//      at the fastest the road can ever move, so the floor holds at every
//      speed, rush included.
//
// All rows move at the road's single speed, so a gap scheduled here is the
// gap the player gets. Lasers block no lane (they are answered with a jump
// or a duck), so they carry the previous row's safe lanes forward and get
// LASER_CLEARANCE of road either side, enough to finish one dodge and its
// cooldown before the next row needs anything.

import { LANES, ROAD_W, mulberry32 } from './layout';
import { MAX_SPEED, RUSH_GAP } from './Progression';
import type { PowerUpType } from '../entities/PowerUp';

export const ROW_FLOOR_SECONDS = 0.55;
export const MIN_ROW_GAP = ROW_FLOOR_SECONDS * MAX_SPEED;
export const LASER_CLEARANCE = 1.0;
export const MAX_SAFE_STEP = 2;
/** Seconds of road before the first row of a run. */
const OPENING_GAP = 0.8;

export type PatternKind =
  | 'single'
  | 'pair'
  | 'wall'
  | 'drifter'
  | 'laser'
  | 'coins';

export type HazardKind = 'crate' | 'spike' | 'wall' | 'drifter' | 'laser';
export type LaserBand = 'high' | 'low';

/** Draw sizes; each hazard's hitbox is inset from these in Obstacle. */
export const HAZARD_SIZE: Record<HazardKind, { w: number; h: number }> = {
  crate: { w: 64, h: 64 },
  spike: { w: 60, h: 60 },
  wall: { w: 112, h: 26 },
  drifter: { w: 52, h: 38 },
  laser: { w: ROAD_W, h: 14 },
};

export interface HazardSpec {
  kind: HazardKind;
  /** -1 for a laser, which spans the road. */
  lane: number;
  band?: LaserBand;
}

export interface PickupSpec {
  kind: 'coin' | 'gem' | 'power';
  lane: number;
  /** Centre height above the row's front (bottom) edge. */
  dy: number;
  power?: PowerUpType;
}

export interface RowSpec {
  id: number;
  pattern: PatternKind;
  hazards: HazardSpec[];
  pickups: PickupSpec[];
  /** Lanes a ship cannot sit in while this row passes. */
  blocked: number[];
  /** Lanes that are safe; for lasers and coin lines, carried forward. */
  safe: number[];
  /** Front edge to back edge, px. */
  height: number;
  /** Clear road scheduled between this row's back edge and the next row. */
  gapAfter: number;
}

export interface SpawnContext {
  zone: number;
  worldTime: number;
  /** Road speed right now, px/s. */
  speed: number;
  rush: boolean;
}

const ALL_LANES = [0, 1, 2, 3, 4];

type Weights = Record<PatternKind, number>;
const ZONE_WEIGHTS: readonly Weights[] = [
  { single: 46, pair: 26, wall: 14, drifter: 0, laser: 0, coins: 14 },
  { single: 30, pair: 24, wall: 18, drifter: 8, laser: 10, coins: 10 },
  { single: 22, pair: 24, wall: 22, drifter: 12, laser: 12, coins: 8 },
  { single: 18, pair: 24, wall: 24, drifter: 14, laser: 13, coins: 7 },
];
const RUSH_WEIGHTS: Weights = {
  single: 18,
  pair: 30,
  wall: 34,
  drifter: 18,
  laser: 0,
  coins: 0,
};

/** Seconds of clear road between rows, by zone; tightens after 120s. */
const ZONE_GAP = [1.35, 1.1, 0.9, 0.75];
const LATE_GAP = 0.62;

const POWER_TYPES: readonly PowerUpType[] = [
  'shield',
  'magnet',
  'slow',
  'ghost',
  'drone',
];
const POWER_EVERY = 14;
const POWER_CHANCE = 0.07;

export function baseGapSeconds(zone: number, worldTime: number): number {
  const z = Math.max(0, Math.min(ZONE_GAP.length - 1, zone));
  if (z < ZONE_GAP.length - 1 || worldTime <= 120) return ZONE_GAP[z];
  const k = Math.min(1, (worldTime - 120) / 120);
  return ZONE_GAP[z] + (LATE_GAP - ZONE_GAP[z]) * k;
}

/**
 * Rule 2: every lane in `prev` can reach a free lane of the new row in at
 * most MAX_SAFE_STEP hops.
 */
export function reachable(prev: readonly number[], blocked: number[]): boolean {
  const free = ALL_LANES.filter(l => !blocked.includes(l));
  if (free.length === 0) return false;
  return prev.every(s => free.some(t => Math.abs(s - t) <= MAX_SAFE_STEP));
}

export class PatternSpawner {
  private rng: () => number = Math.random;
  private travelled = 0;
  private needed = 0;
  private prevSafe: number[] = [...ALL_LANES];
  private upcoming: PatternKind = 'single';
  private nextId = 1;
  private lastPowerAt = -Infinity;

  constructor(seed = 1) {
    this.reset(seed);
  }

  reset(seed: number): void {
    this.rng = mulberry32(seed);
    this.travelled = 0;
    this.prevSafe = [...ALL_LANES];
    this.upcoming = 'single';
    this.nextId = 1;
    this.lastPowerAt = -Infinity;
    // Resolved on the first advance, when the road speed is known.
    this.needed = -1;
  }

  /** The safe lanes the next row is built against. */
  getPrevSafe(): readonly number[] {
    return this.prevSafe;
  }

  /**
   * Advance by `dy` px of road travel. Returns the rows due, each with how
   * far past its spawn line it already is, so spacing stays exact at any dt.
   */
  advance(
    dy: number,
    ctx: SpawnContext
  ): Array<{ row: RowSpec; overshoot: number }> {
    if (this.needed < 0) this.needed = OPENING_GAP * ctx.speed;
    this.travelled += dy;
    const out: Array<{ row: RowSpec; overshoot: number }> = [];
    while (this.travelled >= this.needed) {
      const overshoot = this.travelled - this.needed;
      const row = this.next(ctx);
      this.travelled = overshoot;
      out.push({ row, overshoot });
    }
    return out;
  }

  /** Build the next row now. `forced` picks its pattern (scenes, tests). */
  next(ctx: SpawnContext, forced?: PatternKind): RowSpec {
    const kind = forced ?? this.upcoming;
    const row = this.build(kind, ctx);
    this.upcoming = this.pick(ctx);

    let seconds = baseGapSeconds(ctx.zone, ctx.worldTime);
    if (ctx.rush) seconds *= RUSH_GAP;
    if (kind === 'laser' || this.upcoming === 'laser') {
      seconds = Math.max(seconds, LASER_CLEARANCE);
    }
    row.gapAfter = Math.max(seconds * ctx.speed, MIN_ROW_GAP);
    this.needed = row.height + row.gapAfter;
    // Spacing restarts from this row (advance() then adds its overshoot).
    this.travelled = 0;
    this.prevSafe = row.safe;
    return row;
  }

  // ------------------------------------------------------------ patterns

  private pick(ctx: SpawnContext): PatternKind {
    const w = ctx.rush
      ? RUSH_WEIGHTS
      : ZONE_WEIGHTS[Math.max(0, Math.min(ZONE_WEIGHTS.length - 1, ctx.zone))];
    const kinds = Object.keys(w) as PatternKind[];
    const total = kinds.reduce((sum, k) => sum + w[k], 0);
    let r = this.rng() * total;
    for (const k of kinds) {
      r -= w[k];
      if (r < 0) return k;
    }
    return 'single';
  }

  private build(kind: PatternKind, ctx: SpawnContext): RowSpec {
    const hazards: HazardSpec[] = [];
    const pickups: PickupSpec[] = [];
    const prev = this.prevSafe;

    switch (kind) {
      case 'single': {
        // Usually aim at a lane the player could be sitting in.
        const lane = this.rng() < 0.6 ? this.choose(prev) : this.lane();
        hazards.push({ kind: this.blockKind(ctx), lane });
        if (this.rng() < 0.3) {
          const side = lane + (this.rng() < 0.5 ? -1 : 1);
          const at = side < 0 || side >= LANES ? lane * 2 - side : side;
          const gem = ctx.zone >= 1 && this.rng() < 0.08;
          pickups.push({ kind: gem ? 'gem' : 'coin', lane: at, dy: 0 });
        }
        break;
      }
      case 'pair': {
        let a = this.lane();
        let b = this.lane();
        // Six in ten pairs leave a lane between them, and often a coin in it.
        const spaced = this.rng() < 0.6;
        for (let tries = 0; tries < 12; tries++) {
          const ok = spaced ? Math.abs(a - b) === 2 : a !== b;
          if (ok && reachable(prev, [a, b])) break;
          a = this.lane();
          b = this.lane();
        }
        if (a === b || !reachable(prev, [a, b])) {
          a = 0;
          b = 4;
        }
        hazards.push({ kind: this.blockKind(ctx), lane: a });
        hazards.push({ kind: this.blockKind(ctx), lane: b });
        if (Math.abs(a - b) === 2 && this.rng() < 0.45) {
          pickups.push({ kind: 'coin', lane: (a + b) / 2, dy: 0 });
        }
        break;
      }
      case 'wall': {
        const allowed = ALL_LANES.filter(g =>
          prev.every(s => Math.abs(s - g) <= MAX_SAFE_STEP)
        );
        const gap = this.choose(allowed.length > 0 ? allowed : [2]);
        for (const lane of ALL_LANES) {
          if (lane !== gap) hazards.push({ kind: 'wall', lane });
        }
        const roll = this.rng();
        if (ctx.zone >= 1 && roll < 0.12) {
          pickups.push({ kind: 'gem', lane: gap, dy: 0 });
        } else if (roll < 0.55) {
          pickups.push({ kind: 'coin', lane: gap, dy: 0 });
        }
        break;
      }
      case 'drifter': {
        const lane = this.rng() < 0.6 ? this.choose(prev) : this.lane();
        hazards.push({ kind: 'drifter', lane });
        if (ctx.zone >= 2 && this.rng() < 0.45) {
          const far = ALL_LANES.filter(
            l => Math.abs(l - lane) >= 2 && reachable(prev, [lane, l])
          );
          if (far.length > 0) {
            hazards.push({ kind: 'crate', lane: this.choose(far) });
          }
        }
        break;
      }
      case 'laser': {
        hazards.push({
          kind: 'laser',
          lane: -1,
          band: this.rng() < 0.5 ? 'high' : 'low',
        });
        break;
      }
      case 'coins': {
        const near = ALL_LANES.filter(l =>
          prev.some(s => Math.abs(s - l) <= 1)
        );
        const lane = this.choose(near);
        for (let i = 0; i < 5; i++) {
          pickups.push({ kind: 'coin', lane, dy: 12 + i * 52 });
        }
        break;
      }
    }

    const blocked = hazards.filter(h => h.lane >= 0).map(h => h.lane);
    let height = 24;
    for (const h of hazards) height = Math.max(height, HAZARD_SIZE[h.kind].h);
    for (const p of pickups) height = Math.max(height, p.dy + 12);

    let safe: number[];
    if (kind === 'laser') {
      safe = [...prev];
    } else if (kind === 'coins') {
      safe = [...new Set([...prev, ...pickups.map(p => p.lane)])].sort(
        (x, y) => x - y
      );
    } else {
      safe = ALL_LANES.filter(l => !blocked.includes(l));
    }

    // Centre single pickups on the row's front-to-back middle.
    for (const p of pickups) {
      if (kind !== 'coins') p.dy = Math.max(12, height / 2);
    }

    this.maybePower(kind, ctx, safe, pickups, height);

    return {
      id: this.nextId++,
      pattern: kind,
      hazards,
      pickups,
      blocked,
      safe,
      height,
      gapAfter: 0,
    };
  }

  private maybePower(
    kind: PatternKind,
    ctx: SpawnContext,
    safe: number[],
    pickups: PickupSpec[],
    height: number
  ): void {
    if (ctx.rush || kind === 'laser' || kind === 'coins') return;
    if (ctx.worldTime < 10) return;
    if (ctx.worldTime - this.lastPowerAt < POWER_EVERY) return;
    if (this.rng() >= POWER_CHANCE) return;
    const open = safe.filter(l => !pickups.some(p => p.lane === l));
    if (open.length === 0) return;
    this.lastPowerAt = ctx.worldTime;
    pickups.push({
      kind: 'power',
      lane: this.choose(open),
      dy: Math.max(18, height / 2),
      power: this.choose(POWER_TYPES),
    });
  }

  private blockKind(ctx: SpawnContext): HazardKind {
    return ctx.zone >= 1 && this.rng() < 0.45 ? 'spike' : 'crate';
  }

  private lane(): number {
    return Math.floor(this.rng() * LANES);
  }

  private choose<T>(items: readonly T[]): T {
    return items[Math.floor(this.rng() * items.length)];
  }
}
