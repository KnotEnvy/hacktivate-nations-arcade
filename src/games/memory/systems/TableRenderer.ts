// ===== src/games/memory/systems/TableRenderer.ts =====
//
// The card table: plum baize under a warm lamp, a nap of fine fibres, a
// vignette, an inlaid hairline around the playing area, and the padded
// leather rails top and bottom that carry the HUD. All of it is static, so
// it is painted once per table layout into an offscreen canvas and blitted.

import { roundRectPath, withAlpha } from '@/games/shared/hud/canvasUi';
import { P } from './palette';
import { BOTTOM_BAND, GridLayout, TOP_BAND } from '../entities/Card';

/** Small deterministic PRNG so the felt nap never shimmers between builds. */
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export class TableRenderer {
  private cache: HTMLCanvasElement | null = null;
  private key = '';

  draw(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    layout: GridLayout | null
  ): void {
    const key = layout
      ? `${w}x${h}:${layout.originX},${layout.originY},${layout.width},${layout.height}`
      : `${w}x${h}:none`;
    if (key !== this.key) {
      this.key = key;
      this.cache = this.build(w, h, layout);
    }
    if (this.cache) {
      ctx.drawImage(this.cache, 0, 0);
    } else {
      this.paint(ctx, w, h, layout);
    }
  }

  private build(
    w: number,
    h: number,
    layout: GridLayout | null
  ): HTMLCanvasElement | null {
    try {
      if (typeof document === 'undefined') return null;
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const c = canvas.getContext('2d');
      if (!c) return null;
      this.paint(c, w, h, layout);
      return canvas;
    } catch {
      return null;
    }
  }

  private paint(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    layout: GridLayout | null
  ): void {
    ctx.save();
    const feltTop = TOP_BAND;
    const feltBottom = h - BOTTOM_BAND;
    const cy = feltTop + (feltBottom - feltTop) * 0.42;

    // Baize, lit from above.
    const g = ctx.createRadialGradient(w / 2, cy, 30, w / 2, cy, w * 0.68);
    g.addColorStop(0, P.feltLit);
    g.addColorStop(0.55, P.felt);
    g.addColorStop(1, P.feltDeep);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // The lamp's warm pool.
    const lamp = ctx.createRadialGradient(
      w / 2,
      feltTop - 60,
      10,
      w / 2,
      feltTop - 60,
      430
    );
    lamp.addColorStop(0, withAlpha(P.lamp, 0.13));
    lamp.addColorStop(1, withAlpha(P.lamp, 0));
    ctx.fillStyle = lamp;
    ctx.fillRect(0, feltTop, w, feltBottom - feltTop);

    // Nap: short fibres, a few light and a few dark.
    const rand = lcg(1873);
    for (let i = 0; i < 2600; i++) {
      const x = rand() * w;
      const y = feltTop + rand() * (feltBottom - feltTop);
      const light = rand() < 0.5;
      ctx.fillStyle = light
        ? 'rgba(255, 220, 240, 0.035)'
        : 'rgba(0, 0, 0, 0.07)';
      ctx.fillRect(x, y, 1 + rand() * 1.5, 1);
    }

    // Vignette.
    const v = ctx.createRadialGradient(
      w / 2,
      cy,
      h * 0.35,
      w / 2,
      cy,
      w * 0.72
    );
    v.addColorStop(0, 'rgba(0, 0, 0, 0)');
    v.addColorStop(1, 'rgba(0, 0, 0, 0.55)');
    ctx.fillStyle = v;
    ctx.fillRect(0, feltTop, w, feltBottom - feltTop);

    if (layout) this.paintInlay(ctx, layout);

    // Shadows the rails cast on the baize.
    const st = ctx.createLinearGradient(0, feltTop, 0, feltTop + 16);
    st.addColorStop(0, 'rgba(0, 0, 0, 0.5)');
    st.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = st;
    ctx.fillRect(0, feltTop, w, 16);
    const sb = ctx.createLinearGradient(0, feltBottom - 12, 0, feltBottom);
    sb.addColorStop(0, 'rgba(0, 0, 0, 0)');
    sb.addColorStop(1, 'rgba(0, 0, 0, 0.45)');
    ctx.fillStyle = sb;
    ctx.fillRect(0, feltBottom - 12, w, 12);

    this.paintRail(ctx, 0, feltTop, w, 'top');
    this.paintRail(ctx, feltBottom, h - feltBottom, w, 'bottom');
    ctx.restore();
  }

  /** A hairline inlay around the grid with a rhombus at each corner. */
  private paintInlay(ctx: CanvasRenderingContext2D, layout: GridLayout): void {
    const m = 14;
    const x = layout.originX - m;
    const y = layout.originY - m;
    const w = layout.width + m * 2;
    const h = layout.height + m * 2;
    ctx.strokeStyle = P.inlay;
    ctx.lineWidth = 1;
    roundRectPath(ctx, x + 0.5, y + 0.5, w, h, 10);
    ctx.stroke();
    ctx.fillStyle = 'rgba(244, 234, 216, 0.16)';
    for (const [cx, cy] of [
      [x, y],
      [x + w, y],
      [x, y + h],
      [x + w, y + h],
    ]) {
      ctx.beginPath();
      ctx.moveTo(cx, cy - 4);
      ctx.lineTo(cx + 3, cy);
      ctx.lineTo(cx, cy + 4);
      ctx.lineTo(cx - 3, cy);
      ctx.closePath();
      ctx.fill();
    }
  }

  /** Padded leather: a soft roll of light, a stitch line, a hard lip. */
  private paintRail(
    ctx: CanvasRenderingContext2D,
    y: number,
    h: number,
    w: number,
    side: 'top' | 'bottom'
  ): void {
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    if (side === 'top') {
      g.addColorStop(0, P.railLit);
      g.addColorStop(0.55, P.rail);
      g.addColorStop(1, P.railDark);
    } else {
      g.addColorStop(0, P.railDark);
      g.addColorStop(0.25, P.railLit);
      g.addColorStop(1, P.rail);
    }
    ctx.fillStyle = g;
    ctx.fillRect(0, y, w, h);

    // Stitching along the felt side.
    const sy = side === 'top' ? y + h - 7.5 : y + 7.5;
    ctx.save();
    ctx.strokeStyle = P.stitch;
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(10, sy);
    ctx.lineTo(w - 10, sy);
    ctx.stroke();
    ctx.restore();

    // The lip where leather meets baize.
    const ly = side === 'top' ? y + h - 0.5 : y + 0.5;
    ctx.strokeStyle = 'rgba(255, 228, 236, 0.10)';
    ctx.beginPath();
    ctx.moveTo(0, ly);
    ctx.lineTo(w, ly);
    ctx.stroke();
  }
}
