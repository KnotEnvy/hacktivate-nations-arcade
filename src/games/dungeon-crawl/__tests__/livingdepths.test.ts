// Wave N tests: THE LIVING DEPTHS — reaction & morale. Pins the morale FLAG
// contract (which archetypes can break, and that no undead/mindless/mimic
// ever carries it), the pure moraleBreakChance law, the flight behavior on a
// lone Enemy, and the killEnemy sweep + foes_routed metric through the live
// game. The rest/wandering half rides on top of this in a later wave.

import { REST } from '@/games/dungeon-crawl/data/constants';
import {
  ENEMY_CONFIGS,
  EnemyTypeId,
  MORALE,
  moraleBreakChance,
  spawnWeightsForFloor,
} from '@/games/dungeon-crawl/data/enemies';
import { QUESTS } from '@/games/dungeon-crawl/data/quests';
import type { Room } from '@/games/dungeon-crawl/dungeon/DungeonGenerator';
import { Rng } from '@/games/dungeon-crawl/dungeon/rng';
import type { TileMap } from '@/games/dungeon-crawl/dungeon/TileMap';
import { DungeonCrawlGame } from '@/games/dungeon-crawl/DungeonCrawlGame';
import { Enemy, type EnemyUpdateContext } from '@/games/dungeon-crawl/entities/Enemy';
import { pickWanderType, wanderChance, wanderSpawnSpot } from '@/games/dungeon-crawl/systems/Rest';
import { initGame, type Harness } from '@/games/shared/gameTestHarness';

let randomSpy: jest.SpyInstance;
beforeEach(() => {
  randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.42);
});
afterEach(() => {
  randomSpy.mockRestore();
});

const ALL_IDS = Object.keys(ENEMY_CONFIGS) as EnemyTypeId[];

/** The exact set the design locks morale onto (living, pack-minded types). */
const FLAGGED: EnemyTypeId[] = [
  'bat',
  'sorcerer',
  'knight',
  'bomber',
  'fire-beetle',
  'lizardman',
  'cinder-hound',
  'salamander',
  'gargoyle',
];

/** A frictionless map + context so a lone Enemy's flight can be simulated. */
function fleeCtx(playerX: number, playerY: number, fireBolt?: jest.Mock): EnemyUpdateContext {
  const map = {
    moveWithCollision: (x: number, y: number, _size: number, dx: number, dy: number) => ({
      x: x + dx,
      y: y + dy,
      hitX: false,
      hitY: false,
    }),
    hasLineOfSight: () => true,
  } as unknown as TileMap;
  return {
    playerX,
    playerY,
    map,
    rng: new Rng(7),
    fireBolt: fireBolt ?? (() => {}),
    throwBomb: () => {},
    onMimicWake: () => {},
  };
}

// -------------------------------------------------------------- flag contract

describe('the morale flag contract', () => {
  test('exactly the living pack-minded types carry the flag', () => {
    const flagged = ALL_IDS.filter(id => ENEMY_CONFIGS[id].morale);
    expect(new Set(flagged)).toEqual(new Set(FLAGGED));
  });

  test('no flagged foe is undead, mindless or an ambusher', () => {
    for (const id of FLAGGED) {
      const config = ENEMY_CONFIGS[id];
      expect(config.morale).toBe(true);
      expect(config.undead).toBeFalsy(); // the dead have no nerve to lose
      expect(config.behavior).not.toBe('mimic'); // an ambusher does not break
      expect(config.splitsInto).toBeUndefined(); // the mindless (splitters) never break
      expect(id).not.toMatch(/-mini$/); // nor split-spawn minis
    }
  });

  test('no undead config carries morale (checked by loop, not by hand)', () => {
    for (const id of ALL_IDS) {
      if (ENEMY_CONFIGS[id].undead) expect(ENEMY_CONFIGS[id].morale).toBeFalsy();
    }
  });
});

// -------------------------------------------------------------- the pure law

