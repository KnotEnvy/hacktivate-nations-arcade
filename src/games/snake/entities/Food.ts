// ===== src/games/snake/entities/Food.ts =====
//
// The apple: body, highlight, stem and leaf, popping in when it spawns and
// breathing a soft glow while it waits. When the snake has gone a while
// without eating, the glow grows: the "hungry" tell.

import { ease, withAlpha } from '@/games/shared/hud/canvasUi';
import { CELL, PAL } from '../constants';

export class Food {
  /** Seconds since this apple appeared (drives the pop-in). */
  private age = 0;

  constructor(
    public x: number,
    public y: number
  ) {}

  update(dt: number): void {
    this.age += dt;
  }

  setPosition(x: number, y: number): void {
    this.x = x;
    this.y = y;
    this.age = 0;
  }

  /** Off the board (nowhere left to grow an apple). */
  isPlaced(): boolean {
    return this.x >= 0 && this.y >= 0;
  }

  /** `hunger` is 0..1: how long the snake has gone without an apple. */
  render(
    ctx: CanvasRenderingContext2D,
    ox: number,
    oy: number,
    time: number,
    hunger = 0
  ): void {
    if (!this.isPlaced()) return;
    const cx = ox + this.x * CELL + CELL / 2;
    const cy = oy + this.y * CELL + CELL / 2;
    const pop = ease.outBack(Math.min(1, this.age / 0.32));
    const breathe = 1 + Math.sin(time * 3.2) * 0.03;
    const r = (CELL / 2 - 3) * Math.max(0.01, pop) * breathe;

    const glow = 0.18 + 0.08 * Math.sin(time * 3.2) + hunger * 0.3;
    const halo = ctx.createRadialGradient(cx, cy, r * 0.4, cx, cy, r * 2.3);
    halo.addColorStop(0, withAlpha(PAL.apple, glow));
    halo.addColorStop(1, withAlpha(PAL.apple, 0));
    ctx.save();
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 2.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    drawApple(ctx, cx, cy, r);
  }
}

/** An apple of radius `r` centred on (cx, cy). */
export function drawApple(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number
): void {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(cx, cy - r * 0.62);
  ctx.bezierCurveTo(
    cx + r * 0.35,
    cy - r * 1.02,
    cx + r * 1.08,
    cy - r * 0.78,
    cx + r * 1.0,
    cy - r * 0.02
  );
  ctx.bezierCurveTo(
    cx + r * 0.96,
    cy + r * 0.66,
    cx + r * 0.46,
    cy + r * 1.02,
    cx + r * 0.18,
    cy + r * 0.92
  );
  ctx.quadraticCurveTo(cx, cy + r * 0.84, cx - r * 0.18, cy + r * 0.92);
  ctx.bezierCurveTo(
    cx - r * 0.46,
    cy + r * 1.02,
    cx - r * 0.96,
    cy + r * 0.66,
    cx - r * 1.0,
    cy - r * 0.02
  );
  ctx.bezierCurveTo(
    cx - r * 1.08,
    cy - r * 0.78,
    cx - r * 0.35,
    cy - r * 1.02,
    cx,
    cy - r * 0.62
  );
  ctx.closePath();
  const body = ctx.createRadialGradient(
    cx - r * 0.35,
    cy - r * 0.3,
    r * 0.1,
    cx,
    cy,
    r * 1.1
  );
  body.addColorStop(0, PAL.appleLight);
  body.addColorStop(0.45, PAL.apple);
  body.addColorStop(1, PAL.appleDark);
  ctx.fillStyle = body;
  ctx.fill();

  // Highlight.
  ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.beginPath();
  ctx.ellipse(
    cx - r * 0.45,
    cy - r * 0.22,
    r * 0.14,
    r * 0.26,
    0.5,
    0,
    Math.PI * 2
  );
  ctx.fill();

  // Stem.
  ctx.strokeStyle = PAL.stem;
  ctx.lineWidth = Math.max(1.2, r * 0.16);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx, cy - r * 0.55);
  ctx.quadraticCurveTo(
    cx + r * 0.05,
    cy - r * 0.95,
    cx + r * 0.22,
    cy - r * 1.1
  );
  ctx.stroke();

  // Leaf, with a midrib.
  const lx = cx + r * 0.12;
  const ly = cy - r * 0.9;
  ctx.fillStyle = PAL.leaf;
  ctx.beginPath();
  ctx.moveTo(lx, ly);
  ctx.quadraticCurveTo(
    lx + r * 0.35,
    ly - r * 0.5,
    lx + r * 0.85,
    ly - r * 0.3
  );
  ctx.quadraticCurveTo(lx + r * 0.45, ly + r * 0.12, lx, ly);
  ctx.fill();
  ctx.strokeStyle = 'rgba(11, 53, 34, 0.55)';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(lx + r * 0.08, ly - r * 0.04);
  ctx.lineTo(lx + r * 0.7, ly - r * 0.28);
  ctx.stroke();
  ctx.restore();
}
