// Rules for Minesweeper.
//
// These pin what a player relies on, not the tuning numbers. The blocks
// marked (bug) failed on the build before the polish pass:
//
//   * the game could not be won: reveals were queued, the win was checked
//     before any of them happened, and the queue revealed with the check off
//   * a win ended the run on the same frame, before anything was shown
//   * mines were revealed on setTimeout, in index order, through pause
//   * touch could not flag; there was no chording
//   * medium and hard boards ran into the difficulty buttons and footer
//   * hover lived in per-cell flags, and the face read its own centre

import {
  DEATH_BEAT,
  EXPLOSION_BUDGET,
  HITSTOP,
  LONG_PRESS,
  MinesweeperGame,
  READY_CARD_TIME,
  VICTORY_BEAT,
} from '../MinesweeperGame';
import { Harness, initGame, step } from '@/games/shared/gameTestHarness';
import {
  Board,
  CellRef,
  DIFFICULTIES,
  DIFFICULTY_ORDER,
  Difficulty,
  MIN_FIRST_OPENING,
  tileDistance,
} from '../systems/Board';
import {
  BOARD_MARGIN,
  CANVAS_H,
  CANVAS_W,
  FieldLayout,
  HOUSING_GAP,
  MAX_CELL,
  MIN_CELL,
  Rect,
  cellCentre,
  computeLayout,
  intersects,
} from '../systems/Layout';
import type {
  BoardRenderer,
  BoardView,
  CellFx,
} from '../systems/BoardRenderer';
import type { HudView } from '../systems/HudRenderer';
import type { KeyCursor } from '../systems/KeyCursor';
import type { ParticleSystem } from '../systems/ParticleSystem';

/** The private surface these tests reach through. */
interface Internals {
  gameState: string;
  board: Board;
  layout: FieldLayout;
  fx: CellFx[][];
  elapsedSec: number;
  difficulty: Difficulty;
  flagMode: boolean;
  cursor: KeyCursor;
  hover: CellRef | null;
  hit: CellRef | null;
  score: number;
  pickups: number;
  bestTimeSec: number | null;
  readyCardT: number;
  clock: number;
  pops: unknown[];
  wave: unknown[];
  particles: ParticleSystem;
  boardRenderer: BoardRenderer;
  extendedGameData: Record<string, unknown> | null;
  hudView(): HudView;
  boardView(): BoardView;
}

interface FakeInput {
  keys: Set<string>;
  mouse: { x: number; y: number };
  buttons: Set<number>;
  touches: Array<{ id: number; x: number; y: number }>;
}

interface Rig {
  h: Harness;
  /** The concrete game, whose lifecycle methods are not optional. */
  game: MinesweeperGame;
  g: Internals;
  input: FakeInput;
  sounds: jest.Mock;
}

const DT = 1 / 60;

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function rig(opts: { seed?: number; difficulty?: Difficulty } = {}): Rig {
  if (opts.difficulty) {
    localStorage.setItem('minesweeper_difficulty', opts.difficulty);
  }
  jest.spyOn(Math, 'random').mockImplementation(mulberry32(opts.seed ?? 7));
  const game = new MinesweeperGame();
  const h = initGame(game);
  const input: FakeInput = {
    keys: new Set(),
    mouse: { x: 2, y: 2 },
    buttons: new Set(),
    touches: [],
  };
  const im = h.services.input as unknown as Record<string, jest.Mock>;
  im.isKeyPressed.mockImplementation((c: string) => input.keys.has(c));
  im.isMousePressed.mockImplementation((b = 0) => input.buttons.has(b));
  im.getMousePosition.mockImplementation(() => ({ ...input.mouse }));
  im.getTouches.mockImplementation(() => input.touches.map(t => ({ ...t })));
  step(h, 1);
  return {
    h,
    game,
    g: game as unknown as Internals,
    input,
    sounds: h.services.audio.playSound as unknown as jest.Mock,
  };
}

afterEach(() => {
  jest.restoreAllMocks();
});

const seconds = (r: Rig, s: number): void => step(r.h, Math.round(s / DT));

function centre(r: Rig, row: number, col: number): { x: number; y: number } {
  return cellCentre(r.g.layout, row, col);
}

function click(r: Rig, x: number, y: number, button = 0): void {
  r.input.mouse = { x, y };
  r.input.buttons.add(button);
  step(r.h, 2);
  r.input.buttons.delete(button);
  step(r.h, 1);
}

