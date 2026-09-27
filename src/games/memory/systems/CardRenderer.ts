// ===== src/games/memory/systems/CardRenderer.ts =====
//
// How a card sits on the table: dealt in an arc from the stack, lifted by
// hover or the keyboard cursor, turned with a 3D scale-x and a highlight
// sweep as it passes edge-on, popped and ringed emerald on a match, shaken
// with a red edge on a miss, fanned away on a table clear. Every number it
// reads is advanced by the game's update; this only draws.

import { ease, roundRectPath, withAlpha } from '@/games/shared/hud/canvasUi';
import { Card, GridLayout } from '../entities/Card';
import { CardArt, cardRadius } from './CardArt';
import { checkBadge } from './glyphs';
import { drawIcon } from './icons';
import { P } from './palette';
import { GHOST_TIME, POP_TIME, PULSE_TIME, SHAKE_TIME } from './rules';

/** What the renderer needs to know about the table this frame. */
export interface TableView {
  cards: readonly Card[];
  layout: GridLayout | null;
  /** Table index, for the back design. */
  table: number;
  /** The stack is drawn only while dealing. */
  dealing: boolean;
  /** The card under the keyboard cursor, or null when it is hidden. */
  cursor: Card | null;
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

export class CardRenderer {
  constructor(private art: CardArt) {}

  /** Where the deck sits while it is being dealt. */
  stackPos(l: GridLayout): { x: number; y: number } {
    return {
      x: Math.max(18, l.originX - l.cardW - 44),
      y: l.originY + l.height / 2 - l.cardH / 2,
    };
  }

  private renderStack(ctx: CanvasRenderingContext2D, v: TableView): void {
    if (!v.dealing || !v.layout) return;
    const waiting = v.cards.filter(c => c.deal <= 0).length;
    if (waiting === 0) return;
    const { x, y } = this.stackPos(v.layout);
    const { cardW: w, cardH: h } = v.layout;
    const layers = Math.min(6, Math.ceil(waiting / 3));
    for (let i = 0; i < layers; i++) {
      const ox = x - i * 1.5;
      const oy = y - i * 1.5;
      ctx.fillStyle = 'rgba(8, 2, 6, 0.35)';
      roundRectPath(ctx, ox + 1, oy + 3, w, h, cardRadius(w));
      ctx.fill();
      this.art.drawBack(ctx, v.table, ox, oy, w, h);
    }
  }

  /** The stack (while dealing), every card, then the keyboard cursor. */
  render(ctx: CanvasRenderingContext2D, v: TableView): void {
    this.renderStack(ctx, v);
    const raised: Card[] = [];
    for (const c of v.cards) {
      if (c.deal <= 0) continue;
      const moving =
        c.deal < 1 ||
        c.leave > 0 ||
        c.pop > 0 ||
        c.hover > 0.01 ||
        (c.shown > 0 && c.shown < 1);
      if (moving) raised.push(c);
      else this.drawCard(ctx, c, v);
    }
    for (const c of raised) this.drawCard(ctx, c, v);
    if (v.cursor) this.renderCursor(ctx, v.cursor);
  }

  private drawCard(ctx: CanvasRenderingContext2D, c: Card, v: TableView): void {
    let x = c.x;
    let y = c.y;
    let rot = 0;
    let alpha = 1;
    if (c.deal < 1) {
      const k = ease.outCubic(c.deal);
      const s = v.layout ? this.stackPos(v.layout) : { x: c.x, y: c.y };
      x = s.x + (c.x - s.x) * k;
      y = s.y + (c.y - s.y) * k - Math.sin(k * Math.PI) * 16;
      rot = (1 - k) * -0.3;
    }
    if (c.leave > 0) {
      const k = ease.inOutSine(c.leave);
      x += k * 160;
      y -= k * 24;
      rot += k * 0.4;
      alpha = 1 - k;
    }
    if (alpha <= 0) return;
    if (c.shake > 0) {
      x += Math.sin((SHAKE_TIME - c.shake) * 75) * 4 * (c.shake / SHAKE_TIME);
    }

    const edge = Math.sin(c.shown * Math.PI);
    const lift = c.hover * 2 + edge * 2;
    const pop =
      c.pop > 0 ? 1 + 0.08 * Math.sin((1 - c.pop / POP_TIME) * Math.PI) : 1;
    const squash = Math.max(0.02, Math.abs(Math.cos(c.shown * Math.PI)));
    const hw = c.w / 2;
    const hh = c.h / 2;
    const r = cardRadius(c.w);

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x + hw, y + hh);
    ctx.rotate(rot);

