import { ROAD } from '../data/constants';

const MISSILE_SPEED = 800;

export class Missile {
  x: number;
  y: number;
  alive = true;
  readonly width = 12;
  readonly height = 28;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  update(dt: number): void {
    this.y -= MISSILE_SPEED * dt;
    if (this.y < -40) this.alive = false;
    if (this.x < ROAD.X_MIN - 40 || this.x > ROAD.X_MAX + 40) this.alive = false;
  }

  getBounds(): { x: number; y: number; w: number; h: number } {
    return {
      x: this.x - this.width / 2,
      y: this.y - this.height / 2,
      w: this.width,
      h: this.height,
    };
  }

  render(ctx: CanvasRenderingContext2D): void {
    ctx.save();

    // Exhaust trail
    ctx.fillStyle = 'rgba(255,140,0,0.8)';
    ctx.beginPath();
    ctx.ellipse(this.x, this.y + this.height / 2 + 8, 4, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,0,0.6)';
    ctx.beginPath();
    ctx.ellipse(this.x, this.y + this.height / 2 + 4, 3, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Missile body
    ctx.fillStyle = '#E0E0E0';
    ctx.fillRect(this.x - this.width / 2, this.y - this.height / 2, this.width, this.height);

    // Nose cone
    ctx.fillStyle = '#FF1493';
    ctx.beginPath();
    ctx.moveTo(this.x - this.width / 2, this.y - this.height / 2);
    ctx.lineTo(this.x + this.width / 2, this.y - this.height / 2);
    ctx.lineTo(this.x, this.y - this.height / 2 - 8);
    ctx.closePath();
    ctx.fill();

    // Fins
    ctx.fillStyle = '#FF1493';
    ctx.fillRect(this.x - this.width / 2 - 3, this.y + 6, 3, 6);
    ctx.fillRect(this.x + this.width / 2, this.y + 6, 3, 6);

    ctx.restore();
  }
}