function clickCell(r: Rig, row: number, col: number, button = 0): void {
  const p = centre(r, row, col);
  click(r, p.x, p.y, button);
}

function tap(r: Rig, x: number, y: number): void {
  r.input.touches = [{ id: 1, x, y }];
  step(r.h, 3);
  r.input.touches = [];
  step(r.h, 1);
}

function key(r: Rig, code: string): void {
  r.input.keys.add(code);
  step(r.h, 1);
  r.input.keys.delete(code);
  step(r.h, 1);
}

/** Lay an exact field while READY; the first reveal then uses it. */
function craft(r: Rig, mines: CellRef[]): void {
  const b = new Board(r.g.board.cols, r.g.board.rows, mines.length);
  b.layMines(mines);
  r.g.board = b;
}

function hiddenSafe(b: Board): CellRef | null {
  for (let row = 0; row < b.rows; row++) {
    for (let col = 0; col < b.cols; col++) {
      const c = b.cells[row][col];
      if (!c.mine && !c.revealed) return { row, col };
    }
  }
  return null;
}

function hiddenMine(b: Board): CellRef | null {
  for (let row = 0; row < b.rows; row++) {
    for (let col = 0; col < b.cols; col++) {
      const c = b.cells[row][col];
      if (c.mine && !c.flagged && !c.revealed) return { row, col };
    }
  }
  return null;
}

/**
 * Five mines walling off the top-left 2x2. The flood from anywhere else
 * cannot reach the four tiles behind the wall, so they stay hidden.
 */
const WALL: CellRef[] = [
  { row: 0, col: 2 },
  { row: 1, col: 2 },
  { row: 2, col: 2 },
  { row: 2, col: 1 },
  { row: 2, col: 0 },
];

const addCoins = (r: Rig): jest.Mock =>
  r.h.services.currency.addCoins as unknown as jest.Mock;

// ------------------------------------------------------------ winning ----

describe('winning (bug: the game could not be won)', () => {
  it('clears a full board by clicking every safe tile through the pointer', () => {
    const r = rig({ seed: 3 });
    clickCell(r, 4, 4);
    expect(r.g.gameState).toBe('playing');

    for (let guard = 0; guard < 120; guard++) {
      const next = hiddenSafe(r.g.board);
      if (!next) break;
      expect(r.game.isGameOver()).toBe(false);
      clickCell(r, next.row, next.col);
    }

    expect(r.g.board.isCleared()).toBe(true);
    expect(r.g.gameState).toBe('won');
    seconds(r, VICTORY_BEAT + 0.1);
    expect(r.game.isGameOver()).toBe(true);
    expect(r.g.extendedGameData).toMatchObject({
      games_won: 1,
      cells_cleared: DIFFICULTIES.easy.cols * DIFFICULTIES.easy.rows - 10,
      difficulty: 'easy',
    });
  });

  it('catches a win opened by a cascade on the move that opened it', () => {
    const r = rig();
    craft(r, [{ row: 0, col: 0 }]);
    clickCell(r, 8, 8);
    expect(r.g.board.isCleared()).toBe(true);
    expect(r.g.gameState).toBe('won');
  });
});

