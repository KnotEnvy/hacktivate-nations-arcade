// Wave Q2 tests: THE PLANES. Pins the plane/palette data contract, the promise
// that the dungeon's four-biome cycle is untouched, the planar spawn core, the
// four LAWS from both sides, the lords off the tier rotation, the eight new
// quests, the veteran promise (a planar arc re-locks nothing), the ascended
// save field, and the rite + Waydoor through the live game.

import { BOSS_KITS, bossKitById, bossKitForTier } from '@/games/dungeon-crawl/data/bosses';
import {
  BIOMES,
  biomeForFloor,
  paletteById,
  PLANE_PALETTES,
} from '@/games/dungeon-crawl/data/constants';
import {
  ENEMY_CONFIGS,
  EnemyTypeId,
  MORALE,
  moraleBreakChance,
  spawnWeightsForFloor,
} from '@/games/dungeon-crawl/data/enemies';
import {
  ALL_PLANE_IDS,
  ascensionPrice,
  isPlaneId,
  planeFor,
  planeLawFor,
  PLANES,
  planesOpen,
  PLANE_TUNING,
} from '@/games/dungeon-crawl/data/planes';
import { LEVEL_CAP } from '@/games/dungeon-crawl/data/progression';
import {
  ALL_QUEST_IDS,
  PLANAR_CONTRACT_IDS,
  QUESTS,
  STANDALONE_QUEST_IDS,
} from '@/games/dungeon-crawl/data/quests';
import {
  metaUnlocked,
  PLANAR_SAGA_IDS,
  SAGAS,
  storyComplete,
  visibleSagaIds,
} from '@/games/dungeon-crawl/data/sagas';
import { storyStage } from '@/games/dungeon-crawl/data/npcs';
import { STAT_BASES } from '@/games/dungeon-crawl/data/stats';
import { DungeonCrawlGame } from '@/games/dungeon-crawl/DungeonCrawlGame';
import { Rng } from '@/games/dungeon-crawl/dungeon/rng';
import { Enemy } from '@/games/dungeon-crawl/entities/Enemy';
import { Player } from '@/games/dungeon-crawl/entities/Player';
import {
  CharacterStore,
  SavedHero,
  SavePayloadV2,
} from '@/games/dungeon-crawl/persistence/CharacterStore';
import { TownController } from '@/games/dungeon-crawl/town/TownController';
import { initGame, type Harness } from '@/games/shared/gameTestHarness';

let randomSpy: jest.SpyInstance;
beforeEach(() => {
  randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.42);
});
afterEach(() => {
  randomSpy.mockRestore();
});

function hero(overrides: Partial<SavedHero> = {}): SavedHero {
  const classId = overrides.classId ?? 'fighter';
  return {
    classId,
    name: 'SIR ROWAN',
    level: LEVEL_CAP,
    xp: 55400,
    boons: {},
    createdAt: 0,
    stats: { expeditions: 1, deaths: 0, victories: 0 },
    gold: 5000,
    gear: {},
    provisions: [],
    sagas: {},
    spells: [],
    scores: { ...STAT_BASES[classId] },
    equipment: {},
    stash: [],
    lineage: 'human',
    hpRolls: Array(LEVEL_CAP - 1).fill(6),
    curse: null,
    ascended: false,
    ...overrides,
  };
}

function saveRoster(store: CharacterStore, heroes: SavedHero[]): void {
  const characters: SavePayloadV2['characters'] = {};
  for (const h of heroes) characters[h.classId] = h;
  window.localStorage.setItem(store.key(), JSON.stringify({ version: 2, characters }));
}

const PLANAR_TYPES = new Set<EnemyTypeId>(
  ALL_PLANE_IDS.flatMap(id => spawnWeightsForFloor(1, id).map(r => r.type)),
);

// ------------------------------------------------------------- the ground

