// ===== src/games/memory/systems/glyphs.ts =====
//
// The parlour's small drawn marks for the chrome: the rhombus ornament, an
// hourglass, an eye, an oil lamp, a keycap, a check badge. Vector shapes in
// the studio's line weight, never emoji.

import { roundRectPath } from '@/games/shared/hud/canvasUi';
import { flameCorePath, flamePath } from './icons';
import { P } from './palette';

export function rhombus(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  color: string
): void {
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.lineTo(x + r * 0.7, y);
  ctx.lineTo(x, y + r);
  ctx.lineTo(x - r * 0.7, y);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

/** Hourglass `h` px tall; `sand` 0..1 is how much is left in the top bulb. */
export function hourglass(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  h: number,
  sand: number,
  color: string
): void {
  const w = h * 0.66;
  const top = y - h / 2;
  const bot = y + h / 2;
  const k = Math.max(0, Math.min(1, sand));
  ctx.save();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x - w / 2, top);
  ctx.lineTo(x + w / 2, top);
  ctx.moveTo(x - w / 2, bot);
  ctx.lineTo(x + w / 2, bot);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - w * 0.38, top + 1);
  ctx.quadraticCurveTo(x - w * 0.38, y - 1, x - 1, y);
  ctx.quadraticCurveTo(x - w * 0.38, y + 1, x - w * 0.38, bot - 1);
  ctx.moveTo(x + w * 0.38, top + 1);
  ctx.quadraticCurveTo(x + w * 0.38, y - 1, x + 1, y);
  ctx.quadraticCurveTo(x + w * 0.38, y + 1, x + w * 0.38, bot - 1);
  ctx.stroke();
  // Sand: the top bulb drains from its surface, the bottom fills.
  ctx.fillStyle = color;
  const half = h / 2 - 2;
  if (k > 0.02) {
    const sh = half * k;
    ctx.beginPath();
    ctx.moveTo(x - w * 0.3 * k, y - sh);
    ctx.lineTo(x + w * 0.3 * k, y - sh);
    ctx.lineTo(x, y - 0.5);
    ctx.closePath();
    ctx.fill();
  }
  const bh = half * (1 - k);
  if (bh > 0.5) {
    ctx.beginPath();
    ctx.moveTo(x - w * 0.34, bot - 1);
    ctx.lineTo(x + w * 0.34, bot - 1);
    ctx.lineTo(x, bot - 1 - bh);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/** The streak mark: the flame from the card set, lit in the studio rose. */
export function flameMark(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  flicker: number
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(
    (size / 100) * (1 + flicker * 0.04),
    (size / 100) * (1 - flicker * 0.05)
  );
  flamePath(ctx);
  ctx.fillStyle = P.rose;
  ctx.fill();
  flameCorePath(ctx);
  ctx.fillStyle = P.ivory;
  ctx.fill();
  ctx.restore();
}

export function eye(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  color: string
): void {
  const h = w * 0.55;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(x - w / 2, y);
  ctx.quadraticCurveTo(x, y - h, x + w / 2, y);
  ctx.quadraticCurveTo(x, y + h, x - w / 2, y);
  ctx.closePath();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, y, h * 0.36, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** A small oil lamp: the studio's mark, used for HINT. */
export function lamp(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  s: number,
  color: string,
  lit: boolean
): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 1.6;
  ctx.lineJoin = 'round';
  // Body and base.
  ctx.beginPath();
  ctx.moveTo(x - s * 0.5, y + s * 0.15);
  ctx.quadraticCurveTo(x, y + s * 0.55, x + s * 0.5, y + s * 0.15);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(x - s * 0.28, y + s * 0.42, s * 0.56, s * 0.1);
  // Chimney.
  ctx.beginPath();
  ctx.moveTo(x - s * 0.16, y + s * 0.12);
  ctx.quadraticCurveTo(x - s * 0.34, y - s * 0.2, x - s * 0.12, y - s * 0.5);
  ctx.lineTo(x + s * 0.12, y - s * 0.5);
  ctx.quadraticCurveTo(x + s * 0.34, y - s * 0.2, x + s * 0.16, y + s * 0.12);
  ctx.stroke();
  if (lit) {
    ctx.beginPath();
    ctx.ellipse(x, y - s * 0.12, s * 0.07, s * 0.16, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function keycap(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string
): void {
  ctx.save();
  roundRectPath(ctx, x + 0.5, y + 0.5, w - 1, h - 1, 3);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x + 2, y + h - 2.5);
  ctx.lineTo(x + w - 2, y + h - 2.5);
  ctx.globalAlpha = 0.5;
  ctx.stroke();
  ctx.restore();
}

/** A left/right arrow drawn inside a keycap. */
export function arrowGlyph(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  dir: -1 | 1,
  color: string
): void {
  ctx.beginPath();
  ctx.moveTo(x + dir * 3.5, y);
  ctx.lineTo(x - dir * 2.5, y - 4);
  ctx.lineTo(x - dir * 2.5, y + 4);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

/** Emerald badge with an ivory tick, for a solved card. */
export function checkBadge(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number
): void {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = P.goodDim;
  ctx.fill();
  ctx.strokeStyle = 'rgba(244, 236, 220, 0.9)';
  ctx.lineWidth = Math.max(1.4, r * 0.28);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(x - r * 0.45, y + r * 0.02);
  ctx.lineTo(x - r * 0.1, y + r * 0.38);
  ctx.lineTo(x + r * 0.5, y - r * 0.35);
  ctx.stroke();
  ctx.restore();
}

/** Two overlapping card outlines: the CLASSIC mode's mark. */
export function cardPairMark(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  s: number,
  color: string
): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  for (const [dx, rot] of [
    [-s * 0.18, -0.2],
    [s * 0.18, 0.2],
  ]) {
    ctx.save();
    ctx.translate(x + dx, y);
    ctx.rotate(rot);
    roundRectPath(ctx, -s * 0.3, -s * 0.42, s * 0.6, s * 0.84, 2.5);
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}
