// ===== src/games/dungeon-crawl/systems/ParticleSystem.ts =====
// Chunky retro particles: hit sparks, blood chips, gold glitter, ember motes,
// death bursts. Rendered in world space (camera translate already applied).

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  gravity: number;
}

const MAX_PARTICLES = 400;

export class ParticleSystem {
  private particles: Particle[] = [];

  private push(p: Particle): void {
    if (this.particles.length >= MAX_PARTICLES) this.particles.shift();
    this.particles.push(p);
  }

  burst(
    x: number,
    y: number,
    color: string,
    count: number,
    speed = 120,
    life = 0.5,
    gravity = 0,
  ): void {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const velocity = speed * (0.3 + Math.random() * 0.7);
      this.push({
        x,
        y,
        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity,
        life,
        maxLife: life * (0.6 + Math.random() * 0.4),
        size: 2 + Math.random() * 3,
        color,
        gravity,
      });
    }
  }

  /** Directional spray (sword hits, charge slams). */
  spray(x: number, y: number, dirX: number, dirY: number, color: string, count: number): void {
    for (let i = 0; i < count; i++) {
      const spread = (Math.random() - 0.5) * 1.6;
      const vx = dirX + -dirY * spread;
      const vy = dirY + dirX * spread;
      const speed = 90 + Math.random() * 140;
      this.push({
        x,
        y,
        vx: vx * speed,
        vy: vy * speed,
        life: 0.4,
        maxLife: 0.25 + Math.random() * 0.2,
        size: 2 + Math.random() * 2,
        color,
        gravity: 220,
      });
    }
  }

  /** Slow-rising ember mote (torch ambience). */
  ember(x: number, y: number, color: string): void {
    this.push({
      x: x + (Math.random() - 0.5) * 10,
      y,
      vx: (Math.random() - 0.5) * 12,
      vy: -18 - Math.random() * 22,
      life: 1.4,
      maxLife: 0.9 + Math.random() * 0.5,
      size: 1.5 + Math.random() * 1.5,
      color,
      gravity: -6,
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
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    for (const p of this.particles) {
      const alpha = Math.max(0, Math.min(1, p.life / p.maxLife));
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      const s = p.size;
      ctx.fillRect(Math.round(p.x - s / 2), Math.round(p.y - s / 2), Math.round(s), Math.round(s));
    }
    ctx.globalAlpha = 1;
  }

  clear(): void {
    this.particles = [];
  }
}
