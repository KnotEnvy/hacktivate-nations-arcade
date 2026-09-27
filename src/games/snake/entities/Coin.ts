// ===== src/games/snake/entities/Coin.ts =====
//
// Coins are the arcade's currency, so they are amber and nothing else on
// the board is. They keep the edge-on spin (width scales with cos) with a
// bright rim at the edge-on point so they flash rather than vanish, and
// they slide a cell at a time when the magnet pulls them.

import { UI, withAlpha } from '@/games/shared/hud/canvasUi';
import { CELL } from '../constants';

export class Coin {
  /** Lifetime on the board; frozen while the run is frozen. */
  private age = 0;
  /** Animation clock; always runs. */
  private anim = 0;
  private readonly phase: number;
  /** Where a magnet pull started, and how far through the slide it is. */
  private fromX: number;
  private fromY: number;
  private slide = 1;

  constructor(
    public x: number,
    public y: number,
    private readonly lifetime = 6,
    private readonly blinkTime = 1
  ) {
    this.fromX = x;
    this.fromY = y;
    this.phase = Math.random() * Math.PI * 2;
  }

  /** `ageing` is false while the run is frozen (hit, respawn, ready). */
  update(dt: number, ageing = true): void {
    if (ageing) this.age += dt;
    this.anim += dt;
    if (this.slide < 1) this.slide = Math.min(1, this.slide + dt * 9);
  }

  /** Move one cell (a magnet pull), animating from where it was. */
  moveTo(x: number, y: number): void {
    this.fromX = this.x;
    this.fromY = this.y;
    this.x = x;
    this.y = y;
    this.slide = 0;
  }

  isExpired(): boolean {
    return this.age >= this.lifetime;
  }

  getTimeRemaining(): number {
    return Math.max(0, this.lifetime - this.age);
  }

  render(
    ctx: CanvasRenderingContext2D,
    ox: number,
    oy: number,
    time: number
  ): void {
    if (this.isExpired()) return;
    const left = this.lifetime - this.age;
    if (left < this.blinkTime && Math.floor(time * 10) % 2 === 1) return;

    const k = 1 - Math.pow(1 - this.slide, 3);
    const gx = this.fromX + (this.x - this.fromX) * k;
    const gy = this.fromY + (this.y - this.fromY) * k;
    const pop = Math.min(1, this.anim / 0.25);
    const cx = ox + gx * CELL + CELL / 2;
    const cy = oy + gy * CELL + CELL / 2 + Math.sin(time * 3 + this.phase);
    drawCoin(ctx, cx, cy, (CELL / 2 - 4) * pop, time * 4 + this.phase);
  }
}

/** A spinning coin of radius `r`; `spin` is its rotation phase. */
export function drawCoin(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  spin: number
): void {
  if (r <= 0.5) return;
  const face = Math.cos(spin);
  const w = r * Math.max(0.16, Math.abs(face));
  ctx.save();
  const halo = ctx.createRadialGradient(cx, cy, r * 0.5, cx, cy, r * 2);
  halo.addColorStop(0, withAlpha(UI.coin, 0.3));
  halo.addColorStop(1, withAlpha(UI.coin, 0));
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = UI.coinDim;
  ctx.beginPath();
  ctx.ellipse(cx, cy, w, r, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = UI.coin;
  ctx.beginPath();
  ctx.ellipse(cx - w * 0.08, cy, w * 0.88, r * 0.9, 0, 0, Math.PI * 2);
  ctx.fill();
  if (Math.abs(face) > 0.45) {
    // Face-on: an inner ring and a small embossed leaf.
    ctx.strokeStyle = UI.coinDim;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.ellipse(cx - w * 0.08, cy, w * 0.58, r * 0.58, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = UI.coinDim;
    ctx.beginPath();
    ctx.ellipse(cx - w * 0.08, cy, w * 0.16, r * 0.34, 0.6, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Edge-on: a bright rim so it flashes instead of disappearing.
    ctx.fillStyle = 'rgba(255, 244, 214, 0.9)';
    ctx.fillRect(cx - 1, cy - r * 0.9, 2, r * 1.8);
  }
  ctx.restore();
}
