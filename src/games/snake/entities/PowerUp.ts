// ===== src/games/snake/entities/PowerUp.ts =====
//
// Five powers, each a drawn icon in its own coloured ring. Colours are
// Mosslight's own; none of them is amber (currency) or red (a problem).

import { withAlpha } from '@/games/shared/hud/canvasUi';
import { CELL, PAL } from '../constants';
import { drawPowerUpIcon } from './icons';

export type SnakePowerUpType = 'wrap' | 'slow' | 'double' | 'magnet' | 'ghost';

export interface PowerUpConfig {
  type: SnakePowerUpType;
  color: string;
  label: string;
  /** One line for the pod: what the power does. */
  hint: string;
  duration: number;
}

export const POWERUP_CONFIGS: Record<SnakePowerUpType, PowerUpConfig> = {
  wrap: {
    type: 'wrap',
    color: '#b48cff',
    label: 'WRAP',
    hint: 'walls open',
    duration: 8,
  },
  slow: {
    type: 'slow',
    color: '#8fd8ff',
    label: 'SLOW',
    hint: 'pace eased',
    duration: 6,
  },
  double: {
    type: 'double',
    color: '#f291d2',
    label: 'DOUBLE',
    hint: 'grow twice',
    duration: 7,
  },
  magnet: {
    type: 'magnet',
    color: '#7f9bff',
    label: 'MAGNET',
    hint: 'coins come',
    duration: 8,
  },
  ghost: {
    type: 'ghost',
    color: '#dfe8f2',
    label: 'GHOST',
    hint: 'pass yourself',
    duration: 5,
  },
};

export const POWERUP_TYPES: readonly SnakePowerUpType[] = [
  'wrap',
  'slow',
  'double',
  'magnet',
  'ghost',
];

export class PowerUp {
  /** Lifetime on the board; frozen while the run is frozen. */
  private age = 0;
  /** Animation clock; always runs, so a token never freezes mid-pop. */
  private anim = 0;
  private readonly phase: number;

  constructor(
    public x: number,
    public y: number,
    public readonly type: SnakePowerUpType,
    private readonly lifetime = 8,
    private readonly blinkTime = 1.2
  ) {
    this.phase = Math.random() * Math.PI * 2;
  }

  /** `ageing` is false while the run is frozen (hit, respawn, ready). */
  update(dt: number, ageing = true): void {
    if (ageing) this.age += dt;
    this.anim += dt;
  }

  isExpired(): boolean {
    return this.age >= this.lifetime;
  }

  getConfig(): PowerUpConfig {
    return POWERUP_CONFIGS[this.type];
  }

  render(
    ctx: CanvasRenderingContext2D,
    ox: number,
    oy: number,
    time: number
  ): void {
    if (this.isExpired()) return;
    const left = this.lifetime - this.age;
    if (left < this.blinkTime && Math.floor(time * 8) % 2 === 1) return;

    const cfg = POWERUP_CONFIGS[this.type];
    const pop = Math.min(1, this.anim / 0.3);
    const scale =
      pop < 1 ? 0.4 + 0.6 * pop + Math.sin(pop * Math.PI) * 0.25 : 1;
    const cx = ox + this.x * CELL + CELL / 2;
    const cy =
      oy + this.y * CELL + CELL / 2 + Math.sin(time * 3 + this.phase) * 1.2;
    const r = (CELL / 2 - 1.5) * scale;

    ctx.save();
    // Soft halo in the power's colour: a cheap radial fill, no shadowBlur.
    const halo = ctx.createRadialGradient(cx, cy, r * 0.6, cx, cy, r * 1.7);
    halo.addColorStop(0, withAlpha(cfg.color, 0.28));
    halo.addColorStop(1, withAlpha(cfg.color, 0));
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 1.7, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = PAL.frameDark;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = cfg.color;
    ctx.lineWidth = 2;
    ctx.stroke();

    // A slow orbiting tick on the ring so it reads as alive.
    const a = time * 2.2 + this.phase;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(cx, cy, r + 3, a, a + 0.9);
    ctx.stroke();

    drawPowerUpIcon(ctx, this.type, cx, cy, r * 0.8, cfg.color);
    ctx.restore();
  }
}
