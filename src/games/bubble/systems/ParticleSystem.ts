// ===== src/games/bubble/systems/ParticleSystem.ts =====

import { Particle, ParticleConfig } from '../entities/Particle';
import { BUBBLE_COLORS, BubbleColor } from '../entities/Bubble';

export class ParticleSystem {
  private particles: Particle[] = [];
  private readonly MAX_PARTICLES = 500;

  public update(dt: number): void {
    this.particles = this.particles.filter(p => p.update(dt));

    if (this.particles.length > this.MAX_PARTICLES) {
      this.particles = this.particles.slice(-this.MAX_PARTICLES);
    }
  }

  public render(ctx: CanvasRenderingContext2D): void {
    for (const particle of this.particles) {
      particle.render(ctx);
    }
  }

  private spawn(config: ParticleConfig): void {
    this.particles.push(new Particle(config));
  }

  public clear(): void {
    this.particles = [];
  }

  // ===== Bubble Pop Effects =====

  public createBubblePop(x: number, y: number, color: BubbleColor): void {
    const colors = BUBBLE_COLORS[color];

    // Main burst
    for (let i = 0; i < 16; i++) {
      const angle = (Math.PI * 2 * i) / 16;
      const speed = 100 + Math.random() * 80;
      this.spawn({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.5 + Math.random() * 0.3,
        color: colors.primary,
        size: 6 + Math.random() * 6,
        gravity: 150,
        shape: 'bubble',
      });
    }

    // Inner sparkles
    for (let i = 0; i < 8; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 50 + Math.random() * 50;
      this.spawn({
        x: x + (Math.random() - 0.5) * 20,
        y: y + (Math.random() - 0.5) * 20,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 50,
        life: 0.4 + Math.random() * 0.2,
        color: colors.highlight,
        size: 4 + Math.random() * 4,
        gravity: 100,
        shape: 'star',
      });
    }

    // Expanding ring
    this.spawn({
      x,
      y,
      vx: 0,
      vy: 0,
      life: 0.3,
      color: colors.primary,
      size: 20,
      gravity: 0,
      friction: 1,
      shrink: false,
      shape: 'ring',
    });
  }

  public createChainPop(x: number, y: number, chainIndex: number): void {
    // Chain reaction has more intense particles
    const hue = (chainIndex * 30) % 360;
    const color = `hsl(${hue}, 80%, 60%)`;

    for (let i = 0; i < 12; i++) {
      const angle = (Math.PI * 2 * i) / 12;
      const speed = 80 + Math.random() * 60 + chainIndex * 20;
      this.spawn({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.4 + Math.random() * 0.2,
        color,
        size: 5 + Math.random() * 4,
        gravity: 100,
        shape: 'circle',
      });
    }
  }

  public createCascade(x: number, y: number, color: BubbleColor): void {
    const colors = BUBBLE_COLORS[color];

    // Falling trail
    for (let i = 0; i < 10; i++) {
      this.spawn({
        x: x + (Math.random() - 0.5) * 20,
        y: y + (Math.random() - 0.5) * 10,
        vx: (Math.random() - 0.5) * 40,
        vy: -30 - Math.random() * 30,
        life: 0.6 + Math.random() * 0.3,
        color: colors.primary,
        size: 4 + Math.random() * 4,
        gravity: 300,
        shape: 'bubble',
      });
    }

    // Sparkle trail
    for (let i = 0; i < 5; i++) {
      this.spawn({
        x: x + (Math.random() - 0.5) * 30,
        y: y + (Math.random() - 0.5) * 15,
        vx: (Math.random() - 0.5) * 60,
        vy: -50 - Math.random() * 50,
        life: 0.5,
        color: '#FFFFFF',
        size: 6,
        gravity: 200,
        shape: 'star',
      });
    }
  }

  // ===== Power-up Effects =====

