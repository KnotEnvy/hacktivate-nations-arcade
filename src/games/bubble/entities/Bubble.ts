// ===== src/games/bubble/entities/Bubble.ts =====

export type BubbleColor = 'red' | 'blue' | 'green' | 'yellow' | 'purple' | 'orange';
export type PowerUpType = 'bomb' | 'rainbow' | 'lightning' | 'freeze' | 'star';

export interface BubbleConfig {
  gridX: number;
  gridY: number;
  color: BubbleColor | null;
  powerUp?: PowerUpType;
}

// Bubble colors with beautiful gradients
export const BUBBLE_COLORS: Record<BubbleColor, { primary: string; secondary: string; highlight: string; glow: string }> = {
  red: { primary: '#EF4444', secondary: '#DC2626', highlight: '#FCA5A5', glow: '#EF444480' },
  blue: { primary: '#3B82F6', secondary: '#2563EB', highlight: '#93C5FD', glow: '#3B82F680' },
  green: { primary: '#22C55E', secondary: '#16A34A', highlight: '#86EFAC', glow: '#22C55E80' },
  yellow: { primary: '#FBBF24', secondary: '#F59E0B', highlight: '#FDE68A', glow: '#FBBF2480' },
  purple: { primary: '#A855F7', secondary: '#9333EA', highlight: '#D8B4FE', glow: '#A855F780' },
  orange: { primary: '#F97316', secondary: '#EA580C', highlight: '#FDBA74', glow: '#F9731680' },
};

export const POWERUP_COLORS: Record<PowerUpType, { primary: string; icon: string }> = {
  bomb: { primary: '#1F2937', icon: '💣' },
  rainbow: { primary: '#EC4899', icon: '🌈' },
  lightning: { primary: '#FBBF24', icon: '⚡' },
  freeze: { primary: '#06B6D4', icon: '❄️' },
  star: { primary: '#FBBF24', icon: '⭐' },
};

export class Bubble {
  // Grid position
  public gridX: number;
  public gridY: number;

  // Screen position (calculated from grid)
  public x: number = 0;
  public y: number = 0;

  // Visual properties
  public color: BubbleColor | null;
  public powerUp: PowerUpType | null;
  public radius: number = 18;

  // State
  public isPopping: boolean = false;
  public isFalling: boolean = false;
  public isAnimating: boolean = false;
  public popProgress: number = 0;
  public fallVelocity: number = 0;

  // Animation
  private bobPhase: number = Math.random() * Math.PI * 2;
  private pulsePhase: number = Math.random() * Math.PI * 2;
  private shineRotation: number = 0;

  // Falling physics
  public fallX: number = 0;
  public fallY: number = 0;
  public fallVx: number = 0;
  public fallVy: number = 0;
  public fallRotation: number = 0;

  constructor(config: BubbleConfig) {
    this.gridX = config.gridX;
    this.gridY = config.gridY;
    this.color = config.color;
    this.powerUp = config.powerUp ?? null;
  }

  public update(dt: number): void {
    // Animation phases
    this.bobPhase += dt * 2;
    this.pulsePhase += dt * 4;
    this.shineRotation += dt * 0.5;

    // Pop animation
    if (this.isPopping) {
      this.popProgress += dt * 4;
      if (this.popProgress >= 1) {
        this.popProgress = 1;
      }
    }

    // Fall animation
    if (this.isFalling) {
      this.fallVy += 800 * dt; // gravity
      this.fallX += this.fallVx * dt;
      this.fallY += this.fallVy * dt;
      this.fallRotation += dt * 5;
    }
  }

  public startPop(): void {
    this.isPopping = true;
    this.popProgress = 0;
    this.isAnimating = true;
  }

  public startFall(): void {
    this.isFalling = true;
    this.fallX = this.x;
    this.fallY = this.y;
    this.fallVx = (Math.random() - 0.5) * 100;
    this.fallVy = -100 - Math.random() * 100;
    this.isAnimating = true;
  }

  public isOffScreen(canvasHeight: number): boolean {
    return this.isFalling && this.fallY > canvasHeight + 50;
  }

  public isPopComplete(): boolean {
    return this.isPopping && this.popProgress >= 1;
  }