describe('the victory beat (bug: a win ended the run the same frame)', () => {
  it('celebrates for 1.8s, planting the remaining flags, before endGame', () => {
    const r = rig();
    craft(r, [
      { row: 0, col: 0 },
      { row: 0, col: 8 },
    ]);
    clickCell(r, 8, 4);
    expect(r.g.gameState).toBe('won');
    expect(r.sounds).toHaveBeenCalledWith('success', undefined);
    expect(r.sounds).not.toHaveBeenCalledWith('win');

    seconds(r, VICTORY_BEAT - 0.15);
    expect(r.game.isGameOver()).toBe(false);
    expect(addCoins(r)).not.toHaveBeenCalled();
    expect(r.g.board.cells[0][0].flagged).toBe(true);
    expect(r.g.board.cells[0][8].flagged).toBe(true);
    expect(r.g.board.minesLeft).toBe(0);

    seconds(r, 0.3);
    expect(r.game.isGameOver()).toBe(true);
    expect(addCoins(r)).toHaveBeenCalledTimes(1);
    // A clear ends on the fanfare and reports completed, never a death.
    expect(r.sounds).toHaveBeenCalledWith('win');
    expect(r.sounds).not.toHaveBeenCalledWith('game_over');
    const trackEnd = r.h.services.analytics
      .trackGameEnd as unknown as jest.Mock;
    expect(trackEnd.mock.calls[0][3]).toBe('completed');
  });

  it('a loss after a win still ends on game_over and reports died', () => {
    const r = rig({ seed: 11 });
    craft(r, [{ row: 0, col: 0 }]);
    clickCell(r, 8, 8);
    seconds(r, VICTORY_BEAT + 0.1);
    expect(r.game.isGameOver()).toBe(true);
    r.game.restart();
    step(r.h, 1);
    clickCell(r, 4, 4);
    const mine = hiddenMine(r.g.board)!;
    clickCell(r, mine.row, mine.col);
    seconds(r, DEATH_BEAT + 0.1);
    expect(r.sounds).toHaveBeenLastCalledWith('game_over');
    const trackEnd = r.h.services.analytics
      .trackGameEnd as unknown as jest.Mock;
    expect(trackEnd.mock.calls[1][3]).toBe('died');
  });

  it('scores tiles, a clear bonus and a pace bonus; pickups are the flags placed', () => {
    const r = rig();
    craft(r, WALL);
    clickCell(r, 6, 6);
    expect(r.g.board.cells[0][0].revealed).toBe(false);
    clickCell(r, 0, 2, 2);
    clickCell(r, 2, 0, 2);
    expect(r.g.board.flags).toBe(2);
    for (let guard = 0; guard < 100; guard++) {
      const next = hiddenSafe(r.g.board);
      if (!next) break;
      clickCell(r, next.row, next.col);
    }
    expect(r.g.gameState).toBe('won');

    const spec = DIFFICULTIES.easy;
    const pace = Math.round(Math.max(0, spec.par - r.g.elapsedSec) * 10);
    expect(r.g.score).toBe((81 - WALL.length) * 10 + spec.clearBonus + pace);
    expect(r.g.pickups).toBe(2);
    seconds(r, VICTORY_BEAT + 0.1);
    // The auto-planted flag is decoration: it is not the player's.
    expect(r.g.extendedGameData).toMatchObject({ flags_used: 2 });
    expect(r.game.getScore().pickups).toBe(2);
  });

  it('records a new best time and shows it', () => {
    const r = rig();
    craft(r, [{ row: 0, col: 0 }]);
    seconds(r, 0.5);
    clickCell(r, 8, 8);
    expect(r.g.bestTimeSec).not.toBeNull();
    expect(localStorage.getItem('minesweeper_best_easy')).not.toBeNull();
    seconds(r, 1.2);
    const banner = r.g.hudView().banner;
    expect(banner?.kind).toBe('clear');
    expect(banner?.sub.map(s => s.text).join('')).toContain('NEW BEST');
  });
});

// -------------------------------------------------------------- losing ----

