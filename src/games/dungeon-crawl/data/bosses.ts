// ===== src/games/dungeon-crawl/data/bosses.ts =====
// v2 — three Guardian kits rotate as the player descends (boss tier 1/2/3,
// then the cycle repeats with the shared HP-per-tier scaling from BOSS).
// v4 Wave C — unique saga-finale kits live BESIDE the rotation (never in it),
// summoned only by a quest's explicit bossKitId.
// Boss.ts interprets the attack cycle; DungeonCrawlGame resolves effects.

import { EnemyTypeId } from './enemies';

export type BossAttackKind = 'charge' | 'spread' | 'summon' | 'slam' | 'teleport' | 'homing';

export type BossKitId =
  | 'ember-guardian'
  | 'bone-colossus'
  | 'hollow-king'
  // v4 Wave C — saga finale uniques
  | 'grave-warden'
  | 'cinder-regent'
  // v5 Wave G — THE LAST PAGE finale
  | 'underscribe'
  // Wave P — the two new per-biome saga finales
  | 'flood-cantor'
  | 'grey-effigy'
  // Wave Q2 — THE PLANES: one lord per plane, plus what waits at the road's end
  | 'silver-lance'
  | 'brass-arbiter'
  | 'shapeless-crown'
  | 'pit-marshal'
  | 'the-quiet-beyond';

export interface BossKit {
  id: BossKitId;
  name: string;
  // Attack rotation, cycled in order (summon is skipped at the minion cap).
  attackCycle: readonly BossAttackKind[];
  summons: readonly EnemyTypeId[];
  // Multipliers on the shared BOSS baseline.
  hpMult: number;
  speedMult: number;
  // Retro sprite colors.
  bodyColor: string;
  enragedColor: string;
  helmColor: string;
  crackColor: string;
  eyeColor: string;
}

export const BOSS_KITS: readonly BossKit[] = [
  {
    id: 'ember-guardian',
    name: 'EMBER GUARDIAN',
    attackCycle: ['charge', 'spread', 'charge', 'summon'],
    summons: ['skeleton', 'bat'],
    hpMult: 1,
    speedMult: 1,
    bodyColor: '#6e2c1a',
    enragedColor: '#8f2f16',
    helmColor: '#2e1a12',
    crackColor: '#ff7a1a',
    eyeColor: '#ffc94d',
  },
  {
    id: 'bone-colossus',
    name: 'BONE COLOSSUS',
    attackCycle: ['slam', 'summon', 'slam', 'spread'],
    summons: ['skeleton', 'skeleton', 'bat'],
    hpMult: 1.3,
    speedMult: 0.8,
    bodyColor: '#a99f8a',
    enragedColor: '#c4b494',
    helmColor: '#4d4536',
    crackColor: '#e8dcbc',
    eyeColor: '#7fd7ff',
  },
  {
    id: 'hollow-king',
    name: 'HOLLOW KING',
    attackCycle: ['teleport', 'homing', 'teleport', 'summon'],
    summons: ['wraith', 'bat'],
    hpMult: 0.9,
    speedMult: 1.1,
    bodyColor: '#3a2d52',
    enragedColor: '#553a78',
    helmColor: '#191024',
    crackColor: '#9a7bff',
    eyeColor: '#e8d8ff',
  },
];

