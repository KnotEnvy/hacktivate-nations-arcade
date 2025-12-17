// ===== src/games/minigolf/systems/ParticleSystem.ts =====

type ParticleType = 'burst' | 'dust' | 'splash' | 'sparkle' | 'celebration';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  type: ParticleType;
  rotation: number;
  rotationSpeed: number;
}

export class ParticleSystem {
  private particles: Particle[] = [];
  private readonly MAX_PARTICLES = 200;

  emit(
    x: number,
    y: number,
    count: number,
    color: string,
    type: ParticleType
  ): void {
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.MAX_PARTICLES) {
        this.particles.shift();
      }
      
      const particle = this.createParticle(x, y, color, type);
      this.particles.push(particle);
    }
  }

  private createParticle(x: number, y: number, color: string, type: ParticleType): Particle {
    const angle = Math.random() * Math.PI * 2;
    let speed: number;
    let life: number;
    let size: number;
    
    switch (type) {
      case 'burst':
        speed = 50 + Math.random() * 100;
        life = 0.3 + Math.random() * 0.3;
        size = 3 + Math.random() * 4;
        break;
      case 'dust':
        speed = 20 + Math.random() * 30;
        life = 0.4 + Math.random() * 0.3;
        size = 2 + Math.random() * 3;
        break;
      case 'splash':
        speed = 80 + Math.random() * 120;
        life = 0.5 + Math.random() * 0.3;
        size = 4 + Math.random() * 6;
        // Splash goes upward
        return {
          x,
          y,
          vx: (Math.random() - 0.5) * speed,
          vy: -Math.abs(Math.sin(angle)) * speed - 50,
          life,
          maxLife: life,
          size,
          color,
          type,
          rotation: Math.random() * Math.PI * 2,
          rotationSpeed: (Math.random() - 0.5) * 10,
        };
      case 'sparkle':
        speed = 30 + Math.random() * 50;
        life = 0.5 + Math.random() * 0.5;
        size = 2 + Math.random() * 3;
        break;
      case 'celebration':
        speed = 100 + Math.random() * 150;
        life = 1 + Math.random() * 1;
        size = 4 + Math.random() * 6;
        // Celebration goes upward and outward
        return {
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: -Math.abs(Math.sin(angle)) * speed - 80,
          life,
          maxLife: life,
          size,
          color: this.getRandomCelebrationColor(),
          type,
          rotation: Math.random() * Math.PI * 2,
          rotationSpeed: (Math.random() - 0.5) * 15,
        };
      default:
        speed = 50;
        life = 0.5;
        size = 3;
    }
    
    return {
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life,
      maxLife: life,
      size,
      color,
      type,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 5,
    };
  }

  private getRandomCelebrationColor(): string {
    const colors = [
      '#FFD700', // Gold
      '#FF6B6B', // Red
      '#4ECDC4', // Teal
      '#95E1D3', // Mint
      '#F38181', // Coral
      '#AA96DA', // Purple
      '#FCBAD3', // Pink
      '#A8D8EA', // Sky blue
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  update(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      
      // Update position
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      
      // Apply gravity for splash and celebration
      if (p.type === 'splash' || p.type === 'celebration') {
        p.vy += 300 * dt; // gravity
      }
      
      // Update rotation
      p.rotation += p.rotationSpeed * dt;
      
      // Apply drag
      p.vx *= 0.98;
      p.vy *= 0.98;
      
      // Update life
      p.life -= dt;
      
      // Remove dead particles
      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    
    for (const p of this.particles) {
      const alpha = p.life / p.maxLife;
      const size = p.size * (0.5 + alpha * 0.5);
      
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.globalAlpha = alpha;
      
      switch (p.type) {
        case 'burst':
        case 'dust':
          this.renderCircle(ctx, size, p.color);
          break;
        case 'splash':
          this.renderDroplet(ctx, size, p.color);
          break;
        case 'sparkle':
          this.renderSparkle(ctx, size, p.color);
          break;
        case 'celebration':
          this.renderStar(ctx, size, p.color);
          break;
      }
      
      ctx.restore();
    }
    
    ctx.restore();
  }

  private renderCircle(ctx: CanvasRenderingContext2D, size: number, color: string): void {
    ctx.beginPath();
    ctx.arc(0, 0, size, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }

  private renderDroplet(ctx: CanvasRenderingContext2D, size: number, color: string): void {
    ctx.beginPath();
    ctx.ellipse(0, 0, size * 0.6, size, 0, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    
    // Highlight
    ctx.beginPath();
    ctx.arc(-size * 0.2, -size * 0.3, size * 0.2, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.fill();
  }

  private renderSparkle(ctx: CanvasRenderingContext2D, size: number, color: string): void {
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2;
      const outerX = Math.cos(angle) * size;
      const outerY = Math.sin(angle) * size;
      const innerAngle = angle + Math.PI / 4;
      const innerX = Math.cos(innerAngle) * size * 0.3;
      const innerY = Math.sin(innerAngle) * size * 0.3;
      
      if (i === 0) {
        ctx.moveTo(outerX, outerY);
      } else {
        ctx.lineTo(outerX, outerY);
      }
      ctx.lineTo(innerX, innerY);
    }
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }

  private renderStar(ctx: CanvasRenderingContext2D, size: number, color: string): void {
    const spikes = 5;
    const outerRadius = size;
    const innerRadius = size * 0.5;
    
    ctx.beginPath();
    for (let i = 0; i < spikes * 2; i++) {
      const radius = i % 2 === 0 ? outerRadius : innerRadius;
      const angle = (i / (spikes * 2)) * Math.PI * 2 - Math.PI / 2;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    
    // Inner glow
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.fill();
  }

  clear(): void {
    this.particles = [];
  }
}
