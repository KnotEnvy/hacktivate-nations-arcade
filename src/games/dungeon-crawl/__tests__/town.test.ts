// v4 Wave B tests: quest + gear + provision data contracts, the Lastlight
// town map's integrity, quest-shaped floor generation, and the expedition /
// victory / provision flows (dev-test internals pokes where rng-driven
// steering would be impractical).

import {
  ALCHEMIST_PROVISION_IDS,
  ALL_GEAR_IDS,
  ALL_PROVISION_IDS,
  GEAR,
  GEAR_TUNING,
  GearId,
  masterworkSealed,
  PROVISIONS,
  TEMPLE_PROVISION_IDS,
} from '@/games/dungeon-crawl/data/gear';
import { CLASSES } from '@/games/dungeon-crawl/data/classes';
import { STAT_BASES } from '@/games/dungeon-crawl/data/stats';
import { Player } from '@/games/dungeon-crawl/entities/Player';
import type { SavedHero } from '@/games/dungeon-crawl/persistence/CharacterStore';
import type { TownCtx } from '@/games/dungeon-crawl/town/TownController';
import {
  ALL_QUEST_IDS,
  boardQuestIds,
  NOVICE_CONTRACT_IDS,
  QUESTS,
  STANDALONE_QUEST_IDS,
  VETERAN_BOARD_LEVEL,
  VETERAN_CONTRACT_IDS,
} from '@/games/dungeon-crawl/data/quests';
import { STAT_TUNING, statModDeltas } from '@/games/dungeon-crawl/data/stats';
import { DungeonCrawlGame } from '@/games/dungeon-crawl/DungeonCrawlGame';
import { generateFloor, isReachable } from '@/games/dungeon-crawl/dungeon/DungeonGenerator';
import { Tile } from '@/games/dungeon-crawl/dungeon/TileMap';
import { CharacterStore } from '@/games/dungeon-crawl/persistence/CharacterStore';
import { TownController } from '@/games/dungeon-crawl/town/TownController';
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

/** Dev-test internals view of the game (poking what rng-steering can't reach). */
interface GameInternals {
  departOnQuest(quest: (typeof QUESTS)[keyof typeof QUESTS]): void;
  openVictory(): void;
  loadFloor(): void;
  floor: number;
  boss: { kit: { id: string } } | null;
  goldBalance: number;
  player: { daggers: number; provisionTorch: number };
}

function internals(h: Harness): GameInternals {
  return h.game as unknown as GameInternals;
}

function metrics(h: Harness): Record<string, number> {
  return h.game.getScore!() as unknown as Record<string, number>;
}

describe('quest data contract', () => {
  test('nine standalone quests authored, endless included', () => {
    // v4 Wave C — saga chapters joined QUESTS but stay OFF the classic page.
    // v5 Wave G — THE LAST PAGE meta-saga adds three more (12 -> 15).
    // Wave P — two per-biome arcs add six more (15 -> 21).
    // Wave Q2 — THE PLANES adds eight (21 -> 29): four planar contracts and
    // the road's four chapters. Planar work is posted at the Waydoor, never
    // in town, so the classic page was unchanged by it.
    // Wave R — the VETERAN TIER authors four more standalone contracts
    // (29 -> 33). STANDALONE_QUEST_IDS is now the DATA set (9: both contract
    // tiers plus endless); what the board SHOWS is boardQuestIds(level),
    // which is still exactly five cards. Both are pinned below.
    expect(STANDALONE_QUEST_IDS).toHaveLength(9);
    expect(ALL_QUEST_IDS).toHaveLength(33);
    expect(new Set(ALL_QUEST_IDS).size).toBe(33);
    expect(QUESTS.endless.floors).toBe(0);
    for (const id of STANDALONE_QUEST_IDS) {
      expect(QUESTS[id].saga).toBeUndefined();
    }
    for (const id of ALL_QUEST_IDS) {
      const quest = QUESTS[id];
      expect(quest.id).toBe(id);
      expect(quest.name.length).toBeGreaterThan(0);
      expect(quest.blurb.length).toBeGreaterThan(0);
      expect(quest.minLevel).toBeGreaterThanOrEqual(1);
      if (quest.floors > 0) {
        expect(quest.bossTier).toBeGreaterThanOrEqual(1);
        expect(quest.rewardGold).toBeGreaterThan(0);
        expect(quest.rewardXp).toBeGreaterThan(0);
        expect(quest.biomeId).toBeTruthy();
      }
    }
  });
});

