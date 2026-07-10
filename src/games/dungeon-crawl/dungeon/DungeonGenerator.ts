// ===== src/games/dungeon-crawl/dungeon/DungeonGenerator.ts =====
// Seeded rooms-and-corridors floor generator. Pure: same (seed, floor) in,
// same FloorPlan out. All world-space outputs are pixels; tile-space fields
// are named tx/ty.

import { TILE, FLOOR_GEN, SHOP, BIOMES, biomeForFloor, HazardStyle } from '../data/constants';
import {
  ELITES,
  EliteTrait,
  EnemyTypeId,
  spawnWeightsForFloor,
  enemyBudgetForRoom,
} from '../data/enemies';
import { Rng } from './rng';
import { Tile, TileMap } from './TileMap';

export type RoomKind = 'start' | 'stairs' | 'treasure' | 'normal' | 'arena' | 'shop';

export interface Room {
  // Interior bounds in tile coords (walls sit just outside these).
  tx: number;
  ty: number;
  w: number;
  h: number;
  kind: RoomKind;
}

export type PickupKind = 'gold' | 'heart' | 'dagger' | 'potion' | 'key' | 'relic-shrine' | 'scroll';

export interface EnemySpawnPlan {
  type: EnemyTypeId;
  x: number; // world px, center
  y: number;
  elite: EliteTrait | null;
}

export interface PickupSpawnPlan {
  kind: PickupKind;
  x: number;
  y: number;
}

export type ShopProduct = 'heart' | 'daggers' | 'potion' | 'relic' | 'scroll';

export interface ShopItemPlan {
  product: ShopProduct;
  price: number;
  x: number;
  y: number;
}

export interface ShopPlan {
  merchant: { x: number; y: number };
  items: ShopItemPlan[];
}

export interface HazardSpawnPlan {
  tx: number;
  ty: number;
  style: HazardStyle;
}

export interface FloorPlan {
  map: TileMap;
  rooms: Room[];
  playerStart: { x: number; y: number };
  stairsTile: { tx: number; ty: number };
  enemies: EnemySpawnPlan[];
  pickups: PickupSpawnPlan[];
  torches: Array<{ tx: number; ty: number }>;
  isBossFloor: boolean;
  bossSpawn: { x: number; y: number } | null;
  shop: ShopPlan | null;
  hazards: HazardSpawnPlan[];
  urns: Array<{ x: number; y: number; variant: number }>;
}

const roomCenter = (r: Room): { tx: number; ty: number } => ({
  tx: r.tx + Math.floor(r.w / 2),
  ty: r.ty + Math.floor(r.h / 2),
});

const roomsOverlap = (a: Room, b: Room, gap: number): boolean =>
  a.tx - gap < b.tx + b.w &&
  a.tx + a.w + gap > b.tx &&
  a.ty - gap < b.ty + b.h &&
  a.ty + a.h + gap > b.ty;

export function isBossFloor(floor: number): boolean {
  return floor % FLOOR_GEN.BOSS_EVERY_N_FLOORS === 0;
}

/**
 * v4 Wave B — quest shaping. Both fields optional; omitted reproduces the
 * classic endless rules exactly. The caller derives them deterministically
 * from the quest definition, so (seed, floor, opts) stays pure.
 */
export interface FloorOpts {
  forceBoss?: boolean; // quests: boss arena ONLY on the final floor
  biomeId?: string; // quests: fixed biome; default cycles by floor
}

function biomeFor(floor: number, biomeId?: string) {
  return (biomeId && BIOMES.find(b => b.id === biomeId)) || biomeForFloor(floor);
}

export function generateFloor(seed: number, floor: number, opts?: FloorOpts): FloorPlan {
  const rng = new Rng((seed ^ (floor * 0x9e3779b9)) >>> 0);
  const boss = opts?.forceBoss ?? isBossFloor(floor);
  return boss ? generateBossArena(rng, floor) : generateRoomsFloor(rng, floor, opts?.biomeId);
}

// ---------------------------------------------------------------- rooms floor

