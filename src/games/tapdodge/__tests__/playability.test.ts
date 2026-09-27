// Can Tap Dodge actually be played at full speed?
//
// The pattern tests prove each row rule in isolation. This one proves they
// add up: a reflex bot that reads ONLY the nearest row of hazards — no
// foresight, no memory — and steps toward the nearest safe lane (or jumps /
// ducks a laser just before it arrives) must fly 90 seconds at the top speed
// without a single hit, on every one of ten seeds. It has human limits: it
// reacts 0.22s after a row becomes the nearest, and presses at most about
// seven keys a second. It drives the real keyboard path (edges through
// PressTracker), so it gets exactly the control a player gets.
//
// Those limits are what make the two-hop rule matter. Checked by mutation:
// let a wall's gap land anywhere (ignoring the two-hop rule) and this bot
// fails ten of these thirteen tests; with the rule, it passes all of them.
//
// Before the rewrite this could not pass: rows were independent die rolls,
// walls and lasers stacked, and drifters wandered across two lanes, so some
// frames simply had no safe lane.

import { TapDodgeGame } from '../TapDodgeGame';
import type { Obstacle } from '../entities/Obstacle';
import type { Player } from '../entities/Player';
import type { PowerUp } from '../entities/PowerUp';
import type { Progression } from '../systems/Progression';
import { SPEED_CAP } from '../systems/Progression';
import { mulberry32 } from '../systems/layout';
import { initGame, Harness } from '@/games/shared/gameTestHarness';

interface Internals {
  gameState: string;
  lives: number;
  runTime: number;
  player: Player;
  obstacles: Obstacle[];
  powerUps: PowerUp[];
  progression: Progression;
}

interface Rig {
  h: Harness;
  g: Internals;
  keys: Set<string>;
}

let restoreRandom: (() => void) | null = null;

afterEach(() => {
  restoreRandom?.();
  restoreRandom = null;
});

function rig(seed: number): Rig {
  const spy = jest.spyOn(Math, 'random').mockImplementation(mulberry32(seed));
  restoreRandom = () => spy.mockRestore();
  const h = initGame(new TapDodgeGame());
  const g = h.game as unknown as Internals;
  const keys = new Set<string>();
  (h.services.input.isKeyPressed as jest.Mock).mockImplementation(
    (code: string) => keys.has(code)
  );
  // Let the READY card settle, then start the run with a key.
  for (let i = 0; i < 20; i++) h.game.update(1 / 60);
  keys.add('Space');
  h.game.update(1 / 60);
  keys.clear();
  h.game.update(1 / 60);
  expect(g.gameState).toBe('play');
  return { h, g, keys };
}

/** Seconds between seeing a new row and the first key going down. */
const REACTION = 0.22;
/** About seven key presses a second: an ordinary human, not a machine. */
const PRESS_GAP = 0.14;

interface Bot {
  plannedRow: number;
  queue: Array<{ at: number; key: string }>;
  lastPress: number;
  time: number;
}

/**
 * One frame of reflexes, reading only the nearest row. A lane change is
 * planned once per row, the moment that row becomes the nearest one, and
 * its presses go out after REACTION and PRESS_GAP apart. A laser is timed
 * off its approach. Keys are held a single frame, so every press is a
 * fresh edge.
 */
