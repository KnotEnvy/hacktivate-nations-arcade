// ===== src/games/memory/systems/Effects.ts =====
//
// The table's small celebrations: emerald rings off a matched pair, a few
// sparks, paper confetti for a streak, and score slips that rise and fade.
// All counts are capped; everything advances with dt in update and render
// only reads.

import { sansFont, displayFont, withAlpha } from '@/games/shared/hud/canvasUi';
import { CONFETTI, P } from './palette';

interface Ring {
  x: number;
  y: number;
  r0: number;
  t: number;
  life: number;
  color: string;
}

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  t: number;
  life: number;
  color: string;
}

interface Paper {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  t: number;
  life: number;
  color: string;
  w: number;
  h: number;
}

interface Slip {
  x: number;
  y: number;
  text: string;
  tag: string;
  t: number;
  life: number;
}

const MAX_RINGS = 12;
const MAX_SPARKS = 120;
const MAX_PAPER = 90;
const MAX_SLIPS = 5;

export class Effects {
  private rings: Ring[] = [];
  private sparks: Spark[] = [];
  private paper: Paper[] = [];
  private slips: Slip[] = [];

  clear(): void {
    this.rings = [];
    this.sparks = [];
    this.paper = [];
    this.slips = [];
  }

  /** Live particle count, for the cap tests. */
  count(): number {
    return this.rings.length + this.sparks.length + this.paper.length;
  }

  ring(x: number, y: number, r0: number, color: string = P.good): void {
    this.rings.push({ x, y, r0, t: 0, life: 0.55, color });
    if (this.rings.length > MAX_RINGS) this.rings.shift();
  }

  sparksAt(x: number, y: number, n: number, color: string = P.good): void {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 70 + Math.random() * 120;
      this.sparks.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - 30,
        t: 0,
        life: 0.45 + Math.random() * 0.3,
        color,
      });
    }
    if (this.sparks.length > MAX_SPARKS) {
      this.sparks.splice(0, this.sparks.length - MAX_SPARKS);
    }
  }

  confetti(x: number, y: number, n: number): void {
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.9;
      const s = 180 + Math.random() * 200;
      this.paper.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 14,
        t: 0,
        life: 0.9 + Math.random() * 0.5,
        color: CONFETTI[i % CONFETTI.length],
        w: 4 + Math.random() * 4,
        h: 2 + Math.random() * 3,
      });
    }
    if (this.paper.length > MAX_PAPER) {
      this.paper.splice(0, this.paper.length - MAX_PAPER);
    }
  }

  slip(x: number, y: number, text: string, tag = ''): void {
    this.slips.push({ x, y, text, tag, t: 0, life: 1.1 });
    if (this.slips.length > MAX_SLIPS) this.slips.shift();
  }

  update(dt: number): void {
    for (const r of this.rings) r.t += dt;
    this.rings = this.rings.filter(r => r.t < r.life);

    for (const s of this.sparks) {
      s.t += dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vx *= 1 - 2.5 * dt;
      s.vy += 260 * dt;
    }
    this.sparks = this.sparks.filter(s => s.t < s.life);

    for (const p of this.paper) {
      p.t += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 1 - 1.8 * dt;
      p.vy += 420 * dt;
      p.vy *= 1 - 1.2 * dt;
      p.rot += p.vr * dt;
    }
    this.paper = this.paper.filter(p => p.t < p.life);

    for (const s of this.slips) s.t += dt;
    this.slips = this.slips.filter(s => s.t < s.life);
  }

  /** Draw everything, clipped to `clip` so nothing lands on the rails. */
  render(
    ctx: CanvasRenderingContext2D,
    clip?: { x: number; y: number; w: number; h: number }
  ): void {
    ctx.save();
    if (clip) {
      ctx.beginPath();
      ctx.rect(clip.x, clip.y, clip.w, clip.h);
      ctx.clip();
    }
    for (const r of this.rings) {
      const k = r.t / r.life;
      ctx.strokeStyle = withAlpha(r.color, 0.85 * (1 - k));
      ctx.lineWidth = 3 * (1 - k) + 1;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r0 + k * r.r0 * 0.9, 0, Math.PI * 2);
      ctx.stroke();
    }
    for (const s of this.sparks) {
      const k = 1 - s.t / s.life;
      ctx.fillStyle = withAlpha(s.color, k);
      ctx.fillRect(s.x - 1.5, s.y - 1.5, 3, 3);
    }
    for (const p of this.paper) {
      const k = 1 - p.t / p.life;
      ctx.save();
      ctx.globalAlpha = Math.min(1, k * 2);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.scale(1, Math.cos(p.rot * 1.7));
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
    for (const s of this.slips) this.renderSlip(ctx, s);
    ctx.restore();
  }

  /** A score slip: an ivory ticket with the points, the streak in rose. */
  private renderSlip(ctx: CanvasRenderingContext2D, s: Slip): void {
    const k = s.t / s.life;
    const rise = 1 - Math.pow(1 - Math.min(1, k * 2.2), 3);
    const alpha = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
    const y = s.y - rise * 26;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.textBaseline = 'middle';
    ctx.font = displayFont(15);
    const tw = ctx.measureText(s.text).width;
    ctx.font = sansFont(10, 700);
    const gw = s.tag ? ctx.measureText(s.tag).width + 12 : 0;
    const w = tw + gw + 20;
    const x = s.x - w / 2;
    ctx.fillStyle = 'rgba(18, 9, 15, 0.88)';
    ctx.beginPath();
    ctx.moveTo(x + 6, y - 13);
    ctx.lineTo(x + w - 6, y - 13);
    ctx.lineTo(x + w, y);
    ctx.lineTo(x + w - 6, y + 13);
    ctx.lineTo(x + 6, y + 13);
    ctx.lineTo(x, y);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = withAlpha(P.ivory, 0.28);
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.textAlign = 'left';
    ctx.fillStyle = P.ivory;
    ctx.font = displayFont(15);
    ctx.fillText(s.text, x + 10, y + 1);
    if (s.tag) {
      ctx.fillStyle = P.rose;
      ctx.font = sansFont(10, 700);
      ctx.fillText(s.tag, x + 10 + tw + 10, y + 1);
    }
    ctx.restore();
  }
}
