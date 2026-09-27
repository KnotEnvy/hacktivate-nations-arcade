// ===== src/games/snake/systems/HudRenderer.ts =====
//
// Every pixel of Snake's chrome. The platform's type (Orbitron numerals,
// Inter prose, JetBrains Mono values) and its two semantic colours (amber
// is currency, red is a problem) are shared with the arcade; everything
// else is Mosslight's own: a field-notebook strip across the top, eggs for
// lives, a feast ring for the combo, a ladder of scales for pace, seed-pod
// capsules for power-ups, and swallowtail ribbons for announcements.
//
// Layout, in bands (see constants.ts): the top 64px holds SCORE / BEST /
// coins on the left, LENGTH and PACE in the middle, FEAST and LIVES on the
// right. The bottom 44px holds the power-up pods on the left and one line
// of guidance on the right. The board between them is never drawn over,
// except by in-board cards and ribbons.

import {
  UI,
  coinGlyph,
  displayFont,
  ease,
  monoFont,
  roundRectPath,
  sansFont,
  trackedWidth,
  tracked,
  withAlpha,
} from '@/games/shared/hud/canvasUi';
import {
  BOARD_W,
  BOARD_X,
  BOARD_Y,
  BOTTOM_BAND_Y,
  EXPIRY_WARNING,
  PAL,
  READY_AUTO_START,
} from '../constants';
import { drawEgg, drawPowerUpIcon } from '../entities/icons';
import { drawApple } from '../entities/Food';
import { POWERUP_CONFIGS, SnakePowerUpType } from '../entities/PowerUp';
import { PACE_TIERS } from './Pace';

export interface HudPowerUp {
  type: SnakePowerUpType;
  left: number;
  max: number;
}

export interface HudState {
  score: number;
  best: number;
  pickups: number;
  length: number;
  paceTier: number;
  paceProgress: number;
  /** 0..1, just after a pace tier was crossed. */
  paceFlash: number;
  applesToNext: number | null;
  combo: number;
  comboMultiplier: number;
  /** 0..1 of the feast timer left. */
  comboLeft: number;
  /** 0..1, just after a feast milestone. */
  comboFlash: number;
  lives: number;
  maxLives: number;
  /** Seconds since the last life was lost (the egg splits over 0.6s). */
  lostAge: number;
  powerUps: HudPowerUp[];
  state: string;
  /** Seconds spent in the current state. */
  stateTime: number;
  time: number;
}

const RIGHT = BOARD_X + BOARD_W;

// ------------------------------------------------------------ top band ----