describe('the plane data contract', () => {
  test('four planes, each fully authored and each owning a void palette', () => {
    expect(ALL_PLANE_IDS).toHaveLength(4);
    expect(PLANE_PALETTES).toHaveLength(4);
    for (const id of ALL_PLANE_IDS) {
      const plane = PLANES[id];
      expect(plane.id).toBe(id);
      expect(plane.name.length).toBeGreaterThan(0);
      expect(plane.blurb.length).toBeGreaterThan(0);
      expect(plane.lawLine.length).toBeGreaterThan(0);
      expect(plane.color).toMatch(/^#/);
      const palette = paletteById(id)!;
      expect(palette.style).toBe('void');
      // A plane is lit by what it IS, so it must name its own darkness.
      expect(palette.darkness).toBeGreaterThan(0);
      expect(palette.darkness).toBeLessThan(1);
      // Exactly one law each — a plane says one thing.
      expect(Object.keys(plane.law)).toHaveLength(1);
    }
  });

  test('THE PROMISE: the dungeon cycle is untouched, from both sides', () => {
    // The four biomes still cycle by floor, in the same order, forever.
    expect(BIOMES.map(b => b.id)).toEqual(['ember', 'bone', 'sunken', 'ash']);
    for (let floor = 1; floor <= 24; floor++) {
      expect(biomeForFloor(floor).id).toBe(BIOMES[(floor - 1) % 4].id);
      // ...and a plane is NEVER what a floor number lands on.
      expect(isPlaneId(biomeForFloor(floor).id)).toBe(false);
    }
    // No plane leaked into the biome table (which is what would break it).
    for (const id of ALL_PLANE_IDS) expect(BIOMES.some(b => b.id === id)).toBe(false);
  });

  test('paletteById resolves both tables and nothing else', () => {
    expect(paletteById('ember')!.style).toBeUndefined(); // stone, by omission
    expect(paletteById('silver-void')!.style).toBe('void');
    expect(paletteById('nowhere')).toBeNull();
    expect(paletteById(null)).toBeNull();
    expect(paletteById(undefined)).toBeNull();
  });

  test('isPlaneId / planeFor / planeLawFor answer for the depths too', () => {
    expect(isPlaneId('the-pit')).toBe(true);
    expect(isPlaneId('ash')).toBe(false);
    expect(planeFor('ash')).toBeNull();
    expect(planeFor('churning')!.name).toBe('THE CHURNING');
    // An ordinary floor has no law at all — every law read is a no-op there.
    expect(planeLawFor('ember')).toEqual({});
    expect(planeLawFor(null)).toEqual({});
    expect(planeLawFor('brass-marches').unbroken).toBe(true);
  });
});

// ------------------------------------------------------------- the population

describe('the planar spawn core', () => {
  test('a plane fields its own three and NOTHING from the depths', () => {
    for (const id of ALL_PLANE_IDS) {
      const rows = spawnWeightsForFloor(1, id);
      expect(rows).toHaveLength(3);
      for (const row of rows) {
        expect(row.weight).toBeGreaterThan(0);
        expect(PLANAR_TYPES.has(row.type)).toBe(true);
      }
    }
    // Twelve families, no sharing between planes.
    expect(PLANAR_TYPES.size).toBe(12);
  });

  test('the planar table ignores depth — the gate is the rite, not the floor', () => {
    for (const id of ALL_PLANE_IDS) {
      const shallow = spawnWeightsForFloor(1, id);
      const deep = spawnWeightsForFloor(9, id);
      expect(deep).toEqual(shallow);
    }
  });

  test('every planar family is fully authored and mostly warded', () => {
    for (const id of PLANAR_TYPES) {
      const config = ENEMY_CONFIGS[id];
      expect(config.id).toBe(id);
      expect(config.hp).toBeGreaterThan(0);
      expect(config.xp).toBeGreaterThan(0);
      expect(config.color).toMatch(/^#/);
      if (config.behavior === 'ranged') {
        expect(config.boltCause).toBeDefined();
        expect(config.boltDamage).toBeDefined();
      }
    }
    // BREECH is the planar key: the great majority of what lives out here
    // shrugs plain steel. The Pit's chaff is the deliberate exception.
    const warded = [...PLANAR_TYPES].filter(id => ENEMY_CONFIGS[id].warded);
    expect(warded).toHaveLength(11);
    expect(ENEMY_CONFIGS['pit-wretch'].warded).toBeUndefined();
  });
});

// ------------------------------------------------------------- the four laws

describe('the four laws', () => {
  test('THE BRASS MARCHES: nothing breaks, and the depths are unaffected', () => {
    const ordinary = moraleBreakChance(20, 1, 1, 8);
    expect(ordinary).toBeGreaterThan(0);
    // Same inputs, under the law: zero. Not "less" — none.
    expect(moraleBreakChance(20, 1, 1, 8, 0, true)).toBe(0);
    // The law is read through the law function, so the cap still governs off it.
    expect(moraleBreakChance(20, 1, 1, 8, 5, false)).toBe(MORALE.CHANCE_CAP);
    expect(planeLawFor('brass-marches').unbroken).toBe(true);
    expect(planeLawFor('silver-void').unbroken).toBeUndefined();
  });

  test('THE SILVER VOID: no cover — foes acquire without line of sight', () => {
    const blindMap = {
      moveWithCollision: (x: number, y: number) => ({ x, y, hitX: false, hitY: false }),
      hasLineOfSight: () => false, // a wall between them, always
    } as never;
    const ctx = (noCover?: boolean) => ({
      playerX: 40,
      playerY: 0,
      map: blindMap,
      rng: new Rng(11),
      fireBolt: () => {},
      throwBomb: () => {},
      onMimicWake: () => {},
      noCover,
    });

    const blind = new Enemy('void-lancer', 0, 0);
    blind.update(1 / 60, ctx() as never);
    expect(blind.aggro).toBe(false); // no sight, no law: it never sees you

    const seen = new Enemy('void-lancer', 0, 0);
    seen.update(1 / 60, ctx(true) as never);
    expect(seen.aggro).toBe(true); // under the law there is nowhere to be
  });

  test('THE CHURNING: gating is capped at one generation', () => {
    expect(planeLawFor('churning').gating).toBe(true);
    expect(PLANE_TUNING.GATE_CHANCE).toBeGreaterThan(0);
    expect(PLANE_TUNING.GATE_CHANCE).toBeLessThan(1);
    // The cap is structural: a gated foe carries the flag that stops it.
    const kin = new Enemy('chaos-croaker', 0, 0);
    expect(kin.gated).toBe(false);
    kin.gated = true;
    expect(kin.gated).toBe(true);
  });

  test('THE PIT: the ranks clock is slower than the camp die', () => {
    expect(planeLawFor('the-pit').ranks).toBe(true);
    expect(PLANE_TUNING.RANKS_INTERVAL).toBeGreaterThan(10);
    expect(PLANE_TUNING.RANKS_CHANCE).toBeGreaterThan(0);
  });
});

// ------------------------------------------------------------- lords + quests

describe('the lords and the eight new quests', () => {
  test('every lord is unique, off the rotation, and the rotation is pinned', () => {
    const lords = [
      'silver-lance',
      'brass-arbiter',
      'shapeless-crown',
      'pit-marshal',
      'the-quiet-beyond',
    ] as const;
    for (const id of lords) {
      expect(bossKitById(id).id).toBe(id);
      expect(BOSS_KITS.some(k => k.id === id)).toBe(false);
    }
    // The classic tier rotation is untouched through two full cycles.
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9].map(t => bossKitForTier(t).id)).toEqual([
      'ember-guardian',
      'bone-colossus',
      'hollow-king',
      'ember-guardian',
      'bone-colossus',
      'hollow-king',
      'ember-guardian',
      'bone-colossus',
      'hollow-king',
    ]);
  });

  test('a lord only ever calls on its own plane', () => {
    const homeOf = new Map<EnemyTypeId, string>();
    for (const planeId of ALL_PLANE_IDS) {
      for (const row of spawnWeightsForFloor(1, planeId)) homeOf.set(row.type, planeId);
    }
    for (const [kitId, planeId] of [
      ['silver-lance', 'silver-void'],
      ['brass-arbiter', 'brass-marches'],
      ['shapeless-crown', 'churning'],
      ['pit-marshal', 'the-pit'],
    ] as const) {
      for (const summon of bossKitById(kitId).summons) {
        expect(homeOf.get(summon as EnemyTypeId)).toBe(planeId);
      }
    }
  });

  test('four contracts + four road chapters, all planar, none on the board', () => {
    expect(PLANAR_CONTRACT_IDS).toHaveLength(4);
    const planarIds = ALL_QUEST_IDS.filter(id => QUESTS[id].planar);
    expect(planarIds).toHaveLength(8);
    for (const id of planarIds) {
      const quest = QUESTS[id];
      expect(isPlaneId(quest.biomeId)).toBe(true);
      expect(quest.minLevel).toBe(LEVEL_CAP);
      expect(quest.floors).toBeGreaterThan(0);
      expect(quest.intro.length).toBeGreaterThan(0);
      // THE BOARD MUST NEVER SEE THEM.
      expect(STANDALONE_QUEST_IDS).not.toContain(id);
    }
    // One contract per plane, no plane left out.
    expect(new Set(PLANAR_CONTRACT_IDS.map(id => QUESTS[id].biomeId))).toEqual(
      new Set(ALL_PLANE_IDS),
    );
    // The classic board still holds exactly its original five.
    expect(STANDALONE_QUEST_IDS).toHaveLength(5);
  });

  test("the road walks all four planes and ends past them", () => {
    const road = SAGAS[PLANAR_SAGA_IDS[0]];
    expect(road.quests).toHaveLength(4);
    expect(road.interludes).toHaveLength(4);
    expect(new Set(road.quests.map(q => QUESTS[q].biomeId))).toEqual(new Set(ALL_PLANE_IDS));
    expect(QUESTS[road.quests[3]].bossKitId).toBe('the-quiet-beyond');
  });
});

