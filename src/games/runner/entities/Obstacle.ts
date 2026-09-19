// ===== src/games/runner/entities/Obstacle.ts =====
import { Vector2, Rectangle } from '@/games/shared/utils/Vector2';
import { EnvironmentTheme, ThemePalette, EnvironmentSystem } from '../systems/EnvironmentSystem';

export type ObstacleType = 'cactus' | 'high-barrier' | 'spike' | 'gap';

/**
 * Four hazards, one rule each:
 *
 *   cactus        a blocker at running height  -> jump it
 *   spike         a low bed of points          -> jump it
 *   high-barrier  hangs from above             -> slide under it
 *   gap           a hole in the floor          -> jump it
 *
 * Every theme re-skins those four, but never changes their silhouette: a
 * blocker is always a waist-high solid, a barrier always hangs with hazard
 * stripes. Learning the shape once has to be enough for all five stages.
 */
export class Obstacle {
  position: Vector2;
  size: Vector2;
  velocity: Vector2;
  type: ObstacleType;
  animationTime: number = 0;

  private theme: EnvironmentTheme;
  private variant: number;

  constructor(
    x: number,
    y: number,
    type: ObstacleType = 'cactus',
    theme: EnvironmentTheme = 'day',
    width?: number,
    height?: number
  ) {
    this.type = type;
    this.theme = theme;
    this.variant = Math.random();

    switch (type) {
      case 'high-barrier':
        this.size = new Vector2(width || 34, height || 64);
        break;
      case 'spike':
        this.size = new Vector2(width || 36, height || 24);
        break;
      case 'gap':
        this.size = new Vector2(width || 86, height || 12);
        break;
      case 'cactus':
      default:
        this.size = new Vector2(width || 26, height || 48);
        break;
    }

    this.position = new Vector2(x, y);
    this.velocity = new Vector2(-200, 0);
  }

  update(dt: number, gameSpeed: number): void {
    this.velocity.x = -200 * gameSpeed;
    this.position = this.position.add(this.velocity.multiply(dt));
    this.animationTime += dt;
  }

  render(ctx: CanvasRenderingContext2D): void {
    const p = EnvironmentSystem.paletteFor(this.theme);
    switch (this.type) {
      case 'cactus':
        this.renderBlocker(ctx, p);
        break;
      case 'high-barrier':
        this.renderBarrier(ctx, p);
        break;
      case 'spike':
        this.renderSpikes(ctx, p);
        break;
      case 'gap':
        this.renderGap(ctx, p);
        break;
    }
  }

  // ------------------------------------------------------------- blocker ---

