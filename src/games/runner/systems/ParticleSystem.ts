// ===== src/games/runner/systems/ParticleSystem.ts (ENHANCED) =====
import { Particle } from '../entities/Particle';
import { ImpactRing, ImpactRingType } from '../entities/ImpactRing';
import { BossType } from '../entities/Boss';

// Boss color configurations for particles
const BOSS_COLORS: Record<BossType, { primary: string; secondary: string; glow: string }> = {
  sun: { primary: '#FBBF24', secondary: '#F59E0B', glow: '#FDE047' },
  phoenix: { primary: '#F97316', secondary: '#DC2626', glow: '#FBBF24' },
  shadow: { primary: '#6B21A8', secondary: '#4C1D95', glow: '#A855F7' },
  sandworm: { primary: '#D97706', secondary: '#92400E', glow: '#FCD34D' },
  treant: { primary: '#16A34A', secondary: '#166534', glow: '#4ADE80' }
};

export class ParticleSystem {
  private particles: Particle[] = [];
  private impactRings: ImpactRing[] = [];

  update(dt: number): void {
    this.particles = this.particles.filter(particle => particle.update(dt));
    this.impactRings = this.impactRings.filter(ring => ring.update(dt));
  }

  render(ctx: CanvasRenderingContext2D): void {
    // Render rings first (behind particles)
    this.impactRings.forEach(ring => ring.render(ctx));
    this.particles.forEach(particle => particle.render(ctx));
  }

  createImpactRing(x: number, y: number, type: ImpactRingType): void {
    if (this.impactRings.length < 10) { // Performance limit
      this.impactRings.push(new ImpactRing(x, y, type));
    }
  }

  createCoinPickup(x: number, y: number): void {
    // Main burst
    for (let i = 0; i < 12; i++) {
      const angle = (Math.PI * 2 * i) / 12;
      const speed = Math.random() * 120 + 80;
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;
      
      this.particles.push(
        new Particle(x, y, vx, vy, 0.6, '#FCD34D', Math.random() * 6 + 4)
      );
    }
    
    // Sparkle effect
    for (let i = 0; i < 6; i++) {
      const vx = (Math.random() - 0.5) * 100;
      const vy = (Math.random() - 0.5) * 100;
      
      this.particles.push(
        new Particle(x, y, vx, vy, 0.8, '#FFFFFF', Math.random() * 3 + 2)
      );
    }
  }

  createPowerUpPickup(x: number, y: number): void {
    // Radial burst with rainbow colors
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD'];
    
    for (let i = 0; i < 20; i++) {
      const angle = (Math.PI * 2 * i) / 20;
      const speed = Math.random() * 150 + 100;
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;
      const color = colors[Math.floor(Math.random() * colors.length)];
      
      this.particles.push(
        new Particle(x, y, vx, vy, 1.0, color, Math.random() * 8 + 4)
      );
    }
    
    // Central explosion
    for (let i = 0; i < 10; i++) {
      const vx = (Math.random() - 0.5) * 200;
      const vy = (Math.random() - 0.5) * 200;
      
      this.particles.push(
        new Particle(x, y, vx, vy, 0.5, '#FFFFFF', Math.random() * 12 + 8)
      );
    }
  }

  createJumpDust(x: number, y: number): void {
    for (let i = 0; i < 8; i++) {
      const vx = Math.random() * 80 - 40;
      const vy = Math.random() * -60 - 30;
      
      this.particles.push(
        new Particle(
          x + Math.random() * 32,
          y + 30,
          vx,
          vy,
          0.4,
          '#D4D4D8',
          Math.random() * 4 + 3
        )
      );
    }
  }

  createLandingDust(x: number, y: number): void {
    for (let i = 0; i < 12; i++) {
      const vx = Math.random() * 120 - 60;
      const vy = Math.random() * -40 - 20;
      
      this.particles.push(
        new Particle(
          x + Math.random() * 32,
          y + 32,
          vx,
          vy,
          0.5,
          '#A3A3A3',
          Math.random() * 5 + 3
        )
      );
    }
  }

  createSpeedLines(x: number, y: number): void {
    // Speed lines behind player
    for (let i = 0; i < 5; i++) {
      const vx = -200 - Math.random() * 100;
      const vy = (Math.random() - 0.5) * 50;
      
      this.particles.push(
        new Particle(
          x - 20,
          y + Math.random() * 32,
          vx,
          vy,
          0.3,
          '#FFFFFF',
          2
        )
      );
    }
  }

  createDoubleJumpEffect(x: number, y: number): void {
    // Ring of particles for double jump
    for (let i = 0; i < 16; i++) {
      const angle = (Math.PI * 2 * i) / 16;
      const speed = 80;
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;

      this.particles.push(
        new Particle(x + 16, y + 16, vx, vy, 0.4, '#3B82F6', 3)
      );
    }
  }

  // ===== BOSS PARTICLE EFFECTS =====

