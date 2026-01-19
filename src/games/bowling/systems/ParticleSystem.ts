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
  type: 'spark' | 'debris' | 'smoke' | 'star' | 'ring' | 'splinter' | 'shockwave' | 'dust';
  rotation: number;
  rotationSpeed: number;
  gravity: number;
  // NEW: Additional properties for enhanced effects
  scaleX?: number;  // For stretched particles
  scaleY?: number;
}

export class ParticleSystem {
  private particles: Particle[] = [];
  private readonly MAX_PARTICLES = 350; // Increased for more dramatic effects

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
        case 'splinter':
          this.renderSplinter(ctx, p, size, alpha);
          break;
        case 'shockwave':
          this.renderShockwave(ctx, p, size, alpha);
          break;
        case 'dust':
          this.renderDust(ctx, p, size, alpha);
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

  // NEW: Wood splinter - elongated tumbling piece
  private renderSplinter(ctx: CanvasRenderingContext2D, p: Particle, size: number, alpha: number): void {
    const length = size * 2.5;
    const width = size * 0.4;

    // Gradient for wood look
    const gradient = ctx.createLinearGradient(-length / 2, 0, length / 2, 0);
    gradient.addColorStop(0, '#8B7355');
    gradient.addColorStop(0.5, '#D4A574');
    gradient.addColorStop(1, '#A0826D');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.ellipse(0, 0, length / 2, width / 2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Highlight edge
    ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.3})`;
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }

  // NEW: Expanding shockwave ring
  private renderShockwave(ctx: CanvasRenderingContext2D, p: Particle, size: number, alpha: number): void {
    // Outer ring
    ctx.beginPath();
    ctx.arc(0, 0, size, 0, Math.PI * 2);
    const gradient = ctx.createRadialGradient(0, 0, size * 0.8, 0, 0, size);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
    gradient.addColorStop(0.7, `rgba(255, 255, 255, ${alpha * 0.4})`);
    gradient.addColorStop(1, `rgba(255, 200, 100, ${alpha * 0.2})`);
    ctx.fillStyle = gradient;
    ctx.fill();

    // Inner bright ring
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.9, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255, 255, 200, ${alpha * 0.6})`;
    ctx.lineWidth = 2 + size * 0.03;
    ctx.stroke();
  }

  // NEW: Dust puff
  private renderDust(ctx: CanvasRenderingContext2D, p: Particle, size: number, alpha: number): void {
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, size);
    gradient.addColorStop(0, `rgba(180, 160, 130, ${alpha * 0.6})`);
    gradient.addColorStop(0.5, `rgba(160, 140, 110, ${alpha * 0.3})`);
    gradient.addColorStop(1, 'rgba(140, 120, 100, 0)');

    ctx.beginPath();
    ctx.arc(0, 0, size, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();
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

  // Pin impact effect - ENHANCED for Wii-style satisfaction
  emitPinImpact(x: number, y: number, intensity: number): void {
    const count = Math.floor(6 + intensity * 12);

    // Wood splinters flying out
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 80 + Math.random() * 180 * intensity;

      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 60 * intensity, // Upward bias
        life: 0.4 + Math.random() * 0.5,
        maxLife: 0.9,
        size: 2 + Math.random() * 4,
        color: '#D4A574',
        type: 'splinter',
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 20, // Fast tumble
        gravity: 250
      });
    }

    // Bright sparks on high intensity hits
    if (intensity > 0.5) {
      this.emit(x, y, Math.floor(count / 2), '#FFF8DC', 'spark');
    }

    // Dust cloud at impact point
    for (let i = 0; i < 3; i++) {
      this.particles.push({
        x: x + (Math.random() - 0.5) * 15,
        y: y + (Math.random() - 0.5) * 15,
        vx: (Math.random() - 0.5) * 30,
        vy: -10 - Math.random() * 20,
        life: 0.3 + Math.random() * 0.3,
        maxLife: 0.6,
        size: 12 + Math.random() * 10,
        color: '#B8A080',
        type: 'dust',
        rotation: 0,
        rotationSpeed: 0,
        gravity: -15 // Rises slowly
      });
    }
  }

  // NEW: Shockwave effect for big impacts
  emitShockwave(x: number, y: number, intensity: number): void {
    this.particles.push({
      x,
      y,
      vx: 0,
      vy: 0,
      life: 0.3,
      maxLife: 0.3,
      size: 5 + intensity * 60, // Expands based on intensity
      color: '#FFFFFF',
      type: 'shockwave',
      rotation: 0,
      rotationSpeed: 0,
      gravity: 0
    });
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
