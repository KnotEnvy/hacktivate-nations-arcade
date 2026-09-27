// ===== src/games/tapdodge/entities/Coin.ts =====
//
// Coins are currency, so they are amber and nothing else on the road is.
// They spin edge-on and back by scaling their width with cos(spin), keeping
// a bright rim at the thin point so they flash rather than vanish.

import { UI } from '@/games/shared/hud/canvasUi';
import type { Rect } from '../systems/layout';

export const COIN_RADIUS = 11;

export class Coin {
  x: number;
  y: number;
  collected = false;
  private spin: number;

  constructor(x: number, y: number, phase = 0) {
    this.x = x;
    this.y = y;
    this.spin = phase;
  }

  update(dy: number, dt: number): void {
    this.y += dy;
    this.spin += dt * 4.2;
  }

  /** Pull toward a point (magnet). */
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
    const r = COIN_RADIUS + 2;
    return { x: this.x - r, y: this.y - r, w: r * 2, h: r * 2 };
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (this.collected) return;
    const r = COIN_RADIUS;
    const face = Math.cos(this.spin);
    const w = Math.max(1.6, r * Math.abs(face));
    ctx.save();
    ctx.fillStyle = UI.coinDim;
    ctx.beginPath();
    ctx.ellipse(this.x, this.y, w, r, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = UI.coin;
    ctx.beginPath();
    ctx.ellipse(
      this.x,
      this.y,
      Math.max(1, w - 1.5),
      r - 1.5,
      0,
      0,
      Math.PI * 2
    );
    ctx.fill();
    if (Math.abs(face) > 0.35) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
      ctx.beginPath();
      ctx.ellipse(this.x, this.y, w * 0.5, r * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Edge-on: a bright rim line so the coin flashes.
      ctx.fillStyle = 'rgba(255, 244, 214, 0.9)';
      ctx.fillRect(this.x - 0.8, this.y - r + 1, 1.6, r * 2 - 2);
    }
    ctx.restore();
  }
}
