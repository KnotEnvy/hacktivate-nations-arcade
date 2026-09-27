// ===== src/games/tapdodge/systems/HudRenderer.ts =====
//
// The chrome, drawn as highway signage. Two solid bands frame the road and
// the HUD lives only inside them, so it never sits on the playfield:
//
//   GANTRY (top)  SCORE odometer + BEST | ZONE sign + rail | FEVER + CHAIN
//   DECK (bottom) active power-ups with drain rails        | HULL pips
//
// Plates are chamfered on two corners with a reflective strip along the top
// in the zone accent. The ZONE sign flips when the zone changes and turns
// hot pink for a RUSH, its rail becoming the rush timer. Type is the
// platform's: Orbitron numerals, Inter words, JetBrains Mono values.

import {
  UI,
  displayFont,
  eyebrow,
  monoFont,
  sansFont,
} from '@/games/shared/hud/canvasUi';
import { POWERUP_CONFIG, PowerUpType } from '../entities/PowerUp';
import { chevron, chevronPair, icon, plate, wedgePath } from './icons';
import { DECK_Y, GANTRY_H, VIEW_H, VIEW_W } from './layout';
import { RUSH_HOT, SHIP } from './palette';
import type { RushPhase } from './Progression';

export interface HudPowerUp {
  type: PowerUpType;
  left: number;
  max: number;
}

export interface HudState {
  score: number;
  best: number;
  zone: number;
  zoneCount: number;
  zoneName: string;
  zoneProgress: number;
  nextZoneIn: number | null;
  /** CSS colour of the accent right now. */
  accent: string;
  rushPhase: RushPhase;
  rushTimer: number;
  rushLength: number;
  feverName: string;
  feverMult: number;
  feverColor: string;
  feverProgress: number;
  feverFlash: number;
  chain: number;
  combo: number;
  lives: number;
  maxLives: number;
  powerUps: HudPowerUp[];
  /** 0..1 progress of the zone sign's flip, 1 when settled. */
  zoneFlip: number;
  time: number;
}

export interface Popup {
  x: number;
  y: number;
  label: string;
  value: string;
  color: string;
  life: number;
  max: number;
}

const BAND = 'rgba(5, 7, 15, 0.96)';
const PLATE_Y = 7;
const PLATE_H = 44;
const SCORE_DIGITS = 7;

export class HudRenderer {
  // ======================================================== bands ====

  renderBands(ctx: CanvasRenderingContext2D, s: HudState): void {
    ctx.save();
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = BAND;
    ctx.fillRect(0, 0, VIEW_W, GANTRY_H);
    ctx.fillRect(0, DECK_Y, VIEW_W, VIEW_H - DECK_Y);
    ctx.fillStyle = s.accent;
    ctx.fillRect(0, GANTRY_H - 2, VIEW_W, 2);
    ctx.fillRect(0, DECK_Y, VIEW_W, 2);

    this.renderScore(ctx, s);
    this.renderZone(ctx, s);
    this.renderFever(ctx, s);
    this.renderPowerUps(ctx, s);
    this.renderHull(ctx, s);
    ctx.restore();
  }

  private renderScore(ctx: CanvasRenderingContext2D, s: HudState): void {
    const x = 12;
    const w = 222;
    plate(ctx, x, PLATE_Y, w, PLATE_H, { strip: s.accent });
    eyebrow(ctx, 'SCORE', x + 14, PLATE_Y + 15);

    // An odometer: fixed advance per digit, spent zeros dimmed.
    const text = String(Math.max(0, Math.floor(s.score)));
    const padded = text.padStart(SCORE_DIGITS, '0');
    const lead = SCORE_DIGITS - text.length;
    ctx.font = displayFont(21);
    ctx.textAlign = 'center';
    for (let i = 0; i < padded.length; i++) {
      ctx.fillStyle = i < lead ? UI.inkFaint : UI.ink;
      ctx.globalAlpha = i < lead ? 0.16 : 1;
      ctx.fillText(padded[i], x + 23 + i * 16.5, PLATE_Y + 38);
    }
    ctx.globalAlpha = 1;

    eyebrow(ctx, 'BEST', x + w - 14, PLATE_Y + 15, 'right');
    ctx.textAlign = 'right';
    ctx.font = monoFont(12, 600);
    ctx.fillStyle = s.score > s.best ? s.accent : UI.inkMuted;
    ctx.fillText(
      String(Math.max(s.best, Math.floor(s.score))),
      x + w - 14,
      PLATE_Y + 36
    );
  }

