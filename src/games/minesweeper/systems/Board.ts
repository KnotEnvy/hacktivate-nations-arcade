// ===== src/games/minesweeper/systems/Board.ts =====
//
// The rules of the field and nothing else: where the mines are, what a
// reveal opens, when a chord fires, when the field is clear. No timing, no
// drawing, no input. The game drives it and the renderer reads it, so every
// rule here can be pinned by a test without a canvas.
//
// Reveals are LOGICAL and immediate. The staggered cascade the player sees
// is animation laid over a field that has already opened, which is what
// lets the win be detected on the move that earns it (the old build queued
// reveals and checked for the win before any of them had happened).

export type Difficulty = 'easy' | 'medium' | 'hard';

export interface DifficultySpec {
  cols: number;
  rows: number;
  mines: number;
  /** Seconds under which a win earns a pace bonus. */
  par: number;
  /** Flat score for clearing the field. */
  clearBonus: number;
}

export const DIFFICULTIES: Record<Difficulty, DifficultySpec> = {
  easy: { cols: 9, rows: 9, mines: 10, par: 60, clearBonus: 300 },
  medium: { cols: 16, rows: 16, mines: 40, par: 200, clearBonus: 1000 },
  hard: { cols: 20, rows: 14, mines: 60, par: 300, clearBonus: 2000 },
};

export const DIFFICULTY_ORDER: readonly Difficulty[] = [
  'easy',
  'medium',
  'hard',
];

export function isDifficulty(value: unknown): value is Difficulty {
  return value === 'easy' || value === 'medium' || value === 'hard';
}

export interface Cell {
  mine: boolean;
  revealed: boolean;
  flagged: boolean;
  neighbors: number;
}

export interface CellRef {
  row: number;
  col: number;
}

export interface Opened extends CellRef {
  /** Flood ring the tile opened in (0 = the tile that was pressed). */
  depth: number;
}

export interface RevealResult {
  opened: Opened[];
  /** The mine this move opened, if it opened one. */
  mine: CellRef | null;
}

export type ChordState =
  /** Not a chordable number, or nothing left around it to open. */
  | { kind: 'none' }
  /** The flag count does not match the number: show, do not open. */
  | { kind: 'peek'; cells: CellRef[] }
  /** Flags match: these hidden neighbours will open. */
  | { kind: 'ready'; cells: CellRef[] };

/** Smallest first opening the placer tries to guarantee. */
export const MIN_FIRST_OPENING = 9;

export class Board {
  readonly cols: number;
  readonly rows: number;
  readonly mines: number;
  readonly cells: Cell[][];
  private placed = false;
  private safeOpenedCount = 0;
  private flagCount = 0;

  constructor(cols: number, rows: number, mines: number) {
    this.cols = cols;
    this.rows = rows;
    this.mines = Math.min(mines, cols * rows - 1);
    this.cells = [];
    for (let r = 0; r < rows; r++) {
      const row: Cell[] = [];
      for (let c = 0; c < cols; c++) {
        row.push({
          mine: false,
          revealed: false,
          flagged: false,
          neighbors: 0,
        });
      }
      this.cells.push(row);
    }
  }

  static for(difficulty: Difficulty): Board {
    const spec = DIFFICULTIES[difficulty];
    return new Board(spec.cols, spec.rows, spec.mines);
  }

  // ------------------------------------------------------------ reads ----

  get minesPlaced(): boolean {
    return this.placed;
  }

  get flags(): number {
    return this.flagCount;
  }

  /** Mines minus flags. Negative when the player has over-flagged. */
  get minesLeft(): number {
    return this.mines - this.flagCount;
  }

  get safeTotal(): number {
    return this.cols * this.rows - this.mines;
  }

  get safeOpened(): number {
    return this.safeOpenedCount;
  }

  isCleared(): boolean {
    return this.placed && this.safeOpenedCount >= this.safeTotal;
  }

  inBounds(row: number, col: number): boolean {
    return row >= 0 && row < this.rows && col >= 0 && col < this.cols;
  }

