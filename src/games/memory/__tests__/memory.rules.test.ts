// Rules for Memory Match.
//
// These pin the RULES of the table, not its tuning. Each block names the bug
// that was live before the polish pass:
//
//   * input was level-triggered: a held button turned every card the cursor
//     crossed, and a drag turned two cards at once
//   * digit keys and M were polled every frame (a held "2" rebuilt the board
//     sixty times a second)
//   * the base HUD was drawn over the top-left card
//   * the flip animation advanced inside render at a fixed 1/60
//   * hint / reveal used setTimeout and could undo a flip the player made
//   * level time came from Date.now()
//   * the run ended after one board
//   * fast_completion / perfect_levels were computed for the whole run as
//     if it were one level

import { MemoryMatchGame } from '../MemoryMatchGame';
import {
  BOTTOM_BAND,
  Card,
  GridLayout,
  TOP_BAND,
  faceTarget,
} from '../entities/Card';
import { HudRenderer } from '../systems/HudRenderer';
import { Effects } from '../systems/Effects';
import {
  CLEAR_TIME,
  FINALE_TIME,
  FLIP_TIME,
  HINT_COOLDOWN,
  MISMATCH_HOLD,
  PEEK_HOLD,
  READY_TIME,
  TABLES,
  TableResult,
  fastestUnder30,
  matchPoints,
  parBonus,
  perfectCount,
  timeBonus,
} from '../systems/rules';
import { initGame, Harness } from '@/games/shared/gameTestHarness';

const DT = 1 / 60;

/** The private surface these tests reach through. */
interface MemoryInternals {
  phase: string;
  phaseT: number;
  mode: 'classic' | 'timed';
  tableIndex: number;
  cards: Card[];
  picks: Card[];
  compare: unknown;
  reveal: unknown;
  peekUsed: boolean;
  hintCooldown: number;
  streak: number;
  tableMoves: number;
  totalMoves: number;
  tableSeconds: number;
  timeLeft: number;
  matchesMade: number;
  results: TableResult[];
  score: number;
  pickups: number;
  renderBaseHud: boolean;
  cursorOn: boolean;
  cursor: { row: number; col: number };
  hud: HudRenderer;
  layout: GridLayout;
  fx: Effects;
  beginRun(mode: 'classic' | 'timed', keyboard: boolean): void;
  startTable(index: number): void;
  usePeek(): boolean;
  useHint(): boolean;
  pick(card: Card | null): boolean;
}

/** A fake input device the tests can press, hold and click. */
interface Rig {
  h: Harness;
  g: MemoryInternals;
  held: Set<string>;
  mouse: { x: number; y: number; down: boolean };
  frames(n: number): void;
  seconds(s: number): void;
  press(code: string): void;
  click(x: number, y: number, holdFrames?: number): void;
  clickCard(c: Card): void;
  tap(x: number, y: number): void;
}

function rig(): Rig {
  const h = initGame(new MemoryMatchGame());
  const g = h.game as unknown as MemoryInternals;
  const held = new Set<string>();
  const mouse = { x: 0, y: 0, down: false };
  const input = h.services.input as unknown as Record<string, unknown>;
  input.isKeyPressed = (code: string) => held.has(code);
  input.isMousePressed = (b = 0) => b === 0 && mouse.down;
  input.getMousePosition = () => ({ x: mouse.x, y: mouse.y });
  const touches: Array<{ id: number; x: number; y: number }> = [];
  input.getTouches = () => touches.map(t => ({ ...t }));

  const frames = (n: number) => {
    for (let i = 0; i < n; i++) {
      h.game.update(DT);
      h.game.render(h.ctx);
    }
  };
  const r: Rig = {
    h,
    g,
    held,
    mouse,
    frames,
    seconds: s => frames(Math.round(s / DT)),
    press: code => {
      held.add(code);
      frames(1);
      held.delete(code);
      frames(1);
    },
    click: (x, y, holdFrames = 3) => {
      mouse.x = x;
      mouse.y = y;
      mouse.down = true;
      frames(holdFrames);
      mouse.down = false;
      frames(1);
    },
    clickCard: c => r.click(c.x + c.w / 2, c.y + c.h / 2),
    tap: (x, y) => {
      touches.push({ id: 1, x, y });
      frames(3);
      touches.length = 0;
      frames(1);
    },
  };
  return r;
}

