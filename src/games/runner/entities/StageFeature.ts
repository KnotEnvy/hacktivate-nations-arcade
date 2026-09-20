// ===== src/games/runner/entities/StageFeature.ts =====
import { Vector2, Rectangle } from '@/games/shared/utils/Vector2';
import { EnvironmentTheme } from '../systems/EnvironmentSystem';

/**
 * One signature interactable per stage.
 *
 * The five stages used to be art variations on a single loop: jump, slide,
 * collect. These give each of them something only it does, and each one leans
 * on a different verb the player already has:
 *
 *   geyser   (Ember Coast)  TIMING     — read the cycle, pass while it sleeps
 *   updraft  (Neon Skyline) ROUTING    — ride it to a high coin line
 *   gust     (Dune Sea)     STEERING   — hold ground against it with left/right
 *   bounce   (Deep Canopy)  CHAINING   — land on it for a launch you cannot jump
 *
 * Stage 1 deliberately has none. It is the stage that teaches the basics.
 */
export type StageFeatureKind = 'geyser' | 'updraft' | 'gust' | 'bounce';

export const FEATURE_FOR_THEME: Partial<Record<EnvironmentTheme, StageFeatureKind>> = {
  sunset: 'geyser',
  night: 'updraft',
  desert: 'gust',
  forest: 'bounce',
};

export class StageFeature {
  position: Vector2;
  size: Vector2;
  kind: StageFeatureKind;

  private time: number;
  private groundY: number;

  /** Geyser: seconds per full sleep/warn/erupt cycle. */
  private readonly cycle = 2.6;
  private readonly warnAt = 1.9;
  private readonly eruptAt = 2.2;

  /** Bounce: compression, set when the player lands on it. */
  private squash = 0;

  constructor(x: number, groundY: number, kind: StageFeatureKind) {
    this.kind = kind;
    this.groundY = groundY;
    // Desynchronise so a run of geysers does not fire as one wall.
    this.time = Math.random() * this.cycle;

    switch (kind) {
      case 'geyser':
        this.size = new Vector2(38, 150);
        this.position = new Vector2(x, groundY - 150);
        break;
      case 'updraft':
        this.size = new Vector2(64, 210);
        this.position = new Vector2(x, groundY - 210);
        break;
      case 'gust':
        // Wide and low: it has to cover the whole jump arc (a full-hold jump
        // tops out ~183px up) without becoming a tower standing in the sky.
        this.size = new Vector2(214, 196);
        this.position = new Vector2(x, groundY - 196);
        break;
      case 'bounce':
      default:
        // Big enough to read as a launcher at a glance, and to be a landing
        // target the player can aim at rather than stumble onto.
        this.size = new Vector2(60, 34);
        this.position = new Vector2(x, groundY - 34);
        break;
    }
  }

  update(dt: number, gameSpeed: number): void {
    // Gusts drift slower than the world: they are weather, not scenery, and a
    // gust that scrolled at full speed would be past before it mattered.
    const speed = this.kind === 'gust' ? 150 * gameSpeed : 200 * gameSpeed;
    this.position.x -= speed * dt;
    this.time += dt;
    if (this.squash > 0) this.squash = Math.max(0, this.squash - dt * 4);
  }

  // ------------------------------------------------------------- geyser ---

  /** Where in its cycle a geyser is right now. */
  geyserPhase(): 'sleep' | 'warn' | 'erupt' {
    const t = this.time % this.cycle;
    if (t >= this.eruptAt) return 'erupt';
    if (t >= this.warnAt) return 'warn';
    return 'sleep';
  }

  /** Only an erupting geyser hurts. Everything else here is harmless. */
  isDangerous(): boolean {
    return this.kind === 'geyser' && this.geyserPhase() === 'erupt';
  }

  // ------------------------------------------------------------- bounce ---

  /** Called when the player lands on a pad, for the squash animation. */
  compress(): void {
    this.squash = 1;
  }

  /** The top plate of a bounce pad, for landing detection. */
  getTopY(): number {
    return this.position.y + this.squash * 10;
  }

  // ------------------------------------------------------------- bounds ---

  getBounds(): Rectangle {
    switch (this.kind) {
      case 'geyser':
        // Only the erupting column is a box worth testing; the vent itself is
        // flush with the floor and never catches anyone.
        return new Rectangle(
          this.position.x + 7,
          this.position.y,
          this.size.x - 14,
          this.size.y
        );
      case 'bounce':
        return new Rectangle(
          this.position.x + 4,
          this.position.y + this.squash * 10,
          this.size.x - 8,
          this.size.y - this.squash * 10
        );
      default:
        return new Rectangle(
          this.position.x,
          this.position.y,
          this.size.x,
          this.size.y
        );
    }
  }

  isOffScreen(): boolean {
    return this.position.x + this.size.x < -40;
  }

  // ------------------------------------------------------------- render ---

