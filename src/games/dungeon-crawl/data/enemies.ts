// ===== src/games/dungeon-crawl/data/enemies.ts =====
// Data-driven enemy archetypes. Enemy.ts interprets `behavior`; everything
// numeric lives here so balance is a data edit, not a code edit.

import type { DeathCause } from '../systems/Combat';
import type { Dice } from './dice';

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
  | 'cinder-hound'
  // v4 Wave D — Monstrous Manual additions (existing behavior verbs only)
  | 'salamander'
  | 'bone-archer'
  | 'drowned-one'
  | 'ember-wight'
  | 'gargoyle'
  // Wave P — THE WIDER WORLD: one more family member per biome, plus a deep
  // shared terror for long runs.
  | 'slag-thrall'
  | 'barrow-hound'
  | 'brine-weird'
  | 'cinder-bloat'
  | 'lantern-wisp'
  // Wave Q2 — THE PLANES: three natives per plane. These share NO floor with
  // the dungeon's population; a planar floor's spawn table replaces the core
  // rather than adding to it.
  | 'void-lancer'
  | 'star-husk'
  | 'mote-swarm'
  | 'brass-warden'
  | 'lantern-sentry'
  | 'gear-hound'
  | 'chaos-croaker'
  | 'bone-raker'
  | 'shape-eater'
  | 'pit-wretch'
  | 'barbed-sentinel'
  | 'ash-harrier';

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

// ===== Wave N — THE LIVING DEPTHS: reaction & morale =====
// Living, pack-minded foes lose their nerve. When one of their number falls,
// every morale-flagged member near the body rolls to BREAK and run. The
// undead, the mindless and the ambusher never carry the flag, so they hold
// the line by construction. Every knob is a data edit.
export const MORALE = {
  PACK_RADIUS: 200, // a fallen ally within this rattles the rest of the pack
  BASE_CHANCE: 0.15, // floor odds any one flagged foe breaks per body
  BELOW_HALF_BONUS: 0.2, // added while the pack is below half its seeded strength
  HERO_LEVEL_BONUS: 0.03, // per hero level ABOVE the floor — an overmatched pack runs
  CHANCE_CAP: 0.6, // even a rout keeps its holdouts
  FLEE_TIME: 4, // seconds a broken foe runs before it steadies
} as const;

/**
 * Odds one flagged foe breaks when a body drops nearby — designed ONCE here so
 * the sweep and the tests read the same law. Thinned or overmatched packs
 * break more readily; a healthy pack facing a peer mostly holds. `baseline` is
 * the floor's seeded pack size (guarded: <= 0 means no below-strength bonus).
 */
/**
 * The law, designed ONCE — the sweep and every test read this and nothing
 * else. Wave Q1 added `dread`: the ascent-band boon of the same name feeds its
 * bonus in HERE rather than adjusting the roll at the call site, so there is
 * still exactly one place where a pack's nerve is decided (and the CHANCE_CAP
 * still has the final word, so no amount of dread routs a room outright).
 */
export function moraleBreakChance(
  heroLevel: number,
  floor: number,
  alive: number,
  baseline: number,
  dread = 0,
  // Wave Q2 — THE BRASS MARCHES' law: nothing here breaks. It lands as a
  // short-circuit INSIDE the law rather than a skipped sweep at the call site,
  // so "what are the odds this pack runs" still has exactly one answer in the
  // codebase — and on that plane the answer is none.
  unbroken = false,
): number {
  if (unbroken) return 0;
  const belowStrength = baseline > 0 && alive < baseline / 2 ? MORALE.BELOW_HALF_BONUS : 0;
  const overmatch = MORALE.HERO_LEVEL_BONUS * Math.max(0, heroLevel - floor);
  return Math.min(
    MORALE.CHANCE_CAP,
    MORALE.BASE_CHANCE + belowStrength + overmatch + Math.max(0, dread),
  );
}

