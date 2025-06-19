// ===== src/games/runner/entities/Particle.ts =====
import { Vector2 } from '@/games/shared/utils/Vector2';

export class Particle {
  position: Vector2;
  velocity: Vector2;
  life: number;
  maxLife: number;
  color: string;
  size: number;
  rotation: number;
  rotationSpeed: number;
  sizeDecay: number;

  constructor(
    x: number,
    y: number,
    vx: number,
    vy: number,
    life: number,
    color: string = '#FFFFFF',
    size: number = Math.random() * 4 + 2
  ) {
    this.position = new Vector2(x, y);
    this.velocity = new Vector2(vx, vy);
    this.life = life;
    this.maxLife = life;
    this.color = color;
    this.size = size;
    this.rotation = Math.random() * Math.PI * 2;
    this.rotationSpeed = (Math.random() - 0.5) * 10;
    this.sizeDecay = size / life;
  }

  update(dt: number): boolean {
    this.position = this.position.add(this.velocity.multiply(dt * 60));
    this.velocity = this.velocity.multiply(0.98); // Slow down over time
    this.rotation += this.rotationSpeed * dt;
    this.size = Math.max(0, this.size - this.sizeDecay * dt);
    this.life -= dt;
    return this.life > 0 && this.size > 0;
  }

  render(ctx: CanvasRenderingContext2D): void {
    const alpha = this.life / this.maxLife;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = this.color;
    ctx.translate(this.position.x, this.position.y);
    ctx.rotate(this.rotation);
    ctx.fillRect(-this.size / 2, -this.size / 2, this.size, this.size);
    ctx.restore();
  }
}