describe('the death beat', () => {
  it('holds for 2s after a mine before endGame, and pays only the tiles', () => {
    const r = rig({ seed: 11 });
    clickCell(r, 4, 4);
    const opened = r.g.board.safeOpened;
    const mine = hiddenMine(r.g.board)!;
    clickCell(r, mine.row, mine.col);
    expect(r.g.gameState).toBe('dying');
    expect(r.g.hudView().mood).toBe('dead');

    seconds(r, DEATH_BEAT - 0.15);
    expect(r.game.isGameOver()).toBe(false);
    seconds(r, 0.3);
    expect(r.game.isGameOver()).toBe(true);
    expect(r.g.pickups).toBe(0);
    expect(r.game.getScore()).toMatchObject({
      score: opened * 10,
      pickups: 0,
      games_won: 0,
    });
  });

  it('(bug) sets the mines off in order of distance, on dt, with no timers', () => {
    const timeout = jest.spyOn(globalThis, 'setTimeout');
    const interval = jest.spyOn(globalThis, 'setInterval');
    const r = rig({ seed: 5, difficulty: 'medium' });
    clickCell(r, 8, 8);
    const hit = hiddenMine(r.g.board)!;
    clickCell(r, hit.row, hit.col);
    expect(r.g.gameState).toBe('dying');

    const seen = new Set<string>();
    let lastFrameMax = 0;
    const scan = (): CellRef[] => {
      const fresh: CellRef[] = [];
      r.g.fx.forEach((row, ri) =>
        row.forEach((fx, ci) => {
          const k = `${ri},${ci}`;
          if (Number.isFinite(fx.detonateT) && !seen.has(k)) {
            seen.add(k);
            fresh.push({ row: ri, col: ci });
          }
        })
      );
      return fresh;
    };

    // Nothing goes off during the hit-stop.
    step(r.h, Math.floor(HITSTOP / DT) - 1);
    expect(scan()).toHaveLength(0);

    // Pausing freezes the wave.
    step(r.h, 20);
    const before = scan().length;
    r.game.pause();
    step(r.h, 30);
    expect(scan()).toHaveLength(0);
    r.game.resume();
    expect(before).toBeGreaterThanOrEqual(0);

    for (let f = 0; f < 140; f++) {
      step(r.h, 1);
      const fresh = scan().map(c => tileDistance(hit, c));
      if (fresh.length === 0) continue;
      expect(Math.min(...fresh)).toBeGreaterThanOrEqual(lastFrameMax - 1e-9);
      lastFrameMax = Math.max(...fresh);
    }

    const unflagged = r.g.board.cells
      .flat()
      .filter(c => c.mine && !c.flagged).length;
    expect(seen.size).toBe(unflagged - 1);
    const booms = r.sounds.mock.calls.filter(c => c[0] === 'explosion');
    expect(booms.length).toBeGreaterThan(0);
    expect(booms.length).toBeLessThanOrEqual(EXPLOSION_BUDGET);
    expect(timeout).not.toHaveBeenCalled();
    expect(interval).not.toHaveBeenCalled();
  });

  it('crosses out wrong flags and leaves correct ones standing', () => {
    const r = rig();
    craft(r, WALL);
    clickCell(r, 6, 6);
    clickCell(r, 0, 2, 2); // right: a mine
    clickCell(r, 0, 0, 2); // wrong: safe, hidden behind the wall
    expect(r.g.board.cells[0][0].revealed).toBe(false);
    clickCell(r, 2, 0);
    expect(r.g.gameState).toBe('dying');
    seconds(r, DEATH_BEAT + 0.1);
    expect(Number.isFinite(r.g.fx[0][0].wrongT)).toBe(true);
    expect(r.g.board.cells[0][2].flagged).toBe(true);
    expect(Number.isFinite(r.g.fx[0][2].detonateT)).toBe(false);
    expect(Number.isFinite(r.g.fx[2][2].detonateT)).toBe(true);
  });
});

// ------------------------------------------------------------ chording ----

describe('chording (bug: there was none)', () => {
  // A 2 at (3,3) between mines at (2,2) and (2,4).
  const setUp = (): Rig => {
    const r = rig();
    craft(r, [
      { row: 2, col: 2 },
      { row: 2, col: 4 },
    ]);
    clickCell(r, 3, 3);
    expect(r.g.board.cells[3][3].neighbors).toBe(2);
    expect(r.g.board.safeOpened).toBe(1);
    return r;
  };

  it('peeks and opens nothing while the flag count does not match', () => {
    const r = setUp();
    clickCell(r, 2, 2, 2);
    clickCell(r, 3, 3);
    const pressed = r.g.boardView().pressed;
    expect(pressed.length).toBeGreaterThan(0);
    expect(pressed.some(p => p.row === 2 && p.col === 3)).toBe(true);
    seconds(r, 0.4);
    expect(r.g.board.safeOpened).toBe(1);
    expect(r.g.gameState).toBe('playing');
  });

  it('opens every other neighbour once the flags match', () => {
    const r = setUp();
    clickCell(r, 2, 2, 2);
    clickCell(r, 2, 4, 2);
    clickCell(r, 3, 3);
    seconds(r, 0.2);
    for (const [row, col] of [
      [2, 3],
      [3, 2],
      [3, 4],
      [4, 2],
      [4, 3],
      [4, 4],
    ]) {
      expect(r.g.board.cells[row][col].revealed).toBe(true);
    }
    expect(r.g.gameState).not.toBe('dying');
  });

  it('sets off the mine when a flag is wrong (that is the rule)', () => {
    const r = setUp();
    clickCell(r, 2, 2, 2);
    clickCell(r, 2, 3, 2);
    clickCell(r, 3, 3);
    seconds(r, 0.2);
    expect(r.g.gameState).toBe('dying');
    expect(r.g.hit).toEqual({ row: 2, col: 4 });
  });

  it('chords from the keyboard with Space on a number', () => {
    const r = setUp();
    clickCell(r, 2, 2, 2);
    clickCell(r, 2, 4, 2);
    r.g.cursor.row = 3;
    r.g.cursor.col = 3;
    r.g.cursor.show();
    key(r, 'Space');
    seconds(r, 0.2);
    expect(r.g.board.cells[4][3].revealed).toBe(true);
  });
});

