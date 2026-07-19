// Wave M tests: THE ROGUE'S TRADE — the thief's percentile trade-skills
// (formula + tuning contract), locked-chest generation (positions only, off
// floor 1, deterministic), and the lock-pick / key-turn / trap-disarm flows
// through the live game with their metrics (chests_opened, traps_disarmed).

import {
  openLocksChance,
  removeTrapsChance,
  THIEF_SKILLS,
} from '@/games/dungeon-crawl/data/classes';
import { CHESTS, HAZARDS, SECRETS, TILE } from '@/games/dungeon-crawl/data/constants';
import { QUESTS } from '@/games/dungeon-crawl/data/quests';
import { generateFloor } from '@/games/dungeon-crawl/dungeon/DungeonGenerator';
import { Tile } from '@/games/dungeon-crawl/dungeon/TileMap';
import { DungeonCrawlGame } from '@/games/dungeon-crawl/DungeonCrawlGame';
import { Chest } from '@/games/dungeon-crawl/entities/Chest';
import { Hazard } from '@/games/dungeon-crawl/entities/Hazard';
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
  departOnQuest(quest: (typeof QUESTS)[keyof typeof QUESTS]): void;
  state: string;
  player: { x: number; y: number; hp: number; maxHp: number; keys: number };
  rng: { next(): number };
  chests: Chest[];
  hazards: Hazard[];
  map: { tileAtWorld(x: number, y: number): { tx: number; ty: number } };
  thiefSkills: { prompt(): { text: string; ok: boolean } | null };
}

function internals(h: Harness): GameInternals {
  return h.game as unknown as GameInternals;
}

function metrics(h: Harness): Record<string, number> {
  return h.game.getScore!() as unknown as Record<string, number>;
}

/** Turn the title page, pick a class by digit, forge a HUMAN — Lastlight. */
function startWithClass(h: Harness, digit: string): Set<string> {
  const held = wireHeldKeys(h);
  held.add('Space');
  h.game.update(1 / 60);
  held.clear();
  h.game.update(1 / 60);
  held.add(digit);
  h.game.update(1 / 60); // pick the class -> the bloodline page
  held.clear();
  h.game.update(1 / 60); // releasing arms the lineage digits
  held.add('Digit1');
  h.game.update(1 / 60); // forge a HUMAN (card 1) -> town
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
  h.game.update(1 / 60); // settle input edges
  expect(game.state).toBe('playing');
  return game;
}

/** A locked chest dropped at the hero's feet (floor 1 seeds none itself). */
function chestUnderfoot(game: GameInternals): Chest {
  const chest = new Chest(game.player.x, game.player.y);
  game.chests.push(chest);
  return chest;
}

/** A dormant spike plate on the hero's own tile. */
function trapUnderfoot(game: GameInternals): Hazard {
  const t = game.map.tileAtWorld(game.player.x, game.player.y);
  const hazard = new Hazard(t.tx, t.ty, 'spikes');
  game.hazards.push(hazard);
  return hazard;
}

describe('the trade-skill formulas', () => {
  test('base, per-level growth, DEX lean and the cap', () => {
    expect(openLocksChance(1, 0)).toBe(THIEF_SKILLS.OPEN_LOCKS_BASE);
    expect(removeTrapsChance(1, 0)).toBe(THIEF_SKILLS.REMOVE_TRAPS_BASE);
    expect(openLocksChance(2, 0) - openLocksChance(1, 0)).toBe(THIEF_SKILLS.PER_LEVEL);
    expect(openLocksChance(1, 2) - openLocksChance(1, 0)).toBe(2 * THIEF_SKILLS.DEX_BONUS);
    expect(removeTrapsChance(4, 1)).toBe(
      THIEF_SKILLS.REMOVE_TRAPS_BASE + 3 * THIEF_SKILLS.PER_LEVEL + THIEF_SKILLS.DEX_BONUS,
    );
    // A god-rolled master still meets the cap — never a guaranteed pick.
    expect(openLocksChance(10, 4)).toBe(THIEF_SKILLS.CAP);
    expect(removeTrapsChance(10, 4)).toBe(THIEF_SKILLS.CAP);
    expect(THIEF_SKILLS.CAP).toBeLessThanOrEqual(95);
  });

  test('tuning contract: gentle floor 1, a budgeted bonus roll, a real retry', () => {
    expect(CHESTS.FLOOR_MIN).toBeGreaterThanOrEqual(2);
    expect(CHESTS.BONUS_SCROLL + CHESTS.BONUS_POTION + CHESTS.BONUS_ITEM).toBeLessThan(1);
    expect(THIEF_SKILLS.PICK_RETRY).toBeGreaterThan(0);
    expect(HAZARDS.DISARM_RADIUS).toBeGreaterThanOrEqual(HAZARDS.RADIUS);
  });
});

