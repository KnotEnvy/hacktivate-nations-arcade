// Snake: the rules, pinned.
//
// Each block corresponds to a bug that was live before the polish pass
// (see src/games/snake/RECAP.md). They pin the RULE, not the tuning:
//
//   * a second turn tapped inside one step was dropped (no turn queue)
//   * losing a life froze the snake nose-first into the wall; an idle
//     player lost all three lives in about four seconds
//   * the step rate had no ceiling
//   * the survival score was dead code (Math.floor(dt * 2) is always 0)
//   * Date.now() drove the animation
//   * the magnet could drag a coin onto the snake
//   * the base HUD was drawn over the board
//   * WRAP running out next to a wall was an instant hit
//   * spawns gave up after 100 tries and stacked on occupied cells
//   * an apple grew the snake by two (DOUBLE by three)

import { SnakeGame } from '../SnakeGame';
import type { ActivePowerUp, SnakeState } from '../SnakeGame';
import { initGame, step, Harness } from '@/games/shared/gameTestHarness';
import {
  BOARD_H,
  BOARD_W,
  BOARD_X,
  BOARD_Y,
  BOTTOM_BAND,
  CANVAS_H,
  COLS,
  FRAME,
  HIT_STOP,
  RESPAWN_INVULNERABILITY,
  RESPAWN_WAIT,
  ROWS,
  TOP_BAND,
} from '../constants';
import { TurnQueue, Dir, DIR_VEC } from '../systems/TurnQueue';
import {
  MAX_STEP_RATE,
  PACE_TIERS,
  paceTierFor,
  stepRate,
} from '../systems/Pace';
import {
  Cell,
  RESPAWN_CELL,
  inBounds,
  layoutRespawn,
  openRoom,
  respawnFacing,
} from '../systems/Respawn';
import type { Coin } from '../entities/Coin';
import type { Food } from '../entities/Food';
import type { PowerUp, SnakePowerUpType } from '../entities/PowerUp';
import type { ComboSystem } from '../systems/ComboSystem';

/** The private surface these tests reach through. */
interface SnakeInternals {
  gameState: SnakeState;
  stateTime: number;
  snake: Cell[];
  prevTail: Cell;
  turns: TurnQueue;
  stepProgress: number;
  pendingGrowth: number;
  lives: number;
  score: number;
  pickups: number;
  foodEaten: number;
  paceTier: number;
  food: Food;
  coins: Coin[];
  powerUps: PowerUp[];
  activePowerUps: ActivePowerUp[];
  morsels: unknown[];
  invulnerableFor: number;
  wrapGrace: number;
  coinTimer: number;
  powerUpTimer: number;
  comboSystem: ComboSystem;
  extendedGameData: Record<string, unknown> | null;
  renderBaseHud: boolean;
  startMoving(): void;
  eatFood(): void;
  spawnFood(): void;
  spawnCoin(): void;
  spawnPowerUp(type?: SnakePowerUpType): void;
  applyMagnet(): void;
  currentStepRate(): number;
  endGame(): void;
  onRenderUI(ctx: CanvasRenderingContext2D): void;
}

interface Rig {
  h: Harness;
  g: SnakeInternals;
  held: Set<string>;
  touches: Array<{ id: number; x: number; y: number }>;
}

function rig(): Rig {
  const h = initGame(new SnakeGame());
  const held = new Set<string>();
  const touches: Array<{ id: number; x: number; y: number }> = [];
  (h.services.input.isKeyPressed as jest.Mock).mockImplementation(
    (code: string) => held.has(code)
  );
  (h.services.input.getTouches as jest.Mock).mockImplementation(() =>
    touches.map(t => ({ ...t }))
  );
  return { h, g: h.game as unknown as SnakeInternals, held, touches };
}

/**
 * Put a straight snake on the board, heading `dir`, already PLAYING, with
 * random spawns switched off and the apple parked out of the way.
 */