describe('moraleBreakChance', () => {
  test('base value when the pack is healthy and matched to the floor', () => {
    // hero level == floor (no overmatch), pack at full strength (no below-half).
    expect(moraleBreakChance(3, 3, 10, 10)).toBeCloseTo(MORALE.BASE_CHANCE);
  });

  test('the below-half bonus applies below the boundary and not at it', () => {
    // baseline/2 = 5: alive 5 holds, alive 4 breaks more readily.
    expect(moraleBreakChance(1, 1, 5, 10)).toBeCloseTo(MORALE.BASE_CHANCE);
    expect(moraleBreakChance(1, 1, 4, 10)).toBeCloseTo(MORALE.BASE_CHANCE + MORALE.BELOW_HALF_BONUS);
    // A non-positive baseline is guarded: no below-strength bonus.
    expect(moraleBreakChance(1, 1, 0, 0)).toBeCloseTo(MORALE.BASE_CHANCE);
  });

  test('the hero-level bonus scales above the floor and floors at zero', () => {
    expect(moraleBreakChance(5, 2, 10, 10)).toBeCloseTo(
      MORALE.BASE_CHANCE + 3 * MORALE.HERO_LEVEL_BONUS,
    );
    // Under-levelled for the floor never lowers the odds below base.
    expect(moraleBreakChance(1, 5, 10, 10)).toBeCloseTo(MORALE.BASE_CHANCE);
  });

  test('the cap holds even for an over-levelled hero routing a broken pack', () => {
    expect(moraleBreakChance(100, 1, 1, 10)).toBe(MORALE.CHANCE_CAP);
  });
});

// -------------------------------------------------------------- the flight

describe('a routed foe in flight', () => {
  test('breakAndFlee arms the flight and reports the first break only', () => {
    const bat = new Enemy('bat', 0, 0);
    expect(bat.breakAndFlee()).toBe(true);
    expect(bat.fleeTimer).toBeCloseTo(MORALE.FLEE_TIME);
    expect(bat.breakAndFlee()).toBe(false); // same foe, later sweep — counted once
  });

  test('it runs AWAY: distance from the player grows over the flight', () => {
    const bat = new Enemy('bat', 0, 0);
    bat.breakAndFlee();
    const ctx = fleeCtx(1000, 0); // player far to the +x
    const before = Math.hypot(bat.x - 1000, bat.y);
    for (let i = 0; i < 40; i++) bat.update(1 / 60, ctx);
    const after = Math.hypot(bat.x - 1000, bat.y);
    expect(after).toBeGreaterThan(before);
  });

  test('a fleeing ranged foe holds its fire entirely', () => {
    const fire = jest.fn();
    const sorcerer = new Enemy('sorcerer', 0, 0);
    sorcerer.aggro = true; // it would fire if it were not routed
    sorcerer.breakAndFlee();
    const ctx = fleeCtx(120, 0, fire); // player inside its firing band
    for (let i = 0; i < 120; i++) sorcerer.update(1 / 60, ctx); // 2s < FLEE_TIME
    expect(fire).not.toHaveBeenCalled();
  });

  test('after the flight it STEADIES: fleeTimer zero, aggro dropped', () => {
    const bat = new Enemy('bat', 0, 0);
    bat.breakAndFlee();
    const ctx = fleeCtx(5000, 0); // player far enough it cannot re-acquire
    for (let i = 0; i < 260; i++) bat.update(1 / 60, ctx); // > FLEE_TIME
    expect(bat.fleeTimer).toBe(0);
    expect(bat.aggro).toBe(false);
  });
});

// -------------------------------------------------------------- through the game

interface GameInternals {
  departOnQuest(quest: (typeof QUESTS)[keyof typeof QUESTS]): void;
  state: string;
  floor: number;
  player: { x: number; y: number; size: number; hp: number; maxHp: number };
  rng: { next(): number; int(min: number, max: number): number };
  enemies: Enemy[];
  pickupItems: { kind: string }[];
  hazards: unknown[];
  biome: { id: string };
  plan: { stairsTile: { tx: number; ty: number }; rooms: unknown[] };
  map: {
    tileAtWorld(x: number, y: number): { tx: number; ty: number };
    tileCenter(tx: number, ty: number): { x: number; y: number };
  };
  combat: { killEnemy(enemy: Enemy): void };
  rest: { prompt(): { text: string; ok: boolean } | null };
  spawnWanderingPack(): void;
  damagePlayer(amount: number, cause: string): void;
}

