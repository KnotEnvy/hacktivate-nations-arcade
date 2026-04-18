import { ROAD } from '../data/constants';
import { SecondaryWeaponType } from '../data/secondaryWeapons';

export class WeaponVan {
  x: number;
  y: number;
  vy = 0;
  alive = true;
  docked = false;
  readonly width = 80;
  readonly height = 130;
  readonly forwardSpeed = 320; // World-frame, near player base speed
  readonly payload: SecondaryWeaponType;

  constructor(x: number, y: number, payload: SecondaryWeaponType) {
    this.x = x;
    this.y = y;
    this.payload = payload;
  }

  update(dt: number, playerSpeed: number): void {
    this.vy = playerSpeed - this.forwardSpeed;
    this.y += this.vy * dt;
    if (this.y > 720) this.alive = false;

    const halfW = this.width / 2;
    if (this.x - halfW < ROAD.X_MIN) this.x = ROAD.X_MIN + halfW;
    else if (this.x + halfW > ROAD.X_MAX) this.x = ROAD.X_MAX - halfW;
  }

  // The dock zone is the rear (bottom) of the van — slightly inset
  getDockBounds(): { x: number; y: number; w: number; h: number } {
    return {
      x: this.x - this.width / 2 + 12,
      y: this.y + this.height / 2 - 22,
      w: this.width - 24,
      h: 26,
    };
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
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    this.roundRect(ctx, x + 5, y + 6, w, h, 6);
    ctx.fill();

    // Body — chrome silver with synthwave teal trim
    const grad = ctx.createLinearGradient(x, y, x, y + h);
    grad.addColorStop(0, '#E0E0E0');
    grad.addColorStop(0.5, '#9E9E9E');
    grad.addColorStop(1, '#616161');
    ctx.fillStyle = grad;
    this.roundRect(ctx, x, y, w, h, 6);
    ctx.fill();

    // Cab window (top)
    ctx.fillStyle = '#0a0a14';
    this.roundRect(ctx, x + 8, y + 8, w - 16, 22, 3);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,255,255,0.3)';
    this.roundRect(ctx, x + 10, y + 10, w - 20, 6, 2);
    ctx.fill();

    // Cargo body box
    ctx.fillStyle = '#3a3a4e';
    ctx.fillRect(x + 6, y + 36, w - 12, h - 60);

    // Magenta racing stripes
    ctx.fillStyle = '#FF1493';
    ctx.fillRect(x + 8, y + 36, w - 16, 4);
    ctx.fillRect(x + 8, y + h - 28, w - 16, 4);

    // Cyan "WEAPONS" hazard marker (just colored squares)
    ctx.fillStyle = '#00FFFF';
    ctx.fillRect(x + w / 2 - 15, y + 60, 30, 4);
    ctx.fillRect(x + w / 2 - 15, y + 70, 30, 4);
    ctx.fillRect(x + w / 2 - 15, y + 80, 30, 4);

    // Rear ramp/door (open inviting area)
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(x + 12, y + h - 22, w - 24, 18);
    ctx.fillStyle = '#FFFF00';
    ctx.fillRect(x + 12, y + h - 22, w - 24, 2);
    ctx.fillRect(x + 12, y + h - 6, w - 24, 2);

    // Headlights (top/front)
    ctx.fillStyle = '#FFFF99';
    ctx.fillRect(x + 6, y + 2, 8, 4);
    ctx.fillRect(x + w - 14, y + 2, 8, 4);

    // Tail lights
    ctx.fillStyle = '#FF3030';
    ctx.fillRect(x + 4, y + h - 4, 8, 2);
    ctx.fillRect(x + w - 12, y + h - 4, 8, 2);

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
