// ===== src/games/dungeon-crawl/data/stats.ts =====
// v5 Wave E — the six ability scores. Every hero carries a full array rolled
// at the forge from a class-flavored base; gameplay folds read the DELTA
// between the hero's modifier and the class-base modifier, so a hero at the
// flat base array plays exactly like the pre-stats game and growth (forge
// variance, milestone bumps, item bonuses) is texture on top, never a
// rebalance. Pure data + pure functions; Player/Combat/game consume the
// deltas. Text original.

import { ClassId } from './classes';
import { Rng } from '../dungeon/rng';

export type StatId = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha';

export interface StatDef {
  id: StatId;
  abbr: string; // the sheet/card tag: STR, DEX...
  name: string;
  blurb: string; // one line on the milestone level-up card
  icon: string;
  color: string;
}

export const STATS: Record<StatId, StatDef> = {
  str: {
    id: 'str',
    abbr: 'STR',
    name: 'STRENGTH',
    blurb: 'Raw might — heavier blows, farther knockback',
    icon: '⚔',
    color: '#e05a3d',
  },
  dex: {
    id: 'dex',
    abbr: 'DEX',
    name: 'DEXTERITY',
    blurb: 'Quickness — a faster stride, a readier dash',
    icon: '➳',
    color: '#7ae0ff',
  },
  con: {
    id: 'con',
    abbr: 'CON',
    name: 'CONSTITUTION',
    blurb: 'Endurance — a deeper well of hearts',
    icon: '♥',
    color: '#d1604f',
  },
  int: {
    id: 'int',
    abbr: 'INT',
    name: 'INTELLIGENCE',
    blurb: 'Arcana — spells bite harder and return sooner',
    icon: '✦',
    color: '#9a7bff',
  },
  wis: {
    id: 'wis',
    abbr: 'WIS',
    name: 'WISDOM',
    blurb: 'Insight — deeper mending, lessons learned faster',
    icon: '☽',
    color: '#e8dcbc',
  },
  cha: {
    id: 'cha',
    abbr: 'CHA',
    name: 'CHARISMA',
    blurb: 'Presence — kinder prices, richer bounties',
    icon: '♕',
    color: '#ffd24a',
  },
};

export const ALL_STAT_IDS = Object.keys(STATS) as StatId[];

/** A full six-score array (always complete once sanitized). */
export type StatScores = Record<StatId, number>;

/**
 * Class base arrays — each sums to 72; the favored pair sits deliberately on
 * ODD scores so the first milestone bump always crosses a modifier boundary.
 */
export const STAT_BASES: Record<ClassId, StatScores> = {
  fighter: { str: 17, dex: 10, con: 15, int: 9, wis: 10, cha: 11 },
  thief: { str: 10, dex: 17, con: 11, int: 12, wis: 9, cha: 13 },
  cleric: { str: 13, dex: 9, con: 13, int: 10, wis: 17, cha: 10 },
  mage: { str: 8, dex: 13, con: 10, int: 17, wis: 12, cha: 12 },
};

/** The two scores a class's milestone draft leads with. */
export const STAT_FAVORED: Record<ClassId, readonly [StatId, StatId]> = {
  fighter: ['str', 'con'],
  thief: ['dex', 'cha'],
  cleric: ['wis', 'con'],
  mage: ['int', 'dex'],
};

export const STAT_TUNING = {
  SCORE_MAX: 18,
  /** Points the forge scatters over the base array (seeded). */
  FORGE_VARIANCE_POINTS: 2,
  /** Reaching these levels leads the draft with favored-stat cards. */
  MILESTONE_LEVELS: [3, 6, 9] as readonly number[],
  // Per DELTA modifier point:
  STR_DAMAGE: 1, // sword damage (daggers inherit)
  STR_KNOCKBACK: 20, // px onto the kit's melee knockback
  DEX_SPEED: 0.03, // additive into the speed training sum
  DEX_DASH_CD_MULT: 0.92, // dash cooldown ×this^dex
  CON_HP: 2, // one heart
  INT_SPELL_CD_MULT: 0.9, // spell cooldown ×this^int
  INT_SPELL_DAMAGE: 1, // burning hands / fireball
  WIS_HEAL: 1, // hearts and cure/bless mend this much more
  WIS_XP_MULT: 0.05, // xp ×(1 + this·wis)
  CHA_SHOP_DISCOUNT: 0.05, // joins the haggler discount
  CHA_QUEST_GOLD: 0.05, // quest rewardGold ×(1 + this·cha)
} as const;

/** The one modifier formula: 10–11 → 0, 12–13 → +1, 17 → +3, 18 → +4. */
export function statMod(score: number): number {
  return Math.floor((score - 10) / 2);
}

export function zeroStatMods(): Record<StatId, number> {
  return { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 };
}

/**
 * Modifier deltas vs the class base — the numbers gameplay folds actually
 * read. Sanitize clamps scores at the class base, so these never go
 * negative (the floor here is belt-and-braces).
 */
export function statModDeltas(classId: ClassId, scores: StatScores): Record<StatId, number> {
  const base = STAT_BASES[classId];
  const out = zeroStatMods();
  for (const id of ALL_STAT_IDS) {
    out[id] = Math.max(0, statMod(scores[id]) - statMod(base[id]));
  }
  return out;
}

/**
 * v5 Wave F — scores with live equipment bonuses laid on top. No cap: the
 * modifier flooring self-limits (18→19 changes nothing, 19→20 crosses).
 */
export function withStatBonus(
  scores: StatScores,
  bonus: Partial<Record<StatId, number>>,
): StatScores {
  const out = { ...scores };
  for (const id of ALL_STAT_IDS) out[id] += bonus[id] ?? 0;
  return out;
}

/** Forge roll: the class base plus `points` scattered by rng (Wave I: a
 * human hero's FAR HORIZONS passes one extra; the default is unchanged). */
export function rollStatScores(
  classId: ClassId,
  rng: Rng,
  points: number = STAT_TUNING.FORGE_VARIANCE_POINTS,
): StatScores {
  const scores: StatScores = { ...STAT_BASES[classId] };
  for (let i = 0; i < points; i++) {
    let id = ALL_STAT_IDS[rng.int(0, ALL_STAT_IDS.length - 1)];
    while (scores[id] >= STAT_TUNING.SCORE_MAX) {
      id = ALL_STAT_IDS[rng.int(0, ALL_STAT_IDS.length - 1)];
    }
    scores[id]++;
  }
  return scores;
}

/** True when REACHING this level grants a favored-stat card draft. */
export function isStatMilestone(level: number): boolean {
  return STAT_TUNING.MILESTONE_LEVELS.includes(level);
}