function generateRoomsFloor(rng: Rng, floor: number, biomeId?: string): FloorPlan {
  const cols = Math.min(
    FLOOR_GEN.MAX_COLS,
    FLOOR_GEN.BASE_COLS + FLOOR_GEN.GROWTH_COLS_PER_FLOOR * (floor - 1),
  );
  const rows = Math.min(
    FLOOR_GEN.MAX_ROWS,
    FLOOR_GEN.BASE_ROWS + Math.floor((FLOOR_GEN.GROWTH_COLS_PER_FLOOR * (floor - 1)) / 2),
  );
  const map = new TileMap(cols, rows);

  // 1. Place non-overlapping rooms.
  const targetRooms = rng.int(FLOOR_GEN.TARGET_ROOMS_MIN, FLOOR_GEN.TARGET_ROOMS_MAX);
  const rooms: Room[] = [];
  for (let attempt = 0; attempt < FLOOR_GEN.ROOM_ATTEMPTS && rooms.length < targetRooms; attempt++) {
    const w = rng.int(FLOOR_GEN.ROOM_MIN, FLOOR_GEN.ROOM_MAX);
    const h = rng.int(FLOOR_GEN.ROOM_MIN, FLOOR_GEN.ROOM_MAX);
    const room: Room = {
      tx: rng.int(2, cols - w - 3),
      ty: rng.int(2, rows - h - 3),
      w,
      h,
      kind: 'normal',
    };
    if (!rooms.some(existing => roomsOverlap(room, existing, 2))) rooms.push(room);
  }

  // Carve room interiors.
  for (const room of rooms) {
    for (let ty = room.ty; ty < room.ty + room.h; ty++) {
      for (let tx = room.tx; tx < room.tx + room.w; tx++) {
        map.set(tx, ty, Tile.Floor);
      }
    }
  }

  // 2. Connect rooms sequentially with 2-wide L corridors, plus a few loops.
  for (let i = 1; i < rooms.length; i++) {
    carveCorridor(map, roomCenter(rooms[i - 1]), roomCenter(rooms[i]), rng);
  }
  for (let i = 0; i < rooms.length; i++) {
    if (rng.chance(0.3)) {
      const other = rng.int(0, rooms.length - 1);
      if (other !== i) carveCorridor(map, roomCenter(rooms[i]), roomCenter(rooms[other]), rng);
    }
  }

  // 3. Wrap every carved tile in walls.
  wrapWithWalls(map);

  // 4. Assign special rooms. Start = first placed; stairs = farthest center;
  //    treasure = smallest remaining room (locked behind its doorways).
  const start = rooms[0];
  start.kind = 'start';
  const sc = roomCenter(start);
  let stairsRoom = rooms[rooms.length - 1];
  let bestDist = -1;
  for (const room of rooms) {
    if (room === start) continue;
    const c = roomCenter(room);
    const d = Math.abs(c.tx - sc.tx) + Math.abs(c.ty - sc.ty);
    if (d > bestDist) {
      bestDist = d;
      stairsRoom = room;
    }
  }
  stairsRoom.kind = 'stairs';

  const stairsTile = roomCenter(stairsRoom);
  map.set(stairsTile.tx, stairsTile.ty, Tile.Stairs);

  // Locking the treasure room must never cut the start → stairs path (a
  // corridor may route THROUGH the treasure room). Lock, verify with BFS,
  // revert if the stairs became unreachable.
  let treasureRoom: Room | null = null;
  const treasureCandidates = rooms
    .filter(r => r.kind === 'normal')
    .sort((a, b) => a.w * a.h - b.w * b.h);
  if (treasureCandidates.length > 0) {
    treasureRoom = treasureCandidates[0];
    treasureRoom.kind = 'treasure';
    const locked = lockRoom(map, treasureRoom);
    if (!isReachable(map, sc, stairsTile)) {
      for (const door of locked) map.set(door.tx, door.ty, Tile.Floor);
      treasureRoom.kind = 'normal';
      treasureRoom = null;
    }
  }

  // 5. Torches on room walls.
  const torches = placeTorches(map, rooms, rng);

  // 6. Shop room (v2) — a safe reachable normal room becomes the merchant's.
  const reachableRooms = rooms.filter(r => isReachable(map, sc, roomCenter(r)));
  const shop = maybePlaceShop(map, rng, reachableRooms, floor);

  // 7. Populate enemies + pickups. Key/resources only land in rooms the player
  //    can reach without the key. (Shop rooms stay enemy-free.)
  const enemies = spawnEnemies(rng, rooms, floor, biomeId);
  const pickups = spawnPickups(map, rng, reachableRooms, treasureRoom, floor);

  // 8. Environmental depth (v2): hazard tiles + destructible urns. Track
  //    occupied tiles so props never stack on each other or the stairs.
  const occupied = new Set<number>([stairsTile.ty * map.cols + stairsTile.tx]);
  const hazards = placeHazards(map, rng, rooms, floor, occupied, biomeId);
  const urns = placeUrns(map, rng, rooms, occupied);

  const startCenter = map.tileCenter(sc.tx, sc.ty);
  return {
    map,
    rooms,
    playerStart: startCenter,
    stairsTile,
    enemies,
    pickups,
    torches,
    isBossFloor: false,
    bossSpawn: null,
    shop,
    hazards,
    urns,
  };
}

