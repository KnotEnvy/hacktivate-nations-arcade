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
  | 'underscribe';

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
