// ===== src/games/runner/entities/HoverEnemy.ts =====
import { Vector2, Rectangle } from '@/games/shared/utils/Vector2';
import { EnvironmentTheme } from '../systems/EnvironmentSystem';

interface Skin {
  shell: string;
  shellDark: string;
  rim: string;
  glow: string;
}

const SKINS: Record<EnvironmentTheme, Skin> = {
  day: { shell: '#5B6B7F', shellDark: '#36414F', rim: '#93A6BC', glow: '#FF6B5B' },
  sunset: { shell: '#5A3348', shellDark: '#341B2A', rim: '#A05E72', glow: '#FFB03A' },
  night: { shell: '#2C3566', shellDark: '#161C3C', rim: '#6C7FD8', glow: '#22D3EE' },
  desert: { shell: '#6E5636', shellDark: '#443320', rim: '#A98B5C', glow: '#FF8A3C' },
  forest: { shell: '#33472F', shellDark: '#1C2A1A', rim: '#6E8F5C', glow: '#A3E635' },
};

/**
 * The ground threat: a sentry drone hovering at head height.
 *
 * Unlike the flyer, this one CAN be stomped — landing on it pops it for coins.
 * That is the reason it has a flat top and a soft underbelly: the silhouette
 * has to suggest "you could land on that".
 */
export class HoverEnemy {
  position: Vector2;
  velocity: Vector2;
  size: Vector2;

  private bobPhase: number;
  private bobOffset = 0;
  private spin = 0;
  private scanPhase: number;
  private theme: EnvironmentTheme;

  /** Set once the player stomps it, to play the pop before it is removed. */
  private popTimer = 0;
  private popped = false;

  constructor(x: number, y: number, theme: EnvironmentTheme = 'day') {
    this.position = new Vector2(x, y);
    this.velocity = new Vector2(-180, 0);
    this.size = new Vector2(34, 26);
    this.theme = theme;
    this.bobPhase = Math.random() * Math.PI * 2;
    this.scanPhase = Math.random() * Math.PI * 2;
  }

  update(dt: number, gameSpeed: number): void {
    if (this.popped) {
      this.popTimer += dt;
      // Knocked back and down as it dies.
      this.position.x -= 40 * dt;
      this.position.y += 260 * dt;
      return;
    }

    this.velocity.x = -180 * gameSpeed;
    this.position = this.position.add(this.velocity.multiply(dt));

    this.bobPhase += dt * 3.4;
    this.bobOffset = Math.sin(this.bobPhase) * 7;
    this.spin += dt * 9;
    this.scanPhase += dt * 2.2;
  }

  pop(): void {
    this.popped = true;
    this.popTimer = 0;
  }

  isPopped(): boolean {
    return this.popped;
  }

  /** True once the pop animation has played out. */
  isGone(): boolean {
    return this.popped && this.popTimer > 0.45;
  }

  render(ctx: CanvasRenderingContext2D): void {
    const skin = SKINS[this.theme];
    const renderY = this.position.y + this.bobOffset;
    const cx = this.position.x + this.size.x / 2;
    const cy = renderY + this.size.y / 2;

    ctx.save();
    ctx.translate(cx, cy);

    if (this.popped) {
      const t = this.popTimer / 0.45;
      ctx.globalAlpha = 1 - t;
      ctx.scale(1 + t * 0.6, Math.max(0.05, 1 - t));
      ctx.rotate(t * 3);
    }

    // Thruster glow under the hull — the hover read.
    const thrust = 0.6 + Math.sin(this.bobPhase * 2) * 0.25;
    const glow = ctx.createRadialGradient(0, 11, 0, 0, 11, 17 * thrust);
    glow.addColorStop(0, this.rgba(skin.glow, 0.55));
    glow.addColorStop(1, this.rgba(skin.glow, 0));
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 11, 17 * thrust, 0, Math.PI * 2);
    ctx.fill();

    // Hull: flat top, rounded belly.
    ctx.fillStyle = skin.shellDark;
    ctx.beginPath();
    ctx.ellipse(0, 3, 16, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = skin.shell;
    ctx.beginPath();
    ctx.moveTo(-16, 1);
    ctx.lineTo(-11, -8);
    ctx.lineTo(11, -8);
    ctx.lineTo(16, 1);
    ctx.closePath();
    ctx.fill();

    // The landable plate on top, lit so it invites the stomp.
    ctx.fillStyle = skin.rim;
    ctx.fillRect(-11, -10, 22, 3);

    // Rotor stubs either side.
    ctx.fillStyle = skin.shellDark;
    const rotor = Math.abs(Math.sin(this.spin)) * 6 + 4;
    ctx.fillRect(-19, -6, 5, 3);
    ctx.fillRect(14, -6, 5, 3);
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = skin.rim;
    ctx.fillRect(-19 - rotor, -5, rotor, 1.5);
    ctx.fillRect(19, -5, rotor, 1.5);
    ctx.globalAlpha = 1;

    // Scanner eye, sweeping.
    const sweep = Math.sin(this.scanPhase) * 5;
    ctx.fillStyle = '#0B1020';
    this.roundRect(ctx, -9, -5, 18, 8, 4);
    ctx.fillStyle = skin.glow;
    ctx.beginPath();
    ctx.arc(sweep, -1, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.45;
    ctx.beginPath();
    ctx.arc(sweep, -1, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.restore();
  }

  private rgba(hex: string, alpha: number): string {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
  }

  private roundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
  ): void {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.arcTo(x + w, y, x + w, y + radius, radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.arcTo(x + w, y + h, x + w - radius, y + h, radius);
    ctx.lineTo(x + radius, y + h);
    ctx.arcTo(x, y + h, x, y + h - radius, radius);
    ctx.lineTo(x, y + radius);
    ctx.arcTo(x, y, x + radius, y, radius);
    ctx.closePath();
    ctx.fill();
  }

  /** The top plate, used for stomp detection. */
  getTopY(): number {
    return this.position.y + this.bobOffset + 3;
  }

  getBounds(): Rectangle {
    return new Rectangle(
      this.position.x + 2,
      this.position.y + this.bobOffset + 3,
      this.size.x - 4,
      this.size.y - 6
    );
  }

  isOffScreen(): boolean {
    return this.position.x + this.size.x < -30 || this.isGone();
  }
}
