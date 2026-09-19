// ===== src/games/runner/entities/PowerUp.ts =====
import { Vector2, Rectangle } from '@/games/shared/utils/Vector2';

export type PowerUpType = 'double-jump' | 'coin-magnet' | 'invincibility' | 'speed-boost';

interface Style {
  core: string;
  edge: string;
  glow: string;
  label: string;
}

const STYLES: Record<PowerUpType, Style> = {
  'double-jump': { core: '#60A5FA', edge: '#1D4ED8', glow: '#93C5FD', label: 'Double Jump' },
  'coin-magnet': { core: '#F87171', edge: '#B91C1C', glow: '#FCA5A5', label: 'Coin Magnet' },
  invincibility: { core: '#34D399', edge: '#047857', glow: '#6EE7B7', label: 'Shield' },
  'speed-boost': { core: '#FBBF24', edge: '#B45309', glow: '#FDE68A', label: 'Speed Boost' },
};

export function powerUpStyle(type: PowerUpType): Style {
  return STYLES[type];
}

/**
 * A capsule with an orbiting ring and a white pictogram.
 *
 * The pictogram is drawn upright while the capsule bobs, because a spinning
 * icon at 24px is unreadable — the motion lives in the ring and the bob
 * instead.
 */
export class PowerUp {
  position: Vector2;
  velocity: Vector2;
  size: Vector2;
  type: PowerUpType;

  private time: number;
  private bobOffset: number = 0;

  constructor(x: number, y: number, type: PowerUpType) {
    this.position = new Vector2(x, y);
    this.velocity = new Vector2(-200, 0);
    this.size = new Vector2(28, 28);
    this.type = type;
    this.time = Math.random() * 6;
  }

  update(dt: number, gameSpeed: number): void {
    this.velocity.x = -200 * gameSpeed;
    this.position = this.position.add(this.velocity.multiply(dt));
    this.time += dt;
    this.bobOffset = Math.sin(this.time * 3) * 5;
  }

  render(ctx: CanvasRenderingContext2D): void {
    const s = STYLES[this.type];
    const cx = this.position.x + this.size.x / 2;
    const cy = this.position.y + this.bobOffset + this.size.y / 2;
    const r = this.size.x / 2;

    ctx.save();
    ctx.translate(cx, cy);

    // Halo.
    const pulse = (Math.sin(this.time * 4) + 1) * 0.5;
    const glow = ctx.createRadialGradient(0, 0, r * 0.4, 0, 0, r + 16 + pulse * 8);
    glow.addColorStop(0, this.rgba(s.glow, 0.5));
    glow.addColorStop(1, this.rgba(s.glow, 0));
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, r + 16 + pulse * 8, 0, Math.PI * 2);
    ctx.fill();

    // Orbiting ring, seen edge-on so it reads as 3D.
    ctx.strokeStyle = this.rgba(s.glow, 0.85);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 0, r + 6, Math.abs(Math.cos(this.time * 2)) * (r + 6), 0.35, 0, Math.PI * 2);
    ctx.stroke();

    // Capsule body.
    const body = ctx.createLinearGradient(0, -r, 0, r);
    body.addColorStop(0, s.core);
    body.addColorStop(1, s.edge);
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, r - 1, 0, Math.PI * 2);
    ctx.stroke();

    // Top gloss.
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.beginPath();
    ctx.ellipse(-r * 0.25, -r * 0.42, r * 0.5, r * 0.26, -0.4, 0, Math.PI * 2);
    ctx.fill();

    this.drawIcon(ctx);
    ctx.restore();
  }

  private drawIcon(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    switch (this.type) {
      case 'double-jump':
        // Two stacked chevrons: up, and up again.
        for (let i = 0; i < 2; i++) {
          const y = -1 + i * 7;
          ctx.beginPath();
          ctx.moveTo(-6, y);
          ctx.lineTo(0, y - 6);
          ctx.lineTo(6, y);
          ctx.stroke();
        }
        break;

      case 'coin-magnet': {
        // A horseshoe magnet with its poles down.
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, 6, Math.PI, 0);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-6, 0);
        ctx.lineTo(-6, 6);
        ctx.moveTo(6, 0);
        ctx.lineTo(6, 6);
        ctx.stroke();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#FFE08A';
        ctx.beginPath();
        ctx.moveTo(-6, 6);
        ctx.lineTo(-6, 8.5);
        ctx.moveTo(6, 6);
        ctx.lineTo(6, 8.5);
        ctx.stroke();
        break;
      }

      case 'invincibility':
        // A shield with a check notch.
        ctx.beginPath();
        ctx.moveTo(0, -8);
        ctx.lineTo(7, -4.5);
        ctx.lineTo(7, 2);
        ctx.quadraticCurveTo(7, 7, 0, 9);
        ctx.quadraticCurveTo(-7, 7, -7, 2);
        ctx.lineTo(-7, -4.5);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#047857';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-3, 0);
        ctx.lineTo(-0.5, 3);
        ctx.lineTo(4, -3);
        ctx.stroke();
        break;

      case 'speed-boost':
        // A lightning bolt.
        ctx.beginPath();
        ctx.moveTo(2, -9);
        ctx.lineTo(-5, 1);
        ctx.lineTo(-0.5, 1);
        ctx.lineTo(-2, 9);
        ctx.lineTo(5.5, -1.5);
        ctx.lineTo(1, -1.5);
        ctx.closePath();
        ctx.fill();
        break;
    }
  }

  private rgba(hex: string, alpha: number): string {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
  }

  getBounds(): Rectangle {
    return new Rectangle(
      this.position.x - 2,
      this.position.y + this.bobOffset - 2,
      this.size.x + 4,
      this.size.y + 4
    );
  }

  isOffScreen(): boolean {
    return this.position.x + this.size.x < -20;
  }
}
