// ===== src/games/minesweeper/systems/SoundBoard.ts =====
//
// Fieldmark's sound vocabulary is small and mechanical: a key `click` when a
// tile opens, a heavier `switch_click` when a flag is seated or the mode
// switch is thrown, a `whoosh` under big cascades, `explosion` for mines and
// `win` for a clear. A cascade can open a hundred tiles in half a second,
// so every sound here can be rate-limited (a minimum gap in seconds) and
// budgeted (a hard count per run). Time comes from the game's dt, never a
// wall clock.

import type { SoundName } from '@/services/AudioManager';

export interface PlayOptions {
  /** Minimum seconds since this sound last played. */
  gap?: number;
  volume?: number;
  /** Shared budget name, with `budget` the most it may ever play. */
  budgetKey?: string;
  budget?: number;
}

export class SoundBoard {
  private now = 0;
  private last = new Map<SoundName, number>();
  private spent = new Map<string, number>();

  constructor(
    private readonly sink: (name: SoundName, volume?: number) => void
  ) {}

  tick(dt: number): void {
    this.now += dt;
  }

  /** Returns whether the sound actually played. */
  play(name: SoundName, opts: PlayOptions = {}): boolean {
    const last = this.last.get(name);
    if (opts.gap && last !== undefined && this.now - last < opts.gap) {
      return false;
    }
    if (opts.budgetKey && opts.budget !== undefined) {
      const used = this.spent.get(opts.budgetKey) ?? 0;
      if (used >= opts.budget) return false;
      this.spent.set(opts.budgetKey, used + 1);
    }
    this.last.set(name, this.now);
    this.sink(name, opts.volume);
    return true;
  }

  reset(): void {
    this.last.clear();
    this.spent.clear();
  }
}
