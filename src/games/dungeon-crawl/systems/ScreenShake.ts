// ===== src/games/dungeon-crawl/systems/ScreenShake.ts =====
// House-style trauma shake: add() stacks trauma, offset decays as trauma².
// Wave K — kick() adds a directional camera punch that decays fast and rides
// on top of the random jitter (melee follow-through, hurts, boss slams).

import { JUICE } from '../data/constants';

export class ScreenShake {
  private trauma = 0;
  private kickX = 0;
  private kickY = 0;

  add(amount: number): void {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  /** Wave K — a directional punch along (dirX, dirY), strength ~0..1. */
  kick(dirX: number, dirY: number, strength: number): void {
    const len = Math.hypot(dirX, dirY) || 1;
    this.kickX += (dirX / len) * strength * JUICE.KICK_MAGNITUDE;
    this.kickY += (dirY / len) * strength * JUICE.KICK_MAGNITUDE;
  }

  update(dt: number): void {
    this.trauma = Math.max(0, this.trauma - dt * 1.6);
    const damp = Math.max(0, 1 - JUICE.KICK_DECAY * dt);
    this.kickX *= damp;
    this.kickY *= damp;
  }

  getOffset(): { x: number; y: number } {
    const magnitude = this.trauma > 0 ? this.trauma * this.trauma * 12 : 0;
    return {
      x: this.kickX + (Math.random() * 2 - 1) * magnitude,
      y: this.kickY + (Math.random() * 2 - 1) * magnitude,
    };
  }

  reset(): void {
    this.trauma = 0;
    this.kickX = 0;
    this.kickY = 0;
  }
}
