// ===== src/games/dungeon-crawl/data/progression.ts =====
// v4 — the character's growth: XP curve, per-class level gains (hit-die
// flavored, inspiration layer), level-pressure knobs and hero flavor names.
// Pure data + pure functions; ProgressionController owns the live state.

import { ClassId } from './classes';

export const LEVEL_CAP = 10;

/** Cumulative XP required to BE level N (index = level; [0] and [1] are 0). */
export const LEVEL_CURVE: readonly number[] = [
  0, 0, 150, 400, 800, 1400, 2200, 3200, 4500, 6200, 8400,
];

export function levelForXp(xp: number): number {
  let level = 1;
  for (let n = 2; n <= LEVEL_CAP; n++) {
    if (xp >= LEVEL_CURVE[n]) level = n;
  }
  return level;
}

/** Progress through the current level: have/need XP and a 0..1 bar fraction. */
export function xpIntoLevel(
  xp: number,
  level: number,
): { have: number; need: number; frac: number } {
  if (level >= LEVEL_CAP) return { have: 0, need: 0, frac: 1 };
  const floor = LEVEL_CURVE[level];
  const ceil = LEVEL_CURVE[level + 1];
  const have = Math.max(0, xp - floor);
  const need = ceil - floor;
  return { have, need, frac: Math.max(0, Math.min(1, have / need)) };
}

export interface LevelGain {
  hp?: number;
  speed?: number; // additive fraction on top of the kit
  daggerCap?: number;
}

/**
 * Gains arriving AT each level: index 0 = reaching level 2 ... index 8 = level
 * 10 (nine rows per class). Hit-die flavor: fighter/cleric end at 20 hp, thief
 * trades hp for stride, mage stays fragile but deepens the mana pool.
 */
export const LEVEL_GAINS: Record<ClassId, readonly LevelGain[]> = {
  fighter: [
    { hp: 2 }, { hp: 1 }, { hp: 1 }, { hp: 2 }, { hp: 1 },
    { hp: 1 }, { hp: 2 }, { hp: 1 }, { hp: 1 },
  ],
  cleric: [
    { hp: 2 }, { hp: 1 }, { hp: 2 }, { hp: 1 }, { hp: 2 },
    { hp: 1 }, { hp: 2 }, { hp: 1 }, { hp: 2 },
  ],
  thief: [
    { hp: 1 }, { hp: 1, speed: 0.03 }, { hp: 1 }, { hp: 1 },
    { hp: 1, speed: 0.03 }, { hp: 1 }, { hp: 1 },
    { hp: 1, speed: 0.03 }, { hp: 1 },
  ],
  mage: [
    { hp: 1, daggerCap: 1 }, { hp: 1 }, { hp: 1, daggerCap: 1 }, { hp: 1 },
    { hp: 1, daggerCap: 1 }, { hp: 1 }, { hp: 1, daggerCap: 1 }, { hp: 1 },
    { hp: 1, daggerCap: 1 },
  ],
};

/** Sum of every gain earned up to (and including) the given level. */
export function cumulativeGains(classId: ClassId, level: number): Required<LevelGain> {
  const total = { hp: 0, speed: 0, daggerCap: 0 };
  const rows = LEVEL_GAINS[classId];
  for (let i = 0; i < Math.min(level - 1, rows.length); i++) {
    total.hp += rows[i].hp ?? 0;
    total.speed += rows[i].speed ?? 0;
    total.daggerCap += rows[i].daggerCap ?? 0;
  }
  return total;
}

export const PROGRESSION = {
  ELITE_XP_MULT: 3,
  BOSS_XP: 200,
  // Level pressure: enemy hp scales with hero level so floor 1 stays honest.
  PRESSURE_HP_PER_LEVEL: 0.05,
  PRESSURE_HP_CAP: 1.45,
  RETIRE_HOLD_SECONDS: 1.5, // hold R on the recap to retire the hero
} as const;

/** Original flavor names; picked by seeded rng at character creation. */
export const HERO_NAMES: Record<ClassId, readonly string[]> = {
  fighter: ['SIR ROWAN', 'DAME KESTREL', 'GARRICK', 'SER ALDEN', 'BRYNNA'],
  thief: ['WREN', 'QUICK TOBIAS', 'SABLE', 'MIRELLE', 'FINCH'],
  cleric: ['BROTHER ANSEL', 'SISTER MAREN', 'CADOC', 'IVETTE', 'PIOUS OREN'],
  mage: ['ELDRIN', 'MOTHE', 'SERAPHINE', 'OLD CASPAR', 'YSOLDE'],
};
