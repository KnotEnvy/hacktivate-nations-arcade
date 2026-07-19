// ===== src/games/dungeon-crawl/data/constants.ts =====
// Central tuning for The Ember Depths. Everything gameplay-feel lives here so
// balance passes never require touching entity/system code.

import type { Dice } from './dice';

export const TILE = 32; // world pixels per tile

export const VIEW = {
  WIDTH: 800,
  HEIGHT: 600,
} as const;

// Floor sizing — floors grow slightly with depth, boss floors are one arena.
export const FLOOR_GEN = {
  BASE_COLS: 42,
  BASE_ROWS: 32,
  GROWTH_COLS_PER_FLOOR: 2, // capped below
  MAX_COLS: 56,
  MAX_ROWS: 40,
  ROOM_MIN: 5, // tiles, interior
  ROOM_MAX: 10,
  ROOM_ATTEMPTS: 60,
  TARGET_ROOMS_MIN: 7,
  TARGET_ROOMS_MAX: 10,
  BOSS_ARENA_COLS: 25,
  BOSS_ARENA_ROWS: 19,
  BOSS_EVERY_N_FLOORS: 3,
  TORCH_SPACING: 5, // wall torches roughly every N tiles of room perimeter
} as const;

export const PLAYER = {
  HITBOX: 20, // square, centered
  SPEED: 150, // px/s
  MAX_HP: 6, // pre-pick neutral pool (DEFAULT_KIT only; classes bring hit dice)
  HP_CAP: 120, // Wave L — 2e pools: a safety ceiling (god-roll d10 = 100), not a balance lever
  LOW_HP_FRAC: 0.25, // Wave L — "bloodied": danger stinger + HUD vignette gate
  REVIVE_FRAC: 0.25, // Wave L — phoenix/survivor/luck return at this share of the pool
  HIT_INVULN: 1.0, // seconds of i-frames after damage
  SWORD_RANGE: 40, // px from player center
  SWORD_ARC_DEG: 100, // total arc width centered on facing
  SWORD_COOLDOWN: 0.34,
  SWORD_ACTIVE: 0.14, // damage window at start of swing
  SWORD_KNOCKBACK: 170,
  DAGGER_SPEED: 340,
  DAGGER_COOLDOWN: 0.28,
  START_DAGGERS: 5,
  DAGGER_CAP: 12,
  // v2 — dodge dash
  DASH_SPEED: 460,
  DASH_DURATION: 0.16,
  DASH_COOLDOWN: 1.1,
  DASH_IFRAME_TAIL: 0.1, // i-frames linger this long after the dash ends
} as const;

export const COMBAT = {
  COMBO_WINDOW: 3.0, // seconds between kills to keep the chain alive
  COMBO_KILLS_PER_STEP: 3, // kills per +1 multiplier step
  MAX_COMBO: 5,
  DEPTH_MULT_PER_FLOOR: 0.25, // score multiplier: 1 + 0.25 * (floor - 1)
  FLOOR_CLEAR_BONUS_BASE: 150, // descent bonus = base + per_floor * floor
  FLOOR_CLEAR_BONUS_PER_FLOOR: 75,
  BOSS_BONUS: 1000,
} as const;

export const PICKUPS = {
  GOLD_VALUE: 1, // pickups counter (arcade coin economy)
  GOLD_SCORE: 15,
  HEART_HEAL: { n: 1, d: 6, plus: 1 } as Dice, // Wave L — rolled at the bite
  DAGGER_BUNDLE: 4,
  POTION_DURATION: 10, // seconds of buff
  MAGNET_RADIUS: 90, // Coin Magnet relic pull radius
  MAGNET_SPEED: 260,
} as const;

// Buff identifiers granted by potions.
export type PotionBuff = 'haste' | 'strength' | 'stoneskin';

// v2 — merchant shop (floor 2+). Prices are spendable gold (the run's gold
// BALANCE, distinct from the cumulative arcade pickups counter).
export const SHOP = {
  FLOOR_MIN: 2,
  ROOM_CHANCE: 0.65,
  PRICE_HEART: 25,
  PRICE_DAGGERS: 20,
  PRICE_POTION: 30,
  PRICE_RELIC_BASE: 60,
  PRICE_RELIC_PER_FLOOR: 10,
  PRICE_SCROLL: 35, // v3 — unidentified scroll

  INTERACT_RADIUS: 26, // px to a pedestal to show the buy prompt
} as const;

// v2 — hazard tiles (spikes / ember vents) on a telegraphed cycle.
export const HAZARDS = {
  FLOOR_MIN: 2,
  DOWN_TIME: 1.5, // safe
  TELEGRAPH_TIME: 0.45, // points peeking / vent hissing
  UP_TIME: 0.8, // damaging
  DAMAGE: { n: 1, d: 3 } as Dice, // Wave L — rolled when the trap bites
  RADIUS: 13, // damage overlap radius from tile center
  DISARM_RADIUS: 30, // Wave M — px to the plate for a thief's E-disarm
} as const;

