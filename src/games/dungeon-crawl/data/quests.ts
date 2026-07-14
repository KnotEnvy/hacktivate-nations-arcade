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
  | 'the-cinder-regent'
  // v5 Wave G — THE LAST PAGE meta-saga chapters
  | 'the-blank-ledger'
  | 'the-ink-below'
  | 'the-underscribe';

export interface QuestDef {
  id: QuestId;
  name: string;
  blurb: string; // one line on the quest board card
  // v5 Wave G — the DM's briefing, shown through the interlude overlay at
  // departure (dismiss descends). Scene-setting, original, under 60 words.
  intro: string;
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
    intro:
      'Smoke climbs the well shafts at dusk, hotter every night. Something ' +
      'below is stoking the old warrens like a forge. Three floors down, ' +
      'find the stoker. Put it out.',
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
    intro:
      'The dead of four villages were laid in the galleries, and now the ' +
      'galleries count themselves. Ranks form in the dark. Break the muster ' +
      'before it learns to march upstairs.',
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
    intro:
      'The flood took the vaults a century ago; the patience down there ' +
      'took longer. What Lastlight lost still glitters under five floors of ' +
      'black water. Bring something back. Anything.',
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
    intro:
      'Past the cinder line the first flame keeps court, and its courtiers ' +
      'do not kneel to water or winter. Six floors of ash stand between you ' +
      'and the throne. Unseat it.',
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
    intro:
      'No contract, no reward, no floor marked LAST. The depths simply ' +
      'continue, and so may you, while your nerve and your torch hold. ' +
      'Glory keeps its own ledger. Descend.',
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
    intro:
      'The barrows above the warrens stand open — not robbed, TIDIED. ' +
      'Every grave swept, every door shut politely behind the leaving dead. ' +
      'Follow the boot prints down. Find where they filed to.',
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
    intro:
      'The column moves below Lastlight now, hundreds in step, none of ' +
      'them breathing. They march TO something, and marchers that orderly ' +
      'have orders. Trail the procession. Do not fall in.',
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
    intro:
      'A bell tolls under the galleries, patient as a heartbeat, calling ' +
      'roll for the dead. The keeper has begun collecting early — and your ' +
      'name is on its list. Answer in person.',
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
    intro:
      'The fire-keepers fed the ember before Lastlight had walls, and the ' +
      'feeding no longer takes. It is hungry, it is waking, and it ' +
      'remembers worship. Find the scar it breathes through.',
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
    intro:
      'The old order drowned their seal where no flame could follow, and ' +
      'the drowned things guard it still — with patience, not malice. ' +
      'Raise the quenching-stone. The fire is asking for its crown.',
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
    intro:
      'The court of cinders holds the last stair, and heat climbs it in ' +
      'slow pulses, like a drum before a crowning. Scatter the court. ' +
      'Break the gate. Hurry.',
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
    intro:
      'Below the broken gate the great stair glows forge-red. The Regent ' +
      'stands the coronation watch, and the crown is nearly cool enough to ' +
      'wear. You carry the sea in your pack. Answer with it.',
    floors: 6,
    biomeId: 'ash',
    bossTier: 5,
    minLevel: 9,
    rewardGold: 800,
    rewardXp: 1000,
    saga: true,
    bossKitId: 'cinder-regent',
  },
  // ---- THE LAST PAGE (meta-saga, 3 chapters — unlocks when both sagas are
  // TOLD; the game's final story and its reward crown) ----
  'the-blank-ledger': {
    id: 'the-blank-ledger',
    name: 'THE BLANK LEDGER',
    blurb: 'The Warden’s ledger still writes itself. Find it.',
    intro:
      'The Warden fell and its ledger was never found — until a barrow-' +
      'scribe’s satchel surfaced in the galleries, empty but for a smell of ' +
      'fresh ink. The book still writes itself somewhere below. Find the ' +
      'ledger. Read what it wants.',
    floors: 4,
    biomeId: 'bone',
    bossTier: 4,
    minLevel: 9,
    rewardGold: 500,
    rewardXp: 650,
    saga: true,
  },
  'the-ink-below': {
    id: 'the-ink-below',
    name: 'THE INK BELOW',
    blurb: 'Every entry, one black water. Follow the ink down.',
    intro:
      'Every entry in the ledger was written in the same black water that ' +
      'drowned the vaults. The well is real. It is deeper than the flood, ' +
      'and something tends it. Follow the ink down. Poison the well, or be ' +
      'written.',
    floors: 5,
    biomeId: 'sunken',
    bossTier: 5,
    minLevel: 10,
    rewardGold: 700,
    rewardXp: 850,
    saga: true,
  },
  'the-underscribe': {
    id: 'the-underscribe',
    name: 'THE UNDERSCRIBE',
    blurb: 'Whatever writes beneath the world is on its last page.',
    intro:
      'Below the ash, past every court and column, something has been ' +
      'writing Lastlight since before it had walls: the procession, the ' +
      'crowning — drafts in one patient hand. It is on its last page. So ' +
      'are you. Unwrite it.',
    floors: 6,
    biomeId: 'ash',
    bossTier: 6,
    minLevel: 10,
    rewardGold: 1000,
    rewardXp: 1200,
    saga: true,
    bossKitId: 'underscribe',
  },
};

export const ALL_QUEST_IDS = Object.keys(QUESTS) as QuestId[];

/** The classic board page: every quest that is not a saga chapter. */
export const STANDALONE_QUEST_IDS = ALL_QUEST_IDS.filter(id => !QUESTS[id].saga);