  render(ctx: CanvasRenderingContext2D): void {
    switch (this.kind) {
      case 'geyser':
        this.renderGeyser(ctx);
        break;
      case 'updraft':
        this.renderUpdraft(ctx);
        break;
      case 'gust':
        this.renderGust(ctx);
        break;
      case 'bounce':
        this.renderBounce(ctx);
        break;
    }
  }

  private renderGeyser(ctx: CanvasRenderingContext2D): void {
    const cx = this.position.x + this.size.x / 2;
    const base = this.groundY;
    const phase = this.geyserPhase();
    const t = this.time % this.cycle;

    // The vent: always visible, so the hazard is never a surprise.
    ctx.save();
    ctx.fillStyle = '#2A1218';
    ctx.beginPath();
    ctx.ellipse(cx, base - 2, this.size.x / 2, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#4A1F1C';
    ctx.beginPath();
    ctx.ellipse(cx, base - 4, this.size.x / 2 - 5, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    if (phase === 'sleep') {
      // Embers licking the rim: alive, but safe to cross.
      const glow = 0.3 + Math.sin(this.time * 4) * 0.15;
      ctx.globalAlpha = glow;
      ctx.fillStyle = '#FF7A3C';
      ctx.beginPath();
      ctx.ellipse(cx, base - 5, this.size.x / 2 - 8, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }

    if (phase === 'warn') {
      // The tell. A bright, fast flicker and a rising spark column, for the
      // three tenths of a second before it fires.
      const urgency = (t - this.warnAt) / (this.eruptAt - this.warnAt);
      ctx.globalAlpha = 0.5 + Math.abs(Math.sin(this.time * 28)) * 0.5;
      ctx.fillStyle = '#FFD37A';
      ctx.beginPath();
      ctx.ellipse(cx, base - 5, this.size.x / 2 - 4, 6, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = 0.8;
      for (let i = 0; i < 6; i++) {
        const sy = base - 8 - ((this.time * 220 + i * 26) % 70);
        ctx.fillStyle = i % 2 ? '#FFD37A' : '#FF8A3C';
        ctx.fillRect(cx - 8 + i * 3, sy, 2, 6);
      }

      // A chevron warning above the vent, sized by how close it is.
      ctx.globalAlpha = urgency;
      ctx.fillStyle = '#FF5A4A';
      ctx.beginPath();
      ctx.moveTo(cx, base - 84);
      ctx.lineTo(cx + 9, base - 70);
      ctx.lineTo(cx - 9, base - 70);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      return;
    }

    // Erupting: a tapering column of fire with a hot core.
    const life = (t - this.eruptAt) / (this.cycle - this.eruptAt);
    const height = this.size.y * Math.sin(Math.min(1, life * 1.6) * Math.PI * 0.85);

    const flame = ctx.createLinearGradient(0, base, 0, base - height);
    flame.addColorStop(0, 'rgba(255, 244, 200, 0.95)');
    flame.addColorStop(0.35, 'rgba(255, 150, 60, 0.9)');
    flame.addColorStop(1, 'rgba(220, 40, 30, 0)');
    ctx.fillStyle = flame;
    ctx.beginPath();
    ctx.moveTo(cx - this.size.x / 2, base);
    // A wobbling edge, so the column looks like fire and not a bar.
    for (let y = 0; y <= height; y += 10) {
      const taper = 1 - (y / height) * 0.62;
      const wob = Math.sin(this.time * 18 + y * 0.09) * 4;
      ctx.lineTo(cx - (this.size.x / 2) * taper + wob, base - y);
    }
    for (let y = height; y >= 0; y -= 10) {
      const taper = 1 - (y / height) * 0.62;
      const wob = Math.sin(this.time * 18 + y * 0.09 + 2) * 4;
      ctx.lineTo(cx + (this.size.x / 2) * taper + wob, base - y);
    }
    ctx.closePath();
    ctx.fill();

    // White-hot throat.
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = '#FFF7DC';
    ctx.fillRect(cx - 4, base - height * 0.55, 8, height * 0.55);
    ctx.restore();
  }

  private renderUpdraft(ctx: CanvasRenderingContext2D): void {
    const cx = this.position.x + this.size.x / 2;
    const base = this.groundY;

    ctx.save();

    // The grate it rises from.
    ctx.fillStyle = '#1B2444';
    ctx.fillRect(this.position.x, base - 8, this.size.x, 8);
    ctx.fillStyle = '#3E5AA8';
    for (let i = 0; i < 5; i++) {
      ctx.fillRect(this.position.x + 5 + i * 12, base - 7, 6, 2);
    }

    // The column: rising bands of steam, brightest at the bottom.
    const column = ctx.createLinearGradient(0, base, 0, base - this.size.y);
    column.addColorStop(0, 'rgba(125, 211, 252, 0.36)');
    column.addColorStop(0.6, 'rgba(125, 211, 252, 0.14)');
    column.addColorStop(1, 'rgba(125, 211, 252, 0)');
    ctx.fillStyle = column;
    ctx.fillRect(this.position.x, base - this.size.y, this.size.x, this.size.y);

    // Chevrons travelling up it — the read for "this pushes you that way".
    ctx.strokeStyle = 'rgba(190, 240, 255, 0.75)';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    for (let i = 0; i < 5; i++) {
      const y = base - ((this.time * 150 + i * 48) % this.size.y);
      const fade = 1 - (base - y) / this.size.y;
      ctx.globalAlpha = fade * 0.9;
      ctx.beginPath();
      ctx.moveTo(cx - 14, y + 9);
      ctx.lineTo(cx, y);
      ctx.lineTo(cx + 14, y + 9);
      ctx.stroke();
    }
    ctx.restore();
  }

  private renderGust(ctx: CanvasRenderingContext2D): void {
    const base = this.groundY;
    const x = this.position.x;
    const h = this.size.y;

    ctx.save();

    // A wall of driven sand. Soft on both edges so it reads as weather
    // arriving rather than as a rectangle sliding past.
    // Warm brown rather than pale sand: against a bright desert the first
    // pass read as a faint haze instead of as weather worth reacting to.
    const wall = ctx.createLinearGradient(x, 0, x + this.size.x, 0);
    wall.addColorStop(0, 'rgba(150, 104, 52, 0)');
    wall.addColorStop(0.35, 'rgba(158, 112, 58, 0.42)');
    wall.addColorStop(0.72, 'rgba(178, 132, 72, 0.52)');
    wall.addColorStop(1, 'rgba(150, 104, 52, 0)');
    ctx.fillStyle = wall;
    ctx.fillRect(x, base - h, this.size.x, h);

    // Streaks, all blowing the same way, faster near the ground.
    ctx.strokeStyle = 'rgba(255, 248, 228, 0.9)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 22; i++) {
      const sy = base - 8 - ((i * 47) % (h - 20));
      const drift = (this.time * (260 + (i % 4) * 80) + i * 37) % (this.size.x + 90);
      const sx = x + this.size.x - drift;
      const len = 22 + (i % 3) * 14;
      ctx.globalAlpha = 0.4 + ((i % 5) / 5) * 0.5;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + len, sy - 2);
      ctx.stroke();
    }

    // Arrow markers down the leading edge, so the direction and the extent
    // are both unmistakable.
    ctx.fillStyle = '#FFF3D2';
    for (let row = 0; row < 5; row++) {
      for (let i = 0; i < 3; i++) {
        // Stagger alternate rows, or the arrows read as a printed grid
        // rather than as something blowing past.
        const ax = x + 22 + i * 62 + (row % 2) * 30;
        const ay = base - h + 26 + row * (h / 5.6) + Math.sin(this.time * 3 + i + row) * 5;
        ctx.globalAlpha = 0.35 + (i / 3) * 0.45;
        ctx.beginPath();
        ctx.moveTo(ax + 15, ay);
        ctx.lineTo(ax - 5, ay - 9);
        ctx.lineTo(ax - 5, ay + 9);
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.restore();
  }

  private renderBounce(ctx: CanvasRenderingContext2D): void {
    const x = this.position.x;
    const w = this.size.x;
    const base = this.groundY;
    const squash = this.squash;
    const capH = 28 - squash * 12;
    const capY = base - capH - 6;

    ctx.save();

    // Stalk.
    ctx.fillStyle = '#C8B08A';
    ctx.fillRect(x + w / 2 - 7, base - 16, 14, 16);
    ctx.fillStyle = '#A8906A';
    ctx.fillRect(x + w / 2 + 2, base - 16, 5, 16);

    // Cap: a wide dome that flattens as it fires.
    const cap = ctx.createLinearGradient(0, capY, 0, capY + capH);
    cap.addColorStop(0, '#6EE7B7');
    cap.addColorStop(1, '#0F9D6B');
    ctx.fillStyle = cap;
    ctx.beginPath();
    ctx.ellipse(x + w / 2, capY + capH, w / 2, capH, 0, Math.PI, Math.PI * 2);
    ctx.fill();

    // Spots, squashed with the cap.
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    const spots: [number, number, number][] = [
      [-0.26, 0.42, 4.5],
      [0.06, 0.24, 6],
      [0.3, 0.46, 4],
    ];
    for (const [sx, sy, r] of spots) {
      ctx.beginPath();
      ctx.ellipse(
        x + w / 2 + sx * w,
        capY + capH - sy * capH,
        r,
        r * (1 - squash * 0.4),
        0,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }

    // A lit rim on the landing surface, so it invites the landing.
    ctx.strokeStyle = 'rgba(214, 255, 232, 0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(x + w / 2, capY + capH, w / 2 - 1, capH, 0, Math.PI, Math.PI * 2);
    ctx.stroke();

    // Release puff, on the frames right after a launch.
    if (squash > 0.25) {
      ctx.globalAlpha = squash - 0.25;
      ctx.fillStyle = '#D9FFE9';
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI - Math.PI;
        ctx.beginPath();
        ctx.arc(
          x + w / 2 + Math.cos(a) * w * 0.55,
          capY + capH + Math.sin(a) * 10,
          5 * squash,
          0,
          Math.PI * 2
        );
        ctx.fill();
      }
    }
    ctx.restore();
  }
}
