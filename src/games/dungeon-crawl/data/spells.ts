// ===== src/games/dungeon-crawl/data/spells.ts =====
// v4 Wave D — the grimoire. Spells are PERSISTENT hero knowledge learned at
// level-up (mage/cleric drafts offer them beside boons) and cast in the run
// with V (G cycles the active spell). Effects resolve in Combat.castSpell,
// reusing the scroll-effect library; nothing here executes logic. PHB-inspired
// generic archetypes; all text original.
//
// v6 Wave J — THE FULLER GRIMOIRE & THE MARTIAL DISCIPLINES: every class now
// has a growth track. Casters deepen (6 pages each), and the fighter/thief
// learn TECHNIQUES — martial pages riding the exact same pipeline (learn,
// persist, V/G, cooldowns, HUD, sanitize) with only the card wording changed.
// minLevel bands gate the draft: deep heroes draft deeper magic.

import { ClassId } from './classes';
import type { Dice } from './dice';

export type SpellId =
  | 'burning-hands'
  | 'frost-ray'
  | 'blink'
  | 'cure-wounds'
  | 'bless'
  | 'sanctuary'
  // v6 Wave J — the deeper grimoire.
  | 'magic-missile'
  | 'web'
  | 'lightning'
  | 'spirit-hammer'
  | 'prayer'
  | 'flame-strike'
  // v6 Wave J — the martial disciplines.
  | 'war-cry'
  | 'second-wind'
  | 'sunder'
  | 'smoke-bomb'
  | 'fan-of-knives'
  | 'venom-edge';

export interface SpellDef {
  id: SpellId;
  name: string;
  blurb: string; // one line on the level-up card / sheet
  icon: string; // glyph on the HUD spell pip
  color: string;
  classId: ClassId; // who may learn it (all four classes since Wave J)
  cooldown: number; // seconds between casts
  // v6 Wave J — the page appears in a draft only when the level being
  // REACHED is at least this (1 = from the very first level-up).
  minLevel: number;
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
    minLevel: 1,
  },
  'frost-ray': {
    id: 'frost-ray',
    name: 'FROST RAY',
    blurb: 'Nearby monsters freeze mid-step',
    icon: '❆',
    color: '#9ad8ff',
    classId: 'mage',
    cooldown: 12,
    minLevel: 1,
  },
  blink: {
    id: 'blink',
    name: 'BLINK',
    blurb: 'Step between heartbeats — a short, safe jump',
    icon: '⇌',
    color: '#c99aff',
    classId: 'mage',
    cooldown: 10,
    minLevel: 1,
  },
  'cure-wounds': {
    id: 'cure-wounds',
    name: 'CURE WOUNDS',
    blurb: 'Prayer knits flesh — mends heavy wounds',
    icon: '✾',
    color: '#ff4d5e',
    classId: 'cleric',
    cooldown: 14,
    minLevel: 1,
  },
  bless: {
    id: 'bless',
    name: 'BLESS',
    blurb: 'A swift blessing: quicker steps, a closed cut',
    icon: '✺',
    color: '#ffe08a',
    classId: 'cleric',
    cooldown: 16,
    minLevel: 1,
  },
  sanctuary: {
    id: 'sanctuary',
    name: 'SANCTUARY',
    blurb: 'Stone-calm ward — the next blows glance away',
    icon: '⊕',
    color: '#9aa5b5',
    classId: 'cleric',
    cooldown: 16,
    minLevel: 1,
  },

  // ---- v6 Wave J: the deeper grimoire (mage) ----
  'magic-missile': {
    id: 'magic-missile',
    name: 'MAGIC MISSILE',
    blurb: 'Three unerring darts seek the nearest foes',
    icon: '➳',
    color: '#d29aff',
    classId: 'mage',
    cooldown: 8,
    minLevel: 4,
  },
  web: {
    id: 'web',
    name: 'WEB',
    blurb: 'Sticky strands root the pack ahead of you',
    icon: '❋',
    color: '#e8e3d0',
    classId: 'mage',
    cooldown: 13,
    minLevel: 6,
  },
  lightning: {
    id: 'lightning',
    name: 'LIGHTNING',
    blurb: 'A crooked bolt lashes the nearest foe',
    icon: 'ϟ',
    color: '#ffe95e',
    classId: 'mage',
    cooldown: 14,
    minLevel: 8,
  },

  // ---- v6 Wave J: the deeper prayer book (cleric) ----
  'spirit-hammer': {
    id: 'spirit-hammer',
    name: 'SPIRIT HAMMER',
    blurb: 'A hammer of faith hunts the wicked',
    icon: '✠',
    color: '#ffd27a',
    classId: 'cleric',
    cooldown: 9,
    minLevel: 4,
  },
  prayer: {
    id: 'prayer',
    name: 'PRAYER',
    blurb: 'The war-litany: hard skin, heavy hands',
    icon: '✙',
    color: '#f5efdc',
    classId: 'cleric',
    cooldown: 18,
    minLevel: 6,
  },
  'flame-strike': {
    id: 'flame-strike',
    name: 'FLAME STRIKE',
    blurb: 'A column of holy fire finds the nearest foe',
    icon: '❖',
    color: '#ff9c3a',
    classId: 'cleric',
    cooldown: 15,
    minLevel: 8,
  },

  // ---- v6 Wave J: fighter techniques ----
  'war-cry': {
    id: 'war-cry',
    name: 'WAR CRY',
    blurb: 'A roar that staggers the whole room',
    icon: '❢',
    color: '#ff6a4d',
    classId: 'fighter',
    cooldown: 11,
    minLevel: 4,
  },
  'second-wind': {
    id: 'second-wind',
    name: 'SECOND WIND',
    blurb: 'Grit your teeth — wounds close on the march',
    icon: '✚',
    color: '#8fe08a',
    classId: 'fighter',
    cooldown: 22,
    minLevel: 6,
  },
  sunder: {
    id: 'sunder',
    name: 'SUNDER',
    blurb: 'Your blade flies through everything in its path',
    icon: '➹',
    color: '#d8dee8',
    classId: 'fighter',
    cooldown: 12,
    minLevel: 8,
  },

  // ---- v6 Wave J: thief techniques ----
  'smoke-bomb': {
    id: 'smoke-bomb',
    name: 'SMOKE BOMB',
    blurb: 'Vanish in a grey bloom — the room loses you',
    icon: '✱',
    color: '#8d97a8',
    classId: 'thief',
    cooldown: 14,
    minLevel: 4,
  },
  'fan-of-knives': {
    id: 'fan-of-knives',
    name: 'FAN OF KNIVES',
    blurb: 'Eight blades leave your hands at once',
    icon: '✖',
    color: '#c9d2e0',
    classId: 'thief',
    cooldown: 11,
    minLevel: 6,
  },
  'venom-edge': {
    id: 'venom-edge',
    name: 'VENOM EDGE',
    blurb: 'Black oil on the blade — your cuts bite deep',
    icon: '❦',
    color: '#7ddb6a',
    classId: 'thief',
    cooldown: 20,
    minLevel: 8,
  },
};