export interface EnemyConfig {
  id: EnemyTypeId;
  behavior: EnemyBehavior;
  hp: number;
  speed: number; // px/s
  size: number; // square hitbox, px
  // Wave L — damage is DICE, rolled internally on the live rng at the moment
  // the blow lands (never shown as dice on screen). d1 = a fixed nip.
  touchDamage: Dice;
  score: number; // base kill score before combo/depth multipliers
  xp: number; // v4 — experience granted to the hero on the kill
  goldDrop: [min: number, max: number]; // gold pickups scattered on death
  aggroRange: number; // px — starts chasing/attacking inside this
  color: string; // body color for the retro sprite
  accent: string; // eyes / trim
  undead?: boolean; // v3 — seared + stunned by the cleric's Turn Undead
  splitsInto?: EnemyTypeId; // v3 — divides into two of these on death
  boltCause?: DeathCause; // v4 Wave D — recap cause for a ranged type's bolts
  boltDamage?: Dice; // Wave L — a ranged type's bolt dice (rolled at fire time)
  // Wave N — living, pack-minded types that can BREAK and flee when the fight
  // turns against them. NEVER on the undead, the mindless (slimes/oozes) or the
  // mimic (an ambusher has no nerve to lose) — pinned by test.
  morale?: true;
  // Wave Q1 — WARDED: 2e's "hit only by magical weapons". Honest steel still
  // wounds these (the arcade never makes a foe unkillable), but a fighter who
  // has taken BREECH in the ascent band bites them properly. Carried by the
  // half-real: the wraith, the shade, the stone-skinned gargoyle. Q2's planar
  // families inherit the flag — that is what makes BREECH the planar key.
  warded?: true;
}