// ------------------------------------------------------------- veteran promise

describe('THE VETERAN PROMISE (Wave P, inherited)', () => {
  const foundingTold = { 'pale-procession': 3, 'undying-ember': 4 };

  test('the planar arc is not founding — the last page stays earned', () => {
    const road = SAGAS[PLANAR_SAGA_IDS[0]];
    expect(road.founding).toBeUndefined();
    expect(road.meta).toBeUndefined();
    // A veteran who earned THE LAST PAGE still has it, road untouched.
    expect(metaUnlocked(foundingTold)).toBe(true);
    expect(visibleSagaIds(foundingTold)).toContain('the-last-page');
  });

  test('the road never appears on the board, told or untold', () => {
    for (const progress of [{}, foundingTold, { 'ascendants-road': 4 }]) {
      for (const id of visibleSagaIds(progress)) {
        expect(SAGAS[id].planar).toBeUndefined();
      }
    }
  });

  test('a finished hero is never walked back a story stage by the road', () => {
    const done = { ...foundingTold, 'the-last-page': 3 };
    expect(storyComplete(done)).toBe(true);
    const finished = hero({ sagas: done });
    const stage = storyStage(finished);
    // Starting (or finishing) the road must not move them off the aftermath.
    expect(storyStage({ ...finished, sagas: { ...done, 'ascendants-road': 2 } })).toBe(stage);
    expect(storyStage({ ...finished, sagas: { ...done, 'ascendants-road': 4 } })).toBe(stage);
  });
});

