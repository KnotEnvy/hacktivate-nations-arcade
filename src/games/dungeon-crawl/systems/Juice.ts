// ===== src/games/dungeon-crawl/systems/Juice.ts =====
// Wave K — THE SPECTACLE's stateful kit: hit-stop (a capped freeze timer that
// zeroes the PLAYING sim's dt while the view keeps breathing), transient
// flash-lights (short-lived LightSources appended to the darkness gather), and
// the floor-entry curtain (a fade-off scrim; loadFloor stays synchronous).
// Ticks on REAL dt beside shake/particles/lighting so a freeze thaws in real
// time and never touches banner or overlay timers. Magnitudes live in JUICE.

import { JUICE } from '../data/constants';
import { LightSource } from './Lighting';

interface FlashLight {
  x: number;
  y: number;
  radius: number;
  life: number;
  maxLife: number;
}

export class Juice {
  private freeze = 0;
  private flashes: FlashLight[] = [];
  private curtain = 0;

  /** Request a sim freeze (stacking, capped — a crowd of kills can't stall the game). */
  hitStop(seconds: number): void {
    this.freeze = Math.min(JUICE.HITSTOP_MAX, this.freeze + seconds);
  }

  /** The playing sim's dt: zero while frozen. The freeze drains in update(). */
  simDt(dt: number): number {
    return this.freeze > 0 ? 0 : dt;
  }

  /** A short-lived light punched into the darkness (explosions, big spells). */
  flashLight(x: number, y: number, radius: number, life: number): void {
    this.flashes.push({ x, y, radius, life, maxLife: life });
  }

  /** Drop the floor-entry curtain (fades off over CURTAIN_TIME). */
  startCurtain(): void {
    this.curtain = JUICE.CURTAIN_TIME;
  }

  /** Curtain scrim alpha this frame (0 = gone). */
  curtainAlpha(): number {
    if (this.curtain <= 0) return 0;
    return Math.min(1, this.curtain / JUICE.CURTAIN_TIME);
  }

  /** Flash-lights still burning; radius eases out as the light dies. */
  lights(): LightSource[] {
    return this.flashes.map((f) => {
      const t = f.life / f.maxLife;
      return { x: f.x, y: f.y, radius: f.radius * (0.4 + 0.6 * t), flicker: 0.8 };
    });
  }

  /** Ticks on REAL dt at the top of onUpdate — freezes must thaw in real time. */
  update(dt: number): void {
    if (this.freeze > 0) this.freeze = Math.max(0, this.freeze - dt);
    if (this.curtain > 0) this.curtain = Math.max(0, this.curtain - dt);
    for (let i = this.flashes.length - 1; i >= 0; i--) {
      this.flashes[i].life -= dt;
      if (this.flashes[i].life <= 0) this.flashes.splice(i, 1);
    }
  }

  reset(): void {
    this.freeze = 0;
    this.flashes.length = 0;
    this.curtain = 0;
  }
}
