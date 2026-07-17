// Wave K tests: THE SPECTACLE's impact kit. Hit-stop freezes ONLY the playing
// sim (banner/view timers ride real dt and keep moving), stacked freezes cap,
// flash-lights burn down and gutter out, the floor curtain ramps off, and a
// freeze never reaches the town sim.

import { JUICE } from '@/games/dungeon-crawl/data/constants';
import { QUESTS, QuestDef } from '@/games/dungeon-crawl/data/quests';
import { DungeonCrawlGame } from '@/games/dungeon-crawl/DungeonCrawlGame';
import { Juice } from '@/games/dungeon-crawl/systems/Juice';
import { initGame, type Harness } from '@/games/shared/gameTestHarness';

let randomSpy: jest.SpyInstance;
beforeEach(() => {
  randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.42);
});
afterEach(() => {
  randomSpy.mockRestore();
});

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

interface GameInternals {
  departOnQuest(quest: QuestDef): void;
  showBanner(text: string, sub: string): void;
  state: string;
  bannerTimer: number;
  juice: Juice;
  player: { invuln: number };
  enemies: Array<{ alive: boolean }>;
  combat: { killEnemy(enemy: unknown): void };
}

function internals(h: Harness): GameInternals {
  return h.game as unknown as GameInternals;
}

/** Title page -> fighter pick -> HUMAN forge -> Lastlight (the Wave I walk). */
function walkToTown(h: Harness, held: Set<string>): void {
  held.add('Space');
  h.game.update(1 / 60);
  held.clear();
  h.game.update(1 / 60);
  held.add('Digit1');
  h.game.update(1 / 60); // pick fighter -> the bloodline page
  held.clear();
  h.game.update(1 / 60); // releasing arms the lineage digits
  held.add('Digit1');
  h.game.update(1 / 60); // forge a HUMAN -> Lastlight
  held.clear();
  h.game.update(1 / 60);
}

/** Depart the endless delve and dismiss the DM briefing onto floor 1. */
function descendToFloorOne(h: Harness, held: Set<string>): void {
  internals(h).departOnQuest(QUESTS.endless);
  for (let i = 0; i < 70; i++) h.game.update(1 / 60); // briefing lockout
  held.add('Space');
  h.game.update(1 / 60);
  held.clear();
  h.game.update(1 / 60); // settle input edges — state is 'playing'
}

describe('Juice (unit)', () => {
  test('simDt passes real dt through, zeroes it while frozen, resumes after the thaw', () => {
    const juice = new Juice();
    expect(juice.simDt(1 / 60)).toBeCloseTo(1 / 60);
    juice.hitStop(0.05);
    expect(juice.simDt(1 / 60)).toBe(0);
    juice.update(0.03); // real time drains the freeze
    expect(juice.simDt(1 / 60)).toBe(0);
    juice.update(0.03);
    expect(juice.simDt(1 / 60)).toBeCloseTo(1 / 60);
  });

  test('stacked freezes cap at HITSTOP_MAX — a crowd of kills cannot stall the game', () => {
    const juice = new Juice();
    for (let i = 0; i < 50; i++) juice.hitStop(JUICE.HITSTOP_KILL);
    juice.update(JUICE.HITSTOP_MAX + 0.001); // draining past the cap must thaw it
    expect(juice.simDt(1)).toBe(1);
  });

  test('a flash-light burns, eases down, and gutters out', () => {
    const juice = new Juice();
    juice.flashLight(100, 50, 200, 0.4);
    const lit = juice.lights();
    expect(lit).toHaveLength(1);
    expect(lit[0].x).toBe(100);
    expect(lit[0].y).toBe(50);
    const fullRadius = lit[0].radius;
    juice.update(0.2);
    expect(juice.lights()[0].radius).toBeLessThan(fullRadius);
    juice.update(0.3);
    expect(juice.lights()).toHaveLength(0);
  });

  test('the curtain drops fully dark and lifts to nothing', () => {
    const juice = new Juice();
    expect(juice.curtainAlpha()).toBe(0);
    juice.startCurtain();
    expect(juice.curtainAlpha()).toBe(1);
    juice.update(JUICE.CURTAIN_TIME / 2);
    const mid = juice.curtainAlpha();
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(1);
    juice.update(JUICE.CURTAIN_TIME);
    expect(juice.curtainAlpha()).toBe(0);
  });
});

describe('Juice (through the game)', () => {
  test('a kill through the combat path freezes the playing sim, then thaws', () => {
    const h = initGame(new DungeonCrawlGame());
    const held = wireHeldKeys(h);
    walkToTown(h, held);
    descendToFloorOne(h, held);
    const game = internals(h);
    expect(game.state).toBe('playing');

    const enemy = game.enemies.find(e => e.alive);
    expect(enemy).toBeDefined();
    game.player.invuln = 1.0; // decays only when the sim ticks
    game.combat.killEnemy(enemy!);
    h.game.update(1 / 60); // HITSTOP_KILL (45ms) freezes ~2 frames
    h.game.update(1 / 60);
    expect(game.player.invuln).toBe(1.0);
    h.game.update(1 / 60); // the freeze has drained — the sim breathes again
    expect(game.player.invuln).toBeLessThan(1.0);
  });

  test('banner timers ride REAL dt through a freeze', () => {
    const h = initGame(new DungeonCrawlGame());
    const held = wireHeldKeys(h);
    walkToTown(h, held);
    descendToFloorOne(h, held);
    const game = internals(h);

    game.juice.hitStop(0.2);
    game.showBanner('THE TEST', 'OF TIME');
    const before = game.bannerTimer;
    h.game.update(1 / 60);
    expect(game.juice.simDt(1 / 60)).toBe(0); // still frozen…
    expect(game.bannerTimer).toBeLessThan(before); // …yet the banner moved
  });

  test('a freeze never reaches the town sim', () => {
    const h = initGame(new DungeonCrawlGame());
    const held = wireHeldKeys(h);
    walkToTown(h, held);
    const game = internals(h);
    expect(game.state).toBe('town');

    game.player.invuln = 1.0;
    game.juice.hitStop(0.3);
    h.game.update(1 / 60);
    expect(game.player.invuln).toBeLessThan(1.0); // town ticks on raw dt
  });

  test('descending drops the floor-entry curtain', () => {
    const h = initGame(new DungeonCrawlGame());
    const held = wireHeldKeys(h);
    walkToTown(h, held);
    descendToFloorOne(h, held);
    const game = internals(h);
    // Two settle frames have already run since loadFloor — the curtain is
    // mid-lift: present, thinning, and gone after its full time passes.
    const early = game.juice.curtainAlpha();
    expect(early).toBeGreaterThan(0);
    for (let i = 0; i < Math.ceil(JUICE.CURTAIN_TIME * 60) + 2; i++) h.game.update(1 / 60);
    expect(game.juice.curtainAlpha()).toBe(0);
  });
});
