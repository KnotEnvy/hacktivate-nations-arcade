// ===== src/games/memory/MemoryMatchGame.ts =====
//
// Memory Match, by the Lamplit Parlour. Five tables, each bigger than the
// last (3x4, 4x4, 4x5, 5x6, 6x6), played in CLASSIC (no clock, bests by
// moves) or TIMED (a clock per table; running out ends the night).
//
// A run moves through phases, each advanced with dt in onUpdate:
//   mode   the mode card; waits for the player's choice
//   deal   cards fly in from the stack, one click each (rate-limited)
//   ready  a short "your turn" beat; ends on first input or READY_TIME
//   play   the table; PEEK / HINT are reveal sequences, never timeouts
//   clear  a table-clear beat, the cards fan away, then the next deal
//   finale the run-end beat (all five tables, or the clock ran out),
//          after which endGame() is called
//
// Cards keep their logical state (faceUp / matched) apart from temporary
// reveals (peeked), so a peek or hint can never undo a flip the player made.

import { BaseGame } from '@/games/shared/BaseGame';
import { PressTracker } from '@/games/shared/input/PressTracker';
import type { GameManifest, GameScore } from '@/lib/types';
import {
  BOTTOM_BAND,
  Card,
  cardAt,
  computeLayout,
  faceTarget,
  GridLayout,
  makeCard,
  placeCard,
  TOP_BAND,
} from './entities/Card';
import {
  Bests,
  loadBests,
  loadLastMode,
  saveBests,
  saveLastMode,
} from './systems/bests';
import { CardArt } from './systems/CardArt';
import { CardRenderer, TableView } from './systems/CardRenderer';
import { Effects } from './systems/Effects';
import { HudRenderer, HudState, Placard, Rect } from './systems/HudRenderer';
import { ICONS } from './systems/icons';
import {
  CLEAR_TIME,
  clockText,
  DEAL_FLIGHT,
  dealStagger,
  fastestUnder30,
  FINALE_TIME,
  FLIP_TIME,
  GHOST_TIME,
  HINT_COOLDOWN,
  HINT_COST,
  HINT_HOLD,
  matchPoints,
  MISMATCH_HOLD,
  Mode,
  parBonus,
  PEEK_COST,
  PEEK_HOLD,
  perfectCount,
  POP_TIME,
  PULSE_TIME,
  READY_TIME,
  SHAKE_TIME,
  TableResult,
  TABLES,
  tablesUnder30,
  timeBonus,
} from './systems/rules';
import { TableRenderer } from './systems/TableRenderer';

type Phase = 'mode' | 'deal' | 'ready' | 'play' | 'clear' | 'finale';

interface Compare {
  a: Card;
  b: Card;
  t: number;
  judged: boolean;
  match: boolean;
}

interface Reveal {
  kind: 'peek' | 'hint';
  cards: Card[];
  t: number;
  hold: number;
  released: boolean;
}

const LEFT = ['ArrowLeft', 'KeyA'];
const RIGHT = ['ArrowRight', 'KeyD'];
const UP = ['ArrowUp', 'KeyW'];
const DOWN = ['ArrowDown', 'KeyS'];
const FLIP = ['Space', 'Enter'];
const KEYS = [...LEFT, ...RIGHT, ...UP, ...DOWN, ...FLIP, 'KeyP', 'KeyH'];

