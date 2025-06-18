// ===== src/games/runner/systems/ParticleSystem.ts =====
import { Particle } from '../entities/Particle';
import { Vector2 } from '@/games/shared/utils/Vector2';

export class ParticleSystem {
  private particles: Particle[] = [];

  update(dt: number): void {
    this.particles = this.particles.filter(particle => particle.update(dt));
  }

  render(ctx: CanvasRenderingContext2D): void {
    this.particles.forEach(particle => particle.render(ctx));
  }

  createCoinPickup(x: number, y: number): void {
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 * i) / 8;
      const speed = Math.random() * 100 + 50;
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;
      
      this.particles.push(new Particle(
        x, y, vx, vy, 0.5, '#FCD34D'
      ));
    }
  }

  createJumpDust(x: number, y: number): void {
    for (let i = 0; i < 5; i++) {
      const vx = Math.random() * 60 - 30;
      const vy = Math.random() * -40 - 20;
      
      this.particles.push(new Particle(
        x + Math.random() * 32, y + 30, vx, vy, 0.3, '#A3A3A3'
      ));
    }
  }

  createLandingDust(x: number, y: number): void {
    for (let i = 0; i < 8; i++) {
      const vx = Math.random() * 80 - 40;
      const vy = Math.random() * -30 - 10;
      
      this.particles.push(new Particle(
        x + Math.random() * 32, y + 32, vx, vy, 0.4, '#D4D4D8'
      ));
    }
  }
}
