// v4 Wave B tests: quest + gear + provision data contracts, the Lastlight
// town map's integrity, quest-shaped floor generation, and the expedition /
// victory / provision flows (dev-test internals pokes where rng-driven
// steering would be impractical).

import { ALL_GEAR_IDS, ALL_PROVISION_IDS, GEAR, GEAR_TUNING, PROVISIONS } from '@/games/dungeon-crawl/data/gear';
import { ALL_QUEST_IDS, QUESTS, STANDALONE_QUEST_IDS } from '@/games/dungeon-crawl/data/quests';
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
  test('five standalone quests on the classic board, endless included', () => {
    // v4 Wave C — saga chapters joined QUESTS but stay OFF the classic page.
    expect(STANDALONE_QUEST_IDS).toHaveLength(5);
    expect(ALL_QUEST_IDS).toHaveLength(12);
    expect(new Set(ALL_QUEST_IDS).size).toBe(12);
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

describe('gear + provision contracts', () => {
  test('four gear tracks with ascending tier prices', () => {
    expect(ALL_GEAR_IDS).toHaveLength(4);
    for (const id of ALL_GEAR_IDS) {
      const gear = GEAR[id];
      expect(gear.id).toBe(id);
      expect(gear.prices).toHaveLength(GEAR_TUNING.MAX_TIER);
      expect(gear.prices[1]).toBeGreaterThan(gear.prices[0]);
      expect(gear.prices[2]).toBeGreaterThan(gear.prices[1]);
    }
  });

  test('three provisions, priced and authored', () => {
    expect(ALL_PROVISION_IDS).toHaveLength(3);
    for (const id of ALL_PROVISION_IDS) {
      expect(PROVISIONS[id].price).toBeGreaterThan(0);
      expect(PROVISIONS[id].blurb.length).toBeGreaterThan(0);
    }
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
    held.add('Digit1');
    h.game.update(1 / 60); // pick fighter -> town
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
