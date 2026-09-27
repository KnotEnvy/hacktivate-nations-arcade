// ===== src/games/minesweeper/systems/HudRenderer.ts =====
//
// Fieldmark's chrome. It is an instrument, so the chrome is hardware:
// numerals sit in recessed readout windows, difficulty is a row of physical
// keys that latch down, flag mode is a toggle switch, and results arrive as
// a survey tag with an eyelet and a loop of flagging tape. Type is the
// platform's (Orbitron for titles, Inter for prose, JetBrains Mono for
// values); red means a problem; amber never appears.

import {
  UI,
  displayFont,
  monoFont,
  roundRectPath,
  sansFont,
  tracked,
} from '@/games/shared/hud/canvasUi';
import type { Difficulty } from './Board';
import { DIFFICULTIES, DIFFICULTY_ORDER } from './Board';
import type { FieldLayout, Rect } from './Layout';
import { FIELD, NUMBER_COLORS } from './palette';
import { Mood, drawFace, drawPlate, pennantIcon } from '../entities/TileArt';

export interface TagSegment {
  text: string;
  color?: string;
}

export interface BannerView {
  kind: 'clear' | 'boom';
  title: string;
  sub: TagSegment[];
  /** 0..1 fade and drop-in. */
  t: number;
}

export interface HudView {
  layout: FieldLayout;
  now: number;
  difficulty: Difficulty;
  minesLeft: number;
  /** The all-flags-placed pulse on the mines readout, 0..1 strength. */
  minesPulse: number;
  time: number;
  mood: Mood;
  facePressed: boolean;
  keysLocked: boolean;
  keyPressed: Difficulty | null;
  /** 0..1 wobble on locked keys that were pressed anyway. */
  keyNudge: number;
  flagMode: boolean;
  switchPressed: boolean;
  best: number | null;
  hint: string;
  /** 0..1 fade of the READY card. */
  readyCard: number;
  banner: BannerView | null;
}

const KEY_LABEL: Record<Difficulty, string> = {
  easy: 'EASY',
  medium: 'MEDIUM',
  hard: 'HARD',
};
const KEY_LEGEND: Record<Difficulty, string> = {
  easy: '1',
  medium: '2',
  hard: '3',
};

export class HudRenderer {
  /** The readout strip. Drawn inside the instrument's shake. */
  renderHeader(ctx: CanvasRenderingContext2D, v: HudView): void {
    const L = v.layout;
    ctx.save();
    ctx.textBaseline = 'alphabetic';
    this.readout(
      ctx,
      L.minesReadout,
      'MINES',
      v.minesLeft,
      v.minesLeft < 0 ? UI.bad : UI.ink,
      v.minesPulse
    );
    this.readout(
      ctx,
      L.timeReadout,
      'TIME',
      Math.min(999, Math.floor(v.time)),
      UI.ink,
      0
    );
    drawFace(ctx, L.face.x, L.face.y, L.face.r, v.mood, v.facePressed);
    ctx.restore();
  }

  private readout(
    ctx: CanvasRenderingContext2D,
    r: Rect,
    label: string,
    value: number,
    color: string,
    pulse: number
  ): void {
    const mid = r.y + r.h / 2;
    ctx.font = sansFont(9, 700);
    ctx.fillStyle = UI.inkFaint;
    ctx.textAlign = 'left';
    tracked(ctx, label, r.x + 10, mid + 3.5, 1.6);

    // Three places, like the dial it replaces; unused leading zeros are
    // printed faint so the value reads at a glance. Over-flagging shows a
    // minus sign, in red, because it is a problem.
    const negative = value < 0;
    const abs = String(Math.abs(value));
    const shown = negative ? `-${abs.padStart(2, '0')}` : abs.padStart(3, '0');
    const leadCount = negative ? 0 : Math.max(0, 3 - abs.length);

    ctx.font = monoFont(20, 700);
    ctx.textAlign = 'left';
    const cw = ctx.measureText('0').width || 12;
    let x = r.x + r.w - 10 - cw * shown.length;
    for (let i = 0; i < shown.length; i++) {
      const faint = i < leadCount;
      ctx.fillStyle = faint ? 'rgba(237, 239, 245, 0.16)' : color;
      if (pulse > 0 && !faint) {
        ctx.fillStyle = FIELD.lit;
        ctx.globalAlpha = 0.55 + 0.45 * pulse;
      }
      ctx.fillText(shown[i], x, mid + 7);
      ctx.globalAlpha = 1;
      x += cw;
    }
  }