/** Start a run in `mode` and step through the deal and the ready beat. */
function playing(mode: 'classic' | 'timed' = 'classic', keyboard = false): Rig {
  const r = rig();
  r.g.beginRun(mode, keyboard);
  toPlay(r);
  return r;
}

function toPlay(r: Rig): void {
  for (let i = 0; i < 600 && r.g.phase !== 'play'; i++) r.frames(1);
  expect(r.g.phase).toBe('play');
}

function partnerOf(g: MemoryInternals, c: Card): Card {
  const p = g.cards.find(x => x !== c && x.value === c.value);
  if (!p) throw new Error('no partner');
  return p;
}

function mismatchPair(g: MemoryInternals): [Card, Card] {
  const free = g.cards.filter(c => !c.matched && !c.faceUp);
  const a = free[0];
  const b = free.find(c => c.value !== a.value);
  if (!b) throw new Error('no mismatch available');
  return [a, b];
}

/** Turn two cards and wait until the table is open again. */
function turn(r: Rig, a: Card, b: Card): void {
  expect(r.g.pick(a)).toBe(true);
  expect(r.g.pick(b)).toBe(true);
  for (let i = 0; i < 200 && r.g.compare !== null; i++) r.frames(1);
}

/** Solve the current table with perfect play plus `misses` mismatches. */
function solve(r: Rig, misses = 0, waitSeconds = 0): void {
  if (waitSeconds > 0) r.seconds(waitSeconds);
  for (let i = 0; i < misses; i++) {
    const [a, b] = mismatchPair(r.g);
    turn(r, a, b);
  }
  while (r.g.phase === 'play') {
    const a = r.g.cards.find(c => !c.matched) as Card;
    turn(r, a, partnerOf(r.g, a));
  }
}

function waitForTable(r: Rig, index: number): void {
  for (
    let i = 0;
    i < 600 && !(r.g.tableIndex === index && r.g.phase === 'play');
    i++
  ) {
    r.frames(1);
  }
  expect(r.g.tableIndex).toBe(index);
  expect(r.g.phase).toBe('play');
}

// ====================================================================== input

describe('input is edge-triggered', () => {
  it('turns a card once, on release, however long the button is held', () => {
    const r = playing();
    const c = r.g.cards[0];
    r.mouse.x = c.x + c.w / 2;
    r.mouse.y = c.y + c.h / 2;
    r.mouse.down = true;
    r.frames(45);
    expect(c.faceUp).toBe(false);
    r.mouse.down = false;
    r.frames(1);
    expect(c.faceUp).toBe(true);
    expect(r.g.picks).toEqual([c]);
    r.frames(10);
    expect(r.g.picks).toHaveLength(1);
  });

  it('never turns a card when a press is dragged across the table', () => {
    const r = playing();
    const [a, b, c] = r.g.cards;
    r.mouse.x = a.x + a.w / 2;
    r.mouse.y = a.y + a.h / 2;
    r.mouse.down = true;
    r.frames(2);
    for (const card of [b, c]) {
      r.mouse.x = card.x + card.w / 2;
      r.mouse.y = card.y + card.h / 2;
      r.frames(3);
    }
    r.mouse.down = false;
    r.frames(1);
    expect(r.g.cards.some(x => x.faceUp)).toBe(false);
  });

  it('turns a card on a finger tap, and a PEEK plate tap uses peek', () => {
    const r = playing();
    const c = r.g.cards[7];
    r.tap(c.x + c.w / 2, c.y + c.h / 2);
    expect(c.faceUp).toBe(true);
    r.frames(2);
    const { peek } = r.g.hud.plates();
    r.tap(peek.x + peek.w / 2, peek.y + peek.h / 2);
    expect(r.g.peekUsed).toBe(true);
  });

  it('does not let a key held from the shell Start skip the mode choice', () => {
    const r = rig();
    r.held.add('Enter');
    r.frames(20);
    expect(r.g.phase).toBe('mode');
    r.held.clear();
    r.frames(1);
    r.press('ArrowRight');
    r.press('Enter');
    expect(r.g.phase).toBe('deal');
    expect(r.g.mode).toBe('timed');
  });

  it('starts a run from a click on a mode ticket', () => {
    const r = rig();
    const { classic } = r.g.hud.modeTickets();
    r.click(classic.x + 20, classic.y + 20);
    expect(r.g.phase).toBe('deal');
    expect(r.g.mode).toBe('classic');
    expect(localStorage.getItem('memory_last_mode')).toBe('classic');
  });

  it('ignores the old digit presets and the hidden M toggle', () => {
    const r = playing();
    const before = r.g.cards;
    const layout = r.g.layout;
    for (const k of ['Digit1', 'Digit2', 'Digit3', 'KeyM']) r.held.add(k);
    r.frames(60);
    r.held.clear();
    expect(r.g.cards).toBe(before);
    expect(r.g.layout).toBe(layout);
    expect(r.g.mode).toBe('classic');
  });

  it('fires a held H once, not every frame', () => {
    const r = playing();
    r.g.score = 1000;
    r.held.add('KeyH');
    r.frames(Math.round(2 / DT));
    r.held.clear();
    expect(r.g.score).toBe(985);
  });

  it('moves a keyboard cursor with the arrows and turns with Space', () => {
    const r = playing('classic', true);
    expect(r.g.cursorOn).toBe(true);
    r.press('ArrowRight');
    r.press('ArrowDown');
    r.press('Space');
    const cols = TABLES[0].cols;
    const target = r.g.cards[1 * cols + 1];
    expect(target.faceUp).toBe(true);
    expect(r.g.picks).toEqual([target]);
  });
});

