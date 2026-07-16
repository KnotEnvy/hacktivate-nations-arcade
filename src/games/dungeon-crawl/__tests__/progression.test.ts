// v4 Wave A/A.1 tests: XP curve + level gains, boon contract, the ROSTER save
// (v2 round-trip / v1 migration / corrupt / owner-scoped), the
// ProgressionController roster API, and thin integration checks through the
// public metric surface.

import { ALL_BOON_IDS, BOONS } from '@/games/dungeon-crawl/data/boons';
import { ALL_CLASS_IDS, CLASSES } from '@/games/dungeon-crawl/data/classes';
import { PLAYER } from '@/games/dungeon-crawl/data/constants';
import {
  cumulativeGains,
  LEVEL_CAP,
  LEVEL_CURVE,
  LEVEL_GAINS,
  levelForXp,
  PROGRESSION,
  xpIntoLevel,
} from '@/games/dungeon-crawl/data/progression';
import { DungeonCrawlGame } from '@/games/dungeon-crawl/DungeonCrawlGame';
import { Rng } from '@/games/dungeon-crawl/dungeon/rng';
import { Player } from '@/games/dungeon-crawl/entities/Player';
import {
  CharacterStore,
  SavedHero,
  SavePayloadV2,
} from '@/games/dungeon-crawl/persistence/CharacterStore';
import { ProgressionController } from '@/games/dungeon-crawl/progression/ProgressionController';
import { SAGAS } from '@/games/dungeon-crawl/data/sagas';
import { STAT_BASES, STAT_TUNING } from '@/games/dungeon-crawl/data/stats';
import { initGame, type Harness } from '@/games/shared/gameTestHarness';

let randomSpy: jest.SpyInstance;
beforeEach(() => {
  randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.42);
});
afterEach(() => {
  randomSpy.mockRestore();
});

function hero(overrides?: Partial<SavedHero>): SavedHero {
  return {
    classId: 'fighter',
    name: 'SIR ROWAN',
    level: 3,
    xp: 450,
    boons: { toughness: 1 },
    createdAt: 1700000000000,
    stats: { expeditions: 4, deaths: 2, victories: 0 },
    gold: 0,
    gear: {},
    provisions: [],
    sagas: {},
    spells: [],
    scores: { ...STAT_BASES.fighter },
    equipment: {},
    stash: [],
    lineage: 'human',
    ...overrides,
  };
}

function rosterSave(heroes: SavedHero[]): SavePayloadV2 {
  const characters: SavePayloadV2['characters'] = {};
  for (const h of heroes) characters[h.classId] = h;
  return { version: 2, characters };
}

