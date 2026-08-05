// ===== src/games/dungeon-crawl/data/sagas.ts =====
// v4 Wave C — Sagas & Stories. A saga is an authored arc of quest chapters
// unlocked in order on the board's saga page; short interludes play between
// chapters and the finale pins a unique boss kit (via the quest's bossKitId).
// Per-hero progress = chapters completed, saved additively on SavedHero.
// Pure data; all text original (module TONE, not text).

import { QuestId, QUESTS } from './quests';

export type SagaId =
  | 'pale-procession'
  | 'undying-ember'
  // Wave P — a tale per biome: the sunken vaults and the deep ash get theirs.
  | 'drowned-choir'
  | 'ash-remembers'
  | 'the-last-page'
  // Wave Q2 — the capstone arc, told past the gate.
  | 'ascendants-road';

/** Wave P — how Lastlight dresses itself while an arc is live (view only). */
export interface SagaDressing {
  color: string; // the arc's cloth; tints the town's torchlight
  accent: string; // its trim
  banner: string; // the line the town is muttering (arrival sub-line)
}

export interface SagaDef {
  id: SagaId;
  name: string;
  blurb: string; // one line on the saga card
  quests: readonly QuestId[]; // ordered chapters; last = finale
  // interludes[i] shows after completing chapter i; the last is the epilogue.
  interludes: readonly string[];
  // v5 Wave G — a meta arc: hidden from the board until every FOUNDING saga
  // is TOLD (metaUnlocked). Progress rides the same per-hero sagas map.
  meta?: boolean;
  // Wave P — the two arcs that were here when the meta gate was written. The
  // gate reads THIS, not `!meta`, so later arcs can never re-lock a last page
  // a veteran already earned.
  founding?: boolean;
  // Wave Q2 — told past the gate. A planar arc never appears on Lastlight's
  // board or on the character sheet's saga list (the town cannot see another
  // world); the Waydoor shows it, and only to a hero who has ascended.
  planar?: boolean;
  dressing: SagaDressing;
}