function internals(h: Harness): GameInternals {
  return h.game as unknown as GameInternals;
}

function metrics(h: Harness): Record<string, number> {
  return h.game.getScore!() as unknown as Record<string, number>;
}

function wireHeldKeys(h: Harness): Set<string> {
  const held = new Set<string>();
  const input = h.services.input as unknown as {
    isKeyPressed: jest.Mock;
    isLeftPressed: jest.Mock;
    isRightPressed: jest.Mock;
    isUpPressed: jest.Mock;
    isDownPressed: jest.Mock;
  };
  input.isKeyPressed.mockImplementation((code: string) => held.has(code));
  input.isLeftPressed.mockImplementation(() => held.has('ArrowLeft'));
  input.isRightPressed.mockImplementation(() => held.has('ArrowRight'));
  input.isUpPressed.mockImplementation(() => held.has('ArrowUp'));
  input.isDownPressed.mockImplementation(() => held.has('ArrowDown'));
  return held;
}

/** Turn the title page, pick a class by digit, forge a HUMAN — Lastlight. */
function startWithClass(h: Harness, digit: string): Set<string> {
  const held = wireHeldKeys(h);
  held.add('Space');
  h.game.update(1 / 60);
  held.clear();
  h.game.update(1 / 60);
  held.add(digit);
  h.game.update(1 / 60);
  held.clear();
  h.game.update(1 / 60);
  held.add('Digit1');
  h.game.update(1 / 60);
  held.clear();
  h.game.update(1 / 60);
  return held;
}

/** Through the gate onto floor 1: depart, sit out the DM lockout, dismiss. */
function enterDepths(h: Harness, held: Set<string>): GameInternals {
  const game = internals(h);
  game.departOnQuest(QUESTS.endless);
  for (let i = 0; i < 70; i++) h.game.update(1 / 60);
  held.add('Space');
  h.game.update(1 / 60);
  held.clear();
  h.game.update(1 / 60);
  expect(game.state).toBe('playing');
  return game;
}

/** Replace the live pack with a hand-placed one. */
function stage(game: GameInternals, foes: Enemy[]): void {
  game.enemies.length = 0;
  game.enemies.push(...foes);
}

describe('the morale sweep through the live game', () => {
  test('the metric key exists from the first frame', () => {
    const h = initGame(new DungeonCrawlGame());
    expect(metrics(h)).toHaveProperty('foes_routed', 0);
  });

  test('a kill routs a nearby flagged foe under a forced roll', () => {
    const h = initGame(new DungeonCrawlGame());
    const held = startWithClass(h, 'Digit1'); // fighter
    const game = enterDepths(h, held);

    const { x: px, y: py } = game.player;
    const victim = new Enemy('slime', px, py);
    const bat = new Enemy('bat', px + 20, py); // flagged, non-elite
    stage(game, [victim, bat]);

    game.rng.next = () => 0; // every roll breaks
    game.combat.killEnemy(victim);
    expect(bat.fleeTimer).toBeGreaterThan(0);

    h.game.update(1 / 60); // syncExtendedData rebuilds the metric
    expect(metrics(h).foes_routed).toBe(1);
  });

  test('elites never break', () => {
    const h = initGame(new DungeonCrawlGame());
    const held = startWithClass(h, 'Digit1');
    const game = enterDepths(h, held);

    const { x: px, y: py } = game.player;
    const victim = new Enemy('slime', px, py);
    const elite = new Enemy('bat', px + 20, py, 'frenzied'); // flagged BUT elite
    stage(game, [victim, elite]);

    game.rng.next = () => 0;
    game.combat.killEnemy(victim);
    expect(elite.fleeTimer).toBe(0);
    h.game.update(1 / 60);
    expect(metrics(h).foes_routed).toBe(0);
  });

  test('the undead hold the line', () => {
    const h = initGame(new DungeonCrawlGame());
    const held = startWithClass(h, 'Digit1');
    const game = enterDepths(h, held);

    const { x: px, y: py } = game.player;
    const victim = new Enemy('slime', px, py);
    const skeleton = new Enemy('skeleton', px + 20, py); // undead — no flag
    stage(game, [victim, skeleton]);

    game.rng.next = () => 0;
    game.combat.killEnemy(victim);
    expect(skeleton.fleeTimer).toBe(0);
    h.game.update(1 / 60);
    expect(metrics(h).foes_routed).toBe(0);
  });

  test('foes_routed counts a foe once even when it breaks twice', () => {
    const h = initGame(new DungeonCrawlGame());
    const held = startWithClass(h, 'Digit1');
    const game = enterDepths(h, held);

    const { x: px, y: py } = game.player;
    const bat = new Enemy('bat', px + 20, py);
    const first = new Enemy('slime', px, py);
    const second = new Enemy('slime', px, py);
    stage(game, [bat, first, second]);

    game.rng.next = () => 0;
    game.combat.killEnemy(first);
    h.game.update(1 / 60);
    expect(metrics(h).foes_routed).toBe(1);

    // A second body rattles the same bat — it breaks again but is not re-counted.
    game.combat.killEnemy(second);
    h.game.update(1 / 60);
    expect(metrics(h).foes_routed).toBe(1);
  });
});

