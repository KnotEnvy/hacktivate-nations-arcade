// The paddle, the ball and the capsules.
//
//   Paddle: a bar with rounded ends, a bright core, and a colour gradient
//   that runs mint at the centre to magenta at the ends — the ends are the
//   "hot zones" that send the ball out steep. A thruster glow underneath
//   brightens with speed; a return squashes it for 90ms.
//
//   Ball: a white core in a soft halo, with ONE tapered comet ribbon behind
//   it drawn additively. The comet takes the streak tier's colour, so the
//   ball itself tells you the multiplier.
//
//   Capsules: dark glass pills with a coloured cap and a drawn icon.

import {
  CAPSULE_H,
  CAPSULE_W,
  COURT,
  SERVE_TIMEOUT,
  SQUASH_TIME,
  BALL_FLASH_TIME,
} from '../constants';
import type { Ball, Capsule, Paddle } from '../entities/types';
import { roundRectPath } from '@/games/shared/hud/canvasUi';
import { POWER_DEFS } from './powerups';
import { powerIcon } from './icons';
import { rgba } from './color';

function glowSprite(color: string, r: number): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = c.height = Math.ceil(r * 2);
  const g = c.getContext('2d');
  if (!g) return null;
  const grad = g.createRadialGradient(r, r, 0, r, r, r);
  grad.addColorStop(0, rgba(color, 0.9));
  grad.addColorStop(0.35, rgba(color, 0.35));
  grad.addColorStop(1, rgba(color, 0));
  g.fillStyle = grad;
  g.fillRect(0, 0, r * 2, r * 2);
  return c;
}

export interface BallLook {
  /** The streak tier's colour; the comet's length is set by the game. */
  color: string;
  blastArmed: boolean;
  time: number;
}

export class EntityRenderer {
  private glows = new Map<string, HTMLCanvasElement | null>();

  private glow(color: string, r: number): HTMLCanvasElement | null {
    const key = `${color}|${r}`;
    if (!this.glows.has(key)) this.glows.set(key, glowSprite(color, r));
    return this.glows.get(key) ?? null;
  }

  private blitGlow(
    ctx: CanvasRenderingContext2D,
    color: string,
    x: number,
    y: number,
    r: number,
    sx = 1,
    sy = 1
  ): void {
    const s = this.glow(color, 32);
    if (!s) return;
    ctx.drawImage(s, x - r * sx, y - r * sy, r * 2 * sx, r * 2 * sy);
  }

