// ===== src/games/memory/systems/HudRenderer.ts =====
//
// Every pixel of chrome Memory Match draws. The house look: no floating
// panels. Values are set straight into the leather rails like engraving on
// a card table's edge — tracked caps in mauve, figures in ivory, a rose
// rhombus as the only ornament. Announcements are ivory placards laid on the
// baize, printed in ink, the way a dealer would set down a card.
//
// Platform type throughout (Orbitron figures, Inter prose, JetBrains Mono
// values). Emerald means earned, red means a problem, and amber is never
// used because nothing on this table is currency.

import {
  displayFont,
  edgeVignette,
  monoFont,
  roundRectPath,
  sansFont,
  tracked,
  trackedWidth,
  withAlpha,
} from '@/games/shared/hud/canvasUi';
import { BOTTOM_BAND, TOP_BAND } from '../entities/Card';
import {
  arrowGlyph,
  cardPairMark,
  eye,
  flameMark,
  hourglass,
  keycap,
  lamp,
  rhombus,
} from './glyphs';
import { P } from './palette';
import { clockText, Mode, TableResult } from './rules';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface HudState {
  score: number;
  mode: Mode;
  bestText: string;
  table: number;
  tables: number;
  moves: number;
  par: number;
  /** Elapsed (CLASSIC) or remaining (TIMED) seconds on this table. */
  seconds: number;
  /** TIMED: the table's clock, for the hourglass. */
  clock: number;
  streak: number;
  pairsFound: number;
  pairsTotal: number;
  peekUsed: boolean;
  hintCooldown: number;
  hintMax: number;
  /** Power-ups can be used right now (no compare, peek or beat running). */
  powersOpen: boolean;
  hintLine: string;
  touch: boolean;
  hover: 'peek' | 'hint' | null;
  /** Monotonic seconds for flicker; read only. */
  time: number;
}

export interface Placard {
  eyebrow: string;
  title: string;
  lines: string[];
  /** Bonus figures, printed in emerald ink. */
  bonus?: string;
  tag?: string;
  /** Problem placards carry a red rule instead of a rose one. */
  problem?: boolean;
  alpha: number;
}

const LABEL = P.textMuted;