// ------------------------------------------------------------- veteran tier

describe('Wave R — the veteran contract tier', () => {
  test('one veteran contract per biome, each a real step up from its novice', () => {
    expect(VETERAN_CONTRACT_IDS).toHaveLength(4);
    expect(NOVICE_CONTRACT_IDS).toHaveLength(4);
    for (let i = 0; i < VETERAN_CONTRACT_IDS.length; i++) {
      const novice = QUESTS[NOVICE_CONTRACT_IDS[i]];
      const veteran = QUESTS[VETERAN_CONTRACT_IDS[i]];
      // Same biome, paired card for card.
      expect(veteran.biomeId).toBe(novice.biomeId);
      // Harder, longer, and worth walking down for.
      expect(veteran.floors).toBeGreaterThan(novice.floors);
      expect(veteran.bossTier).toBeGreaterThan(novice.bossTier);
      expect(veteran.rewardGold).toBeGreaterThan(novice.rewardGold);
      expect(veteran.rewardXp).toBeGreaterThan(novice.rewardXp);
      // Posted at the swap, and never anywhere but Lastlight's own board.
      expect(veteran.minLevel).toBe(VETERAN_BOARD_LEVEL);
      expect(veteran.saga).toBeUndefined();
      expect(veteran.planar).toBeUndefined();
      expect(veteran.bossKitId).toBeUndefined(); // uniques belong to the sagas
      // The briefing stays inside the voice budget.
      expect(veteran.intro.split(/\s+/)).not.toHaveLength(0);
      expect(veteran.intro.split(/\s+/).length).toBeLessThan(60);
    }
    // Every dungeon biome represented exactly once, mirroring the novice four.
    expect(new Set(VETERAN_CONTRACT_IDS.map(id => QUESTS[id].biomeId))).toEqual(
      new Set(NOVICE_CONTRACT_IDS.map(id => QUESTS[id].biomeId)),
    );
  });

  test('the board always posts exactly five cards, endless last', () => {
    for (const level of [1, 14, 15, 20, 99]) {
      const posted = boardQuestIds(level);
      expect(posted).toHaveLength(5);
      expect(new Set(posted).size).toBe(5);
      expect(posted[4]).toBe('endless');
    }
  });

  test('the swap happens at exactly 15, from both sides', () => {
    expect(boardQuestIds(VETERAN_BOARD_LEVEL - 1).slice(0, 4)).toEqual([...NOVICE_CONTRACT_IDS]);
    expect(boardQuestIds(VETERAN_BOARD_LEVEL).slice(0, 4)).toEqual([...VETERAN_CONTRACT_IDS]);
    // Below the line: novice work only, no veteran card leaks early.
    for (const level of [1, 5, 10, 14]) {
      const posted = boardQuestIds(level);
      for (const id of VETERAN_CONTRACT_IDS) expect(posted).not.toContain(id);
    }
    // At and above it: the novice four are gone, replaced one for one.
    for (const level of [15, 16, 20, 99]) {
      const posted = boardQuestIds(level);
      for (const id of NOVICE_CONTRACT_IDS) expect(posted).not.toContain(id);
      for (const id of VETERAN_CONTRACT_IDS) expect(posted).toContain(id);
    }
  });

  test('no saga chapter or planar contract ever reaches the board', () => {
    for (let level = 1; level <= 25; level++) {
      for (const id of boardQuestIds(level)) {
        expect(QUESTS[id].saga).toBeUndefined();
        expect(QUESTS[id].planar).toBeUndefined();
      }
    }
  });
});