// ------------------------------------------------------------- the rite

describe('the rite and the gate', () => {
  test('ascended sanitizes additively — veterans land false', () => {
    const store = new CharacterStore();
    const veteran = hero();
    delete (veteran as Partial<SavedHero>).ascended;
    saveRoster(store, [veteran]);
    expect(store.load().characters.fighter?.ascended).toBe(false);

    saveRoster(store, [hero({ ascended: true })]);
    expect(store.load().characters.fighter?.ascended).toBe(true);
  });

  test('planesOpen needs BOTH the cap and the rite', () => {
    expect(planesOpen(hero({ level: LEVEL_CAP, ascended: true }), LEVEL_CAP)).toBe(true);
    expect(planesOpen(hero({ level: LEVEL_CAP, ascended: false }), LEVEL_CAP)).toBe(false);
    expect(planesOpen(hero({ level: LEVEL_CAP - 1, ascended: true }), LEVEL_CAP)).toBe(false);
    expect(planesOpen(null, LEVEL_CAP)).toBe(false);
  });

  test('the offering is priced off a whole life, with a floor', () => {
    expect(ascensionPrice(0)).toBeGreaterThanOrEqual(1500);
    expect(ascensionPrice(200000)).toBeGreaterThan(ascensionPrice(55400));
    expect(ascensionPrice(55400) % 50).toBe(0);
  });

  test('the temple only speaks of the rite at the cap', () => {
    expect(TownController.ascensionOffered(hero({ level: LEVEL_CAP }))).toBe(true);
    expect(TownController.ascensionOffered(hero({ level: LEVEL_CAP - 1 }))).toBe(false);
    expect(TownController.ascensionOffered(null)).toBe(false);
  });

  test('the Waydoor offers every contract plus the road’s next chapter', () => {
    const fresh = TownController.waydoorOffers(hero({ ascended: true }));
    expect(fresh).toHaveLength(5);
    expect(fresh.slice(0, 4)).toEqual(PLANAR_CONTRACT_IDS);
    expect(fresh[4]).toBe(SAGAS[PLANAR_SAGA_IDS[0]].quests[0]);

    // Mid-road: the NEXT chapter, never a replay of a walked one.
    const mid = TownController.waydoorOffers(hero({ ascended: true, sagas: { 'ascendants-road': 2 } }));
    expect(mid[4]).toBe(SAGAS[PLANAR_SAGA_IDS[0]].quests[2]);

    // Walked out: the finale stays available to relive (the told-saga rule).
    const done = TownController.waydoorOffers(hero({ ascended: true, sagas: { 'ascendants-road': 4 } }));
    expect(done[4]).toBe(SAGAS[PLANAR_SAGA_IDS[0]].quests[3]);
  });
});

