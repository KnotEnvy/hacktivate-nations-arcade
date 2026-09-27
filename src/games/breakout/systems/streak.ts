// STREAK — Floodlight's name for the combo. Every brick the ball touches
// between two paddle returns adds one; three in a row pays double, six pays
// triple. Any paddle contact resets it.

export const STREAK_X2 = 3;
export const STREAK_X3 = 6;

export class Streak {
  count = 0;
  /** Longest streak this level (for the clear banner). */
  levelBest = 0;
  /** Longest streak this run. */
  runBest = 0;
  /** Seconds left on the tier-up pop the HUD plays. */
  pulse = 0;

  get mult(): 1 | 2 | 3 {
    return this.count >= STREAK_X3 ? 3 : this.count >= STREAK_X2 ? 2 : 1;
  }

  /** Count a brick contact. Returns true when it lifted the multiplier. */
  hit(): boolean {
    const before = this.mult;
    this.count += 1;
    this.levelBest = Math.max(this.levelBest, this.count);
    this.runBest = Math.max(this.runBest, this.count);
    if (this.mult > before) {
      this.pulse = 0.35;
      return true;
    }
    return false;
  }

  /** A paddle contact (or a lost ball) ends the streak. */
  reset(): void {
    this.count = 0;
  }

  /** 0..1 progress toward the next tier; 1 once at x3. */
  progress(): number {
    if (this.count >= STREAK_X3) return 1;
    if (this.count >= STREAK_X2) {
      return (this.count - STREAK_X2) / (STREAK_X3 - STREAK_X2);
    }
    return this.count / STREAK_X2;
  }

  update(dt: number): void {
    if (this.pulse > 0) this.pulse = Math.max(0, this.pulse - dt);
  }

  newLevel(): void {
    this.count = 0;
    this.levelBest = 0;
  }

  clear(): void {
    this.count = 0;
    this.levelBest = 0;
    this.runBest = 0;
    this.pulse = 0;
  }
}
