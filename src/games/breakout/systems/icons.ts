// Floodlight's icon set: 2px strokes, square ends, drawn on a unit box so
// the same glyph works on a 17px capsule and in an 16px HUD tag. No text,
// no emoji.

import type { PowerType } from '../entities/types';

/** Draw the icon for `type` centred on (x, y), fitting a `s`-px box. */
export function powerIcon(
  ctx: CanvasRenderingContext2D,
  type: PowerType,
  x: number,
  y: number,
  s: number,
  color: string
): void {
  const h = s / 2;
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = Math.max(1.4, s * 0.14);
  ctx.lineCap = 'square';
  ctx.lineJoin = 'miter';
  ctx.beginPath();
  switch (type) {
    case 'widen': {
      // A bar with arrowheads pushing out both ends.
      ctx.moveTo(-h * 0.55, 0);
      ctx.lineTo(h * 0.55, 0);
      ctx.moveTo(-h * 0.55, -h * 0.5);
      ctx.lineTo(-h, 0);
      ctx.lineTo(-h * 0.55, h * 0.5);
      ctx.moveTo(h * 0.55, -h * 0.5);
      ctx.lineTo(h, 0);
      ctx.lineTo(h * 0.55, h * 0.5);
      ctx.stroke();
      break;
    }
    case 'multi': {
      // Three balls in a triangle.
      const r = s * 0.17;
      for (const [dx, dy] of [
        [0, -h * 0.5],
        [-h * 0.58, h * 0.45],
        [h * 0.58, h * 0.45],
      ]) {
        ctx.moveTo(dx + r, dy);
        ctx.arc(dx, dy, r, 0, Math.PI * 2);
      }
      ctx.fill();
      break;
    }
    case 'slow': {
      // Hourglass.
      ctx.moveTo(-h * 0.6, -h * 0.85);
      ctx.lineTo(h * 0.6, -h * 0.85);
      ctx.lineTo(-h * 0.6, h * 0.85);
      ctx.lineTo(h * 0.6, h * 0.85);
      ctx.closePath();
      ctx.stroke();
      break;
    }
    case 'life': {
      // A spare paddle with a plus over it.
      ctx.moveTo(-h * 0.85, h * 0.62);
      ctx.lineTo(h * 0.85, h * 0.62);
      ctx.moveTo(0, -h * 0.9);
      ctx.lineTo(0, h * 0.05);
      ctx.moveTo(-h * 0.45, -h * 0.42);
      ctx.lineTo(h * 0.45, -h * 0.42);
      ctx.stroke();
      break;
    }
    case 'catch': {
      // A cup: the ball sits in it.
      ctx.moveTo(-h * 0.85, -h * 0.2);
      ctx.lineTo(-h * 0.85, h * 0.7);
      ctx.lineTo(h * 0.85, h * 0.7);
      ctx.lineTo(h * 0.85, -h * 0.2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, h * 0.05, s * 0.17, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'blast': {
      // Eight-point burst.
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2 - Math.PI / 2;
        const r = i % 2 === 0 ? h : h * 0.42;
        if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fill();
      break;
    }
  }
  ctx.restore();
}

/** A spare paddle: how the scorebug counts serves. */
export function servePip(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  filled: boolean,
  color: string,
  hollow: string
): void {
  const r = h / 2;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arc(x + w - r, y + r, r, -Math.PI / 2, Math.PI / 2);
  ctx.lineTo(x + r, y + h);
  ctx.arc(x + r, y + r, r, Math.PI / 2, (Math.PI * 3) / 2);
  ctx.closePath();
  if (filled) {
    ctx.fillStyle = color;
    ctx.fill();
  } else {
    ctx.strokeStyle = hollow;
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }
}

/** A '/'-leaning parallelogram — the house shape of every Floodlight panel. */
export function slantPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  skew: number
): void {
  ctx.beginPath();
  ctx.moveTo(x + skew, y);
  ctx.lineTo(x + w + skew, y);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x, y + h);
  ctx.closePath();
}
