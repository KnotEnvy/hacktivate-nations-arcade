// ===== src/games/dungeon-crawl/data/bosses.ts =====
// v2 — three Guardian kits rotate as the player descends (boss tier 1/2/3,
// then the cycle repeats with the shared HP-per-tier scaling from BOSS).
// Boss.ts interprets the attack cycle; DungeonCrawlGame resolves effects.

import { EnemyTypeId } from './enemies';

export type BossAttackKind = 'charge' | 'spread' | 'summon' | 'slam' | 'teleport' | 'homing';

export interface BossKit {
  id: 'ember-guardian' | 'bone-colossus' | 'hollow-king';
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

/** Kit for a 1-based boss encounter number; cycles past the roster end. */
export function bossKitForTier(tier: number): BossKit {
  const idx = (((tier - 1) % BOSS_KITS.length) + BOSS_KITS.length) % BOSS_KITS.length;
  return BOSS_KITS[idx];
}
