// ===== src/games/snake/systems/SnakeRenderer.ts =====
//
// The snake is the whole game, so it is drawn as one animal rather than a
// chain of squares. The logic still moves a cell at a time; the picture is
// a rope through the cell centres whose head end advances and whose tail
// end retracts by the step's progress `t`, so the body glides and keeps a
// constant length between steps. Corners stay on the cell centres (a
// segment-by-segment lerp would cut them).
//
// Passes: a dark outline, the body with a gentle taper to the tail and a
// travelling swallow bulge per apple, a lighter dorsal stripe, then the
// wedge head, which turns smoothly because its angle is read off the rope
// behind it. With WRAP the rope is unwrapped into one continuous line and
// drawn again one board over, so it slides out of one edge and in at the
// other.

import {
  CELL,
  BOARD_H,
  BOARD_W,
  BOARD_X,
  BOARD_Y,
  COLS,
  ROWS,
  PAL,
} from '../constants';
import { mix, withAlpha } from '@/games/shared/hud/canvasUi';
import type { Cell } from './Respawn';

interface Pt {
  x: number;
  y: number;
}

export interface SnakeView {
  cells: readonly Cell[];
  prevTail: Cell;
  /** 0..1 progress through the current step. */
  t: number;
  /** Rope distance (cells) from the head of each swallowed apple. */
  bulges: readonly number[];
  time: number;
  /** Invulnerability: draw this frame in the flash colour. */
  flash: boolean;
  /** GHOST: a pale, spectral body. */
  ghost?: boolean;
  /** A stripe colour for a mode (DOUBLE), or undefined for the usual. */
  stripe?: string;
  /** 0..1 strength of the coin shimmer. */
  rainbow: number;
  /** 0..1 head squash just after eating. */
  squash: number;
  /** 0..1 growth-in after hatching. */
  hatch: number;
  /** 0..1 head pressed forward (the bump of a hit). */
  nose: number;
  /** Rope length (cells) already popped from the head end at death. */
  popped: number;
  /** A point (px) the eyes glance toward, or null to look ahead. */
  lookAt: Pt | null;
  /** 0..1 tongue extension. */
  tongue: number;
}

const BODY_W = CELL * 0.74;
const GHOST_TINT = '#dfe8f2';

/** The rope through the snake, in cell units, unwrapped to be continuous. */
export function ropePoints(
  cells: readonly Cell[],
  prevTail: Cell,
  t: number
): Pt[] {
  const n = cells.length;
  if (n === 0) return [];
  const u: Pt[] = [{ x: cells[0].x, y: cells[0].y }];
  for (let k = 1; k < n; k++) u.push(nearest(cells[k], u[k - 1]));
  if (n === 1) return [u[0]];
  const tailFrom = nearest(prevTail, u[n - 1]);
  const pts: Pt[] = [lerp(u[1], u[0], t)];
  for (let k = 1; k < n; k++) pts.push(u[k]);
  pts.push(lerp(tailFrom, u[n - 1], t));
  return pts;
}

/** The head's drawn centre in pixels (for effects that follow it). */
export function headPixel(
  cells: readonly Cell[],
  prevTail: Cell,
  t: number
): Pt {
  const pts = ropePoints(cells, prevTail, t);
  const p = pts[0] ?? { x: 0, y: 0 };
  return toPx(wrapPt(p));
}

export function drawSnake(ctx: CanvasRenderingContext2D, v: SnakeView): void {
  const pts = ropePoints(v.cells, v.prevTail, v.t);
  if (pts.length < 2) return;
  const offsets = wrapOffsets(pts);
  for (const [ox, oy] of offsets) {
    ctx.save();
    ctx.translate(ox * BOARD_W, oy * BOARD_H);
    drawRope(ctx, pts, v);
    if (v.popped < 0.5) drawHead(ctx, pts, v);
    ctx.restore();
  }
}

/**
 * A pale translucent outline of a body: the skin left behind. Each pass is
 * one path, because overlapping translucent pieces would bead.
 */
export function drawShed(
  ctx: CanvasRenderingContext2D,
  cells: readonly Cell[],
  alpha: number
): void {
  if (cells.length < 2 || alpha <= 0) return;
  const rope = ropePoints(cells, cells[cells.length - 1], 1);
  const pts = rope.map(toPx);
  for (const [ox, oy] of wrapOffsets(rope)) {
    ctx.save();
    ctx.translate(ox * BOARD_W, oy * BOARD_H);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    polyline(ctx, pts, BODY_W + 3, withAlpha(PAL.bone, 0.2 * alpha));
    polyline(ctx, pts, BODY_W - 2, withAlpha(PAL.bedA, 0.85 * alpha));
    polyline(ctx, pts, BODY_W * 0.2, withAlpha(PAL.bone, 0.12 * alpha));
    ctx.restore();
  }
}

// ------------------------------------------------------------- body ----

