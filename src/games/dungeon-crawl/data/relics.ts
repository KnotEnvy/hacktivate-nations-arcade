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
  | 'phoenix-feather'
  // v3 — Vaults of the Magica
  | 'ring-of-renewal'
  | 'war-bracers'
  | 'grave-ward'
  | 'ogre-gauntlets'
  | 'blur-cloak'
  | 'bottomless-quiver';

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
    blurb: '+5 HP (heals them too)',
    icon: '⛨',
    color: '#8a93a6',
  },
  'vampire-fang': {
    id: 'vampire-fang',
    name: 'VAMPIRE FANG',
    blurb: 'Drink back HP every 10 kills',
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
    blurb: '+1 damage while bloodied',
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
  // v3 — Vaults of the Magica
  'ring-of-renewal': {
    id: 'ring-of-renewal',
    name: 'RING OF RENEWAL',
    blurb: 'Slowly knits your wounds closed',
    icon: '✾',
    color: '#7ae0a8',
  },
  'war-bracers': {
    id: 'war-bracers',
    name: 'WAR BRACERS',
    blurb: 'Your signature ability returns faster',
    icon: '⟳',
    color: '#c9a2ff',
  },
  'grave-ward': {
    id: 'grave-ward',
    name: 'GRAVE WARD',
    blurb: '+1 damage to the undead',
    icon: '✟',
    color: '#e8dcbc',
  },
  'ogre-gauntlets': {
    id: 'ogre-gauntlets',
    name: 'OGRE GAUNTLETS',
    blurb: 'Blows send monsters flying',
    icon: '⊞',
    color: '#d8843a',
  },
  'blur-cloak': {
    id: 'blur-cloak',
    name: 'BLUR CLOAK',
    blurb: 'Sometimes the blow finds only afterimage',
    icon: '≈',
    color: '#8fd8ff',
  },
  'bottomless-quiver': {
    id: 'bottomless-quiver',
    name: 'BOTTOMLESS QUIVER',
    blurb: 'Daggers slowly return to your belt',
    icon: '⇶',
    color: '#cfd6e0',
  },
};

export const ALL_RELIC_IDS = Object.keys(RELICS) as RelicId[];

export const RELIC_TUNING = {
  EMBER_BLADE_DAMAGE: 1,
  SWIFT_BOOTS_SPEED_MULT: 0.18, // additive per stack
  TOWER_SHIELD_HP: 5, // Wave L — re-priced for hit-die pools
  VAMPIRE_KILLS_PER_HEAL: 10,
  VAMPIRE_HEAL: 2, // Wave L — HP drunk back per threshold
  DAGGER_SAGE_CAP_BONUS: 4,
  BERSERKER_THRESHOLD_FRAC: 0.3, // Wave L — active while "bloodied" (≤ this × maxHp)
  BERSERKER_DAMAGE: 1,
  SHADOW_CLOAK_COOLDOWN_MULT: 0.75, // dash cooldown multiplier per stack
  SHADOW_CLOAK_IFRAME_BONUS: 0.1, // extra dash i-frame seconds per stack
  THORN_MAIL_RADIUS: 72,
  THORN_MAIL_DAMAGE: 1, // per stack
  LUCKY_GOLD_BONUS: 1, // extra guaranteed gold per stack
  LUCKY_HEART_CHANCE: 0.05, // heart drop chance per stack
  // (Wave L — revives return at PLAYER.REVIVE_FRAC of the pool, not a flat HP.)
  PHOENIX_INVULN: 2.0,
  // v3 — Vaults of the Magica
  RENEWAL_INTERVAL: 45, // seconds per tick; stacks divide it
  RENEWAL_HEAL: 2, // Wave L — HP knit closed per tick
  WAR_BRACERS_CD_MULT: 0.85, // ability cooldown multiplier per stack
  GRAVE_WARD_DAMAGE: 1, // bonus vs undead per stack
  OGRE_KNOCKBACK_MULT: 0.4, // additive knockback fraction per stack
  BLUR_DODGE_PER_STACK: 0.08,
  BLUR_DODGE_CAP: 0.4,
  BLUR_INVULN: 0.5, // grace after an evade so touch damage can't re-roll every frame
  QUIVER_REGEN_INTERVAL: 8, // seconds per +1 dagger; stacks divide it
} as const;
