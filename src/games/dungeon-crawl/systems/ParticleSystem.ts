// ===== src/games/dungeon-crawl/systems/ParticleSystem.ts =====
// Chunky retro particles: hit sparks, blood chips, gold glitter, ember motes,
// death bursts. Rendered in world space (camera translate already applied).
// Wave K — shapes (square / velocity-aligned spark streak / expanding ring),
// additive glow pass, drag and shrink-over-life. Everything draws with the
// jest-stubbed ctx verbs only (fillRect / beginPath / moveTo / lineTo /
// stroke / arc) — no gradients, no offscreen buffers.

type ParticleShape = 'square' | 'spark' | 'ring';

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
  shape?: ParticleShape;
  /** Velocity damping per second (sparks bleed off speed fast). */
  drag?: number;
  /** Size follows remaining life (death bursts collapse as they fade). */
  shrink?: boolean;
  /** Drawn in the additive pass — embers, magic, anything that should bloom. */
  glow?: boolean;
}

const MAX_PARTICLES = 600;

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
        shrink: true,
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
      glow: true,
    });
  }

  /** Wave K — hot impact streaks flung along the hit direction (additive). */
  sparks(x: number, y: number, dirX: number, dirY: number, color: string, count: number, speed = 260): void {
    for (let i = 0; i < count; i++) {
      const spread = (Math.random() - 0.5) * 1.1;
      const vx = dirX + -dirY * spread;
      const vy = dirY + dirX * spread;
      const v = speed * (0.5 + Math.random() * 0.5);
      this.push({
        x,
        y,
        vx: vx * v,
        vy: vy * v,
        life: 0.22 + Math.random() * 0.12,
        maxLife: 0.2 + Math.random() * 0.1,
        size: 2 + Math.random() * 2,
        color,
        gravity: 90,
        shape: 'spark',
        drag: 4,
        glow: true,
      });
    }
  }

  /** Wave K — one expanding shock ring (kills, booms). Size = final radius. */
  ring(x: number, y: number, color: string, maxRadius = 34, life = 0.3): void {
    this.push({
      x,
      y,
      vx: 0,
      vy: 0,
      life,
      maxLife: life,
      size: maxRadius,
      color,
      gravity: 0,
      shape: 'ring',
      glow: true,
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
      if (p.drag) {
        const damp = Math.max(0, 1 - p.drag * dt);
        p.vx *= damp;
        p.vy *= damp;
      }
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    // Two passes: normal chips first, then the additive bloom on top.
    this.renderPass(ctx, false);
    ctx.globalCompositeOperation = 'lighter';
    this.renderPass(ctx, true);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }

  private renderPass(ctx: CanvasRenderingContext2D, glow: boolean): void {
    for (const p of this.particles) {
      if ((p.glow ?? false) !== glow) continue;
      const lifeFrac = Math.max(0, Math.min(1, p.life / p.maxLife));
      ctx.globalAlpha = lifeFrac;
      if (p.shape === 'ring') {
        // The ring races outward and thins as it dies.
        const radius = Math.max(1, (1 - lifeFrac) * p.size);
        ctx.strokeStyle = p.color;
        ctx.lineWidth = Math.max(1, 3 * lifeFrac);
        ctx.beginPath();
        ctx.arc(Math.round(p.x), Math.round(p.y), radius, 0, Math.PI * 2);
        ctx.stroke();
        continue;
      }
      if (p.shape === 'spark') {
        // A streak trailing back along its own velocity.
        const trail = 0.045;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = Math.max(1, p.size * lifeFrac);
        ctx.beginPath();
        ctx.moveTo(Math.round(p.x), Math.round(p.y));
        ctx.lineTo(Math.round(p.x - p.vx * trail), Math.round(p.y - p.vy * trail));
        ctx.stroke();
        continue;
      }
      ctx.fillStyle = p.color;
      const s = p.shrink ? Math.max(1, p.size * (0.35 + 0.65 * lifeFrac)) : p.size;
      ctx.fillRect(Math.round(p.x - s / 2), Math.round(p.y - s / 2), Math.round(s), Math.round(s));
    }
  }

  clear(): void {
    this.particles = [];
  }
}