function place(r: Rig, head: Cell, dir: Dir, length = 3): void {
  const { g } = r;
  const v = DIR_VEC[dir];
  g.snake = [];
  for (let i = 0; i < length; i++) {
    g.snake.push({ x: head.x - v.x * i, y: head.y - v.y * i });
  }
  g.prevTail = { ...g.snake[g.snake.length - 1] };
  g.turns.force(dir);
  g.startMoving();
  g.stepProgress = 0;
  g.coinTimer = -1e9;
  g.powerUpTimer = -1e9;
  g.coins = [];
  g.powerUps = [];
  g.food.setPosition(0, ROWS - 1);
}

function tap(r: Rig, code: string): void {
  r.held.add(code);
  step(r.h, 1);
  r.held.delete(code);
  step(r.h, 1);
}

/** Step frames until the head moves `n` times; returns each new head. */
function headPath(r: Rig, n: number, dt = 1 / 60): Cell[] {
  const out: Cell[] = [];
  let last = { ...r.g.snake[0] };
  for (let i = 0; i < 2000 && out.length < n; i++) {
    step(r.h, 1, dt);
    const head = r.g.snake[0];
    if (head.x !== last.x || head.y !== last.y) {
      out.push({ ...head });
      last = { ...head };
    }
  }
  return out;
}

function power(g: SnakeInternals, type: SnakePowerUpType, seconds: number) {
  g.activePowerUps.push({ type, duration: seconds, maxDuration: seconds });
}

function occupiedBySnake(g: SnakeInternals, x: number, y: number): boolean {
  return g.snake.some(c => c.x === x && c.y === y);
}

// ------------------------------------------------------------ turns ----

describe('turn queue', () => {
  it('keeps two quick turns and validates each against the one before', () => {
    const q = new TurnQueue('right');
    expect(q.push('up')).toBe(true);
    // Against the MOVED heading (right) this would read as a reverse.
    expect(q.push('left')).toBe(true);
    expect(q.next()).toBe('up');
    expect(q.next()).toBe('left');
  });

  it('never accepts a 180, from the heading or from a queued turn', () => {
    const q = new TurnQueue('right');
    expect(q.push('left')).toBe(false);
    expect(q.push('up')).toBe(true);
    expect(q.push('down')).toBe(false);
    expect(q.push('left')).toBe(true);
    expect(q.push('down')).toBe(false); // full
    expect(q.queued()).toEqual(['up', 'left']);
  });

  it('orders two keys landing on the same frame so neither is lost', () => {
    const q = new TurnQueue('right');
    q.pushAll(['left', 'up']);
    expect(q.queued()).toEqual(['up', 'left']);
  });

  it('in play: up then left tapped inside one step both happen', () => {
    const r = rig();
    place(r, { x: 10, y: 9 }, 'right');
    tap(r, 'ArrowUp');
    tap(r, 'ArrowLeft');
    // Four frames at 60fps is well inside one 7-steps-a-second step.
    expect(headPath(r, 2)).toEqual([
      { x: 10, y: 8 },
      { x: 9, y: 8 },
    ]);
    expect(r.g.lives).toBe(3);
  });

  it('in play: a reverse key is ignored rather than killing the snake', () => {
    const r = rig();
    place(r, { x: 10, y: 9 }, 'right');
    tap(r, 'ArrowLeft');
    expect(headPath(r, 1)).toEqual([{ x: 11, y: 9 }]);
    expect(r.g.lives).toBe(3);
  });

  it('a continuous drag re-arms, so one swipe can turn twice', () => {
    const r = rig();
    place(r, { x: 10, y: 9 }, 'right');
    const path = [
      [400, 300],
      [400, 285],
      [400, 268],
      [385, 268],
      [368, 268],
    ];
    for (const [x, y] of path) {
      r.touches.splice(0, r.touches.length, { id: 1, x, y });
      step(r.h, 1);
    }
    r.touches.splice(0, r.touches.length);
    expect(headPath(r, 2)).toEqual([
      { x: 10, y: 8 },
      { x: 9, y: 8 },
    ]);
  });
});

// ---------------------------------------------------------- respawn ----

