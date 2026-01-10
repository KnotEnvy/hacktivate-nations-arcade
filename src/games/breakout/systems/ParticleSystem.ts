// ===== src/games/breakout/systems/ParticleSystem.ts =====

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  lifetime: number;
  maxLifetime: number;
  color: string;
  size: number;
  type: 'burst' | 'sparkle' | 'explosion' | 'glow' | 'confetti';
  rotation?: number;
  rotationSpeed?: number;
}

interface ScorePopup {
  x: number;
  y: number;
  text: string;
  color: string;
  lifetime: number;
  maxLifetime: number;
  scale: number;
}

export class ParticleSystem {
  private particles: Particle[] = [];
  private scorePopups: ScorePopup[] = [];

  update(dt: number): void {
    // Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.lifetime -= dt;

      // Apply gravity to explosions and confetti
      if (p.type === 'explosion' || p.type === 'confetti') {
        p.vy += 400 * dt;
      }

      // Apply drag
      p.vx *= 0.98;
      p.vy *= 0.98;

      // Update rotation
      if (p.rotation !== undefined && p.rotationSpeed !== undefined) {
        p.rotation += p.rotationSpeed * dt;
      }

      if (p.lifetime <= 0) {
        this.particles.splice(i, 1);
      }
    }

    // Update score popups
    for (let i = this.scorePopups.length - 1; i >= 0; i--) {
      const popup = this.scorePopups[i];
      popup.y -= 50 * dt; // Float upward
      popup.lifetime -= dt;

      if (popup.lifetime <= 0) {
        this.scorePopups.splice(i, 1);
      }
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    // Render particles
    for (const p of this.particles) {
      const alpha = Math.min(1, p.lifetime / (p.maxLifetime * 0.3));
      ctx.save();
      ctx.globalAlpha = alpha;

      if (p.type === 'glow') {
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 12;
      }

      ctx.fillStyle = p.color;

      if (p.type === 'confetti' && p.rotation !== undefined) {
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      } else if (p.rotation !== undefined) {
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      } else if (p.type === 'sparkle') {
        this.drawStar(ctx, p.x, p.y, 4, p.size, p.size / 2);
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }

    // Render score popups
    for (const popup of this.scorePopups) {
      const alpha = Math.min(1, popup.lifetime / (popup.maxLifetime * 0.5));
      const scale = popup.scale * (1 + (1 - popup.lifetime / popup.maxLifetime) * 0.2);

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = `bold ${Math.floor(14 * scale)}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillText(popup.text, popup.x + 1, popup.y + 1);

      // Main text with glow
      ctx.shadowColor = popup.color;
      ctx.shadowBlur = 6;
      ctx.fillStyle = popup.color;
      ctx.fillText(popup.text, popup.x, popup.y);

      ctx.restore();
    }
  }

  private drawStar(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    spikes: number,
    outerRadius: number,
    innerRadius: number
  ): void {
    let rot = (Math.PI / 2) * 3;
    const step = Math.PI / spikes;

    ctx.beginPath();
    ctx.moveTo(cx, cy - outerRadius);

    for (let i = 0; i < spikes; i++) {
      let x = cx + Math.cos(rot) * outerRadius;
      let y = cy + Math.sin(rot) * outerRadius;
      ctx.lineTo(x, y);
      rot += step;

      x = cx + Math.cos(rot) * innerRadius;
      y = cy + Math.sin(rot) * innerRadius;
      ctx.lineTo(x, y);
      rot += step;
    }

    ctx.lineTo(cx, cy - outerRadius);
    ctx.closePath();
    ctx.fill();
  }

  // Brick break burst
  createBrickBurst(x: number, y: number, color: string): void {
    const count = 10;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.3;
      const speed = 80 + Math.random() * 100;

      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        lifetime: 0.4 + Math.random() * 0.2,
        maxLifetime: 0.6,
        color,
        size: 3 + Math.random() * 3,
        type: 'burst',
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 10,
      });
    }
  }

  // Power-up collection sparkle
  createPowerUpSparkle(x: number, y: number, color: string): void {
    const count = 12;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count;
      const speed = 60 + Math.random() * 50;

      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        lifetime: 0.5 + Math.random() * 0.3,
        maxLifetime: 0.8,
        color: Math.random() > 0.5 ? color : '#FFFFFF',
        size: 4 + Math.random() * 3,
        type: 'sparkle',
      });
    }
  }

  // Ball lost explosion
  createBallLostExplosion(x: number, y: number): void {
    const colors = ['#FBBF24', '#F59E0B', '#EF4444'];
    const count = 15;

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 100 + Math.random() * 80;

      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 80,
        lifetime: 0.8 + Math.random() * 0.4,
        maxLifetime: 1.2,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 4 + Math.random() * 4,
        type: 'explosion',
        rotation: 0,
        rotationSpeed: (Math.random() - 0.5) * 12,
      });
    }
  }

  // Victory confetti
  createConfetti(canvasWidth: number, y: number = 100): void {
    const colors = ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899'];
    const count = 40;

    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: Math.random() * canvasWidth,
        y: y + Math.random() * 50,
        vx: (Math.random() - 0.5) * 200,
        vy: Math.random() * 100 - 150,
        lifetime: 2.0 + Math.random() * 1.0,
        maxLifetime: 3.0,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 6 + Math.random() * 4,
        type: 'confetti',
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 8,
      });
    }
  }

  // Score popup
  addScorePopup(x: number, y: number, text: string, color: string): void {
    this.scorePopups.push({
      x,
      y,
      text,
      color,
      lifetime: 0.8,
      maxLifetime: 0.8,
      scale: 1.0,
    });
  }

  // Paddle hit glow
  createPaddleHitGlow(x: number, y: number): void {
    const count = 6;
    for (let i = 0; i < count; i++) {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.6;
      const speed = 40 + Math.random() * 30;

      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        lifetime: 0.3,
        maxLifetime: 0.3,
        color: '#22D3EE',
        size: 3 + Math.random() * 2,
        type: 'glow',
      });
    }
  }

  clear(): void {
    this.particles = [];
    this.scorePopups = [];
  }

  getParticleCount(): number {
    return this.particles.length;
  }
}
