// ===== src/games/tapdodge/systems/RecapRenderer.ts =====
//
// The run report: a signage plate that drops from the gantry after the
// death beat. Grade, score, best, eight drawn-icon tiles, one tip, and an
// auto-continue rail (4s) — then the run shell's summary takes over, and
// onRenderEnded keeps this card underneath it, dimmed.

import {
  UI,
  displayFont,
  ease,
  eyebrow,
  monoFont,
  sansFont,
} from '@/games/shared/hud/canvasUi';
import { chevron, icon, IconName, plate } from './icons';

export interface RunStats {
  score: number;
  best: number;
  newBest: boolean;
  survival: number;
  nearMisses: number;
  maxChain: number;
  coins: number;
  gems: number;
  maxFever: number;
  maxFeverName: string;
  zone: number;
  zoneName: string;
  rushes: number;
}

export type GradeLetter = 'S' | 'A' | 'B' | 'C' | 'D';

export interface Grade {
  letter: GradeLetter;
  caption: string;
}

/**
 * Survival carries most of the grade (up to 6 points at 150s); close passes
 * (up to 3) and the fever reached (up to 3) make up the rest.
 */
export function gradeRun(s: RunStats): Grade {
  const points =
    Math.min(6, s.survival / 25) +
    Math.min(3, s.nearMisses / 4) +
    s.maxFever * 0.75;
  if (points >= 9.5) return { letter: 'S', caption: 'CLEAN LINE' };
  if (points >= 7) return { letter: 'A', caption: 'SHARP' };
  if (points >= 5) return { letter: 'B', caption: 'STEADY' };
  if (points >= 3) return { letter: 'C', caption: 'FINDING GAPS' };
  return { letter: 'D', caption: 'WARM-UP LAP' };
}

/** One line, aimed at the thing this run left on the table. */
export function tipFor(s: RunStats): string {
  if (s.survival < 20)
    return 'Watch the gap, not the hazard. The gap is where you go.';
  if (s.nearMisses === 0)
    return 'Leave a lane late: a close pass pays 25 a link.';
  if (s.maxFever < 2)
    return 'Twenty clean seconds is HOT fever: the road pays double.';
  if (s.gems === 0)
    return 'Violet gems wait in wall gaps. Take the gap, take 250.';
  if (s.rushes === 0) return 'Fly a RUSH to its end for a 300 bonus.';
  return 'Chains stack to x5. Keep the close passes coming.';
}

const X = 120;
const Y = 82;
const W = 560;
const H = 444;