describe('losing a life', () => {
  function wallHit(r: Rig, length = 8): void {
    place(r, { x: COLS - 1, y: 5 }, 'right', length);
    r.g.stepProgress = 0.999;
    step(r.h, 1);
  }

  it('respawns inside the board, off the body, at half length', () => {
    const r = rig();
    wallHit(r, 10);
    expect(r.g.lives).toBe(2);
    expect(r.g.gameState).toBe('hit');

    step(r.h, Math.ceil(HIT_STOP * 60) + 1);
    expect(r.g.gameState).toBe('respawn');
    const cells = r.g.snake;
    expect(cells).toHaveLength(5);
    expect(cells[0]).toEqual(RESPAWN_CELL);
    for (const c of cells) expect(inBounds(c.x, c.y)).toBe(true);
    const keys = new Set(cells.map(c => `${c.x},${c.y}`));
    expect(keys.size).toBe(cells.length);
    // Facing open room, away from the wall it hit.
    expect(r.g.turns.heading).toBe('left');
    const ahead = { x: cells[0].x - 1, y: cells[0].y };
    expect(occupiedBySnake(r.g, ahead.x, ahead.y)).toBe(false);
  });

  it('waits for the first turn before moving', () => {
    const r = rig();
    wallHit(r);
    step(r.h, Math.ceil(HIT_STOP * 60) + 1);
    const laid = r.g.snake.map(c => ({ ...c }));
    step(r.h, Math.floor(RESPAWN_WAIT * 60) - 10);
    expect(r.g.snake).toEqual(laid);
    expect(r.g.gameState).toBe('respawn');

    tap(r, 'ArrowUp');
    expect(r.g.gameState).toBe('playing');
    expect(r.g.snake[0]).toEqual({ x: laid[0].x, y: laid[0].y - 1 });
  });

  it('does not cost a second life while the player is idle', () => {
    for (const tier of [0, PACE_TIERS.length - 1]) {
      const r = rig();
      r.g.paceTier = tier;
      wallHit(r);
      expect(r.g.lives).toBe(2);
      const protectedFor = HIT_STOP + RESPAWN_WAIT + RESPAWN_INVULNERABILITY;
      step(r.h, Math.floor(protectedFor * 60) - 2);
      expect(r.g.lives).toBe(2);
      for (const c of r.g.snake) expect(inBounds(c.x, c.y)).toBe(true);
    }
  });

  it('keeps score, coins and the board; breaks the combo', () => {
    const r = rig();
    place(r, { x: COLS - 1, y: 5 }, 'right', 6);
    r.g.score = 120;
    r.g.pickups = 3;
    r.g.comboSystem.addHit();
    r.g.comboSystem.addHit();
    r.g.food.setPosition(3, 3);
    r.g.spawnCoin();
    const coin = { x: r.g.coins[0].x, y: r.g.coins[0].y };
    r.g.stepProgress = 0.999;
    step(r.h, 1 + Math.ceil(HIT_STOP * 60) + 1);
    expect(r.g.gameState).toBe('respawn');
    expect(r.g.score).toBe(120);
    expect(r.g.pickups).toBe(3);
    expect(r.g.comboSystem.getCombo()).toBe(0);
    expect(r.g.coins).toHaveLength(1);
    if (!occupiedBySnake(r.g, coin.x, coin.y)) {
      expect({ x: r.g.coins[0].x, y: r.g.coins[0].y }).toEqual(coin);
    }
  });

  it('lays out any length as a connected body behind the head', () => {
    for (const facing of ['left', 'right', 'up', 'down'] as Dir[]) {
      for (let len = 3; len <= 150; len += 7) {
        const cells = layoutRespawn(len, facing);
        expect(cells).toHaveLength(len);
        expect(cells[0]).toEqual(RESPAWN_CELL);
        const keys = new Set(cells.map(c => `${c.x},${c.y}`));
        expect(keys.size).toBe(cells.length);
        for (let i = 0; i < cells.length; i++) {
          expect(inBounds(cells[i].x, cells[i].y)).toBe(true);
          if (i > 0) {
            const d =
              Math.abs(cells[i].x - cells[i - 1].x) +
              Math.abs(cells[i].y - cells[i - 1].y);
            expect(d).toBe(1);
          }
        }
        const v = DIR_VEC[facing];
        expect(keys.has(`${cells[0].x + v.x},${cells[0].y + v.y}`)).toBe(false);
      }
    }
  });

  it('faces the most open room', () => {
    const facing = respawnFacing(null);
    const best = Math.max(
      ...(['up', 'down', 'left', 'right'] as Dir[]).map(d =>
        openRoom(RESPAWN_CELL, d)
      )
    );
    expect(openRoom(RESPAWN_CELL, facing)).toBe(best);
  });
});

