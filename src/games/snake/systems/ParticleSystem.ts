// ===== src/games/snake/systems/ParticleSystem.ts =====
//
// Bits of apple, sparks off coins, eggshell, popped scales, expanding rings
// and score popups. Everything is capped (oldest dropped first) and nothing
// uses shadowBlur, so a long snake popping at death costs the same as a
// short one. The board is seen from above, so there is no gravity: pieces
// fly out and drag to a stop.

import { displayFont } from '@/games/shared/hud/canvasUi';

type Kind = 'chunk' | 'dot' | 'spark' | 'shard' | 'leaf';

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
}

interface Ring {
  x: number;
  y: number;
  from: number;
  to: number;
  life: number;
  max: number;
  color: string;
  width: number;
}

interface Popup {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  max: number;
  size: number;
}

export const MAX_PARTICLES = 220;
const MAX_RINGS = 12;
const MAX_POPUPS = 10;

export class ParticleSystem {
  private particles: Particle[] = [];
  private rings: Ring[] = [];
  private popups: Popup[] = [];

  update(dt: number): void {
    const drag = Math.pow(0.02, dt);
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= drag;
      p.vy *= drag;
      p.rot += p.spin * dt;
      p.life -= dt;
      if (p.life <= 0) this.particles.splice(i, 1);
    }
    for (let i = this.rings.length - 1; i >= 0; i--) {
      this.rings[i].life -= dt;
      if (this.rings[i].life <= 0) this.rings.splice(i, 1);
    }
    for (let i = this.popups.length - 1; i >= 0; i--) {
      const p = this.popups[i];
      p.y -= 34 * dt * (p.life / p.max + 0.3);
      p.life -= dt;
      if (p.life <= 0) this.popups.splice(i, 1);
    }
  }

  count(): number {
    return this.particles.length;
  }

  render(ctx: CanvasRenderingContext2D): void {
    for (const r of this.rings) {
      const k = 1 - r.life / r.max;
      const e = 1 - Math.pow(1 - k, 3);
      ctx.save();
      ctx.globalAlpha = (1 - k) * 0.9;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = r.width * (1 - k * 0.6);
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.from + (r.to - r.from) * e, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    for (const p of this.particles) {
      const alpha = Math.min(1, p.life / (p.max * 0.4));
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      const s = p.size;
      switch (p.kind) {
        case 'chunk':
          ctx.beginPath();
          ctx.ellipse(0, 0, s, s * 0.72, 0, 0, Math.PI * 2);
          ctx.fill();
          break;
        case 'dot':
          ctx.beginPath();
          ctx.arc(0, 0, s, 0, Math.PI * 2);
          ctx.fill();
          break;
        case 'spark':
          ctx.beginPath();
          ctx.moveTo(0, -s);
          ctx.lineTo(s * 0.28, -s * 0.28);
          ctx.lineTo(s, 0);
          ctx.lineTo(s * 0.28, s * 0.28);
          ctx.lineTo(0, s);
          ctx.lineTo(-s * 0.28, s * 0.28);
          ctx.lineTo(-s, 0);
          ctx.lineTo(-s * 0.28, -s * 0.28);
          ctx.closePath();
          ctx.fill();
          break;
        case 'shard':
          ctx.beginPath();
          ctx.moveTo(-s, -s * 0.5);
          ctx.lineTo(s, -s * 0.2);
          ctx.lineTo(-s * 0.2, s * 0.7);
          ctx.closePath();
          ctx.fill();
          break;
        case 'leaf':
          ctx.beginPath();
          ctx.ellipse(0, 0, s, s * 0.45, 0, 0, Math.PI * 2);
          ctx.fill();
          break;
      }
      ctx.restore();
    }

    for (const p of this.popups) {
      const k = p.life / p.max;
      const grow = k > 0.8 ? 1 + (k - 0.8) * 1.5 : 1;
      ctx.save();
      ctx.globalAlpha = Math.min(1, k / 0.35);
      ctx.font = displayFont(Math.round(p.size * grow), 800);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(2, 14, 12, 0.75)';
      ctx.fillText(p.text, p.x + 1, p.y + 1.5);
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, p.x, p.y);
      ctx.restore();
    }
  }

  /** A radial burst of `count` pieces. */
  burst(
    x: number,
    y: number,
    count: number,
    kind: Kind,
    colors: readonly string[],
    speed: number,
    size: number,
    life = 0.55
  ): void {
    for (let i = 0; i < count; i++) {
      const a = (Math.PI * 2 * i) / count + Math.random() * 0.5;
      const v = speed * (0.6 + Math.random() * 0.6);
      this.push({
        kind,
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        life: life * (0.75 + Math.random() * 0.5),
        max: life * 1.25,
        size: size * (0.7 + Math.random() * 0.6),
        color: colors[i % colors.length],
        rot: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 12,
      });
    }
  }

  ring(
    x: number,
    y: number,
    from: number,
    to: number,
    color: string,
    life = 0.45,
    width = 3
  ): void {
    this.rings.push({ x, y, from, to, life, max: life, color, width });
    if (this.rings.length > MAX_RINGS) this.rings.shift();
  }

  popup(
    x: number,
    y: number,
    text: string,
    color: string,
    size = 14,
    life = 0.9
  ): void {
    this.popups.push({ x, y, text, color, life, max: life, size });
    if (this.popups.length > MAX_POPUPS) this.popups.shift();
  }

  clear(): void {
    this.particles = [];
    this.rings = [];
    this.popups = [];
  }

  private push(p: Particle): void {
    this.particles.push(p);
    if (this.particles.length > MAX_PARTICLES) this.particles.shift();
  }
}
