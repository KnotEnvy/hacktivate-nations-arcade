// ===== src/games/runner/systems/GrazeSystem.ts =====
//
// Near misses.
//
// Before this, the optimal play was to jump as early as possible: there was no
// upside to cutting it fine, so the safest run was also the best one. A graze
// pays out for passing INSIDE a band around a hazard without touching it,
// which turns "how late dare I leave it" into the skill the game is actually
// about.
//
// Each hazard can only be grazed once. Ownership is tracked in a WeakSet of
// the hazard objects themselves rather than a flag on every entity class, so
// none of them need to know this system exists.

import { Rectangle } from '@/games/shared/utils/Vector2';

export interface GrazeResult {
  /** Hazards newly grazed this frame, with the point to pop text at. */
  hits: { x: number; y: number }[];
  /** The graze chain after this frame. */
  streak: number;
}

/** Anything that can be grazed only has to be able to describe its box. */
export interface Grazeable {
  getBounds(): Rectangle;
}

export class GrazeSystem {
  /** How far outside the player's hitbox still counts as "that was close". */
  private readonly band = 16;
  private readonly streakWindow = 2.2;

  private claimed = new WeakSet<object>();
  private streak = 0;
  private streakTimer = 0;
  private total = 0;
  private best = 0;

  update(dt: number): void {
    if (this.streakTimer > 0) {
      this.streakTimer -= dt;
      if (this.streakTimer <= 0) this.streak = 0;
    }
  }

  /**
   * @param playerBounds the player's real hitbox
   * @param hazards      everything currently dangerous
   */
  check(playerBounds: Rectangle, hazards: Grazeable[]): GrazeResult {
    const near = new Rectangle(
      playerBounds.x - this.band,
      playerBounds.y - this.band,
      playerBounds.width + this.band * 2,
      playerBounds.height + this.band * 2
    );

    const hits: { x: number; y: number }[] = [];

    for (const hazard of hazards) {
      if (this.claimed.has(hazard)) continue;

      const box = hazard.getBounds();
      // Close, but NOT touching. A hit is not a graze.
      if (!near.intersects(box)) continue;
      if (playerBounds.intersects(box)) {
        // Touching it burns the chance: you do not get paid for clipping it.
        this.claimed.add(hazard);
        continue;
      }

      this.claimed.add(hazard);
      this.streak++;
      this.streakTimer = this.streakWindow;
      this.total++;
      if (this.streak > this.best) this.best = this.streak;

      const center = box.center;
      hits.push({ x: center.x, y: Math.min(center.y, playerBounds.y) });
    }

    return { hits, streak: this.streak };
  }

  /**
   * Score for one graze. It climbs with the chain so a run of tight passes is
   * worth far more than the same number spread out, then caps so it cannot
   * run away.
   */
  valueFor(streak: number): number {
    return Math.min(40, 8 + (streak - 1) * 4);
  }

  getStreak(): number {
    return this.streak;
  }

  getStreakTimeLeft(): number {
    return Math.max(0, this.streakTimer);
  }

  getStreakWindow(): number {
    return this.streakWindow;
  }

  getTotal(): number {
    return this.total;
  }

  getBest(): number {
    return this.best;
  }

  reset(): void {
    this.claimed = new WeakSet<object>();
    this.streak = 0;
    this.streakTimer = 0;
    this.total = 0;
    this.best = 0;
  }
}
