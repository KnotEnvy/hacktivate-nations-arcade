// v5 Wave F tests: the equipment data contract, effect merging, weighted
// drops, persistence sanitize (slot-legality, stash whitelist/cap), Player
// folds beside gear/boons/stats, and the victory banking flow.

import {
  ALL_EQUIP_SLOTS,
  ALL_ITEM_IDS,
  bossItemWeights,
  ITEM_TUNING,
  ITEMS,
  itemsOfRarity,
  mergeItemEffects,
  Rarity,
  rollItemDrop,
} from '@/games/dungeon-crawl/data/items';
import { CLASSES } from '@/games/dungeon-crawl/data/classes';
import { STAT_BASES, STAT_TUNING, zeroStatMods } from '@/games/dungeon-crawl/data/stats';
import { Rng } from '@/games/dungeon-crawl/dungeon/rng';
import { Player } from '@/games/dungeon-crawl/entities/Player';
import { CharacterStore, SavedHero } from '@/games/dungeon-crawl/persistence/CharacterStore';
import { ProgressionController } from '@/games/dungeon-crawl/progression/ProgressionController';
import { Inventory } from '@/games/dungeon-crawl/systems/Inventory';

describe('items data contract', () => {
  test('twelve authored items, four per slot, original non-empty text', () => {
    expect(ALL_ITEM_IDS).toHaveLength(12);
    const names = new Set<string>();
    const perSlot: Record<string, number> = {};
    for (const id of ALL_ITEM_IDS) {
      const def = ITEMS[id];
      expect(def.id).toBe(id);
      expect(def.name.length).toBeGreaterThan(0);
      expect(def.blurb.length).toBeGreaterThan(0);
      expect(def.icon.length).toBeGreaterThan(0);
      expect(def.color).toMatch(/^#/);
      names.add(def.name);
      perSlot[def.slot] = (perSlot[def.slot] ?? 0) + 1;
    }
    expect(names.size).toBe(12);
    for (const slot of ALL_EQUIP_SLOTS) expect(perSlot[slot]).toBe(4);
  });

  test('every slot carries one common, two rares, one legendary', () => {
    for (const slot of ALL_EQUIP_SLOTS) {
      const rarities = ALL_ITEM_IDS.filter(id => ITEMS[id].slot === slot).map(
        id => ITEMS[id].rarity,
      );
      expect(rarities.filter(r => r === 'common')).toHaveLength(1);
      expect(rarities.filter(r => r === 'rare')).toHaveLength(2);
      expect(rarities.filter(r => r === 'legendary')).toHaveLength(1);
    }
  });

  test('every item does something; dupe gold covers every rarity ascending', () => {
    for (const id of ALL_ITEM_IDS) {
      const merged = mergeItemEffects([id]);
      const potency =
        merged.damage +
        merged.hp +
        merged.speed +
        merged.knockback +
        merged.daggerCap +
        Object.values(merged.statBonus).reduce((a, b) => a + (b ?? 0), 0);
      expect(potency).toBeGreaterThan(0);
    }
    expect(ITEM_TUNING.DUPE_GOLD.common).toBeLessThan(ITEM_TUNING.DUPE_GOLD.rare);
    expect(ITEM_TUNING.DUPE_GOLD.rare).toBeLessThan(ITEM_TUNING.DUPE_GOLD.legendary);
  });
});

describe('effect merging + drops', () => {
  test('mergeItemEffects composes flat fields and stat bonuses', () => {
    expect(mergeItemEffects([])).toEqual({
      damage: 0,
      hp: 0,
      speed: 0,
      knockback: 0,
      daggerCap: 0,
      statBonus: {},
    });
    const merged = mergeItemEffects(['dawnsliver', 'bulwark-of-the-deep', 'philosophers-ring']);
    expect(merged.damage).toBe(2);
    expect(merged.hp).toBe(4);
    expect(merged.speed).toBeCloseTo(0.04);
    expect(merged.statBonus).toEqual({ con: 1, int: 1, wis: 1 });
  });

  test('rollItemDrop is deterministic per seed and honors zeroed weights', () => {
    const weights = { common: 1, rare: 0, legendary: 0 } as Record<Rarity, number>;
    for (let seed = 1; seed <= 12; seed++) {
      const a = rollItemDrop(new Rng(seed), weights);
      expect(rollItemDrop(new Rng(seed), weights)).toBe(a);
      expect(ITEMS[a].rarity).toBe('common');
    }
    expect(itemsOfRarity('legendary')).toHaveLength(3);
  });

  test('boss weights shift toward legendary with the kit tier', () => {
    expect(bossItemWeights(1).legendary).toBeLessThan(bossItemWeights(3).legendary);
    expect(bossItemWeights(3).legendary).toBeLessThan(bossItemWeights(5).legendary);
    expect(bossItemWeights(5).common).toBeLessThan(bossItemWeights(1).common);
  });
});

describe('Player equipment folds', () => {
  function armedFighter(): Player {
    const player = new Player();
    player.reset(0, 0);
    player.applyKit(CLASSES.fighter);
    player.applyProgression({ hp: 0, speed: 0, daggerCap: 0 }, {});
    return player;
  }

  test('flat effects fold beside gear/boons/stats; bare bag is a no-op', () => {
    const bare = armedFighter();
    const geared = armedFighter();
    geared.applyEquipment(mergeItemEffects(['dawnsliver', 'wardens-mail', 'hawks-eye-locket']));
    expect(geared.swordDamage()).toBe(bare.swordDamage() + 2);
    expect(geared.maxHp).toBe(bare.maxHp + 4);
    expect(geared.hp).toBe(geared.maxHp);
    expect(geared.speed()).toBeGreaterThan(bare.speed());
    expect(geared.daggerCap()).toBe(bare.daggerCap() + 1);
    bare.applyEquipment(mergeItemEffects([]));
    expect(bare.maxHp).toBe(armedFighter().maxHp);
  });

  test('swapping armor off lowers the ceiling without killing the wearer', () => {
    const player = armedFighter();
    player.applyEquipment(mergeItemEffects(['wardens-mail'])); // +4
    const worn = player.maxHp;
    player.hp = 2;
    player.applyEquipment(mergeItemEffects(['padded-jack'])); // +2: delta -2
    expect(player.maxHp).toBe(worn - 2);
    expect(player.hp).toBeGreaterThanOrEqual(1);
  });

  test('one pinned composition: kit + boon + gear + stat delta + item', () => {
    const player = new Player();
    player.reset(0, 0);
    player.applyKit(CLASSES.fighter);
    player.applyProgression(
      { hp: 0, speed: 0, daggerCap: 0 },
      { 'weapon-specialization': 1 },
      { blade: 1 },
      { ...zeroStatMods(), str: 1 },
    );
    player.applyEquipment(mergeItemEffects(['soldiers-edge']));
    // 1 base + 0 fighter kit + 1 spec + 1 blade tier + 1 STR + 1 item = 5
    expect(player.swordDamage()).toBe(5);
  });

  test('equipment stat bonuses reach the deltas via equippedStatDeltas', () => {
    const store = new CharacterStore();
    window.localStorage.setItem(
      store.key(),
      JSON.stringify({
        version: 2,
        characters: { fighter: { classId: 'fighter', level: 1, xp: 0 } },
      }),
    );
    const ctrl = new ProgressionController();
    ctrl.load();
    ctrl.selectHero('fighter');
    // Flat-base fighter: zero deltas bare-handed.
    expect(ctrl.equippedStatDeltas([])).toEqual(zeroStatMods());
    // Girdle of the Ox: STR 17 -> 18 crosses a boundary (+1 delta).
    expect(ctrl.equippedStatDeltas(['girdle-of-the-ox']).str).toBe(1);
    // CHA 11 -> 12 crosses too (odd-adjacent), the rest stay zero.
    const withBone = ctrl.equippedStatDeltas(['lucky-knucklebone']);
    expect(withBone.cha).toBe(1);
    expect(withBone.str).toBe(0);
    expect(STAT_BASES.fighter.cha + 1).toBe(12); // documents the boundary
    expect(STAT_TUNING.SCORE_MAX).toBe(18);
  });
});

describe('the satchel + victory banking', () => {
  function testHero(overrides?: Partial<SavedHero>): SavedHero {
    return {
      classId: 'fighter',
      name: 'SIR ROWAN',
      level: 3,
      xp: 450,
      boons: {},
      createdAt: 0,
      stats: { expeditions: 1, deaths: 0, victories: 0 },
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

  function makeInventory(hero: SavedHero | null, inTown = false): Inventory {
    return new Inventory({
      hero: () => hero,
      inTown: () => inTown,
      save: () => {},
      playSound: () => {},
      showBanner: () => {},
      refreshFolds: () => {},
      onItemFound: () => {},
    });
  }

  test('the satchel holds six; the seventh find stays where it lies', () => {
    const inv = makeInventory(testHero());
    for (let i = 0; i < ITEM_TUNING.SATCHEL_MAX; i++) {
      expect(inv.tryCollect(ALL_ITEM_IDS[i])).toBe(true);
    }
    expect(inv.tryCollect('philosophers-ring')).toBe(false);
    expect(inv.satchel).toHaveLength(ITEM_TUNING.SATCHEL_MAX);
  });

  test('victory banks the worn set and the satchel; duplicates convert to gold', () => {
    const hero = testHero({ stash: ['padded-jack'] });
    const inv = makeInventory(hero);
    inv.equipped = { weapon: 'dawnsliver' };
    inv.satchel = ['wardens-mail', 'padded-jack']; // second jack = a dupe
    const { bankedCount, dupeGold } = inv.bankOnVictory(hero);
    expect(hero.equipment).toEqual({ weapon: 'dawnsliver' });
    expect(hero.stash).toEqual(['padded-jack', 'wardens-mail']);
    expect(bankedCount).toBe(1);
    expect(dupeGold).toBe(ITEM_TUNING.DUPE_GOLD.common);
    expect(inv.satchel).toEqual([]);
  });

  test('death writes nothing: unbanked finds are simply lost (and counted)', () => {
    const hero = testHero({ equipment: { armor: 'padded-jack' }, stash: ['soldiers-edge'] });
    const inv = makeInventory(hero);
    inv.armFromHero(hero);
    inv.satchel = ['dawnsliver', 'philosophers-ring'];
    inv.equipped = { ...inv.equipped, weapon: 'giants-knuckle' }; // run find, worn
    // No banking call — the death path never touches the hero.
    expect(hero.equipment).toEqual({ armor: 'padded-jack' });
    expect(hero.stash).toEqual(['soldiers-edge']);
    expect(inv.lostCount(hero)).toBe(3); // two in the satchel + the worn run find
  });

  test('town mode edits the saved hero directly and swaps to the stash', () => {
    const hero = testHero({ equipment: { weapon: 'soldiers-edge' }, stash: ['dawnsliver'] });
    const inv = makeInventory(hero, true);
    inv.update(
      {
        isKeyPressed: (code: string) => code === 'Space',
        isUpPressed: () => false,
        isDownPressed: () => false,
      },
      { navUpWas: false, navDownWas: false, confirmWas: false },
    );
    expect(hero.equipment).toEqual({ weapon: 'dawnsliver' });
    expect(hero.stash).toEqual(['soldiers-edge']);
  });
});

describe('persistence sanitize (mirrors the gear/sagas clamp pattern)', () => {
  test('slot-illegal and foreign equips drop; the stash whitelists, dedups and caps', () => {
    const store = new CharacterStore();
    window.localStorage.setItem(
      store.key(),
      JSON.stringify({
        version: 2,
        characters: {
          fighter: {
            classId: 'fighter',
            level: 3,
            xp: 450,
            equipment: {
              weapon: 'dawnsliver', // legal
              armor: 'soldiers-edge', // a weapon in the armor slot — drops
              trinket: 'crown-of-lies', // foreign id — drops
            },
            stash: [
              'padded-jack',
              'padded-jack', // dupe — whitelist keeps one
              'not-an-item',
              ...ALL_ITEM_IDS, // overflow — capped at STASH_MAX
            ],
          },
          // A pre-Wave-F veteran: no item fields at all.
          thief: { classId: 'thief', level: 5, xp: 1500 },
        },
      }),
    );

    const payload = store.load();
    expect(payload.characters.fighter?.equipment).toEqual({ weapon: 'dawnsliver' });
    const stash = payload.characters.fighter?.stash ?? [];
    expect(stash.length).toBeLessThanOrEqual(ITEM_TUNING.STASH_MAX);
    expect(new Set(stash).size).toBe(stash.length); // deduped
    expect(stash).not.toContain('not-an-item');
    expect(payload.characters.thief?.equipment).toEqual({});
    expect(payload.characters.thief?.stash).toEqual([]);
  });
});