// ------------------------------------------------------------- pace ----

describe('pace', () => {
  it('never exceeds the cap, at any tier, slowed or not', () => {
    for (let tier = -2; tier < 20; tier++) {
      expect(stepRate(tier, false)).toBeLessThanOrEqual(MAX_STEP_RATE);
      expect(stepRate(tier, true)).toBeLessThan(stepRate(tier, false) + 1e-9);
    }
    expect(paceTierFor(1e6)).toBe(PACE_TIERS.length - 1);
  });

  it('a snake that has eaten 300 apples moves no faster than the cap', () => {
    const r = rig();
    place(r, { x: 5, y: 2 }, 'right');
    for (let i = 0; i < 300; i++) r.g.eatFood();
    r.g.pendingGrowth = 0;
    r.g.food.setPosition(0, ROWS - 1);
    power(r.g, 'wrap', 1e6);
    power(r.g, 'ghost', 1e6);
    const moves = headPath(r, 1000, 1 / 60).length;
    // headPath gives up after 2000 frames: count the moves in that window.
    const seconds = 2000 / 60;
    expect(moves).toBeLessThanOrEqual(Math.ceil(MAX_STEP_RATE * seconds) + 1);
  });

  it('crossing a tier announces it', () => {
    const r = rig();
    place(r, { x: 5, y: 2 }, 'right');
    const need = PACE_TIERS[1].food;
    for (let i = 0; i < need; i++) r.g.eatFood();
    expect(r.g.paceTier).toBe(1);
    expect(r.h.services.audio.playSound).toHaveBeenCalledWith(
      'whoosh',
      undefined
    );
  });
});

// ------------------------------------------------------------ score ----

describe('pace pays (the survival score)', () => {
  function survive(dt: number, seconds: number): number {
    const r = rig();
    place(r, { x: 2, y: 1 }, 'right');
    power(r.g, 'wrap', 1e6);
    power(r.g, 'ghost', 1e6);
    r.g.food.setPosition(10, 12);
    const frames = Math.round(seconds / dt);
    for (let i = 0; i < frames; i++) r.h.game.update(dt);
    return r.g.score;
  }

  it('accrues points while moving, the same at 30fps and 144fps', () => {
    const slow = survive(1 / 30, 10);
    const fast = survive(1 / 144, 10);
    expect(slow).toBeGreaterThanOrEqual(9);
    expect(Math.abs(slow - fast)).toBeLessThanOrEqual(1);
  });

  it('pays nothing on the READY card or while waiting to respawn', () => {
    const r = rig();
    step(r.h, 100);
    expect(r.g.gameState).toBe('ready');
    expect(r.g.score).toBe(0);

    place(r, { x: COLS - 1, y: 5 }, 'right');
    r.g.stepProgress = 0.999;
    step(r.h, 1);
    const before = r.g.score;
    step(r.h, Math.ceil(HIT_STOP * 60) + 60);
    expect(r.g.gameState).toBe('respawn');
    expect(r.g.score).toBe(before);
  });
});

// ------------------------------------------------------- determinism ----

describe('animation runs on game time', () => {
  it('never reads Date.now or performance.now while updating or drawing', () => {
    const r = rig();
    place(r, { x: 10, y: 9 }, 'right');
    r.g.spawnCoin();
    power(r.g, 'magnet', 5);
    const now = jest.spyOn(Date, 'now');
    const perf = jest.spyOn(performance, 'now');
    step(r.h, 90);
    expect(now).not.toHaveBeenCalled();
    expect(perf).not.toHaveBeenCalled();
    now.mockRestore();
    perf.mockRestore();
  });
});

// --------------------------------------------------------- spawning ----

