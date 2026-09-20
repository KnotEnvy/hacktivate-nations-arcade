// ===== src/games/runner/systems/WorldRenderer.ts =====
//
// The floor, the ground dressing, and the two full-frame effects that sit
// over the world. Split out of RunnerGame so the game class stays about
// running the game rather than about painting it.
//
// Two coordinate spaces meet here, and mixing them up is the easy mistake:
//
//   WORLD   the floor and its dressing, drawn inside the camera transform and
//           therefore drawn OVERSCANNED — the camera pulls back as the run
//           speeds up, so anything that fills the frame has to reach past it.
//   SCREEN  the speed lines and the vignettes, drawn after the camera is
//           released. They must not zoom, and they cover the canvas exactly.

import { ThemePalette } from './EnvironmentSystem';

/** Deterministic noise for the ground texture. */
const pseudoNoise = (x: number, y: number): number =>
  Math.abs(Math.sin(x * 12.9898 + y * 78.233)) % 1;

export interface VignetteState {
  /** 0-1, how fresh the last hit is. */
  hurt: number;
  /** True while the player is on their last life. */
  lastLife: boolean;
  /** Free-running clock, for the idle pulse. */
  time: number;
}

export class WorldRenderer {
  private width: number;
  private height: number;
  private groundY: number;
  private overscan: number;

  constructor(width: number, height: number, groundY: number, overscan: number) {
    this.width = width;
    this.height = height;
    this.groundY = groundY;
    this.overscan = overscan;
  }

  // -------------------------------------------------------------- world ---

  /** The playfield floor: a lit crust over a body that falls into shadow. */
  renderGround(
    ctx: CanvasRenderingContext2D,
    p: ThemePalette,
    groundScroll: number
  ): void {
    const over = this.overscan;
    const left = -over;
    const wide = this.width + over * 2;
    const depth = this.height - this.groundY + over;

    const body = ctx.createLinearGradient(0, this.groundY, 0, this.height);
    body.addColorStop(0, p.groundBody);
    body.addColorStop(1, p.groundDeep);
    ctx.fillStyle = body;
    ctx.fillRect(left, this.groundY, wide, depth);

    const crust = ctx.createLinearGradient(
      0,
      this.groundY - 10,
      0,
      this.groundY + 14
    );
    crust.addColorStop(0, p.groundTop);
    crust.addColorStop(1, p.groundBody);
    ctx.fillStyle = crust;
    ctx.fillRect(left, this.groundY - 10, wide, 24);

    ctx.fillStyle = p.groundLine;
    ctx.fillRect(left, this.groundY - 11, wide, 2);

    this.renderGroundDetail(ctx, p, groundScroll);

    // Depth shade along the very bottom, so the floor never fights the runner.
    const floorShade = ctx.createLinearGradient(
      0,
      this.height - 26,
      0,
      this.height
    );
    floorShade.addColorStop(0, 'rgba(0, 0, 0, 0)');
    floorShade.addColorStop(1, 'rgba(0, 0, 0, 0.32)');
    ctx.fillStyle = floorShade;
    ctx.fillRect(left, this.height - 26, wide, 26 + over);
  }