export class HudRenderer {
  constructor(
    private width: number,
    private height: number
  ) {}

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
  }

  /** Where the two power-up plates sit (also their touch targets). */
  plates(): { peek: Rect; hint: Rect } {
    const y = this.height - BOTTOM_BAND + 13;
    const w = 140;
    const h = 38;
    const cx = this.width / 2 - 20;
    return {
      peek: { x: cx - w - 6, y, w, h },
      hint: { x: cx + 6, y, w, h },
    };
  }

  // ================================================================ rails ==

  renderRails(ctx: CanvasRenderingContext2D, s: HudState): void {
    ctx.save();
    ctx.textBaseline = 'alphabetic';
    this.renderTop(ctx, s);
    this.renderBottom(ctx, s);
    if (s.mode === 'timed' && s.seconds < 10 && s.seconds > 0) {
      const pulse = 0.5 + 0.5 * Math.sin(s.time * 7);
      edgeVignette(ctx, this.width, this.height, P.bad, 0.5 + pulse * 0.35);
    }
    ctx.restore();
  }

  private label(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    align: 'left' | 'center' | 'right' = 'left',
    ornament = false
  ): void {
    ctx.font = sansFont(9, 700);
    ctx.fillStyle = LABEL;
    ctx.textAlign = 'left';
    const w = trackedWidth(ctx, text, 1.6) + (ornament ? 9 : 0);
    let sx = align === 'right' ? x - w : align === 'center' ? x - w / 2 : x;
    if (ornament) {
      rhombus(ctx, sx + 2.5, y - 3.5, 3.5, P.rose);
      sx += 9;
      ctx.fillStyle = LABEL;
    }
    tracked(ctx, text, sx, y, 1.6);
  }

  private divider(ctx: CanvasRenderingContext2D, x: number): void {
    ctx.fillStyle = 'rgba(244, 234, 216, 0.10)';
    ctx.fillRect(Math.round(x), 13, 1, 30);
  }

  private renderTop(ctx: CanvasRenderingContext2D, s: HudState): void {
    // Left: the score, and this grid's best in this mode.
    this.label(ctx, 'SCORE', 20, 19, 'left', true);
    ctx.textAlign = 'left';
    if (s.score > 0) {
      ctx.fillStyle = P.text;
      ctx.font = displayFont(22);
      ctx.fillText(s.score.toLocaleString('en-US'), 20, 45);
    } else {
      this.nothingYet(ctx, 20, 43, 16);
    }

    this.label(ctx, s.mode === 'classic' ? 'BEST MOVES' : 'BEST TIME', 156, 19);
    ctx.fillStyle = s.bestText === '—' ? P.textFaint : P.text;
    ctx.font = monoFont(14, 600);
    ctx.fillText(s.bestText, 156, 43);

    // Centre: table, moves against par, the clock.
    const c1 = this.width / 2 - 106;
    const c2 = this.width / 2;
    const c3 = this.width / 2 + 112;
    this.divider(ctx, (c1 + c2) / 2 + 2);
    this.divider(ctx, (c2 + c3) / 2 - 4);

    this.label(ctx, 'TABLE', c1, 19, 'center');
    this.figureWithTail(ctx, String(s.table), `/${s.tables}`, c1, 44, P.text);

    this.label(ctx, 'MOVES', c2, 19, 'center');
    const over = s.moves > s.par;
    this.figureWithTail(
      ctx,
      String(s.moves),
      ` / par ${s.par}`,
      c2,
      44,
      P.text,
      over ? P.textFaint : P.textMuted
    );

    this.label(ctx, s.mode === 'timed' ? 'CLOCK' : 'TIME', c3, 19, 'center');
    const low = s.mode === 'timed' && s.seconds < 10;
    const color = low ? P.bad : P.text;
    const txt = clockText(s.seconds);
    ctx.font = monoFont(16, 700);
    const tw = ctx.measureText(txt).width;
    const sand =
      s.mode === 'timed'
        ? s.seconds / Math.max(1, s.clock)
        : 1 - ((s.seconds / 30) % 1);
    hourglass(ctx, c3 - tw / 2 - 8, 39, 15, sand, low ? P.bad : P.textMuted);
    ctx.textAlign = 'left';
    ctx.fillStyle = color;
    ctx.font = monoFont(16, 700);
    ctx.fillText(txt, c3 - tw / 2 + 4, 45);

    // Right: the streak, lit once there is one worth naming.
    const rx = this.width - 20;
    this.label(ctx, 'STREAK', rx, 19, 'right');
    if (s.streak >= 2) {
      ctx.font = displayFont(20);
      const txt2 = `${s.streak}`;
      const w2 = ctx.measureText(txt2).width;
      ctx.textAlign = 'right';
      ctx.fillStyle = P.text;
      ctx.fillText(txt2, rx, 45);
      ctx.font = sansFont(11, 700);
      ctx.fillStyle = P.rose;
      const x2 = rx - w2 - 5;
      ctx.fillText('\u00d7', x2, 45);
      const flicker = Math.sin(s.time * 13) * 0.6 + Math.sin(s.time * 29) * 0.4;
      flameMark(
        ctx,
        x2 - 18,
        37,
        18 + Math.min(6, s.streak - 2) * 1.2,
        flicker
      );
    } else {
      ctx.textAlign = 'right';
      ctx.fillStyle = P.textFaint;
      ctx.font = monoFont(14, 600);
      ctx.fillText('—', rx, 43);
    }
  }

  /**
   * The rail's "nothing on the board yet": a faint mono dash, the same mark
   * BEST and STREAK use. Orbitron's lone zero reads as a slashed O, so a
   * headline figure is never drawn as a bare 0.
   */
  private nothingYet(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number
  ): number {
    ctx.fillStyle = P.textFaint;
    ctx.font = monoFont(size, 600);
    ctx.fillText('—', x, y);
    return ctx.measureText('—').width;
  }

  /** A big Orbitron figure with a small mono tail, centred as one unit. */
  private figureWithTail(
    ctx: CanvasRenderingContext2D,
    figure: string,
    tail: string,
    cx: number,
    y: number,
    color: string,
    tailColor: string = P.textMuted
  ): void {
    const empty = figure === '0';
    ctx.font = empty ? monoFont(15, 600) : displayFont(19);
    const fw = ctx.measureText(empty ? '—' : figure).width;
    ctx.font = monoFont(11, 600);
    const tw = ctx.measureText(tail).width;
    const x = cx - (fw + tw + 2) / 2;
    ctx.textAlign = 'left';
    if (empty) {
      this.nothingYet(ctx, x, y - 1, 15);
    } else {
      ctx.fillStyle = color;
      ctx.font = displayFont(19);
      ctx.fillText(figure, x, y);
    }
    ctx.fillStyle = tailColor;
    ctx.font = monoFont(11, 600);
    ctx.fillText(tail, x + fw + 2, y);
  }

  private renderBottom(ctx: CanvasRenderingContext2D, s: HudState): void {
    const top = this.height - BOTTOM_BAND;

    // The dealer's line.
    ctx.textAlign = 'left';
    ctx.font = sansFont(12, 500);
    ctx.fillStyle = P.textMuted;
    rhombus(ctx, 23, top + 32, 3.5, P.roseDeep);
    ctx.fillStyle = P.textMuted;
    ctx.fillText(this.fit(ctx, s.hintLine, 196), 33, top + 36);

    const { peek, hint } = this.plates();
    this.plate(ctx, peek, {
      title: 'PEEK',
      sub: s.peekUsed ? 'used this table' : '\u221230 · once a table',
      key: 'P',
      ready: !s.peekUsed && s.powersOpen,
      hover: s.hover === 'peek',
      rail: null,
      touch: s.touch,
      icon: (x, y, c) => eye(ctx, x, y, 17, c),
    });
    const cooling = s.hintCooldown > 0;
    this.plate(ctx, hint, {
      title: 'HINT',
      sub: cooling
        ? `ready in ${Math.ceil(s.hintCooldown)}s`
        : '\u221215 · shows a pair',
      key: 'H',
      ready: !cooling && s.powersOpen,
      hover: s.hover === 'hint',
      rail: cooling ? 1 - s.hintCooldown / s.hintMax : null,
      touch: s.touch,
      icon: (x, y, c) => lamp(ctx, x, y + 1, 17, c, !cooling),
    });

    // Pairs: one small card per pair, filled as they are won.
    const n = s.pairsTotal;
    const pw = 7;
    const gap = n > 12 ? 2.5 : 4;
    const rowW = n * pw + (n - 1) * gap;
    const rx = this.width - 20;
    this.label(ctx, 'PAIRS', rx - rowW, top + 24);
    ctx.textAlign = 'right';
    ctx.font = monoFont(11, 600);
    ctx.fillStyle = P.text;
    ctx.fillText(`${s.pairsFound}/${n}`, rx, top + 24);
    for (let i = 0; i < n; i++) {
      const x = rx - rowW + i * (pw + gap);
      const y = top + 32;
      roundRectPath(ctx, x + 0.5, y + 0.5, pw - 1, 10, 1.5);
      if (i < s.pairsFound) {
        ctx.fillStyle = P.ivory;
        ctx.fill();
      } else {
        ctx.strokeStyle = 'rgba(244, 234, 216, 0.28)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
  }

  private plate(
    ctx: CanvasRenderingContext2D,
    r: Rect,
    o: {
      title: string;
      sub: string;
      key: string;
      ready: boolean;
      hover: boolean;
      rail: number | null;
      touch: boolean;
      icon: (x: number, y: number, color: string) => void;
    }
  ): void {
    ctx.save();
    ctx.globalAlpha = o.ready ? 1 : 0.5;
    roundRectPath(ctx, r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1, 8);
    ctx.fillStyle =
      o.hover && o.ready ? 'rgba(242, 166, 194, 0.10)' : 'rgba(10, 4, 8, 0.45)';
    ctx.fill();
    ctx.strokeStyle = o.ready
      ? withAlpha(P.rose, o.hover ? 0.85 : 0.45)
      : 'rgba(244, 234, 216, 0.16)';
    ctx.lineWidth = 1;
    ctx.stroke();

    const ink = o.ready ? P.text : P.textMuted;
    o.icon(r.x + 17, r.y + r.h / 2, o.ready ? P.rose : P.textMuted);
    ctx.textAlign = 'left';
    ctx.fillStyle = ink;
    ctx.font = sansFont(12, 700);
    ctx.fillText(o.title, r.x + 32, r.y + 16);
    ctx.fillStyle = P.textFaint;
    ctx.font = sansFont(10, 500);
    ctx.fillText(o.sub, r.x + 32, r.y + 29);

    if (!o.touch) {
      const kx = r.x + r.w - 21;
      const ky = r.y + 7;
      keycap(ctx, kx, ky, 15, 15, withAlpha(P.ivory, 0.4));
      ctx.textAlign = 'center';
      ctx.fillStyle = P.textMuted;
      ctx.font = monoFont(9, 700);
      ctx.fillText(o.key, kx + 7.5, ky + 10.5);
    }
    if (o.rail !== null) {
      ctx.fillStyle = 'rgba(244, 234, 216, 0.08)';
      ctx.fillRect(r.x + 8, r.y + r.h - 4, r.w - 16, 2);
      ctx.fillStyle = P.rose;
      ctx.fillRect(r.x + 8, r.y + r.h - 4, (r.w - 16) * o.rail, 2);
    }
    ctx.restore();
  }

  private fit(
    ctx: CanvasRenderingContext2D,
    text: string,
    max: number
  ): string {
    if (ctx.measureText(text).width <= max) return text;
    let t = text;
    while (t.length > 1 && ctx.measureText(`${t}...`).width > max)
      t = t.slice(0, -1);
    return `${t}...`;
  }

  // ============================================================= placards ==

  /** An ivory placard laid on the baize, printed in ink. */
  renderPlacard(ctx: CanvasRenderingContext2D, p: Placard, cy?: number): void {
    if (p.alpha <= 0) return;
    ctx.save();
    ctx.globalAlpha = Math.min(1, p.alpha);
    ctx.textBaseline = 'alphabetic';

    ctx.font = displayFont(20);
    let w = ctx.measureText(p.title).width;
    ctx.font = sansFont(12, 600);
    for (const l of p.lines) w = Math.max(w, ctx.measureText(l).width);
    if (p.bonus) {
      ctx.font = monoFont(12, 700);
      w = Math.max(w, ctx.measureText(p.bonus).width);
    }
    w = Math.max(260, w + 64);
    const h = 70 + p.lines.length * 19 + (p.bonus ? 22 : 0) + (p.tag ? 28 : 0);
    const x = Math.round(this.width / 2 - w / 2);
    const midY = cy ?? TOP_BAND + (this.height - TOP_BAND - BOTTOM_BAND) / 2;
    const y = Math.round(midY - h / 2);

    this.paper(ctx, x, y, w, h);

    const rule = p.problem ? P.bad : P.roseDeep;
    ctx.fillStyle = rule;
    ctx.fillRect(x + 22, y + 22, w - 44, 1);
    ctx.font = sansFont(9, 800);
    const ew = trackedWidth(ctx, p.eyebrow, 2);
    ctx.fillStyle = P.ivory;
    ctx.fillRect(this.width / 2 - ew / 2 - 10, y + 16, ew + 20, 12);
    ctx.fillStyle = rule;
    ctx.textAlign = 'left';
    tracked(ctx, p.eyebrow, this.width / 2 - ew / 2, y + 26, 2);

    ctx.textAlign = 'center';
    ctx.fillStyle = P.ink;
    ctx.font = displayFont(20);
    ctx.fillText(p.title, this.width / 2, y + 54);

    let ly = y + 76;
    ctx.font = sansFont(12, 600);
    ctx.fillStyle = P.inkSoft;
    for (const l of p.lines) {
      ctx.fillText(l, this.width / 2, ly);
      ly += 19;
    }
    if (p.bonus) {
      ctx.font = monoFont(12, 700);
      ctx.fillStyle = P.goodDim;
      ctx.fillText(p.bonus, this.width / 2, ly + 3);
    }
    if (p.tag) {
      ctx.font = sansFont(9, 800);
      const tw = trackedWidth(ctx, p.tag, 1.6) + 16;
      const tx = this.width / 2 - tw / 2;
      const ty = y + h - 34;
      roundRectPath(ctx, tx, ty, tw, 16, 8);
      ctx.fillStyle = P.roseDeep;
      ctx.fill();
      ctx.fillStyle = P.ivory;
      ctx.textAlign = 'left';
      tracked(ctx, p.tag, tx + 8, ty + 11.5, 1.6);
    }
    ctx.restore();
  }

  /** Ivory stock with a soft contact shadow and a hairline border. */
  private paper(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number
  ) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    roundRectPath(ctx, x + 2, y + 5, w, h, 12);
    ctx.fill();
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, P.ivory);
    g.addColorStop(1, P.ivoryShade);
    ctx.fillStyle = g;
    roundRectPath(ctx, x, y, w, h, 12);
    ctx.fill();
    ctx.strokeStyle = P.ivoryEdge;
    ctx.lineWidth = 1;
    ctx.stroke();
    roundRectPath(ctx, x + 6, y + 6, w - 12, h - 12, 8);
    ctx.strokeStyle = 'rgba(110, 88, 102, 0.25)';
    ctx.stroke();
  }

  // ============================================================ mode card ==

  /** Mode tickets, as touch targets. */
  modeTickets(): { classic: Rect; timed: Rect } {
    const w = 190;
    const h = 100;
    const y = this.height / 2 - 52;
    return {
      classic: { x: this.width / 2 - w - 8, y, w, h },
      timed: { x: this.width / 2 + 8, y, w, h },
    };
  }

  renderModeCard(
    ctx: CanvasRenderingContext2D,
    selected: Mode,
    hover: Mode | null,
    touch: boolean,
    bests: { classic: string; timed: string }
  ): void {
    ctx.save();
    ctx.fillStyle = 'rgba(8, 3, 7, 0.45)';
    ctx.fillRect(0, TOP_BAND, this.width, this.height - TOP_BAND - BOTTOM_BAND);

    const w = 452;
    const h = 330;
    const x = this.width / 2 - w / 2;
    const y = TOP_BAND + (this.height - TOP_BAND - BOTTOM_BAND - h) / 2;
    this.paper(ctx, x, y, w, h);

    const cx = this.width / 2;
    ctx.fillStyle = P.roseDeep;
    ctx.fillRect(cx - 90, y + 30, 70, 1);
    ctx.fillRect(cx + 20, y + 30, 70, 1);
    rhombus(ctx, cx, y + 30, 6, P.roseDeep);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = P.ink;
    ctx.font = displayFont(26);
    ctx.fillText('MEMORY MATCH', cx, y + 70);
    ctx.fillStyle = P.inkSoft;
    ctx.font = sansFont(12, 500);
    ctx.fillText(
      'Five tables, each one bigger. Every pair starts face down.',
      cx,
      y + 92
    );

    const t = this.modeTickets();
    this.ticket(
      ctx,
      t.classic,
      'CLASSIC',
      ['No clock.', 'Play for the fewest moves.'],
      bests.classic,
      selected === 'classic',
      hover === 'classic',
      'classic'
    );
    this.ticket(
      ctx,
      t.timed,
      'TIMED',
      ['A clock on every table.', 'Run out and the night ends.'],
      bests.timed,
      selected === 'timed',
      hover === 'timed',
      'timed'
    );

    // How to deal.
    const ly = y + h - 58;
    ctx.font = sansFont(11, 600);
    ctx.fillStyle = P.inkSoft;
    if (touch) {
      ctx.textAlign = 'center';
      ctx.fillText('Tap a mode to deal.', cx, ly);
    } else {
      const parts = 'Click a mode, or';
      const after = 'then SPACE to deal.';
      const pw = ctx.measureText(parts).width;
      const aw = ctx.measureText(after).width;
      const total = pw + 8 + 40 + 8 + aw;
      let sx = cx - total / 2;
      ctx.textAlign = 'left';
      ctx.fillText(parts, sx, ly);
      sx += pw + 8;
      for (const d of [-1, 1] as const) {
        keycap(ctx, sx, ly - 12, 17, 16, withAlpha(P.ink, 0.45));
        arrowGlyph(ctx, sx + 8.5, ly - 4.5, d, P.inkSoft);
        sx += 21;
      }
      sx += 6;
      ctx.fillStyle = P.inkSoft;
      ctx.fillText(after, sx, ly);
    }
    ctx.font = sansFont(11, 500);
    ctx.fillStyle = withAlpha(P.ink, 0.55);
    ctx.textAlign = 'center';
    ctx.fillText(
      touch
        ? 'In play: tap a card to turn it. PEEK and HINT sit on the rail.'
        : 'In play: click a card, or arrows + SPACE.  P peek  ·  H hint',
      cx,
      ly + 22
    );
    ctx.restore();
  }

  private ticket(
    ctx: CanvasRenderingContext2D,
    r: Rect,
    title: string,
    lines: string[],
    best: string,
    selected: boolean,
    hover: boolean,
    mode: Mode
  ): void {
    ctx.save();
    roundRectPath(ctx, r.x, r.y, r.w, r.h, 10);
    if (selected) {
      ctx.fillStyle = P.felt;
      ctx.fill();
      ctx.strokeStyle = P.rose;
      ctx.lineWidth = 2;
      ctx.stroke();
    } else {
      ctx.fillStyle = hover
        ? 'rgba(42, 20, 38, 0.08)'
        : 'rgba(42, 20, 38, 0.03)';
      ctx.fill();
      ctx.strokeStyle = withAlpha(P.ink, hover ? 0.5 : 0.25);
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    const ink = selected ? P.text : P.ink;
    const soft = selected ? P.textMuted : P.inkSoft;
    if (mode === 'classic')
      cardPairMark(ctx, r.x + 22, r.y + 24, 20, selected ? P.rose : P.roseDeep);
    else
      hourglass(
        ctx,
        r.x + 22,
        r.y + 24,
        18,
        0.6,
        selected ? P.rose : P.roseDeep
      );
    ctx.textAlign = 'left';
    ctx.fillStyle = ink;
    ctx.font = displayFont(15);
    ctx.fillText(title, r.x + 40, r.y + 30);
    ctx.font = sansFont(11, 500);
    ctx.fillStyle = soft;
    ctx.fillText(lines[0], r.x + 16, r.y + 56);
    ctx.fillText(lines[1], r.x + 16, r.y + 72);
    ctx.font = monoFont(10, 600);
    ctx.fillStyle = selected ? P.rose : P.roseDeep;
    ctx.fillText(best, r.x + 16, r.y + 90);
    ctx.restore();
  }

  // ======================================================= table results ==

  static clearPlacard(r: TableResult, name: string, alpha: number): Placard {
    const bonusParts = [
      r.parBonus > 0 ? `PAR +${r.parBonus}` : 'PAR  -',
      `TIME +${r.timeBonus}`,
    ];
    return {
      eyebrow: `TABLE ${r.table} CLEARED`,
      title: name.toUpperCase(),
      lines: [`${r.moves} moves  ·  par ${r.par}  ·  ${clockText(r.seconds)}`],
      bonus: bonusParts.join('    '),
      tag: r.newBest ? 'NEW BEST' : undefined,
      alpha,
    };
  }
}
