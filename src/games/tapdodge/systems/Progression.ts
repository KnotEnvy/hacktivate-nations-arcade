// ===== src/games/tapdodge/systems/Progression.ts =====
//
// How the descent gets harder. Four zones of 30 seconds, then a slow ramp to
// a stated ceiling, plus a periodic RUSH: ten seconds that run faster and
// denser, announced two seconds ahead, paid out if you are still flying when
// it ends. (It used to be called a BOSS WAVE, which promised a boss that
// never came.)
//
// Everything here runs on WORLD time — the clock the road moves on — so the
// slow-motion power-up and the near-miss slow-mo do not advance difficulty.

import { ZONES } from './palette';

export const ZONE_SECONDS = 30;

/** px/s of the road at the start of a run. */
export const BASE_SPEED = 210;

/**
 * Speed factor knots, [world seconds, factor]. Continuous so a zone change
 * never lurches; after 120s it keeps climbing slowly to SPEED_CAP at 240s
 * and holds there.
 */
const SPEED_KNOTS: readonly (readonly [number, number])[] = [
  [0, 1],
  [30, 1.2],
  [60, 1.4],
  [90, 1.6],
  [120, 1.75],
  [240, 2.1],
];
export const SPEED_CAP = 2.1;

export const RUSH_SPEED = 1.15;
export const RUSH_GAP = 0.8;
export const RUSH_WARNING = 2;
export const RUSH_LENGTH = 10;
export const FIRST_RUSH_AT = 42;
export const RUSH_EVERY = 55;
/** Seconds the rush takes to blend its speed and colour in and out. */
const RUSH_BLEND = 0.8;

/** The fastest the road ever moves: capped ramp times the rush boost. */
export const MAX_SPEED = BASE_SPEED * SPEED_CAP * RUSH_SPEED;

export function speedFactorAt(t: number): number {
  if (t <= 0) return SPEED_KNOTS[0][1];
  for (let i = 1; i < SPEED_KNOTS.length; i++) {
    const [t1, f1] = SPEED_KNOTS[i];
    if (t <= t1) {
      const [t0, f0] = SPEED_KNOTS[i - 1];
      return f0 + ((f1 - f0) * (t - t0)) / (t1 - t0);
    }
  }
  return SPEED_CAP;
}

export type RushPhase = 'idle' | 'warning' | 'active';

export type ProgressEvent =
  | { type: 'zone'; zone: number }
  | { type: 'rush-warning' }
  | { type: 'rush-start' }
  | { type: 'rush-clear' };

export class Progression {
  worldTime = 0;
  zoneIndex = 0;
  rushPhase: RushPhase = 'idle';
  /** Seconds left in the current warning or rush. */
  rushTimer = 0;
  nextRushAt = FIRST_RUSH_AT;
  rushesCleared = 0;
  /** 0..1, eased toward 1 while a rush runs; drives speed and colour. */
  rushBlend = 0;

  reset(): void {
    this.worldTime = 0;
    this.zoneIndex = 0;
    this.rushPhase = 'idle';
    this.rushTimer = 0;
    this.nextRushAt = FIRST_RUSH_AT;
    this.rushesCleared = 0;
    this.rushBlend = 0;
  }

  /** Advance world time; returns what happened this step, in order. */
  update(dt: number): ProgressEvent[] {
    const events: ProgressEvent[] = [];
    this.worldTime += dt;

    const zone = Math.min(
      ZONES.length - 1,
      Math.floor(this.worldTime / ZONE_SECONDS)
    );
    if (zone !== this.zoneIndex) {
      this.zoneIndex = zone;
      events.push({ type: 'zone', zone });
    }

    if (this.rushPhase === 'idle' && this.worldTime >= this.nextRushAt) {
      this.rushPhase = 'warning';
      this.rushTimer = RUSH_WARNING;
      events.push({ type: 'rush-warning' });
    } else if (this.rushPhase === 'warning') {
      this.rushTimer -= dt;
      if (this.rushTimer <= 0) {
        this.rushPhase = 'active';
        this.rushTimer = RUSH_LENGTH;
        events.push({ type: 'rush-start' });
      }
    } else if (this.rushPhase === 'active') {
      this.rushTimer -= dt;
      if (this.rushTimer <= 0) {
        this.endRush();
        this.rushesCleared++;
        events.push({ type: 'rush-clear' });
      }
    }

    const want = this.rushPhase === 'active' ? 1 : 0;
    const stepK = dt / RUSH_BLEND;
    this.rushBlend =
      want > this.rushBlend
        ? Math.min(1, this.rushBlend + stepK)
        : Math.max(0, this.rushBlend - stepK);

    return events;
  }

  private endRush(): void {
    this.rushPhase = 'idle';
    this.rushTimer = 0;
    this.nextRushAt = this.worldTime + RUSH_EVERY;
  }

  /** A run that ends mid-rush does not clear it. */
  abandonRush(): void {
    if (this.rushPhase !== 'idle') this.endRush();
  }

  isRushActive(): boolean {
    return this.rushPhase === 'active';
  }

  speedFactor(): number {
    return (
      speedFactorAt(this.worldTime) * (1 + (RUSH_SPEED - 1) * this.rushBlend)
    );
  }

  /** The road's speed in px/s. Every row on screen moves at exactly this. */
  speed(): number {
    return BASE_SPEED * this.speedFactor();
  }

  /** 0..1 through the current zone; the last zone tracks the speed ramp. */
  zoneProgress(): number {
    if (this.zoneIndex < ZONES.length - 1) {
      return (this.worldTime % ZONE_SECONDS) / ZONE_SECONDS;
    }
    const start = speedFactorAt(ZONE_SECONDS * (ZONES.length - 1));
    return Math.min(
      1,
      (speedFactorAt(this.worldTime) - start) / (SPEED_CAP - start)
    );
  }

  /** Seconds until the next zone, or null in the last one. */
  secondsToNextZone(): number | null {
    if (this.zoneIndex >= ZONES.length - 1) return null;
    return (this.zoneIndex + 1) * ZONE_SECONDS - this.worldTime;
  }
}