describe('spawns and the magnet', () => {
  /** A snake covering everything except `free` cells in the last row. */
  function nearlyFull(r: Rig, free: number): void {
    const cells: Cell[] = [];
    for (let y = 0; y < ROWS; y++) {
      for (let i = 0; i < COLS; i++) {
        const x = y % 2 === 0 ? i : COLS - 1 - i;
        cells.push({ x, y });
      }
    }
    place(r, cells[0], 'left');
    r.g.snake = cells.slice(0, COLS * ROWS - free);
    r.g.food.setPosition(-1, -1);
  }

  it('never spawns an apple, coin or power-up on an occupied cell', () => {
    const r = rig();
    nearlyFull(r, 12);
    for (let i = 0; i < 300; i++) {
      r.g.coins = [];
      r.g.powerUps = [];
      r.g.spawnFood();
      r.g.spawnCoin();
      r.g.spawnPowerUp();
      const f = r.g.food;
      expect(occupiedBySnake(r.g, f.x, f.y)).toBe(false);
      for (const c of r.g.coins) {
        expect(occupiedBySnake(r.g, c.x, c.y)).toBe(false);
        expect(c.x === f.x && c.y === f.y).toBe(false);
      }
      for (const p of r.g.powerUps) {
        expect(occupiedBySnake(r.g, p.x, p.y)).toBe(false);
        expect(p.x === f.x && p.y === f.y).toBe(false);
        for (const c of r.g.coins) {
          expect(c.x === p.x && c.y === p.y).toBe(false);
        }
      }
    }
  });

  it('leaves no apple rather than stacking one when the board is full', () => {
    const r = rig();
    nearlyFull(r, 0);
    r.g.spawnFood();
    expect(r.g.food.isPlaced()).toBe(false);
  });

  it('the magnet never pulls a coin onto an occupied cell', () => {
    // A seeded walk so the shapes are the same every run.
    let seed = 7;
    const rand = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    const r = rig();
    for (let trial = 0; trial < 400; trial++) {
      place(r, { x: 15, y: 9 }, 'right');
      const cells: Cell[] = [{ x: 15, y: 9 }];
      for (let i = 0; i < 14; i++) {
        const last = cells[cells.length - 1];
        const d = (['up', 'down', 'left', 'right'] as Dir[])[
          Math.floor(rand() * 4)
        ];
        const n = { x: last.x + DIR_VEC[d].x, y: last.y + DIR_VEC[d].y };
        if (!inBounds(n.x, n.y)) continue;
        if (cells.some(c => c.x === n.x && c.y === n.y)) continue;
        cells.push(n);
      }
      r.g.snake = cells;
      r.g.food.setPosition(15 + Math.floor(rand() * 5) - 2, 7);
      r.g.coins = [];
      for (let k = 0; k < 2; k++) {
        r.g.spawnCoin();
        const c = r.g.coins[r.g.coins.length - 1];
        const x = 15 + Math.floor(rand() * 7) - 3;
        const y = 9 + Math.floor(rand() * 7) - 3;
        const taken =
          occupiedBySnake(r.g, x, y) ||
          (r.g.food.x === x && r.g.food.y === y) ||
          r.g.coins.some(o => o !== c && o.x === x && o.y === y);
        if (!taken) {
          c.x = x;
          c.y = y;
        }
      }
      r.g.applyMagnet();
      for (const c of r.g.coins) {
        expect(occupiedBySnake(r.g, c.x, c.y)).toBe(false);
        expect(c.x === r.g.food.x && c.y === r.g.food.y).toBe(false);
        const twins = r.g.coins.filter(o => o.x === c.x && o.y === c.y);
        expect(twins).toHaveLength(1);
      }
    }
  });

  it('a coin pulled into the head is eaten, not parked under the neck', () => {
    const r = rig();
    place(r, { x: 10, y: 9 }, 'right');
    r.g.spawnCoin();
    r.g.coins[0].x = 10;
    r.g.coins[0].y = 10;
    r.g.applyMagnet();
    expect(r.g.coins).toHaveLength(0);
    expect(r.g.pickups).toBe(1);
  });
});

// ------------------------------------------------------------ board ----