export function drawTopHud(ctx: CanvasRenderingContext2D, s: HudState): void {
  ctx.save();
  ctx.textBaseline = 'alphabetic';

  // SCORE, drawn in fixed digit cells so it never jitters as it ticks.
  label(ctx, 'SCORE', BOARD_X, 20);
  ctx.font = displayFont(25, 800);
  ctx.fillStyle = PAL.bone;
  digits(ctx, String(Math.floor(s.score)), BOARD_X, 51, 18);

  // BEST and coins taken this run.
  const bx = 170;
  label(ctx, 'BEST', bx, 20);
  ctx.font = monoFont(13, 700);
  ctx.fillStyle = s.score > s.best && s.best > 0 ? PAL.sprout : PAL.sage;
  ctx.textAlign = 'left';
  ctx.fillText(String(Math.max(s.best, 0)), bx, 36);
  coinGlyph(ctx, bx + 5, 48, 5);
  ctx.font = monoFont(12, 700);
  ctx.fillStyle = PAL.bone;
  ctx.fillText(`x${s.pickups}`, bx + 14, 52);

  // LENGTH.
  const lx = 282;
  label(ctx, 'LENGTH', lx, 20);
  ctx.font = displayFont(22, 800);
  ctx.fillStyle = PAL.bone;
  digits(ctx, String(s.length), lx, 50, 16);

  // PACE: a ladder of scales, the tier name, and progress to the next.
  const px = 362;
  label(ctx, 'PACE', px, 20);
  for (let i = 0; i < PACE_TIERS.length; i++) {
    const on = i <= s.paceTier;
    const pop = i === s.paceTier ? s.paceFlash : 0;
    scale(ctx, px + 6 + i * 14, 36, on, pop);
  }
  ctx.font = sansFont(12, 800);
  ctx.fillStyle = s.paceFlash > 0 ? mixFlash(s.paceFlash) : PAL.bone;
  ctx.textAlign = 'left';
  ctx.fillText(
    PACE_TIERS[s.paceTier].name,
    px + PACE_TIERS.length * 14 + 6,
    41
  );
  rail(ctx, px, 49, 166, s.paceProgress, PAL.tide);

  // FEAST: a ring that drains between bites.
  const fx = 590;
  const fy = 36;
  const live = s.combo > 1;
  ctx.lineWidth = 3;
  ctx.strokeStyle = withAlpha(PAL.sage, 0.18);
  ctx.beginPath();
  ctx.arc(fx, fy, 16, 0, Math.PI * 2);
  ctx.stroke();
  if (live) {
    ctx.strokeStyle = PAL.sprout;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(fx, fy, 16, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * s.comboLeft);
    ctx.stroke();
  }
  if (s.comboFlash > 0) {
    ctx.strokeStyle = withAlpha(PAL.sprout, s.comboFlash);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(fx, fy, 16 + (1 - s.comboFlash) * 10, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.textAlign = 'center';
  ctx.font = displayFont(13, 800);
  ctx.fillStyle = live ? PAL.bone : withAlpha(PAL.sage, 0.5);
  ctx.fillText(live ? String(s.combo) : '-', fx, fy + 5);
  label(ctx, 'FEAST', fx + 26, 20);
  ctx.textAlign = 'left';
  ctx.font = monoFont(15, 800);
  ctx.fillStyle = live ? PAL.sprout : withAlpha(PAL.sage, 0.5);
  ctx.fillText(`x${formatMult(live ? s.comboMultiplier : 1)}`, fx + 26, 44);

  // LIVES, as eggs. The one just lost splits open; the last one wobbles.
  label(ctx, 'LIVES', RIGHT, 20, 'right');
  for (let i = 0; i < s.maxLives; i++) {
    const cx = RIGHT - 8 - (s.maxLives - 1 - i) * 21;
    const alive = i < s.lives;
    const crack = i === s.lives ? Math.min(1, s.lostAge / 0.6) : 1;
    const wobble = alive && s.lives === 1 ? Math.sin(s.time * 9) * 0.16 : 0;
    drawEgg(ctx, cx, 38, 20, alive, crack, wobble);
  }
  ctx.restore();
}

// --------------------------------------------------------- bottom band ----

export function drawBottomBand(
  ctx: CanvasRenderingContext2D,
  s: HudState
): void {
  const cy = BOTTOM_BAND_Y + 22;
  ctx.save();
  ctx.textBaseline = 'alphabetic';

  if (s.state === 'ready') {
    drawControlHints(ctx, BOARD_X, cy, s);
    ctx.restore();
    return;
  }

  let x = BOARD_X;
  for (const p of s.powerUps) {
    drawPod(ctx, x, cy - 14, p, s.time);
    x += 136;
  }

  // One line of guidance on the right.
  let hint = '';
  if (s.state === 'respawn') hint = 'Turn to slither out';
  else if (s.state === 'dying') hint = 'No eggs left';
  else if (s.state === 'ended') hint = `Shed at length ${s.length}`;
  else if (s.applesToNext !== null && s.paceTier < PACE_TIERS.length - 1) {
    const next = PACE_TIERS[s.paceTier + 1].name;
    const n = s.applesToNext;
    hint = `${n} apple${n === 1 ? '' : 's'} to ${next}`;
  } else hint = 'Top pace';
  if (x < RIGHT - 190) {
    ctx.font = sansFont(12, 600);
    ctx.textAlign = 'right';
    ctx.fillStyle = s.state === 'dying' ? UI.bad : PAL.sage;
    ctx.fillText(hint, RIGHT, cy + 4);
    if (s.state === 'playing' && s.applesToNext !== null && hint) {
      const w = ctx.measureText(hint).width;
      drawApple(ctx, RIGHT - w - 12, cy, 6);
    }
  }
  ctx.restore();
}

function drawPod(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  p: HudPowerUp,
  time: number
): void {
  const cfg = POWERUP_CONFIGS[p.type];
  const w = 128;
  const h = 28;
  const expiring = p.left <= EXPIRY_WARNING;
  const blink = expiring ? (Math.floor(time * 5) % 2 === 0 ? 1 : 0.35) : 1;
  ctx.save();
  ctx.globalAlpha = blink;
  roundRectPath(ctx, x, y, w, h, h / 2);
  ctx.fillStyle = withAlpha(cfg.color, 0.13);
  ctx.fill();
  ctx.strokeStyle = withAlpha(cfg.color, expiring ? 0.85 : 0.45);
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = PAL.frameDark;
  ctx.beginPath();
  ctx.arc(x + 14, y + h / 2, 10, 0, Math.PI * 2);
  ctx.fill();
  drawPowerUpIcon(ctx, p.type, x + 14, y + h / 2, 8, cfg.color);

  ctx.textAlign = 'left';
  ctx.font = sansFont(11, 800);
  ctx.fillStyle = PAL.bone;
  ctx.fillText(cfg.label, x + 30, y + 13);
  ctx.font = sansFont(9, 600);
  ctx.fillStyle = PAL.sage;
  ctx.fillText(cfg.hint, x + 30, y + 23);
  ctx.textAlign = 'right';
  ctx.font = monoFont(11, 700);
  ctx.fillStyle = expiring ? PAL.bone : PAL.sage;
  ctx.fillText(p.left.toFixed(1), x + w - 10, y + 17);

  // The drain rail rides the capsule's lower lip.
  const k = Math.max(0, Math.min(1, p.left / p.max));
  ctx.fillStyle = cfg.color;
  ctx.fillRect(x + 30, y + h - 3, (w - 44) * k, 2);
  ctx.restore();
}

function drawControlHints(
  ctx: CanvasRenderingContext2D,
  x: number,
  cy: number,
  s: HudState
): void {
  const arrows: Array<'up' | 'left' | 'down' | 'right'> = [
    'left',
    'up',
    'down',
    'right',
  ];
  let cx = x;
  for (const a of arrows) {
    keycap(ctx, cx, cy - 11, 22, 22, () => arrowGlyph(ctx, cx + 11, cy, a));
    cx += 26;
  }
  ctx.font = sansFont(11, 600);
  ctx.fillStyle = PAL.lichen;
  ctx.textAlign = 'left';
  ctx.fillText('or', cx + 4, cy + 4);
  cx += 22;
  for (const k of ['W', 'A', 'S', 'D']) {
    keycap(ctx, cx, cy - 11, 22, 22, () => {
      ctx.font = monoFont(11, 800);
      ctx.fillStyle = PAL.bone;
      ctx.textAlign = 'center';
      ctx.fillText(k, cx + 11, cy + 4);
    });
    cx += 26;
  }
  ctx.font = sansFont(11, 600);
  ctx.fillStyle = PAL.lichen;
  ctx.textAlign = 'left';
  ctx.fillText('or', cx + 4, cy + 4);
  cx += 26;
  swipeGlyph(ctx, cx + 10, cy);
  ctx.font = sansFont(12, 700);
  ctx.fillStyle = PAL.bone;
  ctx.fillText('swipe', cx + 28, cy + 4);

  ctx.textAlign = 'right';
  ctx.font = sansFont(12, 600);
  ctx.fillStyle = PAL.sage;
  ctx.fillText('Your first turn starts the run', RIGHT, cy - 1);
  rail(
    ctx,
    RIGHT - 150,
    cy + 7,
    150,
    Math.min(1, s.stateTime / READY_AUTO_START),
    PAL.tide
  );
}

// ------------------------------------------------------ in-board cards ----

/**
 * The READY card, pinned to a specimen label: what to press, what to do.
 * `appear` 0..1 rises it in; `alpha` fades it out once the run starts.
 */
export function drawReadyCard(
  ctx: CanvasRenderingContext2D,
  appear: number,
  alpha: number,
  progress: number
): void {
  if (alpha <= 0) return;
  const w = 404;
  const h = 142;
  const cx = BOARD_X + BOARD_W / 2;
  const rise = (1 - ease.outBack(appear)) * 18;
  const x = cx - w / 2;
  const y = BOARD_Y + 58 + rise;
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha * Math.min(1, appear * 2)));
  roundRectPath(ctx, x, y, w, h, 12);
  ctx.fillStyle = 'rgba(3, 20, 21, 0.92)';
  ctx.fill();
  ctx.strokeStyle = withAlpha(PAL.bone, 0.2);
  ctx.lineWidth = 1;
  ctx.stroke();
  roundRectPath(ctx, x + 5, y + 5, w - 10, h - 10, 8);
  ctx.strokeStyle = withAlpha(PAL.sprout, 0.16);
  ctx.stroke();

  ctx.textBaseline = 'alphabetic';
  label(ctx, 'A NEW HATCHLING', cx, y + 28, 'center', PAL.sprout);
  ctx.font = displayFont(28, 800);
  ctx.fillStyle = PAL.bone;
  ctx.textAlign = 'center';
  ctx.fillText('READY', cx, y + 62);
  const tw = ctx.measureText('READY').width;
  drawApple(ctx, cx - tw / 2 - 22, y + 51, 9);
  drawEgg(ctx, cx + tw / 2 + 22, y + 40, 20, true);

  ctx.font = sansFont(14, 600);
  ctx.fillStyle = PAL.bone;
  ctx.fillText('Arrows / WASD or swipe to slither.', cx, y + 90);
  ctx.font = sansFont(13, 500);
  ctx.fillStyle = PAL.sage;
  ctx.fillText("Eat, grow, don't bite yourself.", cx, y + 110);
  rail(ctx, x + 28, y + h - 18, w - 56, progress, withAlpha(PAL.tide, 0.8));
  ctx.restore();
}