  public createBombExplosion(x: number, y: number): void {
    // Massive explosion
    for (let i = 0; i < 40; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 150 + Math.random() * 200;
      this.spawn({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.6 + Math.random() * 0.4,
        color: i % 3 === 0 ? '#EF4444' : i % 3 === 1 ? '#F97316' : '#FBBF24',
        size: 8 + Math.random() * 10,
        gravity: 200,
        shape: Math.random() > 0.5 ? 'square' : 'circle',
      });
    }

    // Smoke
    for (let i = 0; i < 15; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 30 + Math.random() * 40;
      this.spawn({
        x: x + (Math.random() - 0.5) * 40,
        y: y + (Math.random() - 0.5) * 40,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 50,
        life: 1 + Math.random() * 0.5,
        color: '#4B5563',
        size: 20 + Math.random() * 20,
        gravity: -30,
        friction: 0.95,
        shrink: false,
        shape: 'circle',
      });
    }

    // Shockwave rings
    for (let i = 0; i < 3; i++) {
      setTimeout(() => {
        this.spawn({
          x,
          y,
          vx: 0,
          vy: 0,
          life: 0.4,
          color: '#F97316',
          size: 30 + i * 20,
          gravity: 0,
          friction: 1,
          shrink: false,
          shape: 'ring',
        });
      }, i * 80);
    }
  }

  public createRainbowBurst(x: number, y: number): void {
    // Rainbow spiral
    for (let i = 0; i < 30; i++) {
      const angle = (Math.PI * 2 * i) / 30;
      const hue = (i / 30) * 360;
      const speed = 120 + Math.random() * 60;
      this.spawn({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.8 + Math.random() * 0.4,
        color: `hsl(${hue}, 90%, 60%)`,
        size: 8 + Math.random() * 6,
        gravity: 100,
        shape: 'bubble',
      });
    }

    // Central flash
    this.spawn({
      x,
      y,
      vx: 0,
      vy: 0,
      life: 0.5,
      color: '#FFFFFF',
      size: 60,
      gravity: 0,
      friction: 1,
      shrink: true,
      shape: 'circle',
    });
  }

  public createLightningStrike(x: number, y: number, width: number): void {
    // Lightning bolts across row
    for (let i = 0; i < 20; i++) {
      const px = x + (Math.random() - 0.5) * width;
      this.spawn({
        x: px,
        y,
        vx: (Math.random() - 0.5) * 100,
        vy: -100 - Math.random() * 100,
        life: 0.3 + Math.random() * 0.2,
        color: '#FBBF24',
        size: 6 + Math.random() * 6,
        gravity: 0,
        shape: 'star',
      });
    }

    // Electric sparks
    for (let i = 0; i < 15; i++) {
      const px = x + (Math.random() - 0.5) * width;
      this.spawn({
        x: px,
        y: y + (Math.random() - 0.5) * 20,
        vx: (Math.random() - 0.5) * 200,
        vy: (Math.random() - 0.5) * 100,
        life: 0.2,
        color: '#FEF3C7',
        size: 4,
        gravity: 0,
        friction: 0.9,
        shape: 'circle',
      });
    }
  }

  public createFreezeEffect(x: number, y: number): void {
    // Ice crystals
    for (let i = 0; i < 20; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 60 + Math.random() * 40;
      this.spawn({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1 + Math.random() * 0.5,
        color: i % 2 === 0 ? '#06B6D4' : '#E0F2FE',
        size: 6 + Math.random() * 8,
        gravity: 50,
        shape: 'star',
        rotationSpeed: 5,
      });
    }

    // Frost ring
    this.spawn({
      x,
      y,
      vx: 0,
      vy: 0,
      life: 0.6,
      color: '#06B6D4',
      size: 50,
      gravity: 0,
      friction: 1,
      shrink: false,
      shape: 'ring',
    });
  }

  public createStarBurst(x: number, y: number): void {
    // Star shower
    for (let i = 0; i < 25; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 80 + Math.random() * 100;
      this.spawn({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.6 + Math.random() * 0.4,
        color: i % 2 === 0 ? '#FBBF24' : '#FEF3C7',
        size: 8 + Math.random() * 6,
        gravity: 100,
        shape: 'star',
        rotationSpeed: 10,
      });
    }

    // Golden sparkles
    for (let i = 0; i < 15; i++) {
      this.spawn({
        x: x + (Math.random() - 0.5) * 60,
        y: y + (Math.random() - 0.5) * 60,
        vx: (Math.random() - 0.5) * 50,
        vy: -50 - Math.random() * 50,
        life: 0.8,
        color: '#FFFFFF',
        size: 4,
        gravity: 80,
        shape: 'circle',
      });
    }
  }

