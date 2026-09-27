// ===== src/games/tapdodge/systems/layout.ts =====
//
// The one place the highway's geometry lives. Everything that asks "which
// lane is this?" or "where does the playfield start?" reads it from here, so
// the HUD bands, the spawner and the ship can never disagree about it.
//
//   0 ........ 58   the gantry (score, zone, fever) — HUD only
//   58 ...... 556   the playfield: rows emerge from under the gantry
//   556 ..... 600   the deck (power-ups, hull) — HUD only
//
// The road is five 120px lanes centred on the canvas; the 100px shoulders
// either side carry the zone's scenery and never hold a hazard.

export const VIEW_W = 800;
export const VIEW_H = 600;

export const GANTRY_H = 58;
export const DECK_Y = 556;

export const LANES = 5;
export const LANE_W = 120;
export const ROAD_W = LANES * LANE_W;
export const ROAD_X = (VIEW_W - ROAD_W) / 2;

/** Where rows are born: their bottom edge touches the gantry's lower edge. */
export const SPAWN_Y = GANTRY_H;

/** The ship's centre line. */
export const SHIP_Y = 506;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function laneCenter(lane: number): number {
  return ROAD_X + LANE_W * (lane + 0.5);
}

export function clampLane(lane: number): number {
  return Math.max(0, Math.min(LANES - 1, lane));
}

/** The lane whose centre is nearest to x (clamped to the road). */
export function laneAt(x: number): number {
  return clampLane(Math.floor((x - ROAD_X) / LANE_W));
}

export function intersects(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
  );
}

/** Edge-to-edge distance between two boxes; 0 when they touch or overlap. */
export function rectGap(a: Rect, b: Rect): number {
  const dx = Math.max(0, a.x - (b.x + b.w), b.x - (a.x + a.w));
  const dy = Math.max(0, a.y - (b.y + b.h), b.y - (a.y + a.h));
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Small deterministic PRNG. The spawner and the scenery own one each so a
 * run's layout depends only on its seed, never on how many particles a
 * frame happened to spawn.
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