  private renderBlocker(ctx: CanvasRenderingContext2D, p: ThemePalette): void {
    const { x, y } = this.position;
    const w = this.size.x;
    const h = this.size.y;

    this.groundShadow(ctx, x - 4, y + h, w + 8);

    switch (this.theme) {
      case 'desert': {
        // A real saguaro: barrel plus one arm, with ribs and spines.
        ctx.fillStyle = '#2E7D46';
        this.roundRect(ctx, x + 5, y, w - 10, h, 8);
        this.roundRect(ctx, x - 5, y + h * 0.36, 8, h * 0.4, 4);
        ctx.fillRect(x - 5, y + h * 0.62, 13, 8);
        ctx.fillStyle = '#46A05C';
        this.roundRect(ctx, x + 7, y + 3, 5, h - 8, 2.5);
        ctx.strokeStyle = '#1D5C31';
        ctx.lineWidth = 1;
        for (let i = 1; i < 3; i++) {
          ctx.beginPath();
          ctx.moveTo(x + 5 + ((w - 10) / 3) * i, y + 5);
          ctx.lineTo(x + 5 + ((w - 10) / 3) * i, y + h - 4);
          ctx.stroke();
        }
        // Spines, so it reads as "do not touch".
        ctx.strokeStyle = '#D9E8A0';
        for (let i = 0; i < 5; i++) {
          const sy = y + 6 + i * (h / 6);
          ctx.beginPath();
          ctx.moveTo(x + 4, sy);
          ctx.lineTo(x, sy - 2);
          ctx.moveTo(x + w - 4, sy + 3);
          ctx.lineTo(x + w, sy + 1);
          ctx.stroke();
        }
        break;
      }

      case 'night': {
        // Street bollard with a hazard band and a live warning light.
        ctx.fillStyle = '#2B3350';
        this.roundRect(ctx, x + 2, y + 6, w - 4, h - 6, 4);
        ctx.fillStyle = '#F5A524';
        ctx.fillRect(x + 2, y + h * 0.4, w - 4, 8);
        ctx.fillRect(x + 2, y + h * 0.66, w - 4, 8);
        const blink = Math.sin(this.animationTime * 7) > 0 ? 1 : 0.3;
        ctx.globalAlpha = blink;
        ctx.fillStyle = '#FF5A4A';
        ctx.beginPath();
        ctx.arc(x + w / 2, y + 5, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        break;
      }

      case 'forest': {
        // A mossy stump with a broken top.
        ctx.fillStyle = '#4A3520';
        this.roundRect(ctx, x + 1, y + 8, w - 2, h - 8, 3);
        ctx.fillStyle = '#5E4429';
        this.roundRect(ctx, x + 4, y + 10, 6, h - 14, 2);
        ctx.fillStyle = '#3F7A3A';
        ctx.beginPath();
        ctx.ellipse(x + w / 2, y + 9, w / 2 + 2, 7, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#58A24C';
        ctx.beginPath();
        ctx.ellipse(x + w / 2 - 3, y + 7, w / 3, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        // Jagged splinters on the break.
        ctx.fillStyle = '#7A5A35';
        for (let i = 0; i < 3; i++) {
          ctx.fillRect(x + 4 + i * 8, y + 2 + (i % 2) * 3, 3, 6);
        }
        break;
      }

      case 'sunset': {
        // A charred, still-glowing post.
        ctx.fillStyle = '#231018';
        this.roundRect(ctx, x + 2, y, w - 4, h, 3);
        ctx.fillStyle = '#3B1A22';
        this.roundRect(ctx, x + 4, y + 3, 5, h - 8, 2);
        ctx.fillStyle = '#FF7A3C';
        for (let i = 0; i < 4; i++) {
          const gy = y + 8 + i * (h / 5);
          const glow = 0.45 + Math.sin(this.animationTime * 4 + i) * 0.35;
          ctx.globalAlpha = glow;
          ctx.fillRect(x + 3 + (i % 2) * 10, gy, 6, 3);
        }
        ctx.globalAlpha = 1;
        break;
      }

      default: {
        // Day: a stacked crate barricade.
        ctx.fillStyle = '#8A5A32';
        this.roundRect(ctx, x, y, w, h, 3);
        ctx.fillStyle = '#A97142';
        this.roundRect(ctx, x + 2, y + 2, w - 4, h / 2 - 3, 2);
        this.roundRect(ctx, x + 2, y + h / 2 + 1, w - 4, h / 2 - 3, 2);
        ctx.strokeStyle = '#5E3B1E';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x + 2, y + 2);
        ctx.lineTo(x + w - 2, y + h / 2 - 2);
        ctx.moveTo(x + w - 2, y + 2);
        ctx.lineTo(x + 2, y + h / 2 - 2);
        ctx.stroke();
        break;
      }
    }

    void p;
  }

  // ------------------------------------------------------------- barrier ---

  private renderBarrier(ctx: CanvasRenderingContext2D, p: ThemePalette): void {
    const { x, y } = this.position;
    const w = this.size.x;
    const h = this.size.y;

    // It hangs: a rail above, a body below, nothing touching the floor. The
    // clear space beneath is the instruction.
    ctx.fillStyle = p.groundDeep;
    ctx.fillRect(x - 6, y - 10, w + 12, 8);

    const body = ctx.createLinearGradient(x, y, x, y + h);
    body.addColorStop(0, '#6D4AC4');
    body.addColorStop(1, '#3F248A');
    ctx.fillStyle = body;
    this.roundRect(ctx, x, y - 2, w, h, 3);

    // Hazard stripes, angled so they read as a barrier at a glance.
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y - 2, w, h);
    ctx.clip();
    ctx.fillStyle = '#FBD34D';
    for (let i = -h; i < w + h; i += 18) {
      ctx.beginPath();
      ctx.moveTo(x + i, y - 2);
      ctx.lineTo(x + i + 9, y - 2);
      ctx.lineTo(x + i + 9 - h, y + h);
      ctx.lineTo(x + i - h, y + h);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // A lit underside edge marking the line you have to get below.
    const pulse = 0.55 + Math.sin(this.animationTime * 5) * 0.35;
    ctx.globalAlpha = pulse;
    ctx.fillStyle = '#FF5A4A';
    ctx.fillRect(x - 2, y + h - 4, w + 4, 4);
    ctx.globalAlpha = 1;

    ctx.strokeStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y - 2, w, h);
  }

  // -------------------------------------------------------------- spikes ---

  private renderSpikes(ctx: CanvasRenderingContext2D, p: ThemePalette): void {
    const { x, y } = this.position;
    const w = this.size.x;
    const h = this.size.y;

    this.groundShadow(ctx, x - 2, y + h, w + 4);

    // A base plate, so the spikes do not float.
    ctx.fillStyle = p.groundDeep;
    ctx.fillRect(x - 2, y + h - 4, w + 4, 4);

    const spikeCount = Math.max(3, Math.floor(w / 11));
    const spikeW = w / spikeCount;
    const metal = this.theme === 'forest' ? '#C7D8C0' : '#D8DEE9';
    const metalDark = this.theme === 'forest' ? '#6D8069' : '#8C97A8';

    for (let i = 0; i < spikeCount; i++) {
      const sx = x + i * spikeW;
      // Alternating heights break up the flat comb look.
      const sh = h - 4 - (i % 2) * 5;

      ctx.fillStyle = metalDark;
      ctx.beginPath();
      ctx.moveTo(sx, y + h - 4);
      ctx.lineTo(sx + spikeW / 2, y + h - 4 - sh);
      ctx.lineTo(sx + spikeW, y + h - 4);
      ctx.closePath();
      ctx.fill();

      // Lit left face.
      ctx.fillStyle = metal;
      ctx.beginPath();
      ctx.moveTo(sx + spikeW * 0.18, y + h - 4);
      ctx.lineTo(sx + spikeW / 2, y + h - 4 - sh);
      ctx.lineTo(sx + spikeW * 0.5, y + h - 4);
      ctx.closePath();
      ctx.fill();
    }

    // A glint travelling along the row.
    const glint = (this.animationTime * 1.6) % 2;
    if (glint < 1) {
      ctx.globalAlpha = 0.8 * (1 - Math.abs(glint - 0.5) * 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(x + glint * w, y + 4, 2, 5);
      ctx.globalAlpha = 1;
    }
  }

  // ----------------------------------------------------------------- gap ---

  private renderGap(ctx: CanvasRenderingContext2D, p: ThemePalette): void {
    const { x, y } = this.position;
    const w = this.size.x;
    // `y` IS the ground line (see RunnerGame.spawnObstacle). Start the shaft
    // ABOVE it so the hole eats the lit crust the ground renderer paints from
    // groundY - 10; starting at the line left that crust intact across the
    // pit, which read as a plank laid over the hole.
    const top = y - 12;
    const depth = 104;

    const shaft = ctx.createLinearGradient(0, top, 0, top + depth);
    shaft.addColorStop(0, 'rgba(0, 0, 0, 0.92)');
    shaft.addColorStop(1, 'rgba(0, 0, 0, 1)');
    ctx.fillStyle = shaft;
    ctx.fillRect(x, top, w, depth);

    // Crumbling lips on both sides.
    ctx.fillStyle = p.groundDeep;
    ctx.beginPath();
    ctx.moveTo(x - 8, top);
    ctx.lineTo(x + 4, top);
    ctx.lineTo(x + 9, top + 9);
    ctx.lineTo(x - 8, top + 12);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + w + 8, top);
    ctx.lineTo(x + w - 4, top);
    ctx.lineTo(x + w - 9, top + 9);
    ctx.lineTo(x + w + 8, top + 12);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = p.groundTop;
    ctx.fillRect(x - 8, top - 3, 12, 3);
    ctx.fillRect(x + w - 4, top - 3, 12, 3);

    // Warning chevrons on the approach edge.
    const pulse = 0.5 + Math.sin(this.animationTime * 6) * 0.4;
    ctx.globalAlpha = pulse;
    ctx.fillStyle = '#FF7A3C';
    for (let i = 0; i < 3; i++) {
      const cx = x + 6 + i * 9;
      ctx.beginPath();
      ctx.moveTo(cx, top - 6);
      ctx.lineTo(cx + 6, top - 11);
      ctx.lineTo(cx + 6, top - 7);
      ctx.lineTo(cx, top - 2);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // -------------------------------------------------------------- shared ---

  private groundShadow(
    ctx: CanvasRenderingContext2D,
    x: number,
    baseY: number,
    w: number
  ): void {
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.ellipse(x + w / 2, baseY - 1, w / 2, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private roundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
  ): void {
    const radius = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
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

  getBounds(): Rectangle {
    // The pit has to bite a runner still on the floor and clear one who has
    // jumped, so its hazard band starts just ABOVE the ground line. Starting
    // it exactly at the ground line made pits harmless: Rectangle.intersects
    // is strict, and a grounded player's bottom edge sits exactly there.
    if (this.type === 'gap') {
      return new Rectangle(
        this.position.x + 8,
        this.position.y - 6,
        this.size.x - 16,
        46
      );
    }
    if (this.type === 'spike') {
      // Forgive the outer edges of the spike bed.
      return new Rectangle(
        this.position.x + 3,
        this.position.y + 4,
        this.size.x - 6,
        this.size.y - 4
      );
    }
    return new Rectangle(
      this.position.x + 2,
      this.position.y,
      this.size.x - 4,
      this.size.y
    );
  }

  isOffScreen(): boolean {
    return this.position.x + this.size.x < -20;
  }
}
