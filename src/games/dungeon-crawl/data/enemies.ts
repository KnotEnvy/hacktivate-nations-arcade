// ===== src/games/dungeon-crawl/data/enemies.ts =====
// Data-driven enemy archetypes. Enemy.ts interprets `behavior`; everything
// numeric lives here so balance is a data edit, not a code edit.

export type EnemyTypeId =
  | 'slime'
  | 'slime-mini'
  | 'skeleton'
  | 'bat'
  | 'sorcerer'
  | 'knight'
  | 'mimic'
  | 'bomber'
  | 'wraith'
  // v3 — biome families (Bestiary of the Depths)
  | 'fire-beetle'
  | 'zombie'
  | 'ghoul'
  | 'deep-ooze'
  | 'ooze-mini'
  | 'lizardman'
  | 'shade'
  | 'cinder-hound';

export type EnemyBehavior =
  | 'wander'
  | 'chase'
  | 'flit'
  | 'ranged'
  | 'armored'
  | 'mimic'
  | 'bomber'
  | 'wraith';

// v2 — elite modifiers applied on top of a base archetype.
export type EliteTrait = 'frenzied' | 'bulwark' | 'volatile' | 'gilded';

export interface EliteConfig {
  trait: EliteTrait;
  name: string; // shown implicitly via aura color; kept for future floating text
  aura: string;
  speedMult: number;
  hpMult: number;
  knockbackMult: number;
  goldMult: number;
  scoreMult: number;
}

export const ELITE_CONFIGS: Record<EliteTrait, EliteConfig> = {
  frenzied: {
    trait: 'frenzied',
    name: 'FRENZIED',
    aura: '#ff5050',
    speedMult: 1.45,
    hpMult: 1,
    knockbackMult: 1,
    goldMult: 1,
    scoreMult: 3,
  },
  bulwark: {
    trait: 'bulwark',
    name: 'BULWARK',
    aura: '#7fa8ff',
    speedMult: 0.9,
    hpMult: 2.5,
    knockbackMult: 0.15,
    goldMult: 1,
    scoreMult: 3,
  },
  volatile: {
    trait: 'volatile',
    name: 'VOLATILE',
    aura: '#ffd24a',
    speedMult: 1.1,
    hpMult: 1,
    knockbackMult: 1,
    goldMult: 1,
    scoreMult: 3,
  },
  gilded: {
    trait: 'gilded',
    name: 'GILDED',
    aura: '#ffe08a',
    speedMult: 1,
    hpMult: 1.5,
    knockbackMult: 1,
    goldMult: 4,
    scoreMult: 3,
  },
};

export const ELITES = {
  FLOOR_MIN: 3,
  BASE_CHANCE: 0.08,
  CHANCE_PER_FLOOR: 0.02, // added per floor beyond FLOOR_MIN
  CHANCE_CAP: 0.25,
} as const;

export interface EnemyConfig {
  id: EnemyTypeId;
  behavior: EnemyBehavior;
  hp: number;
  speed: number; // px/s
  size: number; // square hitbox, px
  touchDamage: number;
  score: number; // base kill score before combo/depth multipliers
  goldDrop: [min: number, max: number]; // gold pickups scattered on death
  aggroRange: number; // px — starts chasing/attacking inside this
  color: string; // body color for the retro sprite
  accent: string; // eyes / trim
  undead?: boolean; // v3 — seared + stunned by the cleric's Turn Undead
  splitsInto?: EnemyTypeId; // v3 — divides into two of these on death
}