// -------------------------------------------------------------- touch ----

describe('touch (bug: touch could not flag)', () => {
  const playing = (): { r: Rig; target: CellRef } => {
    const r = rig({ seed: 21 });
    const c = centre(r, 4, 4);
    tap(r, c.x, c.y);
    expect(r.g.gameState).toBe('playing');
    return { r, target: hiddenSafe(r.g.board)! };
  };

  it('long-press flags with a growing ring, and never also reveals', () => {
    const { r, target } = playing();
    const p = centre(r, target.row, target.col);
    r.input.touches = [{ id: 1, x: p.x, y: p.y }];
    seconds(r, 0.3);
    expect(r.g.boardView().longPress?.t ?? 0).toBeGreaterThan(0);
    expect(r.g.board.cells[target.row][target.col].flagged).toBe(false);
    seconds(r, LONG_PRESS - 0.3 + 0.08);
    expect(r.g.board.cells[target.row][target.col].flagged).toBe(true);
    r.input.touches = [];
    step(r.h, 3);
    // A safe tile under the finger: if the release also revealed, it would
    // be open now.
    expect(r.g.board.cells[target.row][target.col].revealed).toBe(false);
    expect(r.g.board.cells[target.row][target.col].flagged).toBe(true);
  });

  it('a short tap reveals', () => {
    const { r, target } = playing();
    const p = centre(r, target.row, target.col);
    tap(r, p.x, p.y);
    expect(r.g.board.cells[target.row][target.col].revealed).toBe(true);
  });

  it('the flag-mode switch turns taps into flags, and back', () => {
    const { r, target } = playing();
    const s = r.g.layout.flagSwitch;
    tap(r, s.x + s.w / 2, s.y + s.h / 2);
    expect(r.g.flagMode).toBe(true);
    const p = centre(r, target.row, target.col);
    tap(r, p.x, p.y);
    expect(r.g.board.cells[target.row][target.col].flagged).toBe(true);
    expect(r.g.board.cells[target.row][target.col].revealed).toBe(false);
    tap(r, p.x, p.y);
    expect(r.g.board.cells[target.row][target.col].flagged).toBe(false);
    tap(r, s.x + s.w / 2, s.y + s.h / 2);
    expect(r.g.flagMode).toBe(false);
  });

  it('the first tap opens safely even in flag mode', () => {
    const r = rig();
    const s = r.g.layout.flagSwitch;
    tap(r, s.x + s.w / 2, s.y + s.h / 2);
    expect(r.g.flagMode).toBe(true);
    const p = centre(r, 0, 0);
    tap(r, p.x, p.y);
    expect(r.g.gameState).toBe('playing');
    expect(r.g.board.cells[0][0].revealed).toBe(true);
  });
});

// ------------------------------------------------------- first reveal ----

describe('the first reveal', () => {
  it('is always safe and opens a clearing, on every field, from every edge', () => {
    for (const d of DIFFICULTY_ORDER) {
      const spec = DIFFICULTIES[d];
      const spots: CellRef[] = [
        { row: 0, col: 0 },
        { row: 0, col: spec.cols - 1 },
        { row: spec.rows - 1, col: 0 },
        { row: spec.rows - 1, col: spec.cols - 1 },
        { row: 0, col: Math.floor(spec.cols / 2) },
        { row: Math.floor(spec.rows / 2), col: Math.floor(spec.cols / 2) },
      ];
      for (let seed = 1; seed <= 25; seed++) {
        for (const s of spots) {
          const b = Board.for(d);
          b.placeMines(s.row, s.col, mulberry32(seed * 101 + s.row));
          expect(b.cells.flat().filter(c => c.mine)).toHaveLength(spec.mines);
          expect(b.cells[s.row][s.col].mine).toBe(false);
          for (const n of b.neighbours(s.row, s.col)) {
            expect(b.cells[n.row][n.col].mine).toBe(false);
          }
          const res = b.reveal(s.row, s.col);
          expect(res.mine).toBeNull();
          if (d === 'easy') {
            expect(res.opened.length).toBeGreaterThanOrEqual(MIN_FIRST_OPENING);
          }
        }
      }
    }
  });

  it('starts the run through the pointer from a corner', () => {
    const r = rig({ seed: 99 });
    clickCell(r, 8, 8);
    expect(r.g.gameState).toBe('playing');
    expect(r.g.board.cells[8][8].revealed).toBe(true);
  });
});

