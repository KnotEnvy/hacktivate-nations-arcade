// Scroll + Vaults-of-the-Magica relic tests for v3 wave 3 (dev suite only).
//
// Pins the scroll/relic data contracts, generator scroll placement, the
// Minimap reveal, and the read-scroll flow through the public metric surface.

import { ALL_RELIC_IDS, RELIC_TUNING, RELICS } from '@/games/dungeon-crawl/data/relics';
import { ALL_SCROLL_IDS, SCROLL_TUNING, SCROLLS, ScrollId } from '@/games/dungeon-crawl/data/scrolls';
import { QUESTS } from '@/games/dungeon-crawl/data/quests';
import { DungeonCrawlGame } from '@/games/dungeon-crawl/DungeonCrawlGame';
import { generateFloor } from '@/games/dungeon-crawl/dungeon/DungeonGenerator';
import { TileMap, Tile } from '@/games/dungeon-crawl/dungeon/TileMap';
import { Player } from '@/games/dungeon-crawl/entities/Player';
import { Minimap } from '@/games/dungeon-crawl/systems/Minimap';
import { initGame, type Harness } from '@/games/shared/gameTestHarness';

let randomSpy: jest.SpyInstance;
beforeEach(() => {
  randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.42);
});
afterEach(() => {
  randomSpy.mockRestore();
});

/** Route the harness input mocks through a mutable held-key set. */
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

describe('scroll data contract', () => {
  test('five scrolls with unique ids and authored cards', () => {
    expect(ALL_SCROLL_IDS).toHaveLength(5);
    expect(new Set(ALL_SCROLL_IDS).size).toBe(5);
    for (const id of ALL_SCROLL_IDS) {
      expect(SCROLLS[id].id).toBe(id);
      expect(SCROLLS[id].name.length).toBeGreaterThan(0);
      expect(SCROLLS[id].blurb.length).toBeGreaterThan(0);
      expect(SCROLLS[id].icon.length).toBeGreaterThan(0);
      expect(SCROLLS[id].color).toMatch(/^#/);
    }
  });

  test('scroll tuning is playable', () => {
    expect(SCROLL_TUNING.FLAME_DAMAGE).toBeGreaterThan(0);
    expect(SCROLL_TUNING.FROST_STUN).toBeGreaterThan(0);
    expect(SCROLL_TUNING.HEAL_HP).toBeGreaterThan(0);
    expect(SCROLL_TUNING.SHIELD_INVULN).toBeGreaterThan(0);
  });
});

describe('Vaults of the Magica relics', () => {
  test('the pool grew to 18 with the six new relics', () => {
    expect(ALL_RELIC_IDS).toHaveLength(18);
    for (const id of [
      'ring-of-renewal',
      'war-bracers',
      'grave-ward',
      'ogre-gauntlets',
      'blur-cloak',
      'bottomless-quiver',
    ] as const) {
      expect(RELICS[id]).toBeDefined();
      expect(RELICS[id].blurb.length).toBeGreaterThan(0);
    }
    expect(RELIC_TUNING.BLUR_DODGE_CAP).toBeLessThan(1); // never a guaranteed dodge
  });

  test('War Bracers shorten the ability cooldown', () => {
    const player = new Player();
    player.reset(0, 0);
    const base = player.abilityCooldownFull();
    player.addRelic('war-bracers');
    expect(player.abilityCooldownFull()).toBeLessThan(base);
  });

  test('Ogre Gauntlets raise melee knockback', () => {
    const player = new Player();
    player.reset(0, 0);
    const base = player.meleeKnockback();
    player.addRelic('ogre-gauntlets');
    expect(player.meleeKnockback()).toBeGreaterThan(base);
  });
});

describe('generator scroll placement', () => {
  test('unidentified scrolls appear on ambient floors (seeded, deterministic)', () => {
    let scrollsSeen = 0;
    for (const seed of [1, 2, 3, 12345, 999983]) {
      for (let floor = 1; floor <= 8; floor++) {
        if (floor % 3 === 0) continue; // boss floors are bare
        const plan = generateFloor(seed, floor);
        scrollsSeen += plan.pickups.filter(p => p.kind === 'scroll').length;
      }
    }
    expect(scrollsSeen).toBeGreaterThan(0);
  });

  test('boss arenas never spawn scrolls', () => {
    for (const seed of [1, 2, 3]) {
      const plan = generateFloor(seed, 3);
      expect(plan.pickups.every(p => p.kind !== 'scroll')).toBe(true);
    }
  });
});

describe('Minimap revelation', () => {
  test('revealAll marks every non-void tile explored', () => {
    const map = new TileMap(8, 8);
    map.set(2, 2, Tile.Floor);
    map.set(3, 2, Tile.Wall);
    const minimap = new Minimap();
    minimap.resetFor(map);
    expect(minimap.isExplored(2, 2)).toBe(false);
    minimap.revealAll(map);
    expect(minimap.isExplored(2, 2)).toBe(true);
    expect(minimap.isExplored(3, 2)).toBe(true);
  });
});

describe('read-scroll flow (public metric surface)', () => {
  test('F reads the held scroll once and empties the satchel', () => {
    const h = initGame(new DungeonCrawlGame());
    const held = wireHeldKeys(h);
    held.add('Digit1');
    h.game.update(1 / 60); // pick a class -> Lastlight
    held.clear();
    // v4 Wave B — scrolls are read in the depths; set out through the gate.
    (h.game as unknown as { departOnQuest(q: unknown): void }).departOnQuest(QUESTS.endless);
    // v5 Wave G — the DM briefs at the gate; Space past the lockout descends.
    for (let i = 0; i < 70; i++) h.game.update(1 / 60);
    held.add('Space');
    h.game.update(1 / 60);
    held.clear();
    h.game.update(1 / 60);

    // Grant a scroll directly — acquisition is rng-driven, the read flow isn't.
    const internals = h.game as unknown as { player: { scroll: ScrollId | null } };
    internals.player.scroll = 'healing';

    held.add('KeyF');
    h.game.update(1 / 60);
    const s = h.game.getScore!() as unknown as Record<string, number>;
    expect(s.scrolls_used).toBe(1);
    expect(internals.player.scroll).toBeNull();

    // Held key must not re-read (edge detection) — and the satchel is empty.
    h.game.update(1 / 60);
    const s2 = h.game.getScore!() as unknown as Record<string, number>;
    expect(s2.scrolls_used).toBe(1);
  });
});