describe('the board and its chrome', () => {
  it('sits in its own band, frame and all', () => {
    expect(BOARD_Y - FRAME).toBeGreaterThanOrEqual(TOP_BAND);
    expect(BOARD_Y + BOARD_H + FRAME).toBeLessThanOrEqual(
      CANVAS_H - BOTTOM_BAND
    );
    expect(BOARD_X - FRAME).toBeGreaterThanOrEqual(0);
    expect(BOARD_X + BOARD_W + FRAME).toBeLessThanOrEqual(800);
  });

  it('draws no HUD text over the board, in the platform type', () => {
    const r = rig();
    place(r, { x: 10, y: 9 }, 'right');
    power(r.g, 'ghost', 5);
    r.g.comboSystem.addHit();
    r.g.comboSystem.addHit();
    step(r.h, 30);
    expect(r.g.renderBaseHud).toBe(false);

    const ctx = r.h.ctx as unknown as Record<string, unknown>;
    const fonts: string[] = [];
    let font = '';
    Object.defineProperty(ctx, 'font', {
      configurable: true,
      get: () => font,
      set: (v: string) => {
        font = v;
        fonts.push(v);
      },
    });
    const fillText = r.h.ctx.fillText as jest.Mock;
    fillText.mockClear();
    r.g.onRenderUI(r.h.ctx);
    delete ctx.font;

    expect(fillText).toHaveBeenCalled();
    for (const [, , y] of fillText.mock.calls as Array<
      [string, number, number]
    >) {
      const inside = y > BOARD_Y - FRAME && y < BOARD_Y + BOARD_H + FRAME;
      expect(inside).toBe(false);
    }
    expect(fonts.length).toBeGreaterThan(0);
    for (const f of fonts) expect(f).not.toMatch(/Arial/);
  });
});

// ------------------------------------------------------------- wrap ----

describe('WRAP running out', () => {
  it('lets a committed head wrap once more instead of hitting the wall', () => {
    const r = rig();
    place(r, { x: COLS - 1, y: 5 }, 'right');
    power(r.g, 'wrap', 0.05);
    // The step lands ~0.14s later: after WRAP ends, inside the grace.
    expect(headPath(r, 1)).toEqual([{ x: 0, y: 5 }]);
    expect(r.g.lives).toBe(3);
  });

  it('is a wall again once the grace is over', () => {
    const r = rig();
    place(r, { x: COLS - 1, y: 5 }, 'right');
    r.g.wrapGrace = 0;
    r.g.stepProgress = 0.999;
    step(r.h, 1);
    expect(r.g.lives).toBe(2);
  });

  it('ticks through its last two seconds', () => {
    const r = rig();
    place(r, { x: 2, y: 1 }, 'right');
    power(r.g, 'wrap', 2.2);
    power(r.g, 'ghost', 1e6);
    const play = r.h.services.audio.playSound as jest.Mock;
    play.mockClear();
    step(r.h, 150);
    const ticks = play.mock.calls.filter(([name]) => name === 'click');
    expect(ticks).toHaveLength(4);
  });
});

// ---------------------------------------------------------- growing ----

describe('growth and the tail', () => {
  it('an apple adds one cell, two under DOUBLE', () => {
    for (const [double, gain] of [
      [false, 1],
      [true, 2],
    ] as const) {
      const r = rig();
      place(r, { x: 10, y: 9 }, 'right');
      if (double) power(r.g, 'double', 30);
      r.g.food.setPosition(11, 9);
      const before = r.g.snake.length;
      headPath(r, 1);
      // Park the next apple so a lucky spawn cannot add a second bite.
      r.g.food.setPosition(0, ROWS - 1);
      headPath(r, 3);
      expect(r.g.snake.length).toBe(before + gain);
      expect(r.g.foodEaten).toBe(1);
    }
  });

  it('chasing your own tail is legal: the tail moves out of the way', () => {
    const r = rig();
    place(r, { x: 5, y: 5 }, 'up', 2);
    r.g.snake = [
      { x: 5, y: 5 },
      { x: 5, y: 6 },
      { x: 6, y: 6 },
      { x: 6, y: 5 },
    ];
    r.g.turns.force('up');
    r.g.turns.push('right');
    r.g.stepProgress = 0.999;
    step(r.h, 1);
    expect(r.g.lives).toBe(3);
    expect(r.g.snake[0]).toEqual({ x: 6, y: 5 });
  });

  it('pickups count coins and nothing else', () => {
    const r = rig();
    place(r, { x: 10, y: 9 }, 'right');
    r.g.food.setPosition(11, 9);
    r.g.spawnCoin();
    r.g.coins[0].x = 12;
    r.g.coins[0].y = 9;
    headPath(r, 2);
    expect(r.g.foodEaten).toBe(1);
    expect(r.g.pickups).toBe(1);
  });
});