export interface Ribbon {
  eyebrow: string;
  title: string;
  accent: string;
  age: number;
  life: number;
}

/** A swallowtail ribbon that unfurls from its middle, holds, and fades. */
export function drawRibbon(ctx: CanvasRenderingContext2D, r: Ribbon): void {
  if (r.age < 0 || r.age >= r.life) return;
  const cx = BOARD_X + BOARD_W / 2;
  const cy = BOARD_Y + 74;
  const open = ease.outBack(Math.min(1, r.age / 0.3));
  const fade = Math.min(1, (r.life - r.age) / 0.3);
  ctx.save();
  ctx.font = displayFont(20, 800);
  const tw = ctx.measureText(r.title).width;
  ctx.font = sansFont(9, 800);
  const ew = trackedWidth(ctx, r.eyebrow, 1.6);
  const half = ((Math.max(tw, ew) + 70) / 2) * Math.max(0.05, open);
  const hh = 26;
  const notch = 14;
  ctx.globalAlpha = fade;
  ctx.beginPath();
  ctx.moveTo(cx - half - notch, cy - hh);
  ctx.lineTo(cx + half + notch, cy - hh);
  ctx.lineTo(cx + half + 2, cy);
  ctx.lineTo(cx + half + notch, cy + hh);
  ctx.lineTo(cx - half - notch, cy + hh);
  ctx.lineTo(cx - half - 2, cy);
  ctx.closePath();
  ctx.fillStyle = 'rgba(3, 22, 21, 0.93)';
  ctx.fill();
  ctx.fillStyle = r.accent;
  ctx.fillRect(cx - half, cy - hh, half * 2, 2);
  ctx.fillRect(cx - half, cy + hh - 2, half * 2, 2);

  if (open > 0.6) {
    ctx.globalAlpha = fade * Math.min(1, (open - 0.6) / 0.4);
    ctx.textBaseline = 'alphabetic';
    label(ctx, r.eyebrow, cx, cy - 6, 'center', r.accent);
    ctx.font = displayFont(20, 800);
    ctx.fillStyle = PAL.bone;
    ctx.textAlign = 'center';
    ctx.fillText(r.title, cx, cy + 17);
  }
  ctx.restore();
}

