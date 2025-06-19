// ===== src/games/runner/entities/FlyingEnemy.ts =====
import { Vector2, Rectangle } from '@/games/shared/utils/Vector2';

export class FlyingEnemy {
  position: Vector2;
  velocity: Vector2;
  size: Vector2;
  
  private bobOffset: number = 0;
  private bobSpeed: number = 5;
  private wingFlap: number = 0;

  constructor(x: number, y: number) {
    this.position = new Vector2(x, y);
    this.velocity = new Vector2(-150, 0);
    this.size = new Vector2(32, 24);
  }

  update(dt: number, gameSpeed: number): void {
    this.velocity.x = -150 * gameSpeed;
    this.position = this.position.add(this.velocity.multiply(dt));
    
    // Bobbing flight pattern
    this.bobSpeed += dt * 3;
    this.bobOffset = Math.sin(this.bobSpeed) * 20;
    
    // Wing flapping
    this.wingFlap += dt * 15;
  }

  render(ctx: CanvasRenderingContext2D): void {
    const renderY = this.position.y + this.bobOffset;
    
    ctx.save();
    ctx.translate(this.position.x + this.size.x/2, renderY + this.size.y/2);
    
    // Enemy body
    ctx.fillStyle = '#7C2D12';
    ctx.fillRect(-this.size.x/2, -this.size.y/2, this.size.x, this.size.y);
    
    // Wings (animated)
    const wingOffset = Math.sin(this.wingFlap) * 3;
    ctx.fillStyle = '#A3A3A3';
    ctx.fillRect(-16, -8 + wingOffset, 8, 4);
    ctx.fillRect(8, -8 - wingOffset, 8, 4);
    
    // Eye
    ctx.fillStyle = '#EF4444';
    ctx.fillRect(4, -2, 4, 4);
    
    ctx.restore();
  }

  getBounds(): Rectangle {
    return new Rectangle(
      this.position.x, 
      this.position.y + this.bobOffset, 
      this.size.x, 
      this.size.y
    );
  }

  isOffScreen(): boolean {
    return this.position.x + this.size.x < 0;
  }
}