/** A pre-roster (Wave A) single-hero save, as real users may still carry. */
function v1Save() {
  return {
    version: 1,
    character: {
      classId: 'fighter',
      name: 'SIR ROWAN',
      level: 3,
      xp: 450,
      boons: { toughness: 1 },
      createdAt: 1700000000000,
    },
    stats: { expeditions: 4, deaths: 2, victories: 0 },
  };
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

describe('level curve + gains', () => {
  test('curve is monotonic, starts at 0, spans the cap', () => {
    expect(LEVEL_CURVE).toHaveLength(LEVEL_CAP + 1);
    expect(LEVEL_CURVE[1]).toBe(0);
    for (let n = 2; n <= LEVEL_CAP; n++) {
      expect(LEVEL_CURVE[n]).toBeGreaterThan(LEVEL_CURVE[n - 1]);
    }
  });

  test('levelForXp boundaries', () => {
    expect(levelForXp(0)).toBe(1);
    expect(levelForXp(LEVEL_CURVE[2] - 1)).toBe(1);
    expect(levelForXp(LEVEL_CURVE[2])).toBe(2);
    expect(levelForXp(LEVEL_CURVE[LEVEL_CAP] + 99999)).toBe(LEVEL_CAP);
  });

  test('xpIntoLevel gives a full bar at the cap', () => {
    expect(xpIntoLevel(LEVEL_CURVE[LEVEL_CAP], LEVEL_CAP).frac).toBe(1);
    const mid = xpIntoLevel(LEVEL_CURVE[2] + 50, 2);
    expect(mid.frac).toBeGreaterThan(0);
    expect(mid.frac).toBeLessThan(1);
  });

  test('every class has nine gain rows and respects the hp cap', () => {
    for (const classId of ALL_CLASS_IDS) {
      expect(LEVEL_GAINS[classId]).toHaveLength(LEVEL_CAP - 1);
      const total = cumulativeGains(classId, LEVEL_CAP);
      expect(CLASSES[classId].kit.maxHp + total.hp).toBeLessThanOrEqual(PLAYER.HP_CAP);
      expect(total.hp).toBeGreaterThan(0);
    }
  });
});

describe('boon contract', () => {
  test('ten unique, fully authored boons with sensible stacks', () => {
    expect(ALL_BOON_IDS).toHaveLength(10);
    expect(new Set(ALL_BOON_IDS).size).toBe(10);
    let totalStacks = 0;
    for (const id of ALL_BOON_IDS) {
      const def = BOONS[id];
      expect(def.id).toBe(id);
      expect(def.name.length).toBeGreaterThan(0);
      expect(def.blurb.length).toBeGreaterThan(0);
      expect(def.maxStacks).toBeGreaterThanOrEqual(1);
      totalStacks += def.maxStacks;
    }
    // Nine possible level-ups must always find three open choices.
    expect(totalStacks).toBeGreaterThanOrEqual(LEVEL_CAP - 1 + 3);
  });
});

describe('CharacterStore (roster v2)', () => {
  test('round-trips a roster under the guest key', () => {
    const store = new CharacterStore();
    expect(store.key()).toBe('dungeon-crawl-save:guest');
    store.save(rosterSave([hero(), hero({ classId: 'mage', name: 'ELDRIN', level: 2, xp: 200 })]));
    const loaded = store.load();
    expect(loaded.characters.fighter?.level).toBe(3);
    expect(loaded.characters.fighter?.stats.deaths).toBe(2);
    expect(loaded.characters.mage?.name).toBe('ELDRIN');
    expect(loaded.characters.thief).toBeUndefined();
  });

  test('scopes the key to the signed-in owner', () => {
    localStorage.setItem('hacktivate-session-owner', 'user-42');
    const store = new CharacterStore();
    expect(store.key()).toBe('dungeon-crawl-save:user-42');
    store.save(rosterSave([hero()]));
    expect(localStorage.getItem('dungeon-crawl-save:user-42')).not.toBeNull();
    expect(localStorage.getItem('dungeon-crawl-save:guest')).toBeNull();
  });

  test('migrates a v1 single-hero save into its class slot', () => {
    localStorage.setItem('dungeon-crawl-save:guest', JSON.stringify(v1Save()));
    const loaded = new CharacterStore().load();
    const migrated = loaded.characters.fighter;
    expect(migrated).toBeDefined();
    expect(migrated!.level).toBe(3);
    expect(migrated!.xp).toBe(450);
    expect(migrated!.boons.toughness).toBe(1);
    expect(migrated!.stats.expeditions).toBe(4); // old global stats follow the hero
    expect(loaded.characters.mage).toBeUndefined();
  });

  test('corrupt or foreign saves yield an empty roster', () => {
    const store = new CharacterStore();
    localStorage.setItem(store.key(), '{not json');
    expect(store.load().characters).toEqual({});
    localStorage.setItem(store.key(), JSON.stringify({ version: 3, characters: {} }));
    expect(store.load().characters).toEqual({});
  });

  test('invalid heroes are dropped individually, valid ones survive', () => {
    const store = new CharacterStore();
    const payload = rosterSave([hero(), hero({ classId: 'thief', name: 'WREN', level: 2, xp: 160 })]);
    (payload.characters.fighter as unknown as { level: number }).level = LEVEL_CAP + 9;
    store.save(payload);
    const loaded = store.load();
    expect(loaded.characters.fighter).toBeUndefined(); // impossible level dropped
    expect(loaded.characters.thief?.name).toBe('WREN');
  });

  test('clamps unknown/overgrown boons instead of failing', () => {
    const store = new CharacterStore();
    const payload = rosterSave([hero()]);
    (payload.characters.fighter!.boons as Record<string, number>)['not-a-boon'] = 9;
    payload.characters.fighter!.boons.toughness = 99;
    store.save(payload);
    const loaded = store.load();
    const boons = loaded.characters.fighter!.boons as Record<string, number>;
    expect(boons['not-a-boon']).toBeUndefined();
    expect(boons.toughness).toBe(BOONS.toughness.maxStacks);
  });

  // v4 Wave C — saga progress rides the same additive-clamp discipline.
  test('clamps unknown/overgrown saga progress; heroes without it default empty', () => {
    const store = new CharacterStore();
    const payload = rosterSave([hero({ sagas: { 'pale-procession': 2 } })]);
    (payload.characters.fighter!.sagas as Record<string, number>)['not-a-saga'] = 5;
    (payload.characters.fighter!.sagas as Record<string, number>)['undying-ember'] = 99;
    store.save(payload);
    const loaded = store.load();
    const sagas = loaded.characters.fighter!.sagas as Record<string, number>;
    expect(sagas['pale-procession']).toBe(2);
    expect(sagas['not-a-saga']).toBeUndefined();
    expect(sagas['undying-ember']).toBe(SAGAS['undying-ember'].quests.length);

    // A pre-Wave-C hero record (no sagas field) sanitizes to an empty map.
    const legacy = rosterSave([hero({ classId: 'mage', name: 'ELDRIN' })]);
    delete (legacy.characters.mage as unknown as Record<string, unknown>).sagas;
    store.save(legacy);
    expect(store.load().characters.mage!.sagas).toEqual({});
  });
});

describe('ProgressionController (roster)', () => {
  test('create → grantXp → level-up flow persists per class', () => {
    const controller = new ProgressionController();
    controller.load();
    expect(controller.hasCharacter()).toBe(false);
    const created = controller.create('thief', new Rng(7));
    expect(created.level).toBe(1);
    expect(created.name.length).toBeGreaterThan(0);
    expect(controller.hasCharacter()).toBe(true);

    // Wave I — the human forge rolls wider, so a variance point can cross a
    // WIS boundary; derive the earned XP from the forged hero's own delta
    // (the town.test CHA pattern).
    const wisMult = 1 + STAT_TUNING.WIS_XP_MULT * controller.statDeltas().wis;
    const earnedXp = Math.round(LEVEL_CURVE[2] * wisMult);
    controller.grantXp(LEVEL_CURVE[2]);
    expect(controller.pendingLevelUp()).toBe(true);
    const choices = controller.draftChoices(new Rng(7));
    expect(choices.length).toBe(3);
    // A thief's draft is training only — spells belong to the casters.
    expect(choices.every(pick => pick.kind === 'boon')).toBe(true);
    const { level, gain } = controller.confirmLevelUp(choices[0]);
    expect(level).toBe(2);
    expect(gain).toBeDefined();
    expect(controller.sessionLevels).toBe(1);
    expect(controller.sessionBoons).toBe(1);

    // A fresh controller sees the same hero in the thief slot (persisted).
    const again = new ProgressionController();
    again.load();
    expect(again.heroFor('thief')?.level).toBe(2);
    expect(again.heroFor('thief')?.xp).toBe(earnedXp);
    expect(again.heroFor('fighter')).toBeNull();
  });

  test('heroes level independently; selectHero counts expeditions', () => {
    localStorage.setItem(
      'dungeon-crawl-save:guest',
      JSON.stringify(rosterSave([hero(), hero({ classId: 'mage', name: 'ELDRIN', level: 5, xp: 1400 })])),
    );
    const controller = new ProgressionController();
    controller.load();
    const picked = controller.selectHero('fighter');
    expect(picked.level).toBe(3);
    expect(picked.stats.expeditions).toBe(5);
    controller.grantXp(5000);
    expect(controller.character()?.classId).toBe('fighter');
    // The mage slot is untouched by the fighter's adventures.
    expect(controller.heroFor('mage')?.xp).toBe(1400);
  });

  test('draftChoices never offers a maxed boon', () => {
    const controller = new ProgressionController();
    controller.create('fighter', new Rng(3));
    const store = new CharacterStore();
    const payload = store.load();
    for (const id of ALL_BOON_IDS) payload.characters.fighter!.boons[id] = BOONS[id].maxStacks;
    payload.characters.fighter!.boons.herbalism = 0;
    store.save(payload);
    controller.load();
    controller.selectHero('fighter');
    for (let i = 0; i < 10; i++) {
      const choices = controller.draftChoices(new Rng(i));
      expect(choices).toEqual([{ kind: 'boon', id: 'herbalism' }]);
    }
  });

  test('level pressure follows the ACTIVE hero and caps', () => {
    const controller = new ProgressionController();
    controller.load();
    expect(controller.levelPressure()).toBe(1);
    localStorage.setItem(
      'dungeon-crawl-save:guest',
      JSON.stringify(rosterSave([hero({ level: 5, xp: 1400 })])),
    );
    controller.load();
    expect(controller.levelPressure()).toBe(1); // nothing active yet
    controller.selectHero('fighter');
    expect(controller.levelPressure()).toBeCloseTo(
      1 + PROGRESSION.PRESSURE_HP_PER_LEVEL * 4,
    );
  });

  test('retire clears only the active class slot', () => {
    const controller = new ProgressionController();
    controller.create('cleric', new Rng(2));
    controller.create('mage', new Rng(4)); // mage becomes active
    controller.retire();
    expect(controller.hasCharacter()).toBe(false);
    const again = new ProgressionController();
    again.load();
    expect(again.heroFor('mage')).toBeNull();
    expect(again.heroFor('cleric')).not.toBeNull();
  });
});

describe('Player progression application', () => {
  test('level gains and toughness raise the ceiling (clamped)', () => {
    const player = new Player();
    player.reset(0, 0);
    player.applyKit(CLASSES.fighter);
    // v5 Wave E legacy contract: no statDeltas passed = zero deltas = this
    // exact pre-stats math. Deltas get their own tests in stats.test.ts.
    player.applyProgression(cumulativeGains('fighter', 5), { toughness: 2 });
    // fighter kit 8 + gains(L5: 2+1+1+2=6) + toughness 4 = 18
    expect(player.maxHp).toBe(18);
    expect(player.hp).toBe(player.maxHp);
  });

  test('survivor training revives once per expedition', () => {
    const player = new Player();
    player.reset(0, 0);
    player.applyKit(CLASSES.fighter);
    player.applyProgression({ hp: 0, speed: 0, daggerCap: 0 }, { survivor: 1 });
    expect(player.tryConsumeSurvivor()).toBe(true);
    expect(player.hp).toBeGreaterThan(0);
    expect(player.tryConsumeSurvivor()).toBe(false);
  });
});

describe('roster flow (public metric surface)', () => {
  test('a legacy v1 hero migrates and resumes on its class pick', () => {
    localStorage.setItem('dungeon-crawl-save:guest', JSON.stringify(v1Save()));
    const h = initGame(new DungeonCrawlGame());
    let s = h.game.getScore!() as unknown as Record<string, number>;
    // The roster select is showing — nothing picked yet.
    expect(s.character_level).toBe(1);
    expect(s.fighter_depth).toBe(0);

    const held = wireHeldKeys(h);
    // Wave I — turn the title page (a returning hero skips the bloodline pick).
    held.add('Space');
    h.game.update(1 / 60);
    held.clear();
    h.game.update(1 / 60);
    held.add('Digit1'); // fighter slot
    h.game.update(1 / 60);
    s = h.game.getScore!() as unknown as Record<string, number>;
    expect(s.character_level).toBe(3); // the playtested hero, migrated
    expect(s.fighter_depth).toBe(1);
  });

  test('picking a different class forges a fresh level-1 hero', () => {
    localStorage.setItem('dungeon-crawl-save:guest', JSON.stringify(v1Save()));
    const h = initGame(new DungeonCrawlGame());
    const held = wireHeldKeys(h);
    // Wave I — turn the title page.
    held.add('Space');
    h.game.update(1 / 60);
    held.clear();
    h.game.update(1 / 60);
    held.add('Digit2'); // thief slot — empty -> the bloodline page
    h.game.update(1 / 60);
    held.clear();
    h.game.update(1 / 60); // releasing arms the lineage digits
    held.add('Digit1'); // forge a HUMAN (card 1)
    h.game.update(1 / 60);
    const s = h.game.getScore!() as unknown as Record<string, number>;
    expect(s.character_level).toBe(1);
    expect(s.thief_depth).toBe(1);
    // The fighter's legend is untouched in its slot.
    expect(new CharacterStore().load().characters.fighter?.level).toBe(3);
  });

  test('a fresh account starts every slot unproven', () => {
    const h = initGame(new DungeonCrawlGame());
    const s = h.game.getScore!() as unknown as Record<string, number>;
    expect(s.character_level).toBe(1);
    for (const id of ALL_CLASS_IDS) {
      expect(s[`${id}_depth`]).toBe(0);
    }
  });
});
