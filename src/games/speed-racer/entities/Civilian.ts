import { ROAD } from '../data/constants';

// Two-tone palettes give civilians readable personality without the enemy-car
// palette. Body + trim + driver silhouette color; trim reads as roof/skirt.
interface CivilianPalette {
  body: string;
  trim: string;
  driver: string;
}

const CIVILIAN_PALETTES: readonly CivilianPalette[] = [
  { body: '#4FC3F7', trim: '#1E6091', driver: '#3A1A1A' }, // sky-blue sedan
  { body: '#81C784', trim: '#2E7D32', driver: '#2A1A1A' }, // mint-green hatchback
  { body: '#FFD54F', trim: '#C17900', driver: '#2A1A1A' }, // mustard taxi-ish
  { body: '#BA68C8', trim: '#6A1B9A', driver: '#2A1A1A' }, // lavender coupe
  { body: '#EF9A9A', trim: '#B71C1C', driver: '#3A1A1A' }, // cherry-red family
  { body: '#E0E0E0', trim: '#424242', driver: '#3A1A1A' }, // silver commuter
];

export class Civilian {
  x: number;
  y: number;
  vy = 0;
  alive = true;
  readonly width = 40;
  readonly height = 68;
  readonly forwardSpeed = 240; // World-frame forward speed (slower than ram)
  readonly palette: CivilianPalette;
  readonly roofRack: boolean;
  readonly signalPhase: number; // randomized so not every civ blinks in sync

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
    this.palette = CIVILIAN_PALETTES[Math.floor(Math.random() * CIVILIAN_PALETTES.length)];
    this.roofRack = Math.random() < 0.25;
    this.signalPhase = Math.random() * Math.PI * 2;
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
    const cx = this.x;
    const { body, trim, driver } = this.palette;
    ctx.save();

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    this.roundRect(ctx, x + 3, y + 5, w, h, 7);
    ctx.fill();

    // Body — two-tone family car. Darker trim as a skirt at the bottom.
    ctx.fillStyle = body;
    this.roundRect(ctx, x, y, w, h, 7);
    ctx.fill();
    ctx.fillStyle = trim;
    this.roundRect(ctx, x, y + h - 14, w, 14, 7);
    ctx.fill();
    // Clean seam at top of skirt
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(x + 3, y + h - 15, w - 6, 1);

    // Front windshield
    ctx.fillStyle = '#0a0a14';
    this.roundRect(ctx, x + 5, y + 12, w - 10, 14, 3);
    ctx.fill();
    // Windshield highlight
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    this.roundRect(ctx, x + 7, y + 14, w - 14, 4, 2);
    ctx.fill();

    // Driver silhouette — head + shoulders seen through windshield
    ctx.fillStyle = driver;
    ctx.beginPath();
    ctx.arc(cx, y + 21, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(cx - 5, y + 22, 10, 4);

    // Rear window (smaller, below the cabin midpoint)
    ctx.fillStyle = '#0a0a14';
    this.roundRect(ctx, x + 6, y + h - 28, w - 12, 10, 2);
    ctx.fill();

    // Side window bands — thin strips along the flanks between the windows
    ctx.fillStyle = 'rgba(10,10,20,0.85)';
    ctx.fillRect(x + 4, y + 28, 3, h - 48);
    ctx.fillRect(x + w - 7, y + 28, 3, h - 48);
    // Chrome window trim
    ctx.fillStyle = '#d0d0d0';
    ctx.fillRect(x + 4, y + 26, 3, 2);
    ctx.fillRect(x + w - 7, y + 26, 3, 2);

    // Door seam across the middle of the body
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + 8, y + h * 0.5);
    ctx.lineTo(x + w - 8, y + h * 0.5);
    ctx.stroke();

    // Headlights
    ctx.fillStyle = '#FFFFC8';
    ctx.fillRect(x + 4, y + 2, 7, 4);
    ctx.fillRect(x + w - 11, y + 2, 7, 4);
    // Chrome front bumper
    ctx.fillStyle = '#bbbbbb';
    ctx.fillRect(x + 4, y + 7, w - 8, 2);

    // Amber turn signals at front corners — blink gently and independently
    const blink = 0.4 + 0.6 * (Math.sin(this.signalPhase + this.y * 0.01) > 0 ? 1 : 0);
    ctx.fillStyle = `rgba(255,170,30,${blink.toFixed(2)})`;
    ctx.fillRect(x + 2, y + 4, 3, 3);
    ctx.fillRect(x + w - 5, y + 4, 3, 3);

    // Tail lights + chrome rear bumper
    ctx.fillStyle = '#FF3030';
    ctx.fillRect(x + 5, y + h - 4, 8, 2);
    ctx.fillRect(x + w - 13, y + h - 4, 8, 2);
    ctx.fillStyle = '#bbbbbb';
    ctx.fillRect(x + 4, y + h - 2, w - 8, 2);

    // Side mirrors — color-matched body
    ctx.fillStyle = body;
    ctx.fillRect(x - 2, y + 18, 3, 5);
    ctx.fillRect(x + w - 1, y + 18, 3, 5);

    // Optional roof rack — thin silver bars on top of the cabin
    if (this.roofRack) {
      ctx.fillStyle = '#a0a0a0';
      ctx.fillRect(x + 4, y + 32, w - 8, 1.5);
      ctx.fillRect(x + 4, y + 36, w - 8, 1.5);
      // Support bars at each end
      ctx.fillRect(x + 5, y + 32, 2, 5);
      ctx.fillRect(x + w - 7, y + 32, 2, 5);
    }

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
