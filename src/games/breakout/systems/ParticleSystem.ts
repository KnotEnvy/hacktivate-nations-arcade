// Court effects: glass shards off a broken brick, sparks off a rail or a
// steel brick, shock rings, confetti for a cleared set, score popups, and
// the amber coin that flies up to the scorebug when a brick pays out.
//
// Everything is dt-driven and capped; nothing here reads the clock.

import { coinGlyph, displayFont, monoFont } from '@/games/shared/hud/canvasUi';
import { rgba } from './color';

const MAX_PARTICLES = 260;
const GRAVITY = 900;

interface Shard {
  kind: 'shard';
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vrot: number;
  life: number;
  max: number;
  color: string;
  /** Quad corners around the centre. */
  pts: number[];
}

interface Spark {
  kind: 'spark';
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
}

interface Confetti {
  kind: 'confetti';
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vrot: number;
  life: number;
  max: number;
  color: string;
  w: number;
}

interface Ring {
  kind: 'ring';
  x: number;
  y: number;
  r0: number;
  r1: number;
  life: number;
  max: number;
  color: string;
}

type Particle = Shard | Spark | Confetti | Ring;

interface Popup {
  x: number;
  y: number;
  text: string;
  color: string;
  size: number;
  life: number;
  max: number;
}

interface FlyingCoin {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  t: number;
  dur: number;
}

export class ParticleSystem {
  private parts: Particle[] = [];
  private popups: Popup[] = [];
  private coins: FlyingCoin[] = [];

