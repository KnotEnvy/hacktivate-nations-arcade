// ===== src/games/tapdodge/systems/ParticleSystem.ts =====
//
// A small, capped pool. Three shapes only — dots, shards and rings — and
// every burst is a handful, not a fountain: the road has to stay readable
// while things go off on it.

export const MAX_PARTICLES = 160;

type Kind = 'dot' | 'shard' | 'ring';

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

export class ParticleSystem {
  private items: Particle[] = [];

  get count(): number {
    return this.items.length;
  }

  update(dt: number): void {
    for (const p of this.items) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const drag = Math.max(0, 1 - dt * 3);
      p.vx *= drag;
      p.vy *= drag;
      p.rot += p.spin * dt;
    }
    this.items = this.items.filter(p => p.life > 0);
  }

  render(ctx: CanvasRenderingContext2D): void {
    for (const p of this.items) {
      const k = Math.max(0, p.life / p.max);
      ctx.save();
      ctx.globalAlpha = k;
      if (p.kind === 'ring') {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 2 * k + 0.5;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1.6 - k), 0, Math.PI * 2);
        ctx.stroke();
      } else if (p.kind === 'shard') {
        ctx.fillStyle = p.color;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.beginPath();
        ctx.moveTo(0, -p.size);
        ctx.lineTo(p.size * 0.6, p.size * 0.7);
        ctx.lineTo(-p.size * 0.6, p.size * 0.7);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (0.4 + 0.6 * k), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  clear(): void {
    this.items = [];
  }

  private add(p: Omit<Particle, 'max' | 'rot' | 'spin'>, spin = 0): void {
    if (this.items.length >= MAX_PARTICLES) this.items.shift();
    this.items.push({ ...p, max: p.life, rot: Math.random() * 6, spin });
  }

  private scatter(
    kind: Kind,
    x: number,
    y: number,
    n: number,
    speed: number,
    size: number,
    life: number,
    color: string
  ): void {
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * 2 * i) / n + Math.random() * 0.6;
      const v = speed * (0.6 + Math.random() * 0.6);
      this.add(
        {
          kind,
          x,
          y,
          vx: Math.cos(a) * v,
          vy: Math.sin(a) * v,
          life: life * (0.7 + Math.random() * 0.5),
          size,
          color,
        },
        kind === 'shard' ? (Math.random() - 0.5) * 14 : 0
      );
    }
  }

  /** Lane hop: a little exhaust left behind, opposite the hop. */
  puff(x: number, y: number, dir: number, color: string): void {
    for (let i = 0; i < 4; i++) {
      this.add({
        kind: 'dot',
        x: x - dir * 14,
        y: y + 10 + i * 3,
        vx: -dir * (60 + Math.random() * 50),
        vy: 40 + Math.random() * 40,
        life: 0.28,
        size: 2.5,
        color,
      });
    }
  }

  sparkle(x: number, y: number, color: string): void {
    this.scatter('dot', x, y, 6, 110, 2.2, 0.35, color);
  }

  burst(x: number, y: number, color: string): void {
    this.ring(x, y, color, 22);
    this.scatter('dot', x, y, 8, 150, 2.6, 0.45, color);
  }

  ring(x: number, y: number, color: string, radius: number): void {
    this.add({
      kind: 'ring',
      x,
      y,
      vx: 0,
      vy: 0,
      life: 0.45,
      size: radius,
      color,
    });
  }

  sparks(x: number, y: number, color: string, n = 10): void {
    this.scatter('dot', x, y, n, 190, 2.4, 0.4, color);
  }

  /** The ship coming apart: hull shards and two rings. */
  explode(x: number, y: number, hull: string, glow: string): void {
    this.scatter('shard', x, y, 16, 240, 6, 1.1, hull);
    this.scatter('dot', x, y, 10, 160, 3, 0.8, glow);
    this.ring(x, y, glow, 34);
    this.add({
      kind: 'ring',
      x,
      y,
      vx: 0,
      vy: 0,
      life: 0.9,
      size: 70,
      color: hull,
    });
  }
}
