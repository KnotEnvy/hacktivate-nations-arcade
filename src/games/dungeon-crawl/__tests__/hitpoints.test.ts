// Wave L tests: THE TRUE MEASURE — the dice util contract, the class hit-die
// table (level 1 = the die's maximum), rolled-and-kept level-up HP, the
// hpRolls sanitize (clamp / truncate / average backfill for veterans), and
// the per-hit-die CON share.

import { ALL_CLASS_IDS, CLASSES } from '@/games/dungeon-crawl/data/classes';
import { diceAvg, diceMax, diceMin, rollDice } from '@/games/dungeon-crawl/data/dice';
import { BOSS, ENEMY_CONFIGS } from '@/games/dungeon-crawl/data/enemies';
import { averageHpRoll } from '@/games/dungeon-crawl/data/progression';
import { STAT_BASES } from '@/games/dungeon-crawl/data/stats';
import { Rng } from '@/games/dungeon-crawl/dungeon/rng';
import {
  CharacterStore,
  SavedHero,
  SavePayloadV2,
} from '@/games/dungeon-crawl/persistence/CharacterStore';
import { ProgressionController } from '@/games/dungeon-crawl/progression/ProgressionController';
import { FloatingTextSystem } from '@/games/dungeon-crawl/systems/FloatingText';

let randomSpy: jest.SpyInstance;
beforeEach(() => {
  randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.42);
});
afterEach(() => {
  randomSpy.mockRestore();
});

function fighterHero(overrides?: Partial<SavedHero>): SavedHero {
  return {
    classId: 'fighter',
    name: 'SIR ROWAN',
    level: 4,
    xp: 900,
    boons: {},
    createdAt: 1700000000000,
    stats: { expeditions: 2, deaths: 0, victories: 1 },
    gold: 0,
    gear: {},
    provisions: [],
    sagas: {},
    spells: [],
    scores: { ...STAT_BASES.fighter },
    equipment: {},
    stash: [],
    lineage: 'human',
    hpRolls: [7, 2, 9],
    ...overrides,
  };
}

function saveRoster(store: CharacterStore, heroes: SavedHero[]): void {
  const characters: SavePayloadV2['characters'] = {};
  for (const h of heroes) characters[h.classId] = h;
  window.localStorage.setItem(
    store.key(),
    JSON.stringify({ version: 2, characters }),
  );
}

describe('the dice', () => {
  test('rollDice stays inside its bounds and honors the flat bonus', () => {
    const rng = new Rng(123);
    for (const dice of [
      { n: 1, d: 2 },
      { n: 1, d: 4, plus: 1 },
      { n: 2, d: 4 },
      { n: 1, d: 10 },
    ]) {
      for (let i = 0; i < 200; i++) {
        const roll = rollDice(rng, dice);
        expect(roll).toBeGreaterThanOrEqual(diceMin(dice));
        expect(roll).toBeLessThanOrEqual(diceMax(dice));
      }
    }
  });

  test('d1 dice are fixed points and cost no entropy', () => {
    const a = new Rng(7);
    const b = new Rng(7);
    expect(rollDice(a, { n: 1, d: 1 })).toBe(1);
    expect(rollDice(a, { n: 3, d: 1, plus: 2 })).toBe(5);
    // The stream is untouched: both rngs still agree.
    expect(a.next()).toBe(b.next());
  });

  test('diceAvg matches the closed form', () => {
    expect(diceAvg({ n: 1, d: 6 })).toBeCloseTo(3.5);
    expect(diceAvg({ n: 2, d: 4, plus: 2 })).toBeCloseTo(7);
  });
});

describe('the hit-die table', () => {
  test('warrior d10 / priest d8 / rogue d6 / wizard d4; level 1 = the maximum', () => {
    expect(CLASSES.fighter.kit.hitDie).toBe(10);
    expect(CLASSES.cleric.kit.hitDie).toBe(8);
    expect(CLASSES.thief.kit.hitDie).toBe(6);
    expect(CLASSES.mage.kit.hitDie).toBe(4);
    for (const id of ALL_CLASS_IDS) {
      expect(CLASSES[id].kit.maxHp).toBe(CLASSES[id].kit.hitDie);
    }
  });

  test('averageHpRoll rounds the die average up', () => {
    expect(averageHpRoll(10)).toBe(6);
    expect(averageHpRoll(8)).toBe(5);
    expect(averageHpRoll(6)).toBe(4);
    expect(averageHpRoll(4)).toBe(3);
  });
});