  /** The desk strip: keys, switch, best time, hint. Never shakes. */
  renderFooter(ctx: CanvasRenderingContext2D, v: HudView): void {
    const L = v.layout;
    ctx.save();
    ctx.textBaseline = 'alphabetic';
    const wobble =
      v.keyNudge > 0 ? Math.sin(v.keyNudge * 28) * 3 * v.keyNudge : 0;
    for (const id of DIFFICULTY_ORDER) {
      const spec = DIFFICULTIES[id];
      const r = L.keys[id];
      this.keycap(
        ctx,
        { ...r, x: r.x + wobble },
        {
          legend: KEY_LEGEND[id],
          label: KEY_LABEL[id],
          sub: `${spec.cols}×${spec.rows}`,
          latched: id === v.difficulty,
          pressed: id === v.keyPressed && !v.keysLocked,
          locked: v.keysLocked && id !== v.difficulty,
        }
      );
    }
    this.flagSwitch(ctx, L.flagSwitch, v.flagMode, v.switchPressed);
    this.best(ctx, L.best, v.best);

    ctx.font = sansFont(11, 500);
    ctx.fillStyle = UI.inkMuted;
    ctx.textAlign = 'center';
    ctx.fillText(v.hint, L.footer.x + L.footer.w / 2, L.hintY);
    ctx.restore();
  }

  private keycap(
    ctx: CanvasRenderingContext2D,
    r: Rect,
    o: {
      legend: string;
      label: string;
      sub: string;
      latched: boolean;
      pressed: boolean;
      locked: boolean;
    }
  ): void {
    const down = o.latched || o.pressed ? 2 : 0;
    const faceH = r.h - 3;
    ctx.save();
    ctx.globalAlpha = o.locked ? 0.38 : 1;
    ctx.fillStyle = '#0a0e10';
    roundRectPath(ctx, r.x, r.y + 3, r.w, faceH, 6);
    ctx.fill();

    const top = r.y + down;
    const g = ctx.createLinearGradient(0, top, 0, top + faceH);
    g.addColorStop(0, o.latched ? '#22343a' : '#313b43');
    g.addColorStop(1, o.latched ? '#1b2a2f' : '#262f36');
    ctx.fillStyle = g;
    roundRectPath(ctx, r.x, top, r.w, faceH, 6);
    ctx.fill();
    ctx.strokeStyle = o.latched
      ? 'rgba(114, 220, 203, 0.45)'
      : FIELD.housingEdge;
    ctx.lineWidth = 1;
    roundRectPath(ctx, r.x + 0.5, top + 0.5, r.w - 1, faceH - 1, 6);
    ctx.stroke();

    const mid = top + faceH / 2;
    this.miniCap(ctx, r.x + 7, mid - 7, o.legend, o.latched);
    ctx.textAlign = 'left';
    ctx.font = sansFont(10.5, 700);
    ctx.fillStyle = o.latched ? UI.ink : UI.inkMuted;
    tracked(ctx, o.label, r.x + 27, mid + 4, 1.1);
    ctx.textAlign = 'right';
    ctx.font = monoFont(10, 600);
    ctx.fillStyle = o.latched ? FIELD.lit : UI.inkFaint;
    ctx.fillText(o.sub, r.x + r.w - 8, mid + 4);
    ctx.restore();
  }

  /** A tiny keycap carrying the keyboard shortcut. */
  private miniCap(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    legend: string,
    lit: boolean
  ): void {
    ctx.fillStyle = lit ? FIELD.litDeep : '#11171b';
    roundRectPath(ctx, x, y, 14, 14, 3);
    ctx.fill();
    ctx.strokeStyle = lit ? FIELD.lit : 'rgba(255, 255, 255, 0.14)';
    ctx.lineWidth = 1;
    roundRectPath(ctx, x + 0.5, y + 0.5, 13, 13, 3);
    ctx.stroke();
    ctx.font = monoFont(9, 700);
    ctx.textAlign = 'center';
    ctx.fillStyle = lit ? UI.ink : UI.inkMuted;
    ctx.fillText(legend, x + 7, y + 10.5);
  }

