// ===== src/games/runner/systems/ComboSystem.ts =====
export class ComboSystem {
  private combo: number = 0;
  private comboTimer: number = 0;
  private comboTimeLimit: number = 3.5; // seconds
  private multiplier: number = 1;
  private maxCombo: number = 0;
  
  addCoin(): number {
    this.combo++;
    this.comboTimer = this.comboTimeLimit;
    if (this.combo > this.maxCombo) this.maxCombo = this.combo;
    
    // Calculate multiplier based on combo
    if (this.combo >= 10) {
      this.multiplier = 3;
    } else if (this.combo >= 5) {
      this.multiplier = 2;
    } else {
      this.multiplier = 1;
    }
    
    return this.multiplier;
  }
  
  update(dt: number): void {
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.resetCombo();
      }
    }
  }
  
  resetCombo(): void {
    this.combo = 0;
    this.multiplier = 1;
    this.comboTimer = 0;
  }
  
  getCombo(): number {
    return this.combo;
  }
  
  getMultiplier(): number {
    return this.multiplier;
  }
  
  getTimeLeft(): number {
    return this.comboTimer;
  }

  getMaxCombo(): number {
    return this.maxCombo;
  }

  resetAll(): void {
    this.combo = 0;
    this.comboTimer = 0;
    this.multiplier = 1;
    this.maxCombo = 0;
  }
}