  update(dt: number): void {
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.parts.splice(i, 1);
        continue;
      }
      if (p.kind === 'ring') continue;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.kind === 'shard') {
        p.vy += GRAVITY * dt;
        p.rot += p.vrot * dt;
      } else if (p.kind === 'confetti') {
        p.vy += GRAVITY * 0.28 * dt;
        p.vx *= Math.exp(-1.6 * dt);
        p.rot += p.vrot * dt;
      } else {
        p.vx *= Math.exp(-6 * dt);
        p.vy *= Math.exp(-6 * dt);
      }
    }
    for (let i = this.popups.length - 1; i >= 0; i--) {
      const p = this.popups[i];
      p.life -= dt;
      p.y -= 38 * dt;
      if (p.life <= 0) this.popups.splice(i, 1);
    }
    for (let i = this.coins.length - 1; i >= 0; i--) {
      const c = this.coins[i];
      c.t += dt;
      if (c.t >= c.dur) this.coins.splice(i, 1);
    }
  }

  private add(p: Particle): void {
    if (this.parts.length >= MAX_PARTICLES) this.parts.shift();
    this.parts.push(p);
  }

  /** 4–6 glass quads in the brick's colour, thrown up and out. */
  shards(x: number, y: number, w: number, h: number, color: string): void {
    const n = 4 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const s = 5 + Math.random() * 7;
      const pts: number[] = [];
      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * Math.PI * 2 + Math.random() * 0.9;
        const r = s * (0.55 + Math.random() * 0.5);
        pts.push(Math.cos(a) * r, Math.sin(a) * r * 0.7);
      }
      this.add({
        kind: 'shard',
        x: x + (Math.random() - 0.5) * w * 0.8,
        y: y + (Math.random() - 0.5) * h * 0.6,
        vx: (Math.random() - 0.5) * 260,
        vy: -120 - Math.random() * 180,
        rot: Math.random() * Math.PI,
        vrot: (Math.random() - 0.5) * 14,
        life: 0.55 + Math.random() * 0.35,
        max: 0.9,
        color,
        pts,
      });
    }
  }

  /** Short additive streaks, e.g. off a rail or a steel brick. */
  sparks(
    x: number,
    y: number,
    color: string,
    count: number,
    dirX = 0,
    dirY = 0
  ): void {
    for (let i = 0; i < count; i++) {
      const a = Math.atan2(dirY, dirX) + (Math.random() - 0.5) * 2.2;
      const sp = 140 + Math.random() * 200;
      const aim = dirX !== 0 || dirY !== 0;
      const ang = aim ? a : Math.random() * Math.PI * 2;
      this.add({
        kind: 'spark',
        x,
        y,
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp,
        life: 0.18 + Math.random() * 0.14,
        max: 0.32,
        color,
      });
    }
  }

  ring(
    x: number,
    y: number,
    r0: number,
    r1: number,
    color: string,
    life = 0.35
  ): void {
    this.add({ kind: 'ring', x, y, r0, r1, life, max: life, color });
  }

  confetti(
    colors: readonly string[],
    left: number,
    right: number,
    y: number
  ): void {
    for (let i = 0; i < 70; i++) {
      this.add({
        kind: 'confetti',
        x: left + Math.random() * (right - left),
        y: y + Math.random() * 30,
        vx: (Math.random() - 0.5) * 220,
        vy: -80 - Math.random() * 220,
        rot: Math.random() * Math.PI,
        vrot: (Math.random() - 0.5) * 12,
        life: 1.4 + Math.random() * 0.6,
        max: 2,
        color: colors[i % colors.length],
        w: 5 + Math.random() * 5,
      });
    }
  }

  popup(x: number, y: number, text: string, color: string, size = 13): void {
    if (this.popups.length > 24) this.popups.shift();
    this.popups.push({ x, y, text, color, size, life: 0.8, max: 0.8 });
  }

  /** An amber coin arcing from a paying brick up to the scorebug. */
  coin(x: number, y: number, toX: number, toY: number): void {
    if (this.coins.length > 12) this.coins.shift();
    this.coins.push({ x0: x, y0: y, x1: toX, y1: toY, t: 0, dur: 0.55 });
  }

  clear(): void {
    this.parts = [];
    this.popups = [];
    this.coins = [];
  }

  count(): number {
    return this.parts.length;
  }

  render(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    for (const p of this.parts) {
      const k = Math.max(0, p.life / p.max);
      if (p.kind === 'shard') {
        ctx.globalAlpha = Math.min(1, k * 1.6);
        ctx.fillStyle = p.color;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.beginPath();
        ctx.moveTo(p.pts[0], p.pts[1]);
        for (let i = 2; i < p.pts.length; i += 2) {
          ctx.lineTo(p.pts[i], p.pts[i + 1]);
        }
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = rgba('#ffffff', 0.55);
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();
      } else if (p.kind === 'confetti') {
        ctx.globalAlpha = Math.min(1, k * 2);
        ctx.fillStyle = p.color;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        // Flutter: the strip turns edge-on and back as it spins.
        ctx.fillRect(
          -p.w / 2,
          -2,
          p.w * Math.abs(Math.cos(p.rot * 1.7)) + 1,
          4
        );
        ctx.restore();
      }
    }
    ctx.globalCompositeOperation = 'lighter';
    for (const p of this.parts) {
      const k = Math.max(0, p.life / p.max);
      if (p.kind === 'spark') {
        ctx.globalAlpha = k;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03);
        ctx.stroke();
      } else if (p.kind === 'ring') {
        const t = 1 - k;
        ctx.globalAlpha = k * 0.9;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 1 + 4 * k;
        ctx.beginPath();
        ctx.arc(
          p.x,
          p.y,
          p.r0 + (p.r1 - p.r0) * (1 - (1 - t) * (1 - t)),
          0,
          Math.PI * 2
        );
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  /** Popups and flying coins sit above everything on the court. */
  renderOverlay(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const p of this.popups) {
      const k = p.life / p.max;
      const rise = 1 - k;
      ctx.globalAlpha = Math.min(1, k * 2.2);
      const scale = rise < 0.15 ? 0.7 + rise * 2 : 1;
      ctx.font =
        p.size >= 16
          ? displayFont(Math.round(p.size * scale))
          : monoFont(Math.round(p.size * scale), 700);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
      ctx.fillText(p.text, p.x + 1, p.y + 1);
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, p.x, p.y);
    }
    for (const c of this.coins) {
      const t = c.t / c.dur;
      const e = 1 - (1 - t) * (1 - t);
      // Eased in x; in y a bezier that runs under the scorebug and only
      // rises into it at the counter.
      const midY = c.y1 + 70;
      const x = c.x0 + (c.x1 - c.x0) * e;
      const y =
        (1 - e) * (1 - e) * c.y0 + 2 * (1 - e) * e * midY + e * e * c.y1;
      ctx.globalAlpha = t > 0.85 ? (1 - t) / 0.15 : 1;
      coinGlyph(ctx, x, y, 5 - t * 1.5);
    }
    ctx.restore();
  }
}
