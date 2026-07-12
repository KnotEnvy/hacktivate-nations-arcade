// ===== src/games/dungeon-crawl/data/spells.ts =====
// v4 Wave D — the grimoire. Spells are PERSISTENT hero knowledge learned at
// level-up (mage/cleric drafts offer them beside boons) and cast in the run
// with V (G cycles the active spell). Effects resolve in Combat.castSpell,
// reusing the scroll-effect library; nothing here executes logic. PHB-inspired
// generic archetypes; all text original.

import { ClassId } from './classes';

export type SpellId =
  | 'burning-hands'
  | 'frost-ray'
  | 'blink'
  | 'cure-wounds'
  | 'bless'
  | 'sanctuary';

export interface SpellDef {
  id: SpellId;
  name: string;
  blurb: string; // one line on the level-up card / sheet
  icon: string; // glyph on the HUD spell pip
  color: string;
  classId: ClassId; // who may learn it (mage/cleric today)
  cooldown: number; // seconds between casts
}

export const SPELLS: Record<SpellId, SpellDef> = {
  'burning-hands': {
    id: 'burning-hands',
    name: 'BURNING HANDS',
    blurb: 'A fan of flame bursts just ahead of you',
    icon: '☲',
    color: '#ff7a1a',
    classId: 'mage',
    cooldown: 9,
  },
  'frost-ray': {
    id: 'frost-ray',
    name: 'FROST RAY',
    blurb: 'Nearby monsters freeze mid-step',
    icon: '❆',
    color: '#9ad8ff',
    classId: 'mage',
    cooldown: 12,
  },
  blink: {
    id: 'blink',
    name: 'BLINK',
    blurb: 'Step between heartbeats — a short, safe jump',
    icon: '⇌',
    color: '#c99aff',
    classId: 'mage',
    cooldown: 10,
  },
  'cure-wounds': {
    id: 'cure-wounds',
    name: 'CURE WOUNDS',
    blurb: 'Prayer knits flesh — mends heavy wounds',
    icon: '✾',
    color: '#ff4d5e',
    classId: 'cleric',
    cooldown: 14,
  },
  bless: {
    id: 'bless',
    name: 'BLESS',
    blurb: 'A swift blessing: quicker steps, a closed cut',
    icon: '✺',
    color: '#ffe08a',
    classId: 'cleric',
    cooldown: 16,
  },
  sanctuary: {
    id: 'sanctuary',
    name: 'SANCTUARY',
    blurb: 'Stone-calm ward — the next blows glance away',
    icon: '⊕',
    color: '#9aa5b5',
    classId: 'cleric',
    cooldown: 16,
  },
};

export const ALL_SPELL_IDS = Object.keys(SPELLS) as SpellId[];

/** The spells a class may ever learn (empty for martial classes). */
export function spellsForClass(classId: ClassId): SpellId[] {
  return ALL_SPELL_IDS.filter(id => SPELLS[id].classId === classId);
}

export const SPELL_TUNING = {
  BURNING_HANDS_LOB_DIST: 44, // px ahead — practically at your fingertips
  BURNING_HANDS_FLIGHT: 0.2,
  BURNING_HANDS_FUSE: 0.15,
  BURNING_HANDS_RADIUS: 60,
  BURNING_HANDS_DAMAGE: 2,
  FROST_RAY_RADIUS: 220, // tighter than the frost scroll's nova
  FROST_RAY_STUN: 2.0,
  BLINK_DIST: 120, // px toward facing (lands on the nearest open tile)
  BLINK_INVULN: 0.4,
  CURE_HP: 3, // scholar boon multiplies
  BLESS_HP: 1,
  SANCTUARY_INVULN: 1.2, // scholar boon multiplies; rides the stoneskin buff
} as const;