// v4 Wave C — saga finale uniques. NOT part of the tier rotation: adding here
// never shifts which Guardian a classic floor rolls.
export const UNIQUE_BOSS_KITS: readonly BossKit[] = [
  {
    id: 'grave-warden',
    name: 'THE GRAVE WARDEN',
    attackCycle: ['summon', 'slam', 'spread', 'slam'],
    summons: ['zombie', 'ghoul', 'skeleton'],
    hpMult: 1.15,
    speedMult: 0.85,
    bodyColor: '#7a7462',
    enragedColor: '#96865e',
    helmColor: '#3a3627',
    crackColor: '#b7e29a',
    eyeColor: '#a8ff9e',
  },
  {
    id: 'cinder-regent',
    name: 'THE CINDER REGENT',
    attackCycle: ['teleport', 'spread', 'homing', 'summon'],
    summons: ['cinder-hound', 'shade'],
    hpMult: 1.25,
    speedMult: 1.05,
    bodyColor: '#4a3230',
    enragedColor: '#7a2f14',
    helmColor: '#241614',
    crackColor: '#ffb347',
    eyeColor: '#ffd166',
  },
  // v5 Wave G — the author under the world: ink-dark, parchment-cracked,
  // read by candlelight. The game's hardest kit (tier 6 via its quest).
  {
    id: 'underscribe',
    name: 'THE UNDERSCRIBE',
    attackCycle: ['teleport', 'summon', 'homing', 'slam'],
    summons: ['shade', 'wraith'],
    hpMult: 1.35,
    speedMult: 1,
    bodyColor: '#232030',
    enragedColor: '#3d2b55',
    helmColor: '#12101c',
    crackColor: '#e8dcc0',
    eyeColor: '#fff3c4',
  },
  // Wave P — THE DROWNED CHOIR's finale: a standing column of black water that
  // keeps the beat. It calls its congregation and answers in waves.
  {
    id: 'flood-cantor',
    name: 'THE FLOOD CANTOR',
    attackCycle: ['summon', 'spread', 'slam', 'spread'],
    summons: ['drowned-one', 'brine-weird', 'deep-ooze'],
    hpMult: 1.2,
    speedMult: 0.95,
    bodyColor: '#1e4a5c',
    enragedColor: '#2f7a8f',
    helmColor: '#10262f',
    crackColor: '#bfe8f6',
    eyeColor: '#e8fbff',
  },
  // Wave P — THE ASH THAT REMEMBERS' finale: everything the fire took, pressed
  // back into one shape. It comes apart and reassembles somewhere else.
  {
    id: 'grey-effigy',
    name: 'THE GREY EFFIGY',
    attackCycle: ['teleport', 'slam', 'summon', 'charge'],
    summons: ['cinder-bloat', 'shade', 'ember-wight'],
    hpMult: 1.3,
    speedMult: 0.9,
    bodyColor: '#6e6a63',
    enragedColor: '#8d857a',
    helmColor: '#33302c',
    crackColor: '#ffb347',
    eyeColor: '#ffe0a8',
  },

  // ===== Wave Q2 — THE PLANES: the lords =====
  // One per plane, each fighting the way its plane thinks. Every one of them
  // summons ONLY its own plane's natives — a lord that called on the dungeon's
  // dead would undo the whole point of a separate population.
  {
    // THE SILVER LANCE: the Void's first raider, and still its best. It does
    // not hide, because on its plane no one can.
    id: 'silver-lance',
    name: 'THE SILVER LANCE',
    attackCycle: ['charge', 'spread', 'charge', 'summon'],
    summons: ['void-lancer', 'mote-swarm'],
    hpMult: 1.35,
    speedMult: 1.15,
    bodyColor: '#5d6b85',
    enragedColor: '#8ea6cc',
    helmColor: '#2b3245',
    crackColor: '#e8f2ff',
    eyeColor: '#ffffff',
  },
  {
    // THE BRASS ARBITER: it does not rage, it RULES. Slow, immovable, and it
    // never once takes a step backward — the Marches do not permit it.
    id: 'brass-arbiter',
    name: 'THE BRASS ARBITER',
    attackCycle: ['slam', 'summon', 'slam', 'spread'],
    summons: ['brass-warden', 'lantern-sentry', 'gear-hound'],
    hpMult: 1.45,
    speedMult: 0.8,
    bodyColor: '#7a5c1e',
    enragedColor: '#b8862a',
    helmColor: '#2e2410',
    crackColor: '#ffd98a',
    eyeColor: '#fff6d8',
  },
  {
    // THE SHAPELESS CROWN: a crown with nothing under it, wearing whatever is
    // nearest. It teleports because standing still would be a commitment.
    id: 'shapeless-crown',
    name: 'THE SHAPELESS CROWN',
    attackCycle: ['teleport', 'summon', 'homing', 'teleport'],
    summons: ['chaos-croaker', 'shape-eater', 'bone-raker'],
    hpMult: 1.4,
    speedMult: 1.1,
    bodyColor: '#5b3a72',
    enragedColor: '#8f4fb0',
    helmColor: '#2a1838',
    crackColor: '#f0c8ff',
    eyeColor: '#ffe4ff',
  },
  {
    // THE PIT MARSHAL: it fights like an officer, not a monster — it spends
    // its ranks first and comes forward only when they are gone.
    id: 'pit-marshal',
    name: 'THE PIT MARSHAL',
    attackCycle: ['summon', 'spread', 'summon', 'charge'],
    summons: ['pit-wretch', 'barbed-sentinel', 'ash-harrier'],
    hpMult: 1.45,
    speedMult: 0.95,
    bodyColor: '#5c211b',
    enragedColor: '#a33a24',
    helmColor: '#2a0d0a',
    crackColor: '#ff8a5a',
    eyeColor: '#ffc48a',
  },
  {
    // THE QUIET BEYOND: what the road ends at. Not a ruler of any plane — the
    // thing all four are arranged around, which has been waiting for someone
    // to walk far enough to be worth answering. The game's last fight.
    id: 'the-quiet-beyond',
    name: 'THE QUIET BEYOND',
    attackCycle: ['teleport', 'summon', 'spread', 'slam', 'homing'],
    summons: ['star-husk', 'shape-eater', 'barbed-sentinel'],
    hpMult: 1.6,
    speedMult: 1,
    bodyColor: '#14161f',
    enragedColor: '#2b2f45',
    helmColor: '#080910',
    crackColor: '#cfe3ff',
    eyeColor: '#ffffff',
  },
];

/** Kit for a 1-based boss encounter number; cycles past the roster end. */
export function bossKitForTier(tier: number): BossKit {
  const idx = (((tier - 1) % BOSS_KITS.length) + BOSS_KITS.length) % BOSS_KITS.length;
  return BOSS_KITS[idx];
}

/** Any kit — rotating or unique — by id (saga finales pin theirs by id). */
export function bossKitById(id: BossKitId): BossKit {
  return (
    BOSS_KITS.find(k => k.id === id) ??
    UNIQUE_BOSS_KITS.find(k => k.id === id) ??
    bossKitForTier(1)
  );
}
