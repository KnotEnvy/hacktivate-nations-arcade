// Bestiary tests for DungeonCrawlGame v3 wave 2 (development suite only).
//
// Pins the per-biome spawn tables (pure function), the enemy config contract
// (splitters, undead tags, complete death-cause mapping), and biome coverage.

import { BIOMES, biomeForFloor } from '@/games/dungeon-crawl/data/constants';
import {
  ENEMY_CONFIGS,
  EnemyTypeId,
  spawnWeightsForFloor,
} from '@/games/dungeon-crawl/data/enemies';
import { Enemy } from '@/games/dungeon-crawl/entities/Enemy';
import { ALL_PLANE_IDS } from '@/games/dungeon-crawl/data/planes';
import { causeForEnemy } from '@/games/dungeon-crawl/systems/Combat';

const ALL_TYPE_IDS = Object.keys(ENEMY_CONFIGS) as EnemyTypeId[];

/**
 * Wave Q2 — the families that live past the gate. Derived from the plane
 * tables themselves rather than hand-listed, so a new planar family joins this
 * set automatically and a dungeon family can never sneak into it.
 */
const PLANAR_TYPES = new Set<EnemyTypeId>(
  ALL_PLANE_IDS.flatMap(id => spawnWeightsForFloor(1, id).map(r => r.type)),
);

/** Types that can be picked for (floor, biome) — weight > 0 rows only. */
function spawnableTypes(floor: number, biomeId: string): Set<EnemyTypeId> {
  return new Set(
    spawnWeightsForFloor(floor, biomeId)
      .filter(r => r.weight > 0)
      .map(r => r.type),
  );
}

describe('enemy config contract', () => {
  test('every config id matches its key and has drawable colors', () => {
    for (const id of ALL_TYPE_IDS) {
      const config = ENEMY_CONFIGS[id];
      expect(config.id).toBe(id);
      expect(config.hp).toBeGreaterThan(0);
      expect(config.speed).toBeGreaterThan(0);
      expect(config.size).toBeGreaterThan(0);
      expect(config.color).toMatch(/^#/);
      expect(config.accent).toMatch(/^#/);
    }
  });

  test('splitters divide into real, weaker monsters', () => {
    const splitters = ALL_TYPE_IDS.filter(id => ENEMY_CONFIGS[id].splitsInto);
    expect(splitters).toEqual(expect.arrayContaining(['slime', 'deep-ooze']));
    for (const id of splitters) {
      const child = ENEMY_CONFIGS[id].splitsInto!;
      expect(ENEMY_CONFIGS[child]).toBeDefined();
      expect(ENEMY_CONFIGS[child].hp).toBeLessThan(ENEMY_CONFIGS[id].hp);
      expect(ENEMY_CONFIGS[child].splitsInto).toBeUndefined(); // no infinite mitosis
    }
  });

  test('the restless dead are tagged for Turn Undead', () => {
    const undead = ALL_TYPE_IDS.filter(id => ENEMY_CONFIGS[id].undead);
    // v4 Wave D consciously added: bone-archer, drowned-one, ember-wight.
    // Wave P consciously added: barrow-hound (the barrows kept their own dogs).
    expect(new Set(undead)).toEqual(
      new Set([
        'skeleton',
        'wraith',
        'zombie',
        'ghoul',
        'shade',
        'bone-archer',
        'drowned-one',
        'ember-wight',
        'barrow-hound',
      ]),
    );
  });

  test('every monster maps to a death cause', () => {
    for (const id of ALL_TYPE_IDS) {
      const enemy = new Enemy(id, 0, 0);
      expect(typeof causeForEnemy(enemy)).toBe('string');
    }
  });
});

describe('per-biome spawn tables', () => {
  test('biome families stay home', () => {
    // Probe deep enough that every gate is open (floor 13+ = all gates passed).
    // Wave P consciously added one member per family (slag-thrall, barrow-hound,
    // brine-weird, cinder-bloat) — each stays as home-bound as its elders.
    const homes: Array<[string, EnemyTypeId[]]> = [
      ['ember', ['fire-beetle', 'salamander', 'slag-thrall']],
      ['bone', ['zombie', 'ghoul', 'bone-archer', 'barrow-hound']],
      ['sunken', ['deep-ooze', 'lizardman', 'drowned-one', 'brine-weird']],
      ['ash', ['shade', 'cinder-hound', 'ember-wight', 'cinder-bloat']],
    ];
    for (const [home, family] of homes) {
      for (const biome of BIOMES) {
        const types = spawnableTypes(13, biome.id);
        for (const member of family) {
          expect(types.has(member)).toBe(biome.id === home);
        }
      }
    }
  });

  test('floor 1 (ember) offers only the gentle set', () => {
    const types = spawnableTypes(1, 'ember');
    expect(types).toEqual(new Set(['slime', 'skeleton', 'fire-beetle']));
  });

  test('v2 floor gates are unchanged by the biome refactor', () => {
    for (const biome of BIOMES) {
      expect(spawnableTypes(1, biome.id).has('bat')).toBe(false);
      expect(spawnableTypes(2, biome.id).has('knight')).toBe(false);
      expect(spawnableTypes(3, biome.id).has('wraith')).toBe(false);
      expect(spawnableTypes(4, biome.id).has('knight')).toBe(true);
      expect(spawnableTypes(4, biome.id).has('mimic')).toBe(true);
    }
  });

  test('v4 Wave D — the gargoyle stirs everywhere, but only below floor 8', () => {
    for (const biome of BIOMES) {
      expect(spawnableTypes(7, biome.id).has('gargoyle')).toBe(false);
      expect(spawnableTypes(8, biome.id).has('gargoyle')).toBe(true);
    }
  });

  test('every ambient floor through 20 has at least one spawnable type', () => {
    for (let floor = 1; floor <= 20; floor++) {
      const types = spawnableTypes(floor, biomeForFloor(floor).id);
      expect(types.size).toBeGreaterThan(0);
    }
  });

  test('every DUNGEON monster type is reachable on some floor within a long run', () => {
    const seen = new Set<EnemyTypeId>();
    for (let floor = 1; floor <= 20; floor++) {
      for (const type of spawnableTypes(floor, biomeForFloor(floor).id)) seen.add(type);
    }
    // Everything except the split-spawn minis should appear in spawn tables.
    // Wave Q2 — CONSCIOUS narrowing: the planar families are deliberately
    // unreachable by descending. No amount of digging finds them; only a hero
    // who has ascended and taken a planar contract ever meets one. That they
    // are reachable through their OWN plane is asserted just below.
    for (const id of ALL_TYPE_IDS) {
      if (id === 'slime-mini' || id === 'ooze-mini') continue;
      if (PLANAR_TYPES.has(id)) {
        expect(seen.has(id)).toBe(false);
        continue;
      }
      expect(seen.has(id)).toBe(true);
    }
  });

  test('every PLANAR type is reachable, and only through its own plane', () => {
    const homes = new Map<EnemyTypeId, string[]>();
    for (const planeId of ALL_PLANE_IDS) {
      for (const type of spawnableTypes(1, planeId)) {
        // A plane never fields anything from the depths.
        expect(PLANAR_TYPES.has(type)).toBe(true);
        homes.set(type, [...(homes.get(type) ?? []), planeId]);
      }
    }
    for (const id of PLANAR_TYPES) {
      expect(homes.get(id) ?? []).toHaveLength(1); // exactly one home, no tourists
    }
  });
});