    // Contact shadow stays on the baize while the card lifts off it.
    ctx.fillStyle = 'rgba(8, 2, 6, 0.4)';
    roundRectPath(
      ctx,
      -hw * squash * pop + 1,
      -hh + 3,
      c.w * squash * pop,
      c.h,
      r
    );
    ctx.fill();

    ctx.translate(0, -lift);
    ctx.scale(squash * pop, pop * (1 + 0.03 * edge));
    const faceSide = c.shown >= 0.5;
    if (faceSide) {
      this.art.drawFace(ctx, c.value, -hw, -hh, c.w, c.h);
    } else {
      this.art.drawBack(ctx, v.table, -hw, -hh, c.w, c.h);
      if (c.ghost > 0) {
        ctx.save();
        ctx.globalAlpha = alpha * 0.2 * (c.ghost / GHOST_TIME);
        drawIcon(ctx, c.value, 0, 0, Math.min(c.w, c.h) * 0.55);
        ctx.restore();
      }
    }

    // Highlight sweep across the card as it passes edge-on.
    if (edge > 0.15) {
      const u = clamp01((c.shown - 0.2) / 0.6);
      const g = ctx.createLinearGradient(-hw, -hh, hw, hh);
      const a = Math.max(0, u - 0.25);
      const b = Math.min(1, u + 0.25);
      g.addColorStop(a, 'rgba(255, 246, 236, 0)');
      g.addColorStop(u, `rgba(255, 246, 236, ${0.5 * edge * edge})`);
      g.addColorStop(b, 'rgba(255, 246, 236, 0)');
      ctx.fillStyle = g;
      roundRectPath(ctx, -hw, -hh, c.w, c.h, r);
      ctx.fill();
    }

    if (!faceSide && c.hover > 0.02) {
      // The lift alone is 2px; a rose edge makes the target unmistakable.
      ctx.strokeStyle = withAlpha(P.rose, 0.7 * c.hover);
      ctx.lineWidth = 1.5;
      roundRectPath(ctx, -hw + 0.75, -hh + 0.75, c.w - 1.5, c.h - 1.5, r);
      ctx.stroke();
    }
    if (faceSide && c.matched) this.decorateMatched(ctx, c, r);
    if (c.miss > 0 && faceSide) {
      ctx.strokeStyle = withAlpha(P.bad, Math.min(1, c.miss / 0.15));
      ctx.lineWidth = 2.5;
      roundRectPath(ctx, -hw + 1, -hh + 1, c.w - 2, c.h - 2, r);
      ctx.stroke();
    }
    ctx.restore();
  }

  /** Emerald pulse once, then settle: a plum wash and a check badge. */
  private decorateMatched(
    ctx: CanvasRenderingContext2D,
    c: Card,
    r: number
  ): void {
    const hw = c.w / 2;
    const hh = c.h / 2;
    if (c.pulse > 0) {
      const k = c.pulse / PULSE_TIME;
      ctx.strokeStyle = withAlpha(P.good, 0.95 * k);
      ctx.lineWidth = 3;
      roundRectPath(ctx, -hw - 2, -hh - 2, c.w + 4, c.h + 4, r + 2);
      ctx.stroke();
    }
    const settle = 1 - c.pulse / PULSE_TIME;
    ctx.fillStyle = `rgba(36, 16, 32, ${0.4 * settle})`;
    roundRectPath(ctx, -hw, -hh, c.w, c.h, r);
    ctx.fill();
    if (settle > 0.5) {
      const br = Math.max(5, c.w * 0.1);
      ctx.save();
      ctx.globalAlpha *= (settle - 0.5) * 2;
      checkBadge(ctx, hw - br - 3, -hh + br + 3, br);
      ctx.restore();
    }
  }

  /** The keyboard cursor: rose corner brackets around the card. */
  private renderCursor(ctx: CanvasRenderingContext2D, c: Card): void {
    const pad = 4;
    const x = c.x - pad;
    const y = c.y - pad - c.hover * 2;
    const w = c.w + pad * 2;
    const h = c.h + pad * 2;
    const len = Math.min(14, w * 0.25);
    ctx.save();
    ctx.strokeStyle = P.rose;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (const [cx, cy, sx, sy] of [
      [x, y, 1, 1],
      [x + w, y, -1, 1],
      [x, y + h, 1, -1],
      [x + w, y + h, -1, -1],
    ]) {
      ctx.moveTo(cx, cy + sy * len);
      ctx.lineTo(cx, cy);
      ctx.lineTo(cx + sx * len, cy);
    }
    ctx.stroke();
    ctx.restore();
  }
}
