// ===== src/games/dungeon-crawl/data/boons.ts =====
// v4 — level-up boons: proficiency-flavored, PERSISTENT training the hero keeps
// across expeditions (relics stay run-scoped magic; boons are learned skill).
// Pure data; Player.ts and DungeonCrawlGame consume the stacks. Text original.
//
// Wave Q1 — THE GREAT BOONS: ten more, banded to levels 11-20 and some of them
// keyed to a single class. Inspiration is DM Option: High-Level Campaigns,
// Ch. 7 ("Skills for High-Level Characters"), whose whole thesis is that past
// 10th level a hero stops merely accumulating hit points and starts doing
// things lesser adventurers cannot. Text original, archetypes generic.

import { ClassId } from './classes';

export type BoonId =
  | 'weapon-specialization'
  | 'toughness'
  | 'fleet-foot'
  | 'blind-fighting'
  | 'herbalism'
  | 'haggler'
  | 'marksman'
  | 'iron-will'
  | 'scholar'
  | 'survivor'
  // Wave Q1 — THE GREAT BOONS (the ascent band; see GREAT_BOON_IDS below)
  | 'hardiness'
  | 'dread'
  | 'inner-focus'
  | 'signature-item'
  | 'breech'
  | 'death-blow'
  | 'evasion'
  | 'shadow-step'
  | 'smite'
  | 'spell-sculpting';

export interface BoonDef {
  id: BoonId;
  name: string;
  blurb: string; // one line on the level-up card
  icon: string;
  color: string;
  maxStacks: number;
  /**
   * Wave Q1 — the level being REACHED must meet this before the card may be
   * drafted (absent = 1, i.e. from the first level-up). The gate lives ONLY in
   * ProgressionController.draftChoices — the Wave J spell-band rule: sanitize
   * deliberately does NOT band-check, because a learned boon is learned and
   * banding is a draft rule, not a save rule.
   */
  minLevel?: number;
  /** Wave Q1 — only this class may draft it (absent = any class). */
  classId?: ClassId;
}

export const BOONS: Record<BoonId, BoonDef> = {
  'weapon-specialization': {
    id: 'weapon-specialization',
    name: 'WEAPON SPECIALIZATION',
    blurb: '+1 melee damage — trained, not enchanted',
    icon: '⚒',
    color: '#e08a3d',
    maxStacks: 2,
  },
  toughness: {
    id: 'toughness',
    name: 'TOUGHNESS',
    blurb: '+5 HP, earned the hard way',
    icon: '♦',
    color: '#c25b4a',
    maxStacks: 3,
  },
  'fleet-foot': {
    id: 'fleet-foot',
    name: 'FLEET FOOT',
    blurb: '+4% move speed',
    icon: '↟',
    color: '#7ae0ff',
    maxStacks: 3,
  },
  'blind-fighting': {
    id: 'blind-fighting',
    name: 'BLIND-FIGHTING',
    blurb: 'Longer grace after every wound',
    icon: '◐',
    color: '#9a7bff',
    maxStacks: 2,
  },
  herbalism: {
    id: 'herbalism',
    name: 'HERBALISM',
    blurb: 'Found hearts mend deeper',
    icon: '❦',
    color: '#7fae3f',
    maxStacks: 1,
  },
  haggler: {
    id: 'haggler',
    name: 'HAGGLER',
    blurb: 'Merchants cut a tenth from every price',
    icon: '⚖',
    color: '#ffd24a',
    maxStacks: 2,
  },
  marksman: {
    id: 'marksman',
    name: 'MARKSMAN',
    blurb: '+1 thrown-dagger damage',
    icon: '➶',
    color: '#cfd6e0',
    maxStacks: 2,
  },
  'iron-will': {
    id: 'iron-will',
    name: 'IRON WILL',
    blurb: 'Your signature ability returns sooner',
    icon: '▲',
    color: '#c9a2ff',
    maxStacks: 2,
  },
  scholar: {
    id: 'scholar',
    name: 'SCHOLAR',
    blurb: 'Healing and shielding scrolls run deeper',
    icon: '✎',
    color: '#e8dcbc',
    maxStacks: 1,
  },
  survivor: {
    id: 'survivor',
    name: 'SURVIVOR',
    blurb: 'Cheat death once each expedition',
    icon: '✶',
    color: '#ff9a3d',
    maxStacks: 1,
  },

  // ===== Wave Q1 — THE GREAT BOONS (levels 11-20) =====
  // Four any-class, six keyed to the class that earns them.
  hardiness: {
    id: 'hardiness',
    name: 'HARDINESS',
    blurb: 'Every blow lands a little lighter',
    icon: '⛊',
    color: '#b9c4d0',
    maxStacks: 2,
    minLevel: 11,
  },
  dread: {
    id: 'dread',
    name: 'DREAD',
    blurb: 'The pack loses its nerve sooner when one of them falls',
    icon: '☠',
    color: '#8d7fa8',
    maxStacks: 2,
    minLevel: 11,
  },
  'inner-focus': {
    id: 'inner-focus',
    name: 'INNER FOCUS',
    blurb: 'Every page of yours returns sooner',
    icon: '◉',
    color: '#7fd0e0',
    maxStacks: 2,
    minLevel: 13,
  },
  'signature-item': {
    id: 'signature-item',
    name: 'SIGNATURE ITEM',
    blurb: 'What you carry answers to you — worn gear runs deeper',
    icon: '✧',
    color: '#ffcf6a',
    maxStacks: 1,
    minLevel: 15,
  },
  breech: {
    id: 'breech',
    name: 'BREECH',
    blurb: 'Your blows bite what plain steel cannot touch',
    icon: '⚔',
    color: '#ffb0b0',
    maxStacks: 1,
    minLevel: 11,
    classId: 'fighter',
  },
  'death-blow': {
    id: 'death-blow',
    name: 'DEATH BLOW',
    blurb: 'One stroke, sometimes, is the whole fight',
    icon: '✹',
    color: '#e04b4b',
    maxStacks: 1,
    minLevel: 15,
    classId: 'fighter',
  },
  evasion: {
    id: 'evasion',
    name: 'EVASION',
    blurb: 'Blasts and trap-teeth sometimes find nothing at all',
    icon: '≈',
    color: '#8fd8ff',
    maxStacks: 1,
    minLevel: 11,
    classId: 'thief',
  },
  'shadow-step': {
    id: 'shadow-step',
    name: 'SHADOW STEP',
    blurb: 'You come out of a dash already behind them',
    icon: '⟡',
    color: '#9a7bff',
    maxStacks: 1,
    minLevel: 15,
    classId: 'thief',
  },
  smite: {
    id: 'smite',
    name: 'SMITE',
    blurb: 'Your turning wave scours the living too',
    icon: '✤',
    color: '#ffe08a',
    maxStacks: 1,
    minLevel: 13,
    classId: 'cleric',
  },
  'spell-sculpting': {
    id: 'spell-sculpting',
    name: 'SPELL SCULPTING',
    blurb: 'You shape the working wider than it was written',
    icon: '❉',
    color: '#d29aff',
    maxStacks: 2,
    minLevel: 13,
    classId: 'mage',
  },
};

