// ===== src/games/runner/entities/Coin.ts =====
import { Vector2, Rectangle } from '@/games/shared/utils/Vector2';

export class Coin {
  position: Vector2;
  velocity: Vector2;
  size: number = 16;
  
  private rotation: number = 0;
  private bobOffset: number = 0;
  private bobSpeed: number = 4;

  constructor(x: number, y: number) {
    this.position = new Vector2(x, y);
    this.velocity = new Vector2(-200, 0);
  }

  update(dt: number, gameSpeed: number): void {
    this.velocity.x = -200 * gameSpeed;
    this.position = this.position.add(this.velocity.multiply(dt));
    
    // Spinning animation
    this.rotation += dt * 8;
    
    // Bobbing animation
    this.bobOffset = Math.sin(this.rotation * this.bobSpeed) * 3;
  }

  render(ctx: CanvasRenderingContext2D): void {
    const renderY = this.position.y + this.bobOffset;
    
    ctx.save();
    ctx.translate(this.position.x + this.size/2, renderY + this.size/2);
    ctx.rotate(this.rotation);
    
    // Coin body
    ctx.fillStyle = '#FCD34D'; // Gold
    ctx.fillRect(-this.size/2, -this.size/2, this.size, this.size);
    
    // Coin highlight
    ctx.fillStyle = '#FEF3C7';
    ctx.fillRect(-this.size/2 + 2, -this.size/2 + 2, this.size - 4, 4);
    
    // Dollar sign
    ctx.fillStyle = '#92400E';
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('$', 0, 0);
    
    ctx.restore();
  }

  getBounds(): Rectangle {
    return new Rectangle(this.position.x, this.position.y, this.size, this.size);
  }

  isOffScreen(): boolean {
    return this.position.x + this.size < 0;
  }
}