function reflex(g: Internals, keys: Set<string>, bot: Bot, dt: number): void {
  bot.time += dt;
  keys.clear();

  const ship = g.player.hitbox();
  const shipBottom = ship.y + ship.h;
  const rows = new Map<number, Obstacle[]>();
  for (const o of g.obstacles) {
    if (o.destroyed || o.passed) continue;
    const b = o.hitbox();
    if (b.y > shipBottom) continue;
    const list = rows.get(o.rowId) ?? [];
    list.push(o);
    rows.set(o.rowId, list);
  }
  let nearest: Obstacle[] | null = null;
  let nearestId = -1;
  let nearestFront = -Infinity;
  for (const [id, list] of rows) {
    const front = Math.max(...list.map(o => o.hitbox().y + o.hitbox().h));
    if (front > nearestFront) {
      nearestFront = front;
      nearest = list;
      nearestId = id;
    }
  }

  if (nearest && nearestId !== bot.plannedRow) {
    const laser = nearest.find(o => o.kind === 'laser');
    if (laser) {
      const lead = (ship.y - nearestFront) / g.progression.speed();
      if (lead <= 0.14 && g.player.canDodge()) {
        bot.plannedRow = nearestId;
        bot.queue.push({
          at: bot.time,
          key: laser.band === 'high' ? 'ArrowDown' : 'ArrowUp',
        });
      }
    } else {
      bot.plannedRow = nearestId;
      const blocked = new Set(nearest.map(o => o.lane));
      const from = g.player.lane;
      let target = from;
      for (let d = 0; d <= 4; d++) {
        const options = [from - d, from + d].filter(
          l => l >= 0 && l <= 4 && !blocked.has(l)
        );
        if (options.length > 0) {
          // Tie: lean toward the middle of the road.
          options.sort((a, b) => Math.abs(a - 2) - Math.abs(b - 2));
          target = options[0];
          break;
        }
      }
      const key = target < from ? 'ArrowLeft' : 'ArrowRight';
      for (let k = 0; k < Math.abs(target - from); k++) {
        bot.queue.push({ at: bot.time + REACTION + k * PRESS_GAP, key });
      }
    }
  }

  const next = bot.queue[0];
  if (
    next &&
    next.at <= bot.time + 1e-9 &&
    bot.time - bot.lastPress >= PRESS_GAP - 1e-9
  ) {
    keys.add(next.key);
    bot.queue.shift();
    bot.lastPress = bot.time;
  }
}

function fly(r: Rig, seconds: number, dt = 1 / 60): void {
  const bot: Bot = { plannedRow: -1, queue: [], lastPress: -1, time: 0 };
  const frames = Math.round(seconds / dt);
  for (let i = 0; i < frames && r.g.gameState === 'play'; i++) {
    r.g.powerUps = []; // no shields or ghosts to hide an unfair row
    reflex(r.g, r.keys, bot, dt);
    r.h.game.update(dt);
  }
}

describe('a reflex bot at the top speed', () => {
  const seeds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  it.each(seeds)('flies 90s clean on seed %i', seed => {
    const r = rig(seed);
    r.g.progression.worldTime = 240; // the speed cap
    fly(r, 90);

    expect(r.g.progression.speedFactor()).toBeGreaterThanOrEqual(SPEED_CAP);
    expect(r.g.gameState).toBe('play');
    expect(r.g.lives).toBe(3);
    expect(r.g.runTime).toBeGreaterThanOrEqual(89.9);
  });

  it('survives at the loop clamp (dt = 0.05) too', () => {
    const r = rig(11);
    r.g.progression.worldTime = 240;
    fly(r, 60, 0.05);
    expect(r.g.gameState).toBe('play');
    expect(r.g.lives).toBe(3);
  });
});

describe('a whole run', () => {
  it('carries the bot from the first row through three minutes', () => {
    const r = rig(42);
    fly(r, 180);
    expect(r.g.gameState).toBe('play');
    expect(r.g.progression.zoneIndex).toBe(3);
    expect(r.g.progression.rushesCleared).toBeGreaterThanOrEqual(2);
  });

  it('is not a walkover — doing nothing ends the run, but not at once', () => {
    const r = rig(7);
    let frames = 0;
    for (; frames < 60 * 180 && r.g.gameState === 'play'; frames++) {
      r.h.game.update(1 / 60);
    }
    expect(r.g.gameState).not.toBe('play');
    // An instant death would mean the opening rows were unavoidable.
    expect(r.g.runTime).toBeGreaterThan(4);
  });
});