// ----------------------------------------------------------- readouts ----

describe('the readouts', () => {
  it('mines-left follows the flags and goes negative when over-flagged', () => {
    const r = rig({ seed: 4 });
    clickCell(r, 4, 4);
    const hidden: CellRef[] = [];
    r.g.board.cells.forEach((row, ri) =>
      row.forEach((c, ci) => {
        if (!c.revealed) hidden.push({ row: ri, col: ci });
      })
    );
    for (const h of hidden.slice(0, 3)) clickCell(r, h.row, h.col, 2);
    expect(r.g.hudView().minesLeft).toBe(7);
    clickCell(r, hidden[0].row, hidden[0].col, 2);
    expect(r.g.hudView().minesLeft).toBe(8);
    for (const h of hidden.slice(0, 12)) {
      if (!r.g.board.cells[h.row][h.col].flagged) clickCell(r, h.row, h.col, 2);
    }
    expect(r.g.hudView().minesLeft).toBe(-2);
  });

  it('the timer waits for the first reveal and stops at a loss', () => {
    const r = rig({ seed: 8 });
    seconds(r, 2);
    expect(r.g.elapsedSec).toBe(0);
    clickCell(r, 4, 4);
    seconds(r, 1.5);
    expect(r.g.elapsedSec).toBeGreaterThan(1.4);
    expect(r.g.elapsedSec).toBeLessThan(1.7);
    const mine = hiddenMine(r.g.board)!;
    clickCell(r, mine.row, mine.col);
    const frozen = r.g.elapsedSec;
    seconds(r, 1);
    expect(r.g.elapsedSec).toBe(frozen);
  });

  it('the timer stops at a win', () => {
    const r = rig();
    craft(r, [{ row: 0, col: 0 }]);
    clickCell(r, 8, 8);
    const frozen = r.g.elapsedSec;
    seconds(r, 1);
    expect(r.g.gameState).toBe('won');
    expect(r.g.elapsedSec).toBe(frozen);
  });
});

// ------------------------------------------------------------- layout ----

describe('layout (bug: medium and hard ran into the footer)', () => {
  const inside = (inner: Rect, outer: Rect): boolean =>
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.w <= outer.x + outer.w &&
    inner.y + inner.h <= outer.y + outer.h;
  const canvas: Rect = { x: 0, y: 0, w: CANVAS_W, h: CANVAS_H };

  for (const d of DIFFICULTY_ORDER) {
    it(`fits ${d} in bands inside 800x600`, () => {
      const spec = DIFFICULTIES[d];
      const L = computeLayout(spec.cols, spec.rows);
      expect(L.cell).toBeGreaterThanOrEqual(MIN_CELL);
      expect(L.cell).toBeLessThanOrEqual(MAX_CELL);

      for (const r of [L.board, L.well, L.header, L.housing, L.footer]) {
        expect(inside(r, canvas)).toBe(true);
      }
      expect(inside(L.board, L.well)).toBe(true);
      expect(inside(L.header, L.housing)).toBe(true);
      expect(inside(L.well, L.housing)).toBe(true);

      // The tiles keep their margin from the header and the desk strip.
      expect(L.board.y - (L.header.y + L.header.h)).toBeGreaterThanOrEqual(
        BOARD_MARGIN
      );
      expect(L.footer.y - (L.board.y + L.board.h)).toBeGreaterThanOrEqual(
        BOARD_MARGIN
      );
      expect(L.board.x).toBeGreaterThanOrEqual(BOARD_MARGIN);
      expect(CANVAS_W - (L.board.x + L.board.w)).toBeGreaterThanOrEqual(
        BOARD_MARGIN
      );
      expect(intersects(L.housing, L.footer)).toBe(false);
      // The instrument never sits flush with the canvas top or the desk.
      expect(L.housing.y).toBeGreaterThanOrEqual(HOUSING_GAP);
      expect(L.footer.y - (L.housing.y + L.housing.h)).toBeGreaterThanOrEqual(
        HOUSING_GAP
      );

      // Header pieces sit in the header and apart.
      const face: Rect = {
        x: L.face.x - L.face.r - 4,
        y: L.face.y - L.face.r - 4,
        w: (L.face.r + 4) * 2,
        h: (L.face.r + 4) * 2,
      };
      for (const r of [L.minesReadout, L.timeReadout, face]) {
        expect(inside(r, L.header)).toBe(true);
      }
      expect(intersects(L.minesReadout, face)).toBe(false);
      expect(intersects(L.timeReadout, face)).toBe(false);

      // Footer controls sit in the desk strip, apart, above the hint.
      const controls = [
        L.keys.easy,
        L.keys.medium,
        L.keys.hard,
        L.flagSwitch,
        L.best,
      ];
      for (const r of controls) {
        expect(inside(r, L.footer)).toBe(true);
        expect(r.y + r.h).toBeLessThan(L.hintY - 8);
      }
      for (let i = 0; i < controls.length; i++) {
        for (let j = i + 1; j < controls.length; j++) {
          expect(intersects(controls[i], controls[j])).toBe(false);
        }
      }
      expect(L.hintY).toBeLessThanOrEqual(CANVAS_H - 4);
    });
  }

  it('hard is 20x14 at 32px, with the housing clear of the canvas top', () => {
    const L = computeLayout(20, 14);
    expect(L.cell).toBe(32);
    expect(L.board.w).toBe(640);
    expect(L.board.h).toBe(448);
  });
});