// ------------------------------------------------------------ helpers ----

function label(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  align: 'left' | 'right' | 'center' = 'left',
  color: string = PAL.lichen
): void {
  ctx.save();
  ctx.font = sansFont(9, 800);
  ctx.fillStyle = color;
  ctx.textAlign = 'left';
  const w = trackedWidth(ctx, text, 1.6);
  const sx = align === 'right' ? x - w : align === 'center' ? x - w / 2 : x;
  tracked(ctx, text, sx, y, 1.6);
  ctx.restore();
}

/** Digits in fixed-width cells, so a ticking number never shifts. */
function digits(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  cell: number
): void {
  ctx.textAlign = 'center';
  for (let i = 0; i < text.length; i++) {
    ctx.fillText(text[i], x + cell * i + cell / 2, y);
  }
}

function rail(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  t: number,
  color: string
): void {
  const k = Math.max(0, Math.min(1, t));
  ctx.save();
  ctx.fillStyle = withAlpha(PAL.sage, 0.14);
  ctx.fillRect(x, y, w, 2);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w * k, 2);
  ctx.restore();
}

/** One snake scale: a keeled diamond, filled when the tier is reached. */
function scale(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  on: boolean,
  pop: number
): void {
  const s = 1 + pop * 0.5;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(0, -6.5);
  ctx.lineTo(5, 0);
  ctx.lineTo(0, 6.5);
  ctx.lineTo(-5, 0);
  ctx.closePath();
  if (on) {
    ctx.fillStyle = pop > 0 ? '#e6fffb' : PAL.tide;
    ctx.fill();
    // The keel: a darker ridge down the middle of the scale.
    ctx.strokeStyle = withAlpha(PAL.case, 0.45);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, -4);
    ctx.lineTo(0, 4);
    ctx.stroke();
  } else {
    ctx.strokeStyle = withAlpha(PAL.sage, 0.35);
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }
  ctx.restore();
}

