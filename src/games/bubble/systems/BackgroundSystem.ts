// ===== src/games/bubble/systems/BackgroundSystem.ts =====

interface FloatingBubble {
  x: number;
  y: number;
  size: number;
  speed: number;
  wobblePhase: number;
  wobbleSpeed: number;
  opacity: number;
  hue: number;
}

interface Sparkle {
  x: number;
  y: number;
  size: number;
  life: number;
  maxLife: number;
}

export class BackgroundSystem {
  private canvasWidth: number;
  private canvasHeight: number;

  // Floating background bubbles
  private floatingBubbles: FloatingBubble[] = [];
  private readonly MAX_FLOATING = 15;

  // Sparkles
  private sparkles: Sparkle[] = [];

  // Animation
  private time: number = 0;
  private hueOffset: number = 0;

  // Theme colors
  private primaryHue: number = 220; // Blue theme

  constructor(canvasWidth: number, canvasHeight: number) {
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;
    this.initializeFloatingBubbles();
  }

  private initializeFloatingBubbles(): void {
    for (let i = 0; i < this.MAX_FLOATING; i++) {
      this.floatingBubbles.push(this.createFloatingBubble(true));
    }
  }

  private createFloatingBubble(randomY: boolean = false): FloatingBubble {
    return {
      x: Math.random() * this.canvasWidth,
      y: randomY ? Math.random() * this.canvasHeight : this.canvasHeight + 50,
      size: 20 + Math.random() * 40,
      speed: 15 + Math.random() * 25,
      wobblePhase: Math.random() * Math.PI * 2,
      wobbleSpeed: 1 + Math.random() * 2,
      opacity: 0.05 + Math.random() * 0.1,
      hue: Math.random() * 60 - 30, // Variation from primary hue
    };
  }

  public update(dt: number): void {
    this.time += dt;
    this.hueOffset = Math.sin(this.time * 0.1) * 20;

    // Update floating bubbles
    for (let i = 0; i < this.floatingBubbles.length; i++) {
      const bubble = this.floatingBubbles[i];
      bubble.y -= bubble.speed * dt;
      bubble.wobblePhase += bubble.wobbleSpeed * dt;
      bubble.x += Math.sin(bubble.wobblePhase) * 0.5;

      // Reset if off screen
      if (bubble.y < -bubble.size) {
        this.floatingBubbles[i] = this.createFloatingBubble();
      }
    }

    // Update sparkles
    for (let i = this.sparkles.length - 1; i >= 0; i--) {
      this.sparkles[i].life -= dt;
      if (this.sparkles[i].life <= 0) {
        this.sparkles.splice(i, 1);
      }
    }

    // Spawn new sparkles
    if (Math.random() < 0.1) {
      this.sparkles.push({
        x: Math.random() * this.canvasWidth,
        y: Math.random() * this.canvasHeight * 0.7,
        size: 2 + Math.random() * 3,
        life: 0.5 + Math.random() * 0.5,
        maxLife: 0.5 + Math.random() * 0.5,
      });
    }
  }

  public render(ctx: CanvasRenderingContext2D): void {
    // Main gradient background
    const gradient = ctx.createLinearGradient(0, 0, 0, this.canvasHeight);
    const hue = this.primaryHue + this.hueOffset;
    gradient.addColorStop(0, `hsl(${hue}, 70%, 15%)`);
    gradient.addColorStop(0.5, `hsl(${hue + 20}, 60%, 12%)`);
    gradient.addColorStop(1, `hsl(${hue + 40}, 50%, 8%)`);

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);