// =========================================================== REST & WANDERING

/** World center of the descent tile. */
function stairsCenter(game: GameInternals): { x: number; y: number } {
  return game.map.tileCenter(game.plan.stairsTile.tx, game.plan.stairsTile.ty);
}

/** Cleared floor, hero beside the stairs (off the descent tile), a little hurt. */
function makeCampReady(game: GameInternals): { x: number; y: number } {
  game.enemies.length = 0;
  game.hazards.length = 0;
  const c = stairsCenter(game);
  game.player.x = c.x + 20; // within STAIRS_RADIUS, one tile off the stairs
  game.player.y = c.y;
  game.player.hp = game.player.maxHp - 5;
  return c;
}

/** Press E for one frame, then settle the edge (the thief-test cadence). */
function tapE(h: Harness, held: Set<string>): void {
  held.add('KeyE');
  h.game.update(1 / 60);
  held.clear();
  h.game.update(1 / 60);
}

describe('the stairs camp gate', () => {
  test('a live pack blocks the fire; a cleared floor offers it', () => {
    const h = initGame(new DungeonCrawlGame());
    const held = startWithClass(h, 'Digit1');
    const game = enterDepths(h, held);
    const c = stairsCenter(game);
    game.player.x = c.x + 20;
    game.player.y = c.y;
    game.player.hp = game.player.maxHp - 5;

    expect(game.rest.prompt()).toBeNull(); // the seeded pack still stands

    game.enemies.length = 0;
    expect(game.rest.prompt()?.text).toContain('MAKE CAMP');
  });

  test('a dormant mimic is furniture — it does not block the fire', () => {
    const h = initGame(new DungeonCrawlGame());
    const held = startWithClass(h, 'Digit1');
    const game = enterDepths(h, held);
    const c = makeCampReady(game);
    game.enemies.push(new Enemy('mimic', c.x + 200, c.y)); // dormant by construction
    expect(game.rest.prompt()?.text).toContain('MAKE CAMP');
  });

  test('standing ON the stairs tile descends, so no camp is offered there', () => {
    const h = initGame(new DungeonCrawlGame());
    const held = startWithClass(h, 'Digit1');
    const game = enterDepths(h, held);
    makeCampReady(game);
    const c = stairsCenter(game);
    game.player.x = c.x; // dead on the descent tile
    game.player.y = c.y;
    expect(game.rest.prompt()).toBeNull();
  });

  test('a hale hero has nothing to rest off', () => {
    const h = initGame(new DungeonCrawlGame());
    const held = startWithClass(h, 'Digit1');
    const game = enterDepths(h, held);
    makeCampReady(game);
    game.player.hp = game.player.maxHp; // untouched
    expect(game.rest.prompt()).toBeNull();
  });
});

