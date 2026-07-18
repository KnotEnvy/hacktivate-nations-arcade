// ===== src/games/dungeon-crawl/data/lineages.ts =====
// Wave I — the bloodlines (PHB demihumans as an INSPIRATION layer; all text
// original, generic archetypes only). A lineage is chosen once, when a hero
// is forged: one small stat nudge folded into the forge roll plus one
// passive. HUMAN is the neutral default — its perk is forge-time only, so a
// veteran hero sanitized to 'human' plays exactly as before (the Wave E
// flat-base invariant, extended). Pure data; consumption points:
// ProgressionController.create (nudge + human variance), Player (elf sheath,
// dwarf stone-sense, halfling luck), DraftFlow/HudRenderer (the pick).

import { StatId, StatScores } from './stats';

export type LineageId = 'human' | 'dwarf' | 'elf' | 'halfling';

export interface LineageDef {
  id: LineageId;
  name: string;
  epithet: string; // the card's over-line
  icon: string;
  color: string;
  blurb: string; // one line of original flavor
  passiveName: string;
  passiveBlurb: string;
  /** Folded into the forge roll, clamped at the score cap. */
  statNudge: Partial<StatScores>;
}

/** HUMAN deliberately first: card [1] is the neutral pick. */
export const LINEAGES: Record<LineageId, LineageDef> = {
  human: {
    id: 'human',
    name: 'HUMAN',
    epithet: 'THE UNBOUND',
    icon: '☀',
    color: '#e8b46a',
    blurb: 'Short lives, long shadows — they arrive owing nothing.',
    passiveName: 'FAR HORIZONS',
    passiveBlurb: 'Forged with one extra point of promise',
    statNudge: {},
  },
  dwarf: {
    id: 'dwarf',
    name: 'DWARF',
    epithet: 'STONEBLOOD',
    icon: '⛏',
    color: '#c9885a',
    blurb: 'The deep places raised them; the deep places remember.',
    passiveName: 'STONE-SENSE',
    passiveBlurb: 'The first trap each floor bites nothing',
    statNudge: { con: 1 },
  },
  elf: {
    id: 'elf',
    name: 'ELF',
    epithet: 'STARLIT',
    icon: '☄',
    color: '#8fd8a8',
    blurb: 'They walk out of older woods than any map admits.',
    passiveName: 'KEEN QUIVER',
    passiveBlurb: 'One more blade rides the sheath',
    statNudge: { dex: 1 },
  },
  halfling: {
    id: 'halfling',
    name: 'HALFLING',
    epithet: 'HEARTHLUCK',
    icon: '☘',
    color: '#d8c96a',
    blurb: 'Small doors, warm kitchens, and an uncanny knack for later.',
    passiveName: "LUCK'S LAST WORD",
    passiveBlurb: 'Once an expedition, a killing blow misses',
    statNudge: { cha: 1 },
  },
};

export const ALL_LINEAGE_IDS = Object.keys(LINEAGES) as LineageId[];

export const LINEAGE_TUNING = {
  /** FAR HORIZONS: extra forge variance points for a human hero. */
  HUMAN_EXTRA_FORGE_POINTS: 1,
  /** KEEN QUIVER: added to Player.daggerCap(). */
  ELF_DAGGER_CAP: 1,
  /** LUCK'S LAST WORD: invuln on the escape (mirrors survivor/phoenix; the
   *  returned HP is PLAYER.REVIVE_FRAC of the pool since Wave L). */
  HALFLING_ESCAPE_INVULN: 2.0,
} as const;

/** Sanitize helper: any unknown value lands on the neutral lineage. */
export function asLineageId(value: unknown): LineageId {
  return typeof value === 'string' && (ALL_LINEAGE_IDS as string[]).includes(value)
    ? (value as LineageId)
    : 'human';
}

/** The forge nudge, clamped to the score cap (never above 18). */
export function applyLineageNudge(scores: StatScores, lineageId: LineageId, cap: number): StatScores {
  const out = { ...scores };
  const nudge = LINEAGES[lineageId].statNudge;
  for (const key of Object.keys(nudge) as StatId[]) {
    out[key] = Math.min(cap, out[key] + (nudge[key] ?? 0));
  }
  return out;
}