export const ENEMY_CONFIGS: Record<EnemyTypeId, EnemyConfig> = {
  slime: {
    id: 'slime',
    behavior: 'wander',
    hp: 2,
    speed: 42,
    size: 22,
    touchDamage: 1,
    score: 20,
    goldDrop: [0, 2],
    aggroRange: 160,
    color: '#5dbb46',
    accent: '#1e3a14',
    splitsInto: 'slime-mini',
  },
  'slime-mini': {
    id: 'slime-mini',
    behavior: 'chase',
    hp: 1,
    speed: 78,
    size: 14,
    touchDamage: 1,
    score: 8,
    goldDrop: [0, 1],
    aggroRange: 220,
    color: '#7fd764',
    accent: '#1e3a14',
  },
  skeleton: {
    id: 'skeleton',
    behavior: 'chase',
    hp: 3,
    speed: 68,
    size: 22,
    touchDamage: 1,
    score: 30,
    goldDrop: [1, 2],
    aggroRange: 230,
    color: '#d8d2c2',
    accent: '#2b2118',
    undead: true,
  },
  bat: {
    id: 'bat',
    behavior: 'flit',
    hp: 1,
    speed: 128,
    size: 16,
    touchDamage: 1,
    score: 25,
    goldDrop: [0, 1],
    aggroRange: 260,
    color: '#7b5ea7',
    accent: '#e8d24a',
  },
  sorcerer: {
    id: 'sorcerer',
    behavior: 'ranged',
    hp: 2,
    speed: 55,
    size: 22,
    touchDamage: 1,
    score: 45,
    goldDrop: [1, 3],
    aggroRange: 300,
    color: '#3f6fd8',
    accent: '#c9e2ff',
  },
  knight: {
    id: 'knight',
    behavior: 'armored',
    hp: 5,
    speed: 52,
    size: 24,
    touchDamage: 2,
    score: 60,
    goldDrop: [2, 4],
    aggroRange: 240,
    color: '#8a93a6',
    accent: '#c22f2f',
  },
  mimic: {
    id: 'mimic',
    behavior: 'mimic',
    hp: 4,
    speed: 96,
    size: 24,
    touchDamage: 2,
    score: 80,
    goldDrop: [4, 7],
    aggroRange: 52, // wake radius while dormant
    color: '#8a5a28',
    accent: '#ffd24a',
  },
  bomber: {
    id: 'bomber',
    behavior: 'bomber',
    hp: 2,
    speed: 62,
    size: 20,
    touchDamage: 1,
    score: 50,
    goldDrop: [1, 3],
    aggroRange: 280,
    color: '#6f8f3a',
    accent: '#2b3a12',
  },
  wraith: {
    id: 'wraith',
    behavior: 'wraith',
    hp: 3,
    speed: 46,
    size: 22,
    touchDamage: 1,
    score: 70,
    goldDrop: [1, 2],
    aggroRange: 260, // senses through walls — no LOS needed
    color: '#b9c8e8',
    accent: '#3a4a6e',
    undead: true,
  },
  // ===== v3 biome families =====
  'fire-beetle': {
    id: 'fire-beetle',
    behavior: 'chase',
    hp: 2,
    speed: 58,
    size: 20,
    touchDamage: 1,
    score: 25,
    goldDrop: [1, 2],
    aggroRange: 200,
    color: '#c9542a',
    accent: '#ffd24a', // glow glands — the game gives these real light
  },
  zombie: {
    id: 'zombie',
    behavior: 'chase',
    hp: 5,
    speed: 34,
    size: 22,
    touchDamage: 1,
    score: 35,
    goldDrop: [1, 3],
    aggroRange: 210,
    color: '#7a8a5a',
    accent: '#4a3b2a',
    undead: true,
  },
  ghoul: {
    id: 'ghoul',
    behavior: 'chase',
    hp: 3,
    speed: 88,
    size: 20,
    touchDamage: 2,
    score: 55,
    goldDrop: [1, 3],
    aggroRange: 260,
    color: '#a8b890',
    accent: '#e8f6d8',
    undead: true,
  },
  'deep-ooze': {
    id: 'deep-ooze',
    behavior: 'wander',
    hp: 3,
    speed: 40,
    size: 24,
    touchDamage: 1,
    score: 30,
    goldDrop: [1, 2],
    aggroRange: 170,
    color: '#3ea88a',
    accent: '#1a4a3c',
    splitsInto: 'ooze-mini',
  },
  'ooze-mini': {
    id: 'ooze-mini',
    behavior: 'chase',
    hp: 1,
    speed: 72,
    size: 14,
    touchDamage: 1,
    score: 8,
    goldDrop: [0, 1],
    aggroRange: 220,
    color: '#5ec9a8',
    accent: '#1a4a3c',
  },
  lizardman: {
    id: 'lizardman',
    behavior: 'chase',
    hp: 4,
    speed: 62,
    size: 22,
    touchDamage: 2,
    score: 50,
    goldDrop: [2, 4],
    aggroRange: 240,
    color: '#4a8a56',
    accent: '#ffd24a',
  },
  shade: {
    id: 'shade',
    behavior: 'wraith',
    hp: 2,
    speed: 62,
    size: 20,
    touchDamage: 1,
    score: 65,
    goldDrop: [1, 2],
    aggroRange: 260,
    color: '#5a5a72',
    accent: '#9a7bff',
    undead: true,
  },
  'cinder-hound': {
    id: 'cinder-hound',
    behavior: 'chase',
    hp: 2,
    speed: 105,
    size: 18,
    touchDamage: 1,
    score: 45,
    goldDrop: [1, 2],
    aggroRange: 280,
    color: '#8a3a2a',
    accent: '#ffd24a',
  },
};