// ==================================================================== layout

describe('chrome', () => {
  it('turns the base HUD off and keeps every table between the rails', () => {
    const r = rig();
    expect(r.g.renderBaseHud).toBe(false);
    r.g.beginRun('classic', false);
    TABLES.forEach((def, i) => {
      r.g.startTable(i);
      expect(r.g.cards).toHaveLength(def.rows * def.cols);
      for (const c of r.g.cards) {
        expect(c.y).toBeGreaterThanOrEqual(TOP_BAND);
        expect(c.y + c.h).toBeLessThanOrEqual(600 - BOTTOM_BAND);
        expect(c.x).toBeGreaterThanOrEqual(0);
        expect(c.x + c.w).toBeLessThanOrEqual(800);
      }
      // The power-up plates sit in the bottom band, clear of the cards.
      const { peek, hint } = r.g.hud.plates();
      for (const p of [peek, hint]) {
        expect(p.y).toBeGreaterThanOrEqual(600 - BOTTOM_BAND);
        expect(p.y + p.h).toBeLessThanOrEqual(600);
      }
    });
  });

  it('never draws a headline figure as a bare zero in the display face', () => {
    // Orbitron's lone 0 reads as a slashed O; the rail shows a dash instead.
    const r = rig();
    const ctx = r.h.ctx as unknown as Record<string, unknown>;
    const drawn: Array<{ text: string; font: string }> = [];
    const real = ctx.fillText as (...a: unknown[]) => void;
    ctx.fillText = (text: string, ...rest: unknown[]) => {
      drawn.push({ text, font: String(ctx.font) });
      real(text, ...rest);
    };
    try {
      r.frames(2); // the mode card
      r.g.beginRun('timed', false);
      toPlay(r);
      r.frames(2); // a fresh table: score 0, moves 0
      const bareZeros = drawn.filter(
        d => d.text === '0' && !d.font.includes('monospace')
      );
      expect(bareZeros).toEqual([]);
      expect(drawn.some(d => d.text === '—')).toBe(true);
    } finally {
      ctx.fillText = real;
    }
  });

  it('keeps effects capped', () => {
    const fx = new Effects();
    for (let i = 0; i < 50; i++) {
      fx.confetti(400, 300, 40);
      fx.sparksAt(400, 300, 40);
      fx.ring(400, 300, 40);
    }
    expect(fx.count()).toBeLessThanOrEqual(12 + 120 + 90);
  });
});

// ================================================================ timekeeping