  public render(ctx: CanvasRenderingContext2D): void {
    if (this.color === null && !this.powerUp) return;

    let drawX = this.x;
    let drawY = this.y;
    let scale = 1;
    let rotation = 0;

    // Apply fall animation
    if (this.isFalling) {
      drawX = this.fallX;
      drawY = this.fallY;
      rotation = this.fallRotation;
    }

    // Apply pop animation
    if (this.isPopping) {
      scale = 1 + this.popProgress * 0.5;
      ctx.globalAlpha = 1 - this.popProgress;
    }

    // Subtle bob animation for stationary bubbles
    if (!this.isFalling && !this.isPopping) {
      drawY += Math.sin(this.bobPhase) * 1;
    }

    ctx.save();
    ctx.translate(drawX, drawY);
    ctx.rotate(rotation);
    ctx.scale(scale, scale);

    if (this.powerUp) {
      this.renderPowerUp(ctx);
    } else if (this.color) {
      this.renderBubble(ctx);
    }

    ctx.restore();
    ctx.globalAlpha = 1;
  }

  private renderBubble(ctx: CanvasRenderingContext2D): void {
    if (!this.color) return;

    const colors = BUBBLE_COLORS[this.color];
    const r = this.radius;

    // Outer glow
    ctx.shadowColor = colors.glow;
    ctx.shadowBlur = 8;

    // Main bubble gradient
    const gradient = ctx.createRadialGradient(
      -r * 0.3, -r * 0.3, 0,
      0, 0, r
    );
    gradient.addColorStop(0, colors.highlight);
    gradient.addColorStop(0.4, colors.primary);
    gradient.addColorStop(1, colors.secondary);

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();

    // Inner highlight (glass effect)
    ctx.shadowBlur = 0;
    const highlightGradient = ctx.createRadialGradient(
      -r * 0.4, -r * 0.4, 0,
      -r * 0.3, -r * 0.3, r * 0.5
    );
    highlightGradient.addColorStop(0, 'rgba(255, 255, 255, 0.7)');
    highlightGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

    ctx.fillStyle = highlightGradient;
    ctx.beginPath();
    ctx.arc(-r * 0.3, -r * 0.3, r * 0.5, 0, Math.PI * 2);
    ctx.fill();

    // Small shine dot
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.beginPath();
    ctx.arc(-r * 0.4, -r * 0.4, r * 0.15, 0, Math.PI * 2);
    ctx.fill();

    // Bottom reflection
    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.beginPath();
    ctx.ellipse(0, r * 0.5, r * 0.5, r * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Pulse effect for matching indication
    const pulse = Math.sin(this.pulsePhase) * 0.1 + 0.9;
    ctx.strokeStyle = colors.highlight;
    ctx.lineWidth = 2 * pulse;
    ctx.globalAlpha = 0.3 * pulse;
    ctx.beginPath();
    ctx.arc(0, 0, r + 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  private renderPowerUp(ctx: CanvasRenderingContext2D): void {
    if (!this.powerUp) return;

    const config = POWERUP_COLORS[this.powerUp];
    const r = this.radius;

    // Special effects based on power-up type
    if (this.powerUp === 'rainbow') {
      this.renderRainbowBubble(ctx);
    } else if (this.powerUp === 'bomb') {
      this.renderBombBubble(ctx);
    } else if (this.powerUp === 'lightning') {
      this.renderLightningBubble(ctx);
    } else if (this.powerUp === 'freeze') {
      this.renderFreezeBubble(ctx);
    } else if (this.powerUp === 'star') {
      this.renderStarBubble(ctx);
    }

    // Icon overlay
    ctx.font = `${r}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(config.icon, 0, 2);
  }

  private renderRainbowBubble(ctx: CanvasRenderingContext2D): void {
    const r = this.radius;
    const hue = (Date.now() / 20) % 360;

    // Rainbow gradient that shifts over time
    const gradient = ctx.createRadialGradient(
      -r * 0.3, -r * 0.3, 0,
      0, 0, r
    );
    gradient.addColorStop(0, `hsl(${hue}, 100%, 80%)`);
    gradient.addColorStop(0.5, `hsl(${(hue + 60) % 360}, 100%, 60%)`);
    gradient.addColorStop(1, `hsl(${(hue + 120) % 360}, 100%, 50%)`);

    ctx.shadowColor = `hsl(${hue}, 100%, 50%)`;
    ctx.shadowBlur = 12;

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  private renderBombBubble(ctx: CanvasRenderingContext2D): void {
    const r = this.radius;

    // Dark metallic look
    const gradient = ctx.createRadialGradient(
      -r * 0.3, -r * 0.3, 0,
      0, 0, r
    );
    gradient.addColorStop(0, '#4B5563');
    gradient.addColorStop(0.6, '#1F2937');
    gradient.addColorStop(1, '#111827');

    ctx.shadowColor = '#EF4444';
    ctx.shadowBlur = 8;

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Warning ring
    const pulse = Math.sin(this.pulsePhase * 2) * 0.5 + 0.5;
    ctx.strokeStyle = `rgba(239, 68, 68, ${pulse})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, r + 3, 0, Math.PI * 2);
    ctx.stroke();
  }

  private renderLightningBubble(ctx: CanvasRenderingContext2D): void {
    const r = this.radius;

    // Electric yellow
    const gradient = ctx.createRadialGradient(
      -r * 0.3, -r * 0.3, 0,
      0, 0, r
    );
    gradient.addColorStop(0, '#FEF3C7');
    gradient.addColorStop(0.5, '#FBBF24');
    gradient.addColorStop(1, '#D97706');

    ctx.shadowColor = '#FBBF24';
    ctx.shadowBlur = 15;

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Electric sparks
    const sparkCount = 4;
    ctx.strokeStyle = '#FBBF24';
    ctx.lineWidth = 1;
    for (let i = 0; i < sparkCount; i++) {
      const angle = (this.pulsePhase + (Math.PI * 2 * i) / sparkCount) % (Math.PI * 2);
      const len = r + 5 + Math.sin(this.pulsePhase * 3 + i) * 3;
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * r, Math.sin(angle) * r);
      ctx.lineTo(Math.cos(angle) * len, Math.sin(angle) * len);
      ctx.stroke();
    }
  }

  private renderFreezeBubble(ctx: CanvasRenderingContext2D): void {
    const r = this.radius;

    // Icy gradient
    const gradient = ctx.createRadialGradient(
      -r * 0.3, -r * 0.3, 0,
      0, 0, r
    );
    gradient.addColorStop(0, '#E0F2FE');
    gradient.addColorStop(0.5, '#06B6D4');
    gradient.addColorStop(1, '#0891B2');

    ctx.shadowColor = '#06B6D4';
    ctx.shadowBlur = 10;

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Ice crystal pattern
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI * 2 * i) / 6 + this.shineRotation;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(angle) * r * 0.7, Math.sin(angle) * r * 0.7);
      ctx.stroke();
    }
  }

  private renderStarBubble(ctx: CanvasRenderingContext2D): void {
    const r = this.radius;

    // Golden gradient
    const gradient = ctx.createRadialGradient(
      -r * 0.3, -r * 0.3, 0,
      0, 0, r
    );
    gradient.addColorStop(0, '#FEF3C7');
    gradient.addColorStop(0.5, '#FBBF24');
    gradient.addColorStop(1, '#B45309');

    ctx.shadowColor = '#FBBF24';
    ctx.shadowBlur = 12;

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Rotating sparkles
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    for (let i = 0; i < 4; i++) {
      const angle = this.shineRotation * 2 + (Math.PI / 2) * i;
      const dist = r * 0.5;
      ctx.beginPath();
      ctx.arc(
        Math.cos(angle) * dist,
        Math.sin(angle) * dist,
        2,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }
  }

  public getScreenPosition(
    gridOffsetX: number,
    gridOffsetY: number,
    bubbleSize: number
  ): { x: number; y: number } {
    // Hexagonal grid layout - odd rows are offset
    const rowOffset = this.gridY % 2 === 1 ? bubbleSize / 2 : 0;
    const x = gridOffsetX + this.gridX * bubbleSize + rowOffset + bubbleSize / 2;
    const y = gridOffsetY + this.gridY * (bubbleSize * 0.866) + bubbleSize / 2;
    return { x, y };
  }

  public updateScreenPosition(
    gridOffsetX: number,
    gridOffsetY: number,
    bubbleSize: number
  ): void {
    const pos = this.getScreenPosition(gridOffsetX, gridOffsetY, bubbleSize);
    this.x = pos.x;
    this.y = pos.y;
  }
}