function keycap(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  inner: () => void
): void {
  ctx.save();
  roundRectPath(ctx, x, y, w, h, 5);
  ctx.fillStyle = PAL.frameDark;
  ctx.fill();
  ctx.strokeStyle = withAlpha(PAL.bone, 0.22);
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = withAlpha(PAL.bone, 0.08);
  ctx.fillRect(x + 3, y + h - 3, w - 6, 1);
  inner();
  ctx.restore();
}

function arrowGlyph(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  dir: 'up' | 'down' | 'left' | 'right'
): void {
  const a = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 }[
    dir
  ];
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(a);
  ctx.fillStyle = PAL.bone;
  ctx.beginPath();
  ctx.moveTo(5, 0);
  ctx.lineTo(-3, -5);
  ctx.lineTo(-3, 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** A fingertip with a motion trail: "swipe". */
function swipeGlyph(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number
): void {
  ctx.save();
  ctx.strokeStyle = withAlpha(PAL.bone, 0.45);
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - 12, cy);
  ctx.lineTo(cx + 2, cy);
  ctx.stroke();
  ctx.fillStyle = PAL.bone;
  ctx.beginPath();
  ctx.arc(cx + 7, cy, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function formatMult(m: number): string {
  return Number.isInteger(m) ? `${m}` : m.toFixed(1);
}

function mixFlash(k: number): string {
  return k > 0.5 ? '#e6fffb' : PAL.tide;
}