  paddle(
    ctx: CanvasRenderingContext2D,
    p: Paddle,
    catchOn: boolean,
    time: number
  ): void {
    const k = Math.max(0, p.squash / SQUASH_TIME);
    const h = p.h * (1 - 0.3 * k);
    const w = p.w * (1 + 0.06 * k);
    const x = p.cx - w / 2;
    const y = p.y + (p.h - h);

    ctx.save();
    // Thruster wash under the bar.
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.35 + 0.65 * p.thrust;
    this.blitGlow(ctx, COURT.mint, p.cx, p.y + p.h + 2, w * 0.58, 1, 0.3);
    if (p.thrust > 0.2) {
      // Exhaust off the trailing end.
      const dir = p.vx > 0 ? -1 : 1;
      ctx.globalAlpha = (p.thrust - 0.2) * 0.9;
      this.blitGlow(
        ctx,
        COURT.violet,
        p.cx + dir * w * 0.5,
        p.y + p.h / 2,
        18 + 14 * p.thrust,
        1.4,
        0.35
      );
    }
    ctx.restore();

    ctx.save();
    const body = ctx.createLinearGradient(x, 0, x + w, 0);
    body.addColorStop(0, COURT.pink);
    body.addColorStop(0.16, COURT.violet);
    body.addColorStop(0.34, COURT.mint);
    body.addColorStop(0.66, COURT.mint);
    body.addColorStop(0.84, COURT.violet);
    body.addColorStop(1, COURT.pink);
    ctx.fillStyle = body;
    roundRectPath(ctx, x, y, w, h, h / 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(2, 3, 12, 0.55)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Bright core and top sheen.
    ctx.fillStyle = rgba('#ffffff', 0.85);
    roundRectPath(
      ctx,
      p.cx - w * 0.26,
      y + h * 0.36,
      w * 0.52,
      Math.max(2, h * 0.28),
      h * 0.14
    );
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.fillRect(x + h / 2, y + 1.5, w - h, 1.5);

    if (catchOn) {
      // CATCH: a lime tacky strip along the top, beading.
      ctx.fillStyle = COURT.lime;
      ctx.fillRect(x + h / 2, y - 1, w - h, 2.5);
      for (let i = 0; i < 5; i++) {
        const bx = x + h / 2 + ((i + 0.5) / 5) * (w - h);
        const drip = 1.5 + Math.sin(time * 4 + i * 1.7) * 1.2;
        ctx.beginPath();
        ctx.arc(bx, y + 1.5, drip, 0, Math.PI);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  ball(ctx: CanvasRenderingContext2D, b: Ball, look: BallLook): void {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    this.comet(ctx, b, look);
    const flash = Math.max(0, b.flash / BALL_FLASH_TIME);
    this.blitGlow(ctx, look.color, b.x, b.y, b.r * (3 + flash * 2.2));
    ctx.restore();

    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r * (1 + flash * 0.15), 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = rgba(look.color, 0.55 - flash * 0.5);
    ctx.beginPath();
    ctx.arc(b.x + 1.2, b.y + 1.4, b.r * 0.55, 0, Math.PI * 2);
    ctx.fill();

    if (look.blastArmed) {
      ctx.strokeStyle = COURT.pink;
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 3]);
      ctx.lineDashOffset = -look.time * 30;
      ctx.beginPath();
      ctx.arc(
        b.x,
        b.y,
        b.r + 5 + Math.sin(look.time * 10) * 1.2,
        0,
        Math.PI * 2
      );
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();
  }

  /** One tapered ribbon along the trail, bright at the head, gone at the tail. */
  private comet(ctx: CanvasRenderingContext2D, b: Ball, look: BallLook): void {
    const pts = b.trail;
    if (pts.length < 2) return;
    const n = pts.length;
    const head = pts[n - 1];
    const tail = pts[0];
    const left: number[] = [];
    const right: number[] = [];
    for (let i = 0; i < n; i++) {
      const a = pts[Math.max(0, i - 1)];
      const c = pts[Math.min(n - 1, i + 1)];
      let dx = c.x - a.x;
      let dy = c.y - a.y;
      const len = Math.hypot(dx, dy) || 1;
      dx /= len;
      dy /= len;
      const half = b.r * 0.95 * (i / (n - 1));
      left.push(pts[i].x - dy * half, pts[i].y + dx * half);
      right.push(pts[i].x + dy * half, pts[i].y - dx * half);
    }
    const grad = ctx.createLinearGradient(tail.x, tail.y, head.x, head.y);
    grad.addColorStop(0, rgba(look.color, 0));
    grad.addColorStop(1, rgba(look.color, 0.75));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(left[0], left[1]);
    for (let i = 2; i < left.length; i += 2) ctx.lineTo(left[i], left[i + 1]);
    for (let i = right.length - 2; i >= 0; i -= 2)
      ctx.lineTo(right[i], right[i + 1]);
    ctx.closePath();
    ctx.fill();
  }

  capsule(ctx: CanvasRenderingContext2D, c: Capsule): void {
    const def = POWER_DEFS[c.type];
    const wob = Math.sin(c.age * 5.2) * 0.2;
    const sway = Math.sin(c.age * 2.6) * 3;
    const w = CAPSULE_W;
    const h = CAPSULE_H;
    ctx.save();
    ctx.translate(c.x + sway, c.y);

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.55;
    this.blitGlow(ctx, def.color, 0, 0, w * 0.75, 1, 0.55);
    ctx.restore();

    ctx.rotate(wob);
    roundRectPath(ctx, -w / 2, -h / 2, w, h, h / 2);
    ctx.fillStyle = COURT.glass;
    ctx.fill();
    // Coloured cap on the left third.
    ctx.save();
    ctx.clip();
    ctx.fillStyle = def.color;
    ctx.fillRect(-w / 2, -h / 2, 13, h);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
    ctx.fillRect(-w / 2, -h / 2 + 2, w, 2);
    ctx.restore();
    ctx.strokeStyle = def.color;
    ctx.lineWidth = 1.5;
    roundRectPath(ctx, -w / 2 + 0.75, -h / 2 + 0.75, w - 1.5, h - 1.5, h / 2);
    ctx.stroke();
    powerIcon(ctx, c.type, 7, 0, 13, '#ffffff');
    ctx.restore();
  }

  /**
   * The serve guide: chevrons fanning out along the launch direction, and a
   * ring around the ball that runs down to the automatic serve.
   */
  aim(
    ctx: CanvasRenderingContext2D,
    b: Ball,
    angle: number,
    waited: number,
    color: string
  ): void {
    const dx = Math.sin(angle);
    const dy = -Math.cos(angle);
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    for (let i = 0; i < 7; i++) {
      const d = 22 + i * 15;
      const x = b.x + dx * d;
      const y = b.y + dy * d;
      ctx.globalAlpha = 0.9 * (1 - i / 7);
      // A chevron pointing along the aim.
      const s = 5 - i * 0.35;
      ctx.beginPath();
      ctx.moveTo(x - dx * s + dy * s, y - dy * s - dx * s);
      ctx.lineTo(x, y);
      ctx.lineTo(x - dx * s - dy * s, y - dy * s + dx * s);
      ctx.stroke();
    }
    const left = Math.max(0, 1 - waited / SERVE_TIMEOUT);
    ctx.globalAlpha = 0.85;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r + 6, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * left);
    ctx.stroke();
    ctx.restore();
  }
}