export const ALL_BOON_IDS = Object.keys(BOONS) as BoonId[];

/** Wave Q1 — the ascent band's boons (anything gated above level 1). */
export const GREAT_BOON_IDS = ALL_BOON_IDS.filter(id => (BOONS[id].minLevel ?? 1) > 1);

export const BOON_TUNING = {
  WEAPON_SPEC_DAMAGE: 1,
  TOUGHNESS_HP: 5, // Wave L — re-priced for hit-die pools
  FLEET_FOOT_SPEED: 0.04, // additive per stack
  BLIND_FIGHT_INVULN_MULT: 0.2, // extra hit i-frames per stack
  HERBALISM_HEAL: 2, // Wave L — re-priced for hit-die pools
  HAGGLER_DISCOUNT: 0.1, // per stack
  MARKSMAN_DAMAGE: 1,
  IRON_WILL_CD_MULT: 0.92, // per stack
  SCHOLAR_MULT: 1.25,
  // (Wave L — the revive returns at PLAYER.REVIVE_FRAC of the pool.)
  SURVIVOR_INVULN: 2.0,

  // ===== Wave Q1 — THE GREAT BOONS =====
  HARDINESS_SOAK: 1, // damage absorbed per stack (a blow never falls below 1)
  DREAD_MORALE_BONUS: 0.08, // added to the pack's break chance, per stack
  INNER_FOCUS_SPELL_CD_MULT: 0.88, // per stack, on every learned page
  SIGNATURE_ITEM_MULT: 1.5, // worn-equipment effects amplified
  BREECH_DAMAGE: 2, // extra bite against warded foes
  DEATH_BLOW_CHANCE: 0.12, // per sword blow vs a plain (non-elite) foe
  EVASION_CHANCE: 0.35, // to shrug a blast/trap whole
  SHADOW_STEP_WINDOW: 0.6, // seconds of "from the shadows" after a dash
  SMITE_DAMAGE: 2, // the turning wave's bite on the living
  SPELL_SCULPT_MULT: 1.25, // per stack, on a working's reach and count
} as const;
