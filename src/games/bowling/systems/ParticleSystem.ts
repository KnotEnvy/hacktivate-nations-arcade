// ===== src/games/bowling/systems/ParticleSystem.ts =====
// Particle effects for bowling game

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  type: 'spark' | 'debris' | 'smoke' | 'star' | 'ring';
  rotation: number;
  rotationSpeed: number;
  gravity: number;
}

export class ParticleSystem {
  private particles: Particle[] = [];
  private readonly MAX_PARTICLES = 200;

  update(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];

      // Update position
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      // Apply gravity
      p.vy += p.gravity * dt;

      // Update rotation
      p.rotation += p.rotationSpeed * dt;

      // Update life
      p.life -= dt;

      // Remove dead particles
      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    for (const p of this.particles) {
      const alpha = Math.max(0, p.life / p.maxLife);
      const size = p.size * (0.5 + alpha * 0.5);

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.globalAlpha = alpha;

      switch (p.type) {
        case 'spark':
          this.renderSpark(ctx, p, size);
          break;
        case 'debris':
          this.renderDebris(ctx, p, size);
          break;
        case 'smoke':
          this.renderSmoke(ctx, p, size, alpha);
          break;
        case 'star':
          this.renderStar(ctx, p, size);
          break;
        case 'ring':
          this.renderRing(ctx, p, size, alpha);
          break;
      }

      ctx.restore();
    }
  }

  private renderSpark(ctx: CanvasRenderingContext2D, p: Particle, size: number): void {
    ctx.beginPath();
    ctx.arc(0, 0, size, 0, Math.PI * 2);
    ctx.fillStyle = p.color;
    ctx.fill();

    // Glow effect
    ctx.beginPath();
    ctx.arc(0, 0, size * 2, 0, Math.PI * 2);
    ctx.fillStyle = p.color.replace(')', ', 0.3)').replace('rgb', 'rgba');
    ctx.fill();
  }

  private renderDebris(ctx: CanvasRenderingContext2D, p: Particle, size: number): void {
    ctx.beginPath();
    ctx.rect(-size / 2, -size / 2, size, size);
    ctx.fillStyle = p.color;
    ctx.fill();
  }

  private renderSmoke(ctx: CanvasRenderingContext2D, p: Particle, size: number, alpha: number): void {
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, size);
    gradient.addColorStop(0, `rgba(100, 100, 100, ${alpha * 0.5})`);
    gradient.addColorStop(1, 'rgba(100, 100, 100, 0)');

    ctx.beginPath();
    ctx.arc(0, 0, size, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();
  }

  private renderStar(ctx: CanvasRenderingContext2D, p: Particle, size: number): void {
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const angle = (i * Math.PI * 2) / 5 - Math.PI / 2;
      const outerX = Math.cos(angle) * size;
      const outerY = Math.sin(angle) * size;
      const innerAngle = angle + Math.PI / 5;
      const innerX = Math.cos(innerAngle) * size * 0.4;
      const innerY = Math.sin(innerAngle) * size * 0.4;

      if (i === 0) {
        ctx.moveTo(outerX, outerY);
      } else {
        ctx.lineTo(outerX, outerY);
      }
      ctx.lineTo(innerX, innerY);
    }
    ctx.closePath();
    ctx.fillStyle = p.color;
    ctx.fill();
  }

  private renderRing(ctx: CanvasRenderingContext2D, p: Particle, size: number, alpha: number): void {
    ctx.beginPath();
    ctx.arc(0, 0, size, 0, Math.PI * 2);
    ctx.strokeStyle = p.color;
    ctx.lineWidth = 3 * alpha;
    ctx.stroke();
  }

  // Emit particles at a position
  emit(x: number, y: number, count: number, color: string, type: Particle['type']): void {
    for (let i = 0; i < count && this.particles.length < this.MAX_PARTICLES; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 50 + Math.random() * 150;

      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.3 + Math.random() * 0.5,
        maxLife: 0.8,
        size: 3 + Math.random() * 5,
        color,
        type,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 10,
        gravity: type === 'debris' ? 300 : (type === 'smoke' ? -50 : 0)
      });
    }
  }

  // Pin impact effect
  emitPinImpact(x: number, y: number, intensity: number): void {
    const count = Math.floor(5 + intensity * 10);

    // Wood debris
    this.emit(x, y, count, '#C4A35A', 'debris');

    // Sparks
    this.emit(x, y, Math.floor(count / 2), '#FFD700', 'spark');
  }

  // Strike celebration
  emitStrike(x: number, y: number): void {
    // Gold stars
    for (let i = 0; i < 20; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 100 + Math.random() * 200;

      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 100,
        life: 1 + Math.random() * 0.5,
        maxLife: 1.5,
        size: 8 + Math.random() * 8,
        color: '#FFD700',
        type: 'star',
        rotation: 0,
        rotationSpeed: (Math.random() - 0.5) * 5,
        gravity: 100
      });
    }

    // Expanding rings
    for (let i = 0; i < 3; i++) {
      this.particles.push({
        x,
        y,
        vx: 0,
        vy: 0,
        life: 0.5 + i * 0.2,
        maxLife: 0.7 + i * 0.2,
        size: 20 + i * 30,
        color: i === 0 ? '#FFD700' : (i === 1 ? '#FFA500' : '#FF6347'),
        type: 'ring',
        rotation: 0,
        rotationSpeed: 0,
        gravity: 0
      });
    }
  }

  // Spare celebration
  emitSpare(x: number, y: number): void {
    // Silver stars
    for (let i = 0; i < 12; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 80 + Math.random() * 150;

      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 80,
        life: 0.8 + Math.random() * 0.4,
        maxLife: 1.2,
        size: 6 + Math.random() * 6,
        color: '#C0C0C0',
        type: 'star',
        rotation: 0,
        rotationSpeed: (Math.random() - 0.5) * 5,
        gravity: 100
      });
    }

    // Single ring
    this.particles.push({
      x,
      y,
      vx: 0,
      vy: 0,
      life: 0.6,
      maxLife: 0.6,
      size: 30,
      color: '#87CEEB',
      type: 'ring',
      rotation: 0,
      rotationSpeed: 0,
      gravity: 0
    });
  }

  // Gutter effect
  emitGutter(x: number, y: number): void {
    // Dark smoke puffs
    for (let i = 0; i < 8; i++) {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.5;
      const speed = 30 + Math.random() * 50;

      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.5 + Math.random() * 0.3,
        maxLife: 0.8,
        size: 15 + Math.random() * 10,
        color: '#444444',
        type: 'smoke',
        rotation: 0,
        rotationSpeed: 0,
        gravity: -30
      });
    }
  }

  // Turkey celebration (3 strikes)
  emitTurkey(x: number, y: number): void {
    this.emitStrike(x, y);

    // Extra orange bursts
    for (let i = 0; i < 15; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 150 + Math.random() * 250;

      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 150,
        life: 1.2 + Math.random() * 0.6,
        maxLife: 1.8,
        size: 10 + Math.random() * 10,
        color: '#FF4500',
        type: 'star',
        rotation: 0,
        rotationSpeed: (Math.random() - 0.5) * 8,
        gravity: 80
      });
    }
  }

  clear(): void {
    this.particles = [];
  }
}
