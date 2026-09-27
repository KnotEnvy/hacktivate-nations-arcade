// Snake: do the rules add up?
//
// The rules test pins each rule alone. These put something on the controls
// and check the rules together: a careful bot (breadth-first to the nearest
// apple or coin, never into a pocket smaller than itself) has to be able to
// climb the whole pace ladder, and doing nothing has to end the run, but not
// quickly. Every frame of every run also checks that nothing on the board
// is ever sitting under the snake.

import { SnakeGame } from '../SnakeGame';
import type { SnakeState } from '../SnakeGame';
import { initGame, Harness } from '@/games/shared/gameTestHarness';
import { COLS, ROWS } from '../constants';
import { PACE_TIERS } from '../systems/Pace';
import { DIRS, DIR_VEC, Dir, OPPOSITE, TurnQueue } from '../systems/TurnQueue';

interface Pos {
  x: number;
  y: number;
}

interface SnakeInternals {
  gameState: SnakeState;
  snake: Pos[];
  turns: TurnQueue;
  food: Pos & { isPlaced(): boolean };
  coins: Pos[];
  powerUps: Pos[];
  activePowerUps: Array<{ type: string }>;
  lives: number;
  paceTier: number;
}

const KEY: Record<Dir, string> = {
  up: 'ArrowUp',
  down: 'ArrowDown',
  left: 'ArrowLeft',
  right: 'ArrowRight',
};

function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const key = (p: Pos) => `${p.x},${p.y}`;

/** The careful bot's next direction, or null to carry on. */
function decide(g: SnakeInternals): Dir | null {
  const head = g.snake[0];
  const heading = g.turns.last();
  const wrap = g.activePowerUps.some(p => p.type === 'wrap');
  const blocked = new Set(g.snake.slice(0, -1).map(key));
  const ahead = (c: Pos, d: Dir): Pos => {
    let x = c.x + DIR_VEC[d].x;
    let y = c.y + DIR_VEC[d].y;
    if (wrap) {
      x = (x + COLS) % COLS;
      y = (y + ROWS) % ROWS;
    }
    return { x, y };
  };
  const free = (c: Pos) =>
    c.x >= 0 && c.x < COLS && c.y >= 0 && c.y < ROWS && !blocked.has(key(c));
  const room = (start: Pos): number => {
    const seen = new Set([key(start)]);
    const queue = [start];
    while (queue.length > 0 && seen.size < 400) {
      const c = queue.shift()!;
      for (const d of DIRS) {
        const n = ahead(c, d);
        if (!seen.has(key(n)) && free(n)) {
          seen.add(key(n));
          queue.push(n);
        }
      }
    }
    return seen.size;
  };

  const legal = DIRS.filter(
    d => d !== OPPOSITE[heading] && free(ahead(head, d))
  );
  if (legal.length === 0) return null;

  const targets = new Set(g.coins.map(key));
  if (g.food.isPlaced()) targets.add(key(g.food));
  let pick: Dir | null = null;
  const first = new Map<string, Dir>();
  const queue: Pos[] = [];
  for (const d of legal) {
    const n = ahead(head, d);
    if (!first.has(key(n))) {
      first.set(key(n), d);
      queue.push(n);
    }
  }
  while (queue.length > 0) {
    const c = queue.shift()!;
    if (targets.has(key(c))) {
      pick = first.get(key(c))!;
      break;
    }
    for (const d of DIRS) {
      const n = ahead(c, d);
      if (!first.has(key(n)) && free(n)) {
        first.set(key(n), first.get(key(c))!);
        queue.push(n);
      }
    }
  }
  const need = Math.min(g.snake.length + 2, 300);
  if (!pick || room(ahead(head, pick)) < need) {
    let best = -1;
    for (const d of legal) {
      const r = room(ahead(head, d));
      if (r > best) {
        best = r;
        pick = d;
      }
    }
  }
  return pick;
}

/** Nothing the snake can eat or collect is ever hidden under it. */
function expectBoardClear(g: SnakeInternals): void {
  const body = new Set(g.snake.map(key));
  if (g.food.isPlaced()) expect(body.has(key(g.food))).toBe(false);
  for (const c of g.coins) expect(body.has(key(c))).toBe(false);
  for (const p of g.powerUps) expect(body.has(key(p))).toBe(false);
}

interface RunResult {
  seconds: number;
  topPaceAt: number | null;
  livesLost: number[];
  over: boolean;
}

function run(seed: number, seconds: number, bot: boolean): RunResult {
  const realRandom = Math.random;
  Math.random = seeded(seed);
  try {
    const h: Harness = initGame(new SnakeGame());
    const held = new Set<string>();
    (h.services.input.isKeyPressed as jest.Mock).mockImplementation(
      (code: string) => held.has(code)
    );
    const g = h.game as unknown as SnakeInternals;
    const top = PACE_TIERS.length - 1;
    const result: RunResult = {
      seconds: 0,
      topPaceAt: null,
      livesLost: [],
      over: false,
    };
    let lastHead = '';
    let lives = g.lives;
    const dt = 1 / 60;
    for (let f = 0; f < seconds * 60 && !h.game.isGameOver?.(); f++) {
      held.clear();
      if (bot) {
        const moved = key(g.snake[0]) !== lastHead;
        const waiting = g.gameState === 'ready' || g.gameState === 'respawn';
        if ((g.gameState === 'playing' && moved) || (waiting && f % 20 === 5)) {
          const d = decide(g);
          if (d && (waiting || d !== g.turns.last())) held.add(KEY[d]);
        }
      }
      lastHead = key(g.snake[0]);
      h.game.update(dt);
      if (f % 30 === 0) h.game.render(h.ctx);
      result.seconds += dt;
      expectBoardClear(g);
      if (g.lives < lives) {
        result.livesLost.push(result.seconds);
        lives = g.lives;
      }
      if (result.topPaceAt === null && g.paceTier === top) {
        result.topPaceAt = result.seconds;
      }
    }
    result.over = h.game.isGameOver?.() ?? false;
    return result;
  } finally {
    Math.random = realRandom;
  }
}

describe('playability', () => {
  it('a careful bot climbs the whole pace ladder', () => {
    for (const seed of [1, 2, 3]) {
      const r = run(seed, 120, true);
      expect(r.topPaceAt).not.toBeNull();
      expect(r.over).toBe(false);
    }
  });

  it('doing nothing ends the run, but not quickly', () => {
    const r = run(4, 90, false);
    expect(r.over).toBe(true);
    expect(r.livesLost).toHaveLength(3);
    // Each life lasts at least the hit, the wait and the protected window.
    for (let i = 1; i < r.livesLost.length; i++) {
      expect(r.livesLost[i] - r.livesLost[i - 1]).toBeGreaterThan(3.5);
    }
    expect(r.seconds).toBeGreaterThan(10);
  });
});
