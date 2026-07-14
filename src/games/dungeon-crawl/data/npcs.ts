// ===== src/games/dungeon-crawl/data/npcs.ts =====
// v5 Wave G — the townsfolk of Lastlight. Five named regulars of THE LAST
// LANTERN, each with rumor pools keyed by the hero's STORY STAGE — a pure
// function of level + saga progress (STATELESS: no save field; the same hero
// always hears the same era of gossip, rolled from the live rng at the bar).
// Rumors are the DM's voice: hints ride existing systems, teasers point at
// the next chapter. Pure data; all text original.

import { chaptersDone, SagaId, ALL_SAGA_IDS, SAGAS, metaUnlocked, allSagasTold } from './sagas';

export type NpcId = 'hollis' | 'mother-tallow' | 'cask' | 'pip' | 'the-quiet-scribe';

/**
 * The town's narrative era, derived from the hero:
 *  - arrival:   a fresh legend — tavern basics and first warnings.
 *  - delving:   a proven delver — deeper hints, saga murmurs.
 *  - the-page:  both sagas TOLD — every rumor bends toward the missing page.
 *  - aftermath: THE LAST PAGE is told — Lastlight breathes out.
 */
export type StoryStage = 'arrival' | 'delving' | 'the-page' | 'aftermath';

export const NPC_TUNING = {
  DELVING_LEVEL: 4, // the town starts treating the hero as a delver here
} as const;

export function storyStage(
  hero: { level: number; sagas: Partial<Record<SagaId, number>> } | null,
): StoryStage {
  if (!hero) return 'arrival';
  if (allSagasTold(hero.sagas)) return 'aftermath';
  if (metaUnlocked(hero.sagas)) return 'the-page';
  const provenByDeeds = ALL_SAGA_IDS.some(
    id => !SAGAS[id].meta && chaptersDone(hero.sagas, id) > 0,
  );
  if (hero.level >= NPC_TUNING.DELVING_LEVEL || provenByDeeds) return 'delving';
  return 'arrival';
}

export interface NpcDef {
  id: NpcId;
  name: string;
  title: string; // one line under the name
  icon: string; // glyph on the patron card
  color: string;
  rumors: Record<StoryStage, readonly string[]>;
}