export class RecapRenderer {
  /**
   * `t` seconds since the card appeared; `hold` 0..1 through the
   * auto-continue; `settled` draws the finished state (the ended frame).
   */
  render(
    ctx: CanvasRenderingContext2D,
    s: RunStats,
    grade: Grade,
    accent: string,
    t: number,
    hold: number,
    settled = false
  ): void {
    const time = settled ? 10 : t;
    const drop = ease.outCubic(time / 0.3);
    const y = Y - 26 * (1 - drop);

    ctx.save();
    ctx.globalAlpha = Math.min(1, time / 0.2);
    plate(ctx, X, y, W, H, {
      strip: accent,
      cut: 14,
      fill: 'rgba(6, 9, 18, 0.95)',
    });
    ctx.textBaseline = 'alphabetic';

    eyebrow(ctx, 'RUN REPORT', X + 26, y + 30);
    eyebrow(
      ctx,
      `ZONE ${s.zone + 1}  ${s.zoneName}`,
      X + W - 26,
      y + 30,
      'right'
    );

    const count = Math.floor(s.score * ease.outCubic((time - 0.15) / 0.8));
    ctx.textAlign = 'left';
    ctx.font = displayFont(44, 800);
    ctx.fillStyle = UI.ink;
    ctx.fillText(String(Math.max(0, count)), X + 24, y + 86);
    ctx.font = monoFont(12, 600);
    ctx.fillStyle = UI.inkMuted;
    const bestText = `BEST ${Math.max(s.best, s.score)}`;
    ctx.fillText(bestText, X + 26, y + 112);
    if (s.newBest && time > 0.9) {
      const bx = X + 34 + ctx.measureText(bestText).width;
      plate(ctx, bx, y + 99, 78, 18, { cut: 4, fill: accent, border: accent });
      ctx.font = sansFont(10, 800);
      ctx.fillStyle = '#05070f';
      ctx.fillText('NEW BEST', bx + 10, y + 112);
    }

    this.renderGrade(ctx, grade, accent, y, time);
    this.renderTiles(ctx, s, y + 148, time);

    ctx.strokeStyle = accent;
    chevron(ctx, X + 32, y + H - 66, 10, 'right', 2);
    ctx.textAlign = 'left';
    ctx.font = sansFont(12, 600);
    ctx.fillStyle = UI.inkMuted;
    ctx.fillText(tipFor(s), X + 44, y + H - 62);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.09)';
    ctx.fillRect(X + 26, y + H - 38, W - 52, 3);
    ctx.fillStyle = accent;
    ctx.fillRect(X + 26, y + H - 38, (W - 52) * Math.max(0, 1 - hold), 3);
    ctx.textAlign = 'right';
    ctx.font = sansFont(11, 700);
    ctx.fillStyle = UI.ink;
    ctx.fillText('Tap or press any key to continue', X + W - 26, y + H - 16);
    ctx.restore();
  }

  private renderGrade(
    ctx: CanvasRenderingContext2D,
    grade: Grade,
    accent: string,
    y: number,
    t: number
  ): void {
    if (t < 0.7) return;
    const k = ease.outCubic((t - 0.7) / 0.22);
    const size = 76;
    const gx = X + W - 26 - size;
    const gy = y + 40;
    ctx.save();
    ctx.translate(gx + size / 2, gy + size / 2);
    const sc = 1.35 - 0.35 * k;
    ctx.scale(sc, sc);
    ctx.globalAlpha *= k;
    plate(ctx, -size / 2, -size / 2, size, size, {
      cut: 12,
      fill: 'rgba(255, 255, 255, 0.04)',
      border: accent,
    });
    ctx.textAlign = 'center';
    ctx.font = displayFont(44, 900);
    ctx.fillStyle = accent;
    ctx.fillText(grade.letter, 0, 16);
    ctx.restore();
    ctx.save();
    ctx.globalAlpha *= k;
    eyebrow(
      ctx,
      grade.caption,
      gx + size / 2,
      gy + size + 14,
      'center',
      UI.inkMuted
    );
    ctx.restore();
  }

  private renderTiles(
    ctx: CanvasRenderingContext2D,
    s: RunStats,
    top: number,
    t: number
  ): void {
    const tiles: Array<{
      icon: IconName;
      label: string;
      value: string;
      tint: string;
    }> = [
      {
        icon: 'clock',
        label: 'SURVIVAL',
        value: `${s.survival.toFixed(1)}s`,
        tint: '#9fd8ff',
      },
      {
        icon: 'close',
        label: 'NEAR MISSES',
        value: String(s.nearMisses),
        tint: '#ffffff',
      },
      {
        icon: 'chain',
        label: 'BEST CHAIN',
        value: `x${s.maxChain}`,
        tint: '#c9d2ff',
      },
      { icon: 'coin', label: 'COINS', value: String(s.coins), tint: UI.coin },
      { icon: 'gem', label: 'GEMS', value: String(s.gems), tint: '#d2bcff' },
      {
        icon: 'fever',
        label: 'MAX FEVER',
        value: s.maxFeverName,
        tint: '#ff8ad0',
      },
      {
        icon: 'zone',
        label: 'ZONE',
        value: `${s.zone + 1} / 4`,
        tint: '#9fe8d0',
      },
      {
        icon: 'rush',
        label: 'RUSHES',
        value: String(s.rushes),
        tint: '#ff4fa0',
      },
    ];
    const gap = 10;
    const tw = (W - 52 - gap * 3) / 4;
    const th = 84;
    tiles.forEach((tile, i) => {
      const appear = ease.outCubic((t - 0.3 - i * 0.05) / 0.25);
      if (appear <= 0) return;
      const col = i % 4;
      const row = Math.floor(i / 4);
      const x = X + 26 + col * (tw + gap);
      const y = top + row * (th + gap) + 8 * (1 - appear);
      ctx.save();
      ctx.globalAlpha *= appear;
      plate(ctx, x, y, tw, th, { cut: 7, fill: 'rgba(255, 255, 255, 0.035)' });
      icon(ctx, tile.icon, x + 22, y + 24, 20, tile.tint);
      ctx.textAlign = 'left';
      ctx.font = displayFont(18, 700);
      ctx.fillStyle = UI.ink;
      ctx.fillText(tile.value, x + 14, y + 60);
      eyebrow(ctx, tile.label, x + 14, y + 75);
      ctx.restore();
    });
  }
}
