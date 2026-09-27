// The court: a floodlit floor with a perspective grid that recedes toward
// the far (top) rail and falls away to black at the near end, faint court
// markings, and three LED perimeter rails. All of that is static, so it is
// painted once into an offscreen canvas; per frame only the rail flashes
// (where the ball just rang off) are drawn on top.

import {
  ARENA,
  COURT,
  RAIL_FLASH_TIME,
  RAIL_THICKNESS,
  VIEW_H,
  VIEW_W,
} from '../constants';
import type { RailSide } from './physics';
import { rgba } from './color';

export interface RailFlash {
  side: RailSide;
  /** Position along the rail: y for side rails, x for the top rail. */
  pos: number;
  t: number;
}

const L = ARENA.left - RAIL_THICKNESS;
const R = ARENA.right + RAIL_THICKNESS;
const T = ARENA.top - RAIL_THICKNESS;

function makeCanvas(w: number, h: number): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

export class ArenaRenderer {
  private cache: HTMLCanvasElement | null = null;

  /** Paint the static court. Call once (and again if the palette changes). */
  build(): void {
    const c = makeCanvas(VIEW_W, VIEW_H);
    const g = c?.getContext('2d');
    if (!c || !g) {
      this.cache = null;
      return;
    }
    this.paint(g);
    this.cache = c;
  }

  drawFloor(ctx: CanvasRenderingContext2D): void {
    if (this.cache) ctx.drawImage(this.cache, 0, 0);
    else this.paint(ctx);
  }

  private paint(g: CanvasRenderingContext2D): void {
    const w = ARENA.right - ARENA.left;
    const h = VIEW_H - ARENA.top;

    g.fillStyle = COURT.void;
    g.fillRect(0, 0, VIEW_W, VIEW_H);

    // Floor: lit at the far rail, black at the near end.
    const floor = g.createLinearGradient(0, ARENA.top, 0, VIEW_H);
    floor.addColorStop(0, COURT.floorTop);
    floor.addColorStop(0.45, COURT.floorMid);
    floor.addColorStop(1, COURT.floorBottom);
    g.fillStyle = floor;
    g.fillRect(ARENA.left, ARENA.top, w, h);

    g.save();
    g.beginPath();
    g.rect(ARENA.left, ARENA.top, w, h);
    g.clip();

    // Perspective grid: verticals converge on a point above the far rail,
    // cross-lines bunch up toward it.
    const vx = VIEW_W / 2;
    const vy = -520;
    g.strokeStyle = rgba(COURT.grid, 0.55);
    g.lineWidth = 1;
    g.beginPath();
    for (let i = -14; i <= 14; i++) {
      const bx = vx + i * 70;
      g.moveTo(vx + (bx - vx) * ((ARENA.top - vy) / (VIEW_H - vy)), ARENA.top);
      g.lineTo(bx, VIEW_H);
    }
    const lines = 13;
    for (let k = 1; k <= lines; k++) {
      const y = ARENA.top + h * Math.pow(k / lines, 1.75);
      g.moveTo(ARENA.left, y);
      g.lineTo(ARENA.right, y);
    }
    g.stroke();

    // Court markings: a service line and a half-circle at the near end.
    g.strokeStyle = rgba(COURT.line, 0.07);
    g.lineWidth = 2;
    g.setLineDash([10, 8]);
    g.beginPath();
    g.moveTo(ARENA.left, 470);
    g.lineTo(ARENA.right, 470);
    g.stroke();
    g.setLineDash([]);
    g.beginPath();
    g.arc(VIEW_W / 2, VIEW_H, 96, Math.PI, Math.PI * 2);
    g.stroke();

    // Floodlights: two soft washes from the far corners.
    for (const cx of [ARENA.left, ARENA.right]) {
      const wash = g.createRadialGradient(cx, ARENA.top, 0, cx, ARENA.top, 520);
      wash.addColorStop(0, rgba(COURT.mintBright, 0.1));
      wash.addColorStop(0.5, rgba(COURT.mintBright, 0.025));
      wash.addColorStop(1, rgba(COURT.mintBright, 0));
      g.fillStyle = wash;
      g.fillRect(ARENA.left, ARENA.top, w, h);
    }

    // The near end falls away to black, and the edges darken.
    const fall = g.createLinearGradient(0, ARENA.top + h * 0.45, 0, VIEW_H);
    fall.addColorStop(0, 'rgba(1, 1, 4, 0)');
    fall.addColorStop(1, 'rgba(1, 1, 4, 0.92)');
    g.fillStyle = fall;
    g.fillRect(ARENA.left, ARENA.top, w, h);
    const vig = g.createRadialGradient(
      VIEW_W / 2,
      VIEW_H * 0.42,
      160,
      VIEW_W / 2,
      VIEW_H * 0.42,
      560
    );
    vig.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vig.addColorStop(1, 'rgba(0, 0, 0, 0.5)');
    g.fillStyle = vig;
    g.fillRect(ARENA.left, ARENA.top, w, h);
    g.restore();

    this.paintRails(g);
  }

