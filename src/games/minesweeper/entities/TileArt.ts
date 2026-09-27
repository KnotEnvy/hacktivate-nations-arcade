// ===== src/games/minesweeper/entities/TileArt.ts =====
//
// Every piece of the field, drawn as vectors at any tile size: the enamel
// key, the charcoal plate, the numbers, the mine, the scorched plate a mine
// leaves, the pennant, and the bone face button. Each function draws one
// thing at an absolute position and leaves the context as it found it, so
// the same art can be baked into the tile cache or drawn live on top of it.

import { UI, monoFont, roundRectPath } from '@/games/shared/hud/canvasUi';
import { FIELD, NUMBER_COLORS } from '../systems/palette';

export type KeyState = 'idle' | 'hover' | 'pressed';
export type Mood = 'idle' | 'tense' | 'dead' | 'cool';

/** Small deterministic hash so each tile's speckle and cracks are stable. */
export function hash(n: number): number {
  let x = (n | 0) ^ 0x9e3779b9;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

/** An unrevealed tile: a raised enamel key on the plate. */
export function drawKey(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  s: number,
  state: KeyState,
  seed: number
): void {
  const inset = 1;
  const r = Math.max(2, s * 0.12);
  const kx = x + inset;
  const ky = y + inset;
  const ks = s - inset * 2;

  ctx.save();
  const g = ctx.createLinearGradient(kx, ky, kx, ky + ks);
  if (state === 'pressed') {
    g.addColorStop(0, FIELD.pressedTop);
    g.addColorStop(1, FIELD.pressed);
  } else if (state === 'hover') {
    g.addColorStop(0, FIELD.hoverTop);
    g.addColorStop(1, FIELD.hover);
  } else {
    g.addColorStop(0, FIELD.tileTop);
    g.addColorStop(1, FIELD.tile);
  }
  ctx.fillStyle = g;
  roundRectPath(ctx, kx, ky, ks, ks, r);
  ctx.fill();

  ctx.lineWidth = 1;
  if (state === 'pressed') {
    // Pushed into the plate: the light edge is gone and the top-left edge
    // now casts the shadow.
    ctx.strokeStyle = 'rgba(8, 30, 27, 0.7)';
    ctx.beginPath();
    ctx.moveTo(kx + 0.5, ky + ks - r);
    ctx.lineTo(kx + 0.5, ky + 0.5 + r * 0.4);
    ctx.lineTo(kx + ks - r, ky + 0.5);
    ctx.stroke();
  } else {
    // A 2px lip along the bottom gives the key its height.
    ctx.fillStyle = FIELD.tileLip;
    ctx.fillRect(kx + r * 0.6, ky + ks - 2, ks - r * 1.2, 2);
    ctx.strokeStyle = FIELD.tileHi;
    ctx.globalAlpha = state === 'hover' ? 0.95 : 0.7;
    ctx.beginPath();
    ctx.moveTo(kx + 0.5, ky + ks - r);
    ctx.lineTo(kx + 0.5, ky + r);
    ctx.quadraticCurveTo(kx + 0.5, ky + 0.5, kx + r, ky + 0.5);
    ctx.lineTo(kx + ks - r, ky + 0.5);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = FIELD.tileLo;
    ctx.beginPath();
    ctx.moveTo(kx + ks - 0.5, ky + r);
    ctx.lineTo(kx + ks - 0.5, ky + ks - r);
    ctx.quadraticCurveTo(
      kx + ks - 0.5,
      ky + ks - 0.5,
      kx + ks - r,
      ky + ks - 0.5
    );
    ctx.lineTo(kx + r, ky + ks - 0.5);
    ctx.stroke();

    // A very light speckle, so a field of keys reads as enamel, not flat.
    for (let i = 0; i < 5; i++) {
      const hx = hash(seed * 31 + i * 7);
      const hy = hash(seed * 17 + i * 13 + 5);
      ctx.fillStyle =
        i % 2 === 0 ? 'rgba(255, 255, 255, 0.07)' : 'rgba(0, 0, 0, 0.08)';
      ctx.fillRect(
        Math.floor(kx + 3 + hx * (ks - 6)),
        Math.floor(ky + 3 + hy * (ks - 7)),
        1,
        1
      );
    }
  }
  ctx.restore();
}

/** A revealed tile: the warm charcoal plate, sunken below the keys. */
export function drawPlate(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  s: number
): void {
  ctx.fillStyle = FIELD.plate;
  ctx.fillRect(x, y, s, s);
  ctx.fillStyle = FIELD.plateShade;
  ctx.fillRect(x, y, s, 1);
  ctx.fillRect(x, y + 1, 1, s - 1);
  ctx.fillStyle = FIELD.plateLight;
  ctx.fillRect(x + 1, y + s - 2, s - 2, 1);
  ctx.fillStyle = FIELD.plateLine;
  ctx.fillRect(x + s - 1, y, 1, s);
  ctx.fillRect(x, y + s - 1, s, 1);
}

/** The count of neighbouring mines, crisp mono, no glow. */
export function drawNumber(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  s: number,
  n: number
): void {
  if (n <= 0) return;
  ctx.save();
  ctx.font = monoFont(Math.round(s * 0.62), 800);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = NUMBER_COLORS[n] ?? UI.ink;
  ctx.fillText(String(n), x + s / 2, y + s / 2 + s * 0.04);
  ctx.restore();
}

/** A sea mine: spiked iron sphere with a hard highlight. */
export function drawMine(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number
): void {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = FIELD.iron;
  ctx.lineWidth = Math.max(1.5, r * 0.3);
  for (let i = 0; i < 8; i++) {
    const a = (Math.PI / 4) * i;
    const len = i % 2 === 0 ? r * 1.58 : r * 1.32;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(a) * len, cy + Math.sin(a) * len);
    ctx.stroke();
  }
  const g = ctx.createRadialGradient(
    cx - r * 0.35,
    cy - r * 0.4,
    r * 0.1,
    cx,
    cy,
    r
  );
  g.addColorStop(0, FIELD.ironHi);
  g.addColorStop(0.45, FIELD.ironMid);
  g.addColorStop(1, FIELD.iron);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  // A cool rim so dark iron still reads on the dark plate.
  ctx.strokeStyle = 'rgba(190, 214, 222, 0.35)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
  ctx.beginPath();
  ctx.ellipse(
    cx - r * 0.36,
    cy - r * 0.4,
    r * 0.22,
    r * 0.13,
    -0.6,
    0,
    Math.PI * 2
  );
  ctx.fill();
  ctx.restore();
}