describe('the hazard under the thief’s hands', () => {
  test('spring() bites now; disarmed stays dead through every cycle', () => {
    const sprung = new Hazard(4, 4, 'spikes');
    sprung.spring();
    expect(sprung.phase).toBe('up');
    expect(sprung.dangerous).toBe(true);

    const stilled = new Hazard(5, 4, 'vent');
    stilled.disarmed = true;
    for (let i = 0; i < 400; i++) {
      stilled.update(1 / 60); // > a full down/telegraph/up cycle
      expect(stilled.dangerous).toBe(false);
    }
    expect(stilled.phase).toBe('down');
    // And a disarmed trap cannot be sprung after the fact.
    stilled.spring();
    expect(stilled.dangerous).toBe(false);
  });
});

describe('chest generation', () => {
  test('floor 1 never hides a chest; deeper floors sometimes do', () => {
    let deeper = 0;
    for (let seed = 1; seed <= 30; seed++) {
      expect(generateFloor(seed, 1).chests).toHaveLength(0);
      deeper += generateFloor(seed, 2).chests.length;
    }
    expect(deeper).toBeGreaterThan(0); // FLOOR_CHANCE makes 30 dry seeds absurd
  });

  test('chests land on open floor tiles, deterministically per seed', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const plan = generateFloor(seed, 4);
      for (const chest of plan.chests) {
        const tx = Math.floor(chest.x / TILE);
        const ty = Math.floor(chest.y / TILE);
        expect(plan.map.get(tx, ty)).toBe(Tile.Floor);
      }
      expect(generateFloor(seed, 4).chests).toEqual(plan.chests);
    }
  });

  test('boss arenas keep no furniture', () => {
    for (let seed = 1; seed <= 10; seed++) {
      expect(generateFloor(seed, 3).chests).toHaveLength(0);
    }
  });

  test('secret rooms sometimes keep a strongbox of their own', () => {
    expect(SECRETS.CHEST_CHANCE).toBeGreaterThan(0);
    let found = false;
    for (let seed = 1; seed <= 120 && !found; seed++) {
      const plan = generateFloor(seed, 4);
      for (const secret of plan.secrets) {
        const r = secret.room;
        found ||= plan.chests.some(c => {
          const tx = Math.floor(c.x / TILE);
          const ty = Math.floor(c.y / TILE);
          return tx >= r.tx && tx < r.tx + r.w && ty >= r.ty && ty < r.ty + r.h;
        });
      }
    }
    expect(found).toBe(true);
  });
});