function carveCorridor(
  map: TileMap,
  a: { tx: number; ty: number },
  b: { tx: number; ty: number },
  rng: Rng,
): void {
  // L-corridor, 2 tiles wide, horizontal-first or vertical-first at random.
  const carve = (tx: number, ty: number) => {
    for (let dy = 0; dy < 2; dy++) {
      for (let dx = 0; dx < 2; dx++) {
        const x = tx + dx;
        const y = ty + dy;
        if (x > 0 && y > 0 && x < map.cols - 1 && y < map.rows - 1) {
          if (map.get(x, y) !== Tile.Stairs) map.set(x, y, Tile.Floor);
        }
      }
    }
  };
  const horizontalFirst = rng.chance(0.5);
  const corner = horizontalFirst ? { tx: b.tx, ty: a.ty } : { tx: a.tx, ty: b.ty };
  for (const [from, to] of [
    [a, corner],
    [corner, b],
  ] as const) {
    const x0 = Math.min(from.tx, to.tx);
    const x1 = Math.max(from.tx, to.tx);
    const y0 = Math.min(from.ty, to.ty);
    const y1 = Math.max(from.ty, to.ty);
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) carve(tx, ty);
    }
  }
}

function wrapWithWalls(map: TileMap): void {
  for (let ty = 0; ty < map.rows; ty++) {
    for (let tx = 0; tx < map.cols; tx++) {
      if (map.get(tx, ty) !== Tile.Void) continue;
      let touchesFloor = false;
      for (let dy = -1; dy <= 1 && !touchesFloor; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const t = map.get(tx + dx, ty + dy);
          if (t === Tile.Floor || t === Tile.Stairs) {
            touchesFloor = true;
            break;
          }
        }
      }
      if (touchesFloor) map.set(tx, ty, Tile.Wall);
    }
  }
}

/**
 * Convert every floor opening on the room's perimeter ring into a locked door.
 * The room interior stays intact; the key (spawned elsewhere) opens a door on
 * contact. Returns the doors so the caller can revert if locking broke
 * connectivity.
 */
function lockRoom(map: TileMap, room: Room): Array<{ tx: number; ty: number }> {
  const doors: Array<{ tx: number; ty: number }> = [];
  const lock = (tx: number, ty: number) => {
    if (map.get(tx, ty) === Tile.Floor) {
      map.set(tx, ty, Tile.LockedDoor);
      doors.push({ tx, ty });
    }
  };
  const x0 = room.tx - 1;
  const y0 = room.ty - 1;
  const x1 = room.tx + room.w;
  const y1 = room.ty + room.h;
  for (let tx = x0; tx <= x1; tx++) {
    lock(tx, y0);
    lock(tx, y1);
  }
  for (let ty = y0; ty <= y1; ty++) {
    lock(x0, ty);
    lock(x1, ty);
  }
  return doors;
}

