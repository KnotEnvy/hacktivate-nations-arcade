// Floodlight's chrome: a broadcast scorebug across the top band, a serve
// card, lower-third banners for the beats, and the full-frame washes (hit
// vignette, last-brick flash, game-over dim).
//
// House style: every panel is a '/'-leaning parallelogram, numerals are
// Orbitron with dim leading zeros like a stadium board, labels are tracked
// Inter caps, values are JetBrains Mono. Amber appears only on the coin
// count; red only on the last serve and the OUT / MATCH OVER banners.

import {
  coinGlyph,
  displayFont,
  edgeVignette,
  ease,
  eyebrow,
  monoFont,
  sansFont,
  UI,
} from '@/games/shared/hud/canvasUi';
import {
  CATCH_TIME,
  COURT,
  HUD_BAND,
  SLOW_TIME,
  STREAK_COLORS,
  VIEW_H,
  VIEW_W,
  WIDEN_TIME,
} from '../constants';
import type { PowerType } from '../entities/types';
import type { ActivePowers } from './powerups';
import { POWER_DEFS } from './powerups';
import { powerIcon, servePip, slantPath } from './icons';
import { rgba } from './color';

export interface HudState {
  score: number;
  best: number;
  coins: number;
  level: number;
  ballsInPlay: number;
  lives: number;
  maxLives: number;
  streak: number;
  streakMult: 1 | 2 | 3;
  streakPulse: number;
  powers: ActivePowers;
  time: number;
}

export interface BannerState {
  title: string;
  sub: string;
  accent: string;
  t: number;
  dur: number;
}

const SKEW = 8;
const CELL_Y = 6;
const CELL_H = 40;

/** Scorebug cells, left to right. */
export const CELLS = {
  flag: { x: 8, w: 6 },
  score: { x: 20, w: 214 },
  set: { x: 242, w: 118 },
  power: { x: 368, w: 204 },
  serves: { x: 580, w: 108 },
  streak: { x: 696, w: 92 },
} as const;

/** Where a paying brick's coin flies to. */
export const COIN_TARGET = { x: CELLS.score.x + 146, y: 39 };

const POWER_ORDER: PowerType[] = ['widen', 'slow', 'catch', 'blast'];
const POWER_TIME: Partial<Record<PowerType, number>> = {
  widen: WIDEN_TIME,
  slow: SLOW_TIME,
  catch: CATCH_TIME,
};

function cell(ctx: CanvasRenderingContext2D, x: number, w: number): void {
  slantPath(ctx, x, CELL_Y, w, CELL_H, SKEW);
  const g = ctx.createLinearGradient(0, CELL_Y, 0, CELL_Y + CELL_H);
  g.addColorStop(0, '#151a42');
  g.addColorStop(1, '#0b0e27');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = UI.line;
  ctx.lineWidth = 1;
  ctx.stroke();
}

/** A stadium-board number: zero-padded, the padding dimmed. */
function boardNumber(
  ctx: CanvasRenderingContext2D,
  value: number,
  digits: number,
  x: number,
  y: number,
  size: number,
  color: string = UI.ink
): void {
  const s = String(Math.max(0, Math.floor(value)));
  const pad = s.length < digits ? '0'.repeat(digits - s.length) : '';
  ctx.font = displayFont(size);
  ctx.textAlign = 'left';
  ctx.fillStyle = rgba('#8c93b8', 0.13);
  ctx.fillText(pad, x, y);
  ctx.fillStyle = color;
  ctx.fillText(s, x + ctx.measureText(pad).width, y);
}

function keycap(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  label: string | 'left' | 'right'
): number {
  ctx.font = sansFont(9, 700);
  const arrow = label === 'left' || label === 'right';
  const w = arrow ? 17 : Math.max(17, ctx.measureText(label).width + 12);
  slantPath(ctx, x, y, w, 16, 3);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.07)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = UI.ink;
  if (arrow) {
    const cx = x + w / 2 + 1.5;
    const d = label === 'left' ? -1 : 1;
    ctx.beginPath();
    ctx.moveTo(cx + d * 4, y + 8);
    ctx.lineTo(cx - d * 2, y + 4);
    ctx.lineTo(cx - d * 2, y + 12);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.textAlign = 'center';
    ctx.fillText(label, x + w / 2 + 1.5, y + 11.5);
    ctx.textAlign = 'left';
  }
  return w;
}

/** The four power-tag slots in the POWER cell. */
const POWER_SLOTS = [
  { x: CELLS.power.x + 12, y: 10 },
  { x: CELLS.power.x + 108, y: 10 },
  { x: CELLS.power.x + 6, y: 29 },
  { x: CELLS.power.x + 102, y: 29 },
];

