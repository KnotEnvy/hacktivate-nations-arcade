interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  type: 'spark' | 'smoke' | 'debris';
  rot?: number;
  vrot?: number;
}

export class ParticleSystem {
  private particles: Particle[] = [];

  reset(): void {
    this.particles = [];
  }

  burstExplosion(x: number, y: number, scale = 1): void {
    const colors = ['#FF1493', '#FFD700', '#FF6347', '#FFFFFF'];
    const count = Math.floor(18 * scale);
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.4;
      const speed = (140 + Math.random() * 220) * scale;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.6 + Math.random() * 0.3,
        maxLife: 0.9,
        size: 3 + Math.random() * 4 * scale,
        color: colors[Math.floor(Math.random() * colors.length)],
        type: 'spark',
      });
    }
    // Smoke puffs
    for (let i = 0; i < 6; i++) {
      const angle = Math.random() * Math.PI * 2;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * 40,
        vy: Math.sin(angle) * 40 - 30,
        life: 0.7 + Math.random() * 0.5,
        maxLife: 1.2,
        size: 8 + Math.random() * 6,
        color: 'rgba(60,60,80,0.7)',
        type: 'smoke',
      });
    }
  }

  burstMuzzle(x: number, y: number): void {
    for (let i = 0; i < 4; i++) {
      this.particles.push({
        x, y,
        vx: (Math.random() - 0.5) * 60,
        vy: -120 - Math.random() * 60,
        life: 0.12,
        maxLife: 0.12,
        size: 2 + Math.random() * 2,
        color: '#FFFF99',
        type: 'spark',
      });
    }
  }

  burstHit(x: number, y: number): void {
    for (let i = 0; i < 6; i++) {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI;
      const speed = 80 + Math.random() * 80;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.25,
        maxLife: 0.25,
        size: 2 + Math.random() * 2,
        color: '#00FFFF',
        type: 'spark',
      });
    }
  }

  burstPickup(x: number, y: number, color: string): void {
    for (let i = 0; i < 16; i++) {
      const angle = (i / 16) * Math.PI * 2;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * 160,
        vy: Math.sin(angle) * 160 - 60,
        life: 0.5,
        maxLife: 0.5,
        size: 3,
        color,
        type: 'spark',
      });
    }
  }

  update(dt: number): void {
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.type === 'smoke') {
        p.vx *= 0.9;
        p.vy *= 0.9;
        p.size += dt * 18;
      } else {
        p.vy += 200 * dt; // light gravity for sparks
      }
      p.life -= dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
  }

  render(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    for (const p of this.particles) {
      const a = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = a;
      if (p.type === 'smoke') {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      }
    }
    ctx.restore();
  }
}