// --------------------------------------------------------- input path ----

describe('the input path (bug: stale hover flags, face read its own centre)', () => {
  it('hover comes from the pointer and does not survive a restart', () => {
    const r = rig();
    const p = centre(r, 2, 3);
    r.input.mouse = p;
    step(r.h, 2);
    expect(r.g.boardView().hover).toEqual({ row: 2, col: 3 });
    r.input.mouse = { x: 2, y: 2 };
    step(r.h, 1);
    expect(r.g.boardView().hover).toBeNull();
    r.input.mouse = p;
    step(r.h, 1);
    r.game.restart();
    expect(r.g.hover).toBeNull();
  });

  it('a held tile is pushed down, the face goes tense, and release opens it', () => {
    const r = rig();
    const p = centre(r, 4, 4);
    r.input.mouse = p;
    r.input.buttons.add(0);
    step(r.h, 2);
    expect(r.g.boardView().pressed).toEqual([{ row: 4, col: 4 }]);
    expect(r.g.hudView().mood).toBe('tense');
    expect(r.g.gameState).toBe('ready');
    r.input.buttons.delete(0);
    step(r.h, 1);
    expect(r.g.gameState).toBe('playing');
  });

  it('a press dragged off the field and released does nothing', () => {
    const r = rig();
    const p = centre(r, 4, 4);
    r.input.mouse = p;
    r.input.buttons.add(0);
    step(r.h, 2);
    r.input.mouse = { x: 4, y: 4 };
    step(r.h, 1);
    r.input.buttons.delete(0);
    step(r.h, 1);
    expect(r.g.gameState).toBe('ready');
  });

  it('the face shows pressed only under a held pointer; release deals a new field', () => {
    const r = rig({ seed: 12 });
    clickCell(r, 4, 4);
    expect(r.g.board.minesPlaced).toBe(true);
    const f = r.g.layout.face;
    r.input.mouse = { x: f.x, y: f.y };
    r.input.buttons.add(0);
    step(r.h, 1);
    expect(r.g.hudView().facePressed).toBe(true);
    r.input.mouse = { x: f.x + 80, y: f.y };
    step(r.h, 1);
    expect(r.g.hudView().facePressed).toBe(false);
    r.input.mouse = { x: f.x, y: f.y };
    step(r.h, 1);
    expect(r.g.hudView().facePressed).toBe(true);
    r.input.buttons.delete(0);
    step(r.h, 1);
    expect(r.g.gameState).toBe('ready');
    expect(r.g.board.minesPlaced).toBe(false);
  });

  it('a press on a tile never shows the face as pressed', () => {
    const r = rig();
    r.input.mouse = centre(r, 0, 4);
    r.input.buttons.add(0);
    step(r.h, 2);
    expect(r.g.hudView().facePressed).toBe(false);
  });
});

// ----------------------------------------------------------- keyboard ----

