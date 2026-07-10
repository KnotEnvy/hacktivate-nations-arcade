// ===== src/games/dungeon-crawl/data/quests.ts =====
// v4 Wave B — the quest board of Lastlight. Each quest is an authored
// expedition: a fixed biome arc, a floor count whose FINAL floor is the boss
// arena, and banked-gold + XP rewards on completion. 'endless' preserves the
// classic descent (bosses every 3rd floor, no end). Pure data; the game and
// generator consume it deterministically. All text original.

export type QuestId =
  | 'embers-below'
  | 'bone-galleries'
  | 'sunken-vaults'
  | 'ashen-court'
  | 'endless';

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
};

export const ALL_QUEST_IDS = Object.keys(QUESTS) as QuestId[];