describe('the stairs camp through the live game', () => {
  test('camp heals down the canonical path, clamps at the cap, and ends by itself', () => {
    const h = initGame(new DungeonCrawlGame());
    const held = startWithClass(h, 'Digit1');
    const game = enterDepths(h, held);
    makeCampReady(game);
    game.player.maxHp = 20; // a known pool, immune to the CON roll
    game.player.hp = 2;
    game.rng.next = () => 0.99; // the heal rolls high; the wander die (<= cap) never answers

    tapE(h, held);

    // The fire heals the hero over time and the pool NEVER overfills (the
    // canonical clamp — Combat.healPlayer shows only the true gain).
    let healed = false;
    for (let i = 0; i < 1200; i++) {
      h.game.update(1 / 60);
      expect(game.player.hp).toBeLessThanOrEqual(20);
      if (game.player.hp > 2) healed = true;
    }
    expect(healed).toBe(true);
    expect(game.player.hp).toBe(20); // filled to the brim...
    expect(game.rest.prompt()).toBeNull(); // ...and the fire died on its own
  });

  test('a step abandons the fire', () => {
    const h = initGame(new DungeonCrawlGame());
    const held = startWithClass(h, 'Digit1');
    const game = enterDepths(h, held);
    makeCampReady(game);
    game.player.maxHp = 100; // deep pool: the fire can't fill it while we test
    game.player.hp = 40;
    game.rng.next = () => 0.99; // the wander die never answers

    tapE(h, held);
    expect(game.rest.prompt()?.text).toContain('RESTING');

    held.add('ArrowRight');
    h.game.update(1 / 60);
    held.clear();
    expect(game.rest.prompt()?.text).toContain('MAKE CAMP'); // the step broke it
  });

  test('a wound that lands breaks the fire', () => {
    const h = initGame(new DungeonCrawlGame());
    const held = startWithClass(h, 'Digit1');
    const game = enterDepths(h, held);
    makeCampReady(game);
    game.player.maxHp = 100;
    game.player.hp = 40;
    game.rng.next = () => 0.99;

    tapE(h, held);
    expect(game.rest.prompt()?.text).toContain('RESTING');

    const before = game.player.hp;
    game.damagePlayer(5, 'slime'); // the single funnel
    expect(game.player.hp).toBeLessThan(before);
    expect(game.rest.prompt()?.text).toContain('MAKE CAMP'); // the blow broke it
  });
});

/** A frictionless map for the placement helper: room centers land on tile
 *  grid points and every "open spot near" is the point itself. */
const flatMap = {
  tileCenter: (tx: number, ty: number) => ({ x: tx * 32, y: ty * 32 }),
  findOpenSpotNear: (x: number, y: number) => ({ x, y }),
} as unknown as TileMap;

const roomAt = (tx: number, ty: number): Room => ({ tx, ty, w: 2, h: 2, kind: 'normal' });

