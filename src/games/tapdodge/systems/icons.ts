// ===== src/games/tapdodge/systems/icons.ts =====
//
// Tap Dodge draws like highway signage: plates with two chamfered corners
// (top-left and bottom-right), a strip of reflective accent along the top,
// and chevrons as the one recurring glyph. Every icon the game shows — on a
// power-up capsule, a HUD chip, a recap tile — is a stroked vector here, so
// nothing depends on an emoji font.

import { UI } from '@/games/shared/hud/canvasUi';
import { GEM } from './palette';

/** The signage plate outline: top-left and bottom-right corners cut. */
export function platePath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  cut = 8
): void {
  const c = Math.max(0, Math.min(cut, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + c, y);
  ctx.lineTo(x + w, y);
  ctx.lineTo(x + w, y + h - c);
  ctx.lineTo(x + w - c, y + h);
  ctx.lineTo(x, y + h);
  ctx.lineTo(x, y + c);
  ctx.closePath();
}

export interface PlateStyle {
  fill?: string;
  /** Reflective strip along the top edge, or null for none. */
  strip?: string | null;
  cut?: number;
  border?: string;
}

/** A signage plate: dark face, hairline border, optional accent strip. */
export function plate(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  style: PlateStyle = {}
): void {
  const cut = style.cut ?? 8;
  ctx.save();
  platePath(ctx, x, y, w, h, cut);
  ctx.fillStyle = style.fill ?? 'rgba(8, 11, 22, 0.92)';
  ctx.fill();
  ctx.strokeStyle = style.border ?? UI.line;
  ctx.lineWidth = 1;
  ctx.stroke();
  if (style.strip) {
    ctx.fillStyle = style.strip;
    ctx.fillRect(x + cut + 2, y, w - cut - 2, 2);
  }
  ctx.restore();
}

export type Dir = 'up' | 'down' | 'left' | 'right';

/** One open chevron, stroked, pointing `dir`, fitted in a `size` box. */
export function chevron(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  dir: Dir,
  lineWidth = 2
): void {
  const h = size / 2;
  const q = size / 4;
  ctx.beginPath();
  if (dir === 'up') {
    ctx.moveTo(cx - h, cy + q);
    ctx.lineTo(cx, cy - q);
    ctx.lineTo(cx + h, cy + q);
  } else if (dir === 'down') {
    ctx.moveTo(cx - h, cy - q);
    ctx.lineTo(cx, cy + q);
    ctx.lineTo(cx + h, cy - q);
  } else if (dir === 'left') {
    ctx.moveTo(cx + q, cy - h);
    ctx.lineTo(cx - q, cy);
    ctx.lineTo(cx + q, cy + h);
  } else {
    ctx.moveTo(cx - q, cy - h);
    ctx.lineTo(cx + q, cy);
    ctx.lineTo(cx - q, cy + h);
  }
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();
}

/** Two stacked chevrons: the game's "move this way" mark. */
export function chevronPair(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  dir: Dir,
  lineWidth = 2
): void {
  const off = size * 0.32;
  const vertical = dir === 'up' || dir === 'down';
  const lead = dir === 'up' || dir === 'left' ? -1 : 1;
  const dx = vertical ? 0 : off * lead;
  const dy = vertical ? off * lead : 0;
  chevron(ctx, cx - dx / 2, cy - dy / 2, size, dir, lineWidth);
  chevron(ctx, cx + dx / 2, cy + dy / 2, size, dir, lineWidth);
}

/** The ship's wedge silhouette, nose up, centred on (cx, cy). */
export function wedgePath(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  w: number,
  h: number
): void {
  ctx.beginPath();
  ctx.moveTo(cx, cy - h / 2);
  ctx.lineTo(cx + w / 2, cy + h / 2);
  ctx.lineTo(cx + w * 0.16, cy + h * 0.32);
  ctx.lineTo(cx - w * 0.16, cy + h * 0.32);
  ctx.lineTo(cx - w / 2, cy + h / 2);
  ctx.closePath();
}

export type IconName =
  | 'shield'
  | 'magnet'
  | 'slow'
  | 'ghost'
  | 'drone'
  | 'clock'
  | 'close'
  | 'chain'
  | 'coin'
  | 'gem'
  | 'fever'
  | 'zone'
  | 'rush';

/**
 * Draw icon `name` centred on (x, y) inside a `size` box, stroked in
 * `color`. The coin is the one filled icon, and it is always amber.
 */
export function icon(
  ctx: CanvasRenderingContext2D,
  name: IconName,
  x: number,
  y: number,
  size: number,
  color: string
): void {
  const s = size / 2;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = Math.max(1.25, size / 10);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  switch (name) {
    case 'shield':
      ctx.beginPath();
      ctx.moveTo(x, y - s);
      ctx.lineTo(x + s * 0.85, y - s * 0.6);
      ctx.lineTo(x + s * 0.7, y + s * 0.3);
      ctx.lineTo(x, y + s);
      ctx.lineTo(x - s * 0.7, y + s * 0.3);
      ctx.lineTo(x - s * 0.85, y - s * 0.6);
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, y - s * 0.55);
      ctx.lineTo(x, y + s * 0.55);
      ctx.stroke();
      break;
    case 'magnet':
      ctx.beginPath();
      ctx.arc(x, y - s * 0.05, s * 0.6, Math.PI, 0, true);
      ctx.moveTo(x + s * 0.6, y - s * 0.05);
      ctx.lineTo(x + s * 0.6, y + s * 0.85);
      ctx.moveTo(x - s * 0.6, y - s * 0.05);
      ctx.lineTo(x - s * 0.6, y + s * 0.85);
      ctx.stroke();
      ctx.fillRect(x - s * 0.8, y + s * 0.55, s * 0.4, s * 0.35);
      ctx.fillRect(x + s * 0.4, y + s * 0.55, s * 0.4, s * 0.35);
      break;
    case 'slow':
      ctx.beginPath();
      ctx.moveTo(x - s * 0.7, y - s);
      ctx.lineTo(x + s * 0.7, y - s);
      ctx.moveTo(x - s * 0.7, y + s);
      ctx.lineTo(x + s * 0.7, y + s);
      ctx.moveTo(x - s * 0.55, y - s);
      ctx.lineTo(x + s * 0.55, y + s);
      ctx.moveTo(x + s * 0.55, y - s);
      ctx.lineTo(x - s * 0.55, y + s);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - s * 0.3, y + s * 0.8);
      ctx.lineTo(x + s * 0.3, y + s * 0.8);
      ctx.lineTo(x, y + s * 0.35);
      ctx.closePath();
      ctx.fill();
      break;
    case 'ghost':
      ctx.beginPath();
      ctx.moveTo(x - s * 0.7, y + s * 0.9);
      ctx.lineTo(x - s * 0.7, y - s * 0.1);
      ctx.arc(x, y - s * 0.1, s * 0.7, Math.PI, 0);
      ctx.lineTo(x + s * 0.7, y + s * 0.9);
      ctx.lineTo(x + s * 0.35, y + s * 0.6);
      ctx.lineTo(x, y + s * 0.9);
      ctx.lineTo(x - s * 0.35, y + s * 0.6);
      ctx.closePath();
      ctx.stroke();
      ctx.fillRect(x - s * 0.35, y - s * 0.25, s * 0.2, s * 0.3);
      ctx.fillRect(x + s * 0.15, y - s * 0.25, s * 0.2, s * 0.3);
      break;
    case 'drone':
      ctx.strokeRect(x - s * 0.35, y - s * 0.25, s * 0.7, s * 0.5);
      ctx.beginPath();
      ctx.moveTo(x - s * 0.35, y);
      ctx.lineTo(x - s * 0.7, y);
      ctx.moveTo(x + s * 0.35, y);
      ctx.lineTo(x + s * 0.7, y);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(
        x - s * 0.7,
        y - s * 0.3,
        s * 0.3,
        s * 0.12,
        0,
        0,
        Math.PI * 2
      );
      ctx.moveTo(x + s, y - s * 0.3);
      ctx.ellipse(
        x + s * 0.7,
        y - s * 0.3,
        s * 0.3,
        s * 0.12,
        0,
        0,
        Math.PI * 2
      );
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, y - s * 0.25);
      ctx.lineTo(x, y - s);
      ctx.stroke();
      break;
    case 'clock':
      ctx.beginPath();
      ctx.arc(x, y + s * 0.1, s * 0.8, 0, Math.PI * 2);
      ctx.moveTo(x, y + s * 0.1);
      ctx.lineTo(x, y - s * 0.4);
      ctx.moveTo(x, y + s * 0.1);
      ctx.lineTo(x + s * 0.35, y + s * 0.3);
      ctx.moveTo(x - s * 0.25, y - s * 0.95);
      ctx.lineTo(x + s * 0.25, y - s * 0.95);
      ctx.stroke();
      break;
    case 'close':
      // A block edge, and a wedge passing it with a hair to spare.
      ctx.strokeRect(x - s * 0.9, y - s * 0.9, s * 0.8, s * 1.8);
      ctx.beginPath();
      ctx.moveTo(x + s * 0.25, y + s * 0.9);
      ctx.lineTo(x + s * 0.55, y - s * 0.6);
      ctx.lineTo(x + s * 0.85, y + s * 0.9);
      ctx.closePath();
      ctx.fill();
      break;
    case 'chain':
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(-Math.PI / 4);
      for (const off of [-s * 0.38, s * 0.38]) {
        ctx.beginPath();
        ctx.ellipse(off, 0, s * 0.55, s * 0.3, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
      break;
    case 'coin':
      ctx.fillStyle = UI.coin;
      ctx.beginPath();
      ctx.arc(x, y, s * 0.85, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.beginPath();
      ctx.arc(x, y, s * 0.45, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'gem':
      gemPath(ctx, x, y, size * 0.95);
      ctx.fillStyle = GEM.base;
      ctx.fill();
      ctx.strokeStyle = GEM.light;
      ctx.lineWidth = 1;
      ctx.stroke();
      break;
    case 'fever':
      ctx.beginPath();
      ctx.arc(x, y + s * 0.35, s * 0.85, Math.PI, 0);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, y + s * 0.35);
      ctx.lineTo(x + s * 0.5, y - s * 0.25);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, y + s * 0.35, s * 0.14, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'zone':
      ctx.beginPath();
      ctx.moveTo(x - s * 0.35, y - s);
      ctx.lineTo(x - s * 0.9, y + s);
      ctx.moveTo(x + s * 0.35, y - s);
      ctx.lineTo(x + s * 0.9, y + s);
      ctx.stroke();
      ctx.setLineDash([s * 0.35, s * 0.3]);
      ctx.beginPath();
      ctx.moveTo(x, y - s);
      ctx.lineTo(x, y + s);
      ctx.stroke();
      ctx.setLineDash([]);
      break;
    case 'rush':
      chevronPair(ctx, x, y, size * 0.8, 'up', ctx.lineWidth);
      break;
  }
  ctx.restore();
}

/** A brilliant-cut diamond outline, table up, point down. */
export function gemPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number
): void {
  const s = size / 2;
  ctx.beginPath();
  ctx.moveTo(x - s * 0.45, y - s * 0.7);
  ctx.lineTo(x + s * 0.45, y - s * 0.7);
  ctx.lineTo(x + s, y - s * 0.2);
  ctx.lineTo(x, y + s);
  ctx.lineTo(x - s, y - s * 0.2);
  ctx.closePath();
}
