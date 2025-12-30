// ===== src/games/runner/entities/Coin.ts =====
import { Vector2, Rectangle } from '@/games/shared/utils/Vector2';

interface Sparkle {
  x: number;
  y: number;
  life: number;
  angle: number;
}

export class Coin {
  position: Vector2;
  velocity: Vector2;
  size: number = 16;

  private rotation: number = 0;
  private bobOffset: number = 0;
  private bobSpeed: number = 4;

  // Enhanced glow properties
  private glowIntensity: number = 0;
  private breathScale: number = 1;
  private sparkleTimer: number = 0;
  private sparkles: Sparkle[] = [];

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

    // Pulsing glow (slower, more noticeable)
    this.glowIntensity = (Math.sin(this.rotation * 3) + 1) * 0.5;

    // Breathing scale (0.9 to 1.1)
    this.breathScale = 0.9 + (Math.sin(this.rotation * 2) + 1) * 0.1;

    // Sparkle generation
    this.sparkleTimer += dt;
    if (this.sparkleTimer > 0.3 && Math.random() < 0.3) {
      this.sparkleTimer = 0;
      if (this.sparkles.length < 3) { // Max 3 sparkles per coin
        const angle = Math.random() * Math.PI * 2;
        const distance = this.size * 0.8;
        this.sparkles.push({
          x: Math.cos(angle) * distance,
          y: Math.sin(angle) * distance,
          life: 0.4,
          angle: Math.random() * Math.PI * 2
        });
      }
    }

    // Update sparkles
    this.sparkles = this.sparkles.filter(s => {
      s.life -= dt;
      return s.life > 0;
    });
  }

  render(ctx: CanvasRenderingContext2D): void {
    const renderY = this.position.y + this.bobOffset;
    const centerX = this.position.x + this.size / 2;
    const centerY = renderY + this.size / 2;

    ctx.save();

    // Render pulsing glow halo (behind coin)
    const glowRadius = this.size + 8 + this.glowIntensity * 6;
    const glowGradient = ctx.createRadialGradient(
      centerX, centerY, 0,
      centerX, centerY, glowRadius
    );
    glowGradient.addColorStop(0, `rgba(252, 211, 77, ${0.4 + this.glowIntensity * 0.2})`);
    glowGradient.addColorStop(0.5, `rgba(252, 211, 77, ${0.2 + this.glowIntensity * 0.1})`);
    glowGradient.addColorStop(1, 'rgba(252, 211, 77, 0)');
    ctx.fillStyle = glowGradient;
    ctx.beginPath();
    ctx.arc(centerX, centerY, glowRadius, 0, Math.PI * 2);
    ctx.fill();

    // Render sparkles (4-point stars)
    this.sparkles.forEach(sparkle => {
      const alpha = sparkle.life / 0.4;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#FFFFFF';
      ctx.translate(centerX + sparkle.x, centerY + sparkle.y);
      ctx.rotate(sparkle.angle);
      // 4-point star shape
      ctx.fillRect(-1, -4, 2, 8);
      ctx.fillRect(-4, -1, 8, 2);
      ctx.restore();
    });

    // Apply breathing scale
    ctx.translate(centerX, centerY);
    ctx.scale(this.breathScale, this.breathScale);
    ctx.rotate(this.rotation);

    // Coin body
    ctx.fillStyle = '#FCD34D'; // Gold
    ctx.fillRect(-this.size/2, -this.size/2, this.size, this.size);

    // Enhanced highlight (brighter)
    ctx.fillStyle = '#FEF9C3';
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