  // ===== UI Effects =====

  public createComboFlash(canvasWidth: number, canvasHeight: number, comboLevel: number): void {
    // Screen-edge particles
    const colors = ['#FBBF24', '#F59E0B', '#EF4444', '#EC4899'];
    const color = colors[Math.min(comboLevel - 1, colors.length - 1)];
    const count = 10 + comboLevel * 5;

    for (let i = 0; i < count; i++) {
      const edge = Math.floor(Math.random() * 4);
      let x, y, vx, vy;

      switch (edge) {
        case 0: // Top
          x = Math.random() * canvasWidth;
          y = 0;
          vx = (Math.random() - 0.5) * 100;
          vy = 100 + Math.random() * 100;
          break;
        case 1: // Bottom
          x = Math.random() * canvasWidth;
          y = canvasHeight;
          vx = (Math.random() - 0.5) * 100;
          vy = -100 - Math.random() * 100;
          break;
        case 2: // Left
          x = 0;
          y = Math.random() * canvasHeight;
          vx = 100 + Math.random() * 100;
          vy = (Math.random() - 0.5) * 100;
          break;
        default: // Right
          x = canvasWidth;
          y = Math.random() * canvasHeight;
          vx = -100 - Math.random() * 100;
          vy = (Math.random() - 0.5) * 100;
      }

      this.spawn({
        x,
        y,
        vx,
        vy,
        life: 0.6,
        color,
        size: 6 + Math.random() * 4,
        gravity: 0,
        friction: 0.95,
        shape: 'star',
      });
    }
  }

  public createShootTrail(x: number, y: number, color: string): void {
    this.spawn({
      x: x + (Math.random() - 0.5) * 10,
      y: y + (Math.random() - 0.5) * 10,
      vx: (Math.random() - 0.5) * 30,
      vy: 20 + Math.random() * 20,
      life: 0.2,
      color,
      size: 4 + Math.random() * 4,
      gravity: 0,
      friction: 0.9,
      shrink: true,
      shape: 'circle',
    });
  }

  public createCeilingWarning(canvasWidth: number, y: number): void {
    // Warning particles across ceiling
    for (let i = 0; i < 15; i++) {
      this.spawn({
        x: Math.random() * canvasWidth,
        y,
        vx: (Math.random() - 0.5) * 50,
        vy: 30 + Math.random() * 30,
        life: 0.5,
        color: '#EF4444',
        size: 4,
        gravity: 50,
        shape: 'square',
      });
    }
  }

  public createVictory(canvasWidth: number, canvasHeight: number): void {
    // Confetti explosion from multiple points
    for (let burst = 0; burst < 3; burst++) {
      setTimeout(() => {
        const bx = canvasWidth * (0.25 + burst * 0.25);
        for (let i = 0; i < 50; i++) {
          const hue = Math.random() * 360;
          this.spawn({
            x: bx + (Math.random() - 0.5) * 100,
            y: canvasHeight * 0.6,
            vx: (Math.random() - 0.5) * 400,
            vy: -250 - Math.random() * 350,
            life: 2.5 + Math.random(),
            color: `hsl(${hue}, 90%, 60%)`,
            size: 8 + Math.random() * 10,
            gravity: 180,
            friction: 0.98,
            shape: Math.random() > 0.5 ? 'square' : 'star',
            rotationSpeed: 8 + Math.random() * 8,
          });
        }
      }, burst * 150);
    }

    // Golden shower from top
    for (let i = 0; i < 40; i++) {
      setTimeout(() => {
        this.spawn({
          x: Math.random() * canvasWidth,
          y: -20,
          vx: (Math.random() - 0.5) * 50,
          vy: 100 + Math.random() * 100,
          life: 3 + Math.random(),
          color: i % 2 === 0 ? '#FBBF24' : '#FEF3C7',
          size: 6 + Math.random() * 6,
          gravity: 80,
          friction: 0.99,
          shape: 'star',
          rotationSpeed: 5,
        });
      }, Math.random() * 500);
    }
  }