describe('time is dt, not the wall clock', () => {
  it('advances the flip in update, not in render', () => {
    const r = playing();
    const c = r.g.cards[0];
    r.g.pick(c);
    const before = c.shown;
    for (let i = 0; i < 100; i++) r.h.game.render(r.h.ctx);
    expect(c.shown).toBe(before);
    r.h.game.update(DT);
    expect(c.shown).toBeGreaterThan(before);
  });

  it('never touches setTimeout or Date.now while a table is played', () => {
    const r = playing();
    const timeout = jest.spyOn(global, 'setTimeout');
    const now = jest.spyOn(Date, 'now');
    try {
      r.g.score = 500;
      r.g.useHint();
      r.seconds(2);
      r.g.usePeek();
      r.seconds(2);
      solve(r, 1);
      r.seconds(CLEAR_TIME + 3);
      expect(timeout).not.toHaveBeenCalled();
      expect(now).not.toHaveBeenCalled();
    } finally {
      timeout.mockRestore();
      now.mockRestore();
    }
  });

  it('times a table in play seconds only', () => {
    const r = playing();
    r.seconds(5);
    solve(r);
    const result = r.g.results[0];
    expect(result.seconds).toBeGreaterThan(5);
    expect(result.seconds).toBeLessThan(10);
  });
});

// ============================================================ compare & match

describe('turning two cards', () => {
  it('keeps a matched pair and scores it', () => {
    const r = playing();
    const a = r.g.cards[0];
    const b = partnerOf(r.g, a);
    r.g.pick(a);
    r.g.pick(b);
    expect(r.g.tableMoves).toBe(1);
    r.seconds(FLIP_TIME + 0.05);
    expect(a.matched && b.matched).toBe(true);
    expect(r.g.score).toBe(matchPoints(0));
    expect(r.g.pickups).toBe(1);
    expect(r.g.streak).toBe(1);
  });

  it('turns a mismatch back after the hold, and not before', () => {
    const r = playing();
    const [a, b] = mismatchPair(r.g);
    r.g.pick(a);
    r.g.pick(b);
    r.seconds(FLIP_TIME + MISMATCH_HOLD - 0.1);
    expect(a.faceUp && b.faceUp).toBe(true);
    r.seconds(0.15);
    expect(a.faceUp || b.faceUp).toBe(false);
    expect(r.g.streak).toBe(0);
    expect(r.g.picks).toHaveLength(0);
  });

  it('pays 100 plus 20 per match already in the streak', () => {
    const r = playing();
    for (let i = 0; i < 3; i++) {
      const a = r.g.cards.find(c => !c.matched) as Card;
      turn(r, a, partnerOf(r.g, a));
    }
    expect(r.g.score).toBe(100 + 120 + 140);
    const [x, y] = mismatchPair(r.g);
    turn(r, x, y);
    expect(r.g.streak).toBe(0);
  });

  it('never turns a matched card again', () => {
    const r = playing();
    const a = r.g.cards[0];
    const b = partnerOf(r.g, a);
    turn(r, a, b);
    r.clickCard(a);
    expect(r.g.picks).toHaveLength(0);
    expect(r.g.pick(a)).toBe(false);
    r.g.usePeek();
    expect(a.peeked).toBe(false);
    expect(a.matched).toBe(true);
    r.seconds(PEEK_HOLD + FLIP_TIME * 2 + 0.1);
    for (let i = 0; i < 6; i++) {
      r.g.hintCooldown = 0;
      r.g.useHint();
      expect(a.peeked || b.peeked).toBe(false);
      r.seconds(1);
    }
  });
});

// ======================================================== locked sequences ==

describe('no input is accepted during deal, compare or peek', () => {
  it('ignores clicks and power-ups while the cards are being dealt', () => {
    const r = rig();
    r.g.beginRun('classic', false);
    expect(r.g.phase).toBe('deal');
    r.frames(5);
    const c = r.g.cards[r.g.cards.length - 1];
    r.clickCard(c);
    r.press('KeyP');
    r.press('KeyH');
    r.press('Space');
    expect(r.g.phase).toBe('deal');
    expect(r.g.cards.some(x => x.faceUp || x.peeked)).toBe(false);
    expect(r.g.peekUsed).toBe(false);
  });

  it('ignores a third card and the power-ups while a pair is compared', () => {
    const r = playing();
    const [a, b] = mismatchPair(r.g);
    r.clickCard(a);
    r.clickCard(b);
    expect(r.g.compare).not.toBeNull();
    const third = r.g.cards.find(c => c !== a && c !== b) as Card;
    r.clickCard(third);
    r.press('KeyP');
    r.press('KeyH');
    expect(third.faceUp).toBe(false);
    expect(r.g.peekUsed).toBe(false);
    expect(r.g.hintCooldown).toBe(0);
  });

  it('ignores clicks while a peek is showing the table', () => {
    const r = playing();
    r.press('KeyP');
    expect(r.g.reveal).not.toBeNull();
    const c = r.g.cards[3];
    r.clickCard(c);
    expect(c.faceUp).toBe(false);
    r.seconds(PEEK_HOLD + FLIP_TIME * 2 + 0.05);
    expect(r.g.reveal).toBeNull();
    r.clickCard(c);
    expect(c.faceUp).toBe(true);
  });
});

