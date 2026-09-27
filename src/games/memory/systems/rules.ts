// ===== src/games/memory/systems/rules.ts =====
//
// The ladder and the scoring, as plain data and pure functions so the tests
// can pin them without driving a board.

export type Mode = 'classic' | 'timed';

export interface TableDef {
  /** 1-based table number shown to the player. */
  number: number;
  name: string;
  rows: number;
  cols: number;
  pairs: number;
  /** Moves at or under this pay the par bonus and count as a perfect table. */
  par: number;
  /** Seconds. The countdown in TIMED; the par time for the bonus in both. */
  clock: number;
}

function table(
  number: number,
  name: string,
  rows: number,
  cols: number,
  clock: number
): TableDef {
  const pairs = (rows * cols) / 2;
  // The first two tables are a warm-up and get a tighter par.
  const par = pairs + (number <= 2 ? 3 : 5);
  return { number, name, rows, cols, pairs, par, clock };
}

/** Five tables, smallest to largest. Clearing the last one ends the run. */
export const TABLES: readonly TableDef[] = [
  table(1, 'The Parlour', 3, 4, 45),
  table(2, 'The Salon', 4, 4, 60),
  table(3, 'The Library', 4, 5, 80),
  table(4, 'The Conservatory', 5, 6, 110),
  table(5, 'The Grand Room', 6, 6, 140),
];

/** Points for a match. `streakBefore` is the run of matches before this one. */
export function matchPoints(streakBefore: number): number {
  return 100 + Math.max(0, streakBefore) * 20;
}

/** Paid on a table clear when moves are at or under par. */
export function parBonus(
  tableNumber: number,
  moves: number,
  par: number
): number {
  return moves <= par ? 150 * tableNumber : 0;
}

/** Paid on a table clear in both modes: two points per second under the clock. */
export function timeBonus(clock: number, seconds: number): number {
  return Math.max(0, Math.floor((clock - seconds) * 2));
}

export const PEEK_COST = 30;
export const HINT_COST = 15;
export const HINT_COOLDOWN = 8;
/** Seconds the faces stay fully visible during a peek / a hint. */
export const PEEK_HOLD = 1.0;
export const HINT_HOLD = 0.6;

/** One half-turn of a card, back to face. */
export const FLIP_TIME = 0.2;
/** How long a mismatched pair stays up after it is judged. */
export const MISMATCH_HOLD = 0.7;
export const SHAKE_TIME = 0.25;
/** Match pop, emerald pulse, and the recall ghost on a card seen before. */
export const POP_TIME = 0.3;
export const PULSE_TIME = 0.6;
export const GHOST_TIME = 0.15;

/** Beats. */
export const READY_TIME = 1.0;
export const CLEAR_TIME = 1.6;
export const FINALE_TIME = 1.6;
export const DEAL_FLIGHT = 0.3;

/** Seconds between cards leaving the stack; bigger tables deal faster. */
export function dealStagger(cards: number): number {
  return Math.min(0.06, 1.1 / Math.max(1, cards));
}

/** Result of one cleared table, kept for the stats and the banners. */
export interface TableResult {
  table: number;
  moves: number;
  par: number;
  seconds: number;
  atPar: boolean;
  parBonus: number;
  timeBonus: number;
  newBest: boolean;
}

/** Levels at par, for `perfect_levels`. */
export function perfectCount(results: readonly TableResult[]): number {
  return results.filter(r => r.atPar).length;
}

/** Fastest cleared table under 30s, or 0 when none was, for `fast_completion`. */
export function fastestUnder30(results: readonly TableResult[]): number {
  let best = 0;
  for (const r of results) {
    if (r.seconds < 30 && (best === 0 || r.seconds < best)) best = r.seconds;
  }
  return Math.round(best * 100) / 100;
}

/**
 * Cleared tables under 30s, for `fast_tables`. The Speed Demon achievement
 * compares with >= against 30, which `fast_completion` (a time UNDER 30) can
 * never satisfy; a count gives it something it can (see RECAP.md).
 */
export function tablesUnder30(results: readonly TableResult[]): number {
  return results.filter(r => r.seconds < 30).length;
}

/** m:ss for the HUD and the banners. */
export function clockText(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds - 1e-6));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