describe('rolled-and-kept level-ups', () => {
  test('confirmLevelUp keeps the roll and returns it as the level HP', () => {
    saveRoster(new CharacterStore(), [fighterHero({ level: 1, xp: 999, hpRolls: [] })]);
    const controller = new ProgressionController();
    controller.load();
    controller.selectHero('fighter');

    const { level, gain } = controller.confirmLevelUp(null, 7);
    expect(level).toBe(2);
    expect(gain.hp).toBe(7); // flat-base fighter: zero CON share
    expect(controller.character()!.hpRolls).toEqual([7]);
    expect(controller.gains().hp).toBe(7);
  });

  test('a wild roll clamps to the class die; a missing roll lands the average', () => {
    saveRoster(new CharacterStore(), [fighterHero({ level: 1, xp: 9999, hpRolls: [] })]);
    const controller = new ProgressionController();
    controller.load();
    controller.selectHero('fighter');

    controller.confirmLevelUp(null, 99);
    controller.confirmLevelUp(null);
    expect(controller.character()!.hpRolls).toEqual([10, averageHpRoll(10)]);
  });
});

describe('the incoming-damage dice contract', () => {
  test('every monster carries valid touch dice; boss dice outrank the floor', () => {
    let heaviest = 0;
    for (const config of Object.values(ENEMY_CONFIGS)) {
      const dice = config.touchDamage;
      expect(dice.n).toBeGreaterThanOrEqual(1);
      expect(dice.d).toBeGreaterThanOrEqual(1);
      expect(diceMin(dice)).toBeGreaterThanOrEqual(1);
      heaviest = Math.max(heaviest, diceAvg(dice));
      if (config.boltDamage) {
        expect(diceMin(config.boltDamage)).toBeGreaterThanOrEqual(1);
      }
    }
    // No wandering monster out-hits the Guardian's charge on average.
    expect(diceAvg(BOSS.CHARGE_DAMAGE)).toBeGreaterThanOrEqual(heaviest);
    expect(diceAvg(BOSS.TOUCH_DAMAGE)).toBeGreaterThanOrEqual(heaviest);
  });

  test('every ranged config declares its bolt dice', () => {
    for (const config of Object.values(ENEMY_CONFIGS)) {
      if (config.behavior === 'ranged') {
        expect(config.boltDamage).toBeDefined();
        expect(config.boltCause ?? 'sorcerer_bolt').toBeTruthy();
      }
    }
  });
});

describe('floating combat numbers', () => {
  test('numbers rise, fade out on schedule, and the cap holds', () => {
    const floats = new FloatingTextSystem();
    floats.push(100, 100, '-3', '#d63d3d');
    expect(floats.count()).toBe(1);
    floats.update(0.3);
    expect(floats.count()).toBe(1); // mid-flight
    floats.update(0.5);
    expect(floats.count()).toBe(0); // 0.8s > its 0.7s life
    for (let i = 0; i < 60; i++) floats.push(0, 0, '+1', '#7fd764');
    expect(floats.count()).toBeLessThanOrEqual(40); // the cap sheds the oldest
    floats.clear();
    expect(floats.count()).toBe(0);
  });
});

describe('hpRolls sanitize', () => {
  test('rolls clamp to the die, truncate to level-1, and backfill the average', () => {
    const store = new CharacterStore();
    saveRoster(store, [
      // level 4 = three rolls; this save carries junk: too many entries,
      // an impossible 22, a broken 0.
      fighterHero({ level: 4, hpRolls: [22, 0, 5, 9, 9, 9] }),
    ]);
    const loaded = store.load().characters.fighter!;
    expect(loaded.hpRolls).toEqual([10, 1, 5]);
  });

  test('a veteran saved before hit dice existed lands mid-pool', () => {
    const store = new CharacterStore();
    const veteran = fighterHero({ level: 4 }) as unknown as Record<string, unknown>;
    delete veteran.hpRolls;
    saveRoster(store, [veteran as unknown as SavedHero]);
    const loaded = store.load().characters.fighter!;
    expect(loaded.hpRolls).toEqual([6, 6, 6]); // averageHpRoll(d10) × 3
  });
});