describe('gear + provision contracts', () => {
  // Wave S — conscious update: MAX_TIER went 3 -> 4 (the MASTERWORK tier), so
  // the price tuple is a 4-tuple now. The assertion was NOT loosened — the
  // hand-unrolled ascent checks became a loop over every adjacent pair, which
  // covers strictly more (it now pins 2->3 as well) and cannot silently pass a
  // shorter tuple because the length is still pinned to MAX_TIER.
  test('four gear tracks, four tiers each, strictly ascending in price', () => {
    expect(ALL_GEAR_IDS).toHaveLength(4);
    for (const id of ALL_GEAR_IDS) {
      const gear = GEAR[id];
      expect(gear.id).toBe(id);
      expect(gear.prices).toHaveLength(GEAR_TUNING.MAX_TIER);
      expect(gear.prices).toHaveLength(4);
      for (let t = 1; t < gear.prices.length; t++) {
        expect(gear.prices[t]).toBeGreaterThan(gear.prices[t - 1]);
      }
    }
  });

  // Wave O — conscious update: the temple's three wares join the provision
  // machinery (6 total), but the alchemist's counter still lists exactly the
  // original three; the station lists partition the full set.
  test('six provisions, priced and authored, split across two counters', () => {
    expect(ALL_PROVISION_IDS).toHaveLength(6);
    for (const id of ALL_PROVISION_IDS) {
      expect(PROVISIONS[id].price).toBeGreaterThan(0);
      expect(PROVISIONS[id].blurb.length).toBeGreaterThan(0);
    }
    expect(ALCHEMIST_PROVISION_IDS).toEqual(['field-scroll', 'bandolier', 'blessed-candle']);
    expect(TEMPLE_PROVISION_IDS).toEqual(['rite-of-augury', 'warding-chrism', 'sellsword']);
    expect([...ALCHEMIST_PROVISION_IDS, ...TEMPLE_PROVISION_IDS].sort()).toEqual(
      [...ALL_PROVISION_IDS].sort(),
    );
  });
});

// ------------------------------------------------------- Wave S — masterwork

/** A saved hero standing at the blacksmith's counter. */
function smithHero(overrides: Partial<SavedHero> = {}): SavedHero {
  return {
    classId: 'fighter',
    name: 'SIR ROWAN',
    level: 10,
    xp: 5000,
    boons: {},
    createdAt: 0,
    stats: { expeditions: 1, deaths: 0, victories: 0 },
    gold: 5000,
    gear: {},
    provisions: [],
    sagas: {},
    spells: [],
    scores: { ...STAT_BASES.fighter },
    equipment: {},
    stash: [],
    lineage: 'human',
    hpRolls: [],
    curse: null,
    ascended: false,
    ...overrides,
  };
}

/** One track's tier, as the hero record carries it. */
function gearAt(id: GearId, tier: number): Partial<Record<GearId, number>> {
  const gear: Partial<Record<GearId, number>> = {};
  gear[id] = tier;
  return gear;
}

/** Stand at the smith on one track and press SPACE exactly once. */
function buyFromSmith(hero: SavedHero, track: GearId) {
  const town = new TownController();
  town.overlay = 'smith';
  town.selection = ALL_GEAR_IDS.indexOf(track);
  const sounds: string[] = [];
  const banners: Array<[string, string]> = [];
  let saves = 0;
  const player = new Player();
  player.reset(0, 0);
  const ctx: TownCtx = {
    dt: 1 / 60,
    input: {
      isKeyPressed: (code: string) => code === 'Space',
      isLeftPressed: () => false,
      isRightPressed: () => false,
      isUpPressed: () => false,
      isDownPressed: () => false,
    },
    edges: {
      interactWas: false,
      confirmWas: false,
      navLeftWas: false,
      navRightWas: false,
      navUpWas: false,
      navDownWas: false,
    },
    player,
    hero,
    save: () => {
      saves++;
    },
    playSound: name => {
      sounds.push(name);
    },
    showBanner: (text, sub) => {
      banners.push([text, sub]);
    },
    depart: () => {},
    pickRumor: () => '',
    onCurseLifted: () => {},
    onAscended: () => {},
  };
  town.update(ctx);
  return { sounds, banners, saves };
}

