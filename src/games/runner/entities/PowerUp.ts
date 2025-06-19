// ===== src/games/runner/entities/PowerUp.ts =====
import { Vector2, Rectangle } from '@/games/shared/utils/Vector2';

export type PowerUpType = 'double-jump' | 'coin-magnet' | 'invincibility' | 'speed-boost';

export class PowerUp {
  position: Vector2;
  velocity: Vector2;
  size: Vector2;
  type: PowerUpType;
  
  private rotation: number = 0;
  private bobOffset: number = 0;
  private bobSpeed: number = 3;
  private glowIntensity: number = 0;

  constructor(x: number, y: number, type: PowerUpType) {
    this.position = new Vector2(x, y);
    this.velocity = new Vector2(-200, 0);
    this.size = new Vector2(24, 24);
    this.type = type;
  }

  update(dt: number, gameSpeed: number): void {
    this.velocity.x = -200 * gameSpeed;
    this.position = this.position.add(this.velocity.multiply(dt));
    
    // Spinning animation
    this.rotation += dt * 4;
    
    // Bobbing animation
    this.bobOffset = Math.sin(this.rotation * this.bobSpeed) * 4;
    
    // Pulsing glow
    this.glowIntensity = (Math.sin(this.rotation * 6) + 1) * 0.5;
  }

  render(ctx: CanvasRenderingContext2D): void {
    const renderY = this.position.y + this.bobOffset;
    
    ctx.save();
    ctx.translate(this.position.x + this.size.x/2, renderY + this.size.y/2);
    
    // Glow effect
    const glowSize = 30 + this.glowIntensity * 10;
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, glowSize);
    gradient.addColorStop(0, this.getGlowColor());
    gradient.addColorStop(1, 'transparent');
    ctx.fillStyle = gradient;
    ctx.fillRect(-glowSize/2, -glowSize/2, glowSize, glowSize);
    
    ctx.rotate(this.rotation);
    
    // Power-up icon
    this.renderIcon(ctx);
    
    ctx.restore();
  }

  private renderIcon(ctx: CanvasRenderingContext2D): void {
    const size = this.size.x;
    
    switch (this.type) {
      case 'double-jump':
        // Wings icon
        ctx.fillStyle = '#3B82F6';
        ctx.fillRect(-size/2, -size/2, size, size);
        ctx.fillStyle = '#DBEAFE';
        // Wing shapes
        ctx.beginPath();
        ctx.ellipse(-4, 0, 8, 6, 0, 0, Math.PI * 2);
        ctx.ellipse(4, 0, 8, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        break;
        
      case 'coin-magnet':
        // Magnet icon
        ctx.fillStyle = '#DC2626';
        ctx.fillRect(-size/2, -size/2, size, size);
        ctx.fillStyle = '#FFFFFF';
        // Magnet shape
        ctx.fillRect(-8, -6, 4, 12);
        ctx.fillRect(4, -6, 4, 12);
        ctx.fillRect(-8, -8, 16, 4);
        break;
        
      case 'invincibility':
        // Shield icon
        ctx.fillStyle = '#10B981';
        ctx.fillRect(-size/2, -size/2, size, size);
        ctx.fillStyle = '#FFFFFF';
        // Shield shape
        ctx.beginPath();
        ctx.moveTo(0, -8);
        ctx.lineTo(-6, -4);
        ctx.lineTo(-6, 4);
        ctx.lineTo(0, 8);
        ctx.lineTo(6, 4);
        ctx.lineTo(6, -4);
        ctx.closePath();
        ctx.fill();
        break;
        
      case 'speed-boost':
        // Lightning bolt icon
        ctx.fillStyle = '#F59E0B';
        ctx.fillRect(-size/2, -size/2, size, size);
        ctx.fillStyle = '#FFFFFF';
        // Lightning shape
        ctx.beginPath();
        ctx.moveTo(-2, -8);
        ctx.lineTo(4, -2);
        ctx.lineTo(0, 0);
        ctx.lineTo(6, 8);
        ctx.lineTo(0, 2);
        ctx.lineTo(2, 0);
        ctx.closePath();
        ctx.fill();
        break;
    }
  }

  private getGlowColor(): string {
    switch (this.type) {
      case 'double-jump': return 'rgba(59, 130, 246, 0.3)';
      case 'coin-magnet': return 'rgba(220, 38, 38, 0.3)';
      case 'invincibility': return 'rgba(16, 185, 129, 0.3)';
      case 'speed-boost': return 'rgba(245, 158, 11, 0.3)';
      default: return 'rgba(255, 255, 255, 0.3)';
    }
  }

  getBounds(): Rectangle {
    return new Rectangle(this.position.x, this.position.y, this.size.x, this.size.y);
  }

  isOffScreen(): boolean {
    return this.position.x + this.size.x < 0;
  }
}