/** BFS over walkable tiles (locked doors are solid) from one tile to another. */
export function isReachable(
  map: TileMap,
  from: { tx: number; ty: number },
  to: { tx: number; ty: number },
): boolean {
  if (map.isSolidAt(from.tx, from.ty) || map.isSolidAt(to.tx, to.ty)) return false;
  const visited = new Uint8Array(map.cols * map.rows);
  const queue: number[] = [from.ty * map.cols + from.tx];
  visited[queue[0]] = 1;
  const target = to.ty * map.cols + to.tx;
  while (queue.length > 0) {
    const idx = queue.shift()!;
    if (idx === target) return true;
    const tx = idx % map.cols;
    const ty = Math.floor(idx / map.cols);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = tx + dx;
      const ny = ty + dy;
      if (nx < 0 || ny < 0 || nx >= map.cols || ny >= map.rows) continue;
      const nIdx = ny * map.cols + nx;
      if (visited[nIdx] || map.isSolidAt(nx, ny)) continue;
      visited[nIdx] = 1;
      queue.push(nIdx);
    }
  }
  return false;
}

function placeTorches(map: TileMap, rooms: Room[], rng: Rng): Array<{ tx: number; ty: number }> {
  const torches: Array<{ tx: number; ty: number }> = [];
  for (const room of rooms) {
    // Walk the wall ring just outside the interior; drop torches at intervals.
    let cadence = rng.int(2, FLOOR_GEN.TORCH_SPACING);
    const ring: Array<{ tx: number; ty: number }> = [];
    for (let tx = room.tx - 1; tx <= room.tx + room.w; tx++) {
      ring.push({ tx, ty: room.ty - 1 }, { tx, ty: room.ty + room.h });
    }
    for (let ty = room.ty; ty < room.ty + room.h; ty++) {
      ring.push({ tx: room.tx - 1, ty }, { tx: room.tx + room.w, ty });
    }
    for (const pos of ring) {
      if (map.get(pos.tx, pos.ty) !== Tile.Wall) continue;
      cadence--;
      if (cadence <= 0) {
        map.set(pos.tx, pos.ty, Tile.TorchWall);
        torches.push(pos);
        cadence = FLOOR_GEN.TORCH_SPACING;
      }
    }
  }
  return torches;
}

function randomFloorTileInRoom(rng: Rng, room: Room): { tx: number; ty: number } {
  return {
    tx: rng.int(room.tx, room.tx + room.w - 1),
    ty: rng.int(room.ty, room.ty + room.h - 1),
  };
}

function pickWeighted(rng: Rng, floor: number, biomeId?: string): EnemyTypeId {
  // Biome derives purely from (floor, quest biome), so determinism holds.
  const rows = spawnWeightsForFloor(floor, biomeFor(floor, biomeId).id).filter(r => r.weight > 0);
  const total = rows.reduce((sum, r) => sum + r.weight, 0);
  let roll = rng.next() * total;
  for (const row of rows) {
    roll -= row.weight;
    if (roll <= 0) return row.type;
  }
  return rows[rows.length - 1].type;
}

const ELITE_TRAITS: readonly EliteTrait[] = ['frenzied', 'bulwark', 'volatile', 'gilded'];

function rollElite(rng: Rng, floor: number): EliteTrait | null {
  if (floor < ELITES.FLOOR_MIN) return null;
  const chance = Math.min(
    ELITES.CHANCE_CAP,
    ELITES.BASE_CHANCE + ELITES.CHANCE_PER_FLOOR * (floor - ELITES.FLOOR_MIN),
  );
  return rng.chance(chance) ? rng.pick(ELITE_TRAITS) : null;
}

function spawnEnemies(rng: Rng, rooms: Room[], floor: number, biomeId?: string): EnemySpawnPlan[] {
  const enemies: EnemySpawnPlan[] = [];
  for (const room of rooms) {
    if (room.kind === 'start' || room.kind === 'shop') continue;
    if (room.kind === 'treasure') {
      // Treasure rooms get their guardian mimic from floor 2 on.
      if (floor >= 2) {
        const t = randomFloorTileInRoom(rng, room);
        enemies.push({ type: 'mimic', x: (t.tx + 0.5) * TILE, y: (t.ty + 0.5) * TILE, elite: null });
      }
      continue;
    }
    const budget = enemyBudgetForRoom(room.w * room.h, floor);
    for (let i = 0; i < budget; i++) {
      const t = randomFloorTileInRoom(rng, room);
      enemies.push({
        type: pickWeighted(rng, floor, biomeId),
        x: (t.tx + 0.5) * TILE,
        y: (t.ty + 0.5) * TILE,
        elite: rollElite(rng, floor),
      });
    }
  }
  return enemies;
}

