// ===== src/games/dungeon-crawl/data/sagas.ts =====
// v4 Wave C — Sagas & Stories. A saga is an authored arc of quest chapters
// unlocked in order on the board's saga page; short interludes play between
// chapters and the finale pins a unique boss kit (via the quest's bossKitId).
// Per-hero progress = chapters completed, saved additively on SavedHero.
// Pure data; all text original (module TONE, not text).

import { QuestId, QUESTS } from './quests';

export type SagaId = 'pale-procession' | 'undying-ember' | 'the-last-page';

export interface SagaDef {
  id: SagaId;
  name: string;
  blurb: string; // one line on the saga card
  quests: readonly QuestId[]; // ordered chapters; last = finale
  // interludes[i] shows after completing chapter i; the last is the epilogue.
  interludes: readonly string[];
  // v5 Wave G — a meta arc: hidden from the board until every non-meta saga
  // is TOLD (metaUnlocked). Progress rides the same per-hero sagas map.
  meta?: boolean;
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
  // v5 Wave G — the meta-saga: hidden until both tales above are TOLD. Both
  // arcs planted it (the Warden's unfound last page; the ember's patient
  // author) — this is the hand beneath them, and the game's final story.
  'the-last-page': {
    id: 'the-last-page',
    name: 'THE LAST PAGE',
    blurb: 'Both tales ended a page short. Someone is still writing.',
    quests: ['the-blank-ledger', 'the-ink-below', 'the-underscribe'],
    meta: true,
    interludes: [
      'The Warden’s ledger, found at last — and it is still keeping itself. ' +
        'Names appear in a slow, patient hand: every soul in Lastlight, in ' +
        'order of their leaving. The last page has been torn away. The tear ' +
        'is fresh. The ink trail leads down, and it is still wet.',
      'Beneath the vaults a spring of black water rises through the drowned ' +
        'dark, and the water is ink. Words form and unform in its current. ' +
        'You saw your own name surface, half-written, and sink again. The ' +
        'hand that owns this well writes from below the ash. Go end the ' +
        'sentence.',
      'The Underscribe is stopped, its pen split, its great page blank. It ' +
        'only ever recorded what WOULD be, and it hated to be wrong. Above, ' +
        'Lastlight’s lamps burn clean and the board hangs empty. You keep ' +
        'the blank last page rolled in your pack. Write it yourself.',
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

/** True when a saga is TOLD (every chapter complete) for this progress map. */
export function sagaTold(
  progress: Partial<Record<SagaId, number>> | undefined,
  sagaId: SagaId,
): boolean {
  return chaptersDone(progress, sagaId) >= SAGAS[sagaId].quests.length;
}

/** v5 Wave G — every NON-meta saga TOLD: the hidden last page may be found. */
export function metaUnlocked(progress: Partial<Record<SagaId, number>> | undefined): boolean {
  return ALL_SAGA_IDS.filter(id => !SAGAS[id].meta).every(id => sagaTold(progress, id));
}

/** v5 Wave G — every saga TOLD, meta arcs included (the story is over). */
export function allSagasTold(progress: Partial<Record<SagaId, number>> | undefined): boolean {
  return ALL_SAGA_IDS.every(id => sagaTold(progress, id));
}

/** The sagas a hero's board (and sheet) may show — locked metas stay hidden. */
export function visibleSagaIds(
  progress: Partial<Record<SagaId, number>> | undefined,
): SagaId[] {
  return ALL_SAGA_IDS.filter(id => !SAGAS[id].meta || metaUnlocked(progress));
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
