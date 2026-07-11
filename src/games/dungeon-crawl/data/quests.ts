// ===== src/games/dungeon-crawl/data/quests.ts =====
// v4 Wave B — the quest board of Lastlight. Each quest is an authored
// expedition: a fixed biome arc, a floor count whose FINAL floor is the boss
// arena, and banked-gold + XP rewards on completion. 'endless' preserves the
// classic descent (bosses every 3rd floor, no end). Pure data; the game and
// generator consume it deterministically. All text original.
// v4 Wave C — saga chapters are quests too (`saga: true`): they live off the
// classic board page (STANDALONE_QUEST_IDS) and are reached through their
// saga's page instead. A finale may pin a unique boss via bossKitId.

import type { BossKitId } from './bosses';

export type QuestId =
  | 'embers-below'
  | 'bone-galleries'
  | 'sunken-vaults'
  | 'ashen-court'
  | 'endless'
  // v4 Wave C — THE PALE PROCESSION chapters
  | 'the-shallow-graves'
  | 'the-silent-march'
  | 'the-grave-warden'
  // v4 Wave C — THE UNDYING EMBER chapters
  | 'the-first-spark'
  | 'the-quenching-vault'
  | 'the-ash-gate'
  | 'the-cinder-regent';

export interface QuestDef {
  id: QuestId;
  name: string;
  blurb: string; // one line on the quest board card
  floors: number; // final floor = boss arena; 0 = endless (classic rules)
  biomeId: string | null; // fixed biome for the run; null = classic cycle
  bossTier: number; // Boss tier for the final arena (kit rotates, hp scales)
  minLevel: number; // advisory — the board warns below this, never blocks
  rewardGold: number; // banked on completion
  rewardXp: number;
  saga?: boolean; // chapter of a saga — off the classic board page
  bossKitId?: BossKitId; // pins a unique kit for the final arena
}

export const QUESTS: Record<QuestId, QuestDef> = {
  'embers-below': {
    id: 'embers-below',
    name: 'EMBERS BELOW',
    blurb: 'Something stokes the old warrens. Put it out.',
    floors: 3,
    biomeId: 'ember',
    bossTier: 1,
    minLevel: 1,
    rewardGold: 100,
    rewardXp: 120,
  },
  'bone-galleries': {
    id: 'bone-galleries',
    name: 'THE BONE GALLERIES',
    blurb: 'The dead are filing themselves into ranks. Break them.',
    floors: 4,
    biomeId: 'bone',
    bossTier: 2,
    minLevel: 3,
    rewardGold: 200,
    rewardXp: 250,
  },
  'sunken-vaults': {
    id: 'sunken-vaults',
    name: 'THE SUNKEN VAULTS',
    blurb: 'Flooded halls, patient things. Bring back what was lost.',
    floors: 5,
    biomeId: 'sunken',
    bossTier: 3,
    minLevel: 5,
    rewardGold: 350,
    rewardXp: 400,
  },
  'ashen-court': {
    id: 'ashen-court',
    name: 'THE ASHEN COURT',
    blurb: 'The first flame holds court in the deep ash. Unseat it.',
    floors: 6,
    biomeId: 'ash',
    bossTier: 4,
    minLevel: 7,
    rewardGold: 500,
    rewardXp: 600,
  },
  endless: {
    id: 'endless',
    name: 'THE ENDLESS DEPTHS',
    blurb: 'No end, no reward but glory. How deep can you go?',
    floors: 0,
    biomeId: null,
    bossTier: 0,
    minLevel: 1,
    rewardGold: 0,
    rewardXp: 0,
  },
  // ---- THE PALE PROCESSION (saga, 3 chapters) ----
  'the-shallow-graves': {
    id: 'the-shallow-graves',
    name: 'THE SHALLOW GRAVES',
    blurb: 'Empty barrows above the warrens. Find where the dead have gone.',
    floors: 2,
    biomeId: 'bone',
    bossTier: 1,
    minLevel: 2,
    rewardGold: 90,
    rewardXp: 110,
    saga: true,
  },
  'the-silent-march': {
    id: 'the-silent-march',
    name: 'THE SILENT MARCH',
    blurb: 'Follow the processional down. Do not join it.',
    floors: 3,
    biomeId: 'bone',
    bossTier: 2,
    minLevel: 3,
    rewardGold: 170,
    rewardXp: 210,
    saga: true,
  },
  'the-grave-warden': {
    id: 'the-grave-warden',
    name: 'THE GRAVE WARDEN',
    blurb: 'The keeper of the dead has begun collecting early.',
    floors: 4,
    biomeId: 'bone',
    bossTier: 3,
    minLevel: 4,
    rewardGold: 320,
    rewardXp: 380,
    saga: true,
    bossKitId: 'grave-warden',
  },
  // ---- THE UNDYING EMBER (saga, 4 chapters) ----
  'the-first-spark': {
    id: 'the-first-spark',
    name: 'THE FIRST SPARK',
    blurb: 'The warrens burn hotter each night. Find what feeds them.',
    floors: 3,
    biomeId: 'ember',
    bossTier: 2,
    minLevel: 6,
    rewardGold: 220,
    rewardXp: 260,
    saga: true,
  },
  'the-quenching-vault': {
    id: 'the-quenching-vault',
    name: 'THE QUENCHING VAULT',
    blurb: 'The old order drowned their seal for safekeeping. Raise it.',
    floors: 4,
    biomeId: 'sunken',
    bossTier: 3,
    minLevel: 7,
    rewardGold: 320,
    rewardXp: 400,
    saga: true,
  },
  'the-ash-gate': {
    id: 'the-ash-gate',
    name: 'THE ASH GATE',
    blurb: 'The court of cinders bars the last stair. Scatter it.',
    floors: 5,
    biomeId: 'ash',
    bossTier: 4,
    minLevel: 8,
    rewardGold: 450,
    rewardXp: 550,
    saga: true,
  },
  'the-cinder-regent': {
    id: 'the-cinder-regent',
    name: 'THE CINDER REGENT',
    blurb: 'Unseat the regent before the ember takes its crown.',
    floors: 6,
    biomeId: 'ash',
    bossTier: 5,
    minLevel: 9,
    rewardGold: 800,
    rewardXp: 1000,
    saga: true,
    bossKitId: 'cinder-regent',
  },
};

export const ALL_QUEST_IDS = Object.keys(QUESTS) as QuestId[];

/** The classic board page: every quest that is not a saga chapter. */
export const STANDALONE_QUEST_IDS = ALL_QUEST_IDS.filter(id => !QUESTS[id].saga);