    // Subtle radial overlay
    const radialGradient = ctx.createRadialGradient(
      this.canvasWidth / 2, this.canvasHeight * 0.3, 0,
      this.canvasWidth / 2, this.canvasHeight * 0.3, this.canvasWidth * 0.8
    );
    radialGradient.addColorStop(0, 'rgba(100, 150, 255, 0.1)');
    radialGradient.addColorStop(1, 'transparent');
    ctx.fillStyle = radialGradient;
    ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);

    // Render floating bubbles
    for (const bubble of this.floatingBubbles) {
      this.renderFloatingBubble(ctx, bubble);
    }

    // Render sparkles
    for (const sparkle of this.sparkles) {
      const alpha = sparkle.life / sparkle.maxLife;
      ctx.globalAlpha = alpha * 0.8;
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(sparkle.x, sparkle.y, sparkle.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  private renderFloatingBubble(ctx: CanvasRenderingContext2D, bubble: FloatingBubble): void {
    ctx.save();
    ctx.globalAlpha = bubble.opacity;

    const hue = this.primaryHue + bubble.hue + this.hueOffset;

    // Bubble gradient
    const gradient = ctx.createRadialGradient(
      bubble.x - bubble.size * 0.3,
      bubble.y - bubble.size * 0.3,
      0,
      bubble.x,
      bubble.y,
      bubble.size
    );
    gradient.addColorStop(0, `hsla(${hue}, 80%, 70%, 0.3)`);
    gradient.addColorStop(0.5, `hsla(${hue}, 70%, 50%, 0.15)`);
    gradient.addColorStop(1, `hsla(${hue}, 60%, 40%, 0.05)`);

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(bubble.x, bubble.y, bubble.size, 0, Math.PI * 2);
    ctx.fill();

    // Highlight
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.beginPath();
    ctx.arc(
      bubble.x - bubble.size * 0.3,
      bubble.y - bubble.size * 0.3,
      bubble.size * 0.3,
      0,
      Math.PI * 2
    );
    ctx.fill();

    ctx.restore();
  }

  public renderGameArea(ctx: CanvasRenderingContext2D, gridOffsetY: number): void {
    // Game area boundary
    const borderGradient = ctx.createLinearGradient(0, 0, 0, this.canvasHeight);
    borderGradient.addColorStop(0, 'rgba(100, 150, 255, 0.3)');
    borderGradient.addColorStop(1, 'rgba(100, 150, 255, 0.1)');

    ctx.strokeStyle = borderGradient;
    ctx.lineWidth = 2;
    ctx.strokeRect(5, gridOffsetY - 5, this.canvasWidth - 10, this.canvasHeight - gridOffsetY - 80);

    // Ceiling indicator
    ctx.fillStyle = 'rgba(239, 68, 68, 0.3)';
    ctx.fillRect(0, gridOffsetY - 10, this.canvasWidth, 10);
  }

  public renderDangerZone(ctx: CanvasRenderingContext2D, y: number): void {
    // Pulsing danger line
    const pulse = Math.sin(this.time * 8) * 0.3 + 0.7;

    ctx.strokeStyle = `rgba(239, 68, 68, ${pulse})`;
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 5]);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(this.canvasWidth, y);
    ctx.stroke();
    ctx.setLineDash([]);

    // Warning gradient above line
    const warningGradient = ctx.createLinearGradient(0, y - 50, 0, y);
    warningGradient.addColorStop(0, 'transparent');
    warningGradient.addColorStop(1, `rgba(239, 68, 68, ${pulse * 0.2})`);
    ctx.fillStyle = warningGradient;
    ctx.fillRect(0, y - 50, this.canvasWidth, 50);
  }

  public renderShooterArea(ctx: CanvasRenderingContext2D): void {
    // Shooter platform area
    const platformY = this.canvasHeight - 100;

    const platformGradient = ctx.createLinearGradient(0, platformY, 0, this.canvasHeight);
    platformGradient.addColorStop(0, 'rgba(30, 30, 50, 0.8)');
    platformGradient.addColorStop(1, 'rgba(20, 20, 40, 0.95)');

    ctx.fillStyle = platformGradient;
    ctx.fillRect(0, platformY, this.canvasWidth, this.canvasHeight - platformY);

    // Top edge glow
    ctx.strokeStyle = 'rgba(100, 150, 255, 0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, platformY);
    ctx.lineTo(this.canvasWidth, platformY);
    ctx.stroke();
  }

  public setTheme(hue: number): void {
    this.primaryHue = hue;
  }

  public resize(width: number, height: number): void {
    this.canvasWidth = width;
    this.canvasHeight = height;
  }
}
