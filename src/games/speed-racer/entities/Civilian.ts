import { ROAD } from '../data/constants';

export class Civilian {
  x: number;
  y: number;
  vy = 0;
  alive = true;
  readonly width = 40;
  readonly height = 68;
  readonly forwardSpeed = 240; // World-frame forward speed (slower than ram)
  readonly color: string;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
    // Pick a calm pastel color so civilians read differently from enemies
    const palette = ['#4FC3F7', '#81C784', '#FFD54F', '#BA68C8'];
    this.color = palette[Math.floor(Math.random() * palette.length)];
  }

  update(dt: number, playerSpeed: number): void {
    this.vy = playerSpeed - this.forwardSpeed;
    this.y += this.vy * dt;
    if (this.y > 720) this.alive = false;

    const halfW = this.width / 2;
    if (this.x - halfW < ROAD.X_MIN) this.x = ROAD.X_MIN + halfW;
    else if (this.x + halfW > ROAD.X_MAX) this.x = ROAD.X_MAX - halfW;
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
    const w = this.width;
    const h = this.height;
    const x = this.x - w / 2;
    const y = this.y - h / 2;
    ctx.save();

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    this.roundRect(ctx, x + 3, y + 5, w, h, 7);
    ctx.fill();

    // Body — boxy sedan look
    ctx.fillStyle = this.color;
    this.roundRect(ctx, x, y, w, h, 7);
    ctx.fill();

    // Cockpit window
    ctx.fillStyle = '#0a0a14';
    this.roundRect(ctx, x + 5, y + 12, w - 10, h - 30, 3);
    ctx.fill();

    // Window highlight (white reflection)
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    this.roundRect(ctx, x + 7, y + 14, w - 14, 5, 2);
    ctx.fill();

    // Headlights
    ctx.fillStyle = '#FFFF99';
    ctx.fillRect(x + 4, y + 2, 6, 4);
    ctx.fillRect(x + w - 10, y + 2, 6, 4);

    // Tail lights
    ctx.fillStyle = '#FF3030';
    ctx.fillRect(x + 5, y + h - 4, 6, 2);
    ctx.fillRect(x + w - 11, y + h - 4, 6, 2);

    // Side mirrors (signature civilian detail)
    ctx.fillStyle = this.color;
    ctx.fillRect(x - 2, y + 18, 3, 5);
    ctx.fillRect(x + w - 1, y + 18, 3, 5);

    ctx.restore();
  }

  private roundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
  ): void {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
}
