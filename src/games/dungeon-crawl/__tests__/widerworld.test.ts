// Wave P tests: THE WIDER WORLD. Pins the five new families (config contract,
// biome homing, floor gates, the light the wisp carries, the causes they kill
// under), the two per-biome sagas (data contract, unique finales OFF the tier
// rotation, and the founding-gate promise that a veteran's last page is never
// re-locked), and the town's saga dressing (pure helpers + the live game).

import {
  BIOMES,
  mixHex,
} from '@/games/dungeon-crawl/data/constants';
import {
  ENEMY_CONFIGS,
  EnemyTypeId,
  spawnWeightsForFloor,
} from '@/games/dungeon-crawl/data/enemies';
import {
  BOSS_KITS,
  bossKitById,
  bossKitForTier,
  UNIQUE_BOSS_KITS,
} from '@/games/dungeon-crawl/data/bosses';
import { QUESTS, QuestId } from '@/games/dungeon-crawl/data/quests';
import {
  ALL_SAGA_IDS,
  liveSagaId,
  metaUnlocked,
  SAGAS,
  SagaId,
  storyComplete,
  visibleSagaIds,
} from '@/games/dungeon-crawl/data/sagas';
import { storyStage } from '@/games/dungeon-crawl/data/npcs';
import { STAT_BASES } from '@/games/dungeon-crawl/data/stats';
import { DungeonCrawlGame } from '@/games/dungeon-crawl/DungeonCrawlGame';
import { Enemy } from '@/games/dungeon-crawl/entities/Enemy';
import { gatherLights } from '@/games/dungeon-crawl/rendering/lights';
import { Player } from '@/games/dungeon-crawl/entities/Player';
import { causeForEnemy } from '@/games/dungeon-crawl/systems/Combat';
import {
  CharacterStore,
  SavedHero,
  SavePayloadV2,
} from '@/games/dungeon-crawl/persistence/CharacterStore';
import { TOWN_PALETTE, TownController } from '@/games/dungeon-crawl/town/TownController';
import { initGame, type Harness } from '@/games/shared/gameTestHarness';

let randomSpy: jest.SpyInstance;
beforeEach(() => {
  randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.42);
});
afterEach(() => {
  randomSpy.mockRestore();
});

/** The wave's five, and where each of them belongs. */
const NEW_FAMILIES: Array<[EnemyTypeId, string | null, number]> = [
  ['slag-thrall', 'ember', 3],
  ['barrow-hound', 'bone', 3],
  ['brine-weird', 'sunken', 4],
  ['cinder-bloat', 'ash', 5],
  ['lantern-wisp', null, 10], // no home: the deep itself
];

function spawnableTypes(floor: number, biomeId: string): Set<EnemyTypeId> {
  return new Set(
    spawnWeightsForFloor(floor, biomeId)
      .filter(r => r.weight > 0)
      .map(r => r.type),
  );
}

// ------------------------------------------------------------ the new families

