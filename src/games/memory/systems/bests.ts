// ===== src/games/memory/systems/bests.ts =====
//
// Personal bests per grid and mode. The key format predates the ladder
// (`memory_bests_<rows>x<cols>_<mode>`) and saved bests depend on it, so it
// is kept exactly. CLASSIC is judged by moves, TIMED by time.

import type { Mode } from './rules';

export interface Bests {
  leastMoves: number | null;
  bestTime: number | null;
}

const LAST_MODE_KEY = 'memory_last_mode';

export function bestKey(rows: number, cols: number, mode: Mode): string {
  return `memory_bests_${rows}x${cols}_${mode}`;
}

export function loadBests(rows: number, cols: number, mode: Mode): Bests {
  try {
    const raw = localStorage.getItem(bestKey(rows, cols, mode));
    if (!raw) return { leastMoves: null, bestTime: null };
    const parsed = JSON.parse(raw) as Partial<Bests>;
    return {
      leastMoves:
        typeof parsed.leastMoves === 'number' ? parsed.leastMoves : null,
      bestTime: typeof parsed.bestTime === 'number' ? parsed.bestTime : null,
    };
  } catch {
    return { leastMoves: null, bestTime: null };
  }
}

/**
 * Record a cleared table. Returns the new bests and whether the figure this
 * mode is judged by improved.
 */
export function saveBests(
  rows: number,
  cols: number,
  mode: Mode,
  moves: number,
  seconds: number
): { bests: Bests; improved: boolean } {
  const current = loadBests(rows, cols, mode);
  const time = Math.round(seconds * 10) / 10;
  const bests: Bests = {
    leastMoves:
      current.leastMoves === null ? moves : Math.min(current.leastMoves, moves),
    bestTime:
      current.bestTime === null ? time : Math.min(current.bestTime, time),
  };
  const improved =
    mode === 'classic'
      ? current.leastMoves === null || moves < current.leastMoves
      : current.bestTime === null || time < current.bestTime;
  try {
    localStorage.setItem(bestKey(rows, cols, mode), JSON.stringify(bests));
  } catch {
    // Private mode or full storage: the run still plays, it just forgets.
  }
  return { bests, improved };
}

export function loadLastMode(): Mode {
  try {
    return localStorage.getItem(LAST_MODE_KEY) === 'timed'
      ? 'timed'
      : 'classic';
  } catch {
    return 'classic';
  }
}

export function saveLastMode(mode: Mode): void {
  try {
    localStorage.setItem(LAST_MODE_KEY, mode);
  } catch {
    // Not worth failing a run over.
  }
}