export const ENEMY_CONFIGS: Record<EnemyTypeId, EnemyConfig> = {
  slime: {
    id: 'slime',
    behavior: 'wander',
    hp: 2,
    speed: 42,
    size: 22,
    touchDamage: { n: 1, d: 2 },
    score: 20,
    xp: 10,
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
    touchDamage: { n: 1, d: 1 },
    score: 8,
    xp: 3,
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
    touchDamage: { n: 1, d: 2 },
    score: 30,
    xp: 15,
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
    touchDamage: { n: 1, d: 1 },
    score: 25,
    xp: 12,
    goldDrop: [0, 1],
    aggroRange: 260,
    color: '#7b5ea7',
    accent: '#e8d24a',
    morale: true, // Wave N — skittish flyers scatter first
  },
  sorcerer: {
    id: 'sorcerer',
    behavior: 'ranged',
    hp: 2,
    speed: 55,
    size: 22,
    touchDamage: { n: 1, d: 2 },
    score: 45,
    xp: 25,
    goldDrop: [1, 3],
    aggroRange: 300,
    color: '#3f6fd8',
    accent: '#c9e2ff',
    boltDamage: { n: 1, d: 3 },
    morale: true, // Wave N
  },
  knight: {
    id: 'knight',
    behavior: 'armored',
    hp: 5,
    speed: 52,
    size: 24,
    touchDamage: { n: 1, d: 4, plus: 1 },
    score: 60,
    xp: 35,
    goldDrop: [2, 4],
    aggroRange: 240,
    color: '#8a93a6',
    accent: '#c22f2f',
    morale: true, // Wave N — even a mailed veteran can lose heart
  },
  mimic: {
    id: 'mimic',
    behavior: 'mimic',
    hp: 4,
    speed: 96,
    size: 24,
    touchDamage: { n: 1, d: 4, plus: 1 },
    score: 80,
    xp: 45,
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
    touchDamage: { n: 1, d: 2 },
    score: 50,
    xp: 28,
    goldDrop: [1, 3],
    aggroRange: 280,
    color: '#6f8f3a',
    accent: '#2b3a12',
    morale: true, // Wave N
  },
  wraith: {
    id: 'wraith',
    behavior: 'wraith',
    hp: 3,
    speed: 46,
    size: 22,
    touchDamage: { n: 1, d: 2 },
    score: 70,
    xp: 40,
    goldDrop: [1, 2],
    aggroRange: 260, // senses through walls — no LOS needed
    color: '#b9c8e8',
    accent: '#3a4a6e',
    undead: true,
    warded: true, // Wave Q1 — half here at best
  },
  // ===== v3 biome families =====
  'fire-beetle': {
    id: 'fire-beetle',
    behavior: 'chase',
    hp: 2,
    speed: 58,
    size: 20,
    touchDamage: { n: 1, d: 2 },
    score: 25,
    xp: 12,
    goldDrop: [1, 2],
    aggroRange: 200,
    color: '#c9542a',
    accent: '#ffd24a', // glow glands — the game gives these real light
    morale: true, // Wave N
  },
  zombie: {
    id: 'zombie',
    behavior: 'chase',
    hp: 5,
    speed: 34,
    size: 22,
    touchDamage: { n: 1, d: 2 },
    score: 35,
    xp: 18,
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
    touchDamage: { n: 1, d: 4, plus: 1 },
    score: 55,
    xp: 30,
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
    touchDamage: { n: 1, d: 2 },
    score: 30,
    xp: 30,
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
    touchDamage: { n: 1, d: 1 },
    score: 8,
    xp: 3,
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
    touchDamage: { n: 1, d: 4, plus: 1 },
    score: 50,
    xp: 28,
    goldDrop: [2, 4],
    aggroRange: 240,
    color: '#4a8a56',
    accent: '#ffd24a',
    morale: true, // Wave N
  },
  shade: {
    id: 'shade',
    behavior: 'wraith',
    hp: 2,
    speed: 62,
    size: 20,
    touchDamage: { n: 1, d: 3 },
    score: 65,
    xp: 36,
    goldDrop: [1, 2],
    aggroRange: 260,
    color: '#5a5a72',
    accent: '#9a7bff',
    undead: true,
    warded: true, // Wave Q1 — a cast shadow with teeth
  },
  'cinder-hound': {
    id: 'cinder-hound',
    behavior: 'chase',
    hp: 2,
    speed: 105,
    size: 18,
    touchDamage: { n: 1, d: 3 },
    score: 45,
    xp: 24,
    goldDrop: [1, 2],
    aggroRange: 280,
    color: '#8a3a2a',
    accent: '#ffd24a',
    morale: true, // Wave N
  },
  // ===== v4 Wave D — Monstrous Manual additions =====
  salamander: {
    id: 'salamander',
    behavior: 'ranged',
    hp: 3,
    speed: 60,
    size: 22,
    touchDamage: { n: 1, d: 3 },
    score: 55,
    xp: 30,
    goldDrop: [1, 3],
    aggroRange: 300,
    color: '#d84a1a',
    accent: '#ffd24a',
    boltCause: 'salamander',
    boltDamage: { n: 1, d: 4 },
    morale: true, // Wave N
  },
  'bone-archer': {
    id: 'bone-archer',
    behavior: 'ranged',
    hp: 2,
    speed: 58,
    size: 20,
    touchDamage: { n: 1, d: 3 },
    score: 50,
    xp: 26,
    goldDrop: [1, 2],
    aggroRange: 320,
    color: '#cfc7b0',
    accent: '#8a2f2f',
    undead: true,
    boltCause: 'bone_arrow',
    boltDamage: { n: 1, d: 4 },
  },
  'drowned-one': {
    id: 'drowned-one',
    behavior: 'chase',
    hp: 4,
    speed: 40,
    size: 22,
    touchDamage: { n: 1, d: 3 },
    score: 40,
    xp: 22,
    goldDrop: [1, 3],
    aggroRange: 200,
    color: '#5a7a6a',
    accent: '#bfe8d8',
    undead: true,
  },
  'ember-wight': {
    id: 'ember-wight',
    behavior: 'armored',
    hp: 4,
    speed: 48,
    size: 22,
    touchDamage: { n: 1, d: 4, plus: 1 },
    score: 70,
    xp: 40,
    goldDrop: [2, 4],
    aggroRange: 240,
    color: '#6a4a3a',
    accent: '#ff9a3d',
    undead: true,
  },
  gargoyle: {
    id: 'gargoyle',
    behavior: 'flit',
    hp: 4,
    speed: 110,
    size: 20,
    touchDamage: { n: 1, d: 4, plus: 1 },
    score: 75,
    xp: 42,
    goldDrop: [1, 3],
    aggroRange: 280,
    color: '#8a8a92',
    accent: '#c9c9d2',
    morale: true, // Wave N
    warded: true, // Wave Q1 — living stone turns an honest edge
  },
  // ===== Wave P — THE WIDER WORLD =====
  // Each biome gains the member its threat grammar was missing: ember had no
  // shield-bearer, bone nothing that RUNS, sunken nothing at range, ash no area
  // denial. The wisp belongs to no biome — it is what waits below floor ten.
  'slag-thrall': {
    id: 'slag-thrall',
    behavior: 'armored',
    hp: 6,
    speed: 44,
    size: 24,
    touchDamage: { n: 1, d: 4, plus: 1 },
    score: 65,
    xp: 38,
    goldDrop: [2, 4],
    aggroRange: 220,
    color: '#4a3b34',
    accent: '#ff8c3a', // molten seams where the plate has cracked open
    // No morale: what is left in that armor stopped being afraid a long time ago.
  },
  'barrow-hound': {
    id: 'barrow-hound',
    behavior: 'chase',
    hp: 2,
    speed: 112,
    size: 18,
    touchDamage: { n: 1, d: 3 },
    score: 45,
    xp: 24,
    goldDrop: [1, 2],
    aggroRange: 280,
    color: '#9a9382',
    accent: '#bfe8ff',
    undead: true, // the barrows kept their own dogs
  },
  'brine-weird': {
    id: 'brine-weird',
    behavior: 'ranged',
    hp: 3,
    speed: 50,
    size: 22,
    touchDamage: { n: 1, d: 3 },
    score: 55,
    xp: 30,
    goldDrop: [1, 3],
    aggroRange: 300,
    color: '#2f6f8a',
    accent: '#bfe8f6',
    boltCause: 'brine_lash',
    boltDamage: { n: 1, d: 4 },
    // No morale: a rope of standing water has no nerve to break.
  },
  'cinder-bloat': {
    id: 'cinder-bloat',
    behavior: 'bomber',
    hp: 3,
    speed: 46,
    size: 22,
    touchDamage: { n: 1, d: 3 },
    score: 55,
    xp: 32,
    goldDrop: [1, 3],
    aggroRange: 260,
    color: '#6a4438',
    accent: '#ffb347',
    morale: true, // Wave P — living, and it knows what it is full of
  },
  'lantern-wisp': {
    id: 'lantern-wisp',
    behavior: 'flit',
    hp: 3,
    speed: 138,
    size: 14,
    touchDamage: { n: 1, d: 4, plus: 1 },
    score: 85,
    xp: 48,
    goldDrop: [1, 3],
    aggroRange: 300,
    color: '#e8f0a0',
    accent: '#fffbe0',
    // No morale: it does not fight for anything, so it has nothing to lose.
    // The game gives this one real light — the lure IS the monster.
  },

  // ===== Wave Q2 — THE PLANES =====
  // Three natives per plane, each cast for the role its plane's LAW needs.
  // Numbers sit a clear step above the deep dungeon: these are met by heroes
  // who have ascended, and every one of them is `warded` unless the fiction
  // insists otherwise — which is what makes a fighter's BREECH the key.

  // --- THE SILVER VOID: raiders of an endless bright nothing. No cover for
  // them either, so they are FAST and they come from anywhere.
  'void-lancer': {
    id: 'void-lancer',
    behavior: 'chase',
    hp: 7,
    speed: 132,
    size: 20,
    touchDamage: { n: 1, d: 6 },
    score: 120,
    xp: 70,
    goldDrop: [2, 5],
    aggroRange: 340,
    color: '#8fa6c8',
    accent: '#e8f2ff',
    warded: true,
    morale: true, // a raider raids; it does not die for the silver
  },
  'star-husk': {
    id: 'star-husk',
    behavior: 'armored',
    hp: 12,
    speed: 48,
    size: 26,
    // Wave Q2 — 1d8: spiky, and still no heavier on average than a boss's
    // touch (hitpoints.test pins that no ordinary foe out-hits a boss).
    touchDamage: { n: 1, d: 8 },
    score: 150,
    xp: 88,
    goldDrop: [3, 6],
    aggroRange: 260,
    color: '#39404f',
    accent: '#cfe3ff', // starlight in the cracks of something long empty
    warded: true,
    // No morale: whatever wore this is not home.
  },
  'mote-swarm': {
    id: 'mote-swarm',
    behavior: 'flit',
    hp: 4,
    speed: 150,
    size: 14,
    touchDamage: { n: 1, d: 4 },
    score: 90,
    xp: 52,
    goldDrop: [1, 3],
    aggroRange: 320,
    color: '#dfe9ff',
    accent: '#ffffff',
    warded: true,
    // No morale: a swarm has no one in it to lose their nerve.
  },

  // --- THE BRASS MARCHES: made things that were told to hold the line and
  // were never told anything else. Nothing here breaks, by law and by nature.
  'brass-warden': {
    id: 'brass-warden',
    behavior: 'armored',
    hp: 14,
    speed: 52,
    size: 28,
    // Nothing that is not a boss may out-hit a boss's blow (hitpoints.test
    // pins it). The Marches' weight is in its HP, not its swing.
    touchDamage: { n: 1, d: 8 },
    score: 165,
    xp: 96,
    goldDrop: [3, 7],
    aggroRange: 250,
    color: '#8a6a24',
    accent: '#ffd98a',
    warded: true,
    // Mindless by construction — and under the Marches' law it could not
    // break even if there were anyone inside to be afraid.
  },
  'lantern-sentry': {
    id: 'lantern-sentry',
    behavior: 'ranged',
    hp: 6,
    speed: 60,
    size: 18,
    touchDamage: { n: 1, d: 3 },
    boltCause: 'sentry_ray',
    boltDamage: { n: 1, d: 6 },
    score: 130,
    xp: 76,
    goldDrop: [2, 5],
    aggroRange: 340,
    color: '#ffd98a',
    accent: '#fff6d8',
    warded: true,
    // It carries its own light (rendering/lights.ts) — a watchman that IS the
    // lamp. Seeing it and being seen by it are the same event.
  },
  'gear-hound': {
    id: 'gear-hound',
    behavior: 'chase',
    hp: 6,
    speed: 128,
    size: 18,
    touchDamage: { n: 1, d: 4, plus: 1 },
    score: 100,
    xp: 60,
    goldDrop: [1, 4],
    aggroRange: 320,
    color: '#9a7a34',
    accent: '#e8c46a',
    warded: true,
  },

  // --- THE CHURNING: chaos with teeth. These are the ones that call their own
  // kin through after them (the plane's law, not their own trick).
  'chaos-croaker': {
    id: 'chaos-croaker',
    behavior: 'chase',
    hp: 9,
    speed: 104,
    size: 24,
    touchDamage: { n: 1, d: 6, plus: 1 },
    score: 135,
    xp: 80,
    goldDrop: [2, 5],
    aggroRange: 300,
    color: '#a04a5e',
    accent: '#ffb0c8',
    warded: true,
    morale: true, // it is alive, and chaos is not loyalty
  },
  'bone-raker': {
    id: 'bone-raker',
    behavior: 'armored',
    hp: 11,
    speed: 66,
    size: 24,
    touchDamage: { n: 1, d: 8 },
    score: 150,
    xp: 88,
    goldDrop: [3, 6],
    aggroRange: 280,
    color: '#4a5aa0',
    accent: '#c8d4ff',
    warded: true,
    morale: true,
  },
  'shape-eater': {
    id: 'shape-eater',
    behavior: 'wraith',
    hp: 8,
    speed: 74,
    size: 22,
    touchDamage: { n: 1, d: 8 },
    score: 155,
    xp: 92,
    goldDrop: [2, 6],
    aggroRange: 300,
    color: '#6a4a86',
    accent: '#d8a8ff',
    warded: true,
    // Walks through what little the plane has settled on being.
  },

  // --- THE PIT: the legion. Ranks, discipline, and a bottomless supply.
  'pit-wretch': {
    id: 'pit-wretch',
    behavior: 'chase',
    hp: 5,
    speed: 40,
    size: 22,
    touchDamage: { n: 1, d: 4 },
    score: 70,
    xp: 40,
    goldDrop: [0, 2],
    aggroRange: 240,
    color: '#8a7a5a',
    accent: '#c8b890',
    // Neither warded nor morale-flagged: the lowest rank of the legion is
    // barely present enough to be afraid, and plain steel does for it. It is
    // the plane's chaff, and there is always more.
  },
  'barbed-sentinel': {
    id: 'barbed-sentinel',
    behavior: 'armored',
    hp: 13,
    speed: 58,
    size: 26,
    touchDamage: { n: 1, d: 8 }, // same ceiling as every other non-boss
    score: 160,
    xp: 94,
    goldDrop: [3, 7],
    aggroRange: 270,
    color: '#6a2a24',
    accent: '#ff8a5a',
    warded: true,
    // No morale: it is the rank that holds while the others are relieved.
  },
  'ash-harrier': {
    id: 'ash-harrier',
    behavior: 'ranged',
    hp: 7,
    speed: 96,
    size: 18,
    touchDamage: { n: 1, d: 4 },
    boltCause: 'harrier_dart',
    boltDamage: { n: 1, d: 6 },
    score: 125,
    xp: 74,
    goldDrop: [2, 5],
    aggroRange: 340,
    color: '#8a3a2a',
    accent: '#ffb066',
    warded: true,
    morale: true, // it is a skirmisher, and skirmishers know when to go
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

/**
 * Wave Q2 — a plane's population REPLACES the dungeon core rather than adding
 * to it. Nothing that crawls the Ember Depths has any business past the gate:
 * no slimes, no skeletons, no bats. Each plane fields exactly its own three,
 * and there are no floor gates — a hero only reaches a plane by ascending, so
 * the gate is the level cap, not the depth.
 */
const PLANE_SPAWN_ROWS: Record<string, readonly SpawnWeightRow[]> = {
  'silver-void': [
    { type: 'void-lancer', weight: 5 },
    { type: 'star-husk', weight: 3 },
    { type: 'mote-swarm', weight: 4 },
  ],
  'brass-marches': [
    { type: 'brass-warden', weight: 4 },
    { type: 'lantern-sentry', weight: 4 },
    { type: 'gear-hound', weight: 4 },
  ],
  churning: [
    { type: 'chaos-croaker', weight: 5 },
    { type: 'bone-raker', weight: 4 },
    { type: 'shape-eater', weight: 3 },
  ],
  'the-pit': [
    // The chaff outnumbers the ranks — that is what a legion looks like.
    { type: 'pit-wretch', weight: 6 },
    { type: 'barbed-sentinel', weight: 3 },
    { type: 'ash-harrier', weight: 4 },
  ],
};

export function spawnWeightsForFloor(floor: number, biomeId: string): SpawnWeightRow[] {
  // Wave Q2 — past the gate, the plane's own three and nothing else.
  const planar = PLANE_SPAWN_ROWS[biomeId];
  if (planar) return planar.map(row => ({ ...row }));

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
    // v4 Wave D — the deep terror: stone wings stir below floor 8.
    { type: 'gargoyle', weight: floor >= 8 ? 2 + Math.min(3, floor - 8) : 0 },
    // Wave P — deeper still: a light that walks, and is not a light.
    { type: 'lantern-wisp', weight: floor >= 10 ? 2 + Math.min(2, floor - 10) : 0 },
  ];

  // v3 — biome family: a heavy local presence, absent everywhere else.
  switch (biomeId) {
    case 'ember':
      rows.push({ type: 'fire-beetle', weight: 4 + Math.min(3, floor) });
      rows.push({ type: 'salamander', weight: floor >= 5 ? 3 : 0 });
      rows.push({ type: 'slag-thrall', weight: floor >= 3 ? 3 : 0 }); // Wave P
      break;
    case 'bone':
      rows.push({ type: 'zombie', weight: 5 });
      rows.push({ type: 'ghoul', weight: floor >= 5 ? 4 : 0 });
      rows.push({ type: 'bone-archer', weight: floor >= 4 ? 3 : 0 });
      rows.push({ type: 'barrow-hound', weight: floor >= 3 ? 3 : 0 }); // Wave P
      break;
    case 'sunken':
      rows.push({ type: 'deep-ooze', weight: 5 });
      rows.push({ type: 'lizardman', weight: floor >= 3 ? 3 + Math.min(3, floor - 3) : 0 });
      rows.push({ type: 'drowned-one', weight: floor >= 5 ? 4 : 0 });
      rows.push({ type: 'brine-weird', weight: floor >= 4 ? 3 : 0 }); // Wave P
      break;
    case 'ash':
      rows.push({ type: 'shade', weight: floor >= 4 ? 4 : 0 });
      rows.push({ type: 'cinder-hound', weight: floor >= 4 ? 4 : 0 });
      rows.push({ type: 'ember-wight', weight: floor >= 6 ? 3 : 0 });
      rows.push({ type: 'cinder-bloat', weight: floor >= 5 ? 3 : 0 }); // Wave P
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
  // Wave L — Guardian blows land as dice (rolled at the moment of impact).
  TOUCH_DAMAGE: { n: 1, d: 6, plus: 1 } as Dice,
  CHARGE_DAMAGE: { n: 2, d: 4 } as Dice,
  BOLT_DAMAGE: { n: 1, d: 4 } as Dice,
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
