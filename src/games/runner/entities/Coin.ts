// ===== src/games/runner/entities/Coin.ts =====
import { Vector2, Rectangle } from '@/games/shared/utils/Vector2';

interface Sparkle {
  x: number;
  y: number;
  life: number;
  angle: number;
}

/**
 * A coin that actually spins.
 *
 * The old one rotated a flat square, which read as a tumbling tile. This one
 * scales its width by cos(spin) so it turns edge-on and back like a real coin,
 * and paints a rim when it is near edge-on so it never disappears.
 */
export class Coin {
  position: Vector2;
  velocity: Vector2;
  size: number = 18;

  private spin: number;
  private bobOffset: number = 0;
  private glowPhase: number;
  private sparkleTimer: number = 0;
  private sparkles: Sparkle[] = [];
  /** Magnet pull leans the coin toward the player; purely cosmetic. */
  private attractLean: number = 0;

  constructor(x: number, y: number) {
    this.position = new Vector2(x, y);
    this.velocity = new Vector2(-200, 0);
    // Desynchronise coins spawned in the same burst.
    this.spin = Math.random() * Math.PI * 2;
    this.glowPhase = Math.random() * Math.PI * 2;
  }

  update(dt: number, gameSpeed: number): void {
    this.velocity.x = -200 * gameSpeed;
    this.position = this.position.add(this.velocity.multiply(dt));

    this.spin += dt * 4.5;
    this.glowPhase += dt * 3;
    this.bobOffset = Math.sin(this.glowPhase * 0.8) * 3.5;
    this.attractLean *= Math.max(0, 1 - dt * 5);

    this.sparkleTimer += dt;
    if (this.sparkleTimer > 0.35 && this.sparkles.length < 3) {
      this.sparkleTimer = 0;
      const angle = Math.random() * Math.PI * 2;
      this.sparkles.push({
        x: Math.cos(angle) * this.size * 0.75,
        y: Math.sin(angle) * this.size * 0.75,
        life: 0.4,
        angle: Math.random() * Math.PI * 2,
      });
    }

    this.sparkles = this.sparkles.filter(s => {
      s.life -= dt;
      return s.life > 0;
    });
  }

  /** Called while a magnet is dragging this coin, for the lean. */
  markAttracted(): void {
    this.attractLean = 1;
  }

  render(ctx: CanvasRenderingContext2D): void {
    const renderY = this.position.y + this.bobOffset;
    const cx = this.position.x + this.size / 2;
    const cy = renderY + this.size / 2;
    const r = this.size / 2;

    ctx.save();

    // Halo.
    const pulse = (Math.sin(this.glowPhase) + 1) * 0.5;
    const glowRadius = this.size + 6 + pulse * 6;
    const glow = ctx.createRadialGradient(cx, cy, r * 0.5, cx, cy, glowRadius);
    glow.addColorStop(0, `rgba(253, 224, 138, ${0.4 + pulse * 0.2})`);
    glow.addColorStop(1, 'rgba(253, 224, 138, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy, glowRadius, 0, Math.PI * 2);
    ctx.fill();

    // Sparkles.
    for (const s of this.sparkles) {
      ctx.save();
      ctx.globalAlpha = s.life / 0.4;
      ctx.fillStyle = '#FFFFFF';
      ctx.translate(cx + s.x, cy + s.y);
      ctx.rotate(s.angle);
      ctx.fillRect(-0.8, -4, 1.6, 8);
      ctx.fillRect(-4, -0.8, 8, 1.6);
      ctx.restore();
    }

    ctx.translate(cx, cy);
    ctx.rotate(this.attractLean * 0.4);

    // The spin: width collapses to the rim and opens out again.
    const turn = Math.cos(this.spin);
    const faceWidth = Math.abs(turn) * r;
    const rimWidth = 1.8;

    // Edge/thickness, always drawn so the coin has a body at every angle.
    ctx.fillStyle = '#B4791C';
    this.ellipse(ctx, 0, 0, Math.max(faceWidth + rimWidth, rimWidth), r);

    if (faceWidth > 1.2) {
      // Face, lit from the upper left.
      const face = ctx.createLinearGradient(-faceWidth, -r, faceWidth, r);
      face.addColorStop(0, '#FFE9A8');
      face.addColorStop(0.5, '#FBC02D');
      face.addColorStop(1, '#D18B12');
      ctx.fillStyle = face;
      this.ellipse(ctx, 0, 0, faceWidth, r);

      // Inner ring and stamp, scaled with the turn so they foreshorten.
      ctx.strokeStyle = 'rgba(146, 64, 14, 0.7)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.ellipse(0, 0, Math.max(0.5, faceWidth * 0.62), r * 0.62, 0, 0, Math.PI * 2);
      ctx.stroke();

      if (faceWidth > r * 0.45) {
        ctx.fillStyle = '#8A5309';
        ctx.save();
        ctx.scale(Math.max(0.05, faceWidth / r), 1);
        ctx.fillRect(-1.3, -r * 0.45, 2.6, r * 0.9);
        ctx.fillRect(-4, -r * 0.3, 8, 2.2);
        ctx.fillRect(-4, r * 0.1, 8, 2.2);
        ctx.restore();
      }

      // Specular streak.
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = '#FFFDF0';
      ctx.beginPath();
      ctx.ellipse(-faceWidth * 0.35, -r * 0.35, Math.max(0.6, faceWidth * 0.22), r * 0.3, -0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    } else {
      // Near edge-on: a bright sliver, so it flashes rather than vanishing.
      ctx.fillStyle = '#FFE9A8';
      ctx.fillRect(-rimWidth / 2, -r, rimWidth, r * 2);
    }

    ctx.restore();
  }

  private ellipse(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    rx: number,
    ry: number
  ): void {
    ctx.beginPath();
    ctx.ellipse(x, y, Math.max(0.4, rx), ry, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  getBounds(): Rectangle {
    // Generous: a coin you nearly touched should count.
    return new Rectangle(
      this.position.x - 3,
      this.position.y + this.bobOffset - 3,
      this.size + 6,
      this.size + 6
    );
  }

  isOffScreen(): boolean {
    return this.position.x + this.size < -20;
  }
}
