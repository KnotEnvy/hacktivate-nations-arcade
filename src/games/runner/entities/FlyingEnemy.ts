// ===== src/games/runner/entities/FlyingEnemy.ts =====
import { Vector2, Rectangle } from '@/games/shared/utils/Vector2';
import { EnvironmentTheme } from '../systems/EnvironmentSystem';

interface Skin {
  body: string;
  bodyDark: string;
  wing: string;
  wingEdge: string;
  eye: string;
}

/** One creature per stage, all reading as "airborne, cannot be stomped". */
const SKINS: Record<EnvironmentTheme, Skin> = {
  day: { body: '#7A4B2A', bodyDark: '#573320', wing: '#C98B4B', wingEdge: '#E7BE86', eye: '#FFE066' },
  sunset: { body: '#6B1F33', bodyDark: '#440F20', wing: '#C4453C', wingEdge: '#FF8A5B', eye: '#FFD166' },
  night: { body: '#2B1B4A', bodyDark: '#170D2C', wing: '#5B3D9E', wingEdge: '#A78BFA', eye: '#F87171' },
  desert: { body: '#7A5A2E', bodyDark: '#543C1C', wing: '#C9A15A', wingEdge: '#EBD08C', eye: '#FF7A45' },
  forest: { body: '#2E4A24', bodyDark: '#1A2C14', wing: '#4C7A32', wingEdge: '#8FBF5C', eye: '#FFD166' },
};

/**
 * The air threat. It flies a sine path through the jump arc and is NOT
 * stompable — the only answer is to not be there. Its silhouette is all
 * wings, so it never gets confused with the hover drone below it.
 */
export class FlyingEnemy {
  position: Vector2;
  velocity: Vector2;
  size: Vector2;

  private bobPhase: number;
  private bobOffset = 0;
  private wingFlap = 0;
  private theme: EnvironmentTheme;
  private trail: { x: number; y: number; life: number }[] = [];
  private trailTimer = 0;

  constructor(x: number, y: number, theme: EnvironmentTheme = 'day') {
    this.position = new Vector2(x, y);
    this.velocity = new Vector2(-150, 0);
    this.size = new Vector2(34, 24);
    this.theme = theme;
    this.bobPhase = Math.random() * Math.PI * 2;
  }

  update(dt: number, gameSpeed: number): void {
    this.velocity.x = -150 * gameSpeed;
    this.position = this.position.add(this.velocity.multiply(dt));

    this.bobPhase += dt * 3;
    this.bobOffset = Math.sin(this.bobPhase) * 22;

    // Wings beat faster on the upstroke of the flight path.
    this.wingFlap += dt * (13 + Math.cos(this.bobPhase) * 6);

    this.trailTimer += dt;
    if (this.trailTimer > 0.05) {
      this.trailTimer = 0;
      this.trail.unshift({
        x: this.position.x + this.size.x / 2,
        y: this.position.y + this.bobOffset + this.size.y / 2,
        life: 1,
      });
      if (this.trail.length > 6) this.trail.pop();
    }
    this.trail.forEach(t => {
      t.life -= dt * 3;
    });
    this.trail = this.trail.filter(t => t.life > 0);
  }

  render(ctx: CanvasRenderingContext2D): void {
    const skin = SKINS[this.theme];
    const renderY = this.position.y + this.bobOffset;
    const cx = this.position.x + this.size.x / 2;
    const cy = renderY + this.size.y / 2;

    // Motion trail, so a fast diagonal pass still reads.
    ctx.save();
    for (const t of this.trail) {
      ctx.globalAlpha = t.life * 0.18;
      ctx.fillStyle = skin.wingEdge;
      ctx.beginPath();
      ctx.arc(t.x, t.y, 5 * t.life, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    ctx.save();
    ctx.translate(cx, cy);

    const flap = Math.sin(this.wingFlap);

    // Far wing behind the body.
    this.drawWing(ctx, skin, -flap, 0.82);

    // Body: a tapered dart pointing the way it travels.
    ctx.fillStyle = skin.body;
    ctx.beginPath();
    ctx.moveTo(-15, 0);
    ctx.quadraticCurveTo(-4, -8, 11, -4);
    ctx.quadraticCurveTo(16, 0, 11, 5);
    ctx.quadraticCurveTo(-4, 8, -15, 0);
    ctx.closePath();
    ctx.fill();

    // Underside shading.
    ctx.fillStyle = skin.bodyDark;
    ctx.beginPath();
    ctx.moveTo(-13, 2);
    ctx.quadraticCurveTo(-2, 7, 11, 4);
    ctx.quadraticCurveTo(-2, 9, -13, 3);
    ctx.closePath();
    ctx.fill();

    // Tail fork.
    ctx.fillStyle = skin.wing;
    ctx.beginPath();
    ctx.moveTo(-13, 0);
    ctx.lineTo(-22, -6);
    ctx.lineTo(-16, 0);
    ctx.lineTo(-22, 6);
    ctx.closePath();
    ctx.fill();

    // Near wing in front.
    this.drawWing(ctx, skin, flap, 1);

    // Eye: one hot dot, the read for "this one hurts".
    ctx.fillStyle = skin.eye;
    ctx.beginPath();
    ctx.arc(8, -1, 2.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1A0A0A';
    ctx.beginPath();
    ctx.arc(8.6, -1, 1.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  private drawWing(
    ctx: CanvasRenderingContext2D,
    skin: Skin,
    flap: number,
    scale: number
  ): void {
    ctx.save();
    ctx.scale(scale, scale);
    ctx.translate(-2, 0);
    ctx.rotate(flap * 0.55);

    ctx.fillStyle = scale < 1 ? skin.bodyDark : skin.wing;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(-6, -16, -20, -20);
    ctx.quadraticCurveTo(-12, -10, -14, -2);
    ctx.quadraticCurveTo(-7, -4, 0, 0);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = skin.wingEdge;
    ctx.beginPath();
    ctx.moveTo(-6, -13);
    ctx.quadraticCurveTo(-13, -17, -19, -19);
    ctx.quadraticCurveTo(-12, -12, -7, -9);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  getBounds(): Rectangle {
    // Tighter than the drawn wingspan: the wings should not kill you.
    return new Rectangle(
      this.position.x + 5,
      this.position.y + this.bobOffset + 5,
      this.size.x - 10,
      this.size.y - 8
    );
  }

  isOffScreen(): boolean {
    return this.position.x + this.size.x < -30;
  }
}
