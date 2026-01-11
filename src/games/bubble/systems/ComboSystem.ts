// ===== src/games/bubble/systems/ComboSystem.ts =====

export interface ComboResult {
  multiplier: number;
  bonus: number;
  isComboActive: boolean;
}

export class ComboSystem {
  private combo: number = 0;
  private maxCombo: number = 0;
  private comboTimer: number = 0;
  private readonly COMBO_TIMEOUT = 3; // seconds to maintain combo

  // Chain tracking (pops within single shot)
  private currentChain: number = 0;
  private maxChain: number = 0;

  // Stats
  private totalPops: number = 0;
  private cascadePops: number = 0;

  // Visual feedback
  private flashIntensity: number = 0;
  private shakeIntensity: number = 0;

  public update(dt: number): void {
    // Decay combo timer
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.combo = 0;
        this.currentChain = 0;
      }
    }

    // Decay visual effects
    this.flashIntensity *= 0.9;
    this.shakeIntensity *= 0.9;
  }

  public addPop(count: number, isCascade: boolean = false): ComboResult {
    this.totalPops += count;
    if (isCascade) {
      this.cascadePops += count;
    }

    // Increment chain for this shot
    this.currentChain++;
    if (this.currentChain > this.maxChain) {
      this.maxChain = this.currentChain;
    }

    // Build combo
    this.combo++;
    if (this.combo > this.maxCombo) {
      this.maxCombo = this.combo;
    }

    // Reset timer
    this.comboTimer = this.COMBO_TIMEOUT;

    // Calculate multiplier
    const multiplier = this.getMultiplier();
    const chainBonus = this.currentChain > 1 ? (this.currentChain - 1) * 50 : 0;
    const bonus = Math.floor(count * 10 * multiplier) + chainBonus;

    // Visual feedback scales with combo
    this.flashIntensity = Math.min(1, 0.3 + this.combo * 0.1);
    this.shakeIntensity = Math.min(10, 2 + this.combo);

    return {
      multiplier,
      bonus,
      isComboActive: this.combo > 1,
    };
  }

  public endShot(): void {
    // Called when shot is complete (bubble landed)
    this.currentChain = 0;
  }

  public getMultiplier(): number {
    if (this.combo <= 1) return 1;
    if (this.combo <= 3) return 1.5;
    if (this.combo <= 5) return 2;
    if (this.combo <= 8) return 2.5;
    if (this.combo <= 12) return 3;
    return 3.5;
  }

  public getCombo(): number {
    return this.combo;
  }

  public getMaxCombo(): number {
    return this.maxCombo;
  }

  public getMaxChain(): number {
    return this.maxChain;
  }

  public getTimeLeft(): number {
    return this.comboTimer;
  }

  public getFlashIntensity(): number {
    return this.flashIntensity;
  }

  public getShakeIntensity(): number {
    return this.shakeIntensity;
  }

  public getTotalPops(): number {
    return this.totalPops;
  }

  public getCascadePops(): number {
    return this.cascadePops;
  }

  public getComboTier(): string {
    if (this.combo <= 0) return '';
    if (this.combo <= 2) return 'NICE';
    if (this.combo <= 4) return 'GREAT';
    if (this.combo <= 6) return 'AWESOME';
    if (this.combo <= 9) return 'AMAZING';
    if (this.combo <= 12) return 'INCREDIBLE';
    return 'LEGENDARY';
  }

  public getComboColor(): string {
    if (this.combo <= 2) return '#22C55E';
    if (this.combo <= 4) return '#3B82F6';
    if (this.combo <= 6) return '#A855F7';
    if (this.combo <= 9) return '#F59E0B';
    if (this.combo <= 12) return '#EF4444';
    return '#EC4899';
  }

  public reset(): void {
    this.combo = 0;
    this.maxCombo = 0;
    this.comboTimer = 0;
    this.currentChain = 0;
    this.maxChain = 0;
    this.totalPops = 0;
    this.cascadePops = 0;
    this.flashIntensity = 0;
    this.shakeIntensity = 0;
  }

  public renderComboUI(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number
  ): void {
    if (this.combo <= 0) return;

    const tier = this.getComboTier();
    const color = this.getComboColor();
    const multiplier = this.getMultiplier();

    ctx.save();

    // Combo background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(x - 60, y - 10, 120, 50);

    // Combo text with glow
    ctx.shadowColor = color;
    ctx.shadowBlur = 10 + this.flashIntensity * 10;

    ctx.fillStyle = color;
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(tier, x, y + 10);

    ctx.font = 'bold 14px Arial';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(`${this.combo}x COMBO (${multiplier.toFixed(1)}x)`, x, y + 30);

    // Timer bar
    if (this.comboTimer > 0) {
      const timerWidth = 100;
      const timerHeight = 4;
      const progress = this.comboTimer / this.COMBO_TIMEOUT;

      ctx.fillStyle = '#374151';
      ctx.fillRect(x - timerWidth / 2, y + 35, timerWidth, timerHeight);

      ctx.fillStyle = color;
      ctx.fillRect(x - timerWidth / 2, y + 35, timerWidth * progress, timerHeight);
    }

    ctx.restore();
  }
}