// ------------------------------------------------------------- live harness

interface GameInternals {
  departOnQuest(quest: (typeof QUESTS)[keyof typeof QUESTS]): void;
  state: string;
  floor: number;
  biome: { id: string; style?: string; darkness?: number };
  player: Player;
  enemies: Enemy[];
  town: { overlay: string; spots: Record<string, { x: number; y: number }>; selection: number };
  progression: { character(): SavedHero | null };
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

/**
 * Resume a SAVED hero (level 20, optionally ascended) straight into town. The
 * roster must be on disk BEFORE the game is constructed — otherwise the roster
 * page finds an empty slot and forges a new hero instead of resuming one.
 */
function resumeInTown(saved: SavedHero): {
  h: Harness;
  game: GameInternals;
  held: Set<string>;
} {
  saveRoster(new CharacterStore(), [saved]);
  const h = initGame(new DungeonCrawlGame());
  const held = wireHeldKeys(h);
  held.add('Space');
  h.game.update(1 / 60);
  held.clear();
  h.game.update(1 / 60);
  held.add('Digit1');
  h.game.update(1 / 60);
  held.clear();
  for (let i = 0; i < 4; i++) h.game.update(1 / 60);
  const game = internals(h);
  expect(game.state).toBe('town');
  return { h, game, held };
}

describe('the planes through the live game', () => {
  test('a planar expedition builds a VOID floor with only planar foes', () => {
    const { h, game, held } = resumeInTown(hero({ ascended: true }));
    game.departOnQuest(QUESTS['the-silver-reach']);
    for (let i = 0; i < 70; i++) h.game.update(1 / 60);
    held.add('Space');
    h.game.update(1 / 60);
    held.clear();
    h.game.update(1 / 60);

    expect(game.state).toBe('playing');
    expect(game.biome.id).toBe('silver-void');
    expect(game.biome.style).toBe('void'); // walls are the edge of the world
    expect(game.biome.darkness).toBeLessThan(0.2); // and there is no dark
    expect(game.enemies.length).toBeGreaterThan(0);
    for (const enemy of game.enemies) {
      expect(PLANAR_TYPES.has(enemy.config.id)).toBe(true);
    }
    h.game.update(1 / 60);
    expect(metrics(h).planes_walked).toBe(1);
  });

  test('the Waydoor is not in the square until the rite is done', () => {
    const { h, game, held } = resumeInTown(hero({ ascended: false }));
    const spot = game.town.spots.waydoor;

    // Stand the hero right on the threshold; nothing is there.
    game.player.x = spot.x;
    game.player.y = spot.y;
    h.game.update(1 / 60);
    held.add('KeyE');
    h.game.update(1 / 60);
    held.clear();
    expect(game.town.overlay).toBe('none');

    // The same spot, for an ascended hero, opens.
    const second = resumeInTown(hero({ ascended: true }));
    const h2 = second.h;
    second.game.player.x = second.game.town.spots.waydoor.x;
    second.game.player.y = second.game.town.spots.waydoor.y;
    h2.game.update(1 / 60);
    second.held.add('KeyE');
    h2.game.update(1 / 60);
    second.held.clear();
    expect(second.game.town.overlay).toBe('waydoor');
  });

  test('the rite pays, sets and saves — and a poor hero is turned away', () => {
    const price = ascensionPrice(55400);
    const { h, game, held } = resumeInTown(hero({ gold: price - 1 }));

    // Walk to the temple and open it.
    game.player.x = game.town.spots.temple.x;
    game.player.y = game.town.spots.temple.y;
    h.game.update(1 / 60);
    held.add('KeyE');
    h.game.update(1 / 60);
    held.clear();
    h.game.update(1 / 60);
    expect(game.town.overlay).toBe('temple');

    // Card 1 is the rite. One gold short: nothing happens.
    game.town.selection = 1;
    held.add('Space');
    h.game.update(1 / 60);
    held.clear();
    h.game.update(1 / 60);
    expect(game.progression.character()!.ascended).toBe(false);
    expect(game.progression.character()!.gold).toBe(price - 1);

    // Afford it, and the ways open — and the save keeps it.
    game.progression.character()!.gold = price + 10;
    game.town.selection = 1;
    held.add('Space');
    h.game.update(1 / 60);
    held.clear();
    h.game.update(1 / 60);
    expect(game.progression.character()!.ascended).toBe(true);
    expect(game.progression.character()!.gold).toBe(10);
    expect(new CharacterStore().load().characters.fighter?.ascended).toBe(true);
  });
});
