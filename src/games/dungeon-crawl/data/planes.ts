// ===== src/games/dungeon-crawl/data/planes.ts =====
// Wave Q2 — THE PLANES: what lies past the gate for a hero who has ascended.
//
// The Monstrous Compendium's Outer Planes Appendix states the design of this
// whole wave in one line: a philosophy holds sway on each outer plane, and
// that philosophy influences everything on the plane — including reality
// itself. So a plane here is not a recoloured floor. It is a LAW: one rule the
// hero has leaned on for twenty levels, rewritten for the duration.
//
// Pure data. The palettes live in data/constants.ts beside BIOMES (constants
// owns palettes; this file imports the type, never the reverse, or the two
// cycle). Nothing here is saved — a plane is a property of the quest you took.
// All text original; archetypes generic.

import { BiomePalette, paletteById } from './constants';

export type PlaneId = 'silver-void' | 'brass-marches' | 'churning' | 'the-pit';

/**
 * The four laws, as flags the game reads through `planeLawFor`. Each is one
 * read at an existing seam — never a new system:
 *
 * - `noCover`   THE SILVER VOID. There is no dark and nothing to hide behind:
 *               the plane is lit by its own nature and every foe acquires you
 *               without line of sight.
 * - `unbroken`  THE BRASS MARCHES. Nothing here loses its nerve. Morale does
 *               not exist under this law — no rout, ever.
 * - `gating`    THE CHURNING. Nothing holds its shape. A slain foe may call
 *               one of its own kin through after it (once — a gated foe never
 *               gates, so a room can never run away with itself).
 * - `ranks`     THE PIT. The legion arrives in ranks: reinforcements answer on
 *               a slow timer through the whole expedition, not just at camp.
 */
export interface PlaneLaw {
  noCover?: true;
  unbroken?: true;
  gating?: true;
  ranks?: true;
}

export interface PlaneDef {
  id: PlaneId;
  name: string;
  /** One line on the Waydoor's card. */
  blurb: string;
  /** The law, stated to the player as the plane's own rule. */
  lawLine: string;
  law: PlaneLaw;
  /** Cloth colors for the Waydoor's card and the arrival banner. */
  color: string;
  accent: string;
}

export const PLANES: Record<PlaneId, PlaneDef> = {
  'silver-void': {
    id: 'silver-void',
    name: 'THE SILVER VOID',
    blurb: 'A day without a sun, and islands adrift in it. Nothing casts a shadow.',
    lawLine: 'HERE THERE IS NO DARK — AND NO COVER',
    law: { noCover: true },
    color: '#cfe3ff',
    accent: '#ffffff',
  },
  'brass-marches': {
    id: 'brass-marches',
    name: 'THE BRASS MARCHES',
    blurb: 'Plains ruled into squares by something that never revised them.',
    lawLine: 'HERE NOTHING BREAKS',
    law: { unbroken: true },
    color: '#ffc24a',
    accent: '#ffe9a8',
  },
  churning: {
    id: 'churning',
    name: 'THE CHURNING',
    blurb: 'Raw possibility, still deciding. What you kill has other drafts.',
    lawLine: 'HERE NOTHING HOLDS ITS SHAPE',
    law: { gating: true },
    color: '#b96bff',
    accent: '#f0c8ff',
  },
  'the-pit': {
    id: 'the-pit',
    name: 'THE PIT',
    blurb: 'Cruelty with a filing system. The stairs are held, and the holders are relieved on schedule.',
    lawLine: 'HERE THE LEGION ARRIVES IN RANKS',
    law: { ranks: true },
    color: '#ff5a2a',
    accent: '#ffb066',
  },
};

export const ALL_PLANE_IDS = Object.keys(PLANES) as PlaneId[];

/** Every number the four laws turn on — knobs, like everything else. */
export const PLANE_TUNING = {
  // THE CHURNING — odds a slain foe calls one of its kin through after it.
  GATE_CHANCE: 0.3,
  // THE PIT — seconds between reinforcement rolls, and the odds each roll
  // answers. Deliberately slower than the stairs camp's wander die: this runs
  // for the WHOLE expedition, not for as long as you choose to sit still.
  RANKS_INTERVAL: 22,
  RANKS_CHANCE: 0.55,
} as const;

/**
 * Wave Q2 — THE RITE OF ASCENSION. DM Option: High-Level Campaigns puts the
 * rite past 20th level and prices the offering at the hero's lifetime
 * experience; here that converts to banked gold at ASCENSION_GOLD_PER_XP and
 * rounds to something a treasury can be counted against.
 */
export const ASCENSION = {
  GOLD_PER_XP: 0.05,
  ROUND_TO: 50,
  MIN_PRICE: 1500,
} as const;

/** The offering a hero of this experience must make. Pure. */
export function ascensionPrice(xp: number): number {
  const raw = Math.max(ASCENSION.MIN_PRICE, Math.round(xp * ASCENSION.GOLD_PER_XP));
  return Math.round(raw / ASCENSION.ROUND_TO) * ASCENSION.ROUND_TO;
}

/**
 * Wave Q2 — may this hero walk the planes? The Wave G `metaUnlocked`
 * precedent: pure, stateless, derived from the save and nothing else. Both
 * halves are required — reaching the cap earns the RIGHT to the rite, and the
 * rite is what actually opens the way.
 */
export function planesOpen(
  hero: { level: number; ascended?: boolean } | null | undefined,
  levelCap: number,
): boolean {
  return !!hero && hero.level >= levelCap && hero.ascended === true;
}

/** True when a biome id names a plane rather than a dungeon biome. */
export function isPlaneId(id: string | null | undefined): id is PlaneId {
  return !!id && (ALL_PLANE_IDS as string[]).includes(id);
}

/**
 * The law in force. Every law read in the codebase goes through here — never a
 * string comparison at a call site — so the dungeon (and any future plane)
 * answers one question in one place. An ordinary floor has no law at all.
 */
const NO_LAW: PlaneLaw = {};
export function planeLawFor(biomeId: string | null | undefined): PlaneLaw {
  return isPlaneId(biomeId) ? PLANES[biomeId].law : NO_LAW;
}

/** The plane a biome id names, or null for the dungeon. */
export function planeFor(biomeId: string | null | undefined): PlaneDef | null {
  return isPlaneId(biomeId) ? PLANES[biomeId] : null;
}

/* Sanity at module load: every plane must own a real palette, and that palette
   must be planar (void-styled). A plane whose palette went missing would fall
   back to the dungeon cycle and quietly render as stone. */
for (const id of ALL_PLANE_IDS) {
  const palette: BiomePalette | null = paletteById(id);
  if (!palette) throw new Error(`plane ${id}: no palette of that id exists`);
  if (palette.style !== 'void') throw new Error(`plane ${id}: palette must be void-styled`);
}
