// ===== src/games/snake/systems/ComboSystem.ts =====
//
// The feast chain: apples and coins eaten within COMBO_TIMEOUT of each
// other build a multiplier. A hit breaks the chain but not the record.

export const COMBO_TIMEOUT = 3.0;

const MILESTONES = [3, 5, 10, 15, 20, 25, 30, 40, 50];

export interface ComboHit {
  combo: number;
  multiplier: number;
  isMilestone: boolean;
}

export class ComboSystem {
  private combo = 0;
  private comboTimer = 0;
  private maxCombo = 0;

  update(dt: number): void {
    if (this.combo === 0) return;
    this.comboTimer += dt;
    if (this.comboTimer >= COMBO_TIMEOUT) this.breakCombo();
  }

  /** An apple or a coin was eaten. */
  addHit(): ComboHit {
    this.combo++;
    this.comboTimer = 0;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    return {
      combo: this.combo,
      multiplier: this.getMultiplier(),
      isMilestone: MILESTONES.includes(this.combo),
    };
  }

  getMultiplier(): number {
    if (this.combo <= 1) return 1;
    if (this.combo <= 3) return 1.5;
    if (this.combo <= 6) return 2;
    if (this.combo <= 10) return 3;
    return 5;
  }

  getCombo(): number {
    return this.combo;
  }

  getMaxCombo(): number {
    return this.maxCombo;
  }

  /** 1 just after a hit, draining to 0 at the timeout. */
  getComboProgress(): number {
    if (this.combo === 0) return 0;
    return Math.max(0, 1 - this.comboTimer / COMBO_TIMEOUT);
  }

  /** End the current chain (timeout or a hit); the record stays. */
  breakCombo(): void {
    this.combo = 0;
    this.comboTimer = 0;
  }

  reset(): void {
    this.combo = 0;
    this.comboTimer = 0;
    this.maxCombo = 0;
  }
}
