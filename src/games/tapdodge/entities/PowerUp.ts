// ===== src/games/tapdodge/entities/PowerUp.ts =====
//
// Power-ups ride the road as ringed capsules: a ring in the power's own
// colour around a dark core holding its vector icon. They move with the
// road like everything else, so a capsule is always in a lane, never
// drifting between two.

import { icon, IconName } from '../systems/icons';
import type { Rect } from '../systems/layout';

export type PowerUpType = 'shield' | 'magnet' | 'slow' | 'ghost' | 'drone';

export interface PowerUpStyle {
  /** Seconds it lasts once collected. */
  duration: number;
  color: string;
  label: string;
  icon: IconName;
}

export const POWERUP_CONFIG: Record<PowerUpType, PowerUpStyle> = {
  // The shield soaks the next hit, or runs out after its duration.
  shield: { duration: 8, color: '#6fe8ff', label: 'SHIELD', icon: 'shield' },
  magnet: { duration: 6, color: '#a6f46a', label: 'MAGNET', icon: 'magnet' },
  slow: { duration: 4, color: '#c2a8ff', label: 'SLOW', icon: 'slow' },
  ghost: { duration: 3, color: '#eef3ff', label: 'GHOST', icon: 'ghost' },
  drone: { duration: 8, color: '#7aa2ff', label: 'DRONE', icon: 'drone' },
};

export const POWERUP_RADIUS = 17;

export class PowerUp {
  x: number;
  y: number;
  readonly type: PowerUpType;
  collected = false;
  private bob: number;

  constructor(x: number, y: number, type: PowerUpType, phase = 0) {
    this.x = x;
    this.y = y;
    this.type = type;
    this.bob = phase;
  }

  update(dy: number, dt: number): void {
    this.y += dy;
    this.bob += dt * 3;
  }

  hitbox(): Rect {
    const r = POWERUP_RADIUS;
    return { x: this.x - r, y: this.y - r, w: r * 2, h: r * 2 };
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (this.collected) return;
    const style = POWERUP_CONFIG[this.type];
    const r = POWERUP_RADIUS;
    const y = this.y + Math.sin(this.bob) * 1.5;
    ctx.save();
    ctx.fillStyle = 'rgba(6, 9, 18, 0.9)';
    ctx.beginPath();
    ctx.arc(this.x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = style.color;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    // A second, faint ring so the capsule reads at a glance.
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(this.x, y, r + 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    icon(ctx, style.icon, this.x, y, 16, style.color);
  }
}
