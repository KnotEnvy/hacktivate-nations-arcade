// ===== src/games/runner/entities/Obstacle.ts =====
import { Vector2, Rectangle } from '@/games/shared/utils/Vector2';

export class Obstacle {
  position: Vector2;
  size: Vector2;
  velocity: Vector2;
  
  constructor(x: number, y: number, width: number = 24, height: number = 48) {
    this.position = new Vector2(x, y);
    this.size = new Vector2(width, height);
    this.velocity = new Vector2(-200, 0); // Move left
  }

  update(dt: number, gameSpeed: number): void {
    this.velocity.x = -200 * gameSpeed;
    this.position = this.position.add(this.velocity.multiply(dt));
  }

  render(ctx: CanvasRenderingContext2D): void {
    // Cactus-like obstacle
    ctx.fillStyle = '#DC2626'; // Red
    ctx.fillRect(this.position.x, this.position.y, this.size.x, this.size.y);
    
    // Add some spikes
    ctx.fillStyle = '#B91C1C';
    for (let i = 0; i < 3; i++) {
      const spikeY = this.position.y + (i * this.size.y / 3);
      ctx.fillRect(this.position.x - 4, spikeY, 8, 4);
      ctx.fillRect(this.position.x + this.size.x - 4, spikeY, 8, 4);
    }
  }

  getBounds(): Rectangle {
    return new Rectangle(this.position.x, this.position.y, this.size.x, this.size.y);
  }

  isOffScreen(): boolean {
    return this.position.x + this.size.x < 0;
  }
}