/** Everything in the band that never changes: ground, flag, cells. */
function paintBandChrome(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = COURT.void;
  ctx.fillRect(0, 0, VIEW_W, HUD_BAND);
  ctx.fillStyle = UI.line;
  ctx.fillRect(0, HUD_BAND - 1, VIEW_W, 1);

  // House flag.
  slantPath(ctx, CELLS.flag.x, CELL_Y, CELLS.flag.w, CELL_H, SKEW);
  ctx.fillStyle = COURT.mint;
  ctx.fill();

  for (const c of [
    CELLS.score,
    CELLS.set,
    CELLS.power,
    CELLS.serves,
    CELLS.streak,
  ]) {
    cell(ctx, c.x, c.w);
  }
}

export class HudRenderer {
  private chrome: HTMLCanvasElement | null = null;

  /** Paint the band's static chrome once. */
  build(): void {
    if (typeof document === 'undefined') return;
    const c = document.createElement('canvas');
    c.width = VIEW_W;
    c.height = HUD_BAND;
    const g = c.getContext('2d');
    if (!g) return;
    paintBandChrome(g);
    this.chrome = c;
  }

  // =========================================================== band ====

  band(ctx: CanvasRenderingContext2D, s: HudState): void {
    ctx.save();
    ctx.textBaseline = 'alphabetic';
    if (this.chrome) ctx.drawImage(this.chrome, 0, 0);
    else paintBandChrome(ctx);

    this.scoreCell(ctx, s);
    this.setCell(ctx, s);
    this.powerCell(ctx, s);
    this.servesCell(ctx, s);
    this.streakCell(ctx, s);
    ctx.restore();
  }

  private scoreCell(ctx: CanvasRenderingContext2D, s: HudState): void {
    const x = CELLS.score.x;
    eyebrow(ctx, 'SCORE', x + 16, 19);
    boardNumber(ctx, s.score, 6, x + 14, 42, 22);

    const bx = x + 140;
    eyebrow(ctx, 'BEST', bx, 19);
    ctx.font = monoFont(11, 700);
    ctx.textAlign = 'left';
    ctx.fillStyle = UI.inkMuted;
    ctx.fillText(String(s.best), bx, 31);
    // Currency is always amber and nothing else is.
    coinGlyph(ctx, COIN_TARGET.x, COIN_TARGET.y, 4.5);
    ctx.fillStyle = UI.coin;
    ctx.fillText(String(s.coins), bx + 13, 43);
  }