  private renderZone(ctx: CanvasRenderingContext2D, s: HudState): void {
    const w = 236;
    const x = (VIEW_W - w) / 2;
    const rush = s.rushPhase === 'active';
    const warn = s.rushPhase === 'warning';
    const tone = rush || warn ? RUSH_HOT : s.accent;

    // The sign flips on a zone change: squash to a line and open again.
    const flip = Math.abs(1 - 2 * Math.min(1, s.zoneFlip));
    const cy = PLATE_Y + PLATE_H / 2;
    ctx.save();
    ctx.translate(0, cy);
    ctx.scale(1, s.zoneFlip < 1 ? Math.max(0.06, flip) : 1);
    ctx.translate(0, -cy);

    plate(ctx, x, PLATE_Y, w, PLATE_H, {
      strip: tone,
      border: rush ? 'rgba(255, 79, 160, 0.5)' : undefined,
    });

    const lx = x + 14;
    if (rush) {
      eyebrow(ctx, 'RUSH', lx, PLATE_Y + 15, 'left', RUSH_HOT);
      ctx.textAlign = 'right';
      ctx.font = monoFont(11, 700);
      ctx.fillStyle = UI.ink;
      ctx.fillText(
        `${Math.max(0, s.rushTimer).toFixed(1)}s`,
        x + w - 14,
        PLATE_Y + 16
      );
      ctx.textAlign = 'left';
      ctx.font = sansFont(14, 800);
      ctx.fillStyle = RUSH_HOT;
      ctx.fillText('HOLD THE LINE', lx, PLATE_Y + 34);
      this.rail(
        ctx,
        lx,
        PLATE_Y + 38,
        w - 28,
        s.rushTimer / s.rushLength,
        RUSH_HOT
      );
    } else if (warn) {
      const on = Math.floor(s.time * 6) % 2 === 0;
      eyebrow(
        ctx,
        'RUSH INBOUND',
        lx,
        PLATE_Y + 15,
        'left',
        on ? RUSH_HOT : UI.inkFaint
      );
      ctx.textAlign = 'left';
      ctx.font = sansFont(14, 800);
      ctx.fillStyle = UI.ink;
      ctx.fillText('ALL LANES, FASTER', lx, PLATE_Y + 34);
      ctx.strokeStyle = RUSH_HOT;
      chevronPair(ctx, x + w - 24, PLATE_Y + 27, 12, 'up', 2);
    } else {
      eyebrow(ctx, `ZONE ${s.zone + 1} / ${s.zoneCount}`, lx, PLATE_Y + 15);
      const right =
        s.nextZoneIn !== null
          ? `NEXT ${Math.ceil(s.nextZoneIn)}S`
          : s.zoneProgress >= 1
            ? 'TOP SPEED'
            : 'SPEED RISING';
      eyebrow(ctx, right, x + w - 14, PLATE_Y + 15, 'right');
      ctx.textAlign = 'left';
      ctx.font = sansFont(14, 800);
      ctx.fillStyle = s.accent;
      ctx.fillText(s.zoneName, lx, PLATE_Y + 34);
      this.rail(ctx, lx, PLATE_Y + 38, w - 28, s.zoneProgress, s.accent);
    }
    ctx.restore();
  }

