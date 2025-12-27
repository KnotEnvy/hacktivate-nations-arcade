// ===== src/games/runner/entities/BossProjectile.ts =====
import { Vector2, Rectangle } from '@/games/shared/utils/Vector2';

export class BossProjectile {
  position: Vector2;
  size: Vector2;
  velocity: Vector2;
  private animationTime: number = 0;

  constructor(x: number, y: number, targetY: number) {
    this.position = new Vector2(x, y);
    this.size = new Vector2(16, 16);

    // Calculate velocity towards player's ground level
    const dx = -300;
    const dy = (targetY - y) * 2;
    this.velocity = new Vector2(dx, dy);
  }

  update(dt: number, gameSpeed: number): void {
    // Move towards left side
    this.position = this.position.add(this.velocity.multiply(dt));
    this.animationTime += dt;

    // Apply gravity
    this.velocity.y += 0.5;
  }

  render(ctx: CanvasRenderingContext2D): void {
    ctx.save();

    // Rotating fireball effect
    ctx.translate(
      this.position.x + this.size.x / 2,
      this.position.y + this.size.y / 2
    );
    ctx.rotate(this.animationTime * 10);

    // Outer glow
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, this.size.x);
    gradient.addColorStop(0, '#FBBF24');
    gradient.addColorStop(0.5, '#F97316');
    gradient.addColorStop(1, '#DC2626');

    ctx.fillStyle = gradient;
    ctx.fillRect(-this.size.x / 2, -this.size.y / 2, this.size.x, this.size.y);

    // Inner core
    ctx.fillStyle = '#FDE047';
    ctx.fillRect(-this.size.x / 4, -this.size.y / 4, this.size.x / 2, this.size.y / 2);

    // Trail particles
    const trailLength = 3;
    for (let i = 1; i <= trailLength; i++) {
      const alpha = 1 - (i / trailLength);
      const size = this.size.x * (1 - i / trailLength * 0.5);
      ctx.globalAlpha = alpha * 0.6;
      ctx.fillStyle = '#F97316';
      ctx.fillRect(
        -size / 2 + i * 10,
        -size / 2,
        size,
        size
      );
    }

    ctx.restore();
  }

  getBounds(): Rectangle {
    return new Rectangle(this.position.x, this.position.y, this.size.x, this.size.y);
  }

  isOffScreen(): boolean {
    return this.position.x + this.size.x < 0 || this.position.y > 800;
  }
}