  private flagSwitch(
    ctx: CanvasRenderingContext2D,
    r: Rect,
    on: boolean,
    pressed: boolean
  ): void {
    const faceH = r.h - 3;
    const top = r.y + (pressed ? 2 : 0);
    ctx.save();
    ctx.fillStyle = '#0a0e10';
    roundRectPath(ctx, r.x, r.y + 3, r.w, faceH, 6);
    ctx.fill();
    ctx.fillStyle = '#2b343b';
    roundRectPath(ctx, r.x, top, r.w, faceH, 6);
    ctx.fill();
    ctx.strokeStyle = on ? 'rgba(255, 79, 154, 0.55)' : FIELD.housingEdge;
    ctx.lineWidth = 1;
    roundRectPath(ctx, r.x + 0.5, top + 0.5, r.w - 1, faceH - 1, 6);
    ctx.stroke();

    const mid = top + faceH / 2;
    this.miniCap(ctx, r.x + 7, mid - 7, 'F', false);

    // The switch: a track with a bone knob that throws left or right.
    const tx = r.x + 27;
    const tw = 26;
    const th = 14;
    ctx.fillStyle = on ? FIELD.tape : '#0b1013';
    roundRectPath(ctx, tx, mid - th / 2, tw, th, th / 2);
    ctx.fill();
    ctx.strokeStyle = on ? FIELD.tapeDeep : 'rgba(255, 255, 255, 0.14)';
    roundRectPath(ctx, tx + 0.5, mid - th / 2 + 0.5, tw - 1, th - 1, th / 2);
    ctx.stroke();
    const kx = on ? tx + tw - th / 2 : tx + th / 2;
    ctx.fillStyle = FIELD.bone;
    ctx.beginPath();
    ctx.arc(kx, mid, th / 2 - 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.textAlign = 'left';
    ctx.font = sansFont(10.5, 700);
    ctx.fillStyle = on ? UI.ink : UI.inkMuted;
    tracked(ctx, 'FLAG MODE', tx + tw + 9, mid + 4, 1.1);
    ctx.restore();
  }

  /** The best time for this field, in a recessed window like the header's. */
  private best(
    ctx: CanvasRenderingContext2D,
    r: Rect,
    best: number | null
  ): void {
    const h = r.h - 3;
    const mid = r.y + 1 + h / 2;
    ctx.save();
    ctx.fillStyle = FIELD.readout;
    roundRectPath(ctx, r.x, r.y + 1, r.w, h, 6);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(r.x + 6, r.y + 1 + h + 0.5);
    ctx.lineTo(r.x + r.w - 6, r.y + 1 + h + 0.5);
    ctx.stroke();
    ctx.font = sansFont(9, 700);
    ctx.fillStyle = UI.inkFaint;
    ctx.textAlign = 'left';
    tracked(ctx, 'BEST', r.x + 9, mid + 3.5, 1.6);
    ctx.textAlign = 'right';
    ctx.font = monoFont(14, 700);
    ctx.fillStyle = best === null ? 'rgba(237, 239, 245, 0.2)' : UI.ink;
    ctx.fillText(
      best === null ? '--.-' : `${best.toFixed(1)}s`,
      r.x + r.w - 9,
      mid + 5
    );
    ctx.restore();
  }

  // ------------------------------------------------------ the ready card ----

  renderReadyCard(ctx: CanvasRenderingContext2D, v: HudView): void {
    if (v.readyCard <= 0) return;
    const L = v.layout;
    const spec = DIFFICULTIES[v.difficulty];
    const w = 348;
    const h = 196;
    const cx = L.board.x + L.board.w / 2;
    const cy = L.board.y + L.board.h / 2;
    const x = Math.round(cx - w / 2);
    const y = Math.round(Math.max(8, Math.min(L.footer.y - 8 - h, cy - h / 2)));

    ctx.save();
    ctx.globalAlpha = Math.min(1, v.readyCard);
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    roundRectPath(ctx, x, y + 5, w, h, 10);
    ctx.fill();
    ctx.fillStyle = '#1a2126';
    roundRectPath(ctx, x, y, w, h, 10);
    ctx.fill();
    ctx.strokeStyle = FIELD.housingEdge;
    ctx.lineWidth = 1;
    roundRectPath(ctx, x + 0.5, y + 0.5, w - 1, h - 1, 10);
    ctx.stroke();

    // A strip of flagging tape holding the card to the instrument.
    ctx.save();
    ctx.translate(x + 30, y + 4);
    ctx.rotate(-0.5);
    ctx.fillStyle = FIELD.tape;
    ctx.globalAlpha *= 0.9;
    ctx.fillRect(-26, -7, 52, 14);
    ctx.restore();

    ctx.textAlign = 'left';
    ctx.font = displayFont(15, 800);
    ctx.fillStyle = UI.ink;
    ctx.fillText('SURVEY THE FIELD', x + 24, y + 34);
    ctx.textAlign = 'right';
    ctx.font = monoFont(11, 600);
    ctx.fillStyle = UI.inkMuted;
    ctx.fillText(
      `${spec.mines} MINES · ${spec.cols}×${spec.rows}`,
      x + w - 20,
      y + 34
    );

    const rows: Array<{
      icon: 'tap' | 'flag' | 'number' | 'keys';
      lead: string;
      rest: string;
    }> = [
      { icon: 'tap', lead: 'Tap or click', rest: 'open a tile' },
      { icon: 'flag', lead: 'Hold or right-click', rest: 'plant a flag' },
      {
        icon: 'number',
        lead: 'Tap a number',
        rest: 'open around it once flagged',
      },
      { icon: 'keys', lead: 'Arrows, Space, F', rest: 'play by keyboard' },
    ];
    let ry = y + 64;
    for (const row of rows) {
      this.cardIcon(ctx, row.icon, x + 34, ry - 4);
      ctx.textAlign = 'left';
      ctx.font = sansFont(12, 700);
      ctx.fillStyle = UI.ink;
      ctx.fillText(row.lead, x + 56, ry);
      const lw = ctx.measureText(row.lead).width;
      ctx.font = sansFont(12, 500);
      ctx.fillStyle = UI.inkMuted;
      ctx.fillText(`  ${row.rest}`, x + 56 + lw, ry);
      ry += 27;
    }
    ctx.strokeStyle = FIELD.housingEdge;
    ctx.beginPath();
    ctx.moveTo(x + 20, y + h - 32.5);
    ctx.lineTo(x + w - 20, y + h - 32.5);
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.font = sansFont(12, 700);
    ctx.fillStyle = FIELD.lit;
    ctx.fillText('First tap is always safe', x + w / 2, y + h - 12);
    ctx.restore();
  }

  private cardIcon(
    ctx: CanvasRenderingContext2D,
    icon: 'tap' | 'flag' | 'number' | 'keys',
    cx: number,
    cy: number
  ): void {
    ctx.save();
    if (icon === 'tap') {
      ctx.fillStyle = UI.ink;
      ctx.beginPath();
      ctx.arc(cx, cy, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = UI.inkMuted;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx, cy, 8, 0, Math.PI * 2);
      ctx.stroke();
    } else if (icon === 'flag') {
      pennantIcon(ctx, cx, cy, 16);
    } else if (icon === 'number') {
      drawPlate(ctx, cx - 9, cy - 9, 18);
      ctx.font = monoFont(12, 800);
      ctx.textAlign = 'center';
      ctx.fillStyle = NUMBER_COLORS[2];
      ctx.fillText('2', cx, cy + 4.5);
    } else {
      ctx.strokeStyle = UI.inkMuted;
      ctx.lineWidth = 1.2;
      roundRectPath(ctx, cx - 9, cy - 8, 18, 16, 3);
      ctx.stroke();
      ctx.fillStyle = UI.ink;
      ctx.beginPath();
      ctx.moveTo(cx - 4, cy + 3);
      ctx.lineTo(cx, cy - 3);
      ctx.lineTo(cx + 4, cy + 3);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  // ------------------------------------------------------------ the tag ----

  /**
   * The result, as a survey tag: a chamfered card with a punched eyelet and
   * a loop of flagging tape. Bone for a clear; charred slate edged in red
   * for a loss.
   */
  renderTag(ctx: CanvasRenderingContext2D, v: HudView): void {
    const b = v.banner;
    if (!b || b.t <= 0) return;
    const L = v.layout;
    const clear = b.kind === 'clear';
    const k = Math.min(1, b.t);
    const drop = (1 - k) * -14;

    ctx.save();
    ctx.globalAlpha = k;
    ctx.textBaseline = 'alphabetic';
    ctx.font = displayFont(30, 800);
    const tw = ctx.measureText(b.title).width;
    ctx.font = monoFont(13, 600);
    let sw = 0;
    for (const seg of b.sub) sw += ctx.measureText(seg.text).width;
    const w = Math.max(250, Math.max(tw, sw) + 120);
    const h = 90;
    const cx = L.board.x + L.board.w / 2;
    const cy = L.board.y + L.board.h / 2 + drop;
    const x = cx - w / 2;
    const y = cy - h / 2;

    const path = (): void => {
      const ch = 20;
      ctx.beginPath();
      ctx.moveTo(x + ch, y);
      ctx.lineTo(x + w - 7, y);
      ctx.arcTo(x + w, y, x + w, y + 7, 7);
      ctx.lineTo(x + w, y + h - 7);
      ctx.arcTo(x + w, y + h, x + w - 7, y + h, 7);
      ctx.lineTo(x + ch, y + h);
      ctx.lineTo(x, y + h - ch);
      ctx.lineTo(x, y + ch);
      ctx.closePath();
    };

    ctx.save();
    ctx.translate(0, 5);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    path();
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = clear ? FIELD.bone : '#171b1e';
    path();
    ctx.fill();
    ctx.strokeStyle = clear ? 'rgba(0, 0, 0, 0.25)' : UI.bad;
    ctx.lineWidth = clear ? 1 : 1.5;
    path();
    ctx.stroke();

    // Eyelet, and the tape looped through it.
    const hx = x + 22;
    ctx.fillStyle = FIELD.deskDeep;
    ctx.beginPath();
    ctx.arc(hx, cy, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = clear ? FIELD.boneDeep : UI.badDim;
    ctx.lineWidth = 2;
    ctx.stroke();
    if (clear) {
      // Two tails of flagging tape knotted through the eyelet.
      tapeTail(ctx, hx, cy, hx - 40, cy + 20, 7, FIELD.tapeDeep);
      tapeTail(ctx, hx, cy, hx - 22, cy + 38, 7, FIELD.tape);
      ctx.fillStyle = FIELD.tape;
      ctx.beginPath();
      ctx.arc(hx, cy, 4.5, 0, Math.PI * 2);
      ctx.fill();
    }

    const tx = cx + 12;
    ctx.textAlign = 'center';
    ctx.font = displayFont(30, 800);
    ctx.fillStyle = clear ? '#1d1a16' : UI.bad;
    ctx.fillText(b.title, tx, y + 44);

    ctx.font = monoFont(13, 600);
    let total = 0;
    for (const seg of b.sub) total += ctx.measureText(seg.text).width;
    let sx = tx - total / 2;
    ctx.textAlign = 'left';
    for (const seg of b.sub) {
      ctx.fillStyle = seg.color ?? (clear ? '#4a453d' : UI.inkMuted);
      ctx.fillText(seg.text, sx, y + 70);
      sx += ctx.measureText(seg.text).width;
    }
    ctx.restore();
  }
}

/** A strip of tape from (x0, y0) to (x1, y1), its free end cut in a V. */
function tapeTail(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  width: number,
  color: string
): void {
  const len = Math.hypot(x1 - x0, y1 - y0) || 1;
  const dx = (x1 - x0) / len;
  const dy = (y1 - y0) / len;
  const nx = -dy * (width / 2);
  const ny = dx * (width / 2);
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x0 + nx, y0 + ny);
  ctx.lineTo(x1 + nx, y1 + ny);
  ctx.lineTo(x1 - dx * width * 0.7, y1 - dy * width * 0.7);
  ctx.lineTo(x1 - nx, y1 - ny);
  ctx.lineTo(x0 - nx, y0 - ny);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