/** A plate a mine went off on in the shockwave: sooted, faintly warm. */
export function drawBurntPlate(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  s: number
): void {
  drawPlate(ctx, x, y, s);
  const g = ctx.createRadialGradient(
    x + s / 2,
    y + s / 2,
    s * 0.1,
    x + s / 2,
    y + s / 2,
    s * 0.62
  );
  g.addColorStop(0, 'rgba(120, 72, 58, 0.55)');
  g.addColorStop(1, 'rgba(120, 72, 58, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(x + 1, y + 1, s - 2, s - 2);
}

/** The plate under the mine that went off: burned, cracked, glowing red. */
export function drawScorch(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  s: number,
  seed: number
): void {
  ctx.save();
  ctx.fillStyle = FIELD.scorch;
  ctx.fillRect(x, y, s, s);
  const g = ctx.createRadialGradient(
    x + s / 2,
    y + s / 2,
    s * 0.05,
    x + s / 2,
    y + s / 2,
    s * 0.7
  );
  g.addColorStop(0, 'rgba(248, 113, 113, 0.75)');
  g.addColorStop(0.55, 'rgba(179, 74, 74, 0.35)');
  g.addColorStop(1, 'rgba(179, 74, 74, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(x, y, s, s);

  ctx.strokeStyle = FIELD.crack;
  ctx.lineWidth = Math.max(1, s * 0.035);
  ctx.lineJoin = 'round';
  for (let i = 0; i < 5; i++) {
    const a = (Math.PI * 2 * i) / 5 + hash(seed + i) * 0.8;
    let px = x + s / 2;
    let py = y + s / 2;
    ctx.beginPath();
    ctx.moveTo(px, py);
    for (let k = 1; k <= 3; k++) {
      const jitter = (hash(seed * 7 + i * 11 + k) - 0.5) * 0.9;
      const len = (s * 0.52 * k) / 3;
      px = x + s / 2 + Math.cos(a + jitter) * len;
      py = y + s / 2 + Math.sin(a + jitter) * len;
      ctx.lineTo(px, py);
    }
    ctx.stroke();
  }
  ctx.fillStyle = FIELD.plateLine;
  ctx.fillRect(x + s - 1, y, 1, s);
  ctx.fillRect(x, y + s - 1, s, 1);
  ctx.restore();
}

/**
 * The pennant: a steel pole on a stake foot, carrying a swallowtail of
 * flagging tape. `grow` scales the pole and cloth up from the foot, and may
 * overshoot 1 while it plants.
 */
export function drawFlag(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  s: number,
  grow = 1,
  alpha = 1
): void {
  if (grow <= 0 || alpha <= 0) return;
  const footY = y + s * 0.8;
  const poleX = x + s * 0.4;
  const poleW = Math.max(1.5, s * 0.07);
  const top = y + s * 0.14;

  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.fillStyle = FIELD.stake;
  roundRectPath(ctx, x + s * 0.24, footY - s * 0.02, s * 0.36, s * 0.09, 1.5);
  ctx.fill();

  ctx.translate(poleX, footY);
  ctx.scale(1, grow);
  ctx.translate(-poleX, -footY);

  ctx.fillStyle = FIELD.poleShade;
  ctx.fillRect(poleX - poleW / 2, top, poleW, footY - top);
  ctx.fillStyle = FIELD.pole;
  ctx.fillRect(poleX - poleW / 2, top, poleW * 0.55, footY - top);

  const cw = s * 0.44;
  const ch = s * 0.32;
  const px = poleX + poleW / 2;
  const g = ctx.createLinearGradient(px, top, px, top + ch);
  g.addColorStop(0, FIELD.tape);
  g.addColorStop(1, FIELD.tapeDeep);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(px, top);
  ctx.lineTo(px + cw, top + ch * 0.06);
  ctx.lineTo(px + cw * 0.7, top + ch * 0.52);
  ctx.lineTo(px + cw, top + ch);
  ctx.lineTo(px, top + ch * 0.92);
  ctx.closePath();
  ctx.fill();
  // A fold line across the tape, so it reads as cloth and not a triangle.
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(px + 1, top + ch * 0.3);
  ctx.lineTo(px + cw * 0.62, top + ch * 0.36);
  ctx.stroke();

  ctx.fillStyle = FIELD.pole;
  ctx.beginPath();
  ctx.arc(poleX, top, poleW * 0.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** The cross over a flag that turned out to be wrong. */
export function drawWrongMark(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  s: number,
  t = 1
): void {
  const k = Math.max(0, Math.min(1, t));
  const m = s * 0.22;
  ctx.save();
  ctx.strokeStyle = UI.bad;
  ctx.lineWidth = Math.max(2, s * 0.09);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x + m, y + m);
  ctx.lineTo(x + m + (s - 2 * m) * k, y + m + (s - 2 * m) * k);
  if (k > 0.5) {
    const k2 = (k - 0.5) * 2;
    ctx.moveTo(x + s - m, y + m);
    ctx.lineTo(x + s - m - (s - 2 * m) * k2, y + m + (s - 2 * m) * k2);
  }
  ctx.stroke();
  ctx.restore();
}

/** A pennant glyph for chrome (the flag-mode switch, the ready card). */
export function pennantIcon(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  color: string = FIELD.tape
): void {
  const h = size;
  const x = cx - size * 0.3;
  const top = cy - h / 2;
  ctx.save();
  ctx.fillStyle = FIELD.pole;
  ctx.fillRect(x, top, 1.5, h);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x + 1.5, top);
  ctx.lineTo(x + 1.5 + size * 0.62, top + h * 0.05);
  ctx.lineTo(x + 1.5 + size * 0.44, top + h * 0.3);
  ctx.lineTo(x + 1.5 + size * 0.62, top + h * 0.56);
  ctx.lineTo(x + 1.5, top + h * 0.52);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/**
 * The face button: a bone enamel disc in a slate bezel, the one piece of
 * the old cabinet every player looks for. It tells the state of the run.
 */
export function drawFace(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  mood: Mood,
  pressed: boolean
): void {
  ctx.save();
  ctx.fillStyle = '#0d1215';
  ctx.beginPath();
  ctx.arc(cx, cy, r + 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = FIELD.housingEdge;
  ctx.lineWidth = 1;
  ctx.stroke();

  const y = cy + (pressed ? 1.5 : 0);
  if (!pressed) {
    ctx.fillStyle = FIELD.boneDeep;
    ctx.beginPath();
    ctx.arc(cx, y + 1.5, r, 0, Math.PI * 2);
    ctx.fill();
  }
  const g = ctx.createRadialGradient(
    cx - r * 0.35,
    y - r * 0.45,
    r * 0.1,
    cx,
    y,
    r
  );
  g.addColorStop(0, pressed ? '#e4dccb' : '#fbf7ee');
  g.addColorStop(0.7, pressed ? FIELD.boneShade : FIELD.bone);
  g.addColorStop(1, FIELD.boneShade);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, y, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = FIELD.faceInk;
  ctx.fillStyle = FIELD.faceInk;
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(1.5, r * 0.11);
  const ex = r * 0.34;
  const ey = y - r * 0.16;

  if (mood === 'idle') {
    for (const sx of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(cx + sx * ex, ey, r * 0.1, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(cx, y + r * 0.02, r * 0.46, 0.22 * Math.PI, 0.78 * Math.PI);
    ctx.stroke();
  } else if (mood === 'tense') {
    ctx.lineWidth = Math.max(1.2, r * 0.08);
    for (const sx of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(cx + sx * ex, ey, r * 0.14, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(cx, y + r * 0.4, r * 0.15, 0, Math.PI * 2);
    ctx.stroke();
  } else if (mood === 'dead') {
    const d = r * 0.13;
    for (const sx of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx + sx * ex - d, ey - d);
      ctx.lineTo(cx + sx * ex + d, ey + d);
      ctx.moveTo(cx + sx * ex + d, ey - d);
      ctx.lineTo(cx + sx * ex - d, ey + d);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.34, y + r * 0.44);
    ctx.quadraticCurveTo(cx - r * 0.17, y + r * 0.32, cx, y + r * 0.44);
    ctx.quadraticCurveTo(
      cx + r * 0.17,
      y + r * 0.56,
      cx + r * 0.34,
      y + r * 0.44
    );
    ctx.stroke();
  } else {
    // Cool: survey shades and a lopsided grin.
    const lw = r * 0.46;
    const lh = r * 0.3;
    for (const sx of [-1, 1]) {
      roundRectPath(ctx, cx + sx * ex - lw / 2, ey - lh / 2, lw, lh, lh * 0.45);
      ctx.fill();
    }
    ctx.fillRect(
      cx - ex + lw / 2 - 1,
      ey - lh * 0.3,
      2 * ex - lw + 2,
      lh * 0.22
    );
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.fillRect(cx - ex - lw * 0.3, ey - lh * 0.28, lw * 0.22, lh * 0.18);
    ctx.fillRect(cx + ex - lw * 0.3, ey - lh * 0.28, lw * 0.22, lh * 0.18);
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.3, y + r * 0.34);
    ctx.quadraticCurveTo(
      cx + r * 0.05,
      y + r * 0.62,
      cx + r * 0.38,
      y + r * 0.24
    );
    ctx.stroke();
  }
  ctx.restore();
}
