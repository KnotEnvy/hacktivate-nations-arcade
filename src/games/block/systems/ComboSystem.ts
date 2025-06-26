export class ComboSystem {
  private combo = 0;
  private timer = 0;
  private timeLimit = 3; // seconds to continue combo
  private multiplier = 1;

  addClear(lines: number): number {
    if (lines > 0) {
      this.combo += 1;
      this.timer = this.timeLimit;

      // simple multiplier scaling
      if (this.combo >= 4) {
        this.multiplier = 3;
      } else if (this.combo >= 2) {
        this.multiplier = 2;
      } else {
        this.multiplier = 1;
      }
    } else {
      this.reset();
    }
    return this.multiplier;
  }

  update(dt: number): void {
    if (this.timer > 0) {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.reset();
      }
    }
  }

  reset(): void {
    this.combo = 0;
    this.timer = 0;
    this.multiplier = 1;
  }

  getCombo(): number {
    return this.combo;
  }

  getMultiplier(): number {
    return this.multiplier;
  }

  getTimeLeft(): number {
    return this.timer;
  }
}
