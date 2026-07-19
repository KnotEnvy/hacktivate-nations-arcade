// ===== src/games/dungeon-crawl/data/classes.ts =====
// v3 — playable classes, drafted once at run start. Each class is a stat kit
// (weapon feel, hearts, daggers) plus one signature ability on Q/L. Player.ts
// reads the kit; DungeonCrawlGame dispatches the ability; nothing here
// executes logic. All card text is original.

import { PLAYER } from './constants';

export type ClassId = 'fighter' | 'thief' | 'cleric' | 'mage';

export type AbilityId = 'cleave' | 'shadow-hide' | 'turn-undead' | 'fireball';

export interface ClassKit {
  // Wave L — AD&D 2e vitals: level 1 opens at the hit die's MAXIMUM, and
  // every level after rolls the die live (kept on the hero as hpRolls).
  maxHp: number; // level-1 pool = hitDie
  hitDie: number; // d10 warrior / d8 priest / d6 rogue / d4 wizard
  speedMult: number; // on PLAYER.SPEED
  meleeDamageBonus: number; // added to the base 1 before relics
  meleeRange: number; // px from player center
  meleeArcDeg: number; // total swing arc
  meleeCooldown: number; // seconds between swings
  meleeKnockback: number; // impulse on hit
  startDaggers: number;
  daggerCap: number; // before Dagger Sage bonuses
  daggerHoming: number; // rad/s steer (mage mana bolts); 0 = straight
  daggerRegenInterval: number; // seconds per +1 dagger; 0 = pickups only
  goldDropMult: number; // multiplies gold drop COUNT (never the arcade counter)
  healBonus: number; // extra hp per heart pickup
  backstabMult: number; // melee damage mult from behind
  abilityId: AbilityId;
  abilityCooldown: number; // seconds
}

export interface ClassDef {
  id: ClassId;
  name: string;
  blurb: string; // one line on the choice card
  icon: string; // single glyph on the card / HUD
  color: string; // card + HUD accent
  tunic: string; // sprite cloak recolor
  trim: string; // sprite hood recolor
  abilityName: string;
  abilityBlurb: string;
  kit: ClassKit;
}

/**
 * Neutral kit active before a class is chosen — reproduces the pre-v3 hero
 * exactly (every number mirrors PLAYER), so nothing changes until the pick.
 */
export const DEFAULT_KIT: ClassKit = {
  maxHp: PLAYER.MAX_HP,
  hitDie: 6, // neutral d6 until the pick (pre-class hero only)
  speedMult: 1,
  meleeDamageBonus: 0,
  meleeRange: PLAYER.SWORD_RANGE,
  meleeArcDeg: PLAYER.SWORD_ARC_DEG,
  meleeCooldown: PLAYER.SWORD_COOLDOWN,
  meleeKnockback: PLAYER.SWORD_KNOCKBACK,
  startDaggers: PLAYER.START_DAGGERS,
  daggerCap: PLAYER.DAGGER_CAP,
  daggerHoming: 0,
  daggerRegenInterval: 0,
  goldDropMult: 1,
  healBonus: 0,
  backstabMult: 1,
  abilityId: 'cleave',
  abilityCooldown: 6,
};

