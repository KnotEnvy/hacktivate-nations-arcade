// ===== src/games/snake/systems/BoardRenderer.ts =====
//
// The terrarium: a moss bed with a two-tone checker, a bevelled glass-case
// frame with a faint inner glow, four corner brackets, and a few spores
// drifting over it. The bed, checker and frame never change, so they are
// painted once into an offscreen canvas and blitted each frame; the HUD
// bands behind the chrome are cached the same way.

import { withAlpha, roundRectPath } from '@/games/shared/hud/canvasUi';
import {
  BOARD_H,
  BOARD_RADIUS,
  BOARD_W,
  BOARD_X,
  BOARD_Y,
  BOTTOM_BAND_Y,
  CANVAS_H,
  CANVAS_W,
  CELL,
  COLS,
  FRAME,
  PAL,
  ROWS,
  TOP_BAND,
} from '../constants';

interface Mote {
  x: number;
  y: number;
  vx: number;
  vy: number;
  phase: number;
  size: number;
  alpha: number;
}

const MOTE_COUNT = 22;

function makeLayer(): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = CANVAS_W;
  c.height = CANVAS_H;
  return c.getContext('2d') ? c : null;
}

export class BoardRenderer {
  private boardLayer: HTMLCanvasElement | null = null;
  private bandLayer: HTMLCanvasElement | null = null;
  private readonly motes: Mote[] = [];

  constructor() {
    for (let i = 0; i < MOTE_COUNT; i++) {
      this.motes.push({
        x: Math.random() * BOARD_W,
        y: Math.random() * BOARD_H,
        vx: (Math.random() - 0.5) * 8,
        vy: -3 - Math.random() * 6,
        phase: Math.random() * Math.PI * 2,
        size: 0.8 + Math.random() * 1.4,
        alpha: 0.1 + Math.random() * 0.22,
      });
    }
  }

  /** Board frame and bed, at a shake offset. */
  drawBoard(ctx: CanvasRenderingContext2D): void {
    if (!this.boardLayer) {
      this.boardLayer = makeLayer();
      const lctx = this.boardLayer?.getContext('2d');
      if (lctx) paintBoard(lctx);
    }
    if (this.boardLayer) {
      ctx.drawImage(this.boardLayer, 0, 0);
    } else {
      paintBoard(ctx);
    }
  }

  /** The two HUD bands; drawn unshaken, over everything else. */
  drawBands(ctx: CanvasRenderingContext2D): void {
    if (!this.bandLayer) {
      this.bandLayer = makeLayer();
      const lctx = this.bandLayer?.getContext('2d');
      if (lctx) paintBands(lctx);
    }
    if (this.bandLayer) {
      ctx.drawImage(this.bandLayer, 0, 0);
    } else {
      paintBands(ctx);
    }
  }

