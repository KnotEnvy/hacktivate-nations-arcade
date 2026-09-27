// ===== src/games/tapdodge/entities/Gem.ts =====
//
// A cut diamond in violet, the only violet thing on the road. Rare: it sits
// in the gap of a wall or beside a single hazard, so taking it means taking
// the tighter line.

import { gemPath } from '../systems/icons';
import { GEM } from '../systems/palette';
import type { Rect } from '../systems/layout';

export const GEM_SIZE = 26;

export class Gem {
  x: number;
  y: number;
  collected = false;
  private shimmer: number;

  constructor(x: number, y: number, phase = 0) {
    this.x = x;
    this.y = y;
    this.shimmer = phase;
  }

  update(dy: number, dt: number): void {
    this.y += dy;
    this.shimmer += dt * 3;
  }

  attract(tx: number, ty: number, step: number): void {
    const dx = tx - this.x;
    const dy = ty - this.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < 1) return;
    const k = Math.min(1, step / d);
    this.x += dx * k;
    this.y += dy * k;
  }

  hitbox(): Rect {
    const r = GEM_SIZE / 2 + 1;
    return { x: this.x - r, y: this.y - r, w: r * 2, h: r * 2 };
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (this.collected) return;
    const x = this.x;
    const y = this.y;
    const s = GEM_SIZE / 2;
    ctx.save();
    gemPath(ctx, x, y, GEM_SIZE);
    ctx.fillStyle = GEM.base;
    ctx.fill();
    ctx.strokeStyle = GEM.light;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Facets: the crown line and the pavilion cuts to the point.
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - s, y - s * 0.2);
    ctx.lineTo(x + s, y - s * 0.2);
    ctx.moveTo(x - s * 0.45, y - s * 0.7);
    ctx.lineTo(x - s * 0.2, y - s * 0.2);
    ctx.lineTo(x, y + s);
    ctx.lineTo(x + s * 0.2, y - s * 0.2);
    ctx.lineTo(x + s * 0.45, y - s * 0.7);
    ctx.stroke();

    // One facet catches the light and lets it go.
    const glint = 0.25 + 0.35 * Math.max(0, Math.sin(this.shimmer));
    ctx.fillStyle = `rgba(255, 255, 255, ${glint.toFixed(3)})`;
    ctx.beginPath();
    ctx.moveTo(x - s * 0.45, y - s * 0.7);
    ctx.lineTo(x - s * 0.2, y - s * 0.2);
    ctx.lineTo(x - s, y - s * 0.2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = GEM.dark;
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.moveTo(x + s * 0.2, y - s * 0.2);
    ctx.lineTo(x + s, y - s * 0.2);
    ctx.lineTo(x, y + s);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}
