// Development-era tests for the seeded floor generator. Not part of the
// production CI gate (release suite lives in src/__approval__).
//
// Invariants pinned here:
//  1. Same (seed, floor) => identical layout and spawns (pure generator).
//  2. The stairs are always reachable from the player start WITHOUT the key
//     (locked treasure doors must never gate progression).
//  3. If a treasure room was locked, its key spawns in reachable space.
//  4. Boss floors produce an arena with a boss spawn and no ambient enemies.

import {
  generateFloor,
  isBossFloor,
  isReachable,
  type FloorPlan,
} from '@/games/dungeon-crawl/dungeon/DungeonGenerator';
import { Tile, TileMap } from '@/games/dungeon-crawl/dungeon/TileMap';
import { SECRETS, TILE } from '@/games/dungeon-crawl/data/constants';

const SEEDS = [1, 42, 1337, 987654321, 0xdeadbeef];

function serialize(map: TileMap): string {
  let out = '';
  for (let ty = 0; ty < map.rows; ty++) {
    for (let tx = 0; tx < map.cols; tx++) out += map.get(tx, ty);
  }
  return out;
}

function tileOfWorld(plan: FloorPlan, wx: number, wy: number): { tx: number; ty: number } {
  return { tx: Math.floor(wx / TILE), ty: Math.floor(wy / TILE) };
}