// -------------------------------------------------------- lifecycle ----

describe('run lifecycle', () => {
  it('opens on READY and starts on the first turn, a tap, or after 2s', () => {
    const a = rig();
    expect(a.g.gameState).toBe('ready');
    tap(a, 'ArrowDown');
    expect(a.g.gameState).toBe('playing');

    const b = rig();
    b.touches.push({ id: 1, x: 300, y: 300 });
    step(b.h, 1);
    expect(b.g.gameState).toBe('playing');

    const c = rig();
    step(c.h, 110);
    expect(c.g.gameState).toBe('ready');
    step(c.h, 15);
    expect(c.g.gameState).toBe('playing');
  });

  it('does not call endGame until the death beat has run', () => {
    const r = rig();
    const end = jest.spyOn(r.g, 'endGame');
    place(r, { x: COLS - 1, y: 5 }, 'right', 12);
    r.g.lives = 1;
    r.g.score = 50;
    r.g.stepProgress = 0.999;
    step(r.h, 1);
    expect(r.g.gameState).toBe('dying');
    step(r.h, 60);
    expect(end).not.toHaveBeenCalled();
    expect(r.h.game.isGameOver?.()).toBe(false);
    step(r.h, 60);
    expect(end).toHaveBeenCalledTimes(1);
    expect(r.h.game.isGameOver?.()).toBe(true);
    // The ended frame draws, statically.
    expect(() => r.h.game.render(r.h.ctx)).not.toThrow();
    // Achievements and saved bests read these keys; they must not move.
    expect(r.g.extendedGameData).toMatchObject({
      snake_length: 12,
      livesRemaining: 0,
    });
    for (const k of [
      'final_speed',
      'food_eaten',
      'max_length',
      'powerupsUsed',
      'powerupTypesUsed',
      'maxCombo',
    ]) {
      expect(r.g.extendedGameData).toHaveProperty(k);
    }
    const stat = r.h.services.analytics.trackGameSpecificStat as jest.Mock;
    expect(stat.mock.calls.map(c => c[1]).sort()).toEqual([
      'food_eaten',
      'max_combo',
      'snake_length',
    ]);
    expect(localStorage.getItem('snake_best')).toBe('50');
  });

  it('restart returns to READY with three lives and a fresh board', () => {
    const r = rig();
    place(r, { x: 10, y: 9 }, 'right', 9);
    for (let i = 0; i < 8; i++) r.g.eatFood();
    r.g.spawnCoin();
    r.g.spawnPowerUp();
    power(r.g, 'slow', 5);
    r.g.score = 777;
    r.g.pickups = 4;
    r.g.lives = 1;
    r.g.comboSystem.addHit();
    step(r.h, 20);

    r.h.game.restart?.();
    expect(r.g.gameState).toBe('ready');
    expect(r.g.lives).toBe(3);
    expect(r.g.snake).toHaveLength(3);
    expect(r.g.score).toBe(0);
    expect(r.g.pickups).toBe(0);
    expect(r.g.foodEaten).toBe(0);
    expect(r.g.paceTier).toBe(0);
    expect(r.g.coins).toHaveLength(0);
    expect(r.g.powerUps).toHaveLength(0);
    expect(r.g.activePowerUps).toHaveLength(0);
    expect(r.g.morsels).toHaveLength(0);
    expect(r.g.comboSystem.getCombo()).toBe(0);
    expect(r.g.turns.heading).toBe('right');
    expect(r.g.extendedGameData).toBeNull();
    expect(r.h.game.isGameOver?.()).toBe(false);
  });
});
