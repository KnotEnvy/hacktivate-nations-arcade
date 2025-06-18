// ===== src/games/runner/entities/Particle.ts =====
import { Vector2 } from '@/games/shared/utils/Vector2';

export class Particle {
  position: Vector2;
  velocity: Vector2;
  life: number;
  maxLife: number;
  color: string;
  size: number;

  constructor(x: number, y: number, vx: number, vy: number, life: number, color: string = '#FFFFFF') {
    this.position = new Vector2(x, y);
    this.velocity = new Vector2(vx, vy);
    this.life = life;
    this.maxLife = life;
    this.color = color;
    this.size = Math.random() * 4 + 2;
  }

  update(dt: number): boolean {
    this.position = this.position.add(this.velocity.multiply(dt * 60));
    this.velocity = this.velocity.multiply(0.98); // Slow down over time
    this.life -= dt;
    return this.life > 0;
  }

  render(ctx: CanvasRenderingContext2D): void {
    const alpha = this.life / this.maxLife;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = this.color;
    ctx.fillRect(this.position.x, this.position.y, this.size, this.size);
    ctx.globalAlpha = 1;
  }
}