// ---------------------------------------------------------------- v2 features

function maybePlaceShop(map: TileMap, rng: Rng, reachableRooms: Room[], floor: number): ShopPlan | null {
  if (floor < SHOP.FLOOR_MIN || !rng.chance(SHOP.ROOM_CHANCE)) return null;
  const candidates = reachableRooms.filter(r => r.kind === 'normal' && r.w >= 5 && r.h >= 4);
  if (candidates.length === 0) return null;
  const room = rng.pick(candidates);
  room.kind = 'shop';

  const c = roomCenter(room);
  const merchant = map.tileCenter(c.tx, c.ty - 1);

  // Third pedestal: relic, potion or (v3) an unidentified scroll.
  const third: ShopProduct = rng.chance(0.4) ? 'relic' : rng.chance(0.5) ? 'potion' : 'scroll';
  const products: ShopProduct[] = ['heart', 'daggers', third];
  const priceFor = (product: ShopProduct): number => {
    switch (product) {
      case 'heart':
        return SHOP.PRICE_HEART;
      case 'daggers':
        return SHOP.PRICE_DAGGERS;
      case 'potion':
        return SHOP.PRICE_POTION;
      case 'relic':
        return SHOP.PRICE_RELIC_BASE + SHOP.PRICE_RELIC_PER_FLOOR * floor;
      case 'scroll':
        return SHOP.PRICE_SCROLL;
    }
  };
  const items: ShopItemPlan[] = products.map((product, i) => {
    const spot = map.tileCenter(c.tx + (i - 1) * 2, c.ty + 1);
    return { product, price: priceFor(product), x: spot.x, y: spot.y };
  });

  return { merchant, items };
}

function placeHazards(
  map: TileMap,
  rng: Rng,
  rooms: Room[],
  floor: number,
  occupied: Set<number>,
  biomeId?: string,
): HazardSpawnPlan[] {
  const hazards: HazardSpawnPlan[] = [];
  if (floor < 2) return hazards;
  const style = biomeFor(floor, biomeId).hazardStyle;
  for (const room of rooms) {
    if (room.kind !== 'normal' && room.kind !== 'stairs') continue;
    const count = rng.int(0, Math.min(3, 1 + Math.floor(floor / 3)));
    for (let i = 0; i < count; i++) {
      const t = randomFloorTileInRoom(rng, room);
      const key = t.ty * map.cols + t.tx;
      if (occupied.has(key) || map.get(t.tx, t.ty) !== Tile.Floor) continue;
      occupied.add(key);
      hazards.push({ tx: t.tx, ty: t.ty, style });
    }
  }
  return hazards;
}

function placeUrns(
  map: TileMap,
  rng: Rng,
  rooms: Room[],
  occupied: Set<number>,
): Array<{ x: number; y: number; variant: number }> {
  const urns: Array<{ x: number; y: number; variant: number }> = [];
  for (const room of rooms) {
    if (room.kind !== 'normal' && room.kind !== 'stairs') continue;
    const count = rng.int(1, 3);
    for (let i = 0; i < count; i++) {
      const t = randomFloorTileInRoom(rng, room);
      const key = t.ty * map.cols + t.tx;
      if (occupied.has(key) || map.get(t.tx, t.ty) !== Tile.Floor) continue;
      occupied.add(key);
      const center = map.tileCenter(t.tx, t.ty);
      urns.push({ x: center.x, y: center.y, variant: rng.int(0, 2) });
    }
  }
  return urns;
}