  private setCell(ctx: CanvasRenderingContext2D, s: HudState): void {
    const x = CELLS.set.x;
    eyebrow(ctx, 'SET', x + 16, 19);
    boardNumber(ctx, s.level, 2, x + 14, 42, 22);
    eyebrow(ctx, 'BALLS', x + 64, 19);
    for (let i = 0; i < 6; i++) {
      const cx = x + 66 + (i % 3) * 10;
      const cy = 29 + Math.floor(i / 3) * 9;
      ctx.beginPath();
      ctx.arc(cx, cy, 3, 0, Math.PI * 2);
      if (i < s.ballsInPlay) {
        ctx.fillStyle = '#ffffff';
        ctx.fill();
      } else {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
  }

  private powerCell(ctx: CanvasRenderingContext2D, s: HudState): void {
    const live = POWER_ORDER.filter(t =>
      t === 'blast' ? s.powers.blast : (s.powers[t as 'widen'] ?? 0) > 0
    );
    if (live.length === 0) {
      // Nothing running: say what the cell is for, quietly, like the other
      // cells, rather than leaving an empty panel.
      const x = CELLS.power.x;
      eyebrow(ctx, 'POWER', x + 16, 19);
      ctx.font = sansFont(10, 600);
      ctx.textAlign = 'left';
      ctx.fillStyle = UI.inkFaint;
      ctx.fillText('Catch a falling capsule', x + 14, 37);
      return;
    }
    live.forEach((type, i) => {
      const slot = POWER_SLOTS[i];
      if (slot) this.powerTag(ctx, slot.x, slot.y, type, s);
    });
  }

  private powerTag(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    type: PowerType,
    s: HudState
  ): void {
    const def = POWER_DEFS[type];
    const w = 88;
    const h = 14;
    const total = POWER_TIME[type];
    const left = type === 'blast' ? 1 : (s.powers[type as 'widen'] ?? 0);
    const frac = total ? left / total : 1;
    // Warn in the last two seconds by blinking.
    const blink = total && left < 2 ? 0.55 + 0.45 * Math.sin(s.time * 16) : 1;

    ctx.save();
    ctx.globalAlpha = blink;
    slantPath(ctx, x, y, w, h, 3);
    ctx.fillStyle = rgba(def.color, 0.16);
    ctx.fill();
    ctx.strokeStyle = rgba(def.color, 0.6);
    ctx.lineWidth = 1;
    ctx.stroke();
    powerIcon(ctx, type, x + 11, y + 7, 9, def.color);
    ctx.font = sansFont(9, 700);
    ctx.textAlign = 'left';
    ctx.fillStyle = UI.ink;
    ctx.fillText(def.label, x + 21, y + 10.5);
    ctx.font = monoFont(9, 700);
    ctx.textAlign = 'right';
    ctx.fillStyle = UI.inkMuted;
    ctx.fillText(
      type === 'blast' ? 'ARMED' : left.toFixed(1),
      x + w - 2,
      y + 10.5
    );
    ctx.fillStyle = def.color;
    ctx.fillRect(x + 1, y + h - 2, (w - 2) * Math.max(0, Math.min(1, frac)), 2);
    ctx.restore();
  }

  private servesCell(ctx: CanvasRenderingContext2D, s: HudState): void {
    const x = CELLS.serves.x;
    eyebrow(ctx, 'SERVES', x + 16, 19);
    const last = s.lives === 1;
    for (let i = 0; i < s.maxLives; i++) {
      const filled = i < s.lives;
      ctx.save();
      if (filled && last)
        ctx.globalAlpha = 0.55 + 0.45 * Math.abs(Math.sin(s.time * 5));
      servePip(
        ctx,
        x + 13 + i * 18,
        30,
        14,
        5,
        filled,
        last ? UI.bad : COURT.mint,
        'rgba(255, 255, 255, 0.16)'
      );
      ctx.restore();
    }
  }

  private streakCell(ctx: CanvasRenderingContext2D, s: HudState): void {
    const x = CELLS.streak.x;
    const live = s.streak > 0;
    eyebrow(ctx, 'STREAK', x + 16, 19);
    const color = live ? STREAK_COLORS[s.streakMult - 1] : UI.inkFaint;
    const pop = 1 + ease.outCubic(s.streakPulse / 0.35) * 0.35;
    ctx.save();
    ctx.translate(x + 14, 42);
    ctx.scale(pop, pop);
    ctx.font = displayFont(19);
    ctx.textAlign = 'left';
    ctx.fillStyle = color;
    ctx.fillText(`x${s.streakMult}`, 0, 0);
    ctx.restore();

    // Six segments: the first three light toward x2 (violet), the next
    // three toward x3 (magenta).
    for (let i = 0; i < 6; i++) {
      const sx = x + 52 + i * 5.6;
      slantPath(ctx, sx, 31, 3.6, 9, 2);
      if (i < s.streak) {
        ctx.fillStyle = STREAK_COLORS[i < 3 ? 1 : 2];
        if (s.streakMult === 3) {
          ctx.globalAlpha = 0.7 + 0.3 * Math.sin(s.time * 12);
        }
        ctx.fill();
        ctx.globalAlpha = 1;
      } else {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.fill();
      }
    }
    ctx.font = monoFont(9, 700);
    ctx.textAlign = 'right';
    ctx.fillStyle = live ? UI.inkMuted : UI.inkFaint;
    ctx.fillText(String(s.streak), x + CELLS.streak.w - 2, 19);
  }

  // ====================================================== serve card ====

  /** The first serve of a run: what the controls are. */
  serveCard(ctx: CanvasRenderingContext2D, alpha: number, level: number): void {
    if (alpha <= 0) return;
    const w = 470;
    const h = 78;
    const x = VIEW_W / 2 - w / 2;
    const y = 352;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.textBaseline = 'alphabetic';
    slantPath(ctx, x, y, w, h, 10);
    ctx.fillStyle = 'rgba(8, 10, 30, 0.9)';
    ctx.fill();
    ctx.strokeStyle = UI.lineStrong;
    ctx.lineWidth = 1;
    ctx.stroke();
    slantPath(ctx, x + 6, y + 8, 7, h - 16, 8);
    ctx.fillStyle = COURT.mint;
    ctx.fill();

    ctx.textAlign = 'left';
    ctx.fillStyle = UI.ink;
    ctx.font = displayFont(24);
    ctx.fillText('SERVE', x + 28, y + 44);
    eyebrow(
      ctx,
      `SET ${String(level).padStart(2, '0')} · BREAK EVERY TILE`,
      x + 30,
      y + 62,
      'left',
      UI.inkMuted
    );

    ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.fillRect(x + 188, y + 14, 1, h - 28);

    let cx = x + 204;
    const r1 = y + 20;
    cx += keycap(ctx, cx, r1, 'left') + 4;
    cx += keycap(ctx, cx, r1, 'right') + 6;
    ctx.font = sansFont(11, 600);
    ctx.fillStyle = UI.inkFaint;
    ctx.fillText('/', cx, r1 + 12);
    cx += 10;
    cx += keycap(ctx, cx, r1, 'A') + 4;
    cx += keycap(ctx, cx, r1, 'D') + 8;
    ctx.font = sansFont(11, 600);
    ctx.fillStyle = UI.inkMuted;
    ctx.fillText('mouse or drag to move', cx, r1 + 12);

    cx = x + 200;
    const r2 = y + 44;
    cx += keycap(ctx, cx, r2, 'SPACE') + 8;
    ctx.font = sansFont(11, 600);
    ctx.fillStyle = UI.inkMuted;
    ctx.fillText('click or tap to launch', cx, r2 + 12);
    ctx.restore();
  }

  /** Every later serve: one quiet line under the paddle. */
  servePrompt(
    ctx: CanvasRenderingContext2D,
    cx: number,
    y: number,
    alpha: number,
    verb = 'SERVE'
  ): void {
    if (alpha <= 0) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = sansFont(10, 700);
    ctx.textAlign = 'center';
    ctx.fillStyle = UI.inkMuted;
    const x = Math.max(120, Math.min(VIEW_W - 120, cx));
    ctx.fillText(`${verb}  ·  SPACE, CLICK OR TAP`, x, y);
    ctx.restore();
  }

  // ========================================================= banners ====

  /** A lower-third strip that wipes in from the left and out to the right. */
  banner(ctx: CanvasRenderingContext2D, b: BannerState): void {
    const inT = Math.min(1, b.t / 0.24);
    const outT = Math.max(0, (b.t - (b.dur - 0.22)) / 0.22);
    if (outT >= 1) return;
    ctx.save();
    ctx.textBaseline = 'alphabetic';
    ctx.font = displayFont(26);
    const tw = ctx.measureText(b.title).width;
    ctx.font = monoFont(11, 700);
    const sw = ctx.measureText(b.sub).width;
    const w = Math.max(360, Math.max(tw, sw) + 96);
    const h = 64;
    const x0 = VIEW_W / 2 - w / 2;
    const y = 318;
    const x =
      x0 -
      (1 - ease.outCubic(inT)) * (x0 + w + 20) +
      ease.inOutSine(outT) * (VIEW_W - x0 + 20);

    slantPath(ctx, x, y, w, h, 12);
    ctx.fillStyle = 'rgba(6, 8, 26, 0.94)';
    ctx.fill();
    ctx.strokeStyle = UI.lineStrong;
    ctx.lineWidth = 1;
    ctx.stroke();
    slantPath(ctx, x + 8, y + 8, 10, h - 16, 10);
    ctx.fillStyle = b.accent;
    ctx.fill();

    // One light sweep across the strip as it lands.
    const sweep = Math.min(1, b.t / 0.6);
    if (sweep < 1) {
      ctx.save();
      slantPath(ctx, x, y, w, h, 12);
      ctx.clip();
      const sx = x + sweep * (w + 120) - 60;
      const g = ctx.createLinearGradient(sx - 50, 0, sx + 50, 0);
      g.addColorStop(0, 'rgba(255, 255, 255, 0)');
      g.addColorStop(0.5, 'rgba(255, 255, 255, 0.18)');
      g.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(sx - 50, y, 100, h);
      ctx.restore();
    }

    ctx.textAlign = 'left';
    ctx.fillStyle = UI.ink;
    ctx.font = displayFont(26);
    ctx.fillText(b.title, x + 36, y + 35);
    ctx.font = monoFont(11, 700);
    ctx.fillStyle = UI.inkMuted;
    ctx.fillText(b.sub, x + 38, y + 53);
    ctx.restore();
  }

  // ======================================================== overlays ====

  /** Washes over the court, under the band. */
  overlays(
    ctx: CanvasRenderingContext2D,
    o: { hurt: number; flash: number; slowmo: number; dim: number }
  ): void {
    if (o.slowmo > 0)
      edgeVignette(ctx, VIEW_W, VIEW_H, COURT.mintBright, o.slowmo * 0.7);
    if (o.hurt > 0) edgeVignette(ctx, VIEW_W, VIEW_H, UI.bad, o.hurt);
    if (o.flash > 0) {
      // Brighten, do not fog: the flash is added light.
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `rgba(150, 255, 230, ${Math.min(0.4, o.flash * 0.4)})`;
      ctx.fillRect(0, HUD_BAND, VIEW_W, VIEW_H - HUD_BAND);
      ctx.restore();
    }
    if (o.dim > 0) {
      ctx.save();
      ctx.fillStyle = `rgba(2, 3, 10, ${Math.min(0.55, o.dim * 0.55)})`;
      ctx.fillRect(0, HUD_BAND, VIEW_W, VIEW_H - HUD_BAND);
      ctx.restore();
    }
  }
}