  at(row: number, col: number): Cell | null {
    return this.inBounds(row, col) ? this.cells[row][col] : null;
  }

  neighbours(row: number, col: number): CellRef[] {
    const out: CellRef[] = [];
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const r = row + dr;
        const c = col + dc;
        if (this.inBounds(r, c)) out.push({ row: r, col: c });
      }
    }
    return out;
  }

  /** What a chord on this tile would do, without doing it. */
  chordState(row: number, col: number): ChordState {
    const cell = this.at(row, col);
    if (!cell || !cell.revealed || cell.mine || cell.neighbors === 0) {
      return { kind: 'none' };
    }
    let flagged = 0;
    const hidden: CellRef[] = [];
    for (const n of this.neighbours(row, col)) {
      const nc = this.cells[n.row][n.col];
      if (nc.flagged) flagged++;
      else if (!nc.revealed) hidden.push(n);
    }
    if (hidden.length === 0) return { kind: 'none' };
    if (flagged !== cell.neighbors) return { kind: 'peek', cells: hidden };
    return { kind: 'ready', cells: hidden };
  }

  // ---------------------------------------------------------- placement ----

  /**
   * Lay the mines after the first press. The pressed tile and its eight
   * neighbours are always clear, so the first press always opens a zero.
   * On top of that the placer re-rolls (up to `attempts` times, keeping the
   * best) until the first opening is at least `minOpening` tiles, so a
   * corner press does not open a lonely 2x2.
   */
  placeMines(
    safeRow: number,
    safeCol: number,
    rand: () => number = Math.random,
    minOpening = MIN_FIRST_OPENING,
    attempts = 60
  ): void {
    if (this.placed) return;
    const total = this.cols * this.rows;
    const safe = new Set<number>();
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const r = safeRow + dr;
        const c = safeCol + dc;
        if (this.inBounds(r, c)) safe.add(r * this.cols + c);
      }
    }
    // A field too dense for a 3x3 clearing still keeps the pressed tile.
    if (total - safe.size < this.mines) {
      safe.clear();
      safe.add(safeRow * this.cols + safeCol);
    }
    const candidates: number[] = [];
    for (let i = 0; i < total; i++) if (!safe.has(i)) candidates.push(i);

    let best: number[] = [];
    let bestOpening = -1;
    for (let attempt = 0; attempt < attempts; attempt++) {
      const pool = candidates.slice();
      for (let i = 0; i < this.mines; i++) {
        const j = i + Math.floor(rand() * (pool.length - i));
        const tmp = pool[i];
        pool[i] = pool[j];
        pool[j] = tmp;
      }
      const picks = pool.slice(0, this.mines);
      const opening = this.openingSize(picks, safeRow, safeCol);
      if (opening > bestOpening) {
        best = picks;
        bestOpening = opening;
      }
      if (opening >= minOpening) break;
    }

    for (const index of best) {
      this.cells[Math.floor(index / this.cols)][index % this.cols].mine = true;
    }
    this.countNeighbours();
    this.placed = true;
  }

  /**
   * Lay mines at exact tiles instead of rolling them (tests, and any
   * future daily-puzzle mode). The first reveal then uses this layout.
   */
  layMines(mines: CellRef[]): void {
    if (this.placed) return;
    for (const m of mines) {
      if (this.inBounds(m.row, m.col)) this.cells[m.row][m.col].mine = true;
    }
    this.countNeighbours();
    this.placed = true;
  }

  private countNeighbours(): void {
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        let count = 0;
        for (const n of this.neighbours(r, c)) {
          if (this.cells[n.row][n.col].mine) count++;
        }
        this.cells[r][c].neighbors = count;
      }
    }
  }

  /** Tiles a first press at (row, col) would open with this layout. */
  private openingSize(mines: number[], row: number, col: number): number {
    const { cols, rows } = this;
    const mine = new Uint8Array(cols * rows);
    for (const m of mines) mine[m] = 1;
    const count = (i: number): number => {
      const r = Math.floor(i / cols);
      const c = i % cols;
      let n = 0;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const rr = r + dr;
          const cc = c + dc;
          if (rr >= 0 && rr < rows && cc >= 0 && cc < cols) {
            n += mine[rr * cols + cc];
          }
        }
      }
      return n;
    };
    const start = row * cols + col;
    if (mine[start]) return 0;
    const seen = new Uint8Array(cols * rows);
    const queue = [start];
    seen[start] = 1;
    let opened = 0;
    for (let head = 0; head < queue.length; head++) {
      const i = queue[head];
      opened++;
      if (count(i) !== 0) continue;
      const r = Math.floor(i / cols);
      const c = i % cols;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const rr = r + dr;
          const cc = c + dc;
          if (rr < 0 || rr >= rows || cc < 0 || cc >= cols) continue;
          const j = rr * cols + cc;
          if (seen[j] || mine[j]) continue;
          seen[j] = 1;
          queue.push(j);
        }
      }
    }
    return opened;
  }

  // -------------------------------------------------------------- moves ----

  /**
   * Open one tile. A zero floods outward through every connected zero and
   * its numbered rim. Flagged and already-open tiles are left alone.
   */
  reveal(row: number, col: number): RevealResult {
    const cell = this.at(row, col);
    if (!cell || cell.revealed || cell.flagged) {
      return { opened: [], mine: null };
    }
    if (cell.mine) {
      cell.revealed = true;
      return { opened: [], mine: { row, col } };
    }
    return { opened: this.flood([{ row, col }]), mine: null };
  }

  /**
   * The standard chord: on a revealed number whose flagged neighbours equal
   * its value, open every other hidden neighbour. A wrong flag means one of
   * those neighbours is a mine, and the chord opens it. That is the rule.
   */
  chord(row: number, col: number): RevealResult {
    const state = this.chordState(row, col);
    if (state.kind !== 'ready') return { opened: [], mine: null };
    let mine: CellRef | null = null;
    const safe: CellRef[] = [];
    for (const n of state.cells) {
      const cell = this.cells[n.row][n.col];
      if (cell.mine) {
        if (!mine) {
          cell.revealed = true;
          mine = n;
        }
      } else {
        safe.push(n);
      }
    }
    return { opened: this.flood(safe), mine };
  }

  /** Flip a flag. Returns the new state, or null when the tile is open. */
  toggleFlag(row: number, col: number): boolean | null {
    const cell = this.at(row, col);
    if (!cell || cell.revealed) return null;
    this.setFlag(row, col, !cell.flagged);
    return cell.flagged;
  }

  setFlag(row: number, col: number, on: boolean): void {
    const cell = this.at(row, col);
    if (!cell || cell.revealed || cell.flagged === on) return;
    cell.flagged = on;
    this.flagCount += on ? 1 : -1;
  }

  private flood(seeds: CellRef[]): Opened[] {
    const opened: Opened[] = [];
    const queue: Opened[] = [];
    const open = (row: number, col: number, depth: number): void => {
      const cell = this.cells[row][col];
      cell.revealed = true;
      this.safeOpenedCount++;
      const entry = { row, col, depth };
      opened.push(entry);
      queue.push(entry);
    };
    for (const s of seeds) {
      const cell = this.cells[s.row][s.col];
      if (!cell.revealed && !cell.flagged && !cell.mine) open(s.row, s.col, 0);
    }
    for (let head = 0; head < queue.length; head++) {
      const cur = queue[head];
      if (this.cells[cur.row][cur.col].neighbors !== 0) continue;
      for (const n of this.neighbours(cur.row, cur.col)) {
        const cell = this.cells[n.row][n.col];
        if (cell.revealed || cell.flagged || cell.mine) continue;
        open(n.row, n.col, cur.depth + 1);
      }
    }
    return opened;
  }
}

/** Distance between two tile centres, in tiles. */
export function tileDistance(a: CellRef, b: CellRef): number {
  return Math.hypot(a.row - b.row, a.col - b.col);
}
