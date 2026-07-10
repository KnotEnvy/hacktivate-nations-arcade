// ===== src/games/dungeon-crawl/data/gear.ts =====
// v4 Wave B — Lastlight's shops. The BLACKSMITH sells permanent gear (three
// tiers per track, bought with banked gold, saved on the hero). The ALCHEMIST
// sells one-expedition provisions applied at the gate. Pure data; Player.ts
// folds gear, the game applies provisions. All text original.

export type GearId = 'blade' | 'armor' | 'boots' | 'quiver';

export interface GearDef {
  id: GearId;
  name: string;
  blurb: string;
  icon: string;
  color: string;
  prices: readonly [number, number, number]; // banked gold per tier
}

export const GEAR: Record<GearId, GearDef> = {
  blade: {
    id: 'blade',
    name: 'FORGED BLADE',
    blurb: '+1 melee damage per tier — honest steel',
    icon: '⚔',
    color: '#cfd6e0',
    prices: [120, 280, 550],
  },
  armor: {
    id: 'armor',
    name: 'FITTED MAIL',
    blurb: '+1 heart per tier, hammered to your frame',
    icon: '⛨',
    color: '#8a93a6',
    prices: [100, 240, 480],
  },
  boots: {
    id: 'boots',
    name: 'STRIDER BOOTS',
    blurb: '+4% stride per tier',
    icon: '≫',
    color: '#7ae0ff',
    prices: [90, 220, 440],
  },
  quiver: {
    id: 'quiver',
    name: 'DEEP QUIVER',
    blurb: '+2 dagger cap and +2 to start, per tier',
    icon: '⇶',
    color: '#e8dcbc',
    prices: [80, 180, 360],
  },
};

export const ALL_GEAR_IDS = Object.keys(GEAR) as GearId[];

export const GEAR_TUNING = {
  MAX_TIER: 3,
  BLADE_DAMAGE: 1, // per tier
  ARMOR_HP: 2,
  BOOTS_SPEED: 0.04,
  QUIVER_CAP: 2,
  QUIVER_START: 2,
} as const;

// ---------------------------------------------------------------- provisions

export type ProvisionId = 'field-scroll' | 'bandolier' | 'blessed-candle';

export interface ProvisionDef {
  id: ProvisionId;
  name: string;
  blurb: string;
  icon: string;
  color: string;
  price: number; // banked gold; consumed at the gate
}

export const PROVISIONS: Record<ProvisionId, ProvisionDef> = {
  'field-scroll': {
    id: 'field-scroll',
    name: 'FIELD SCROLL',
    blurb: 'Set out with an unidentified scroll in the satchel',
    icon: '✉',
    color: '#e8dcbc',
    price: 30,
  },
  bandolier: {
    id: 'bandolier',
    name: 'DAGGER BANDOLIER',
    blurb: 'Set out with 6 extra daggers',
    icon: '✕',
    color: '#cfd6e0',
    price: 25,
  },
  'blessed-candle': {
    id: 'blessed-candle',
    name: 'BLESSED CANDLE',
    blurb: 'A wider light for the whole expedition',
    icon: '✦',
    color: '#ffe08a',
    price: 40,
  },
};

export const ALL_PROVISION_IDS = Object.keys(PROVISIONS) as ProvisionId[];

export const PROVISION_TUNING = {
  BANDOLIER_DAGGERS: 6,
  CANDLE_TORCH_BONUS: 1, // stacks with Keen Eye radius steps
} as const;