describe('Wave S — the MASTERWORK gear tier', () => {
  test('a fourth tier on every track, priced as a thing to bank toward', () => {
    expect(GEAR_TUNING.MAX_TIER).toBe(4);
    expect(GEAR_TUNING.MASTERWORK_LEVEL).toBe(15);
    for (const id of ALL_GEAR_IDS) {
      const prices = GEAR[id].prices;
      const masterwork = prices[GEAR_TUNING.MAX_TIER - 1];
      // The band the whole tier lives in: one veteran contract's purse each.
      expect(masterwork).toBeGreaterThanOrEqual(900);
      expect(masterwork).toBeLessThanOrEqual(1200);
      // And it keeps the roughly-doubling shape the first three tiers have.
      expect(masterwork).toBeGreaterThanOrEqual(prices[2] * 2);
    }
    // The whole tier costs more than every earlier tier on every track put
    // together — that is what makes it the levels 11-19 goal.
    const earlier = ALL_GEAR_IDS.reduce((sum, id) => sum + GEAR[id].prices.slice(0, 3).reduce((a, b) => a + b, 0), 0);
    const masterworks = ALL_GEAR_IDS.reduce((sum, id) => sum + GEAR[id].prices[3], 0);
    expect(masterworks).toBeGreaterThan(earlier);
  });

  test('the seal is only ever on the step INTO tier 4, below level 15', () => {
    for (const tier of [0, 1, 2]) {
      expect(masterworkSealed(tier, 1)).toBe(false);
      expect(masterworkSealed(tier, GEAR_TUNING.MASTERWORK_LEVEL)).toBe(false);
    }
    expect(masterworkSealed(3, GEAR_TUNING.MASTERWORK_LEVEL - 1)).toBe(true);
    expect(masterworkSealed(3, GEAR_TUNING.MASTERWORK_LEVEL)).toBe(false);
    expect(masterworkSealed(3, 20)).toBe(false);
    // A finished track is FULLY FORGED, never "sealed".
    expect(masterworkSealed(GEAR_TUNING.MAX_TIER, 1)).toBe(false);
  });

  test('below level 15 the smith refuses the masterwork and spends nothing', () => {
    const hero = smithHero({ level: 14, gold: 5000, gear: gearAt('blade', 3) });
    const { sounds, banners, saves } = buyFromSmith(hero, 'blade');
    expect(hero.gear.blade).toBe(3);
    expect(hero.gold).toBe(5000);
    expect(saves).toBe(0);
    expect(sounds).toContain('error');
    expect(sounds).not.toContain('success');
    expect(banners[0][0]).toBe(GEAR.blade.name);
    expect(banners[0][1]).toBe('MASTERWORK — NO HAND BELOW LEVEL 15 MAY CARRY IT');
  });

  test('at level 15 he forges it, for exactly the masterwork price, on every track', () => {
    for (const id of ALL_GEAR_IDS) {
      const price = GEAR[id].prices[3];
      const hero = smithHero({ level: 15, gold: price, gear: gearAt(id, 3) });
      const { sounds, banners, saves } = buyFromSmith(hero, id);
      expect(hero.gear[id]).toBe(GEAR_TUNING.MAX_TIER);
      expect(hero.gold).toBe(0);
      expect(saves).toBe(1);
      expect(sounds).toContain('success');
      expect(banners[0][1]).toBe('MASTERWORK — WORN FROM THE NEXT EXPEDITION ON');
    }
  });

  test('level 15 but short of the gold buys nothing', () => {
    const hero = smithHero({ level: 15, gold: GEAR.blade.prices[3] - 1, gear: gearAt('blade', 3) });
    const { sounds, saves } = buyFromSmith(hero, 'blade');
    expect(hero.gear.blade).toBe(3);
    expect(saves).toBe(0);
    expect(sounds).toContain('error');
  });

  test('a masterwork track answers FULLY FORGED — the refusal just moved to 4', () => {
    const hero = smithHero({ level: 20, gold: 9999, gear: gearAt('blade', 4) });
    const { banners, saves } = buyFromSmith(hero, 'blade');
    expect(hero.gear.blade).toBe(4);
    expect(hero.gold).toBe(9999);
    expect(saves).toBe(0);
    expect(banners[0][1]).toBe('FULLY FORGED — NOTHING MORE TO ADD');
  });

  test('nothing was taken back: tiers 1-3 cost and buy exactly as before', () => {
    expect(GEAR.blade.prices.slice(0, 3)).toEqual([120, 280, 550]);
    expect(GEAR.armor.prices.slice(0, 3)).toEqual([100, 240, 480]);
    expect(GEAR.boots.prices.slice(0, 3)).toEqual([90, 220, 440]);
    expect(GEAR.quiver.prices.slice(0, 3)).toEqual([80, 180, 360]);
    // A level-1 hero still walks the first three tiers with no gate in sight.
    const novice = smithHero({ level: 1, gold: 5000, gear: gearAt('blade', 2) });
    const { banners } = buyFromSmith(novice, 'blade');
    expect(novice.gear.blade).toBe(3);
    expect(novice.gold).toBe(5000 - GEAR.blade.prices[2]);
    expect(banners[0][1]).toBe('TIER 3 — WORN FROM THE NEXT EXPEDITION ON');
  });

  test("a tier-3 hero's folds are untouched; tier 4 is one more step of the same", () => {
    const fold = (tier: number) => {
      const player = new Player();
      player.reset(0, 0);
      player.applyKit(CLASSES.fighter);
      player.applyProgression({ hp: 0, speed: 0, daggerCap: 0 }, {}, {
        blade: tier,
        armor: tier,
        boots: tier,
        quiver: tier,
      });
      return {
        damage: player.swordDamage(),
        hp: player.maxHp,
        speed: player.speed(),
        daggers: player.daggerCap(),
      };
    };
    const bare = fold(0);
    const three = fold(3);
    const four = fold(4);
    // Exactly what a tier-3 veteran had before this wave.
    expect(three.damage).toBe(bare.damage + 3 * GEAR_TUNING.BLADE_DAMAGE);
    expect(three.hp).toBe(bare.hp + 3 * GEAR_TUNING.ARMOR_HP);
    expect(three.daggers).toBe(bare.daggers + 3 * GEAR_TUNING.QUIVER_CAP);
    expect(three.speed).toBeCloseTo(bare.speed * (1 + 3 * GEAR_TUNING.BOOTS_SPEED));
    // And the fourth tier rides the same fold, one step further — no new rule.
    expect(four.damage).toBe(three.damage + GEAR_TUNING.BLADE_DAMAGE);
    expect(four.hp).toBe(three.hp + GEAR_TUNING.ARMOR_HP);
    expect(four.daggers).toBe(three.daggers + GEAR_TUNING.QUIVER_CAP);
    expect(four.speed).toBeGreaterThan(three.speed);
  });

  test('saves accept tier 4 and still clamp anything above it', () => {
    const store = new CharacterStore();
    window.localStorage.setItem(
      store.key(),
      JSON.stringify({
        version: 2,
        characters: {
          fighter: smithHero({
            level: 15,
            gear: { blade: 4, armor: 3, boots: 5, quiver: 0 },
          }),
        },
      }),
    );
    const loaded = store.load().characters.fighter;
    expect(loaded?.gear.blade).toBe(4); // the masterwork survives the round trip
    expect(loaded?.gear.armor).toBe(3); // an existing veteran's tier is unchanged
    expect(loaded?.gear.boots).toBe(GEAR_TUNING.MAX_TIER); // still clamped
    expect(loaded?.gear.quiver).toBeUndefined();
  });
});