// ============================================================ PEEK and HINT ==

describe('peek and hint', () => {
  it('allows one peek per table and charges for it', () => {
    const r = playing();
    r.g.score = 200;
    expect(r.g.usePeek()).toBe(true);
    expect(r.g.score).toBe(170);
    r.seconds(PEEK_HOLD + FLIP_TIME * 2 + 0.1);
    expect(r.g.usePeek()).toBe(false);
    expect(r.g.score).toBe(170);
    solve(r);
    waitForTable(r, 1);
    expect(r.g.usePeek()).toBe(true);
  });

  it('holds the hint behind its cooldown', () => {
    const r = playing();
    r.g.score = 200;
    expect(r.g.useHint()).toBe(true);
    expect(r.g.score).toBe(185);
    r.seconds(1.5);
    expect(r.g.useHint()).toBe(false);
    r.seconds(HINT_COOLDOWN - 1.5 - 0.2);
    expect(r.g.useHint()).toBe(false);
    r.seconds(0.4);
    expect(r.g.useHint()).toBe(true);
  });

  it('never takes the score below zero', () => {
    const r = playing();
    r.g.usePeek();
    expect(r.g.score).toBe(0);
  });

  it('restores exactly the face state it found (peek)', () => {
    const r = playing();
    const a = r.g.cards[0];
    const b = partnerOf(r.g, a);
    turn(r, a, b);
    const held = r.g.cards.find(c => !c.matched) as Card;
    r.clickCard(held);
    const snap = () =>
      r.g.cards.map(c => [c.faceUp, c.matched, faceTarget(c)].join());
    const before = snap();
    expect(r.g.usePeek()).toBe(true);
    r.seconds(FLIP_TIME + 0.1);
    expect(r.g.cards.every(c => faceTarget(c))).toBe(true);
    r.seconds(PEEK_HOLD + FLIP_TIME + 0.1);
    expect(snap()).toEqual(before);
    expect(held.faceUp).toBe(true);
    expect(r.g.picks).toEqual([held]);
  });

  it('restores exactly the face state it found (hint), and shows the held card its partner', () => {
    const r = playing();
    const held = r.g.cards[4];
    r.clickCard(held);
    const snap = () =>
      r.g.cards.map(c => [c.faceUp, c.matched, faceTarget(c)].join());
    const before = snap();
    expect(r.g.useHint()).toBe(true);
    r.seconds(FLIP_TIME + 0.05);
    const shown = r.g.cards.filter(c => c.peeked);
    expect(shown).toEqual([partnerOf(r.g, held)]);
    r.seconds(1.5);
    expect(snap()).toEqual(before);
    expect(held.faceUp).toBe(true);
    // The table is open again and the held card can still be paired.
    r.clickCard(partnerOf(r.g, held));
    r.seconds(FLIP_TIME + 0.05);
    expect(held.matched).toBe(true);
  });
});

// ================================================================== ladder ==

