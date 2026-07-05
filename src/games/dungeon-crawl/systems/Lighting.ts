// ===== src/games/dungeon-crawl/systems/Lighting.ts =====
// Torchlight atmosphere: a darkness layer composited over the world with
// radial holes punched out for the player's torch, wall torches, and the
// stairs glow. Uses an offscreen canvas + destination-out; degrades to a
// no-op when the 2D context is a test stub without gradient support.

import { LIGHTING, TILE } from '../data/constants';

export interface LightSource {
  x: number; // world px
  y: number;
  radius: number;
  flicker: number; // 0..1 how much the radius wobbles
}

export class Lighting {
  private buffer: HTMLCanvasElement | null = null;
  private bctx: CanvasRenderingContext2D | null = null;
  private supported = true;
  private time = 0;

  private ensureBuffer(width: number, height: number): boolean {
    if (!this.supported) return false;
    if (!this.buffer) {
      this.buffer = document.createElement('canvas');
      const ctx = this.buffer.getContext('2d');
      if (!ctx || typeof ctx.createRadialGradient !== 'function') {
        this.supported = false;
        return false;
      }
      this.bctx = ctx;
    }
    if (this.buffer.width !== width || this.buffer.height !== height) {
      this.buffer.width = width;
      this.buffer.height = height;
    }
    return this.bctx !== null;
  }

  update(dt: number): void {
    this.time += dt;
  }

  /**
   * Composite the darkness layer onto the main context (screen space).
   * `camX/camY` convert world-space lights into screen space.
   */
  render(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    camX: number,
    camY: number,
    floor: number,
    lights: LightSource[],
  ): void {
    if (!this.ensureBuffer(width, height) || !this.bctx || !this.buffer) return;
    const bctx = this.bctx;

    const darkness = Math.min(
      LIGHTING.DARKNESS_MAX,
      LIGHTING.DARKNESS_BASE + LIGHTING.DARKNESS_PER_FLOOR * (floor - 1),
    );

    bctx.globalCompositeOperation = 'source-over';
    bctx.clearRect(0, 0, width, height);
    bctx.fillStyle = `rgba(4, 2, 8, ${darkness})`;
    bctx.fillRect(0, 0, width, height);

    bctx.globalCompositeOperation = 'destination-out';
    for (const light of lights) {
      const sx = light.x - camX;
      const sy = light.y - camY;
      // Two-band flicker: slow breathing + fast crackle.
      const wobble =
        1 +
        light.flicker *
          (0.05 * Math.sin(this.time * 9 + light.x * 0.13) +
            0.03 * Math.sin(this.time * 23 + light.y * 0.31));
      const r = light.radius * wobble;
      if (sx < -r || sy < -r || sx > width + r || sy > height + r) continue;
      const gradient = bctx.createRadialGradient(sx, sy, 0, sx, sy, r);
      gradient.addColorStop(0, 'rgba(0,0,0,1)');
      gradient.addColorStop(0.55, 'rgba(0,0,0,0.85)');
      gradient.addColorStop(1, 'rgba(0,0,0,0)');
      bctx.fillStyle = gradient;
      bctx.fillRect(sx - r, sy - r, r * 2, r * 2);
    }
    bctx.globalCompositeOperation = 'source-over';

    ctx.drawImage(this.buffer, 0, 0);
  }

  /** Player torch radius including Keen Eye stacks. */
  static playerTorchRadius(keenEyeStacks: number): number {
    return LIGHTING.BASE_TORCH_RADIUS + keenEyeStacks * LIGHTING.RADIUS_PER_KEEN_EYE;
  }

  static wallTorchLight(tx: number, ty: number): LightSource {
    return {
      x: tx * TILE + TILE / 2,
      y: ty * TILE + TILE / 2,
      radius: LIGHTING.WALL_TORCH_RADIUS,
      flicker: 1,
    };
  }
}