  private renderFever(ctx: CanvasRenderingContext2D, s: HudState): void {
    const w = 222;
    const x = VIEW_W - 12 - w;
    plate(ctx, x, PLATE_Y, w, PLATE_H, {
      strip: s.feverColor,
      border:
        s.feverFlash > 0
          ? `rgba(255, 255, 255, ${(0.2 + s.feverFlash).toFixed(3)})`
          : undefined,
    });
    eyebrow(ctx, 'FEVER', x + 14, PLATE_Y + 15);

    const parts: string[] = [];
    if (s.chain > 0) parts.push(`CHAIN x${s.chain}`);
    if (s.combo > 1) parts.push(`COMBO ${s.combo}`);
    if (parts.length > 0) {
      ctx.textAlign = 'right';
      ctx.font = monoFont(10, 700);
      ctx.fillStyle = s.chain > 0 ? UI.ink : UI.inkMuted;
      ctx.fillText(parts.join('  '), x + w - 14, PLATE_Y + 16);
    }

    ctx.textAlign = 'left';
    ctx.font = sansFont(14, 800);
    ctx.fillStyle = s.feverColor;
    ctx.fillText(s.feverName, x + 14, PLATE_Y + 34);
    ctx.textAlign = 'right';
    ctx.font = displayFont(15);
    ctx.fillStyle = UI.ink;
    ctx.fillText(`x${s.feverMult.toFixed(1)}`, x + w - 14, PLATE_Y + 35);
    this.rail(ctx, x + 14, PLATE_Y + 38, w - 28, s.feverProgress, s.feverColor);
  }

  private renderPowerUps(ctx: CanvasRenderingContext2D, s: HudState): void {
    const y = DECK_Y + 8;
    let x = 12;
    for (const p of s.powerUps.slice(0, 4)) {
      const style = POWERUP_CONFIG[p.type];
      const w = 112;
      plate(ctx, x, y, w, 30, { cut: 6, strip: null });
      icon(ctx, style.icon, x + 16, y + 14, 14, style.color);
      ctx.textAlign = 'left';
      ctx.font = sansFont(10, 800);
      ctx.fillStyle = UI.ink;
      ctx.fillText(style.label, x + 30, y + 15);
      ctx.textAlign = 'right';
      ctx.font = monoFont(10, 700);
      ctx.fillStyle = UI.inkMuted;
      ctx.fillText(Math.max(0, p.left).toFixed(1), x + w - 9, y + 15);
      this.rail(ctx, x + 30, y + 21, w - 39, p.left / p.max, style.color);
      x += w + 6;
    }
  }

