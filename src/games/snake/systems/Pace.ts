// ===== src/games/snake/systems/Pace.ts =====
//
// How fast the snake moves. The old rate grew by +0.05 per apple and
// +0.002 per step with no ceiling, so a long run eventually outran any
// human. Pace is now a short ladder of named tiers, each one a visible
// event (a banner, a board flash, a HUD pip), capped at MAX_STEP_RATE.
// Tiers are named after snakes, fastest last.

export interface PaceTier {
  name: string;
  /** Apples eaten to reach this tier. */
  food: number;
  /** Cells per second. */
  rate: number;
}

export const PACE_TIERS: readonly PaceTier[] = [
  { name: 'GARTER', food: 0, rate: 7 },
  { name: 'RACER', food: 5, rate: 8.5 },
  { name: 'WHIPSNAKE', food: 12, rate: 10 },
  { name: 'KRAIT', food: 20, rate: 11.5 },
  { name: 'MAMBA', food: 30, rate: 13 },
];

/** The hard ceiling on steps per second, whatever else is going on. */
export const MAX_STEP_RATE = 13;

/** SLOW multiplies the step rate by this. */
export const SLOW_FACTOR = 0.6;

export function paceTierFor(foodEaten: number): number {
  let tier = 0;
  for (let i = 0; i < PACE_TIERS.length; i++) {
    if (foodEaten >= PACE_TIERS[i].food) tier = i;
  }
  return tier;
}

export function stepRate(tier: number, slowed: boolean): number {
  const t = Math.max(0, Math.min(PACE_TIERS.length - 1, tier));
  const rate = PACE_TIERS[t].rate * (slowed ? SLOW_FACTOR : 1);
  return Math.min(MAX_STEP_RATE, rate);
}

/** 0..1 progress from this tier toward the next; 1 at the top tier. */
export function paceProgress(foodEaten: number): number {
  const tier = paceTierFor(foodEaten);
  if (tier >= PACE_TIERS.length - 1) return 1;
  const from = PACE_TIERS[tier].food;
  const to = PACE_TIERS[tier + 1].food;
  return (foodEaten - from) / (to - from);
}

/** Apples still to eat before the next tier, or null at the top. */
export function applesToNextPace(foodEaten: number): number | null {
  const tier = paceTierFor(foodEaten);
  if (tier >= PACE_TIERS.length - 1) return null;
  return PACE_TIERS[tier + 1].food - foodEaten;
}
