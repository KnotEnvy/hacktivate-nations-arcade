// ===== src/games/dungeon-crawl/data/relics.ts =====
// Relics are run-defining stacking buffs. The player picks 1-of-3 at every
// descent; treasure-room shrines grant one directly. Player.ts reads the
// stack counts; nothing here executes logic.

export type RelicId =
  | 'ember-blade'
  | 'swift-boots'
  | 'tower-shield'
  | 'vampire-fang'
  | 'keen-eye'
  | 'coin-magnet'
  | 'berserker-rage'
  | 'dagger-sage'
  | 'shadow-cloak'
  | 'thorn-mail'
  | 'lucky-charm'
  | 'phoenix-feather';

export interface RelicDef {
  id: RelicId;
  name: string;
  blurb: string; // one line on the choice card
  icon: string; // single glyph drawn on the card / HUD
  color: string;
}

export const RELICS: Record<RelicId, RelicDef> = {
  'ember-blade': {
    id: 'ember-blade',
    name: 'EMBER BLADE',
    blurb: '+1 sword damage',
    icon: '⚔',
    color: '#ff7a1a',
  },
  'swift-boots': {
    id: 'swift-boots',
    name: 'SWIFT BOOTS',
    blurb: '+18% move speed',
    icon: '≫',
    color: '#7ae0ff',
  },
  'tower-shield': {
    id: 'tower-shield',
    name: 'TOWER SHIELD',
    blurb: '+1 heart (heals it too)',
    icon: '⛨',
    color: '#8a93a6',
  },
  'vampire-fang': {
    id: 'vampire-fang',
    name: 'VAMPIRE FANG',
    blurb: 'Heal ½ heart per 10 kills',
    icon: '♰',
    color: '#c22f2f',
  },
  'keen-eye': {
    id: 'keen-eye',
    name: 'KEEN EYE',
    blurb: 'Wider torchlight',
    icon: '◉',
    color: '#ffc94d',
  },
  'coin-magnet': {
    id: 'coin-magnet',
    name: 'COIN MAGNET',
    blurb: 'Gold flies to you',
    icon: '◎',
    color: '#ffd24a',
  },
  'berserker-rage': {
    id: 'berserker-rage',
    name: 'BERSERKER RAGE',
    blurb: '+1 damage below 2 hearts',
    icon: '♆',
    color: '#ff4d5e',
  },
  'dagger-sage': {
    id: 'dagger-sage',
    name: 'DAGGER SAGE',
    blurb: '+4 dagger cap, daggers pierce',
    icon: '✕',
    color: '#cfd6e0',
  },
  'shadow-cloak': {
    id: 'shadow-cloak',
    name: 'SHADOW CLOAK',
    blurb: 'Faster dash, longer dash i-frames',
    icon: '§',
    color: '#9a7bff',
  },
  'thorn-mail': {
    id: 'thorn-mail',
    name: 'THORN MAIL',
    blurb: 'Wound nearby foes when hit',
    icon: '❈',
    color: '#7fae3f',
  },
  'lucky-charm': {
    id: 'lucky-charm',
    name: 'LUCKY CHARM',
    blurb: 'Richer drops from every kill',
    icon: '☘',
    color: '#4fdba0',
  },
  'phoenix-feather': {
    id: 'phoenix-feather',
    name: 'PHOENIX FEATHER',
    blurb: 'Survive death once (consumed)',
    icon: '⌁',
    color: '#ff9a3d',
  },
};

export const ALL_RELIC_IDS = Object.keys(RELICS) as RelicId[];

export const RELIC_TUNING = {
  EMBER_BLADE_DAMAGE: 1,
  SWIFT_BOOTS_SPEED_MULT: 0.18, // additive per stack
  TOWER_SHIELD_HP: 2,
  VAMPIRE_KILLS_PER_HEAL: 10,
  DAGGER_SAGE_CAP_BONUS: 4,
  BERSERKER_THRESHOLD_HP: 4, // active at or below this HP (2 hearts)
  BERSERKER_DAMAGE: 1,
  SHADOW_CLOAK_COOLDOWN_MULT: 0.75, // dash cooldown multiplier per stack
  SHADOW_CLOAK_IFRAME_BONUS: 0.1, // extra dash i-frame seconds per stack
  THORN_MAIL_RADIUS: 72,
  THORN_MAIL_DAMAGE: 1, // per stack
  LUCKY_GOLD_BONUS: 1, // extra guaranteed gold per stack
  LUCKY_HEART_CHANCE: 0.05, // heart drop chance per stack
  PHOENIX_REVIVE_HP: 2, // one heart
  PHOENIX_INVULN: 2.0,
} as const;