export const CLASSES: Record<ClassId, ClassDef> = {
  fighter: {
    id: 'fighter',
    name: 'FIGHTER',
    blurb: 'Iron-shod veteran. The deepest well of vigor; a wide, heavy swing.',
    icon: '⚔',
    color: '#e08a3d',
    tunic: '#8a5a2a',
    trim: '#4a2c12',
    abilityName: 'CLEAVE',
    abilityBlurb: 'Spin and strike everything in reach.',
    kit: {
      ...DEFAULT_KIT,
      maxHp: 10,
      hitDie: 10, // the warrior's d10
      meleeArcDeg: 120,
      meleeKnockback: 230,
      abilityId: 'cleave',
      abilityCooldown: 6,
    },
  },
  thief: {
    id: 'thief',
    name: 'THIEF',
    blurb: 'Quick and greedy. Strikes from behind cut twice as deep.',
    icon: '♠',
    color: '#9a7bff',
    tunic: '#3f3a52',
    trim: '#26233a',
    abilityName: 'HIDE IN SHADOWS',
    abilityBlurb: 'Vanish briefly; your next strike is a backstab.',
    kit: {
      ...DEFAULT_KIT,
      hitDie: 6, // the rogue's d6
      speedMult: 1.14,
      meleeRange: 36,
      meleeArcDeg: 90,
      meleeCooldown: 0.28,
      meleeKnockback: 150,
      startDaggers: 8,
      goldDropMult: 1.25,
      backstabMult: 2,
      abilityId: 'shadow-hide',
      abilityCooldown: 10,
    },
  },
  cleric: {
    id: 'cleric',
    name: 'CLERIC',
    blurb: 'Faith and a heavy mace. Healing runs deeper in devout hands.',
    icon: '✚',
    color: '#ffe08a',
    tunic: '#c9c2a8',
    trim: '#8a6a1e',
    abilityName: 'TURN UNDEAD',
    abilityBlurb: 'A holy pulse that sears bone and shade.',
    kit: {
      ...DEFAULT_KIT,
      maxHp: 8,
      hitDie: 8, // the priest's d8
      meleeDamageBonus: 1,
      meleeRange: 34,
      meleeCooldown: 0.48,
      meleeKnockback: 280,
      healBonus: 2, // Wave L — re-priced for hit-die pools
      abilityId: 'turn-undead',
      abilityCooldown: 8,
    },
  },
  mage: {
    id: 'mage',
    name: 'MAGE',
    blurb: 'Frail as parchment, endless bolts. Seeking missiles that renew.',
    icon: '✦',
    color: '#78beff',
    tunic: '#3f4a8a',
    trim: '#26305c',
    abilityName: 'FIREBALL',
    abilityBlurb: 'Lob a blast that levels the room.',
    kit: {
      ...DEFAULT_KIT,
      maxHp: 4,
      hitDie: 4, // the wizard's d4
      meleeRange: 28,
      meleeArcDeg: 90,
      meleeCooldown: 0.4,
      meleeKnockback: 120,
      startDaggers: 3,
      daggerCap: 6,
      daggerHoming: 3.0,
      daggerRegenInterval: 4,
      abilityId: 'fireball',
      abilityCooldown: 8,
    },
  },
};

export const ALL_CLASS_IDS = Object.keys(CLASSES) as ClassId[];

export const CLASS_TUNING = {
  HIDE_DURATION: 1.5, // untargetable seconds (rides Player.invuln)
  BACKSTAB_DOT: 0.35, // hitDir·facing above this = struck from behind
  TURN_UNDEAD_RADIUS: 140,
  TURN_UNDEAD_DAMAGE: 2,
  TURN_UNDEAD_STUN: 1.0, // undead freeze seconds
  TURN_UNDEAD_PUSH: 320, // knockback for the unhallowed-but-living
  CLEAVE_KNOCKBACK: 320,
  CLEAVE_RANGE_PAD: 10, // cleave reach = melee range + this
  FIREBALL_LOB_DIST: 140, // px ahead of the player
  FIREBALL_FLIGHT: 0.45, // seconds in the air
  FIREBALL_FUSE: 0.35, // seconds on the ground before the boom
  FIREBALL_RADIUS: 56,
  FIREBALL_DAMAGE: 2,
} as const;

// Wave M — THE ROGUE'S TRADE: the thief's percentile trade-skills, 2e-shaped
// (base + per-level growth + a DEX lean, capped). No save field — both derive
// live from hero level + DEX delta, so milestones and trinkets fold in free.
export const THIEF_SKILLS = {
  OPEN_LOCKS_BASE: 40, // percent at level 1
  REMOVE_TRAPS_BASE: 35,
  PER_LEVEL: 5, // percent per hero level past 1
  DEX_BONUS: 10, // percent per DEX delta modifier point
  CAP: 95, // even a master can snap a pick
  PICK_RETRY: 0.9, // seconds before the pick steadies after a slip
  DISARM_XP_BASE: 8, // grantXp on a disarm (the WIS fold rides inside)...
  DISARM_XP_PER_FLOOR: 2, // ...plus this per floor
} as const;

const skillChance = (base: number, level: number, dexDelta: number): number =>
  Math.min(
    THIEF_SKILLS.CAP,
    base + THIEF_SKILLS.PER_LEVEL * (level - 1) + THIEF_SKILLS.DEX_BONUS * dexDelta,
  );

/** Percent chance to pick a chest's lock (thief only; rolled on the live rng). */
export function openLocksChance(level: number, dexDelta: number): number {
  return skillChance(THIEF_SKILLS.OPEN_LOCKS_BASE, level, dexDelta);
}

/** Percent chance to disarm a floor trap (thief only; failure springs it). */
export function removeTrapsChance(level: number, dexDelta: number): number {
  return skillChance(THIEF_SKILLS.REMOVE_TRAPS_BASE, level, dexDelta);
}