describe('the rogue’s trade through the game', () => {
  test('a thief picks the lock: loot, metric, and a percent on the prompt', () => {
    const h = initGame(new DungeonCrawlGame());
    const held = startWithClass(h, 'Digit2'); // thief
    const game = enterDepths(h, held);
    const chest = chestUnderfoot(game);

    h.game.update(1 / 60); // the system notices the chest underfoot
    const prompt = game.thiefSkills.prompt();
    expect(prompt?.text).toContain('PICK THE LOCK');
    expect(prompt?.text).toContain('%');

    game.rng.next = () => 0; // the pick cannot slip
    held.add('KeyE');
    h.game.update(1 / 60);
    held.clear();
    expect(chest.opened).toBe(true);
    expect(metrics(h).chests_opened).toBe(1);
    expect(game.player.keys).toBe(0); // picked, never paid
  });

  test('a slipped pick holds the lock and waits out the retry', () => {
    const h = initGame(new DungeonCrawlGame());
    const held = startWithClass(h, 'Digit2'); // thief
    const game = enterDepths(h, held);
    const chest = chestUnderfoot(game);

    game.rng.next = () => 0.999; // every roll misses the cap
    held.add('KeyE');
    h.game.update(1 / 60);
    held.clear();
    h.game.update(1 / 60);
    expect(chest.opened).toBe(false);
    expect(metrics(h).chests_opened).toBe(0);

    // Inside the retry window even a sure pick waits.
    game.rng.next = () => 0;
    held.add('KeyE');
    h.game.update(1 / 60);
    held.clear();
    expect(chest.opened).toBe(false);

    // Once the pick steadies, the lock gives.
    for (let i = 0; i < 70; i++) h.game.update(1 / 60);
    held.add('KeyE');
    h.game.update(1 / 60);
    held.clear();
    expect(chest.opened).toBe(true);
    expect(metrics(h).chests_opened).toBe(1);
  });

  test('any class turns a key — and without one the lock stands', () => {
    const h = initGame(new DungeonCrawlGame());
    const held = startWithClass(h, 'Digit1'); // fighter
    const game = enterDepths(h, held);
    const chest = chestUnderfoot(game);
    game.player.keys = 1;
    game.rng.next = () => 0; // loot rolls only — no skill roll for a key

    h.game.update(1 / 60);
    expect(game.thiefSkills.prompt()?.text).toContain('TURN THE KEY');
    held.add('KeyE');
    h.game.update(1 / 60);
    held.clear();
    expect(chest.opened).toBe(true);
    expect(game.player.keys).toBe(0);
    expect(metrics(h).keys_used).toBe(1);
    expect(metrics(h).chests_opened).toBe(1);

    // A second strongbox with an empty ring: the prompt turns it away.
    const second = chestUnderfoot(game);
    h.game.update(1 / 60);
    expect(game.thiefSkills.prompt()?.text).toContain('LOCKED FAST');
    held.add('KeyE');
    h.game.update(1 / 60);
    held.clear();
    expect(second.opened).toBe(false);
    expect(metrics(h).chests_opened).toBe(1);
  });

  test('a clean disarm stills the trap forever and pays the specialist', () => {
    const h = initGame(new DungeonCrawlGame());
    const held = startWithClass(h, 'Digit2'); // thief
    const game = enterDepths(h, held);
    const hazard = trapUnderfoot(game);
    const xpBefore = metrics(h).xp_earned;

    game.rng.next = () => 0;
    h.game.update(1 / 60);
    expect(game.thiefSkills.prompt()?.text).toContain('DISARM THE TRAP');
    held.add('KeyE');
    h.game.update(1 / 60);
    held.clear();
    expect(hazard.disarmed).toBe(true);
    expect(metrics(h).traps_disarmed).toBe(1);
    expect(metrics(h).xp_earned).toBeGreaterThan(xpBefore);

    // The plate never rises again, whatever the clock says.
    for (let i = 0; i < 400; i++) hazard.update(1 / 60);
    expect(hazard.dangerous).toBe(false);
  });

  test('a failed disarm springs the trap under the thief', () => {
    const h = initGame(new DungeonCrawlGame());
    const held = startWithClass(h, 'Digit2'); // thief
    const game = enterDepths(h, held);
    const hazard = trapUnderfoot(game);
    const hpBefore = game.player.hp;

    game.rng.next = () => 0.999; // the roll misses the cap
    h.game.update(1 / 60);
    held.add('KeyE');
    h.game.update(1 / 60);
    held.clear();
    expect(hazard.disarmed).toBe(false);
    expect(hazard.phase).toBe('up');
    expect(metrics(h).traps_disarmed).toBe(0);
    // Standing on the sprung plate: the existing hazard bite lands.
    h.game.update(1 / 60);
    expect(game.player.hp).toBeLessThan(hpBefore);
  });

  test('trap plates say nothing to the unschooled', () => {
    const h = initGame(new DungeonCrawlGame());
    const held = startWithClass(h, 'Digit1'); // fighter
    const game = enterDepths(h, held);
    const hazard = trapUnderfoot(game);

    game.rng.next = () => 0;
    h.game.update(1 / 60);
    expect(game.thiefSkills.prompt()).toBeNull();
    held.add('KeyE');
    h.game.update(1 / 60);
    held.clear();
    expect(hazard.disarmed).toBe(false);
    expect(metrics(h).traps_disarmed).toBe(0);
  });
});
