// Glass tiles. Each tile is a rounded pane tinted in its row colour with a
// highlight band, a lit outline, and its hit points as a row of cells along
// the bottom. Every hit steps the tint darker and empties a cell, and the
// pre-rolled cracks appear one per point of damage. Steel tiles are brushed
// grey with rivets.
//
// A pane depends only on (colour, size, hp, max hp, steel), so each look is
// painted once into a small offscreen sprite and blitted after that.

import { COURT } from '../constants';
import type { Brick } from '../entities/types';
import { ease, roundRectPath } from '@/games/shared/hud/canvasUi';
import { blend, rgba } from './color';

const PAD = 8;
const DROP = 90;

/** A pane's body tint: one step darker for every point of damage. */
export function tileTint(color: string, hp: number, maxHp: number): string {
  return blend(color, '#150f30', Math.min(0.66, 0.22 * (maxHp - hp)));
}

export class BrickRenderer {
  private sprites = new Map<string, HTMLCanvasElement | null>();

  private key(b: Brick): string {
    return `${b.color}|${b.w.toFixed(1)}|${b.h}|${b.hp}|${b.maxHp}|${b.armored}`;
  }

  private sprite(b: Brick): HTMLCanvasElement | null {
    const k = this.key(b);
    const hit = this.sprites.get(k);
    if (hit !== undefined) return hit;
    let made: HTMLCanvasElement | null = null;
    if (typeof document !== 'undefined') {
      const c = document.createElement('canvas');
      c.width = Math.ceil(b.w + PAD * 2);
      c.height = Math.ceil(b.h + PAD * 2);
      const g = c.getContext('2d');
      if (g) {
        this.paintTile(g, PAD, PAD, b);
        made = c;
      }
    }
    this.sprites.set(k, made);
    return made;
  }

  /** Paint one pane with its top-left at (x, y). */
  paintTile(g: CanvasRenderingContext2D, x: number, y: number, b: Brick): void {
    const { w, h } = b;
    const dmg = b.maxHp - b.hp;
    if (b.armored) {
      this.paintSteel(g, x, y, b, dmg);
      return;
    }
    const tint = tileTint(b.color, b.hp, b.maxHp);
    const edge = 0.95 - 0.16 * dmg;

    // Neon halo, painted once into the sprite.
    g.save();
    g.shadowColor = rgba(b.color, 0.6 - 0.12 * dmg);
    g.shadowBlur = 9;
    g.fillStyle = rgba(b.color, 0.3);
    roundRectPath(g, x, y, w, h, 4);
    g.fill();
    g.restore();

    g.fillStyle = COURT.glass;
    roundRectPath(g, x, y, w, h, 4);
    g.fill();
    const body = g.createLinearGradient(0, y, 0, y + h);
    body.addColorStop(0, rgba(tint, 0.78));
    body.addColorStop(1, rgba(tint, 0.34));
    g.fillStyle = body;
    g.fill();

    // Highlight band across the top of the pane.
    const band = g.createLinearGradient(0, y + 1, 0, y + h * 0.5);
    band.addColorStop(0, 'rgba(255, 255, 255, 0.38)');
    band.addColorStop(1, 'rgba(255, 255, 255, 0)');
    g.fillStyle = band;
    roundRectPath(g, x + 2, y + 1.5, w - 4, h * 0.45, 3);
    g.fill();

    g.strokeStyle = rgba(blend(b.color, '#ffffff', 0.25), edge);
    g.lineWidth = 1.3;
    roundRectPath(g, x + 0.65, y + 0.65, w - 1.3, h - 1.3, 3.5);
    g.stroke();

    this.paintCells(
      g,
      x,
      y,
      b,
      blend(b.color, '#ffffff', 0.7),
      rgba(b.color, 0.8)
    );
  }

  private paintSteel(
    g: CanvasRenderingContext2D,
    x: number,
    y: number,
    b: Brick,
    dmg: number
  ): void {
    const { w, h } = b;
    const body = g.createLinearGradient(0, y, 0, y + h);
    body.addColorStop(0, blend('#b9c1d4', '#5a6278', 0.18 * dmg));
    body.addColorStop(1, blend(COURT.steelDark, '#1d2130', 0.18 * dmg));
    g.fillStyle = body;
    roundRectPath(g, x, y, w, h, 2.5);
    g.fill();

    // Brushed hatch.
    g.save();
    roundRectPath(g, x, y, w, h, 2.5);
    g.clip();
    g.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    g.lineWidth = 1;
    g.beginPath();
    for (let i = -h; i < w; i += 6) {
      g.moveTo(x + i, y + h);
      g.lineTo(x + i + h, y);
    }
    g.stroke();
    g.restore();

    g.strokeStyle = '#e3e8f3';
    g.lineWidth = 1.2;
    roundRectPath(g, x + 0.6, y + 0.6, w - 1.2, h - 1.2, 2.5);
    g.stroke();

    g.fillStyle = '#20263a';
    for (const [rx, ry] of [
      [x + 4.5, y + 4.5],
      [x + w - 4.5, y + 4.5],
      [x + 4.5, y + h - 4.5],
      [x + w - 4.5, y + h - 4.5],
    ]) {
      g.beginPath();
      g.arc(rx, ry, 1.6, 0, Math.PI * 2);
      g.fill();
    }
    this.paintCells(g, x, y, b, '#f1f4fb', 'rgba(20, 24, 38, 0.8)');
  }