function drawRope(
  ctx: CanvasRenderingContext2D,
  pts: Pt[],
  v: SnakeView
): void {
  const total = ropeLength(pts);
  const hatch = Math.max(0.05, v.hatch);
  const width = (s: number): number => {
    let w = BODY_W * taper(s, total);
    for (const b of v.bulges) {
      const d = s - b;
      w += CELL * 0.24 * Math.exp(-(d * d) / 0.3);
    }
    return w * hatch;
  };
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const outline = v.ghost ? '#3f6470' : PAL.snakeOutline;
  const pieces: Array<[Pt, Pt, number]> = [];
  forEachPiece(pts, (a, b, sMid) => {
    if (sMid >= v.popped) pieces.push([a, b, sMid]);
  });

  for (const [a, b, s] of pieces) {
    stroke(ctx, a, b, width(s) + 4, outline);
  }
  for (const [a, b, s] of pieces) {
    const u = total > 0 ? s / total : 0;
    const base = mix(PAL.snakeHead, '#23864a', u * 0.9);
    const color = v.flash
      ? PAL.snakeFlash
      : v.ghost
        ? mix(base, GHOST_TINT, 0.62)
        : base;
    stroke(ctx, a, b, width(s), color);
  }
  // Dorsal stripe. After a coin it carries a hue sweep down the body.
  const shimmer = v.flash ? 0 : Math.min(1, v.rainbow);
  for (const [a, b, s] of pieces) {
    let color: string = v.flash ? '#ffffff' : (v.stripe ?? PAL.snakeStripe);
    if (shimmer > 0) {
      const hue = (((s * 34 - v.time * 300) % 360) + 360) % 360;
      color = mix(PAL.snakeStripe, hslHex(hue, 0.85, 0.66), shimmer);
    }
    const w = width(s) * (0.24 + shimmer * 0.14);
    stroke(ctx, a, b, Math.max(1.5, w), color);
  }
}

// ------------------------------------------------------------- head ----

