// ===== src/games/dungeon-crawl/data/boons.ts =====
// v4 — level-up boons: proficiency-flavored, PERSISTENT training the hero keeps
// across expeditions (relics stay run-scoped magic; boons are learned skill).
// Pure data; Player.ts and DungeonCrawlGame consume the stacks. Text original.

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
  | 'survivor';

export interface BoonDef {
  id: BoonId;
  name: string;
  blurb: string; // one line on the level-up card
  icon: string;
  color: string;
  maxStacks: number;
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
    blurb: '+1 heart, earned the hard way',
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
    blurb: 'Hearts mend one wound more',
    icon: '❦',
    color: '#7fae3f',
    maxStacks: 1,
  },
  haggler: {
    id: 'haggler',
    name: 'HAGGLER',
    blurb: 'Merchants knock 10% off',
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
};

export const ALL_BOON_IDS = Object.keys(BOONS) as BoonId[];

export const BOON_TUNING = {
  WEAPON_SPEC_DAMAGE: 1,
  TOUGHNESS_HP: 2,
  FLEET_FOOT_SPEED: 0.04, // additive per stack
  BLIND_FIGHT_INVULN_MULT: 0.2, // extra hit i-frames per stack
  HERBALISM_HEAL: 1,
  HAGGLER_DISCOUNT: 0.1, // per stack
  MARKSMAN_DAMAGE: 1,
  IRON_WILL_CD_MULT: 0.92, // per stack
  SCHOLAR_MULT: 1.25,
  SURVIVOR_HP: 2, // one heart on the once-per-expedition revive
  SURVIVOR_INVULN: 2.0,
} as const;