  private paintCells(
    g: CanvasRenderingContext2D,
    x: number,
    y: number,
    b: Brick,
    full: string,
    empty: string
  ): void {
    const cw = 8;
    const ch = 3;
    const gap = 3;
    const total = b.maxHp * cw + (b.maxHp - 1) * gap;
    let cx = x + (b.w - total) / 2;
    const cy = y + b.h - 6.5;
    for (let i = 0; i < b.maxHp; i++) {
      if (i < b.hp) {
        g.fillStyle = full;
        g.fillRect(cx, cy, cw, ch);
      } else {
        g.strokeStyle = empty;
        g.lineWidth = 1;
        g.strokeRect(cx + 0.5, cy + 0.5, cw - 1, ch - 1);
      }
      cx += cw + gap;
    }
  }

  /** Visual offset of a brick this frame (shake and drop-in). */
  private offset(b: Brick): { dx: number; dy: number; alpha: number } {
    let dx = 0;
    let dy = 0;
    let alpha = 1;
    if (b.shake > 0) dx = Math.sin(b.shake * 90) * 2;
    if (b.enter < 1) {
      dy = -(1 - ease.outBack(b.enter)) * DROP;
      alpha = Math.min(1, b.enter * 3);
    }
    return { dx, dy, alpha };
  }

  /**
   * Match point: with only a few tiles left, they pulse so the player can
   * see where to aim. `time` drives the pulse; 0 bricks = off.
   */
  beacon(ctx: CanvasRenderingContext2D, bricks: Brick[], time: number): void {
    const k = 0.35 + 0.35 * Math.sin(time * 5);
    ctx.save();
    ctx.strokeStyle = rgba(COURT.mintBright, k);
    ctx.lineWidth = 2;
    for (const b of bricks) {
      if (!b.alive || b.armored) continue;
      roundRectPath(ctx, b.x - 4, b.y - 4, b.w + 8, b.h + 8, 6);
      ctx.stroke();
    }
    ctx.restore();
  }

  draw(ctx: CanvasRenderingContext2D, bricks: Brick[], animate = true): void {
    for (const b of bricks) {
      if (!b.alive) continue;
      if (b.enter <= 0 && b.enterDelay > 0) continue;
      const o = animate ? this.offset(b) : { dx: 0, dy: 0, alpha: 1 };
      const x = b.x + o.dx;
      const y = b.y + o.dy;
      ctx.save();
      ctx.globalAlpha = o.alpha;
      const s = this.sprite(b);
      if (s) ctx.drawImage(s, x - PAD, y - PAD);
      else this.paintTile(ctx, x, y, b);
      this.drawCracks(ctx, b, x, y);
      if (animate && b.flash > 0) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(0.7, b.flash * 7)})`;
        roundRectPath(ctx, x, y, b.w, b.h, 4);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  private drawCracks(
    ctx: CanvasRenderingContext2D,
    b: Brick,
    x: number,
    y: number
  ): void {
    const n = Math.min(b.cracks.length, b.maxHp - b.hp);
    if (n <= 0) return;
    ctx.lineWidth = 1;
    ctx.lineJoin = 'miter';
    for (const [color, off] of [
      [b.armored ? 'rgba(255, 255, 255, 0.35)' : 'rgba(6, 4, 20, 0.7)', 1],
      [b.armored ? 'rgba(10, 12, 20, 0.85)' : 'rgba(255, 255, 255, 0.9)', 0],
    ] as const) {
      ctx.strokeStyle = color;
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const pts = b.cracks[i].points;
        ctx.moveTo(x + pts[0].x, y + pts[0].y + off);
        for (let k = 1; k < pts.length; k++) {
          ctx.lineTo(x + pts[k].x, y + pts[k].y + off);
        }
      }
      ctx.stroke();
    }
  }
}