function drawHead(
  ctx: CanvasRenderingContext2D,
  pts: Pt[],
  v: SnakeView
): void {
  const tip = toPx(pts[0]);
  const back = toPx(pointAlong(pts, 0.6));
  let angle = Math.atan2(tip.y - back.y, tip.x - back.x);
  if (tip.x === back.x && tip.y === back.y) {
    const n = toPx(pts[1]);
    angle = Math.atan2(tip.y - n.y, tip.x - n.x);
  }
  const hatch = Math.max(0.05, v.hatch);
  const bump = v.nose * CELL * 0.32;
  const cx = tip.x + Math.cos(angle) * bump;
  const cy = tip.y + Math.sin(angle) * bump;
  const sx = (1 - v.squash * 0.2 + v.nose * 0.12) * hatch;
  const sy = (1 + v.squash * 0.26 - v.nose * 0.1) * hatch;

  const L = CELL * 0.72;
  const B = CELL * 0.36;
  const H = CELL * 0.47;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  ctx.scale(sx, sy);

  // Tongue first, so the head sits over its root.
  if (v.tongue > 0) {
    const len = CELL * 0.45 * v.tongue;
    const fork = 3.5 * v.tongue;
    ctx.strokeStyle = PAL.tongue;
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(L * 0.85, 0);
    ctx.lineTo(L + len, 0);
    ctx.lineTo(L + len + fork, -fork * 0.8);
    ctx.moveTo(L + len, 0);
    ctx.lineTo(L + len + fork, fork * 0.8);
    ctx.stroke();
  }

  // A spade seen from above: widest just behind the eyes, a round snout.
  ctx.beginPath();
  ctx.moveTo(L, 0);
  ctx.bezierCurveTo(L, H * 0.55, L * 0.62, H, L * 0.1, H);
  ctx.bezierCurveTo(-B * 0.5, H, -B, H * 0.72, -B, 0);
  ctx.bezierCurveTo(-B, -H * 0.72, -B * 0.5, -H, L * 0.1, -H);
  ctx.bezierCurveTo(L * 0.62, -H, L, -H * 0.55, L, 0);
  ctx.closePath();
  ctx.fillStyle = v.flash
    ? PAL.snakeFlash
    : v.ghost
      ? mix(PAL.snakeHead, GHOST_TINT, 0.62)
      : PAL.snakeHead;
  ctx.fill();
  ctx.strokeStyle = PAL.snakeOutline;
  ctx.lineWidth = 2;
  ctx.stroke();

  // The dorsal stripe ends in a diamond on the crown.
  ctx.fillStyle = v.flash ? '#ffffff' : PAL.snakeStripe;
  ctx.beginPath();
  ctx.moveTo(L * 0.3, 0);
  ctx.lineTo(-B * 0.1, H * 0.26);
  ctx.lineTo(-B * 0.75, 0);
  ctx.lineTo(-B * 0.1, -H * 0.26);
  ctx.closePath();
  ctx.fill();

  // Nostrils.
  ctx.fillStyle = PAL.snakeOutline;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(L * 0.8, side * H * 0.24, 1.1, 0, Math.PI * 2);
    ctx.fill();
  }

  // Eyes look ahead, or glance at `lookAt` (the hungry tell).
  let lx = 1;
  let ly = 0;
  if (v.lookAt) {
    const dx = v.lookAt.x - cx;
    const dy = v.lookAt.y - cy;
    const la = Math.atan2(dy, dx) - angle;
    lx = Math.cos(la);
    ly = Math.sin(la);
  }
  // Eyes on the sides of the head, pupils pushed toward the gaze.
  const er = CELL * 0.14;
  for (const side of [-1, 1]) {
    const ex = L * 0.22;
    const ey = side * H * 0.74;
    ctx.fillStyle = PAL.snakeOutline;
    ctx.beginPath();
    ctx.arc(ex, ey, er + 1.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PAL.eye;
    ctx.beginPath();
    ctx.arc(ex, ey, er, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PAL.pupil;
    ctx.beginPath();
    ctx.arc(
      ex + lx * er * 0.42,
      ey + ly * er * 0.42,
      er * 0.55,
      0,
      Math.PI * 2
    );
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.beginPath();
    ctx.arc(ex - er * 0.2, ey - er * 0.35, er * 0.22, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// ----------------------------------------------------------- helpers ----

/** Full width for 60% of the body, then a smooth taper to the tail. */
function taper(s: number, total: number): number {
  if (total <= 0) return 1;
  const u = s / total;
  if (u <= 0.6) return 1;
  const k = (u - 0.6) / 0.4;
  const smooth = k * k * (3 - 2 * k);
  return 1 - smooth * 0.5;
}

/** Walk the rope in half-cell pieces, reporting each piece's mid distance. */
function forEachPiece(
  pts: Pt[],
  fn: (a: Pt, b: Pt, sMid: number) => void
): void {
  let s = 0;
  for (let k = 0; k < pts.length - 1; k++) {
    const a = pts[k];
    const b = pts[k + 1];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len < 1e-4) continue;
    const parts = len > 0.6 ? 2 : 1;
    for (let i = 0; i < parts; i++) {
      const p0 = lerp(a, b, i / parts);
      const p1 = lerp(a, b, (i + 1) / parts);
      fn(toPx(p0), toPx(p1), s + (len * (i + 0.5)) / parts);
    }
    s += len;
  }
}

function ropeLength(pts: Pt[]): number {
  let s = 0;
  for (let k = 0; k < pts.length - 1; k++) {
    s += Math.hypot(pts[k + 1].x - pts[k].x, pts[k + 1].y - pts[k].y);
  }
  return s;
}

/** The point `dist` cells back along the rope from the head end. */
function pointAlong(pts: Pt[], dist: number): Pt {
  let left = dist;
  for (let k = 0; k < pts.length - 1; k++) {
    const a = pts[k];
    const b = pts[k + 1];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len >= left && len > 0) return lerp(a, b, left / len);
    left -= len;
  }
  return pts[pts.length - 1];
}

function stroke(
  ctx: CanvasRenderingContext2D,
  a: Pt,
  b: Pt,
  width: number,
  color: string
): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(0.5, width);
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
}

function lerp(a: Pt, b: Pt, t: number): Pt {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

function toPx(p: Pt): Pt {
  return { x: BOARD_X + (p.x + 0.5) * CELL, y: BOARD_Y + (p.y + 0.5) * CELL };
}

function wrapPt(p: Pt): Pt {
  return {
    x: ((p.x % COLS) + COLS) % COLS,
    y: ((p.y % ROWS) + ROWS) % ROWS,
  };
}

/** The copy of `c` (shifted by whole boards) closest to `ref`. */
function nearest(c: Cell, ref: Pt): Pt {
  let best: Pt = { x: c.x, y: c.y };
  let bestD = Infinity;
  for (const kx of [-1, 0, 1]) {
    for (const ky of [-1, 0, 1]) {
      const x = c.x + kx * COLS;
      const y = c.y + ky * ROWS;
      const d = Math.abs(x - ref.x) + Math.abs(y - ref.y);
      if (d < bestD) {
        bestD = d;
        best = { x, y };
      }
    }
  }
  return best;
}

/**
 * Which whole-board shifts to draw the rope at. Only a rope unwrapped past
 * an edge (WRAP) gets a second copy, so a head resting in the last column
 * never pokes through to the far side.
 */
function wrapOffsets(pts: Pt[]): Array<[number, number]> {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of pts) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  const xs = [0];
  if (minX < 0) xs.push(1);
  if (maxX > COLS - 1) xs.push(-1);
  const ys = [0];
  if (minY < 0) ys.push(1);
  if (maxY > ROWS - 1) ys.push(-1);
  const out: Array<[number, number]> = [];
  for (const kx of xs) for (const ky of ys) out.push([kx, ky]);
  return out;
}

function polyline(
  ctx: CanvasRenderingContext2D,
  pts: Pt[],
  width: number,
  color: string
): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  pts.forEach((p, i) =>
    i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)
  );
  ctx.stroke();
}

/** hsl (h in degrees, s and l 0..1) to '#rrggbb', so it can be mixed. */
function hslHex(h: number, s: number, l: number): string {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number): number => {
    const k = (n + h / 30) % 12;
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  const hex = (x: number): string =>
    Math.round(x * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${hex(f(0))}${hex(f(8))}${hex(f(4))}`;
}
