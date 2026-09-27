// ===== src/games/snake/entities/icons.ts =====
//
// Mosslight's glyphs, drawn as vectors so they stay crisp at any size and
// carry no emoji. The same icon is drawn on the board token and in the
// power-up pod, so the player learns one picture per power.

import { PAL } from '../constants';
import type { SnakePowerUpType } from './PowerUp';

/** Draw the icon for `type` inside a circle of radius `r`. */
export function drawPowerUpIcon(
  ctx: CanvasRenderingContext2D,
  type: SnakePowerUpType,
  cx: number,
  cy: number,
  r: number,
  ink: string
): void {
  ctx.save();
  ctx.strokeStyle = ink;
  ctx.fillStyle = ink;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  switch (type) {
    case 'wrap':
      drawWrap(ctx, cx, cy, r);
      break;
    case 'slow':
      drawSnowflake(ctx, cx, cy, r);
      break;
    case 'double':
      drawTwoDots(ctx, cx, cy, r);
      break;
    case 'magnet':
      drawMagnet(ctx, cx, cy, r);
      break;
    case 'ghost':
      drawGhost(ctx, cx, cy, r);
      break;
  }
  ctx.restore();
}

/** A ring with a gap and an arrowhead: out one side, in the other. */
function drawWrap(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number
): void {
  const R = r * 0.62;
  const a0 = -Math.PI / 2 + 0.7;
  const a1 = -Math.PI / 2 + Math.PI * 2 - 0.55;
  ctx.lineWidth = Math.max(1.5, r * 0.24);
  ctx.beginPath();
  ctx.arc(cx, cy, R, a0, a1);
  ctx.stroke();
  const px = cx + Math.cos(a1) * R;
  const py = cy + Math.sin(a1) * R;
  const tx = -Math.sin(a1);
  const ty = Math.cos(a1);
  const nx = Math.cos(a1);
  const ny = Math.sin(a1);
  const head = r * 0.36;
  ctx.beginPath();
  ctx.moveTo(px + tx * head, py + ty * head);
  ctx.lineTo(px + nx * head * 0.8, py + ny * head * 0.8);
  ctx.lineTo(px - nx * head * 0.8, py - ny * head * 0.8);
  ctx.closePath();
  ctx.fill();
}

function drawSnowflake(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number
): void {
  const L = r * 0.78;
  ctx.lineWidth = Math.max(1.2, r * 0.16);
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i - Math.PI / 2;
    const ex = cx + Math.cos(a) * L;
    const ey = cy + Math.sin(a) * L;
    ctx.moveTo(cx, cy);
    ctx.lineTo(ex, ey);
    // A small V on each spoke.
    const bx = cx + Math.cos(a) * L * 0.58;
    const by = cy + Math.sin(a) * L * 0.58;
    const tick = L * 0.28;
    for (const s of [-1, 1]) {
      const ta = a + s * 0.75;
      ctx.moveTo(bx, by);
      ctx.lineTo(bx + Math.cos(ta) * tick, by + Math.sin(ta) * tick);
    }
  }
  ctx.stroke();
}

function drawTwoDots(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number
): void {
  const d = r * 0.3;
  ctx.beginPath();
  ctx.arc(cx - r * 0.36, cy, d, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx + r * 0.36, cy, d, 0, Math.PI * 2);
  ctx.fill();
}

/** A U magnet, opening upward, with pale pole caps. */
function drawMagnet(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number
): void {
  const R = r * 0.44;
  const top = cy - r * 0.62;
  const mid = cy + r * 0.05;
  const w = r * 0.34;
  ctx.lineWidth = w;
  ctx.lineCap = 'butt';
  ctx.beginPath();
  ctx.moveTo(cx - R, top);
  ctx.lineTo(cx - R, mid);
  ctx.arc(cx, mid, R, Math.PI, 0, true);
  ctx.lineTo(cx + R, top);
  ctx.stroke();
  ctx.fillStyle = PAL.bone;
  const cap = r * 0.24;
  ctx.fillRect(cx - R - w / 2, top, w, cap);
  ctx.fillRect(cx + R - w / 2, top, w, cap);
}