describe('the wider bestiary', () => {
  test('all five are fully authored monsters', () => {
    for (const [id] of NEW_FAMILIES) {
      const config = ENEMY_CONFIGS[id];
      expect(config.id).toBe(id);
      expect(config.hp).toBeGreaterThan(0);
      expect(config.speed).toBeGreaterThan(0);
      expect(config.xp).toBeGreaterThan(0);
      expect(config.color).toMatch(/^#/);
      expect(config.accent).toMatch(/^#/);
      expect(config.touchDamage.d).toBeGreaterThan(0);
      // Every new kill names its killer in the recap.
      expect(typeof causeForEnemy(new Enemy(id, 0, 0))).toBe('string');
    }
  });

  test('the ranged one declares its bolts (the ranged-config contract)', () => {
    const weird = ENEMY_CONFIGS['brine-weird'];
    expect(weird.behavior).toBe('ranged');
    expect(weird.boltCause).toBe('brine_lash');
    expect(weird.boltDamage?.d).toBeGreaterThan(0);
  });

  test('each biome member stays home; the wisp belongs to none of them', () => {
    for (const [id, home] of NEW_FAMILIES) {
      for (const biome of BIOMES) {
        // Floor 13 clears every gate in the table.
        const present = spawnableTypes(13, biome.id).has(id);
        expect(present).toBe(home === null ? true : biome.id === home);
      }
    }
  });

  test('every new family respects its floor gate on both sides', () => {
    for (const [id, home, gate] of NEW_FAMILIES) {
      const biome = home ?? 'ember';
      expect(spawnableTypes(gate - 1, biome).has(id)).toBe(false);
      expect(spawnableTypes(gate, biome).has(id)).toBe(true);
    }
  });

  test('floor 1 is still the gentle set', () => {
    expect(spawnableTypes(1, 'ember')).toEqual(new Set(['slime', 'skeleton', 'fire-beetle']));
  });

  test('the lantern wisp carries its own light; the thrall carries none', () => {
    const wisp = new Enemy('lantern-wisp', 100, 100);
    const thrall = new Enemy('slag-thrall', 300, 300);
    const view = {
      player: { x: 0, y: 0, torchBonus: () => 0 } as unknown as Player,
      torches: [],
      enemies: [wisp, thrall],
      stairsLocked: true,
      stairsCenter: { x: 0, y: 0 },
      merchant: null,
      townSpots: null,
      boss: null,
    };
    const lit = gatherLights(view).filter(l => l.x === 100 && l.y === 100);
    expect(lit).toHaveLength(1);
    expect(lit[0].radius).toBeGreaterThan(0);
    expect(gatherLights(view).some(l => l.x === 300 && l.y === 300)).toBe(false);

    // A dead wisp lights nothing — the lure goes out with it.
    wisp.alive = false;
    expect(gatherLights(view).some(l => l.x === 100 && l.y === 100)).toBe(false);
  });
});

// ------------------------------------------------------------------ the sagas

describe('a tale per biome', () => {
  test('five arcs, each anchored and fully authored', () => {
    expect(ALL_SAGA_IDS).toHaveLength(5);
    for (const id of ['drowned-choir', 'ash-remembers'] as SagaId[]) {
      const saga = SAGAS[id];
      expect(saga.quests).toHaveLength(3);
      expect(saga.interludes).toHaveLength(saga.quests.length);
      expect(saga.dressing.color).toMatch(/^#/);
      expect(saga.dressing.banner.length).toBeGreaterThan(0);
      // Every chapter is saga-flagged, in one biome, and climbs in level.
      let prevLevel = 0;
      const biomes = new Set<string | null>();
      for (const qid of saga.quests) {
        const quest = QUESTS[qid as QuestId];
        expect(quest.saga).toBe(true);
        expect(quest.minLevel).toBeGreaterThanOrEqual(prevLevel);
        prevLevel = quest.minLevel;
        biomes.add(quest.biomeId);
      }
      expect(biomes.size).toBe(1);
    }
    expect(QUESTS['the-flood-cantor'].biomeId).toBe('sunken');
    expect(QUESTS['the-grey-effigy'].biomeId).toBe('ash');
  });

  test('every arc now has dressing, and the meta arc reads last', () => {
    for (const id of ALL_SAGA_IDS) expect(SAGAS[id].dressing.color).toMatch(/^#/);
    expect(ALL_SAGA_IDS[ALL_SAGA_IDS.length - 1]).toBe('the-last-page');
  });

  test('the new finales pin unique kits that never enter the tier rotation', () => {
    for (const kitId of ['flood-cantor', 'grey-effigy'] as const) {
      expect(UNIQUE_BOSS_KITS.some(k => k.id === kitId)).toBe(true);
      expect(BOSS_KITS.some(k => k.id === kitId)).toBe(false);
      expect(bossKitById(kitId).id).toBe(kitId);
    }
    expect(QUESTS['the-flood-cantor'].bossKitId).toBe('flood-cantor');
    expect(QUESTS['the-grey-effigy'].bossKitId).toBe('grey-effigy');
    // The classic rotation is untouched through two full cycles.
    const rotation = [1, 2, 3, 4, 5, 6, 7, 8, 9].map(t => bossKitForTier(t).id);
    expect(rotation).toEqual([
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

  test('THE VETERAN PROMISE: new arcs never re-lock an earned last page', () => {
    const foundingTold = {
      'pale-procession': SAGAS['pale-procession'].quests.length,
      'undying-ember': SAGAS['undying-ember'].quests.length,
    };
    // The two arcs Wave P added are untouched — the capstone still opens.
    expect(metaUnlocked(foundingTold)).toBe(true);
    expect(visibleSagaIds(foundingTold)).toContain('the-last-page');

    // And once it is told, the townsfolk stay in their aftermath even though
    // the side tales have never been started.
    const storyDone = {
      ...foundingTold,
      'the-last-page': SAGAS['the-last-page'].quests.length,
    };
    expect(storyComplete(storyDone)).toBe(true);
    expect(
      storyStage({ level: 10, sagas: storyDone } as { level: number; sagas: typeof storyDone }),
    ).toBe('aftermath');

    // Telling only the NEW arcs opens nothing — the gate is the founding pair.
    const sideOnly = { 'drowned-choir': 3, 'ash-remembers': 3 };
    expect(metaUnlocked(sideOnly)).toBe(false);
    expect(visibleSagaIds(sideOnly)).not.toContain('the-last-page');
  });
});

// ------------------------------------------------------------- town dressing

describe('liveSagaId', () => {
  test('nothing started, nothing live', () => {
    expect(liveSagaId(undefined)).toBeNull();
    expect(liveSagaId({})).toBeNull();
  });

  test('a started, unfinished arc is the live one', () => {
    expect(liveSagaId({ 'drowned-choir': 1 })).toBe('drowned-choir');
    expect(liveSagaId({ 'drowned-choir': 2 })).toBe('drowned-choir');
  });

  test('a told arc is no longer live', () => {
    expect(liveSagaId({ 'drowned-choir': SAGAS['drowned-choir'].quests.length })).toBeNull();
    // Over-count (a corrupt save) clamps to told, never to live.
    expect(liveSagaId({ 'drowned-choir': 99 })).toBeNull();
  });

  test('two live tales resolve in declaration order, never by chance', () => {
    const both = { 'pale-procession': 1, 'ash-remembers': 1 };
    expect(liveSagaId(both)).toBe('pale-procession');
    expect(liveSagaId(both)).toBe('pale-procession');
  });
});

describe('the dressed town', () => {
  test('mixHex walks between two colours and survives bad data', () => {
    expect(mixHex('#000000', '#ffffff', 0)).toBe('#000000');
    expect(mixHex('#000000', '#ffffff', 1)).toBe('#ffffff');
    expect(mixHex('#000000', '#ffffff', 0.5)).toBe('#808080');
    expect(mixHex('#000000', '#ffffff', 5)).toBe('#ffffff'); // clamped
    expect(mixHex('#123456', 'not-a-colour', 0.5)).toBe('#123456'); // total
  });

  test('no live arc leaves Lastlight bit-for-bit as it was', () => {
    expect(TownController.dressedPalette(null)).toBe(TOWN_PALETTE);
  });

  test('a live arc tints the torchlight without repainting the town', () => {
    const dressed = TownController.dressedPalette(SAGAS['drowned-choir']);
    expect(dressed).not.toBe(TOWN_PALETTE);
    expect(dressed.id).toBe(TOWN_PALETTE.id);
    expect(dressed.hazardStyle).toBe(TOWN_PALETTE.hazardStyle);
    // The flame moves the most; the floor barely at all.
    expect(dressed.flameOuter).not.toBe(TOWN_PALETTE.flameOuter);
    expect(dressed.wallTop).not.toBe(TOWN_PALETTE.wallTop);
    expect(dressed.floorCrack).toBe(TOWN_PALETTE.floorCrack);
  });

  test('the square has cloths to hang, and none of them stands on a walker', () => {
    const town = new TownController();
    expect(town.banners.length).toBeGreaterThanOrEqual(3);
    for (const banner of town.banners) {
      for (const station of Object.values(town.spots)) {
        expect(Math.hypot(station.x - banner.x, station.y - banner.y)).toBeGreaterThan(20);
      }
    }
  });
});

// --------------------------------------------------------------- live harness

interface GameInternals {
  state: string;
  biome: { flameOuter: string; id: string };
  progression: { load(): void; selectHero(classId: string): SavedHero | null };
}

function internals(h: Harness): GameInternals {
  return h.game as unknown as GameInternals;
}

function heroWithSagas(sagas: Partial<Record<SagaId, number>>): SavedHero {
  return {
    classId: 'fighter',
    name: 'SIR ROWAN',
    level: 6,
    xp: 900,
    boons: {},
    createdAt: 0,
    stats: { expeditions: 3, deaths: 0, victories: 2 },
    gold: 300,
    gear: {},
    provisions: [],
    sagas,
    spells: [],
    scores: { ...STAT_BASES.fighter },
    equipment: {},
    stash: [],
    lineage: 'human',
    hpRolls: [6, 6, 6, 6, 6],
    curse: null,
  };
}

function seedHero(hero: SavedHero): void {
  const store = new CharacterStore();
  const characters: SavePayloadV2['characters'] = {};
  characters[hero.classId] = hero;
  window.localStorage.setItem(store.key(), JSON.stringify({ version: 2, characters }));
}

/** Title -> roster -> Lastlight, resuming the seeded fighter. */
function resumeInTown(h: Harness): GameInternals {
  const held = new Set<string>();
  const input = h.services.input as unknown as { isKeyPressed: jest.Mock };
  input.isKeyPressed.mockImplementation((code: string) => held.has(code));
  held.add('Space');
  h.game.update(1 / 60);
  held.clear();
  h.game.update(1 / 60);
  held.add('Digit1');
  h.game.update(1 / 60);
  held.clear();
  h.game.update(1 / 60);
  const game = internals(h);
  expect(game.state).toBe('town');
  return game;
}

describe('Lastlight wears the live tale', () => {
  test('a hero mid-arc walks into a town dressed for it', () => {
    seedHero(heroWithSagas({ 'drowned-choir': 1 }));
    const game = resumeInTown(initGame(new DungeonCrawlGame()));
    expect(game.biome.flameOuter).toBe(
      TownController.dressedPalette(SAGAS['drowned-choir']).flameOuter,
    );
  });

  test('a hero with nothing running gets the town exactly as it always was', () => {
    seedHero(heroWithSagas({}));
    const game = resumeInTown(initGame(new DungeonCrawlGame()));
    expect(game.biome.flameOuter).toBe(TOWN_PALETTE.flameOuter);
  });

  test('a hero who finished their arc gets the undressed town back', () => {
    seedHero(heroWithSagas({ 'drowned-choir': SAGAS['drowned-choir'].quests.length }));
    const game = resumeInTown(initGame(new DungeonCrawlGame()));
    expect(game.biome.flameOuter).toBe(TOWN_PALETTE.flameOuter);
  });
});
