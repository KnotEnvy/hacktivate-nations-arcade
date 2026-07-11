// ===== src/games/dungeon-crawl/data/sagas.ts =====
// v4 Wave C — Sagas & Stories. A saga is an authored arc of quest chapters
// unlocked in order on the board's saga page; short interludes play between
// chapters and the finale pins a unique boss kit (via the quest's bossKitId).
// Per-hero progress = chapters completed, saved additively on SavedHero.
// Pure data; all text original (module TONE, not text).

import { QuestId, QUESTS } from './quests';

export type SagaId = 'pale-procession' | 'undying-ember';

export interface SagaDef {
  id: SagaId;
  name: string;
  blurb: string; // one line on the saga card
  quests: readonly QuestId[]; // ordered chapters; last = finale
  // interludes[i] shows after completing chapter i; the last is the epilogue.
  interludes: readonly string[];
}

export const SAGAS: Record<SagaId, SagaDef> = {
  'pale-procession': {
    id: 'pale-procession',
    name: 'THE PALE PROCESSION',
    blurb: 'The dead walk in step below Lastlight. Someone calls the cadence.',
    quests: ['the-shallow-graves', 'the-silent-march', 'the-grave-warden'],
    interludes: [
      'The barrows stand open and swept, every grave tidied like a made bed. ' +
        'Chalk marks on the lintels count down: three, two. In the dust, boot ' +
        'prints — hundreds, all in step, all leading down. Whoever keeps these ' +
        'dead keeps them marching.',
      'You broke their column, and still they did not cry out. In the silence ' +
        'you heard it at last: a bell below, patient as a heartbeat, tolling ' +
        'the step. The Warden of the dead is calling roll. Somewhere in the ' +
        'galleries, your name is on the list.',
      'The bell lies cracked. The dead stand unmustered, drifting back to ' +
        'their alcoves like tired soldiers dismissed. Lastlight will not know ' +
        'what you spared it, and that is the shape of most victories. The ' +
        "Warden's ledger stays shut — though its last page was never found.",
    ],
  },
  'undying-ember': {
    id: 'undying-ember',
    name: 'THE UNDYING EMBER',
    blurb: 'The old fire beneath the deep ash remembers being worshipped.',
    quests: ['the-first-spark', 'the-quenching-vault', 'the-ash-gate', 'the-cinder-regent'],
    interludes: [
      'Beetle-light led you to the furnace scar, and the scar was breathing. ' +
        'Old fire-keeper sigils ring it — not wards, offerings. Someone fed ' +
        'the ember since before Lastlight raised its walls. The feeding has ' +
        'stopped working. It is hungry, and it remembers being fed better.',
      'The vault gave up its seal: a quenching-stone, still weeping cold ' +
        'water in your pack. The drowned things guarded it without malice, ' +
        'almost with relief. Carved on its rim, in the old tongue: WHEN THE ' +
        'FIRE ASKS FOR A CROWN, ANSWER WITH THE SEA.',
      'The gate stands broken behind you, its cinder court scattered to ' +
        'sparks. Below, the great stair glows like a forge chimney. Heat ' +
        'climbs it in slow pulses — a coronation drum. The Regent has begun ' +
        'the crowning. There is no one left to send but you.',
      'The quenching-stone broke as it was made to, and the deep went dark ' +
        'for the first time in an age. In Lastlight they only say the nights ' +
        'feel longer, and the forge-smoke smells clean. The ember is not ' +
        'dead. But it is cold, and it is patient, and so are you.',
    ],
  },
};

export const ALL_SAGA_IDS = Object.keys(SAGAS) as SagaId[];

/** The saga a quest belongs to, with its 0-based chapter index — or null. */
export function sagaChapterForQuest(
  questId: QuestId,
): { saga: SagaDef; chapter: number } | null {
  for (const id of ALL_SAGA_IDS) {
    const chapter = SAGAS[id].quests.indexOf(questId);
    if (chapter >= 0) return { saga: SAGAS[id], chapter };
  }
  return null;
}

/** Chapters completed for a hero's saga progress map (absent = 0). */
export function chaptersDone(
  progress: Partial<Record<SagaId, number>> | undefined,
  sagaId: SagaId,
): number {
  const done = progress?.[sagaId] ?? 0;
  return Math.max(0, Math.min(done, SAGAS[sagaId].quests.length));
}

/** The next chapter quest a hero may depart on, or null when the saga is done. */
export function currentChapter(
  progress: Partial<Record<SagaId, number>> | undefined,
  sagaId: SagaId,
): QuestId | null {
  const saga = SAGAS[sagaId];
  const done = chaptersDone(progress, sagaId);
  return done >= saga.quests.length ? null : saga.quests[done];
}

/* Sanity: every chapter id must exist in QUESTS (compile-time via QuestId,
   runtime guard for the interlude pairing). */
for (const id of ALL_SAGA_IDS) {
  const saga = SAGAS[id];
  if (saga.interludes.length !== saga.quests.length) {
    throw new Error(`saga ${id}: interludes must pair 1:1 with chapters`);
  }
  for (const q of saga.quests) {
    if (!QUESTS[q]?.saga) throw new Error(`saga ${id}: chapter ${q} not saga-flagged`);
  }
}