describe('the ladder', () => {
  it('climbs 3x4, 4x4, 4x5, 5x6, 6x6 and ends the run after the last', () => {
    const r = playing();
    const grids: string[] = [];
    for (let i = 0; i < TABLES.length; i++) {
      waitForTable(r, i);
      const l = r.g.layout;
      grids.push(`${l.rows}x${l.cols}`);
      expect(r.g.cards).toHaveLength(l.rows * l.cols);
      solve(r);
    }
    expect(grids).toEqual(['3x4', '4x4', '4x5', '5x6', '6x6']);
    expect(r.g.phase).toBe('finale');
    // The run-end beat plays before endGame.
    expect(r.h.game.isGameOver?.()).toBe(false);
    r.seconds(FINALE_TIME + 0.1);
    expect(r.h.game.isGameOver?.()).toBe(true);
    const s = r.h.game.getScore?.() as unknown as Record<string, number>;
    expect(s.levels_completed).toBe(5);
    expect(s.matches_made).toBe(6 + 8 + 10 + 15 + 18);
    expect(s.perfect_levels).toBe(5);
  });

  it('ends a won run on the win, and a timed-out run on the default', () => {
    const r = playing();
    for (let i = 0; i < TABLES.length; i++) {
      waitForTable(r, i);
      solve(r);
    }
    const play = r.h.services.audio.playSound as jest.Mock;
    play.mockClear();
    r.seconds(FINALE_TIME + 0.1);
    expect(r.h.game.isGameOver?.()).toBe(true);
    expect(play.mock.calls.map(c => c[0])).toEqual(['win']);
    expect(r.h.services.analytics.trackGameEnd).toHaveBeenLastCalledWith(
      'memory',
      expect.any(Number),
      expect.any(Number),
      'completed'
    );

    // restart() puts the defaults back for the next run.
    r.h.game.restart?.();
    r.g.beginRun('timed', false);
    toPlay(r);
    r.g.timeLeft = 0.05;
    r.seconds(0.1);
    play.mockClear();
    r.seconds(FINALE_TIME + 0.1);
    expect(r.h.game.isGameOver?.()).toBe(true);
    expect(play.mock.calls.map(c => c[0])).toEqual(['game_over']);
    expect(r.h.services.analytics.trackGameEnd).toHaveBeenLastCalledWith(
      'memory',
      expect.any(Number),
      expect.any(Number),
      'died'
    );
  });

  it('lets the table-clear beat play before the next deal', () => {
    const r = playing();
    solve(r);
    expect(r.g.phase).toBe('clear');
    r.seconds(CLEAR_TIME - 0.2);
    expect(r.g.tableIndex).toBe(0);
    r.seconds(0.3);
    expect(r.g.tableIndex).toBe(1);
    expect(r.g.phase).toBe('deal');
  });

  it('ends the ready beat on the first input, or within two seconds', () => {
    const r = rig();
    r.g.beginRun('classic', false);
    for (let i = 0; i < 600 && r.g.phase !== 'ready'; i++) r.frames(1);
    expect(READY_TIME).toBeLessThanOrEqual(2);
    r.seconds(READY_TIME + 0.05);
    expect(r.g.phase).toBe('play');

    const r2 = rig();
    r2.g.beginRun('classic', false);
    for (let i = 0; i < 600 && r2.g.phase !== 'ready'; i++) r2.frames(1);
    const c = r2.g.cards[2];
    r2.clickCard(c);
    expect(r2.g.phase).toBe('play');
    expect(c.faceUp).toBe(true);
  });

  it('pays the par bonus and the time bonus on a clear', () => {
    const r = playing();
    solve(r, 0, 10);
    const res = r.g.results[0];
    const matches = [0, 1, 2, 3, 4, 5].reduce((s, k) => s + matchPoints(k), 0);
    expect(res.atPar).toBe(true);
    expect(res.parBonus).toBe(parBonus(1, res.moves, TABLES[0].par));
    expect(res.timeBonus).toBe(timeBonus(TABLES[0].clock, res.seconds));
    expect(r.g.score).toBe(matches + res.parBonus + res.timeBonus);
  });

  it('keeps the legacy bests key per grid and mode', () => {
    const r = playing();
    solve(r, 2);
    const raw = localStorage.getItem('memory_bests_3x4_classic');
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw as string).leastMoves).toBe(8);
  });
});

// ================================================================== timed ==

