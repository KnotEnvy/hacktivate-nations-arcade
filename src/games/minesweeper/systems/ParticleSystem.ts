// ===== src/games/minesweeper/systems/ParticleSystem.ts =====
//
// Small, capped, and in Fieldmark's materials: enamel flakes when a key
// opens, pink ticks when a flag plants, sparks and soot when a mine goes,
// flagging-tape ribbons on a clear, and thin rings for cascades and the
// shockwave. Everything is dt-driven; nothing here reads a clock.

import { UI } from '@/games/shared/hud/canvasUi';
import { FIELD } from './palette';

type Kind = 'flake' | 'tick' | 'spark' | 'soot' | 'ribbon';

interface Particle {
  kind: Kind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  rot: number;
  spin: number;
  phase: number;
}

interface Ring {
  x: number;
  y: number;
  r: number;
  max: number;
  speed: number;
  color: string;
  width: number;
}

/** The hard ceiling. Emitters stop adding once it is reached. */
export const MAX_PARTICLES = 260;
const MAX_RINGS = 8;

export class ParticleSystem {
  private particles: Particle[] = [];
  private rings: Ring[] = [];
  /** Deterministic jitter, so captures and tests do not depend on luck. */
  private seed = 1;

  private rand(): number {
    this.seed = (this.seed * 1664525 + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }

  count(): number {
    return this.particles.length;
  }

  ringCount(): number {
    return this.rings.length;
  }

  private add(p: Omit<Particle, 'rot' | 'spin' | 'phase'>, spin = 0): void {
    if (this.particles.length >= MAX_PARTICLES) return;
    this.particles.push({
      ...p,
      rot: this.rand() * Math.PI * 2,
      spin,
      phase: this.rand() * Math.PI * 2,
    });
  }

  update(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      if (p.kind === 'flake') p.vy += 620 * dt;
      else if (p.kind === 'spark') {
        p.vx *= Math.max(0, 1 - 3.2 * dt);
        p.vy = p.vy * Math.max(0, 1 - 3.2 * dt) + 260 * dt;
      } else if (p.kind === 'soot') {
        p.vx *= Math.max(0, 1 - 2 * dt);
        p.vy = p.vy * Math.max(0, 1 - 2 * dt) - 30 * dt;
      } else if (p.kind === 'ribbon') {
        p.vy += 70 * dt;
        p.vy = Math.min(p.vy, 150);
        p.phase += dt * 5;
      } else if (p.kind === 'tick') {
        p.vx *= Math.max(0, 1 - 7 * dt);
        p.vy *= Math.max(0, 1 - 7 * dt);
      }
      p.x += (p.vx + (p.kind === 'ribbon' ? Math.sin(p.phase) * 40 : 0)) * dt;
      p.y += p.vy * dt;
      p.rot += p.spin * dt;
    }
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.r += r.speed * dt;
      if (r.r >= r.max) this.rings.splice(i, 1);
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    for (const r of this.rings) {
      const k = r.r / r.max;
      ctx.save();
      ctx.globalAlpha = (1 - k) * 0.8;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = r.width * (1 - k * 0.6);
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    for (const p of this.particles) {
      const fade = Math.min(1, p.life / (p.max * 0.4));
      ctx.save();
      ctx.globalAlpha = fade;
      ctx.fillStyle = p.color;
      ctx.strokeStyle = p.color;
      if (p.kind === 'tick') {
        const a = Math.atan2(p.vy, p.vx);
        ctx.lineWidth = 1.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - Math.cos(a) * p.size, p.y - Math.sin(a) * p.size);
        ctx.stroke();
      } else if (p.kind === 'spark') {
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      } else if (p.kind === 'soot') {
        ctx.globalAlpha = fade * 0.55;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1.6 - fade * 0.6), 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Flakes and ribbons are thin slips that turn as they fall.
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        const w = p.kind === 'ribbon' ? p.size * 0.35 : p.size;
        const h = p.kind === 'ribbon' ? p.size : p.size * 0.6;
        ctx.scale(Math.cos(p.phase) * 0.8 + 0.2, 1);
        ctx.fillRect(-w / 2, -h / 2, w, h);
      }
      ctx.restore();
    }
  }

  /** Two or three chips of enamel off a key that just opened. */
  flakes(x: number, y: number, s: number): void {
    const n = 2 + (this.rand() < 0.4 ? 1 : 0);
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (this.rand() - 0.5) * 2.2;
      const v = 60 + this.rand() * 70;
      this.add(
        {
          kind: 'flake',
          x: x + (this.rand() - 0.5) * s * 0.5,
          y: y + (this.rand() - 0.5) * s * 0.5,
          vx: Math.cos(a) * v,
          vy: Math.sin(a) * v,
          life: 0.45 + this.rand() * 0.2,
          max: 0.65,
          size: Math.max(2, s * 0.13),
          color: this.rand() < 0.5 ? FIELD.tileTop : FIELD.tile,
        },
        (this.rand() - 0.5) * 18
      );
    }
  }

  /** Short pink survey ticks radiating from a flag that just planted. */
  plant(x: number, y: number): void {
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI * 2 * i) / 6 + this.rand() * 0.4;
      const v = 90 + this.rand() * 40;
      this.add({
        kind: 'tick',
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        life: 0.32,
        max: 0.32,
        size: 5,
        color: i % 2 === 0 ? FIELD.tape : FIELD.bone,
      });
    }
  }

  /** A detonation: white-hot sparks, red embers, a puff of soot. */
  burst(x: number, y: number, scale = 1): void {
    const sparks = Math.round(10 * scale);
    for (let i = 0; i < sparks; i++) {
      const a = this.rand() * Math.PI * 2;
      const v = (120 + this.rand() * 160) * scale;
      this.add({
        kind: 'spark',
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v - 40,
        life: 0.35 + this.rand() * 0.35,
        max: 0.7,
        size: 2 + this.rand() * 2,
        color: this.rand() < 0.35 ? '#fff1ec' : UI.bad,
      });
    }
    const soot = Math.round(4 * scale);
    for (let i = 0; i < soot; i++) {
      const a = this.rand() * Math.PI * 2;
      const v = 20 + this.rand() * 40;
      this.add({
        kind: 'soot',
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        life: 0.6 + this.rand() * 0.4,
        max: 1,
        size: 4 + this.rand() * 4 * scale,
        color: '#2a2320',
      });
    }
  }

  /** Flagging-tape ribbons across the top of the field, for a clear. */
  ribbons(x0: number, x1: number, y: number, count = 60): void {
    const colors = [FIELD.tape, FIELD.tape, FIELD.lit, FIELD.bone];
    for (let i = 0; i < count; i++) {
      this.add(
        {
          kind: 'ribbon',
          x: x0 + this.rand() * (x1 - x0),
          y: y - this.rand() * 40,
          vx: (this.rand() - 0.5) * 60,
          vy: 30 + this.rand() * 60,
          life: 2.4 + this.rand() * 1.2,
          max: 3.6,
          size: 9 + this.rand() * 6,
          color: colors[i % colors.length],
        },
        (this.rand() - 0.5) * 6
      );
    }
  }

  ring(
    x: number,
    y: number,
    max: number,
    speed: number,
    color: string,
    width = 2
  ): void {
    if (this.rings.length >= MAX_RINGS) this.rings.shift();
    this.rings.push({ x, y, r: 4, max, speed, color, width });
  }

  clear(): void {
    this.particles = [];
    this.rings = [];
    this.seed = 1;
  }
}
