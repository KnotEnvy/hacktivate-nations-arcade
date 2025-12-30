// ===== src/games/runner/entities/GroundPound.ts =====
import { Vector2, Rectangle } from '@/games/shared/utils/Vector2';

export class GroundPound {
  position: Vector2;
  private startX: number;
  private groundY: number;
  private speed: number = 400;
  private width: number = 60;
  private height: number = 40;
  private animationTime: number = 0;
  private active: boolean = true;

  // Wave properties
  private waveAmplitude: number = 15;
  private waveFrequency: number = 0.1;

  constructor(x: number, groundY: number) {
    this.startX = x;
    this.groundY = groundY;
    this.position = new Vector2(x, groundY - this.height);
  }

  update(dt: number): void {
    this.animationTime += dt;

    // Move left
    this.position.x -= this.speed * dt;

    // Wave animation
    const waveOffset = Math.sin(this.animationTime * 20) * 3;
    this.position.y = this.groundY - this.height + waveOffset;
  }

  render(ctx: CanvasRenderingContext2D): void {
    ctx.save();

    const x = this.position.x;
    const y = this.position.y;

    // Shockwave effect - multiple arcs
    const progress = 1 - Math.min(1, this.animationTime * 2);

    // Ground crack/dust
    ctx.fillStyle = '#78716C';
    for (let i = 0; i < 5; i++) {
      const dustX = x + i * 12;
      const dustY = this.groundY - 5 - Math.random() * 10;
      const dustSize = 4 + Math.random() * 4;
      ctx.beginPath();
      ctx.arc(dustX, dustY, dustSize, 0, Math.PI * 2);
      ctx.fill();
    }

    // Main shockwave arc
    const gradient = ctx.createLinearGradient(x, y, x, this.groundY);
    gradient.addColorStop(0, 'rgba(239, 68, 68, 0.9)');
    gradient.addColorStop(0.5, 'rgba(249, 115, 22, 0.7)');
    gradient.addColorStop(1, 'rgba(234, 179, 8, 0.3)');

    ctx.fillStyle = gradient;
    ctx.beginPath();

    // Draw wave shape
    ctx.moveTo(x, this.groundY);

    const segments = 10;
    for (let i = 0; i <= segments; i++) {
      const segX = x + (this.width * i / segments);
      const waveY = this.groundY - this.height * Math.sin((i / segments) * Math.PI);
      const wobble = Math.sin(this.animationTime * 15 + i) * 3;

      if (i === 0) {
        ctx.moveTo(segX, this.groundY);
      }
      ctx.lineTo(segX, waveY + wobble);
    }

    ctx.lineTo(x + this.width, this.groundY);
    ctx.closePath();
    ctx.fill();

    // Inner glow
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.beginPath();
    ctx.moveTo(x + 10, this.groundY);
    for (let i = 0; i <= segments; i++) {
      const segX = x + 10 + ((this.width - 20) * i / segments);
      const waveY = this.groundY - (this.height - 10) * Math.sin((i / segments) * Math.PI);
      ctx.lineTo(segX, waveY + 5);
    }
    ctx.lineTo(x + this.width - 10, this.groundY);
    ctx.closePath();
    ctx.fill();

    // Leading edge sparks
    ctx.fillStyle = '#FDE047';
    for (let i = 0; i < 3; i++) {
      const sparkX = x + Math.random() * 10;
      const sparkY = this.groundY - Math.random() * this.height * 0.8;
      ctx.beginPath();
      ctx.arc(sparkX, sparkY, 2 + Math.random() * 2, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  getBounds(): Rectangle {
    return new Rectangle(
      this.position.x,
      this.groundY - this.height,
      this.width,
      this.height
    );
  }

  isOffScreen(): boolean {
    return this.position.x + this.width < 0;
  }

  isActive(): boolean {
    return this.active;
  }
}