// Ranged-enemy tuning shared by Enemy.ts.
export const SORCERER = {
  PREFERRED_MIN: 140, // backs away inside this
  PREFERRED_MAX: 250, // advances outside this
  FIRE_INTERVAL: 2.2,
  WINDUP: 0.5, // telegraph flash before the bolt
  BOLT_SPEED: 185,
} as const;

// Bomber tuning — same band-keeping as the sorcerer but lobs AoE bombs.
export const BOMBER = {
  PREFERRED_MIN: 110,
  PREFERRED_MAX: 230,
  THROW_INTERVAL: 3.0,
  WINDUP: 0.45,
  LEAD: 0.35, // fraction of player velocity-ish lead applied to the target spot
} as const;

// Spawn weights per floor. Weights are relative within the table; entries with
// weight 0 never spawn on that floor. Mimics are placed by the generator
// separately (treasure rooms) plus this ambient weight.
export interface SpawnWeightRow {
  type: EnemyTypeId;
  weight: number;
}

export function spawnWeightsForFloor(floor: number, biomeId: string): SpawnWeightRow[] {
  // Common core — the depths' shared population. Floor gates unchanged from v2.
  const rows: SpawnWeightRow[] = [
    { type: 'slime', weight: Math.max(1, 6 - floor) },
    { type: 'skeleton', weight: 4 + Math.min(4, floor) },
    { type: 'bat', weight: floor >= 2 ? 3 + Math.min(3, floor - 2) : 0 },
    { type: 'sorcerer', weight: floor >= 2 ? 2 + Math.min(4, floor - 1) : 0 },
    { type: 'bomber', weight: floor >= 2 ? 2 + Math.min(3, floor - 2) : 0 },
    { type: 'knight', weight: floor >= 3 ? 1 + Math.min(5, floor - 2) : 0 },
    { type: 'wraith', weight: floor >= 4 ? 1 + Math.min(3, floor - 4) : 0 },
    { type: 'mimic', weight: floor >= 4 ? 1 : 0 },
  ];

  // v3 — biome family: a heavy local presence, absent everywhere else.
  switch (biomeId) {
    case 'ember':
      rows.push({ type: 'fire-beetle', weight: 4 + Math.min(3, floor) });
      break;
    case 'bone':
      rows.push({ type: 'zombie', weight: 5 });
      rows.push({ type: 'ghoul', weight: floor >= 5 ? 4 : 0 });
      break;
    case 'sunken':
      rows.push({ type: 'deep-ooze', weight: 5 });
      rows.push({ type: 'lizardman', weight: floor >= 3 ? 3 + Math.min(3, floor - 3) : 0 });
      break;
    case 'ash':
      rows.push({ type: 'shade', weight: floor >= 4 ? 4 : 0 });
      rows.push({ type: 'cinder-hound', weight: floor >= 4 ? 4 : 0 });
      break;
  }
  return rows;
}

// How many enemies a room gets: area-proportional with a floor-scaled bonus.
export function enemyBudgetForRoom(roomArea: number, floor: number): number {
  const base = Math.round(roomArea / 22);
  const depthBonus = Math.floor((floor - 1) / 2);
  return Math.max(1, Math.min(7, base + depthBonus));
}

// ===== Boss (Ember Guardian) =====
export const BOSS = {
  SIZE: 46,
  BASE_HP: 22,
  HP_PER_TIER: 12, // tier = how many boss floors have been reached (1-based)
  SPEED: 62,
  CHARGE_SPEED: 330,
  TOUCH_DAMAGE: 2,
  CHARGE_DAMAGE: 2,
  SCORE: 600,
  GOLD_SHOWER: 14,
  ENRAGE_THRESHOLD: 0.35, // fraction of HP left
  // Phase timings (seconds)
  PURSUE_TIME: 2.2,
  TELEGRAPH_TIME: 0.7,
  SPREAD_BOLTS: 10,
  SPREAD_BOLT_SPEED: 170,
  SUMMON_COUNT: 3,
  MAX_MINIONS: 5,
} as const;
