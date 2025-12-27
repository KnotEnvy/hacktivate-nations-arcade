// ===== src/games/runner/entities/Obstacle.ts =====
import { Vector2, Rectangle } from '@/games/shared/utils/Vector2';

export type ObstacleType = 'cactus' | 'high-barrier' | 'spike' | 'gap';

export class Obstacle {
  position: Vector2;
  size: Vector2;
  velocity: Vector2;
  type: ObstacleType;
  animationTime: number = 0;

  constructor(x: number, y: number, type: ObstacleType = 'cactus', width?: number, height?: number) {
    this.type = type;

    // Set size based on type
    switch (type) {
      case 'high-barrier':
        this.size = new Vector2(width || 32, height || 64);
        break;
      case 'spike':
        this.size = new Vector2(width || 32, height || 24);
        break;
      case 'gap':
        this.size = new Vector2(width || 80, height || 10);
        break;
      case 'cactus':
      default:
        this.size = new Vector2(width || 24, height || 48);
        break;
    }

    this.position = new Vector2(x, y);
    this.velocity = new Vector2(-200, 0);
  }

  update(dt: number, gameSpeed: number): void {
    this.velocity.x = -200 * gameSpeed;
    this.position = this.position.add(this.velocity.multiply(dt));
    this.animationTime += dt;
  }

  render(ctx: CanvasRenderingContext2D): void {
    switch (this.type) {
      case 'cactus':
        this.renderCactus(ctx);
        break;
      case 'high-barrier':
        this.renderHighBarrier(ctx);
        break;
      case 'spike':
        this.renderSpike(ctx);
        break;
      case 'gap':
        this.renderGap(ctx);
        break;
    }
  }

  private renderCactus(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#DC2626';
    ctx.fillRect(this.position.x, this.position.y, this.size.x, this.size.y);

    ctx.fillStyle = '#B91C1C';
    for (let i = 0; i < 3; i++) {
      const spikeY = this.position.y + (i * this.size.y / 3);
      ctx.fillRect(this.position.x - 4, spikeY, 8, 4);
      ctx.fillRect(this.position.x + this.size.x - 4, spikeY, 8, 4);
    }
  }

  private renderHighBarrier(ctx: CanvasRenderingContext2D): void {
    // Tall barrier that requires sliding under
    const gradient = ctx.createLinearGradient(
      this.position.x,
      this.position.y,
      this.position.x,
      this.position.y + this.size.y
    );
    gradient.addColorStop(0, '#8B5CF6');
    gradient.addColorStop(1, '#6D28D9');

    ctx.fillStyle = gradient;
    ctx.fillRect(this.position.x, this.position.y, this.size.x, this.size.y);

    // Warning stripes
    ctx.fillStyle = '#FDE047';
    for (let i = 0; i < 4; i++) {
      const y = this.position.y + (i * 16);
      ctx.fillRect(this.position.x, y, this.size.x, 6);
    }
  }

  private renderSpike(ctx: CanvasRenderingContext2D): void {
    // Ground spikes
    ctx.fillStyle = '#EF4444';

    // Draw multiple triangular spikes
    const spikeCount = Math.floor(this.size.x / 12);
    for (let i = 0; i < spikeCount; i++) {
      const x = this.position.x + (i * 12);
      const y = this.position.y;

      ctx.beginPath();
      ctx.moveTo(x, y + this.size.y);
      ctx.lineTo(x + 6, y);
      ctx.lineTo(x + 12, y + this.size.y);
      ctx.closePath();
      ctx.fill();
    }

    // Add shine effect
    ctx.fillStyle = '#FCA5A5';
    for (let i = 0; i < spikeCount; i++) {
      const x = this.position.x + (i * 12);
      const y = this.position.y;
      ctx.fillRect(x + 2, y + 8, 2, 6);
    }
  }

  private renderGap(ctx: CanvasRenderingContext2D): void {
    // Render gap edges with warning colors
    ctx.fillStyle = '#F97316';
    ctx.fillRect(this.position.x, this.position.y - 2, 4, this.size.y + 4);
    ctx.fillRect(this.position.x + this.size.x - 4, this.position.y - 2, 4, this.size.y + 4);

    // Pulsing danger indicator
    const pulse = Math.sin(this.animationTime * 6) * 0.3 + 0.7;
    ctx.fillStyle = `rgba(239, 68, 68, ${pulse})`;
    ctx.fillRect(this.position.x + 4, this.position.y, this.size.x - 8, 4);
  }

  getBounds(): Rectangle {
    // Gap is a pit, so bounds should match its danger zone
    if (this.type === 'gap') {
      return new Rectangle(this.position.x + 4, this.position.y, this.size.x - 8, this.size.y);
    }
    return new Rectangle(this.position.x, this.position.y, this.size.x, this.size.y);
  }

  isOffScreen(): boolean {
    return this.position.x + this.size.x < 0;
  }
}

