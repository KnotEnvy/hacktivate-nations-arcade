// ===== src/games/block/systems/ParticleSystem.ts =====

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  lifetime: number;
  maxLifetime: number;
  color: string;
  size: number;
  type: 'burst' | 'sparkle' | 'explosion' | 'confetti' | 'lineClear';
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
        p.vy += 350 * dt;
      }

      // Apply drag
      p.vx *= 0.97;
      p.vy *= 0.97;

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
      popup.y -= 40 * dt;
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

      if (p.type === 'sparkle') {
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8;
      }

      ctx.fillStyle = p.color;

      if (p.type === 'confetti' && p.rotation !== undefined) {
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      } else if (p.type === 'lineClear') {
        // Line clear particles are square blocks
        ctx.translate(p.x, p.y);
        if (p.rotation !== undefined) ctx.rotate(p.rotation);
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        // Highlight
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, 3);
      } else if (p.rotation !== undefined) {
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
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
      const scale = popup.scale * (1 + (1 - popup.lifetime / popup.maxLifetime) * 0.3);

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = `bold ${Math.floor(18 * scale)}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillText(popup.text, popup.x + 2, popup.y + 2);

      // Main text with glow
      ctx.shadowColor = popup.color;
      ctx.shadowBlur = 10;
      ctx.fillStyle = popup.color;
      ctx.fillText(popup.text, popup.x, popup.y);

      ctx.restore();
    }
  }

  // Line clear explosion - blocks scatter outward
  createLineClearExplosion(
    boardX: number,
    boardY: number,
    row: number,
    boardWidth: number,
    blockSize: number,
    colors: string[]
  ): void {
    const centerX = boardX + (boardWidth * blockSize) / 2;
    const y = boardY + row * blockSize + blockSize / 2;

    for (let col = 0; col < boardWidth; col++) {
      const x = boardX + col * blockSize + blockSize / 2;
      const angle = Math.atan2(0, x - centerX) + (Math.random() - 0.5) * 0.5;
      const speed = 100 + Math.random() * 150;
      const color = colors[Math.floor(Math.random() * colors.length)];

      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed + (Math.random() - 0.5) * 50,
        vy: -100 - Math.random() * 100,
        lifetime: 0.8 + Math.random() * 0.4,
        maxLifetime: 1.2,
        color,
        size: blockSize * 0.6,
        type: 'lineClear',
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 8,
      });

      // Add sparkles
      for (let i = 0; i < 2; i++) {
        this.particles.push({
          x: x + (Math.random() - 0.5) * blockSize,
          y: y + (Math.random() - 0.5) * blockSize,
          vx: (Math.random() - 0.5) * 100,
          vy: -50 - Math.random() * 80,
          lifetime: 0.4 + Math.random() * 0.3,
          maxLifetime: 0.7,
          color: '#FFFFFF',
          size: 3 + Math.random() * 2,
          type: 'sparkle',
        });
      }
    }
  }

  // Tetris celebration - 4 lines!
  createTetrisCelebration(canvasWidth: number, canvasHeight: number): void {
    const colors = ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#FBBF24'];
    const count = 60;

    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: Math.random() * canvasWidth,
        y: canvasHeight * 0.3 + Math.random() * 50,
        vx: (Math.random() - 0.5) * 300,
        vy: -200 - Math.random() * 150,
        lifetime: 2.0 + Math.random() * 1.0,
        maxLifetime: 3.0,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 8 + Math.random() * 6,
        type: 'confetti',
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 10,
      });
    }
  }

  // Piece lock burst
  createLockBurst(x: number, y: number, color: string): void {
    const count = 6;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.3;
      const speed = 40 + Math.random() * 30;

      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        lifetime: 0.3 + Math.random() * 0.2,
        maxLifetime: 0.5,
        color,
        size: 3 + Math.random() * 2,
        type: 'burst',
      });
    }
  }

  // Hard drop trail
  createHardDropTrail(x: number, y: number, height: number, color: string): void {
    const particleCount = Math.floor(height / 15);
    for (let i = 0; i < particleCount; i++) {
      this.particles.push({
        x: x + (Math.random() - 0.5) * 20,
        y: y - i * 15,
        vx: (Math.random() - 0.5) * 30,
        vy: Math.random() * 20,
        lifetime: 0.2 + Math.random() * 0.2,
        maxLifetime: 0.4,
        color,
        size: 2 + Math.random() * 2,
        type: 'burst',
      });
    }
  }

  // Game over explosion
  createGameOverExplosion(
    boardX: number,
    boardY: number,
    boardWidth: number,
    boardHeight: number,
    blockSize: number
  ): void {
    const colors = ['#EF4444', '#F59E0B', '#3B82F6', '#8B5CF6', '#10B981'];
    const centerX = boardX + (boardWidth * blockSize) / 2;
    const centerY = boardY + (boardHeight * blockSize) / 2;

    for (let i = 0; i < 40; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 80 + Math.random() * 120;

      this.particles.push({
        x: centerX + (Math.random() - 0.5) * boardWidth * blockSize * 0.5,
        y: centerY + (Math.random() - 0.5) * boardHeight * blockSize * 0.3,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 50,
        lifetime: 1.0 + Math.random() * 0.5,
        maxLifetime: 1.5,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: blockSize * 0.4 + Math.random() * blockSize * 0.3,
        type: 'explosion',
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
      lifetime: 1.0,
      maxLifetime: 1.0,
      scale: 1.0,
    });
  }

  // Large score popup for tetris/combos
  addLargeScorePopup(x: number, y: number, text: string, color: string): void {
    this.scorePopups.push({
      x,
      y,
      text,
      color,
      lifetime: 1.5,
      maxLifetime: 1.5,
      scale: 1.5,
    });
  }

  clear(): void {
    this.particles = [];
    this.scorePopups = [];
  }

  getParticleCount(): number {
    return this.particles.length;
  }
}
