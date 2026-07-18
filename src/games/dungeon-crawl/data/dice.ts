// ===== src/games/dungeon-crawl/data/dice.ts =====
// Wave L — the dice behind THE TRUE MEASURE. Pure data + pure rolls: damage
// and healing amounts are expressed as classic dice ({ n, d, plus }) and
// rolled INTERNALLY on whichever Rng the caller owns (the live run rng at
// game/Combat level — never inside dungeon/). Results reach the screen as
// plain numbers only; the dice themselves never do (charter rule).

import { Rng } from '../dungeon/rng';

export interface Dice {
  /** How many dice. */
  n: number;
  /** Sides per die (d1 = a fixed point). */
  d: number;
  /** Flat bonus added after the roll. */
  plus?: number;
}

/** Roll n×d(+plus) on the caller's rng. d1 dice cost no entropy. */
export function rollDice(rng: Rng, dice: Dice): number {
  let total = dice.plus ?? 0;
  for (let i = 0; i < dice.n; i++) {
    total += dice.d <= 1 ? 1 : rng.int(1, dice.d);
  }
  return total;
}

/** Statistical average — balance tables and tests read this, never the screen. */
export function diceAvg(dice: Dice): number {
  return dice.n * ((dice.d + 1) / 2) + (dice.plus ?? 0);
}

/** Smallest possible roll. */
export function diceMin(dice: Dice): number {
  return dice.n + (dice.plus ?? 0);
}

/** Largest possible roll. */
export function diceMax(dice: Dice): number {
  return dice.n * dice.d + (dice.plus ?? 0);
}