describe('wandering monsters', () => {
  test('a pack arrives at once: one type, aggro, wandering, never a mimic', () => {
    const h = initGame(new DungeonCrawlGame());
    const held = startWithClass(h, 'Digit1');
    const game = enterDepths(h, held);
    game.enemies.length = 0;

    game.spawnWanderingPack();

    expect(game.enemies.length).toBeGreaterThanOrEqual(REST.PACK_MIN);
    expect(game.enemies.length).toBeLessThanOrEqual(REST.PACK_MAX);
    expect(new Set(game.enemies.map(e => e.config.id)).size).toBe(1);
    for (const foe of game.enemies) {
      expect(foe.config.behavior).not.toBe('mimic');
      expect(foe.aggro).toBe(true);
      expect(foe.wandering).toBe(true);
    }
  });

  test('placement keeps its distance when a far room exists', () => {
    // The lone room centers well past SPAWN_MIN_DIST — the hunt arrives from afar.
    const spot = wanderSpawnSpot(new Rng(1), [roomAt(30, 30)], flatMap, 0, 0);
    expect(Math.hypot(spot.x, spot.y)).toBeGreaterThanOrEqual(REST.SPAWN_MIN_DIST);
  });

  test('placement falls back to the farthest room when all are close', () => {
    // One near room (center 96, 32): under SPAWN_MIN_DIST, so the fallback takes
    // the farthest candidate found — never the player's own square.
    const spot = wanderSpawnSpot(new Rng(5), [roomAt(2, 0)], flatMap, 0, 0);
    expect(spot).toEqual({ x: 96, y: 32 });
    expect(Math.hypot(spot.x, spot.y)).toBeLessThan(REST.SPAWN_MIN_DIST);
  });

  test('the degenerate zero-rooms case falls back to the player anchor', () => {
    // Unreachable in real play (a floor always has >= 1 room) — this only pins
    // the guard so the helper can never index an empty room list.
    const spot = wanderSpawnSpot(new Rng(1), [], flatMap, 40, 50);
    expect(spot).toEqual({ x: 40, y: 50 });
  });

  test('a wander roll spawns the hunt and breaks the fire', () => {
    const h = initGame(new DungeonCrawlGame());
    const held = startWithClass(h, 'Digit1');
    const game = enterDepths(h, held);
    makeCampReady(game);
    game.player.maxHp = 100; // deep pool: only the dark can end this camp
    game.player.hp = 40;
    game.rng.next = () => 0.99; // keep the dark quiet while we light the fire

    tapE(h, held);
    expect(game.rest.prompt()?.text).toContain('RESTING');

    game.rng.next = () => 0; // now a heal tick, then the dark answers (0 < WANDER_BASE)
    for (let i = 0; i < 200; i++) h.game.update(1 / 60);

    expect(game.enemies.length).toBeGreaterThan(0); // the hunt is here
    expect(game.enemies.every(e => e.wandering)).toBe(true);
    expect(game.rest.prompt()).toBeNull(); // camp broken + floor no longer cleared
  });

  test('a wandering foe drops no gold but still counts among the slain', () => {
    const h = initGame(new DungeonCrawlGame());
    const held = startWithClass(h, 'Digit1');
    const game = enterDepths(h, held);
    h.game.update(1 / 60);
    const slainBefore = metrics(h).enemies_slain;

    game.pickupItems.length = 0;
    const foe = new Enemy('knight', game.player.x, game.player.y); // goldDrop [2, 4]
    foe.wandering = true;
    stage(game, [foe]);

    game.rng.next = () => 0; // a lair-bound knight would scatter gold on this roll
    game.combat.killEnemy(foe);

    expect(game.pickupItems.filter(p => p.kind === 'gold')).toHaveLength(0);
    h.game.update(1 / 60);
    expect(metrics(h).enemies_slain).toBe(slainBefore + 1);
  });

  test('a wandering foe still has nerves — it can rout', () => {
    const bat = new Enemy('bat', 0, 0);
    bat.wandering = true;
    expect(bat.breakAndFlee()).toBe(true);
    expect(bat.fleeTimer).toBeGreaterThan(0);
  });

  test('the wander die climbs each tick and holds at the cap', () => {
    expect(wanderChance(0)).toBeCloseTo(REST.WANDER_BASE);
    expect(wanderChance(1)).toBeCloseTo(REST.WANDER_BASE + REST.WANDER_RAMP);
    expect(wanderChance(2)).toBeGreaterThan(wanderChance(1));
    expect(wanderChance(1000)).toBe(REST.WANDER_CAP);
  });

  test('a wandering neighbor rides the same morale sweep (no wandering exclusion)', () => {
    const h = initGame(new DungeonCrawlGame());
    const held = startWithClass(h, 'Digit1');
    const game = enterDepths(h, held);

    const { x: px, y: py } = game.player;
    const victim = new Enemy('slime', px, py);
    const bat = new Enemy('bat', px + 20, py); // flagged, non-elite
    bat.wandering = true; // a wandering pack breaks for free on the same sweep
    stage(game, [victim, bat]);

    game.rng.next = () => 0; // every roll breaks
    game.combat.killEnemy(victim);
    expect(bat.fleeTimer).toBeGreaterThan(0);

    h.game.update(1 / 60);
    expect(metrics(h).foes_routed).toBe(1);
  });

  test('spawnWanderingPack places the pack far from the live player', () => {
    const h = initGame(new DungeonCrawlGame());
    const held = startWithClass(h, 'Digit1');
    const game = enterDepths(h, held);
    game.enemies.length = 0;
    // Park the hero near one corner; the only room sits in the far opposite one.
    game.player.x = 3 * 32;
    game.player.y = 3 * 32;
    game.plan.rooms = [roomAt(34, 24)]; // center well past SPAWN_MIN_DIST from the hero

    game.spawnWanderingPack();

    const { x: px, y: py } = game.player;
    expect(game.enemies.length).toBeGreaterThan(0);
    for (const foe of game.enemies) {
      expect(Math.hypot(foe.x - px, foe.y - py)).toBeGreaterThanOrEqual(REST.SPAWN_MIN_DIST);
    }
  });

  test('a wandering splitter passes the flag to its minis (they stay goldless)', () => {
    const h = initGame(new DungeonCrawlGame());
    const held = startWithClass(h, 'Digit1');
    const game = enterDepths(h, held);
    const slime = new Enemy('slime', game.player.x, game.player.y);
    slime.wandering = true;
    stage(game, [slime]);

    game.rng.next = () => 0;
    game.combat.killEnemy(slime);

    const minis = game.enemies.filter(e => e.config.id === 'slime-mini');
    expect(minis.length).toBeGreaterThan(0);
    expect(minis.every(e => e.wandering)).toBe(true);
  });

  test('pickWanderType never draws the ambusher — the mimic row is filtered out', () => {
    // Floor 8: the mimic's ambient weight is LIVE, so only the filter keeps it out.
    const rows = spawnWeightsForFloor(8, 'ember').filter(r => r.weight > 0 && r.type !== 'mimic');
    expect(rows.some(r => r.type === 'mimic')).toBe(false);
    const rng = new Rng(12345);
    for (let i = 0; i < 500; i++) {
      expect(pickWanderType(rng, rows)).not.toBe('mimic');
    }
  });

  test('the dark comes, the pack falls, and the fire is offered again', () => {
    const h = initGame(new DungeonCrawlGame());
    const held = startWithClass(h, 'Digit1');
    const game = enterDepths(h, held);
    makeCampReady(game);
    game.player.maxHp = 100; // deep pool: only the dark ends this camp
    game.player.hp = 40;
    game.rng.next = () => 0.99; // quiet while the fire lights

    tapE(h, held);
    expect(game.rest.prompt()?.text).toContain('RESTING');

    game.rng.next = () => 0; // the dark answers on the next tick
    for (let i = 0; i < 200; i++) h.game.update(1 / 60);
    expect(game.enemies.length).toBeGreaterThan(0); // the hunt arrived...
    expect(game.rest.prompt()).toBeNull(); // ...and re-blocked the camp

    // Cut the pack down: the floor clears and the fire is offered once more.
    for (const foe of game.enemies) foe.alive = false;
    h.game.update(1 / 60); // updateEnemies compacts the dead away
    expect(game.rest.prompt()?.text).toContain('MAKE CAMP');
  });
});