  // ===== Score Popup Effects =====

  public createScorePopup(x: number, y: number, score: number): void {
    // Sparkle burst around score
    const color = score >= 500 ? '#FBBF24' : score >= 200 ? '#22C55E' : '#FFFFFF';
    const count = Math.min(8, Math.floor(score / 100) + 3);

    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count;
      this.spawn({
        x,
        y,
        vx: Math.cos(angle) * 40,
        vy: Math.sin(angle) * 40 - 30,
        life: 0.4,
        color,
        size: 4,
        gravity: 50,
        shape: 'star',
      });
    }
  }

  public createPerfectShot(x: number, y: number): void {
    // Golden ring expansion
    for (let i = 0; i < 2; i++) {
      setTimeout(() => {
        this.spawn({
          x,
          y,
          vx: 0,
          vy: 0,
          life: 0.5,
          color: '#FBBF24',
          size: 25 + i * 15,
          gravity: 0,
          friction: 1,
          shrink: false,
          shape: 'ring',
        });
      }, i * 100);
    }

    // Star burst
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 * i) / 8;
      this.spawn({
        x,
        y,
        vx: Math.cos(angle) * 80,
        vy: Math.sin(angle) * 80,
        life: 0.5,
        color: '#FEF3C7',
        size: 6,
        gravity: 0,
        friction: 0.92,
        shape: 'star',
        rotationSpeed: 8,
      });
    }
  }

  public createAmbientBubble(canvasWidth: number, canvasHeight: number): void {
    // Subtle floating bubble
    this.spawn({
      x: Math.random() * canvasWidth,
      y: canvasHeight + 20,
      vx: (Math.random() - 0.5) * 20,
      vy: -30 - Math.random() * 20,
      life: 8 + Math.random() * 4,
      color: `hsla(${200 + Math.random() * 60}, 60%, 70%, 0.3)`,
      size: 8 + Math.random() * 12,
      gravity: -5,
      friction: 0.995,
      shrink: false,
      shape: 'bubble',
    });
  }

  public createFeverPulse(canvasWidth: number, canvasHeight: number, level: number): void {
    // Energy pulse from edges based on fever level
    const colors = ['#F59E0B', '#EF4444', '#EC4899', '#A855F7', '#6366F1', '#14B8A6'];
    const color = colors[Math.min(level - 1, colors.length - 1)];
    const count = 5 + level * 2;

    for (let i = 0; i < count; i++) {
      const side = Math.floor(Math.random() * 4);
      let x, y, vx, vy;

      switch (side) {
        case 0: x = Math.random() * canvasWidth; y = 0; vx = 0; vy = 60; break;
        case 1: x = Math.random() * canvasWidth; y = canvasHeight; vx = 0; vy = -60; break;
        case 2: x = 0; y = Math.random() * canvasHeight; vx = 60; vy = 0; break;
        default: x = canvasWidth; y = Math.random() * canvasHeight; vx = -60; vy = 0;
      }

      this.spawn({
        x,
        y,
        vx,
        vy,
        life: 0.8,
        color,
        size: 4 + level,
        gravity: 0,
        friction: 0.96,
        shape: 'circle',
      });
    }
  }

  public createLandingDust(x: number, y: number): void {
    // Small dust puff when bubble lands
    for (let i = 0; i < 6; i++) {
      const angle = Math.PI + (Math.random() - 0.5) * Math.PI * 0.8;
      this.spawn({
        x,
        y,
        vx: Math.cos(angle) * (30 + Math.random() * 20),
        vy: Math.sin(angle) * (30 + Math.random() * 20),
        life: 0.3,
        color: 'rgba(255, 255, 255, 0.5)',
        size: 4 + Math.random() * 3,
        gravity: 20,
        friction: 0.9,
        shape: 'circle',
      });
    }
  }
}