  private renderHull(ctx: CanvasRenderingContext2D, s: HudState): void {
    const y = DECK_Y + 23;
    eyebrow(ctx, 'HULL', VIEW_W - 108, y + 4, 'right');
    for (let i = 0; i < s.maxLives; i++) {
      const cx = VIEW_W - 88 + i * 30;
      const alive = i < s.lives;
      const last = alive && s.lives === 1;
      ctx.save();
      wedgePath(ctx, cx, y, 18, 20);
      if (alive) {
        ctx.globalAlpha = last
          ? 0.55 + 0.45 * Math.abs(Math.sin(s.time * 6))
          : 1;
        ctx.fillStyle = last ? UI.bad : SHIP.hull;
        ctx.fill();
      } else {
        ctx.strokeStyle = UI.lineStrong;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  private rail(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    t: number,
    color: string
  ): void {
    const k = Math.max(0, Math.min(1, t));
    ctx.fillStyle = 'rgba(255, 255, 255, 0.09)';
    ctx.fillRect(x, y, w, 3);
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w * k, 3);
  }

  // ======================================================= popups ====

  renderPopups(ctx: CanvasRenderingContext2D, popups: Popup[]): void {
    ctx.save();
    ctx.textBaseline = 'middle';
    for (const p of popups) {
      const k = p.life / p.max;
      const y = p.y - (1 - k) * 34;
      ctx.globalAlpha = Math.min(1, k / 0.4);
      ctx.font = sansFont(11, 800);
      const lw = p.label ? ctx.measureText(`${p.label} `).width : 0;
      ctx.font = monoFont(13, 800);
      const vw = ctx.measureText(p.value).width;
      let x = p.x - (lw + vw) / 2;
      ctx.textAlign = 'left';
      if (p.label) {
        ctx.font = sansFont(11, 800);
        ctx.fillStyle = UI.ink;
        ctx.fillText(p.label, x, y);
        x += lw;
      }
      ctx.font = monoFont(13, 800);
      ctx.fillStyle = p.color;
      ctx.fillText(p.value, x, y);
    }
    ctx.restore();
  }

  // ======================================================== ready ====

  /** `t` 0..1 through the READY beat. */
  renderReady(ctx: CanvasRenderingContext2D, accent: string, t: number): void {
    const w = 548;
    const h = 232;
    const x = (VIEW_W - w) / 2;
    const y = 158;
    ctx.save();
    ctx.globalAlpha = Math.min(1, t * 8);
    plate(ctx, x, y, w, h, {
      strip: accent,
      cut: 12,
      fill: 'rgba(6, 9, 18, 0.94)',
    });

    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    ctx.font = displayFont(28, 800);
    ctx.fillStyle = UI.ink;
    ctx.fillText('TAP DODGE', x + 26, y + 50);
    ctx.textAlign = 'right';
    ctx.font = sansFont(12, 600);
    ctx.fillStyle = UI.inkMuted;
    ctx.fillText('Five lanes down. Read the gaps.', x + w - 26, y + 48);
    ctx.fillStyle = UI.line;
    ctx.fillRect(x + 26, y + 66, w - 52, 1);

    const cols: Array<{
      title: string;
      sub: string;
      keys: Array<'left' | 'right' | 'up' | 'down'>;
      letters: string;
      touch: string;
    }> = [
      {
        title: 'HOP',
        sub: 'change lane',
        keys: ['left', 'right'],
        letters: 'A  D',
        touch: 'tap a side, or drag',
      },
      {
        title: 'JUMP',
        sub: 'over LOW beams',
        keys: ['up'],
        letters: 'W',
        touch: 'swipe up',
      },
      {
        title: 'DUCK',
        sub: 'under HIGH beams',
        keys: ['down'],
        letters: 'S',
        touch: 'swipe down',
      },
    ];
    const colW = (w - 52) / 3;
    cols.forEach((c, i) => {
      const cx = x + 26 + i * colW;
      ctx.strokeStyle = accent;
      if (c.title === 'HOP') {
        chevron(ctx, cx + 8, y + 94, 14, 'left', 2.5);
        chevron(ctx, cx + 22, y + 94, 14, 'right', 2.5);
      } else {
        chevronPair(
          ctx,
          cx + 15,
          y + 94,
          14,
          c.title === 'JUMP' ? 'up' : 'down',
          2.5
        );
      }
      ctx.textAlign = 'left';
      ctx.font = sansFont(14, 800);
      ctx.fillStyle = UI.ink;
      ctx.fillText(c.title, cx + 38, y + 92);
      ctx.font = sansFont(11, 600);
      ctx.fillStyle = UI.inkFaint;
      ctx.fillText(c.sub, cx + 38, y + 108);

      c.keys.forEach((k, j) => this.keyCap(ctx, cx + j * 30, y + 124, k));
      ctx.font = monoFont(11, 700);
      ctx.fillStyle = UI.inkMuted;
      ctx.fillText(c.letters, cx + c.keys.length * 30 + 6, y + 140);
      ctx.font = sansFont(11, 600);
      ctx.fillText(c.touch, cx, y + 172);
    });

    ctx.fillStyle = 'rgba(255, 255, 255, 0.09)';
    ctx.fillRect(x + 26, y + h - 30, w - 52, 3);
    ctx.fillStyle = accent;
    ctx.fillRect(x + 26, y + h - 30, (w - 52) * Math.max(0, 1 - t), 3);
    ctx.textAlign = 'right';
    ctx.font = sansFont(11, 700);
    ctx.fillStyle = UI.ink;
    ctx.fillText('Any key or tap to start', x + w - 26, y + h - 12);
    ctx.textAlign = 'left';
    ctx.fillStyle = UI.inkFaint;
    ctx.fillText('Three hull plates. Hits reset fever.', x + 26, y + h - 12);
    ctx.restore();
  }

  private keyCap(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    dir: 'left' | 'right' | 'up' | 'down'
  ): void {
    plate(ctx, x, y, 24, 24, {
      cut: 5,
      fill: 'rgba(255, 255, 255, 0.06)',
      border: UI.lineStrong,
    });
    ctx.strokeStyle = UI.ink;
    chevron(ctx, x + 12, y + 12, 10, dir, 2);
  }
}
