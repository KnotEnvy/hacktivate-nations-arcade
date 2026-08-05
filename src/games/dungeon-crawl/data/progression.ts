// ===== src/games/dungeon-crawl/data/progression.ts =====
// v4 — the character's growth: XP curve, per-class level gains (hit-die
// flavored, inspiration layer), level-pressure knobs and hero flavor names.
// Pure data + pure functions; ProgressionController owns the live state.

import { ClassId } from './classes';

/**
 * Wave Q1 — THE LONG ASCENT. The cap was 10 for the whole dungeon era; the
 * planes want heroes who have gone twice as far (DM Option: High-Level
 * Campaigns, Ch. 7 — past 10th level a character's growth changes KIND, not
 * just magnitude). Levels 11-20 are that band; THE GREAT BOONS in data/boons.ts
 * are what makes them feel different.
 */
export const LEVEL_CAP = 20;

/**
 * Cumulative XP required to BE level N (index = level; [0] and [1] are 0).
 *
 * Wave Q1 — the ascent's ten rows continue the curve's shape (each step costs
 * a little more than the last) rather than 2e's doubling, which would price
 * level 20 out of an arcade run. Level 20 lands at ~55k lifetime XP. THIS IS
 * PLAYTEST KNOB #1: halve the ascent deltas if the climb drags.
 */
export const LEVEL_CURVE: readonly number[] = [
  0, 0, 150, 400, 800, 1400, 2200, 3200, 4500, 6200, 8400,
  // The ascent: +2400 / +2800 / +3200 / +3700 / +4200 ...
  10800, 13600, 16800, 20500, 24700,
  // ... +4800 / +5400 / +6100 / +6800 / +7600
  29500, 34900, 41000, 47800, 55400,
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
 * Gains arriving AT each level: index 0 = reaching level 2 ... index 18 =
 * level 20 (nineteen rows per class). Wave L — HP left these rows for the HIT
 * DIE: every level-up ROLLS the class die live and the hero keeps the roll
 * (hpRolls on the save). The rows carry only the side benefits: thief stride,
 * mage mana-pool depth.
 *
 * Wave Q1 — the ascent's ten rows keep the SAME grammar rather than inventing
 * a new one: the thief's stride still arrives every third level, the mage's
 * pool every other. Fighter and cleric rows stay empty at 11-20 exactly as at
 * 2-10 — their growth is the best hit dice in the game plus the boons they
 * draft, and THE GREAT BOONS are the ascent's real reward for every class.
 */
export const LEVEL_GAINS: Record<ClassId, readonly LevelGain[]> = {
  fighter: [
    {}, {}, {}, {}, {}, {}, {}, {}, {},
    {}, {}, {}, {}, {}, {}, {}, {}, {}, {},
  ],
  cleric: [
    {}, {}, {}, {}, {}, {}, {}, {}, {},
    {}, {}, {}, {}, {}, {}, {}, {}, {}, {},
  ],
  thief: [
    {}, { speed: 0.03 }, {}, {},
    { speed: 0.03 }, {}, {},
    { speed: 0.03 }, {},
    // The ascent: stride at 11, 14, 17.
    { speed: 0.03 }, {}, {},
    { speed: 0.03 }, {}, {},
    { speed: 0.03 }, {}, {}, {},
  ],
  mage: [
    { daggerCap: 1 }, {}, { daggerCap: 1 }, {},
    { daggerCap: 1 }, {}, { daggerCap: 1 }, {},
    { daggerCap: 1 },
    // The ascent: the pool deepens at 11, 13, 15, 17, 19.
    { daggerCap: 1 }, {}, { daggerCap: 1 }, {},
    { daggerCap: 1 }, {}, { daggerCap: 1 }, {},
    { daggerCap: 1 }, {},
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

/**
 * Wave L — the middle-of-the-die backfill: veterans saved before hit dice
 * existed (and any missing hpRolls entry) are treated as having rolled the
 * average, rounded up. d10 -> 6, d8 -> 5, d6 -> 4, d4 -> 3.
 */
export function averageHpRoll(hitDie: number): number {
  return Math.ceil((hitDie + 1) / 2);
}

export const PROGRESSION = {
  ELITE_XP_MULT: 3,
  BOSS_XP: 200,
  // Level pressure: enemy hp scales with hero level so floor 1 stays honest.
  // Wave Q1 — the cap rose with the level cap (it was 1.45, reached at level
  // 10, which left an ascended hero walking through the old depths). The
  // per-level rate is UNCHANGED, so a level-10 hero meets exactly the
  // resistance it always did; only 11-20 pushes past the old ceiling.
  PRESSURE_HP_PER_LEVEL: 0.05,
  PRESSURE_HP_CAP: 1.75,
  RETIRE_HOLD_SECONDS: 1.5, // hold R on the recap to retire the hero
} as const;

/** Original flavor names; picked by seeded rng at character creation. */
export const HERO_NAMES: Record<ClassId, readonly string[]> = {
  fighter: ['SIR ROWAN', 'DAME KESTREL', 'GARRICK', 'SER ALDEN', 'BRYNNA'],
  thief: ['WREN', 'QUICK TOBIAS', 'SABLE', 'MIRELLE', 'FINCH'],
  cleric: ['BROTHER ANSEL', 'SISTER MAREN', 'CADOC', 'IVETTE', 'PIOUS OREN'],
  mage: ['ELDRIN', 'MOTHE', 'SERAPHINE', 'OLD CASPAR', 'YSOLDE'],
};