describe('Lastlight town map', () => {
  test('gate, board and both vendors stand on reachable ground', () => {
    const town = new TownController();
    const { map, playerStart, stairsTile } = town.plan;
    expect(map.get(stairsTile.tx, stairsTile.ty)).toBe(Tile.Stairs);
    const startTile = map.tileAtWorld(playerStart.x, playerStart.y);
    for (const station of ['quests', 'smith', 'alchemist', 'gate'] as const) {
      const spot = town.spots[station];
      const tile = map.tileAtWorld(spot.x, spot.y);
      expect(map.isSolidAt(tile.tx, tile.ty)).toBe(false);
      expect(isReachable(map, startTile, tile)).toBe(true);
    }
    // A safe town: nothing hostile in the plan.
    expect(town.plan.enemies).toHaveLength(0);
    expect(town.plan.hazards).toHaveLength(0);
  });
});

describe('quest-shaped generation', () => {
  test('mid-quest floors suppress the every-3rd boss; the final floor forces one', () => {
    // Floor 3 would be a boss arena under classic rules — not inside a quest.
    const mid = generateFloor(12345, 3, { forceBoss: false, biomeId: 'bone' });
    expect(mid.isBossFloor).toBe(false);
    expect(mid.enemies.length).toBeGreaterThan(0);
    const final = generateFloor(12345, 4, { forceBoss: true, biomeId: 'bone' });
    expect(final.isBossFloor).toBe(true);
    expect(final.bossSpawn).not.toBeNull();
  });

  test('quest biome pins the spawn table', () => {
    // Floor 7 is sunken under classic cycling; a bone quest keeps it bone.
    const plan = generateFloor(999983, 7, { forceBoss: false, biomeId: 'bone' });
    const types = new Set(plan.enemies.map(e => e.type));
    expect(types.has('deep-ooze')).toBe(false);
    expect(types.has('lizardman')).toBe(false);
  });

  test('omitting opts reproduces classic floors exactly', () => {
    const classic = generateFloor(4242, 5);
    const explicit = generateFloor(4242, 5, undefined);
    expect(explicit.enemies).toEqual(classic.enemies);
    expect(explicit.pickups).toEqual(classic.pickups);
  });
});

