// ===== src/games/minesweeper/systems/KeyCursor.ts =====
//
// The keyboard's cell cursor. Arrows (or WASD) step it one tile per press
// and auto-repeat when held, after a short delay, like a text caret. It is
// hidden until the keyboard is used and hides again when the mouse moves.

import type { PressTracker } from '@/games/shared/input/PressTracker';

const DIRS: ReadonlyArray<{
  codes: readonly string[];
  dr: number;
  dc: number;
}> = [
  { codes: ['ArrowUp', 'KeyW'], dr: -1, dc: 0 },
  { codes: ['ArrowDown', 'KeyS'], dr: 1, dc: 0 },
  { codes: ['ArrowLeft', 'KeyA'], dr: 0, dc: -1 },
  { codes: ['ArrowRight', 'KeyD'], dr: 0, dc: 1 },
];

export const CURSOR_CODES: readonly string[] = DIRS.flatMap(d => d.codes);

const REPEAT_DELAY = 0.3;
const REPEAT_EVERY = 0.065;

export class KeyCursor {
  row = 0;
  col = 0;
  visible = false;
  private held: { dr: number; dc: number } | null = null;
  private repeatIn = 0;

  reset(rows: number, cols: number): void {
    this.row = Math.floor(rows / 2);
    this.col = Math.floor(cols / 2);
    this.visible = false;
    this.held = null;
    this.repeatIn = 0;
  }

  hide(): void {
    this.visible = false;
    this.held = null;
  }

  show(): void {
    this.visible = true;
  }

  /** Returns true when the keyboard touched the cursor this frame. */
  update(keys: PressTracker, rows: number, cols: number, dt: number): boolean {
    let used = false;
    for (const d of DIRS) {
      if (keys.anyJustPressed(d.codes)) {
        used = true;
        // The first press only wakes a hidden cursor where it was.
        if (this.visible) this.step(d.dr, d.dc, rows, cols);
        this.visible = true;
        this.held = { dr: d.dr, dc: d.dc };
        this.repeatIn = REPEAT_DELAY;
      }
    }
    if (this.held) {
      const still = DIRS.find(
        d =>
          d.dr === this.held!.dr &&
          d.dc === this.held!.dc &&
          d.codes.some(c => keys.isDown(c))
      );
      if (!still) {
        this.held = null;
      } else {
        this.repeatIn -= dt;
        while (this.repeatIn <= 0) {
          this.step(this.held.dr, this.held.dc, rows, cols);
          this.repeatIn += REPEAT_EVERY;
        }
      }
    }
    return used;
  }

  private step(dr: number, dc: number, rows: number, cols: number): void {
    this.row = Math.max(0, Math.min(rows - 1, this.row + dr));
    this.col = Math.max(0, Math.min(cols - 1, this.col + dc));
  }
}

/** "E7": column letter, row number, as printed on a survey grid. */
export function gridRef(row: number, col: number): string {
  return `${String.fromCharCode(65 + col)}${row + 1}`;
}