describe('timed mode', () => {
  it('ends the run when the clock reaches zero, keeping the score', () => {
    const r = playing('timed');
    expect(r.g.timeLeft).toBe(TABLES[0].clock);
    const a = r.g.cards[0];
    turn(r, a, partnerOf(r.g, a));
    const earned = r.g.score;
    expect(earned).toBeGreaterThan(0);
    r.g.timeLeft = 0.5;
    r.seconds(0.6);
    expect(r.g.phase).toBe('finale');
    expect(r.h.game.isGameOver?.()).toBe(false);
    r.seconds(FINALE_TIME + 0.1);
    expect(r.h.game.isGameOver?.()).toBe(true);
    expect(r.h.game.getScore?.().score).toBe(earned);
  });

  it('holds the clock during the deal and the table-clear beat', () => {
    const r = playing('timed');
    solve(r);
    expect(r.g.phase).toBe('clear');
    const left = r.g.timeLeft;
    expect(left).toBeLessThan(TABLES[0].clock);
    r.seconds(CLEAR_TIME - 0.2);
    expect(r.g.timeLeft).toBe(left);
    r.seconds(0.4);
    expect(r.g.phase).toBe('deal');
    r.seconds(0.5);
    expect(r.g.timeLeft).toBe(TABLES[1].clock);
  });
});

// ============================================================ achievements ==

describe('per-table stats for achievements', () => {
  it('counts perfect_levels per table at par, not for the whole run', () => {
    const r = playing();
    solve(r); // table 1 at par
    waitForTable(r, 1);
    solve(r, TABLES[1].par - TABLES[1].pairs + 1); // one move over par
    waitForTable(r, 2);
    solve(r, 2); // under par
    waitForTable(r, 3);
    r.h.game.destroy?.();
    const s = r.h.game.getScore?.() as unknown as Record<string, number>;
    expect(s.levels_completed).toBe(3);
    expect(s.perfect_levels).toBe(2);
    expect(perfectCount(r.g.results)).toBe(2);
    expect(s.total_moves).toBe(r.g.totalMoves);
  });

  it('reports fast_completion as the fastest table under 30s', () => {
    const r = playing();
    solve(r, 0, 20); // ~21s
    waitForTable(r, 1);
    solve(r, 0, 12); // ~13s
    waitForTable(r, 2);
    solve(r, 0, 40); // ~41s
    waitForTable(r, 3);
    r.h.game.destroy?.();
    const s = r.h.game.getScore?.() as unknown as Record<string, number>;
    const times = r.g.results.map(x => x.seconds);
    expect(s.fast_completion).toBeCloseTo(times[1], 1);
    expect(s.fast_completion).toBeLessThan(30);
    expect(s.fast_tables).toBe(2);
    expect(s.completion_time).toBeGreaterThanOrEqual(
      times[0] + times[1] + times[2] - 0.01
    );
  });

  it('reports 0 for fast_completion when no table was under 30s', () => {
    expect(
      fastestUnder30([
        { seconds: 31 } as TableResult,
        { seconds: 45 } as TableResult,
      ])
    ).toBe(0);
  });
});

// ================================================================ restart ==

describe('restart', () => {
  it('returns to the mode card with every timer, system and entity reset', () => {
    const r = playing();
    r.g.score = 400;
    r.g.usePeek();
    const a = r.g.cards[0];
    r.seconds(2);
    turn(r, a, partnerOf(r.g, a));
    r.h.game.restart?.();
    expect(r.g.phase).toBe('mode');
    expect(r.g.score).toBe(0);
    expect(r.g.pickups).toBe(0);
    expect(r.g.cards).toHaveLength(0);
    expect(r.g.results).toHaveLength(0);
    expect(r.g.streak).toBe(0);
    expect(r.g.totalMoves).toBe(0);
    expect(r.g.peekUsed).toBe(false);
    expect(r.g.hintCooldown).toBe(0);
    expect(r.g.compare).toBeNull();
    expect(r.g.reveal).toBeNull();
    expect(r.g.fx.count()).toBe(0);
    expect(r.h.game.isGameOver?.()).toBe(false);
  });

  it('draws its ended frame without advancing anything', () => {
    const r = playing('timed');
    r.g.timeLeft = 0.1;
    r.seconds(0.2 + FINALE_TIME + 0.1);
    expect(r.h.game.isGameOver?.()).toBe(true);
    const snapshot = JSON.stringify(r.g.cards.map(c => c.shown));
    for (let i = 0; i < 10; i++) r.h.game.render(r.h.ctx);
    expect(JSON.stringify(r.g.cards.map(c => c.shown))).toBe(snapshot);
  });
});