/** A rounded ghost: dome, three scallops, two eye holes. */
function drawGhost(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number
): void {
  const w = r * 0.62;
  const top = cy - r * 0.72;
  const bottom = cy + r * 0.66;
  ctx.beginPath();
  ctx.moveTo(cx - w, bottom);
  ctx.lineTo(cx - w, top + w);
  ctx.arc(cx, top + w, w, Math.PI, 0);
  ctx.lineTo(cx + w, bottom);
  const scallop = (w * 2) / 3;
  for (let i = 0; i < 3; i++) {
    const x0 = cx + w - scallop * i;
    ctx.quadraticCurveTo(
      x0 - scallop / 2,
      bottom - r * 0.26,
      x0 - scallop,
      bottom
    );
  }
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(4, 20, 22, 0.9)';
  const ey = top + w * 0.95;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(cx + s * w * 0.4, ey, r * 0.1, r * 0.15, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

// --------------------------------------------------------------- eggs ----

function eggPath(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  h: number
): void {
  const rx = h * 0.37;
  const mid = cy + h * 0.08;
  ctx.beginPath();
  ctx.ellipse(cx, mid, rx, h * 0.58, 0, Math.PI, Math.PI * 2);
  ctx.ellipse(cx, mid, rx, h * 0.42, 0, 0, Math.PI);
  ctx.closePath();
}

/** The zig-zag a hatching crack follows across the egg's waist. */
function crackLine(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  h: number
): void {
  const rx = h * 0.37;
  const y = cy + h * 0.02;
  const teeth = 5;
  ctx.moveTo(cx - rx, y);
  for (let i = 1; i <= teeth; i++) {
    const x = cx - rx + ((rx * 2) / teeth) * i;
    ctx.lineTo(x, y + (i % 2 === 0 ? -1 : 1) * h * 0.09);
  }
}

/**
 * A life, drawn as an egg. `crack` runs 0..1 as the egg splits after a
 * lost life; at 1 it stays as an empty, split shell. `wobble` tilts it.
 */
export function drawEgg(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  h: number,
  alive: boolean,
  crack = 1,
  wobble = 0
): void {
  ctx.save();
  if (alive) {
    ctx.translate(cx, cy + h * 0.5);
    ctx.rotate(wobble);
    ctx.translate(-cx, -cy - h * 0.5);
    eggPath(ctx, cx, cy, h);
    ctx.fillStyle = PAL.egg;
    ctx.fill();
    // Shade on the lower right, clipped to the shell.
    ctx.save();
    ctx.clip();
    ctx.fillStyle = PAL.eggShade;
    ctx.beginPath();
    ctx.ellipse(
      cx + h * 0.22,
      cy + h * 0.3,
      h * 0.3,
      h * 0.4,
      0,
      0,
      Math.PI * 2
    );
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = PAL.eggSpeckle;
    for (const [dx, dy, s] of [
      [-0.12, -0.2, 0.05],
      [0.1, -0.05, 0.04],
      [-0.05, 0.16, 0.035],
    ]) {
      ctx.beginPath();
      ctx.arc(cx + dx * h, cy + dy * h, s * h, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    return;
  }

  // A spent egg: the two halves drift apart along the crack.
  const k = Math.max(0, Math.min(1, crack));
  const split = k * h * 0.14;
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = 'rgba(239, 233, 214, 0.28)';
  for (const half of [-1, 1]) {
    ctx.save();
    ctx.translate(0, half * split);
    ctx.beginPath();
    ctx.rect(
      cx - h,
      half < 0 ? cy - h : cy + h * 0.02,
      h * 2,
      h + (half < 0 ? h * 0.02 : 0)
    );
    ctx.clip();
    eggPath(ctx, cx, cy, h);
    ctx.stroke();
    ctx.beginPath();
    crackLine(ctx, cx, cy, h);
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}