describe('DungeonGenerator', () => {
  test('is deterministic for the same seed and floor', () => {
    for (const seed of SEEDS) {
      const a = generateFloor(seed, 2);
      const b = generateFloor(seed, 2);
      expect(serialize(a.map)).toBe(serialize(b.map));
      expect(a.enemies).toEqual(b.enemies);
      expect(a.pickups).toEqual(b.pickups);
      expect(a.playerStart).toEqual(b.playerStart);
      expect(a.stairsTile).toEqual(b.stairsTile);
      // v2 plan fields are part of the determinism contract too.
      expect(a.shop).toEqual(b.shop);
      expect(a.hazards).toEqual(b.hazards);
      expect(a.urns).toEqual(b.urns);
      // v4 Wave C — secret rooms (and their nests) are deterministic too.
      expect(a.secrets).toEqual(b.secrets);
    }
  });

  test('different seeds produce different layouts', () => {
    const a = generateFloor(1, 1);
    const b = generateFloor(2, 1);
    expect(serialize(a.map)).not.toBe(serialize(b.map));
  });

  test.each(SEEDS)('seed %s: stairs reachable from start on floors 1-6', seed => {
    for (let floor = 1; floor <= 6; floor++) {
      const plan = generateFloor(seed, floor);
      const start = tileOfWorld(plan, plan.playerStart.x, plan.playerStart.y);
      expect(plan.map.isSolidAt(start.tx, start.ty)).toBe(false);
      expect(plan.map.get(plan.stairsTile.tx, plan.stairsTile.ty)).toBe(Tile.Stairs);
      expect(isReachable(plan.map, start, plan.stairsTile)).toBe(true);
    }
  });

  test.each(SEEDS)('seed %s: locked treasure rooms always ship a reachable key', seed => {
    for (let floor = 1; floor <= 6; floor++) {
      if (isBossFloor(floor)) continue;
      const plan = generateFloor(seed, floor);
      let hasLockedDoor = false;
      for (let ty = 0; ty < plan.map.rows && !hasLockedDoor; ty++) {
        for (let tx = 0; tx < plan.map.cols; tx++) {
          if (plan.map.get(tx, ty) === Tile.LockedDoor) {
            hasLockedDoor = true;
            break;
          }
        }
      }
      const keys = plan.pickups.filter(p => p.kind === 'key');
      if (hasLockedDoor) {
        expect(keys.length).toBeGreaterThanOrEqual(1);
        const start = tileOfWorld(plan, plan.playerStart.x, plan.playerStart.y);
        for (const key of keys) {
          expect(isReachable(plan.map, start, tileOfWorld(plan, key.x, key.y))).toBe(true);
        }
      }
    }
  });

  test('every third floor is a boss arena', () => {
    expect(isBossFloor(3)).toBe(true);
    expect(isBossFloor(6)).toBe(true);
    expect(isBossFloor(1)).toBe(false);
    expect(isBossFloor(4)).toBe(false);

    const plan = generateFloor(42, 3);
    expect(plan.isBossFloor).toBe(true);
    expect(plan.bossSpawn).not.toBeNull();
    expect(plan.enemies).toHaveLength(0);
    // Boss spawn and stairs sit on open floor.
    const bossTile = tileOfWorld(plan, plan.bossSpawn!.x, plan.bossSpawn!.y);
    expect(plan.map.isSolidAt(bossTile.tx, bossTile.ty)).toBe(false);
    expect(plan.map.get(plan.stairsTile.tx, plan.stairsTile.ty)).toBe(Tile.Stairs);
  });

  test('normal floors spawn enemies and gold', () => {
    for (const seed of SEEDS) {
      const plan = generateFloor(seed, 2);
      expect(plan.enemies.length).toBeGreaterThan(0);
      expect(plan.pickups.filter(p => p.kind === 'gold').length).toBeGreaterThan(0);
      expect(plan.torches.length).toBeGreaterThan(0);
    }
  });

  test('enemy spawns respect floor gating (no knights on floor 1)', () => {
    for (const seed of SEEDS) {
      const plan = generateFloor(seed, 1);
      const types = new Set(plan.enemies.map(e => e.type));
      expect(types.has('knight')).toBe(false);
      expect(types.has('sorcerer')).toBe(false);
      expect(types.has('bat')).toBe(false);
      expect(types.has('bomber')).toBe(false);
      expect(types.has('wraith')).toBe(false);
      // v3 — floor 1 is ember: other biomes' families never appear there.
      expect(types.has('zombie')).toBe(false);
      expect(types.has('ghoul')).toBe(false);
      expect(types.has('deep-ooze')).toBe(false);
      expect(types.has('lizardman')).toBe(false);
      expect(types.has('shade')).toBe(false);
      expect(types.has('cinder-hound')).toBe(false);
      // Elites start at floor 3.
      expect(plan.enemies.every(e => e.elite === null)).toBe(true);
    }
  });

  // ---------------------------------------------------------------- v2

  test('shop rooms are enemy-free, reachable, and priced', () => {
    let shopsSeen = 0;
    for (const seed of SEEDS) {
      for (let floor = 2; floor <= 6; floor++) {
        if (isBossFloor(floor)) continue;
        const plan = generateFloor(seed, floor);
        if (!plan.shop) continue;
        shopsSeen++;
        const shopRoom = plan.rooms.find(r => r.kind === 'shop');
        expect(shopRoom).toBeDefined();
        // No enemy spawns inside the shop room.
        for (const enemy of plan.enemies) {
          const tx = enemy.x / TILE;
          const ty = enemy.y / TILE;
          const inside =
            tx >= shopRoom!.tx &&
            tx < shopRoom!.tx + shopRoom!.w &&
            ty >= shopRoom!.ty &&
            ty < shopRoom!.ty + shopRoom!.h;
          expect(inside).toBe(false);
        }
        // Items priced and standing on open floor; merchant reachable.
        expect(plan.shop.items.length).toBeGreaterThanOrEqual(3);
        const start = tileOfWorld(plan, plan.playerStart.x, plan.playerStart.y);
        expect(
          isReachable(plan.map, start, tileOfWorld(plan, plan.shop.merchant.x, plan.shop.merchant.y)),
        ).toBe(true);
        for (const item of plan.shop.items) {
          expect(item.price).toBeGreaterThan(0);
          const t = tileOfWorld(plan, item.x, item.y);
          expect(plan.map.isSolidAt(t.tx, t.ty)).toBe(false);
        }
      }
    }
    // ~65% chance per eligible floor across 5 seeds — statistically certain.
    expect(shopsSeen).toBeGreaterThan(0);
  });

  test('hazards and urns land on open floor and never on the stairs', () => {
    for (const seed of SEEDS) {
      for (let floor = 2; floor <= 6; floor++) {
        if (isBossFloor(floor)) continue;
        const plan = generateFloor(seed, floor);
        for (const hazard of plan.hazards) {
          expect(plan.map.get(hazard.tx, hazard.ty)).toBe(Tile.Floor);
          expect(hazard.tx === plan.stairsTile.tx && hazard.ty === plan.stairsTile.ty).toBe(false);
        }
        for (const urn of plan.urns) {
          const t = tileOfWorld(plan, urn.x, urn.y);
          expect(plan.map.get(t.tx, t.ty)).toBe(Tile.Floor);
        }
        // Hazards and urns never stack on the same tile.
        const keys = new Set<string>();
        for (const hazard of plan.hazards) keys.add(`${hazard.tx},${hazard.ty}`);
        for (const urn of plan.urns) {
          const t = tileOfWorld(plan, urn.x, urn.y);
          expect(keys.has(`${t.tx},${t.ty}`)).toBe(false);
        }
      }
    }
  });

  test('elites appear from floor 3 with valid traits', () => {
    const validTraits = new Set(['frenzied', 'bulwark', 'volatile', 'gilded']);
    let elitesSeen = 0;
    for (const seed of SEEDS) {
      for (let floor = 3; floor <= 8; floor++) {
        if (isBossFloor(floor)) continue;
        const plan = generateFloor(seed, floor);
        for (const enemy of plan.enemies) {
          if (enemy.elite !== null) {
            elitesSeen++;
            expect(validTraits.has(enemy.elite)).toBe(true);
          }
        }
      }
    }
    expect(elitesSeen).toBeGreaterThan(0);
  });

  test('boss floors carry no shop, hazards, or urns', () => {
    const plan = generateFloor(42, 3);
    expect(plan.shop).toBeNull();
    expect(plan.hazards).toHaveLength(0);
    expect(plan.urns).toHaveLength(0);
  });

  // ---------------------------------------------------------------- v4 Wave C

  test('secret rooms are sealed cracked-wall pockets off the graph', () => {
    let secretsSeen = 0;
    for (const seed of SEEDS) {
      for (let floor = 1; floor <= 6; floor++) {
        if (isBossFloor(floor)) continue;
        const plan = generateFloor(seed, floor);
        expect(plan.secrets.length).toBeLessThanOrEqual(SECRETS.MAX_PER_FLOOR);
        const start = tileOfWorld(plan, plan.playerStart.x, plan.playerStart.y);
        for (const secret of plan.secrets) {
          secretsSeen++;
          const room = secret.room;
          expect(room.kind).toBe('secret');
          // Off the graph: never listed among the floor's rooms.
          expect(plan.rooms).not.toContain(room);
          // One cracked-wall seal; the interior is carved floor.
          expect(plan.map.get(secret.seal.tx, secret.seal.ty)).toBe(Tile.CrackedWall);
          const center = {
            tx: room.tx + Math.floor(room.w / 2),
            ty: room.ty + Math.floor(room.h / 2),
          };
          expect(plan.map.get(center.tx, center.ty)).toBe(Tile.Floor);
          // Sealed: unreachable until the seal breaks — then reachable.
          expect(isReachable(plan.map, start, center)).toBe(false);
          plan.map.set(secret.seal.tx, secret.seal.ty, Tile.Floor);
          expect(isReachable(plan.map, start, center)).toBe(true);
          // Stairs stayed reachable throughout (the room is never on the path).
          expect(isReachable(plan.map, start, plan.stairsTile)).toBe(true);
        }
      }
    }
    // 0-2 per floor across 5 seeds × 4 floors — statistically certain.
    expect(secretsSeen).toBeGreaterThan(0);
  });

  test('secret stock stands inside the room; nests respect floor gating', () => {
    const inRoom = (x: number, y: number, room: { tx: number; ty: number; w: number; h: number }) => {
      const tx = Math.floor(x / TILE);
      const ty = Math.floor(y / TILE);
      return tx >= room.tx && tx < room.tx + room.w && ty >= room.ty && ty < room.ty + room.h;
    };
    let nestsSeen = 0;
    for (const seed of SEEDS) {
      for (let floor = 1; floor <= 6; floor++) {
        if (isBossFloor(floor)) continue;
        const plan = generateFloor(seed, floor);
        for (const secret of plan.secrets) {
          // Generous stock: gold plus a shrine or a scroll, all inside.
          const inside = plan.pickups.filter(p => inRoom(p.x, p.y, secret.room));
          expect(inside.filter(p => p.kind === 'gold').length).toBeGreaterThanOrEqual(1);
          expect(
            inside.filter(p => p.kind === 'relic-shrine' || p.kind === 'scroll').length,
          ).toBeGreaterThanOrEqual(1);
          if (secret.nest) {
            nestsSeen++;
            expect(secret.nest.rewardGold).toBeGreaterThan(0);
            expect(secret.nest.spawns.length).toBeGreaterThanOrEqual(SECRETS.NEST_PACK_MIN);
            for (const spawn of secret.nest.spawns) {
              expect(inRoom(spawn.x, spawn.y, secret.room)).toBe(true);
              expect(spawn.elite).toBeNull();
              if (floor === 1) {
                // Floor 1 stays gentle even behind cracked walls.
                expect(['slime', 'skeleton', 'fire-beetle']).toContain(spawn.type);
              }
            }
          }
        }
      }
    }
    expect(nestsSeen).toBeGreaterThan(0);
  });
});
