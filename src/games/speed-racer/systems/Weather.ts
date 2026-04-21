// Lightweight atmospheric system. Currently drives snowfall for the frost
// pass section — particles drift down-screen with a small lateral sway and
// a soft white vignette eases over the edges for a cold-weather feel.
//
// Render is intentionally cheap: no per-frame allocations, fixed particle
// pool, no overdraw heavy enough to matter at 800×600.

import { CANVAS } from '../data/constants';

export type WeatherKind = 'none' | 'snow';

interface SnowFlake {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  swayT: number;
}

const SNOW_POOL = 80;

export class WeatherSystem {
  private kind: WeatherKind = 'none';
  private flakes: SnowFlake[] = [];

  reset(): void {
    this.kind = 'none';
    this.flakes.length = 0;
  }

  setWeather(kind: WeatherKind): void {
    if (this.kind === kind) return;
    this.kind = kind;
    this.flakes.length = 0;
    if (kind === 'snow') {
      for (let i = 0; i < SNOW_POOL; i++) {
        this.flakes.push(this.makeFlake(true));
      }
    }
  }

  private makeFlake(randomStartY: boolean): SnowFlake {
    return {
      x: Math.random() * CANVAS.WIDTH,
      y: randomStartY ? Math.random() * CANVAS.HEIGHT : -10,
      vx: -20 + Math.random() * 40,
      vy: 90 + Math.random() * 140,
      size: 1 + Math.random() * 2.2,
      swayT: Math.random() * Math.PI * 2,
    };
  }

  update(dt: number): void {
    if (this.kind !== 'snow') return;
    for (const f of this.flakes) {
      f.swayT += dt * 2;
      f.x += (f.vx + Math.sin(f.swayT) * 18) * dt;
      f.y += f.vy * dt;
      if (f.y > CANVAS.HEIGHT + 8 || f.x < -20 || f.x > CANVAS.WIDTH + 20) {
        const fresh = this.makeFlake(false);
        f.x = fresh.x;
        f.y = fresh.y;
        f.vx = fresh.vx;
        f.vy = fresh.vy;
        f.size = fresh.size;
      }
    }
  }

  getKind(): WeatherKind {
    return this.kind;
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (this.kind !== 'snow') return;
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    for (const f of this.flakes) {
      ctx.globalAlpha = 0.35 + 0.5 * Math.min(1, f.size / 2.5);
      ctx.fillRect(f.x, f.y, f.size, f.size);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // Drawn on top of everything (but under HUD) for a subtle visibility nerf.
  renderVignette(ctx: CanvasRenderingContext2D): void {
    if (this.kind !== 'snow') return;
    const w = CANVAS.WIDTH;
    const h = CANVAS.HEIGHT;
    const grad = ctx.createRadialGradient(w / 2, h / 2, h * 0.25, w / 2, h / 2, h * 0.75);
    grad.addColorStop(0, 'rgba(255,255,255,0)');
    grad.addColorStop(1, 'rgba(220,230,255,0.28)');
    ctx.save();
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }
}
