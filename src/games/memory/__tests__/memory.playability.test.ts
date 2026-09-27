// Playability for Memory Match: put a player on the table and check the
// rules add up, rather than each holding alone.
//
// The bot is an AVERAGE player, not a perfect one: it remembers a card it
// has seen only some of the time, forgets a little every move, and takes a
// human second over each card. If a tuning change stops this player from
// climbing the ladder or finishing a timed table, the game got unfair
// rather than harder.

import { MemoryMatchGame } from '../MemoryMatchGame';
import { Card } from '../entities/Card';
import { TABLES } from '../systems/rules';
import { initGame, Harness } from '@/games/shared/gameTestHarness';

const DT = 1 / 30;

interface Internals {
  phase: string;
  tableIndex: number;
  cards: Card[];
  compare: unknown;
  reveal: unknown;
  score: number;
  pickups: number;
  results: Array<{ seconds: number; moves: number }>;
  beginRun(mode: 'classic' | 'timed', keyboard: boolean): void;
  pick(card: Card | null): boolean;
}

/** Seeded so each run of the suite plays the same games. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Outcome {
  tables: number;
  matches: number;
  score: number;
  coins: number;
  over: boolean;
}

/**
 * Play for `seconds` of game time. `recall` is the chance a seen card is
 * remembered; `think` is the seconds spent on each card.
 */
function play(
  mode: 'classic' | 'timed',
  seconds: number,
  recall: number,
  think: number,
  seed: number
): Outcome {
  const realRandom = Math.random;
  const rand = seeded(seed);
  Math.random = rand;
  try {
    const h: Harness = initGame(new MemoryMatchGame());
    const g = h.game as unknown as Internals;
    g.beginRun(mode, false);
    const memory = new Map<number, number>(); // card id -> value
    let table = -1;
    let wait = 0;
    let t = 0;
    let first: Card | null = null;

    const see = (c: Card) => {
      if (rand() < recall) memory.set(c.id, c.value);
    };

    while (t < seconds && !h.game.isGameOver?.()) {
      h.game.update(DT);
      t += DT;
      if (g.tableIndex !== table) {
        table = g.tableIndex;
        memory.clear();
      }
      if (g.phase !== 'play' || g.compare || g.reveal) continue;
      wait -= DT;
      if (wait > 0) continue;
      wait = think;

      const open = g.cards.filter(c => !c.matched);
      const known = (c: Card) => memory.has(c.id) && !c.faceUp;
      if (!first) {
        // A remembered pair first; else a card never seen.
        const byValue = new Map<number, Card[]>();
        for (const c of open.filter(known)) {
          byValue.set(c.value, [...(byValue.get(c.value) ?? []), c]);
        }
        const pair = [...byValue.values()].find(p => p.length === 2);
        const unseen = open.filter(c => !memory.has(c.id));
        const choice = pair
          ? pair[0]
          : (unseen[Math.floor(rand() * unseen.length)] ?? open[0]);
        if (g.pick(choice)) {
          see(choice);
          first = choice;
        }
      } else {
        const held = first;
        const partner = open.find(
          c => c !== held && known(c) && memory.get(c.id) === held.value
        );
        const unseen = open.filter(c => c !== held && !memory.has(c.id));
        const pool = unseen.length ? unseen : open.filter(c => c !== held);
        const choice = partner ?? pool[Math.floor(rand() * pool.length)];
        if (g.pick(choice)) see(choice);
        first = null;
        // A little forgetting every move.
        for (const id of [...memory.keys()]) {
          if (rand() < 0.03) memory.delete(id);
        }
      }
    }
    const matches = g.pickups;
    return {
      tables: g.results.length,
      matches,
      score: g.score,
      coins: Math.floor(g.score / 100) + matches * 10,
      over: h.game.isGameOver?.() ?? false,
    };
  } finally {
    Math.random = realRandom;
  }
}

describe('an average player', () => {
  it('climbs the whole CLASSIC ladder in a sitting', () => {
    for (const seed of [1, 2, 3]) {
      const o = play('classic', 15 * 60, 0.6, 1.1, seed);
      expect(o.tables).toBe(TABLES.length);
      expect(o.over).toBe(true);
    }
  });

  it('finishes the first TIMED tables with sand to spare', () => {
    for (const seed of [4, 5, 6]) {
      const o = play('timed', 3 * 60, 0.6, 1.1, seed);
      expect(o.tables).toBeGreaterThanOrEqual(2);
    }
  });

  it('cannot finish a TIMED table by guessing slowly', () => {
    // No memory at all and three seconds a card: the sand must win.
    const o = play('timed', 10 * 60, 0, 3, 7);
    expect(o.over).toBe(true);
    expect(o.tables).toBeLessThan(TABLES.length);
  });

  it('earns a bounded payout in a three-minute sitting', () => {
    // The payout the tier is balanced against: see RECAP.md.
    const runs = [11, 12, 13, 14, 15].map(seed =>
      play('classic', 3 * 60, 0.6, 1.1, seed)
    );
    for (const o of runs) {
      expect(o.coins).toBeGreaterThan(100);
      expect(o.coins).toBeLessThan(700);
    }
  });
});