export const SAGAS: Record<SagaId, SagaDef> = {
  'pale-procession': {
    id: 'pale-procession',
    name: 'THE PALE PROCESSION',
    blurb: 'The dead walk in step below Lastlight. Someone calls the cadence.',
    quests: ['the-shallow-graves', 'the-silent-march', 'the-grave-warden'],
    founding: true,
    dressing: {
      color: '#b7e29a',
      accent: '#e8f0d8',
      banner: 'A BELL BELOW IS COUNTING',
    },
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
    founding: true,
    dressing: {
      color: '#ff8c3a',
      accent: '#ffd24a',
      banner: 'THE OLD FIRE IS AWAKE',
    },
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
  // Wave P — THE DROWNED CHOIR: the sunken vaults' own tale, and the mid-game
  // arc the board was missing. The two new tales sit AHEAD of the meta arc so
  // the capstone still reads last on the board.
  'drowned-choir': {
    id: 'drowned-choir',
    name: 'THE DROWNED CHOIR',
    blurb: 'The flood has learned a tune, and the drowned have learned to stand still.',
    dressing: {
      color: '#5fc6e8',
      accent: '#bfe8f6',
      banner: 'THE WATER IS SINGING',
    },
    quests: ['the-listening-shallows', 'the-hall-of-hymns', 'the-flood-cantor'],
    interludes: [
      'They were not waiting for you. Every drowned thing in the shallows ' +
        'stood facing the same downward dark, patient as pews, and none of ' +
        'them turned until you were among them. Whatever they are listening ' +
        'to, it is below — and it has been holding their attention for a ' +
        'hundred years.',
      'The hall was built for a choir and the flood took it mid-hymn. The ' +
        'water there stands in ridges, the way air stands when a low note ' +
        'runs through it, and the ridges keep time. You have heard the ' +
        'measure now. You will hear it in Lastlight, when the taps run and ' +
        'when the rain starts.',
      'The measure is broken and the vaults are only flooded rooms again. ' +
        'The drowned drift where the current takes them, unattended at last. ' +
        'One thing keeps you awake: the cantor was keeping time for someone, ' +
        'the way a musician watches a hand — and the hand was not in the ' +
        'water.',
    ],
  },
  // Wave P — THE ASH THAT REMEMBERS: the deep ash's own tale, for heroes who
  // have already unseated one crown down there.
  'ash-remembers': {
    id: 'ash-remembers',
    name: 'THE ASH THAT REMEMBERS',
    blurb: 'Ash keeps the shape of what it burned. Something is putting a shape back.',
    dressing: {
      color: '#c9c2b6',
      accent: '#ffb347',
      banner: 'THE ASH IS GATHERING ITSELF',
    },
    quests: ['the-grey-drifts', 'the-unburnt-door', 'the-grey-effigy'],
    interludes: [
      'Ash falls. It does not climb. You followed it uphill for four floors ' +
        'anyway, grey rivers running the wrong way over the stair, and where ' +
        'they gathered they held their shape: a wheel, a rail, half a ' +
        'doorway. The deep is not scattering what it burned. It is sorting ' +
        'it.',
      'The room behind the unburnt door was laid for supper. Table, cups, a ' +
        'banked fire — and at every chair a person-shaped weight of ash, ' +
        'sitting, waiting to be told they could begin. You did not disturb ' +
        'them. Down the far stair the drifts run heavier, toward whatever is ' +
        'setting the table.',
      'The effigy came apart in a grey wind and the hall it stood in ' +
        'forgot, all at once, that it had ever been a city. What is left is ' +
        'ash, and ash is only ash. Still — it had a face by the end, and it ' +
        'was nearly a good one. Someone taught it what to remember.',
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
    dressing: {
      color: '#e8dcc0',
      accent: '#9a7bff',
      banner: 'SOMETHING IS STILL WRITING',
    },
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
  // Wave Q2 — THE ASCENDANT'S ROAD: what an ascended hero walks. Deliberately
  // NOT founding (Wave P's veteran promise: a hero who earned THE LAST PAGE
  // must never have it taken back) and NOT meta (it gates on the rite, not on
  // other tales). It is simply somewhere else, and the town cannot see it.
  'ascendants-road': {
    id: 'ascendants-road',
    name: "THE ASCENDANT'S ROAD",
    blurb: 'Four worlds, arranged around something. Walk far enough to be worth answering.',
    planar: true,
    dressing: {
      color: '#cfe3ff',
      accent: '#b96bff',
      banner: 'THE GATE STANDS OPEN',
    },
    quests: [
      'the-first-step-out',
      'the-measured-mile',
      'the-unmaking-yard',
      'the-quiet-beyond',
    ],
    interludes: [
      'You came up out of twenty levels of dark into a day with no sun in ' +
        'it, and stood there long enough to be embarrassed. Nothing hid from ' +
        'you. Nothing could. Whatever put a lance in each of those islands ' +
        'wanted to be found — and having found it, you understand the ' +
        'invitation was never yours to accept or decline.',
      'The Marches read out a list for eleven hours and never once repeated ' +
        'a name. Yours was on it, far down, in the same hand as the rest. Not ' +
        'a threat: an ENTRY. Somewhere there is a clerk who has been ' +
        'expecting you since before Lastlight was walled, and who has already ' +
        'ruled on what you are.',
      'The yard was rows of drafts of things, and you walked most of a row ' +
        'that was drafts of you: shorter, older, one with the wrong number of ' +
        'hands, one that had clearly done better. You put none of them out of ' +
        'their misery, which you will think about later. The finished one was ' +
        'not in the yard. It is further on.',
      'It answered. Not in words — the four planes turned out to be four ways ' +
        'of saying one sentence slowly enough for a mortal to hear. Then it ' +
        'was quiet, and the quiet was ordinary. You walked back down every ' +
        'terrace and out into Lastlight at dusk, where someone lighting the ' +
        'lamps did not look up. Nothing lies further out. There is still ' +
        'tomorrow.',
    ],
  },
};

export const ALL_SAGA_IDS = Object.keys(SAGAS) as SagaId[];

/** Wave Q2 — the arcs told past the gate (the Waydoor's road page). */
export const PLANAR_SAGA_IDS = ALL_SAGA_IDS.filter(id => SAGAS[id].planar);

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

/**
 * v5 Wave G — every FOUNDING saga TOLD: the hidden last page may be found.
 *
 * Wave P — the gate reads `founding`, NOT `!meta`. Arcs added after the meta
 * saga shipped are side-tales: they must never re-lock a last page a veteran
 * already earned, and they must never make the capstone harder to reach than
 * it was the day it was written.
 */
export function metaUnlocked(progress: Partial<Record<SagaId, number>> | undefined): boolean {
  return ALL_SAGA_IDS.filter(id => SAGAS[id].founding).every(id => sagaTold(progress, id));
}

/** v5 Wave G — every saga TOLD, side-tales included (the board is empty). */
export function allSagasTold(progress: Partial<Record<SagaId, number>> | undefined): boolean {
  return ALL_SAGA_IDS.every(id => sagaTold(progress, id));
}

/**
 * Wave P — the CORE story told: the founding arcs and the meta arc that crowns
 * them. This, not `allSagasTold`, is what "the story is over" means — the
 * townsfolk reached their aftermath the day the last page was written, and a
 * side-tale added years later must never walk them back a stage.
 */
export function storyComplete(progress: Partial<Record<SagaId, number>> | undefined): boolean {
  return ALL_SAGA_IDS.filter(id => SAGAS[id].founding || SAGAS[id].meta).every(id =>
    sagaTold(progress, id),
  );
}

/**
 * The sagas a hero's board (and sheet) may show — locked metas stay hidden.
 * Wave Q2 — and PLANAR arcs never appear here at all: Lastlight's board is
 * Lastlight's, and the road is told somewhere the town cannot see. The Waydoor
 * lists it instead (PLANAR_SAGA_IDS), gated on the rite rather than on tales.
 */
export function visibleSagaIds(
  progress: Partial<Record<SagaId, number>> | undefined,
): SagaId[] {
  return ALL_SAGA_IDS.filter(
    id => !SAGAS[id].planar && (!SAGAS[id].meta || metaUnlocked(progress)),
  );
}

/**
 * Wave P — the arc Lastlight is currently living through: started, not yet
 * finished. Pure and stateless (the storyStage precedent) — the town's dressing
 * reads it every frame and nothing is ever saved. Ties break in declaration
 * order, so the town's cloth never flickers between two live tales.
 */
export function liveSagaId(
  progress: Partial<Record<SagaId, number>> | undefined,
): SagaId | null {
  for (const id of ALL_SAGA_IDS) {
    const done = chaptersDone(progress, id);
    if (done > 0 && done < SAGAS[id].quests.length) return id;
  }
  return null;
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

/* Wave P — the meta gate must always have something to gate on. */
if (!ALL_SAGA_IDS.some(id => SAGAS[id].founding)) {
  throw new Error('sagas: at least one founding saga must exist for the meta gate');
}