export const NPCS: Record<NpcId, NpcDef> = {
  hollis: {
    id: 'hollis',
    name: 'HOLLIS',
    title: 'KEEPER OF THE LAST LANTERN',
    icon: '⌂',
    color: '#ffb85c',
    rumors: {
      arrival: [
        'First one is on the house. The second you earn — the board pays honest gold for honest work.',
        'Sleep here, spend there. The smith’s steel outlives you. My stew will not. Buy both.',
        'The gate only opens downward, friend. Lastlight is the last light. Remember that when you are deep.',
      ],
      delving: [
        'You have the look of the deep roads now. The alchemist packs kit for folk who plan on coming back.',
        'Bank your gold before you brag about it. The depths hear brags as invitations.',
        'A delver paid in strange coin last night. Said the walls whisper where they are thinnest.',
      ],
      'the-page': [
        'Two tales told, and the lamps still gutter at the same hour every night. Something is still keeping time.',
        'The lodger in the corner room asked for more candles again. Never food. Just candles and ink.',
        'You have done what no delver has done. So why does the board creak like it is holding one more notice?',
      ],
      aftermath: [
        'The nights feel shorter. Do not ask me how a night can be shorter. It just is.',
        'The corner room is paid through winter and the bed was never slept in. I am letting it stay empty.',
        'Whatever you did down there — the lamps burn cleaner for it. First one is on the house. Always.',
      ],
    },
  },
  'mother-tallow': {
    id: 'mother-tallow',
    name: 'MOTHER TALLOW',
    title: 'THE CANDLE-MAKER',
    icon: '❈',
    color: '#e8d8a8',
    rumors: {
      arrival: [
        'A candle leans before it dies. Watch your torchlight, child — the dark below watches back.',
        'Spit on the coin you find in an open chest. Some chests have teeth.',
        'Carry wax in your ears past the third floor. Or do not. The bells find you either way.',
      ],
      delving: [
        'Where a wall weeps cold air, there is a room behind it. Fire opens what patience cannot.',
        'Read no scroll you cannot name. Then read it anyway. That is what delvers are for.',
        'The dead below walk in rows, child. Rows mean a keeper. Keepers keep lists.',
      ],
      'the-page': [
        'I dipped wicks for the scribe’s candles. The wax came back written on. I do not read that hand.',
        'Both your tales ended a page short, did they not. Endings that end are rarer than you think.',
        'The bell is cracked and the ember is cold, and still my candles lean toward the gate.',
      ],
      aftermath: [
        'My candles stand straight now. Forty years dipping wicks and they never once stood straight.',
        'You closed the book, child. Mind — closed is not burned. Keep a light by your bed.',
      ],
    },
  },
  cask: {
    id: 'cask',
    name: 'CASK',
    title: 'DELVER, RETIRED',
    icon: '†',
    color: '#b0713a',
    rumors: {
      arrival: [
        'Knights take it on the shield. Walk around them — or put a dagger past the rim.',
        'When the floor clicks, you have a breath before the points come up. Use the breath.',
        'Dash THROUGH, not away. The blink of it keeps the teeth off you. Cost me three fingers to learn.',
      ],
      delving: [
        'Hit them from behind and they fold quicker. A thieves’ trick, but a sword does not judge.',
        'The glittering ones fall heavy — gold, and sometimes better than gold. Worth the extra scar.',
        'The bomber lobs his little pot: do not run from the ring, run past it.',
      ],
      'the-page': [
        'I fought everything down there in my day. Never fought whatever writes the day down. Glad it is you.',
        'The Warden kept lists. The Regent kept court. Somebody kept THEM. That is the fight left.',
        'Take the long quests with a full pack and an empty satchel. You will want the room.',
      ],
      aftermath: [
        'You went where the ink comes from and walked back out. I would drink to you if Hollis poured deeper.',
        'Three fingers I left below, and it still owes me. Tell it Cask says so, next time you are down.',
      ],
    },
  },
  pip: {
    id: 'pip',
    name: 'PIP',
    title: 'THE POTBOY',
    icon: '♨',
    color: '#7ae0a8',
    rumors: {
      arrival: [
        'A delver swears the Guardians carry treasure now! Real finds! Wearable ones! Cross my heart!',
        'Do not tell Hollis, but I saw a rat steal a whole candle. Straight down the well. STRAIGHT DOWN.',
        'The smith can make your boots faster. FASTER. BOOTS.',
      ],
      delving: [
        'They say past the eighth floor something flies through the dark with a face like a chimney!',
        'A lady paid her tab with a ring she found in an URN. An urn! I checked ours. Just dust.',
        'If a wall has cracks in it, delvers blow it up! On purpose! I want to be a delver.',
      ],
      'the-page': [
        'The quiet man’s candle burns GREEN some nights. I watched through the keyhole. Green!',
        'Everyone says you finished both stories! Nobody finishes both! What happens NOW?',
      ],
      aftermath: [
        'You are the one from the stories now. Both of them. All THREE of them!',
        'The quiet man left me his spare inkwell. It is empty. It is my favorite thing I own.',
      ],
    },
  },
  'the-quiet-scribe': {
    id: 'the-quiet-scribe',
    name: 'THE QUIET SCRIBE',
    title: 'A LODGER WHO WRITES',
    icon: '✎',
    color: '#9a7bff',
    rumors: {
      arrival: [
        'Every town below a mountain is a margin note. Lastlight’s note is longer than most. Keep it so.',
        'You will do things worth writing, down there. Whether they are written well is not up to you.',
      ],
      delving: [
        'The dead march in order. Fires ask for crowns. Order and hunger — every story is one or the other.',
        'I write what happens. Lately, what happens feels... already written. Forgive me. Ink talk.',
      ],
      'the-page': [
        'Two endings, and under both the same hand, and under the hand — a page no one has found. Find it.',
        'Ask the board for what is unwritten. It will know what you mean. It has always known.',
      ],
      aftermath: [
        'The hand is stopped. The story is yours now — plainly yours. Mind what you do with the pen.',
        'I came to Lastlight to finish a book. It is finished. I find I do not want to leave the ending.',
      ],
    },
  },
};

export const ALL_NPC_IDS = Object.keys(NPCS) as NpcId[];