function shuffle<T>(items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

export class MemoryMatchGame extends BaseGame {
  manifest: GameManifest = {
    id: 'memory',
    title: 'Memory Match',
    thumbnail: '/games/memory/memory-thumb.svg',
    inputSchema: ['touch', 'keyboard'],
    assetBudgetKB: 60,
    tier: 0,
    description: 'Flip cards to find matching pairs.',
  };

  protected renderBaseHud = false;

  private phase: Phase = 'mode';
  private phaseT = 0;
  private mode: Mode = 'classic';
  private modeHover: Mode | null = null;
  /** The mode card's confirm key must be seen released first (see updateMode). */
  private modeArmed = false;
  private modeBestText = { classic: '', timed: '' };

  private tableIndex = 0;
  private layout: GridLayout | null = null;
  private cards: Card[] = [];
  private picks: Card[] = [];
  private compare: Compare | null = null;
  private reveal: Reveal | null = null;

  private peekUsed = false;
  private hintCooldown = 0;
  private streak = 0;
  private maxStreak = 0;
  private tableMoves = 0;
  private totalMoves = 0;
  private tableSeconds = 0;
  private timeLeft = 0;
  private matchesMade = 0;
  private results: TableResult[] = [];
  private finale: { reason: 'cleared' | 'time' } | null = null;
  private bests: Bests = { leastMoves: null, bestTime: null };

  private cursor = { row: 0, col: 0 };
  private cursorOn = false;
  private hovered: Card | null = null;
  private plateHover: 'peek' | 'hint' | null = null;
  private hintLine = '';
  private dealt = 0;
  private dealSoundGap = 0;
  private lastTick = -1;

  private tracker = new PressTracker();
  private fx = new Effects();
  private art = new CardArt();
  private table = new TableRenderer();
  private hud = new HudRenderer(800, 600);
  private cardRenderer = new CardRenderer(this.art);

  // ============================================================ lifecycle ==

  protected onInit(): void {
    this.hud.resize(this.canvas.width, this.canvas.height);
    this.resetRun();
  }

  protected onRestart(): void {
    this.resetRun();
  }

  protected onResize(width: number, height: number): void {
    this.hud.resize(width, height);
    if (!this.layout) return;
    const def = TABLES[this.tableIndex];
    this.layout = computeLayout(def.rows, def.cols, width, height);
    for (const c of this.cards) placeCard(c, this.layout);
  }

  /** Everything back to the mode card: timers, systems, entities. */
  private resetRun(): void {
    this.phase = 'mode';
    this.phaseT = 0;
    this.mode = loadLastMode();
    this.modeHover = null;
    this.modeArmed = false;
    this.modeBestText = this.modeBests();
    this.tableIndex = 0;
    const first = TABLES[0];
    this.layout = computeLayout(
      first.rows,
      first.cols,
      this.canvas.width,
      this.canvas.height
    );
    this.cards = [];
    this.picks = [];
    this.compare = null;
    this.reveal = null;
    this.peekUsed = false;
    this.hintCooldown = 0;
    this.streak = 0;
    this.maxStreak = 0;
    this.tableMoves = 0;
    this.totalMoves = 0;
    this.tableSeconds = 0;
    this.timeLeft = first.clock;
    this.matchesMade = 0;
    this.results = [];
    this.finale = null;
    this.bests = loadBests(first.rows, first.cols, this.mode);
    this.cursor = { row: 0, col: 0 };
    this.cursorOn = false;
    this.hovered = null;
    this.plateHover = null;
    this.hintLine = 'Choose how to play.';
    this.dealt = 0;
    this.dealSoundGap = 0;
    this.lastTick = -1;
    this.score = 0;
    this.pickups = 0;
    this.extendedGameData = null;
    this.endGameSound = 'game_over';
    this.endGameOutcome = 'died';
    this.fx.clear();
    this.tracker.reset();
  }

  protected onGameEnd(finalScore: GameScore): void {
    void finalScore;
    this.buildStats();
    const track = this.services?.analytics?.trackGameSpecificStat?.bind(
      this.services.analytics
    );
    if (!track) return;
    track('memory', 'matches_made', this.matchesMade);
    track('memory', 'levels_completed', this.results.length);
    track('memory', 'perfect_levels', perfectCount(this.results));
    const fast = fastestUnder30(this.results);
    if (fast > 0) track('memory', 'fast_completion', fast);
  }

  /** Per-table stats for achievements; the key names predate the ladder. */
  private buildStats(): void {
    const cleared = this.results.reduce((s, r) => s + r.seconds, 0);
    const unfinished =
      this.results.length < this.tableIndex + 1 ? this.tableSeconds : 0;
    this.extendedGameData = {
      matches_made: this.matchesMade,
      levels_completed: this.results.length,
      perfect_levels: perfectCount(this.results),
      fast_completion: fastestUnder30(this.results),
      total_moves: this.totalMoves,
      completion_time: Math.round((cleared + unfinished) * 100) / 100,
      max_streak: this.maxStreak,
      fast_tables: tablesUnder30(this.results),
    };
  }

  // =============================================================== update ==

  protected onUpdate(dt: number): void {
    this.tracker.update(this.services.input, KEYS, dt);
    this.phaseT += dt;
    switch (this.phase) {
      case 'mode':
        this.updateMode();
        break;
      case 'deal':
        this.updateDeal(dt);
        break;
      case 'ready':
        this.updateReady();
        break;
      case 'play':
        this.updatePlay(dt);
        break;
      case 'clear':
        this.updateClear();
        break;
      case 'finale':
        this.updateFinale();
        break;
    }
    this.updateHover();
    this.animateCards(dt);
    this.fx.update(dt);
  }

  private updateMode(): void {
    const t = this.tracker;
    const was = this.mode;
    if (t.anyJustPressed(LEFT) || t.anyJustPressed(UP)) this.mode = 'classic';
    if (t.anyJustPressed(RIGHT) || t.anyJustPressed(DOWN)) this.mode = 'timed';
    if (this.mode !== was) {
      const first = TABLES[0];
      this.bests = loadBests(first.rows, first.cols, this.mode);
    }
    // The shell's Start button answers Enter on key-down, so the key can
    // still be held on this card's first frame. Only a fresh press counts.
    if (!FLIP.some(k => t.isDown(k))) this.modeArmed = true;
    if (this.modeArmed && t.anyJustPressed(FLIP)) {
      this.beginRun(this.mode, true);
      return;
    }
    if (t.pointerJustReleased()) {
      const up = this.ticketAt(t.pointerPosition());
      if (up && up === this.ticketAt(t.pointerDownPosition()))
        this.beginRun(up, false);
    }
  }

  private beginRun(mode: Mode, keyboard: boolean): void {
    this.mode = mode;
    saveLastMode(mode);
    this.cursorOn = keyboard;
    this.startTable(0);
  }

  private startTable(index: number): void {
    const def = TABLES[index];
    this.tableIndex = index;
    this.layout = computeLayout(
      def.rows,
      def.cols,
      this.canvas.width,
      this.canvas.height
    );

    const icons = shuffle(ICONS.map((_, i) => i)).slice(0, def.pairs);
    const deck = shuffle([...icons, ...icons]);
    const stagger = dealStagger(deck.length);
    this.cards = deck.map((value, i) => {
      const c = makeCard(i, Math.floor(i / def.cols), i % def.cols, value);
      placeCard(c, this.layout as GridLayout);
      c.dealDelay = i * stagger;
      return c;
    });
    this.art.prepare(icons, index, this.layout.cardW, this.layout.cardH);

    this.picks = [];
    this.compare = null;
    this.reveal = null;
    this.peekUsed = false;
    this.hintCooldown = 0;
    this.tableMoves = 0;
    this.tableSeconds = 0;
    this.timeLeft = def.clock;
    this.lastTick = -1;
    this.bests = loadBests(def.rows, def.cols, this.mode);
    this.cursor = {
      row: Math.min(this.cursor.row, def.rows - 1),
      col: Math.min(this.cursor.col, def.cols - 1),
    };
    this.hovered = null;
    this.dealt = 0;
    this.dealSoundGap = 0;
    this.fx.clear();
    this.hintLine = 'Dealing the cards.';
    this.setPhase('deal');
  }

  private setPhase(phase: Phase): void {
    this.phase = phase;
    this.phaseT = 0;
  }

  private updateDeal(dt: number): void {
    let left = 0;
    let settled = true;
    for (const c of this.cards) {
      c.deal = clamp01((this.phaseT - c.dealDelay) / DEAL_FLIGHT);
      if (this.phaseT >= c.dealDelay) left++;
      if (c.deal < 1) settled = false;
    }
    this.dealSoundGap -= dt;
    if (left > this.dealt) {
      this.dealt = left;
      if (this.dealSoundGap <= 0) {
        this.services.audio?.playSound?.('click');
        this.dealSoundGap = 0.07;
      }
    }
    if (settled) {
      this.hintLine =
        this.mode === 'timed'
          ? 'Your turn. The sand is running.'
          : 'Your turn. Turn any two cards.';
      this.setPhase('ready');
    }
  }

  private updateReady(): void {
    const t = this.tracker;
    const input = t.pointerJustReleased() || KEYS.some(k => t.justPressed(k));
    if (this.phaseT >= READY_TIME || input) {
      this.setPhase('play');
      if (input) this.handlePlayInput();
    }
  }

  private updatePlay(dt: number): void {
    const cmp = this.compare;
    if (cmp) {
      cmp.t += dt;
      if (!cmp.judged && cmp.t >= FLIP_TIME) {
        this.judge(cmp);
      } else if (
        cmp.judged &&
        !cmp.match &&
        cmp.t >= FLIP_TIME + MISMATCH_HOLD
      ) {
        cmp.a.faceUp = false;
        cmp.b.faceUp = false;
        this.picks = [];
        this.compare = null;
      }
    }
    if (this.phase !== 'play') return;

    const rv = this.reveal;
    if (rv) {
      rv.t += dt;
      if (!rv.released && rv.t >= FLIP_TIME + rv.hold) {
        for (const c of rv.cards) c.peeked = false;
        rv.released = true;
      }
      // Input stays closed until the cards are back down, so a click can
      // never land on a card that is still turning over.
      if (rv.released && rv.t >= FLIP_TIME * 2 + rv.hold) this.reveal = null;
    }

    this.tableSeconds += dt;
    this.hintCooldown = Math.max(0, this.hintCooldown - dt);
    if (this.mode === 'timed') {
      this.timeLeft = Math.max(0, this.timeLeft - dt);
      const whole = Math.ceil(this.timeLeft);
      if (whole <= 5 && whole > 0 && whole !== this.lastTick) {
        this.lastTick = whole;
        this.services.audio?.playSound?.('click');
      }
      if (this.timeLeft <= 0) {
        this.startFinale('time');
        return;
      }
    }
    this.handlePlayInput();
  }

  private updateClear(): void {
    const n = this.cards.length;
    this.cards.forEach((c, i) => {
      const start = 0.5 + (i / n) * 0.45;
      c.leave = clamp01((this.phaseT - start) / 0.45);
    });
    if (this.phaseT >= CLEAR_TIME) this.startTable(this.tableIndex + 1);
  }

  private updateFinale(): void {
    if (this.finale?.reason === 'time') {
      // Show what was left on the table, in a wave.
      let i = 0;
      for (const c of this.cards) {
        if (c.matched) continue;
        if (this.phaseT >= 0.3 + i * 0.025) c.peeked = true;
        i++;
      }
    }
    if (this.phaseT >= FINALE_TIME) {
      this.buildStats();
      if (this.finale?.reason === 'cleared') {
        // A won run ends on the win, not on the game-over sting.
        this.endGameSound = 'win';
        this.endGameOutcome = 'completed';
      }
      this.endGame();
    }
  }

  // ================================================================ input ==

  private isLocked(): boolean {
    return this.compare !== null || this.reveal !== null;
  }

  private handlePlayInput(): void {
    const t = this.tracker;
    const def = TABLES[this.tableIndex];
    const dx =
      (t.anyJustPressed(RIGHT) ? 1 : 0) - (t.anyJustPressed(LEFT) ? 1 : 0);
    const dy =
      (t.anyJustPressed(DOWN) ? 1 : 0) - (t.anyJustPressed(UP) ? 1 : 0);
    if (dx !== 0 || dy !== 0) {
      if (this.cursorOn) {
        this.cursor.col = Math.max(
          0,
          Math.min(def.cols - 1, this.cursor.col + dx)
        );
        this.cursor.row = Math.max(
          0,
          Math.min(def.rows - 1, this.cursor.row + dy)
        );
      }
      this.cursorOn = true;
    }
    if (t.anyJustPressed(FLIP)) {
      if (this.cursorOn) this.pick(this.cursorCard());
      this.cursorOn = true;
    }
    if (t.justPressed('KeyP')) this.usePeek();
    if (t.justPressed('KeyH')) this.useHint();

    if (t.pointerJustReleased()) {
      const up = t.pointerPosition();
      const down = t.pointerDownPosition();
      const plate = this.plateAt(up);
      if (plate && plate === this.plateAt(down)) {
        if (plate === 'peek') this.usePeek();
        else this.useHint();
        return;
      }
      // A card turns on RELEASE, and only if the press began on it too, so
      // a drag across the table never turns anything.
      const card = cardAt(this.cards, up.x, up.y);
      if (card && card === cardAt(this.cards, down.x, down.y)) {
        this.cursorOn = false;
        this.cursor = { row: card.row, col: card.col };
        this.pick(card);
      }
    }
  }

  private cursorCard(): Card | null {
    const cols = TABLES[this.tableIndex].cols;
    return this.cards[this.cursor.row * cols + this.cursor.col] ?? null;
  }

  private pick(card: Card | null): boolean {
    if (!card || this.phase !== 'play' || this.isLocked()) return false;
    if (card.matched || card.faceUp) return false;
    card.faceUp = true;
    if (card.seen) card.ghost = GHOST_TIME;
    card.seen = true;
    this.services.audio?.playSound?.('click');
    this.picks.push(card);
    if (this.picks.length === 2) {
      this.tableMoves++;
      this.totalMoves++;
      const [a, b] = this.picks;
      this.compare = { a, b, t: 0, judged: false, match: a.value === b.value };
    } else {
      this.hintLine = 'And one more.';
    }
    return true;
  }

  private judge(cmp: Compare): void {
    cmp.judged = true;
    const { a, b } = cmp;
    if (!cmp.match) {
      for (const c of [a, b]) {
        c.shake = SHAKE_TIME;
        c.miss = MISMATCH_HOLD;
      }
      this.streak = 0;
      this.services.audio?.playSound?.('error');
      this.hintLine = 'Not a pair. Remember them.';
      return;
    }

    for (const c of [a, b]) {
      c.matched = true;
      c.pop = POP_TIME;
      c.pulse = PULSE_TIME;
    }
    const points = matchPoints(this.streak);
    this.streak += 1;
    this.maxStreak = Math.max(this.maxStreak, this.streak);
    this.score += points;
    this.pickups += 1;
    this.matchesMade += 1;
    this.picks = [];
    this.compare = null;

    const ax = a.x + a.w / 2;
    const ay = a.y + a.h / 2;
    const bx = b.x + b.w / 2;
    const by = b.y + b.h / 2;
    const r0 = Math.max(a.w, a.h) * 0.5;
    this.fx.ring(ax, ay, r0);
    this.fx.ring(bx, by, r0);
    this.fx.sparksAt(ax, ay, 8);
    this.fx.sparksAt(bx, by, 8);
    const midX = (ax + bx) / 2;
    const midY = Math.max(TOP_BAND + 44, Math.min(ay, by) - a.h * 0.35);
    this.fx.slip(
      midX,
      midY,
      `+${points}`,
      this.streak >= 2 ? `STREAK ${this.streak}` : ''
    );
    if (this.streak >= 3)
      this.fx.confetti(midX, midY, 18 + Math.min(4, this.streak - 3) * 4);
    this.services.audio?.playSound?.('success');
    this.hintLine =
      this.streak >= 2 ? `A pair. ${this.streak} in a row.` : 'A pair.';

    if (this.cards.every(c => c.matched)) this.completeTable();
  }

  private usePeek(): boolean {
    if (this.phase !== 'play' || this.isLocked()) return false;
    if (this.peekUsed) {
      this.hintLine = 'Peek is spent on this table.';
      return false;
    }
    const hidden = this.cards.filter(c => !c.matched && !c.faceUp);
    if (hidden.length === 0) return false;
    this.peekUsed = true;
    this.score = Math.max(0, this.score - PEEK_COST);
    for (const c of hidden) {
      c.peeked = true;
      c.seen = true;
    }
    this.reveal = {
      kind: 'peek',
      cards: hidden,
      t: 0,
      hold: PEEK_HOLD,
      released: false,
    };
    this.services.audio?.playSound?.('whoosh');
    this.hintLine = 'Peek. Take it all in.';
    return true;
  }

  private useHint(): boolean {
    if (this.phase !== 'play' || this.isLocked()) return false;
    if (this.hintCooldown > 0) {
      this.hintLine = `Hint is ready in ${Math.ceil(this.hintCooldown)}s.`;
      return false;
    }
    let show: Card[] = [];
    if (this.picks.length === 1) {
      const held = this.picks[0];
      const partner = this.cards.find(
        c => c !== held && c.value === held.value && !c.matched
      );
      if (partner) show = [partner];
    } else {
      const byValue = new Map<number, Card[]>();
      for (const c of this.cards) {
        if (c.matched || c.faceUp) continue;
        byValue.set(c.value, [...(byValue.get(c.value) ?? []), c]);
      }
      const pairs = [...byValue.values()].filter(g => g.length === 2);
      if (pairs.length > 0)
        show = pairs[Math.floor(Math.random() * pairs.length)];
    }
    if (show.length === 0) return false;
    this.score = Math.max(0, this.score - HINT_COST);
    this.hintCooldown = HINT_COOLDOWN;
    for (const c of show) {
      c.peeked = true;
      c.seen = true;
    }
    this.reveal = {
      kind: 'hint',
      cards: show,
      t: 0,
      hold: HINT_HOLD,
      released: false,
    };
    this.services.audio?.playSound?.('powerup');
    this.hintLine =
      show.length === 1 ? 'There is its partner.' : 'There is a pair.';
    return true;
  }

  private completeTable(): void {
    const def = TABLES[this.tableIndex];
    const pb = parBonus(def.number, this.tableMoves, def.par);
    const tb = timeBonus(def.clock, this.tableSeconds);
    this.score += pb + tb;
    const saved = saveBests(
      def.rows,
      def.cols,
      this.mode,
      this.tableMoves,
      this.tableSeconds
    );
    this.bests = saved.bests;
    this.results.push({
      table: def.number,
      moves: this.tableMoves,
      par: def.par,
      seconds: this.tableSeconds,
      atPar: this.tableMoves <= def.par,
      parBonus: pb,
      timeBonus: tb,
      newBest: saved.improved,
    });
    this.services.audio?.playSound?.('win');
    if (this.tableIndex === TABLES.length - 1) {
      this.startFinale('cleared');
    } else {
      this.hintLine = 'Table cleared. On to the next.';
      this.setPhase('clear');
    }
  }

  private startFinale(reason: 'cleared' | 'time'): void {
    this.finale = { reason };
    this.compare = null;
    this.reveal = null;
    this.picks = [];
    this.hovered = null;
    if (reason === 'time') {
      this.services.audio?.playSound?.('error');
      this.hintLine = 'The sand ran out.';
    } else {
      this.hintLine = 'Every table cleared.';
      const l = this.layout;
      if (l) {
        for (const fx of [0.2, 0.5, 0.8]) {
          this.fx.confetti(
            l.originX + l.width * fx,
            l.originY + l.height * 0.3,
            22
          );
        }
      }
    }
    this.buildStats();
    this.setPhase('finale');
  }

  // ===================================================== hover & animation ==

  private ticketAt(p: { x: number; y: number }): Mode | null {
    const t = this.hud.modeTickets();
    if (inside(t.classic, p)) return 'classic';
    if (inside(t.timed, p)) return 'timed';
    return null;
  }

  private plateAt(p: { x: number; y: number }): 'peek' | 'hint' | null {
    const pl = this.hud.plates();
    if (inside(pl.peek, p, 4)) return 'peek';
    if (inside(pl.hint, p, 4)) return 'hint';
    return null;
  }

  private updateHover(): void {
    const touch = this.tracker.isTouch();
    const p = this.tracker.pointerPosition();
    this.modeHover = !touch && this.phase === 'mode' ? this.ticketAt(p) : null;
    this.plateHover = !touch && this.phase === 'play' ? this.plateAt(p) : null;
    const card =
      !touch && this.phase === 'play' && !this.isLocked()
        ? cardAt(this.cards, p.x, p.y)
        : null;
    this.hovered = card && !card.matched && !card.faceUp ? card : null;
  }

  private animateCards(dt: number): void {
    const step = dt / FLIP_TIME;
    const cursorCard =
      this.cursorOn && this.phase === 'play' ? this.cursorCard() : null;
    const k = Math.min(1, dt * 14);
    for (const c of this.cards) {
      const target = faceTarget(c) ? 1 : 0;
      c.shown =
        c.shown < target
          ? Math.min(target, c.shown + step)
          : Math.max(target, c.shown - step);
      const lifted =
        (c === this.hovered || c === cursorCard) && !c.matched && !c.faceUp;
      c.hover += ((lifted ? 1 : 0) - c.hover) * k;
      c.pop = Math.max(0, c.pop - dt);
      c.pulse = Math.max(0, c.pulse - dt);
      c.shake = Math.max(0, c.shake - dt);
      c.miss = Math.max(0, c.miss - dt);
      c.ghost = Math.max(0, c.ghost - dt);
    }
  }

  // =============================================================== render ==

  protected onRender(ctx: CanvasRenderingContext2D): void {
    this.table.draw(
      ctx,
      this.canvas.width,
      this.canvas.height,
      this.phase === 'mode' ? null : this.layout
    );
    this.cardRenderer.render(ctx, this.tableView());
    this.fx.render(ctx, {
      x: 0,
      y: TOP_BAND,
      w: this.canvas.width,
      h: this.canvas.height - TOP_BAND - BOTTOM_BAND,
    });
  }

  protected onRenderUI(ctx: CanvasRenderingContext2D): void {
    if (this.phase === 'mode') {
      this.hud.renderRails(ctx, this.hudState());
      this.hud.renderModeCard(
        ctx,
        this.mode,
        this.modeHover,
        this.tracker.isTouch(),
        this.modeBestText
      );
      return;
    }
    this.hud.renderRails(ctx, this.hudState());
    const placard = this.placard();
    if (placard) this.hud.renderPlacard(ctx, placard);
  }

  /** The finished run: the table as it was left, dimmed, with its banner. */
  protected onRenderEnded(ctx: CanvasRenderingContext2D): void {
    this.table.draw(ctx, this.canvas.width, this.canvas.height, this.layout);
    this.cardRenderer.render(ctx, { ...this.tableView(), cursor: null });
    this.hud.renderRails(ctx, this.hudState());
    ctx.fillStyle = 'rgba(8, 3, 7, 0.55)';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    const placard = this.finalePlacard(1);
    if (placard) this.hud.renderPlacard(ctx, placard);
  }

  private tableView(): TableView {
    const cursorShown =
      this.cursorOn && (this.phase === 'play' || this.phase === 'ready');
    return {
      cards: this.cards,
      layout: this.layout,
      table: this.tableIndex,
      dealing: this.phase === 'deal',
      cursor: cursorShown ? this.cursorCard() : null,
    };
  }

  private hudState(): HudState {
    const def = TABLES[this.tableIndex];
    const b = this.bests;
    const bestText =
      this.mode === 'classic'
        ? b.leastMoves !== null
          ? `${b.leastMoves}`
          : '—'
        : b.bestTime !== null
          ? `${b.bestTime.toFixed(1)}s`
          : '—';
    const running =
      this.phase === 'play' && this.mode === 'timed' && this.timeLeft < 10;
    return {
      score: this.score,
      mode: this.mode,
      bestText,
      table: def.number,
      tables: TABLES.length,
      moves: this.tableMoves,
      par: def.par,
      seconds: this.mode === 'timed' ? this.timeLeft : this.tableSeconds,
      clock: def.clock,
      streak: this.streak,
      pairsFound: this.cards.filter(c => c.matched).length / 2,
      pairsTotal: def.pairs,
      peekUsed: this.peekUsed,
      hintCooldown: this.hintCooldown,
      hintMax: HINT_COOLDOWN,
      powersOpen: this.phase === 'play' && !this.isLocked(),
      hintLine:
        running && !this.isLocked()
          ? 'The sand is running low.'
          : this.hintLine,
      touch: this.tracker.isTouch(),
      hover: this.plateHover,
      time: this.gameTime,
    };
  }

  private modeBests(): { classic: string; timed: string } {
    const first = TABLES[0];
    const c = loadBests(first.rows, first.cols, 'classic');
    const t = loadBests(first.rows, first.cols, 'timed');
    const grid = `${first.rows}x${first.cols}`;
    return {
      classic:
        c.leastMoves !== null
          ? `${grid} BEST  ${c.leastMoves} MOVES`
          : 'NO BEST YET',
      timed:
        t.bestTime !== null
          ? `${grid} BEST  ${t.bestTime.toFixed(1)}S`
          : 'NO BEST YET',
    };
  }

  private placard(): Placard | null {
    const def = TABLES[this.tableIndex];
    if (
      this.phase === 'deal' ||
      this.phase === 'ready' ||
      (this.phase === 'play' && this.phaseT < 0.3)
    ) {
      const alpha =
        this.phase === 'deal'
          ? clamp01(this.phaseT / 0.2)
          : this.phase === 'ready'
            ? 1
            : 1 - this.phaseT / 0.3;
      const clock =
        this.mode === 'timed'
          ? `  ·  ${clockText(def.clock)} on the clock`
          : '';
      return {
        eyebrow: this.phase === 'deal' ? 'NOW DEALING' : 'YOUR TURN',
        title: `TABLE ${def.number}  ·  ${def.name.toUpperCase()}`,
        lines: [`${def.pairs} pairs  ·  par ${def.par} moves${clock}`],
        alpha,
      };
    }
    if (this.phase === 'clear') {
      const r = this.results[this.results.length - 1];
      if (!r) return null;
      const alpha = Math.min(
        clamp01(this.phaseT / 0.15),
        clamp01((CLEAR_TIME - this.phaseT) / 0.2)
      );
      return HudRenderer.clearPlacard(r, def.name, alpha);
    }
    if (this.phase === 'finale')
      return this.finalePlacard(clamp01(this.phaseT / 0.25));
    return null;
  }

  private finalePlacard(alpha: number): Placard | null {
    if (!this.finale) return null;
    const def = TABLES[this.tableIndex];
    const totalTime = this.results.reduce((s, r) => s + r.seconds, 0);
    if (this.finale.reason === 'cleared') {
      const atPar = perfectCount(this.results);
      const perfect = atPar === TABLES.length;
      return {
        eyebrow: 'ALL FIVE TABLES',
        title: perfect ? 'PERFECT RUN' : 'EVERY PAIR FOUND',
        lines: [
          `Final score ${this.score.toLocaleString('en-US')}`,
          `${this.totalMoves} moves  ·  ${atPar} of ${TABLES.length} at par  ·  best streak ${this.maxStreak}  ·  ${clockText(totalTime)}`,
        ],
        tag: perfect ? 'EVERY TABLE AT PAR' : undefined,
        alpha,
      };
    }
    const found = this.cards.filter(c => c.matched).length / 2;
    return {
      eyebrow: 'OUT OF TIME',
      title: `TABLE ${def.number}  ·  ${def.name.toUpperCase()}`,
      lines: [
        `${found} of ${def.pairs} pairs found  ·  final score ${this.score.toLocaleString('en-US')}`,
        `${this.results.length} ${this.results.length === 1 ? 'table' : 'tables'} cleared  ·  ${this.totalMoves} moves  ·  best streak ${this.maxStreak}`,
      ],
      problem: true,
      alpha,
    };
  }
}

function inside(r: Rect, p: { x: number; y: number }, pad = 0): boolean {
  return (
    p.x >= r.x - pad &&
    p.x <= r.x + r.w + pad &&
    p.y >= r.y - pad &&
    p.y <= r.y + r.h + pad
  );
}
