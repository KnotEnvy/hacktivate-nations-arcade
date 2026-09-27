// ===== src/games/tapdodge/systems/FeverSystem.ts =====
//
// Fever rewards flying clean. Every 10 seconds without a hit raises the
// level, which multiplies the points the road pays per second; any hit drops
// it straight back to CRUISE. It runs on real time, like the player's nerve.

import { FEVER_COLORS } from './palette';

export interface FeverLevel {
  name: string;
  multiplier: number;
  color: string;
}

export const FEVER_LEVELS: readonly FeverLevel[] = [
  { name: 'CRUISE', multiplier: 1.0, color: FEVER_COLORS[0] },
  { name: 'WARM', multiplier: 1.5, color: FEVER_COLORS[1] },
  { name: 'HOT', multiplier: 2.0, color: FEVER_COLORS[2] },
  { name: 'BLAZING', multiplier: 2.5, color: FEVER_COLORS[3] },
  { name: 'FEVER', multiplier: 3.0, color: FEVER_COLORS[4] },
];

export const FEVER_LEVEL_SECONDS = 10;

export class FeverSystem {
  /** Seconds since the last hit. */
  cleanTime = 0;
  level = 0;
  maxLevelReached = 0;
  /** Seconds left on the level-up flash. */
  flash = 0;

  update(dt: number): boolean {
    this.cleanTime += dt;
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt);
    const next = Math.min(
      FEVER_LEVELS.length - 1,
      Math.floor(this.cleanTime / FEVER_LEVEL_SECONDS)
    );
    if (next > this.level) {
      this.level = next;
      this.flash = 0.6;
      this.maxLevelReached = Math.max(this.maxLevelReached, next);
      return true;
    }
    return false;
  }

  onDamage(): void {
    this.cleanTime = 0;
    this.level = 0;
  }

  multiplier(): number {
    return FEVER_LEVELS[this.level].multiplier;
  }

  info(): FeverLevel {
    return FEVER_LEVELS[this.level];
  }

  /** 0..1 toward the next level; full at the top. */
  progress(): number {
    if (this.level >= FEVER_LEVELS.length - 1) return 1;
    return (this.cleanTime % FEVER_LEVEL_SECONDS) / FEVER_LEVEL_SECONDS;
  }

  reset(): void {
    this.cleanTime = 0;
    this.level = 0;
    this.maxLevelReached = 0;
    this.flash = 0;
  }
}