describe('routed flight — facing and held fire', () => {
  test('a routed knight shows its back: the frontal block drops', () => {
    const knight = new Enemy('knight', 0, 0);
    knight.aggro = true;
    const ctx = fleeCtx(1000, 0); // player far to the +x
    knight.update(1 / 60, ctx); // aggro: faces the player (+x)
    // A sword blow travels player -> knight (the -x direction) and clangs off the front.
    expect(knight.blocksFrontalHit(-1, 0)).toBe(true);

    knight.breakAndFlee();
    knight.update(1 / 60, ctx); // routed: facing flips to the flight heading (-x)
    expect(knight.blocksFrontalHit(-1, 0)).toBe(false); // its back is turned — backstabs land
  });

  test('a fleeing bomber holds its bombs across the throw interval', () => {
    const throwBomb = jest.fn();
    const bomber = new Enemy('bomber', 0, 0);
    bomber.aggro = true; // it would lob if it were not routed
    bomber.breakAndFlee();
    const map = {
      moveWithCollision: (x: number, y: number, _s: number, dx: number, dy: number) => ({
        x: x + dx,
        y: y + dy,
        hitX: false,
        hitY: false,
      }),
      hasLineOfSight: () => true,
    } as unknown as TileMap;
    const ctx: EnemyUpdateContext = {
      playerX: 120, // inside the lob band
      playerY: 0,
      map,
      rng: new Rng(7),
      fireBolt: () => {},
      throwBomb,
      onMimicWake: () => {},
    };
    // 220 frames ~= 3.67s: past the 3.0s throw interval, still inside FLEE_TIME (4s).
    for (let i = 0; i < 220; i++) bomber.update(1 / 60, ctx);
    expect(throwBomb).not.toHaveBeenCalled();
  });
});
