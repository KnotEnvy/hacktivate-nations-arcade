// ===== src/games/bubble/systems/FeverSystem.ts =====

export interface FeverLevel {
  name: string;
  multiplier: number;
  color: string;
  glowIntensity: number;
  requirement: number; // pops needed to reach this level
}

const FEVER_LEVELS: FeverLevel[] = [
  { name: '', multiplier: 1.0, color: '#FFFFFF', glowIntensity: 0, requirement: 0 },
  { name: 'WARM', multiplier: 1.25, color: '#22C55E', glowIntensity: 0.1, requirement: 10 },
  { name: 'HOT', multiplier: 1.5, color: '#FBBF24', glowIntensity: 0.15, requirement: 25 },
  { name: 'BLAZING', multiplier: 2.0, color: '#F97316', glowIntensity: 0.2, requirement: 45 },
  { name: 'INFERNO', multiplier: 2.5, color: '#EF4444', glowIntensity: 0.25, requirement: 70 },
  { name: 'FEVER MODE', multiplier: 3.0, color: '#EC4899', glowIntensity: 0.35, requirement: 100 },
];

export class FeverSystem {
  private totalPops: number = 0;
  private currentLevel: number = 0;
  private maxLevelReached: number = 0;

  // Decay system
  private decayTimer: number = 0;
  private readonly DECAY_INTERVAL = 5; // seconds before decay
  private readonly DECAY_AMOUNT = 5; // pops lost per decay

  // Visual
  private flashTimer: number = 0;
  private pulsePhase: number = 0;

  public update(dt: number): void {
    this.pulsePhase += dt * 4;

    // Decay timer
    this.decayTimer += dt;
    if (this.decayTimer >= this.DECAY_INTERVAL && this.totalPops > 0) {
      this.decayTimer = 0;
      this.totalPops = Math.max(0, this.totalPops - this.DECAY_AMOUNT);
      this.updateLevel();
    }

    // Flash decay
    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
    }
  }

  public addPops(count: number): void {
    this.totalPops += count;
    this.decayTimer = 0; // Reset decay on activity
    this.updateLevel();
  }

  private updateLevel(): void {
    let newLevel = 0;
    for (let i = FEVER_LEVELS.length - 1; i >= 0; i--) {
      if (this.totalPops >= FEVER_LEVELS[i].requirement) {
        newLevel = i;
        break;
      }
    }

    if (newLevel > this.currentLevel) {
      this.flashTimer = 1.0;
      if (newLevel > this.maxLevelReached) {
        this.maxLevelReached = newLevel;
      }
    }

    this.currentLevel = newLevel;
  }

  public getMultiplier(): number {
    return FEVER_LEVELS[this.currentLevel].multiplier;
  }

  public getLevel(): number {
    return this.currentLevel;
  }

  public getLevelInfo(): FeverLevel {
    return FEVER_LEVELS[this.currentLevel];
  }

  public getMaxLevelReached(): number {
    return this.maxLevelReached;
  }

  public getProgress(): number {
    const current = FEVER_LEVELS[this.currentLevel];
    const next = FEVER_LEVELS[this.currentLevel + 1];

    if (!next) return 1;

    const progressInLevel = this.totalPops - current.requirement;
    const levelRange = next.requirement - current.requirement;

    return Math.min(1, progressInLevel / levelRange);
  }

  public getNextLevelRequirement(): number {
    const next = FEVER_LEVELS[this.currentLevel + 1];
    return next ? next.requirement - this.totalPops : 0;
  }

  public isMaxLevel(): boolean {
    return this.currentLevel >= FEVER_LEVELS.length - 1;
  }

  public isFlashing(): boolean {
    return this.flashTimer > 0;
  }

  public reset(): void {
    this.totalPops = 0;
    this.currentLevel = 0;
    this.maxLevelReached = 0;
    this.decayTimer = 0;
    this.flashTimer = 0;
  }

  // ===== Rendering =====

  public render(ctx: CanvasRenderingContext2D, canvasWidth: number, canvasHeight: number): void {
    const level = FEVER_LEVELS[this.currentLevel];

    if (level.glowIntensity > 0) {
      // Screen tint
      const pulse = Math.sin(this.pulsePhase) * 0.1 + 0.9;
      const alpha = Math.floor(level.glowIntensity * pulse * 25);
      ctx.fillStyle = level.color + alpha.toString(16).padStart(2, '0');
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);

      // Edge glow
      const gradient = ctx.createRadialGradient(
        canvasWidth / 2, canvasHeight / 2, 0,
        canvasWidth / 2, canvasHeight / 2, canvasWidth * 0.8
      );
      gradient.addColorStop(0, 'transparent');
      gradient.addColorStop(0.7, 'transparent');
      gradient.addColorStop(1, level.color + '30');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    }

    // Level up flash
    if (this.flashTimer > 0) {
      ctx.fillStyle = `rgba(255, 255, 255, ${this.flashTimer * 0.4})`;
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    }
  }

  public renderHUD(ctx: CanvasRenderingContext2D, x: number, y: number, width: number = 120): number {
    const level = FEVER_LEVELS[this.currentLevel];
    let offsetY = 0;

    // Only show if active or close to first level
    if (this.currentLevel === 0 && this.totalPops < 5) return offsetY;

    ctx.save();

    // Background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(x, y, width, 35);

    // Progress bar background
    const barY = y + 5;
    const barHeight = 8;
    ctx.fillStyle = '#374151';
    ctx.fillRect(x + 5, barY, width - 10, barHeight);

    // Progress bar fill
    const gradient = ctx.createLinearGradient(x + 5, barY, x + width - 5, barY);
    gradient.addColorStop(0, level.color);
    gradient.addColorStop(1, FEVER_LEVELS[Math.min(this.currentLevel + 1, FEVER_LEVELS.length - 1)].color);
    ctx.fillStyle = gradient;
    ctx.fillRect(x + 5, barY, (width - 10) * this.getProgress(), barHeight);

    // Border
    ctx.strokeStyle = level.color;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 5, barY, width - 10, barHeight);

    offsetY += barHeight + 8;

    // Fever text
    if (this.isFlashing()) {
      const flash = Math.sin(this.flashTimer * 20) > 0;
      ctx.fillStyle = flash ? '#FFFFFF' : level.color;
    } else {
      ctx.fillStyle = level.color;
    }

    ctx.font = this.currentLevel >= 4 ? 'bold 14px Arial' : 'bold 12px Arial';
    ctx.textAlign = 'left';

    const text = level.name || 'FEVER';
    const multiplierText = `${level.multiplier.toFixed(1)}x`;

    ctx.fillText(text, x + 5, y + barY + offsetY);
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'right';
    ctx.fillText(multiplierText, x + width - 5, y + barY + offsetY);

    offsetY += 18;

    ctx.restore();

    return 40; // Total height used
  }
}