// v2 — staged explosions (bomber bombs + volatile elite death).
export const EXPLOSIONS = {
  BOMB_FLIGHT: 0.8,
  BOMB_FUSE: 0.7,
  BOMB_RADIUS: 46,
  VOLATILE_FUSE: 0.6,
  VOLATILE_RADIUS: 54,
  DAMAGE: 1, // staged number vs MONSTERS/urns — the enemy-side economy
  PLAYER_DAMAGE: { n: 1, d: 6 } as Dice, // Wave L — an enemy boom vs the hero
} as const;

// v2 — boss shockwave rings (Bone Colossus slam).
export const SHOCKWAVE = {
  SPEED: 210, // px/s radius growth
  MAX_RADIUS: 250,
  THICKNESS: 15, // player is hit while |dist - radius| < this
  DAMAGE: { n: 1, d: 4, plus: 1 } as Dice, // Wave L — rolled as the ring bites
} as const;

export const LIGHTING = {
  BASE_TORCH_RADIUS: 190, // px around player
  RADIUS_PER_KEEN_EYE: 55,
  WALL_TORCH_RADIUS: 95,
  STAIRS_GLOW_RADIUS: 80,
  DARKNESS_BASE: 0.86, // overlay alpha on floor 1
  DARKNESS_PER_FLOOR: 0.01,
  DARKNESS_MAX: 0.93,
} as const;

// Wave K — THE SPECTACLE: every impact-feel magnitude in one place. Hit-stop
// freezes ONLY the playing sim (simDt); particles/shake/lighting/banners ride
// real dt so the world stays alive through the freeze.
export const JUICE = {
  // Hit-stop lengths (seconds of frozen sim).
  HITSTOP_KILL: 0.045,
  HITSTOP_BOSS_HIT: 0.03,
  HITSTOP_BOSS_KILL: 0.22,
  HITSTOP_PLAYER_HURT: 0.06,
  HITSTOP_SPELL_IMPACT: 0.05,
  HITSTOP_ENRAGE: 0.08,
  HITSTOP_MAX: 0.3, // stacked freezes never exceed this
  // Transient flash-lights (radius px, life seconds).
  FLASH_EXPLOSION_RADIUS: 130,
  FLASH_EXPLOSION_LIFE: 0.35,
  FLASH_SPELL_RADIUS: 110,
  FLASH_SPELL_LIFE: 0.3,
  FLASH_BOSS_DEATH_RADIUS: 220,
  FLASH_BOSS_DEATH_LIFE: 0.8,
  FLASH_LEVEL_UP_RADIUS: 150,
  FLASH_LEVEL_UP_LIFE: 0.6,
  // Floor-entry curtain: black scrim fading off after loadFloor.
  CURTAIN_TIME: 0.35,
  // Directional camera kick (px at strength 1) + decay rate.
  KICK_MAGNITUDE: 7,
  KICK_DECAY: 9,
  KICK_MELEE: 0.5,
  KICK_HURT: 0.7,
  KICK_BOSS: 1.0,
  // Hurt vignette / low-HP pulse alphas.
  VIGNETTE_HURT_ALPHA: 0.28,
  VIGNETTE_LOW_HP_ALPHA: 0.16,
} as const;

// Overlay timing (house style: fade-in / hold / fade-out banners, recap lockout)
export const OVERLAY = {
  BANNER_FADE_IN: 0.4,
  BANNER_HOLD: 1.5,
  BANNER_FADE_OUT: 0.5,
  RECAP_INPUT_LOCKOUT: 1.2,
  RECAP_AUTO_DISMISS: 12,
  // v4 Wave C — saga interlude: brief lockout so the prose gets a beat.
  INTERLUDE_LOCKOUT: 1.0,
} as const;

// v4 Wave C — secret rooms behind cracked walls: counts, stock, and the nests
// that may stir inside. The blast that opens the door should pay for itself.
export const SECRETS = {
  MAX_PER_FLOOR: 2, // rng.int(0, MAX) rooms per floor
  ROOM_MIN: 3, // interior tiles per side
  ROOM_MAX: 4,
  PLACE_ATTEMPTS: 24, // tries per room before giving up
  GOLD_MIN: 3,
  GOLD_MAX: 5,
  URNS_MIN: 1,
  URNS_MAX: 2,
  SHRINE_CHANCE: 0.5, // else an unidentified scroll
  NEST_CHANCE: 0.5,
  NEST_PACK_MIN: 3,
  NEST_PACK_MAX: 5,
  NEST_REWARD_BASE: 25, // run-wallet gold on clearing a nest...
  NEST_REWARD_PER_FLOOR: 10, // ...plus this per floor
  CHEST_CHANCE: 0.35, // Wave M — a secret room may hold a locked chest
} as const;

