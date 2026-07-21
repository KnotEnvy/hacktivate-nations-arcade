// ===== src/games/dungeon-crawl/data/curses.ts =====
// Wave O — THE TEMPLE AND THE CURSE. Some veiled shrine relics are lies: a
// cursed thing wearing a relic's shape. A curse is ONE run-long malus that
// CLINGS to the hero at run end (SavedHero.curse) until the temple lifts it
// for banked gold. Pure data + pure helpers; Player.ts folds the maluses,
// PickupResolver rolls the veil, TownController sells the cure.

export type CurseId = 'leaden-blood' | 'dim-sight' | 'hungry-wound' | 'misers-shadow';

export interface CurseDef {
  id: CurseId;
  name: string;
  blurb: string; // one line on banners / the sheet
  icon: string; // single glyph
  color: string;
}

export const CURSES: Record<CurseId, CurseDef> = {
  'leaden-blood': {
    id: 'leaden-blood',
    name: 'LEADEN BLOOD',
    blurb: 'Your stride drags — the depths feel heavier',
    icon: '⬇',
    color: '#8a7ba6',
  },
  'dim-sight': {
    id: 'dim-sight',
    name: 'THE DIMMING',
    blurb: 'Your torchlight draws in close and afraid',
    icon: '◍',
    color: '#6b5f8a',
  },
  'hungry-wound': {
    id: 'hungry-wound',
    name: 'THE HUNGRY WOUND',
    blurb: 'Hearts mend less — something drinks the cure',
    icon: '♡',
    color: '#a64d6b',
  },
  'misers-shadow': {
    id: 'misers-shadow',
    name: "THE MISER'S SHADOW",
    blurb: 'Gold thins in your hands — half slips into the dark',
    icon: '◌',
    color: '#7d7358',
  },
};

export const ALL_CURSE_IDS = Object.keys(CURSES) as CurseId[];

/** Sanitize helper — unknown or absent lands uncursed (veterans unchanged). */
export function asCurseId(raw: unknown): CurseId | null {
  return typeof raw === 'string' && (ALL_CURSE_IDS as string[]).includes(raw)
    ? (raw as CurseId)
    : null;
}

export const CURSE_TUNING = {
  /** Chance a shrine relic arrives veiled (name hidden) instead of named. */
  VEIL_CHANCE: 0.5,
  /** Chance a VEILED find is a lie — a curse, not a relic. */
  CURSE_CHANCE: 0.35,
  LEADEN_SPEED_MULT: 0.9,
  DIM_TORCH_MALUS: 1,
  HUNGRY_HEAL_MALUS: 2,
  MISER_GOLD_MULT: 0.5,
  /** Temple rite: banked gold to lift a clinging curse. */
  LIFT_PRICE_BASE: 60,
  LIFT_PRICE_PER_LEVEL: 15,
} as const;
