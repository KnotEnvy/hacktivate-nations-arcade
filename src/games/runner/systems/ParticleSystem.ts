// ===== src/games/runner/systems/ParticleSystem.ts (ENHANCED) =====
import { Particle } from '../entities/Particle';
import { ImpactRing, ImpactRingType } from '../entities/ImpactRing';

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
}