describe('expedition + victory flow', () => {
  function startWithFighter(h: Harness): Set<string> {
    const held = wireHeldKeys(h);
    // Wave I — turn the title page.
    held.add('Space');
    h.game.update(1 / 60);
    held.clear();
    h.game.update(1 / 60);
    held.add('Digit1');
    h.game.update(1 / 60); // pick fighter -> the bloodline page
    held.clear();
    h.game.update(1 / 60); // releasing arms the lineage digits
    held.add('Digit1');
    h.game.update(1 / 60); // forge a HUMAN (card 1) -> town
    held.clear();
    h.game.update(1 / 60);
    return held;
  }

  test('the session opens in Lastlight with nothing hostile', () => {
    const h = initGame(new DungeonCrawlGame());
    startWithFighter(h);
    expect(() => {
      for (let i = 0; i < 120; i++) h.game.update(1 / 60);
      h.game.render(h.ctx);
    }).not.toThrow();
    expect(metrics(h).quests_completed).toBe(0);
  });

  test('a quest departure shapes floors; victory banks gold and rewards XP', () => {
    const h = initGame(new DungeonCrawlGame());
    startWithFighter(h);
    const game = internals(h);

    game.departOnQuest(QUESTS['bone-galleries']);
    expect(game.floor).toBe(1);
    expect(game.boss).toBeNull();

    // Floor 3 of a 4-floor quest: no boss (classic rules would spawn one).
    game.floor = 3;
    game.loadFloor();
    expect(game.boss).toBeNull();

    // The final floor is the arena, with the quest's own Guardian.
    game.floor = 4;
    game.loadFloor();
    expect(game.boss).not.toBeNull();
    expect(game.boss!.kit.id).toBe('bone-colossus');

    // Victory: carried gold + reward lands in the hero's treasury. v5 Wave E:
    // the reward scales with the forged hero's CHA delta (the forge roll is
    // live rng here), so the expectation derives from the saved scores.
    game.goldBalance = 55;
    game.openVictory();
    h.game.update(1 / 60); // one frame so extendedGameData re-syncs
    const s = metrics(h);
    const chaDelta = statModDeltas(
      'fighter',
      new CharacterStore().load().characters.fighter!.scores,
    ).cha;
    const rewardGold = Math.round(
      QUESTS['bone-galleries'].rewardGold * (1 + STAT_TUNING.CHA_QUEST_GOLD * chaDelta),
    );
    expect(s.quests_completed).toBe(1);
    expect(s.gold_banked).toBe(55 + rewardGold);
    expect(s.xp_earned).toBeGreaterThanOrEqual(QUESTS['bone-galleries'].rewardXp);
    const saved = new CharacterStore().load();
    expect(saved.characters.fighter?.gold).toBe(55 + rewardGold);
    expect(saved.characters.fighter?.stats.victories).toBe(1);
  });

  test('packed provisions apply at the gate and are consumed', () => {
    const h = initGame(new DungeonCrawlGame());
    startWithFighter(h);
    const game = internals(h);

    // Pack a bandolier + candle straight onto the saved hero.
    const store = new CharacterStore();
    const payload = store.load();
    payload.characters.fighter!.provisions = ['bandolier', 'blessed-candle'];
    store.save(payload);
    (h.game as unknown as { progression: { load(): void; selectHero(id: string): void } })
      .progression.load();
    (h.game as unknown as { progression: { selectHero(id: string): void } })
      .progression.selectHero('fighter');

    game.departOnQuest(QUESTS['embers-below']);
    expect(game.player.daggers).toBeGreaterThan(5); // bandolier landed
    expect(game.player.provisionTorch).toBe(1); // candle lit
    expect(new CharacterStore().load().characters.fighter?.provisions).toEqual([]);
  });
});