export const ALL_SPELL_IDS = Object.keys(SPELLS) as SpellId[];

/** The spells a class may ever learn (techniques for the martial classes). */
export function spellsForClass(classId: ClassId): SpellId[] {
  return ALL_SPELL_IDS.filter(id => SPELLS[id].classId === classId);
}

/** v6 Wave J — the card/sheet noun: casters keep SPELLS, martials learn TECHNIQUES. */
export function spellNoun(classId: ClassId): 'SPELL' | 'TECHNIQUE' {
  return classId === 'fighter' || classId === 'thief' ? 'TECHNIQUE' : 'SPELL';
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
  CURE_HP: { n: 1, d: 8 } as Dice, // Wave L — 2e's cure, rolled + WIS; scholar multiplies
  BLESS_HP: 2,
  SANCTUARY_INVULN: 1.2, // scholar boon multiplies; rides the stoneskin buff

  // v6 Wave J — the deeper grimoire.
  MAGIC_MISSILE_COUNT: 3,
  MAGIC_MISSILE_DAMAGE: 1, // + INT fold per dart
  MAGIC_MISSILE_SPEED: 260,
  MAGIC_MISSILE_HOMING: 3.2, // rad/s — unerring
  MAGIC_MISSILE_SPREAD: 0.55, // rad fan about facing
  WEB_DIST: 90, // px ahead — the strands land where you look
  WEB_RADIUS: 120,
  WEB_STUN: 3.0,
  LIGHTNING_RANGE: 260,
  LIGHTNING_DAMAGE: 4, // + INT fold
  SPIRIT_HAMMER_DAMAGE: 2,
  SPIRIT_HAMMER_SPEED: 240,
  SPIRIT_HAMMER_HOMING: 2.6,
  FLAME_STRIKE_FUSE: 0.2, // falls, does not fly — short fuse where it lands
  FLAME_STRIKE_RADIUS: 56,
  FLAME_STRIKE_DAMAGE: 3, // + INT fold
  FLAME_STRIKE_FALLBACK_DIST: 72, // px ahead when no foe is in sight

  // v6 Wave J — the martial disciplines.
  WAR_CRY_RADIUS: 150,
  WAR_CRY_STUN: 0.8,
  WAR_CRY_PUSH: 220,
  SECOND_WIND_HP: { n: 1, d: 10 } as Dice, // Wave L — the fighter rolls their own die; no WIS fold
  SUNDER_BONUS_DAMAGE: 1, // + swordDamage (STR folds there for free)
  SUNDER_SPEED: 320,
  SMOKE_RADIUS: 110,
  SMOKE_STUN: 0.6,
  FAN_KNIVES_COUNT: 8,
} as const;