describe('the keyboard', () => {
  it('arrows move a cursor, Space opens, F flags under the cursor', () => {
    const r = rig({ seed: 2 });
    key(r, 'ArrowRight'); // wakes the cursor where it sits
    expect(r.g.cursor.visible).toBe(true);
    expect([r.g.cursor.row, r.g.cursor.col]).toEqual([4, 4]);
    key(r, 'ArrowRight');
    key(r, 'ArrowDown');
    expect([r.g.cursor.row, r.g.cursor.col]).toEqual([5, 5]);
    key(r, 'Space');
    expect(r.g.gameState).toBe('playing');
    expect(r.g.board.cells[5][5].revealed).toBe(true);

    const target = hiddenMine(r.g.board)!;
    r.g.cursor.row = target.row;
    r.g.cursor.col = target.col;
    key(r, 'KeyF');
    expect(r.g.board.cells[target.row][target.col].flagged).toBe(true);
    expect(r.g.flagMode).toBe(false);
  });

  it('F with nothing targeted throws the flag-mode switch', () => {
    const r = rig();
    key(r, 'KeyF');
    expect(r.g.flagMode).toBe(true);
  });

  it('1, 2 and 3 change the field only before the first reveal', () => {
    const r = rig();
    key(r, 'Digit2');
    expect(r.g.difficulty).toBe('medium');
    expect(r.g.board.cols).toBe(16);
    expect(localStorage.getItem('minesweeper_difficulty')).toBe('medium');
    clickCell(r, 8, 8);
    key(r, 'Digit3');
    expect(r.g.difficulty).toBe('medium');
    expect(r.g.hudView().keysLocked).toBe(true);
  });
});

// ------------------------------------------------------------ restart ----

describe('restart', () => {
  it('returns to READY with every timer, system and entity reset', () => {
    const r = rig({ seed: 6 });
    clickCell(r, 4, 4);
    const mine = hiddenMine(r.g.board)!;
    const safe = hiddenSafe(r.g.board)!;
    clickCell(r, safe.row, safe.col, 2);
    clickCell(r, mine.row, mine.col);
    seconds(r, 0.5);
    expect(r.g.particles.count()).toBeGreaterThan(0);
    seconds(r, DEATH_BEAT);
    expect(r.game.isGameOver()).toBe(true);

    r.game.restart();
    expect(r.g.gameState).toBe('ready');
    expect(r.g.elapsedSec).toBe(0);
    expect(r.g.score).toBe(0);
    expect(r.g.pickups).toBe(0);
    expect(r.g.hit).toBeNull();
    expect(r.g.board.minesPlaced).toBe(false);
    expect(r.g.board.flags).toBe(0);
    expect(r.g.readyCardT).toBe(READY_CARD_TIME);
    expect(r.g.extendedGameData).toBeNull();
    expect(r.g.particles.count()).toBe(0);
    expect(r.g.pops).toHaveLength(0);
    expect(r.g.wave).toHaveLength(0);
    expect(r.g.fx.flat().every(f => f.revealT === Infinity)).toBe(true);
    expect(r.game.isGameOver()).toBe(false);
  });

  it('opens on a READY card that the first input dismisses', () => {
    const r = rig();
    expect(r.g.hudView().readyCard).toBe(1);
    key(r, 'ArrowLeft');
    seconds(r, 0.25);
    expect(r.g.hudView().readyCard).toBe(0);
  });

  it('the READY card leaves by itself within 2s', () => {
    const r = rig();
    seconds(r, READY_CARD_TIME + 0.05);
    expect(r.g.hudView().readyCard).toBe(0);
    expect(r.g.gameState).toBe('ready');
  });
});

// ---------------------------------------------------------- rendering ----

describe('rendering', () => {
  it('draws the ended board dimmed, and drawing it changes nothing', () => {
    const r = rig({ seed: 14 });
    clickCell(r, 4, 4);
    const mine = hiddenMine(r.g.board)!;
    clickCell(r, mine.row, mine.col);
    seconds(r, DEATH_BEAT + 0.1);
    expect(r.game.isGameOver()).toBe(true);

    const renderField = jest.spyOn(r.g.boardRenderer, 'renderField');
    const clock = r.g.clock;
    r.game.render(r.h.ctx);
    r.game.render(r.h.ctx);
    expect(renderField).toHaveBeenCalled();
    expect(renderField.mock.calls[0][1].dim).toBeCloseTo(0.55);
    expect(r.g.clock).toBe(clock);
  });

  it('a settled frame redraws no tiles into the cache', () => {
    const r = rig({ seed: 1 });
    clickCell(r, 4, 4);
    r.input.mouse = { x: 2, y: 2 };
    seconds(r, 1);
    step(r.h, 1);
    expect(r.g.boardRenderer.lastRedraws).toBe(0);
  });
});
