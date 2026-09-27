// ===== src/games/memory/systems/CardArt.ts =====
//
// Card stock. Each face (icon x size) and each back (table x size) is drawn
// ONCE into an offscreen canvas and then blitted, so a 6x6 table costs 36
// drawImage calls a frame rather than 36 vector icons. Where an offscreen
// canvas is unavailable the same painters draw straight into the frame.

import { roundRectPath } from '@/games/shared/hud/canvasUi';
import { BACKS, P } from './palette';
import { drawIcon } from './icons';

type Painter = (ctx: CanvasRenderingContext2D, w: number, h: number) => void;

function offscreen(w: number, h: number): HTMLCanvasElement | null {
  try {
    if (typeof document === 'undefined') return null;
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c.getContext('2d') ? c : null;
  } catch {
    return null;
  }
}

export function cardRadius(w: number): number {
  return Math.max(5, Math.round(w * 0.09));
}

/** Cream stock, a hairline inner frame, the icon, corner pips when large. */
export function paintFace(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  value: number
): void {
  const r = cardRadius(w);
  ctx.save();
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, P.ivory);
  g.addColorStop(1, P.ivoryShade);
  ctx.fillStyle = g;
  roundRectPath(ctx, 0.5, 0.5, w - 1, h - 1, r);
  ctx.fill();
  ctx.strokeStyle = P.ivoryEdge;
  ctx.lineWidth = 1;
  ctx.stroke();

  const inset = Math.max(3, Math.round(w * 0.05));
  roundRectPath(ctx, inset, inset, w - inset * 2, h - inset * 2, r * 0.6);
  ctx.strokeStyle = 'rgba(110, 88, 102, 0.28)';
  ctx.stroke();

  const size = Math.min(w * 0.74, h * 0.6);
  drawIcon(ctx, value, w / 2, h / 2 + h * 0.01, size);

  if (w >= 72) {
    const pip = Math.round(w * 0.15);
    drawIcon(ctx, value, inset + pip * 0.75, inset + pip * 0.8, pip);
    ctx.save();
    ctx.translate(w, h);
    ctx.rotate(Math.PI);
    drawIcon(ctx, value, inset + pip * 0.75, inset + pip * 0.8, pip);
    ctx.restore();
  }
  ctx.restore();
}

/**
 * Jewel-tone back: a lattice on odd tables, a diagonal stripe on even ones,
 * an ivory inner frame, the studio's rhombus mark, and a thin light edge.
 */
export function paintBack(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  table: number
): void {
  const tone = BACKS[table % BACKS.length];
  const r = cardRadius(w);
  ctx.save();
  roundRectPath(ctx, 0.5, 0.5, w - 1, h - 1, r);
  ctx.fillStyle = tone.base;
  ctx.fill();

  const inset = Math.max(4, Math.round(w * 0.07));
  ctx.save();
  roundRectPath(ctx, inset, inset, w - inset * 2, h - inset * 2, r * 0.5);
  ctx.clip();
  const step = Math.max(6, Math.round(w / 9));
  ctx.strokeStyle = tone.line;
  ctx.lineWidth = table % 2 === 0 ? 1.4 : step * 0.42;
  ctx.beginPath();
  for (let k = -h; k < w + h; k += step) {
    ctx.moveTo(k, 0);
    ctx.lineTo(k + h, h);
    if (table % 2 === 0) {
      ctx.moveTo(k + h, 0);
      ctx.lineTo(k, h);
    }
  }
  ctx.stroke();
  ctx.restore();

  roundRectPath(ctx, inset, inset, w - inset * 2, h - inset * 2, r * 0.5);
  ctx.strokeStyle = 'rgba(244, 236, 220, 0.34)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // The mark: a rhombus in a medallion.
  const cx = w / 2;
  const cy = h / 2;
  const m = Math.max(6, w * 0.15);
  ctx.beginPath();
  ctx.arc(cx, cy, m, 0, Math.PI * 2);
  ctx.fillStyle = tone.base;
  ctx.fill();
  ctx.strokeStyle = 'rgba(244, 236, 220, 0.45)';
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx, cy - m * 0.62);
  ctx.lineTo(cx + m * 0.42, cy);
  ctx.lineTo(cx, cy + m * 0.62);
  ctx.lineTo(cx - m * 0.42, cy);
  ctx.closePath();
  ctx.fillStyle = 'rgba(244, 236, 220, 0.78)';
  ctx.fill();

  // Sheen across the top third, and the light edge.
  const sheen = ctx.createLinearGradient(0, 0, 0, h * 0.45);
  sheen.addColorStop(0, 'rgba(255, 244, 230, 0.12)');
  sheen.addColorStop(1, 'rgba(255, 244, 230, 0)');
  roundRectPath(ctx, 0.5, 0.5, w - 1, h - 1, r);
  ctx.fillStyle = sheen;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 238, 222, 0.5)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
}

export class CardArt {
  private cache = new Map<string, HTMLCanvasElement | null>();

  /** Blit a face; returns false only if nothing could be drawn. */
  drawFace(
    ctx: CanvasRenderingContext2D,
    value: number,
    x: number,
    y: number,
    w: number,
    h: number
  ): void {
    this.blit(ctx, `f${value}:${w}x${h}`, x, y, w, h, (c, cw, ch) =>
      paintFace(c, cw, ch, value)
    );
  }

  drawBack(
    ctx: CanvasRenderingContext2D,
    table: number,
    x: number,
    y: number,
    w: number,
    h: number
  ): void {
    this.blit(ctx, `b${table}:${w}x${h}`, x, y, w, h, (c, cw, ch) =>
      paintBack(c, cw, ch, table)
    );
  }

  /** Paint every face and the back for a table size before it is dealt. */
  prepare(values: readonly number[], table: number, w: number, h: number) {
    for (const v of values)
      this.get(`f${v}:${w}x${h}`, w, h, (c, cw, ch) => paintFace(c, cw, ch, v));
    this.get(`b${table}:${w}x${h}`, w, h, (c, cw, ch) =>
      paintBack(c, cw, ch, table)
    );
  }

  /** Cached canvases, for tests. */
  size(): number {
    return this.cache.size;
  }

  private get(
    key: string,
    w: number,
    h: number,
    paint: Painter
  ): HTMLCanvasElement | null {
    if (this.cache.has(key)) return this.cache.get(key) ?? null;
    // Keep the cache bounded: five tables x ~19 faces is well under this.
    if (this.cache.size > 160) this.cache.clear();
    const canvas = offscreen(w, h);
    if (canvas) {
      const c = canvas.getContext('2d');
      if (c) paint(c, w, h);
    }
    this.cache.set(key, canvas);
    return canvas;
  }

  private blit(
    ctx: CanvasRenderingContext2D,
    key: string,
    x: number,
    y: number,
    w: number,
    h: number,
    paint: Painter
  ): void {
    const canvas = this.get(key, w, h, paint);
    if (canvas) {
      ctx.drawImage(canvas, x, y, w, h);
      return;
    }
    ctx.save();
    ctx.translate(x, y);
    paint(ctx, w, h);
    ctx.restore();
  }
}