  private paintRails(g: CanvasRenderingContext2D): void {
    const t = RAIL_THICKNESS;
    // Housing.
    g.fillStyle = '#0c0f2b';
    g.fillRect(L, T, t, VIEW_H - T);
    g.fillRect(ARENA.right, T, t, VIEW_H - T);
    g.fillRect(L, T, R - L, t);

    // A continuous LED core along the inner edge, glowing. The one
    // shadowBlur in the game, and it runs once.
    const run = VIEW_H - ARENA.top + 2;
    g.save();
    g.shadowColor = COURT.mint;
    g.shadowBlur = 12;
    g.fillStyle = rgba(COURT.mint, 0.85);
    g.fillRect(ARENA.left - 2, ARENA.top - 2, 2, run);
    g.fillRect(ARENA.right, ARENA.top - 2, 2, run);
    g.fillRect(ARENA.left - 2, ARENA.top - 2, ARENA.right - ARENA.left + 4, 2);
    g.restore();

    // Brighter LED nodes every 48px, like a perimeter board.
    g.fillStyle = COURT.mintBright;
    for (let y = ARENA.top + 46; y < VIEW_H; y += 48) {
      g.fillRect(ARENA.left - 3, y, 3, 3);
      g.fillRect(ARENA.right, y, 3, 3);
    }
    for (let x = ARENA.left + 42; x < ARENA.right - 20; x += 48) {
      g.fillRect(x, ARENA.top - 3, 3, 3);
    }

    // Corner posts: the floodlight masts.
    g.fillStyle = COURT.mintBright;
    for (const x of [L, ARENA.right]) {
      g.fillRect(x, T, t, 12);
    }
    g.fillRect(L, T, 16, t);
    g.fillRect(R - 16, T, 16, t);
  }

  /** The bright spot where the ball just rang off a rail. */
  drawFlashes(ctx: CanvasRenderingContext2D, flashes: RailFlash[]): void {
    if (flashes.length === 0) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const f of flashes) {
      const k = Math.max(0, f.t / RAIL_FLASH_TIME);
      const span = 56;
      if (f.side === 'top') {
        const g = ctx.createLinearGradient(f.pos - span, 0, f.pos + span, 0);
        g.addColorStop(0, rgba(COURT.mintBright, 0));
        g.addColorStop(0.5, rgba(COURT.mintBright, 0.95 * k));
        g.addColorStop(1, rgba(COURT.mintBright, 0));
        ctx.fillStyle = g;
        ctx.fillRect(f.pos - span, T, span * 2, RAIL_THICKNESS + 2);
        ctx.globalAlpha = 0.35 * k;
        ctx.fillRect(f.pos - span, ARENA.top, span * 2, 12);
        ctx.globalAlpha = 1;
      } else {
        const x = f.side === 'left' ? L : ARENA.right - 2;
        const g = ctx.createLinearGradient(0, f.pos - span, 0, f.pos + span);
        g.addColorStop(0, rgba(COURT.mintBright, 0));
        g.addColorStop(0.5, rgba(COURT.mintBright, 0.95 * k));
        g.addColorStop(1, rgba(COURT.mintBright, 0));
        ctx.fillStyle = g;
        ctx.fillRect(x, f.pos - span, RAIL_THICKNESS + 2, span * 2);
        ctx.globalAlpha = 0.35 * k;
        const bx = f.side === 'left' ? ARENA.left : ARENA.right - 12;
        ctx.fillRect(bx, f.pos - span, 12, span * 2);
        ctx.globalAlpha = 1;
      }
    }
    ctx.restore();
  }
}