  /** Spores drifting over the bed; a pure function of time. */
  drawMotes(ctx: CanvasRenderingContext2D, time: number): void {
    ctx.save();
    for (const m of this.motes) {
      const x = wrap(
        m.x + m.vx * time + Math.sin(time * 0.6 + m.phase) * 7,
        BOARD_W
      );
      const y = wrap(m.y + m.vy * time, BOARD_H);
      const twinkle = 0.6 + 0.4 * Math.sin(time * 1.3 + m.phase * 3);
      ctx.globalAlpha = m.alpha * twinkle;
      ctx.fillStyle = PAL.bone;
      ctx.beginPath();
      ctx.arc(BOARD_X + x, BOARD_Y + y, m.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

/** Clip to the bed (call inside save/restore). */
export function clipToBoard(ctx: CanvasRenderingContext2D): void {
  roundRectPath(ctx, BOARD_X, BOARD_Y, BOARD_W, BOARD_H, BOARD_RADIUS);
  ctx.clip();
}

/** A tint over the whole bed: speed-tier flash, dying dim. */
export function tintBoard(
  ctx: CanvasRenderingContext2D,
  color: string,
  alpha: number
): void {
  if (alpha <= 0) return;
  ctx.save();
  ctx.fillStyle = withAlpha(color, Math.min(1, alpha));
  roundRectPath(ctx, BOARD_X, BOARD_Y, BOARD_W, BOARD_H, BOARD_RADIUS);
  ctx.fill();
  ctx.restore();
}

/** A red edge vignette inside the bed (hits). */
export function boardVignette(
  ctx: CanvasRenderingContext2D,
  color: string,
  strength: number
): void {
  if (strength <= 0) return;
  const cx = BOARD_X + BOARD_W / 2;
  const cy = BOARD_Y + BOARD_H / 2;
  ctx.save();
  const g = ctx.createRadialGradient(
    cx,
    cy,
    BOARD_H * 0.35,
    cx,
    cy,
    BOARD_W * 0.62
  );
  g.addColorStop(0, withAlpha(color, 0));
  g.addColorStop(1, withAlpha(color, 0.5 * Math.min(1, strength)));
  ctx.fillStyle = g;
  roundRectPath(ctx, BOARD_X, BOARD_Y, BOARD_W, BOARD_H, BOARD_RADIUS);
  ctx.fill();
  ctx.restore();
}

function wrap(v: number, size: number): number {
  return ((v % size) + size) % size;
}

function paintBoard(ctx: CanvasRenderingContext2D): void {
  const fx = BOARD_X - FRAME;
  const fy = BOARD_Y - FRAME;
  const fw = BOARD_W + FRAME * 2;
  const fh = BOARD_H + FRAME * 2;

  ctx.save();
  // The glass case's frame, lit from above.
  const rim = ctx.createLinearGradient(0, fy, 0, fy + fh);
  rim.addColorStop(0, PAL.frameLight);
  rim.addColorStop(0.08, PAL.frameMid);
  rim.addColorStop(1, PAL.frameDark);
  ctx.fillStyle = rim;
  roundRectPath(ctx, fx, fy, fw, fh, BOARD_RADIUS + FRAME);
  ctx.fill();
  ctx.strokeStyle = 'rgba(239, 233, 214, 0.10)';
  ctx.lineWidth = 1;
  roundRectPath(ctx, fx + 0.5, fy + 0.5, fw - 1, fh - 1, BOARD_RADIUS + FRAME);
  ctx.stroke();

  // The bed and its checker.
  ctx.save();
  clipToBoard(ctx);
  ctx.fillStyle = PAL.bedA;
  ctx.fillRect(BOARD_X, BOARD_Y, BOARD_W, BOARD_H);
  ctx.fillStyle = PAL.bedB;
  for (let y = 0; y < ROWS; y++) {
    for (let x = y % 2 ^ 1; x < COLS; x += 2) {
      ctx.fillRect(BOARD_X + x * CELL, BOARD_Y + y * CELL, CELL, CELL);
    }
  }
  // Light pooling in the middle, darker toward the glass.
  const cx = BOARD_X + BOARD_W / 2;
  const cy = BOARD_Y + BOARD_H / 2;
  const pool = ctx.createRadialGradient(
    cx,
    cy - 40,
    30,
    cx,
    cy,
    BOARD_W * 0.62
  );
  pool.addColorStop(0, 'rgba(120, 220, 170, 0.07)');
  pool.addColorStop(0.6, 'rgba(0, 0, 0, 0)');
  pool.addColorStop(1, 'rgba(0, 8, 8, 0.32)');
  ctx.fillStyle = pool;
  ctx.fillRect(BOARD_X, BOARD_Y, BOARD_W, BOARD_H);
  // Faint inner glow along the glass.
  for (const [w, a] of [
    [10, 0.03],
    [5, 0.05],
    [2, 0.1],
  ] as const) {
    ctx.strokeStyle = withAlpha(PAL.bedGlow, a);
    ctx.lineWidth = w;
    roundRectPath(ctx, BOARD_X, BOARD_Y, BOARD_W, BOARD_H, BOARD_RADIUS);
    ctx.stroke();
  }
  ctx.restore();

  // A dark seam where the bed meets the frame.
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.lineWidth = 1.5;
  roundRectPath(
    ctx,
    BOARD_X - 0.5,
    BOARD_Y - 0.5,
    BOARD_W + 1,
    BOARD_H + 1,
    BOARD_RADIUS
  );
  ctx.stroke();

  // Corner brackets.
  ctx.strokeStyle = withAlpha(PAL.marker, 0.38);
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  const inset = 7;
  const arm = 12;
  const corners: Array<[number, number, number, number]> = [
    [BOARD_X + inset, BOARD_Y + inset, 1, 1],
    [BOARD_X + BOARD_W - inset, BOARD_Y + inset, -1, 1],
    [BOARD_X + inset, BOARD_Y + BOARD_H - inset, 1, -1],
    [BOARD_X + BOARD_W - inset, BOARD_Y + BOARD_H - inset, -1, -1],
  ];
  for (const [x, y, sx, sy] of corners) {
    ctx.beginPath();
    ctx.moveTo(x, y + sy * arm);
    ctx.lineTo(x, y);
    ctx.lineTo(x + sx * arm, y);
    ctx.stroke();
  }
  ctx.restore();
}

function paintBands(ctx: CanvasRenderingContext2D): void {
  ctx.save();
  const top = ctx.createLinearGradient(0, 0, 0, TOP_BAND);
  top.addColorStop(0, PAL.bandEdge);
  top.addColorStop(1, PAL.band);
  ctx.fillStyle = top;
  ctx.fillRect(0, 0, CANVAS_W, TOP_BAND);
  ctx.fillStyle = PAL.band;
  ctx.fillRect(0, BOTTOM_BAND_Y, CANVAS_W, CANVAS_H - BOTTOM_BAND_Y);

  ctx.fillStyle = 'rgba(157, 188, 171, 0.16)';
  ctx.fillRect(0, TOP_BAND - 1, CANVAS_W, 1);
  ctx.fillRect(0, BOTTOM_BAND_Y, CANVAS_W, 1);
  // A thin sprout rule under the band's middle third: the studio's mark.
  const rule = ctx.createLinearGradient(260, 0, 540, 0);
  rule.addColorStop(0, withAlpha(PAL.sprout, 0));
  rule.addColorStop(0.5, withAlpha(PAL.sprout, 0.35));
  rule.addColorStop(1, withAlpha(PAL.sprout, 0));
  ctx.fillStyle = rule;
  ctx.fillRect(260, TOP_BAND - 1, 280, 1);
  ctx.restore();
}