  /**
   * Ground dressing at full scroll speed. Positions come from the world
   * odometer rather than from screen space, so a tuft keeps its shape as it
   * passes instead of reshuffling every frame.
   */
  private renderGroundDetail(
    ctx: CanvasRenderingContext2D,
    p: ThemePalette,
    groundScroll: number
  ): void {
    const scroll = groundScroll + this.overscan;
    const slot = 26;
    const first = Math.floor(scroll / slot);
    const count = Math.ceil((this.width + this.overscan * 2) / slot) + 2;

    for (let i = 0; i < count; i++) {
      const index = first + i;
      const x = index * slot - scroll;
      const r = pseudoNoise(index * 3.1, 7.7);
      const r2 = pseudoNoise(index * 1.7, 13.3);

      if (p.ambient === 'sand') {
        // Wind ripples running across the dune surface.
        ctx.strokeStyle = this.withAlpha(p.grassDry, 0.45);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, this.groundY + 8 + r * 20);
        ctx.quadraticCurveTo(
          x + slot * 0.5,
          this.groundY + 5 + r * 20,
          x + slot,
          this.groundY + 8 + r * 20
        );
        ctx.stroke();
        continue;
      }

      if (r > 0.34) {
        // Grass tuft, hanging off the lip of the crust.
        ctx.strokeStyle = r2 > 0.6 ? p.grassDry : p.grass;
        ctx.lineWidth = 1.5;
        const blades = 2 + Math.floor(r2 * 3);
        for (let b = 0; b < blades; b++) {
          const bx = x + b * 4;
          const bh = 5 + pseudoNoise(index + b, 2.2) * 8;
          ctx.beginPath();
          ctx.moveTo(bx, this.groundY - 8);
          ctx.quadraticCurveTo(
            bx + 2,
            this.groundY - 8 - bh * 0.6,
            bx + (b - 1) * 2,
            this.groundY - 8 - bh
          );
          ctx.stroke();
        }
      } else if (r > 0.16) {
        // Pebble, sitting in the crust.
        ctx.fillStyle = this.withAlpha(p.groundDeep, 0.55);
        const size = 2 + r2 * 3;
        ctx.beginPath();
        ctx.ellipse(
          x,
          this.groundY + 6 + r2 * 16,
          size,
          size * 0.6,
          0,
          0,
          Math.PI * 2
        );
        ctx.fill();
      } else if (p.ambient === 'leaves' && r > 0.06) {
        // Leaf litter on the forest floor.
        ctx.fillStyle = this.withAlpha('#8A5A2B', 0.5);
        ctx.fillRect(x, this.groundY + 10 + r2 * 18, 4, 2);
      }
    }
  }

  // ------------------------------------------------------------- screen ---

  /**
   * Streaks tearing past at speed.
   *
   * Lanes are deterministic and animated by the odometer: picking them at
   * random every frame produces a flicker rather than a streak.
   *
   * @param heat 0 = still, 1 = as fast as the game gets
   */
  renderSpeedLines(
    ctx: CanvasRenderingContext2D,
    heat: number,
    distance: number
  ): void {
    if (heat <= 0.02) return;

    const count = Math.round(heat * 16);
    ctx.save();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineCap = 'round';

    for (let i = 0; i < count; i++) {
      const lane = (i * 97) % 100;
      const top = lane < 50;
      // Kept to the upper sky and the strip just above the floor, so they
      // never sit on the hazard the player is reading.
      const y = top
        ? 18 + (lane / 50) * (this.groundY * 0.3)
        : this.groundY - 26 - ((lane - 50) / 50) * (this.groundY * 0.16);
      const x =
        this.width - ((distance * 2.4 + i * 211) % (this.width + 420));
      const len = 40 + (i % 4) * 46;

      ctx.globalAlpha = heat * (0.14 + ((i % 5) / 5) * 0.18);
      ctx.lineWidth = 1 + (i % 3) * 0.8;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + len, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  /**
   * Red pulled in from the edges — never over the middle of the playfield,
   * which is where the player is looking.
   */
  renderVignettes(ctx: CanvasRenderingContext2D, s: VignetteState): void {
    if (s.hurt > 0) {
      this.vignette(ctx, 0.28, 0.78, `rgba(180, 20, 20, ${0.62 * s.hurt})`);
    }

    if (s.lastLife) {
      const pulse = 0.14 + Math.abs(Math.sin(s.time * 3)) * 0.1;
      this.vignette(ctx, 0.36, 0.8, `rgba(160, 24, 24, ${pulse})`);
    }
  }

  private vignette(
    ctx: CanvasRenderingContext2D,
    innerScale: number,
    outerScale: number,
    edgeColor: string
  ): void {
    const cx = this.width / 2;
    const cy = this.height / 2;
    const gradient = ctx.createRadialGradient(
      cx,
      cy,
      this.height * innerScale,
      cx,
      cy,
      this.height * outerScale
    );
    gradient.addColorStop(0, edgeColor.replace(/[\d.]+\)$/, '0)'));
    gradient.addColorStop(1, edgeColor);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.width, this.height);
  }

  /** One light wash so entities drawn in their own palettes share the stage's light. */
  renderAmbientLight(ctx: CanvasRenderingContext2D, p: ThemePalette): void {
    if (p.ambientLightAlpha <= 0) return;
    ctx.save();
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = p.ambientLightAlpha;
    ctx.fillStyle = p.ambientLight;
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.restore();
  }

  private withAlpha(hex: string, alpha: number): string {
    if (!hex.startsWith('#')) return hex;
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
  }
}