function spawnPickups(
  map: TileMap,
  rng: Rng,
  rooms: Room[],
  treasureRoom: Room | null,
  floor: number,
): PickupSpawnPlan[] {
  const pickups: PickupSpawnPlan[] = [];
  const place = (kind: PickupKind, room: Room) => {
    const t = randomFloorTileInRoom(rng, room);
    if (map.get(t.tx, t.ty) !== Tile.Floor) return;
    pickups.push({ kind, x: (t.tx + 0.5) * TILE, y: (t.ty + 0.5) * TILE });
  };

  const normalRooms = rooms.filter(r => r.kind === 'normal' || r.kind === 'stairs');

  // Gold scatter.
  const goldCount = rng.int(10, 14 + floor);
  for (let i = 0; i < goldCount; i++) place('gold', rng.pick(normalRooms));

  // Survival resources.
  const heartCount = rng.int(1, 2);
  for (let i = 0; i < heartCount; i++) place('heart', rng.pick(normalRooms));
  const daggerCount = rng.int(1, 2);
  for (let i = 0; i < daggerCount; i++) place('dagger', rng.pick(normalRooms));
  if (rng.chance(0.8)) place('potion', rng.pick(normalRooms));
  // v3 — an unidentified scroll, most floors (identity rolls at pickup).
  if (rng.chance(0.5)) place('scroll', rng.pick(normalRooms));

  // Treasure room: shrine + gold pile; key hidden in a normal room.
  if (treasureRoom) {
    place('relic-shrine', treasureRoom);
    for (let i = 0; i < rng.int(4, 6); i++) place('gold', treasureRoom);
    if (normalRooms.length > 0) place('key', rng.pick(normalRooms));
  }

  return pickups;
}

// ---------------------------------------------------------------- boss arena

function generateBossArena(rng: Rng, floor: number): FloorPlan {
  const cols = FLOOR_GEN.BOSS_ARENA_COLS;
  const rows = FLOOR_GEN.BOSS_ARENA_ROWS;
  const map = new TileMap(cols, rows);

  const arena: Room = { tx: 2, ty: 2, w: cols - 4, h: rows - 4, kind: 'arena' };
  for (let ty = arena.ty; ty < arena.ty + arena.h; ty++) {
    for (let tx = arena.tx; tx < arena.tx + arena.w; tx++) {
      map.set(tx, ty, Tile.Floor);
    }
  }
  // Four pillars give the player charge cover.
  const pillars = [
    { tx: arena.tx + 4, ty: arena.ty + 4 },
    { tx: arena.tx + arena.w - 6, ty: arena.ty + 4 },
    { tx: arena.tx + 4, ty: arena.ty + arena.h - 6 },
    { tx: arena.tx + arena.w - 6, ty: arena.ty + arena.h - 6 },
  ];
  for (const p of pillars) {
    for (let dy = 0; dy < 2; dy++) {
      for (let dx = 0; dx < 2; dx++) map.set(p.tx + dx, p.ty + dy, Tile.Wall);
    }
  }
  wrapWithWalls(map);

  // Stairs at top-center — DungeonCrawlGame keeps them locked until the boss falls.
  const stairsTile = { tx: arena.tx + Math.floor(arena.w / 2), ty: arena.ty + 1 };
  map.set(stairsTile.tx, stairsTile.ty, Tile.Stairs);

  const torches = placeTorches(map, [arena], rng);

  const playerStart = map.tileCenter(arena.tx + Math.floor(arena.w / 2), arena.ty + arena.h - 3);
  const bossSpawn = map.tileCenter(arena.tx + Math.floor(arena.w / 2), arena.ty + Math.floor(arena.h / 2) - 1);

  // A little sustenance before the fight.
  const pickups: PickupSpawnPlan[] = [
    { kind: 'heart', ...map.tileCenter(arena.tx + 2, arena.ty + arena.h - 2) },
    { kind: 'dagger', ...map.tileCenter(arena.tx + arena.w - 3, arena.ty + arena.h - 2) },
  ];
  void floor;

  return {
    map,
    rooms: [arena],
    playerStart,
    stairsTile,
    enemies: [],
    pickups,
    torches,
    isBossFloor: true,
    bossSpawn,
    shop: null,
    hazards: [],
    urns: [],
  };
}