// Wave M — locked chests: the rogue's trade. The generator seeds POSITIONS
// only; contents (and every skill roll) come off the live run rng at game
// level. A key turns any lock; only a thief picks one for free.
export const CHESTS = {
  FLOOR_MIN: 2, // floor 1 stays gentle
  FLOOR_CHANCE: 0.7, // chance a rooms-floor hides exactly one chest
  INTERACT_RADIUS: 30, // px to the chest to show the prompt
  GOLD_MIN: 4, // gold pickups scattered on opening...
  GOLD_MAX: 7,
  BONUS_SCROLL: 0.35, // one bonus roll: a scroll...
  BONUS_POTION: 0.25, // ...else a potion...
  BONUS_ITEM: 0.2, // ...else an equipment find...
  GOLD_EXTRA_MIN: 2, // ...else a little more gold
  GOLD_EXTRA_MAX: 3,
} as const;

// Floor flavor names cycle as the player descends.
export const FLOOR_NAMES: readonly string[] = [
  'THE EMBER DEPTHS',
  'BONE GALLERIES',
  'THE SUNKEN CRYPT',
  'HALLS OF CINDER',
  'THE WYRM WARRENS',
  'VAULTS OF ASH',
  'THE BLACK STACKS',
  'ROOTS OF THE MOUNTAIN',
];

export const BOSS_FLOOR_NAME = "THE GUARDIAN'S ARENA";

// v2 — biome palettes recolor tiles/torches per floor. Chosen by floor-name
// index so descent cycles Ember -> Bone -> Sunken -> Ash and repeats.
export type HazardStyle = 'spikes' | 'vent';

export interface BiomePalette {
  id: string;
  floorA: string;
  floorB: string;
  floorCrack: string;
  wallTop: string;
  wallFace: string;
  wallEdge: string;
  flameOuter: string;
  flameInner: string;
  hazardStyle: HazardStyle;
}

export const BIOMES: readonly BiomePalette[] = [
  {
    id: 'ember',
    floorA: '#2b241e',
    floorB: '#272019',
    floorCrack: '#1e1812',
    wallTop: '#4a3c30',
    wallFace: '#382c23',
    wallEdge: '#15100c',
    flameOuter: '#ff7a1a',
    flameInner: '#ffc94d',
    hazardStyle: 'vent',
  },
  {
    id: 'bone',
    floorA: '#2e2b24',
    floorB: '#29261f',
    floorCrack: '#1f1c15',
    wallTop: '#6b6353',
    wallFace: '#514a3c',
    wallEdge: '#1c180f',
    flameOuter: '#ffa04d',
    flameInner: '#ffe08a',
    hazardStyle: 'spikes',
  },
  {
    id: 'sunken',
    floorA: '#1f2a27',
    floorB: '#1b2522',
    floorCrack: '#131c19',
    wallTop: '#31504a',
    wallFace: '#263d38',
    wallEdge: '#0d1614',
    flameOuter: '#3edb9e',
    flameInner: '#b4ffd9',
    hazardStyle: 'spikes',
  },
  {
    id: 'ash',
    floorA: '#26262b',
    floorB: '#212126',
    floorCrack: '#18181c',
    wallTop: '#4a4a55',
    wallFace: '#37373f',
    wallEdge: '#121215',
    flameOuter: '#8f9dff',
    flameInner: '#dbe2ff',
    hazardStyle: 'vent',
  },
];

export function biomeForFloor(floor: number): BiomePalette {
  const idx = (((floor - 1) % BIOMES.length) + BIOMES.length) % BIOMES.length;
  return BIOMES[idx];
}

// Retro palette — deep stone + ember accents. Tile renderer and HUD share it.
export const PALETTE = {
  voidBlack: '#050308',
  floorA: '#2b241e',
  floorB: '#272019',
  floorCrack: '#1e1812',
  wallTop: '#4a3c30',
  wallFace: '#382c23',
  wallEdge: '#15100c',
  doorWood: '#6b4a2a',
  doorLocked: '#8a6a1e',
  stairs: '#c98a2e',
  stairsGlow: '#ffb84d',
  ember: '#ff7a1a',
  emberBright: '#ffc94d',
  blood: '#c22f2f',
  gold: '#ffd24a',
  heart: '#ff4d5e',
  dagger: '#cfd6e0',
  keyGold: '#ffe08a',
  potion: '#7ae0ff',
  hudPanel: 'rgba(10, 7, 5, 0.78)',
  hudBorder: '#a56a2b',
  textWarm: '#ffe8c8',
  textDim: '#b09a7e',
} as const;