  createBossExplosion(x: number, y: number, bossType: BossType): void {
    const colors = BOSS_COLORS[bossType];

    // Large central burst
    for (let i = 0; i < 30; i++) {
      const angle = (Math.PI * 2 * i) / 30;
      const speed = 150 + Math.random() * 100;
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;

      this.particles.push(
        new Particle(x, y, vx, vy, 1.2, colors.primary, Math.random() * 12 + 8)
      );
    }

    // Secondary ring
    for (let i = 0; i < 20; i++) {
      const angle = (Math.PI * 2 * i) / 20 + 0.15;
      const speed = 100 + Math.random() * 80;
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;

      this.particles.push(
        new Particle(x, y, vx, vy, 1.0, colors.secondary, Math.random() * 8 + 6)
      );
    }

    // Glow particles
    for (let i = 0; i < 15; i++) {
      const vx = (Math.random() - 0.5) * 200;
      const vy = (Math.random() - 0.5) * 200;

      this.particles.push(
        new Particle(x, y, vx, vy, 0.8, colors.glow, Math.random() * 6 + 4)
      );
    }

    // White flash particles
    for (let i = 0; i < 10; i++) {
      const vx = (Math.random() - 0.5) * 300;
      const vy = (Math.random() - 0.5) * 300;

      this.particles.push(
        new Particle(x, y, vx, vy, 0.5, '#FFFFFF', Math.random() * 10 + 8)
      );
    }
  }

  createBossHitEffect(x: number, y: number, bossType: BossType): void {
    const colors = BOSS_COLORS[bossType];

    // Small burst on hit
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 * i) / 8;
      const speed = 60 + Math.random() * 40;
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;

      this.particles.push(
        new Particle(x, y, vx, vy, 0.4, colors.glow, Math.random() * 5 + 3)
      );
    }

    // White sparks
    for (let i = 0; i < 5; i++) {
      const vx = (Math.random() - 0.5) * 120;
      const vy = -Math.random() * 80 - 20;

      this.particles.push(
        new Particle(x, y, vx, vy, 0.3, '#FFFFFF', Math.random() * 3 + 2)
      );
    }
  }

  createBossRageEffect(x: number, y: number): void {
    // Red pulsing rage particles
    for (let i = 0; i < 3; i++) {
      const angle = Math.random() * Math.PI * 2;
      const distance = 30 + Math.random() * 20;
      const px = x + Math.cos(angle) * distance;
      const py = y + Math.sin(angle) * distance;
      const vx = Math.cos(angle) * 30;
      const vy = Math.sin(angle) * 30 - 20;

      this.particles.push(
        new Particle(px, py, vx, vy, 0.5, '#EF4444', Math.random() * 4 + 3)
      );
    }
  }

  createGroundPoundDust(x: number, groundY: number): void {
    // Ground impact dust cloud
    for (let i = 0; i < 20; i++) {
      const spreadX = (Math.random() - 0.5) * 100;
      const vx = spreadX * 2;
      const vy = -Math.random() * 100 - 50;

      this.particles.push(
        new Particle(
          x + spreadX,
          groundY - 5,
          vx,
          vy,
          0.6,
          '#78716C',
          Math.random() * 8 + 4
        )
      );
    }

    // Debris chunks
    for (let i = 0; i < 8; i++) {
      const vx = (Math.random() - 0.5) * 150;
      const vy = -Math.random() * 120 - 40;

      this.particles.push(
        new Particle(
          x + (Math.random() - 0.5) * 60,
          groundY - 10,
          vx,
          vy,
          0.8,
          '#A8A29E',
          Math.random() * 6 + 3
        )
      );
    }
  }

  createChargeTrail(x: number, y: number, bossType: BossType): void {
    const colors = BOSS_COLORS[bossType];

    // Trailing particles behind charging boss
    for (let i = 0; i < 4; i++) {
      const vx = 50 + Math.random() * 30;
      const vy = (Math.random() - 0.5) * 40;

      this.particles.push(
        new Particle(
          x + Math.random() * 20,
          y + Math.random() * 60,
          vx,
          vy,
          0.4,
          colors.primary,
          Math.random() * 6 + 4
        )
      );
    }

    // Speed lines
    for (let i = 0; i < 2; i++) {
      const vx = 100 + Math.random() * 50;
      const vy = (Math.random() - 0.5) * 20;

      this.particles.push(
        new Particle(
          x,
          y + 20 + Math.random() * 40,
          vx,
          vy,
          0.25,
          '#FFFFFF',
          2
        )
      );
    }
  }

  createProjectileTrail(x: number, y: number): void {
    // Fire trail behind projectiles
    for (let i = 0; i < 2; i++) {
      const vx = 30 + Math.random() * 20;
      const vy = (Math.random() - 0.5) * 30;

      this.particles.push(
        new Particle(
          x + Math.random() * 8,
          y + Math.random() * 8,
          vx,
          vy,
          0.3,
          Math.random() > 0.5 ? '#F97316' : '#FBBF24',
          Math.random() * 4 + 2
        )
      );
    }
  }

  createSummonEffect(x: number, y: number): void {
    // Magical summoning particles
    for (let i = 0; i < 12; i++) {
      const angle = (Math.PI * 2 * i) / 12;
      const speed = 40;
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed - 30;

      this.particles.push(
        new Particle(x, y, vx, vy, 0.6, '#A855F7', Math.random() * 5 + 3)
      );
    }

    // Rising sparkles
    for (let i = 0; i < 8; i++) {
      const vx = (Math.random() - 0.5) * 60;
      const vy = -Math.random() * 80 - 40;

      this.particles.push(
        new Particle(
          x + (Math.random() - 0.5) * 40,
          y,
          vx,
          vy,
          0.5,
          '#E879F9',
          Math.random() * 3 + 2
        )
      );
    }
  }
}