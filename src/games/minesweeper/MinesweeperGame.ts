// ===== src/games/minesweeper/MinesweeperGame.ts =====
//
// Minesweeper, by Fieldmark: the field is a surveyor's instrument, the
// tiles are enamel keys on a charcoal plate, and flags are pennants of pink
// flagging tape. This file is the run: states, input, scoring, saved bests.
// The rules live in systems/Board.ts, the layout in systems/Layout.ts, and
// every pixel in systems/BoardRenderer.ts and systems/HudRenderer.ts.
//
// States:
//   ready    the board is visible and the timer is still. A short card
//            names the controls (gone on first input or after 2s). The
//            first reveal lays the mines, always around a safe opening.
//   playing  the timer runs. Reveal, flag, chord.
//   dying    2.0s: a hit-stop, the hit mine flashes, then a shockwave sets
//            off every other mine in order of distance; then BOOM.
//   won      1.8s: flags plant on the remaining mines in a wave from the
//            last move, the field shimmers, ribbons fall, then CLEARED.
//   ended    endGame() has been called; onRenderEnded draws the final board.

import { BaseGame } from '@/games/shared/BaseGame';
import { PressTracker } from '@/games/shared/input/PressTracker';
import { UI } from '@/games/shared/hud/canvasUi';
import type { GameManifest, GameScore } from '@/lib/types';
import {
  Board,
  CellRef,
  DIFFICULTIES,
  Difficulty,
  RevealResult,
  isDifficulty,
  tileDistance,
} from './systems/Board';
import {
  FieldLayout,
  HudTarget,
  cellAt,
  cellCentre,
  computeLayout,
  hitTest,
} from './systems/Layout';
import {
  BoardRenderer,
  BoardView,
  CellFx,
  freshFx,
} from './systems/BoardRenderer';
import { BannerView, HudRenderer, HudView } from './systems/HudRenderer';
import { ParticleSystem } from './systems/ParticleSystem';
import { ScreenShake } from './systems/ScreenShake';
import { SoundBoard } from './systems/SoundBoard';
import { CURSOR_CODES, KeyCursor, gridRef } from './systems/KeyCursor';
import { FIELD } from './systems/palette';
import type { Mood } from './entities/TileArt';

export type Phase = 'ready' | 'playing' | 'dying' | 'won' | 'ended';

const CODES: readonly string[] = [
  ...CURSOR_CODES,
  'Space',
  'Enter',
  'KeyF',
  'Digit1',
  'Digit2',
  'Digit3',
];

/** Beat lengths and feel, in seconds. */
export const DEATH_BEAT = 2.0;
export const VICTORY_BEAT = 1.8;
export const HITSTOP = 0.1;
export const LONG_PRESS = 0.45;
export const READY_CARD_TIME = 2.0;
const CARD_FADE = 0.2;
const POP_STAGGER = 0.028;
const CHORD_DELAY = 0.08;
const PEEK_TIME = 0.26;
/** The long-press ring only appears once a press is clearly not a tap. */
const RING_DELAY = 0.12;
const DRIFT = 14;
const BIG_CASCADE = 12;
/** A mine's own blast sound plays at most this many times per loss. */
export const EXPLOSION_BUDGET = 6;

const DIFFICULTY_KEY = 'minesweeper_difficulty';

interface Press {
  target: HudTarget | null;
  /** This press long-pressed a flag; its release must do nothing. */
  flagged: boolean;
}

interface WaveEntry extends CellRef {
  /** Beat time at which the wave reaches this tile. */
  at: number;
  distance: number;
  kind: 'mine' | 'wrong' | 'plant';
}

function smooth(t: number): number {
  const k = Math.max(0, Math.min(1, t));
  return k * k * (3 - 2 * k);
}

export class MinesweeperGame extends BaseGame {
  manifest: GameManifest = {
    id: 'minesweeper',
    title: 'Minesweeper',
    thumbnail: '/games/minesweeper/minesweeper-thumb.svg',
    inputSchema: ['keyboard', 'touch'],
    assetBudgetKB: 80,
    tier: 0,
    description: 'Survey the field, flag every mine, open everything else.',
  };

  protected renderBaseHud = false;

  // Field
  private difficulty: Difficulty = 'easy';
  private board!: Board;
  private layout!: FieldLayout;
  private fx: CellFx[][] = [];
  private gameState: Phase = 'ready';
  private outcome: 'won' | 'lost' | null = null;

  // Clocks
  /** Animation clock; it stands still during the hit-stop. */
  private clock = 0;
  private hitstop = 0;
  /** The player's timer: runs only while playing. */
  private elapsedSec = 0;
  /** Time into the death or victory beat. */
  private beatT = 0;
  private readyCardT = 0;

  // Results
  private bestTimeSec: number | null = null;
  private newBest = false;
  private playerFlags = 0;
  private hit: CellRef | null = null;
  private lastMove: CellRef | null = null;
  private wave: WaveEntry[] = [];
  private waveNext = 0;
  /** Tiles per second the death or victory wave travels. */
  private waveSpeed = 1;
  private waveReach = 0;
  private impactPending = false;
  private ribbonsDone = false;

  // Input
  private tracker = new PressTracker();
  private cursor = new KeyCursor();
  private press: Press | null = null;
  private hover: CellRef | null = null;
  private lastPointer = { x: 0, y: 0 };
  private pointerSeen = false;
  private modality: 'touch' | 'mouse' | 'keyboard' = 'touch';
  private flagMode = false;
  private longPressT = 0;
  private peek: { cells: CellRef[]; until: number } | null = null;
  private pendingChord: (CellRef & { cells: CellRef[]; t: number }) | null =
    null;
  private pops: Array<CellRef & { t: number }> = [];
  private keyNudge = 0;

  // Systems
  private particles = new ParticleSystem();
  private shake = new ScreenShake();
  private sfx = new SoundBoard((name, volume) =>
    this.services?.audio?.playSound?.(
      name,
      volume === undefined ? undefined : { volume }
    )
  );
  private boardRenderer = new BoardRenderer(800, 600);
  private hud = new HudRenderer();
  private handleContextMenu?: (e: Event) => void;

  // ======================================================= lifecycle ====

  protected onInit(): void {
    this.boardRenderer = new BoardRenderer(
      this.canvas.width,
      this.canvas.height
    );
    this.loadDifficulty();
    this.resetRun();
    // Right-click flags; the browser menu must not open over the field.
    this.handleContextMenu = (e: Event) => e.preventDefault();
    this.canvas.addEventListener('contextmenu', this.handleContextMenu);
  }

  protected onDestroy(): void {
    if (this.handleContextMenu) {
      this.canvas.removeEventListener('contextmenu', this.handleContextMenu);
    }
  }

  protected onRestart(): void {
    this.resetRun();
  }

  protected onResume(): void {
    // Whatever the pointer did while paused is not a move on the field.
    this.tracker.reset();
    this.press = null;
    this.longPressT = 0;
  }

  protected onResize(width: number, height: number): void {
    if (!this.board) return;
    this.layout = computeLayout(
      this.board.cols,
      this.board.rows,
      width,
      height
    );
    this.boardRenderer.invalidate();
  }

  /** A whole new run: new field, READY card, fresh input and sound state. */
  private resetRun(): void {
    this.newField();
    this.readyCardT = READY_CARD_TIME;
    this.extendedGameData = null;
    this.tracker.reset();
    this.press = null;
    this.pointerSeen = false;
    this.sfx.reset();
    this.clock = 0;
  }

  /** A new field at the current difficulty, back in READY. */
  private newField(): void {
    const spec = DIFFICULTIES[this.difficulty];
    this.board = Board.for(this.difficulty);
    this.layout = computeLayout(
      spec.cols,
      spec.rows,
      this.canvas.width,
      this.canvas.height
    );
    this.fx = [];
    for (let r = 0; r < spec.rows; r++) {
      const row: CellFx[] = [];
      for (let c = 0; c < spec.cols; c++) row.push(freshFx());
      this.fx.push(row);
    }
    this.gameState = 'ready';
    this.outcome = null;
    this.endGameSound = 'game_over';
    this.endGameOutcome = 'died';
    this.elapsedSec = 0;
    this.beatT = 0;
    this.hitstop = 0;
    this.hit = null;
    this.lastMove = null;
    this.wave = [];
    this.waveNext = 0;
    this.impactPending = false;
    this.ribbonsDone = false;
    this.newBest = false;
    this.playerFlags = 0;
    this.score = 0;
    this.pickups = 0;
    this.hover = null;
    this.peek = null;
    this.pendingChord = null;
    this.pops = [];
    this.longPressT = 0;
    this.keyNudge = 0;
    this.cursor.reset(spec.rows, spec.cols);
    this.particles.clear();
    this.shake.stop();
    this.boardRenderer.invalidate();
    this.loadBestTime();
  }

  // ========================================================== update ====

  protected onUpdate(dt: number): void {
    this.tracker.update(this.services.input, CODES, dt);
    this.sfx.tick(dt);

    if (this.hitstop > 0) {
      this.hitstop = Math.max(0, this.hitstop - dt);
    } else {
      this.clock += dt;
      this.particles.update(dt);
      this.shake.update(dt);
    }
    if (this.readyCardT > 0)
      this.readyCardT = Math.max(0, this.readyCardT - dt);
    if (this.keyNudge > 0)
      this.keyNudge = Math.max(0, this.keyNudge - dt / 0.3);
    if (this.peek && this.clock >= this.peek.until) this.peek = null;
    this.flushPops();

    switch (this.gameState) {
      case 'ready':
      case 'playing':
        this.handleInput(dt);
        this.tickChord(dt);
        if (this.gameState === 'playing') {
          this.elapsedSec += dt;
          // Every reveal checks for the clear; this is the backstop.
          if (this.board.isCleared()) this.startVictory(this.lastMove);
        }
        break;
      case 'dying':
        this.tickDeath(dt);
        break;
      case 'won':
        this.tickVictory(dt);
        break;
      default:
        break;
    }
  }

  // =========================================================== input ====

  private handleInput(dt: number): void {
    const t = this.tracker;
    if (t.anyJustPressed(CODES)) this.dismissReadyCard();
    if (this.cursor.update(t, this.board.rows, this.board.cols, dt)) {
      this.modality = 'keyboard';
    }
    this.handlePointer();
    this.handleKeys();
  }

  private handleKeys(): void {
    const t = this.tracker;
    if (t.justPressed('Digit1')) this.chooseDifficulty('easy');
    if (t.justPressed('Digit2')) this.chooseDifficulty('medium');
    if (t.justPressed('Digit3')) this.chooseDifficulty('hard');

    if (t.justPressed('Space') || t.justPressed('Enter')) {
      this.modality = 'keyboard';
      // The first press wakes the cursor where it sits; the next one acts.
      if (!this.cursor.visible) this.cursor.show();
      else this.primaryAt(this.cursor.row, this.cursor.col);
    }
    if (t.justPressed('KeyF')) {
      // F flags the tile you are pointing at (keyboard cursor, or the
      // mouse over the field). Pointing at nothing, it throws flag mode.
      if (this.cursor.visible) {
        this.secondaryAt(this.cursor.row, this.cursor.col);
      } else if (this.hover) {
        this.secondaryAt(this.hover.row, this.hover.col);
      } else {
        this.toggleFlagMode();
      }
    }
  }

  private handlePointer(): void {
    const t = this.tracker;
    const touch = t.isTouch();
    const pos = this.tracker.pointerPosition();

    if (!touch) {
      const moved =
        pos.x !== this.lastPointer.x || pos.y !== this.lastPointer.y;
      if (moved && this.pointerSeen) {
        this.cursor.hide();
        this.modality = 'mouse';
      }
      this.pointerSeen = true;
    }
    this.lastPointer = pos;
    this.hover = touch ? null : cellAt(this.layout, pos.x, pos.y);

    if (t.pointerJustPressed()) {
      this.dismissReadyCard();
      this.cursor.hide();
      this.modality = touch ? 'touch' : 'mouse';
      const target = hitTest(this.layout, pos.x, pos.y);
      this.press = { target, flagged: false };
      if (target?.kind === 'key' && this.keysLocked()) this.keyNudge = 1;
    }

    this.longPressT = 0;
    const press = this.press;
    if (press && t.pointerDown() && !press.flagged) {
      const target = press.target;
      if (target?.kind === 'cell' && this.gameState === 'playing') {
        const cell = this.board.at(target.row, target.col);
        if (cell && !cell.revealed) {
          const down = t.pointerDownPosition();
          const drift = Math.hypot(pos.x - down.x, pos.y - down.y);
          if (drift <= DRIFT) {
            this.longPressT = Math.max(
              0,
              Math.min(
                1,
                (t.pointerHeldFor() - RING_DELAY) / (LONG_PRESS - RING_DELAY)
              )
            );
          }
          if (t.longPressed(LONG_PRESS, DRIFT)) {
            press.flagged = true;
            this.longPressT = 0;
            this.secondaryAt(target.row, target.col);
          }
        }
      }
    }

    if (t.pointerJustReleased()) {
      const done = this.press;
      this.press = null;
      if (done && !done.flagged) {
        this.release(done.target, hitTest(this.layout, pos.x, pos.y));
      }
    }

    if (t.rightJustPressed()) {
      this.dismissReadyCard();
      this.cursor.hide();
      this.modality = 'mouse';
      const cell = cellAt(this.layout, pos.x, pos.y);
      if (cell) this.secondaryAt(cell.row, cell.col);
    }
  }

  /** A press acts on release, where it was released, like a real button. */
  private release(start: HudTarget | null, end: HudTarget | null): void {
    if (!start || !end) return;
    if (start.kind === 'cell' && end.kind === 'cell') {
      this.primaryAt(end.row, end.col);
    } else if (start.kind === 'face' && end.kind === 'face') {
      this.pressFace();
    } else if (
      start.kind === 'key' &&
      end.kind === 'key' &&
      start.id === end.id
    ) {
      this.chooseDifficulty(start.id);
    } else if (start.kind === 'flagSwitch' && end.kind === 'flagSwitch') {
      this.toggleFlagMode();
    }
  }

  private dismissReadyCard(): void {
    this.readyCardT = Math.min(this.readyCardT, CARD_FADE);
  }

  private keysLocked(): boolean {
    return this.gameState !== 'ready';
  }

  // =========================================================== moves ====

  /** Tap, click, Space: open a tile, chord a number, or flag in flag mode. */
  private primaryAt(row: number, col: number): void {
    const cell = this.board.at(row, col);
    if (!cell) return;
    if (this.gameState === 'ready') {
      // The first tap always opens, even in flag mode: there is nothing to
      // flag yet, and it is always safe.
      this.firstReveal(row, col);
      return;
    }
    if (this.gameState !== 'playing') return;
    if (cell.revealed) {
      this.requestChord(row, col);
      return;
    }
    if (this.flagMode) {
      this.secondaryAt(row, col);
      return;
    }
    if (cell.flagged) return; // a flag protects its tile
    this.lastMove = { row, col };
    this.applyReveal(this.board.reveal(row, col), row, col);
  }

  private firstReveal(row: number, col: number): void {
    this.board.placeMines(row, col);
    this.gameState = 'playing';
    this.elapsedSec = 0;
    this.lastMove = { row, col };
    this.applyReveal(this.board.reveal(row, col), row, col);
  }

  /** Right-click, long-press, F: plant or pull a flag. */
  private secondaryAt(row: number, col: number): void {
    if (this.gameState !== 'playing') return;
    const on = this.board.toggleFlag(row, col);
    if (on === null) return;
    const fx = this.fx[row][col];
    if (on) {
      fx.flagT = this.clock;
      fx.auto = false;
      const c = cellCentre(this.layout, row, col);
      this.particles.plant(c.x, c.y - this.layout.cell * 0.18);
      // The stake seating in the ground.
      this.sfx.play('land', { volume: 0.7 });
    } else {
      fx.unflagT = this.clock;
      this.sfx.play('click', { volume: 0.4 });
    }
  }

  private requestChord(row: number, col: number): void {
    const state = this.board.chordState(row, col);
    if (state.kind === 'peek') {
      // Wrong flag count: show which tiles it would have opened, open none.
      this.peek = { cells: state.cells, until: this.clock + PEEK_TIME };
      this.sfx.play('bounce', { volume: 0.35, gap: 0.08 });
    } else if (state.kind === 'ready') {
      // The neighbours go down together, then open together.
      this.pendingChord = { row, col, cells: state.cells, t: CHORD_DELAY };
    }
  }

  private tickChord(dt: number): void {
    if (!this.pendingChord) return;
    this.pendingChord.t -= dt;
    if (this.pendingChord.t > 0) return;
    const { row, col } = this.pendingChord;
    this.pendingChord = null;
    if (this.gameState !== 'playing') return;
    this.lastMove = { row, col };
    this.applyReveal(this.board.chord(row, col), row, col);
  }

  /**
   * Book a reveal: score it now, schedule each tile's pop by flood ring, and
   * decide the run on the spot. The board has already opened; the cascade
   * the player watches is animation over a settled field.
   */
  private applyReveal(result: RevealResult, row: number, col: number): void {
    const opened = result.opened;
    if (opened.length > 0) {
      this.score += opened.length * 10;
      for (const o of opened) {
        const at = this.clock + o.depth * POP_STAGGER;
        this.fx[o.row][o.col].revealT = at;
        this.pops.push({ row: o.row, col: o.col, t: at });
      }
      if (opened.length >= BIG_CASCADE) {
        const c = cellCentre(this.layout, row, col);
        const depth = opened[opened.length - 1].depth;
        const s = this.layout.cell;
        this.particles.ring(
          c.x,
          c.y,
          (depth + 1.5) * s,
          s / POP_STAGGER,
          FIELD.lit,
          2
        );
        this.sfx.play('whoosh', { volume: 0.5, gap: 0.2 });
      }
    }
    if (result.mine) {
      this.startDeath(result.mine);
      return;
    }
    if (this.board.isCleared()) this.startVictory({ row, col });
  }

  /** Tiles reaching their pop time this frame: a flake of enamel, a click. */
  private flushPops(): void {
    if (this.pops.length === 0) return;
    let kept = 0;
    for (const p of this.pops) {
      if (p.t <= this.clock) {
        const c = cellCentre(this.layout, p.row, p.col);
        this.particles.flakes(c.x, c.y, this.layout.cell);
        // One click per 40ms across the whole cascade, never a buzz.
        this.sfx.play('click', { gap: 0.04, volume: 0.45 });
      } else {
        this.pops[kept++] = p;
      }
    }
    this.pops.length = kept;
  }

  private pressFace(): void {
    this.sfx.play('click', { volume: 0.6 });
    if (this.gameState === 'ready' || this.gameState === 'playing') {
      this.newField();
    }
  }

  private chooseDifficulty(id: Difficulty): void {
    if (this.keysLocked()) {
      this.keyNudge = 1;
      return;
    }
    this.sfx.play('click', { volume: 0.6 });
    this.setDifficulty(id);
  }

  /** Switch fields. Only the READY board may change size. */
  private setDifficulty(id: Difficulty): void {
    if (this.gameState !== 'ready') return;
    this.difficulty = id;
    try {
      localStorage.setItem(DIFFICULTY_KEY, id);
    } catch {
      /* storage unavailable: the choice lasts this session */
    }
    this.newField();
  }

  private toggleFlagMode(): void {
    this.flagMode = !this.flagMode;
    this.sfx.play('switch_click', { volume: 0.45 });
  }

  // ========================================================== beats ====

  private startDeath(hit: CellRef): void {
    this.gameState = 'dying';
    this.outcome = 'lost';
    this.hit = hit;
    this.beatT = 0;
    this.hitstop = HITSTOP;
    this.impactPending = true;
    this.pendingChord = null;
    this.peek = null;
    this.press = null;
    this.longPressT = 0;
    this.playerFlags = this.board.flags;
    this.pickups = 0;

    // The shockwave: every other hidden mine goes off in order of its
    // distance from the one that was hit, and each wrong flag is crossed
    // out as the wave passes it. Correct flags stand.
    const entries: WaveEntry[] = [];
    for (let r = 0; r < this.board.rows; r++) {
      for (let c = 0; c < this.board.cols; c++) {
        if (r === hit.row && c === hit.col) continue;
        const cell = this.board.cells[r][c];
        const distance = tileDistance(hit, { row: r, col: c });
        if (cell.mine && !cell.flagged) {
          entries.push({ row: r, col: c, distance, at: 0, kind: 'mine' });
        } else if (!cell.mine && cell.flagged) {
          entries.push({ row: r, col: c, distance, at: 0, kind: 'wrong' });
        }
      }
    }
    const reach = entries.reduce((m, e) => Math.max(m, e.distance), 1);
    // The farthest mine goes off one second after the wave leaves.
    this.waveSpeed = Math.max(4, reach / 1.0);
    this.waveReach = reach;
    for (const e of entries)
      e.at = HITSTOP + 0.12 + e.distance / this.waveSpeed;
    entries.sort((a, b) => a.at - b.at);
    this.wave = entries;
    this.waveNext = 0;
  }

  private tickDeath(dt: number): void {
    this.beatT += dt;
    const s = this.layout.cell;
    if (this.impactPending && this.hitstop <= 0 && this.hit) {
      this.impactPending = false;
      const c = cellCentre(this.layout, this.hit.row, this.hit.col);
      this.shake.shake(7, 0.45);
      this.particles.burst(c.x, c.y, 1.6);
      this.particles.ring(
        c.x,
        c.y,
        (this.waveReach + 1) * s,
        this.waveSpeed * s,
        UI.bad,
        3
      );
      this.sfx.play('explosion', {
        budgetKey: 'boom',
        budget: EXPLOSION_BUDGET,
      });
    }
    while (
      this.waveNext < this.wave.length &&
      this.wave[this.waveNext].at <= this.beatT
    ) {
      const e = this.wave[this.waveNext++];
      const fx = this.fx[e.row][e.col];
      if (e.kind === 'mine') {
        fx.detonateT = this.clock;
        const c = cellCentre(this.layout, e.row, e.col);
        this.particles.burst(c.x, c.y, 0.55);
        this.shake.shake(2.5, 0.15);
        this.sfx.play('explosion', {
          budgetKey: 'boom',
          budget: EXPLOSION_BUDGET,
          gap: 0.09,
          volume: 0.55,
        });
      } else {
        fx.wrongT = this.clock;
      }
    }
    if (this.beatT >= DEATH_BEAT) this.finish();
  }

  private startVictory(origin: CellRef | null): void {
    if (this.gameState !== 'playing') return;
    this.gameState = 'won';
    this.outcome = 'won';
    this.beatT = 0;
    this.pendingChord = null;
    this.peek = null;
    this.press = null;
    this.longPressT = 0;

    const spec = DIFFICULTIES[this.difficulty];
    // Every flag standing at a clear is on a mine: a flagged safe tile can
    // not be opened, so a field with one cannot clear.
    this.playerFlags = this.board.flags;
    this.pickups = this.playerFlags;
    // Cells are already scored; a clear adds a flat bonus and 10 per
    // second under par.
    this.score +=
      spec.clearBonus +
      Math.round(Math.max(0, spec.par - this.elapsedSec) * 10);
    // A cleared field must not end on the losing sting or report a death.
    this.endGameSound = 'win';
    this.endGameOutcome = 'completed';
    this.newBest =
      this.bestTimeSec === null || this.elapsedSec < this.bestTimeSec;
    if (this.newBest) this.saveBestTime(this.elapsedSec);
    // The chord now; the full fanfare closes the beat (endGameSound).
    this.sfx.play('success');

    // Plant the rest, in a wave from the last move. Let the final cascade
    // finish popping first.
    const from = origin ?? {
      row: Math.floor(this.board.rows / 2),
      col: Math.floor(this.board.cols / 2),
    };
    const lastPop = this.pops.reduce((m, p) => Math.max(m, p.t), this.clock);
    const settle = Math.min(0.4, lastPop - this.clock);
    const entries: WaveEntry[] = [];
    for (let r = 0; r < this.board.rows; r++) {
      for (let c = 0; c < this.board.cols; c++) {
        const cell = this.board.cells[r][c];
        if (cell.mine && !cell.flagged) {
          const distance = tileDistance(from, { row: r, col: c });
          entries.push({ row: r, col: c, distance, at: 0, kind: 'plant' });
        }
      }
    }
    const reach = entries.reduce((m, e) => Math.max(m, e.distance), 1);
    this.waveSpeed = Math.max(4, reach / 0.75);
    for (const e of entries) e.at = settle + 0.1 + e.distance / this.waveSpeed;
    entries.sort((a, b) => a.at - b.at);
    this.wave = entries;
    this.waveNext = 0;
  }

  private tickVictory(dt: number): void {
    this.beatT += dt;
    while (
      this.waveNext < this.wave.length &&
      this.wave[this.waveNext].at <= this.beatT
    ) {
      const e = this.wave[this.waveNext++];
      this.board.setFlag(e.row, e.col, true);
      const fx = this.fx[e.row][e.col];
      fx.flagT = this.clock;
      fx.auto = true;
      const c = cellCentre(this.layout, e.row, e.col);
      this.particles.plant(c.x, c.y - this.layout.cell * 0.18);
      this.sfx.play('click', { gap: 0.04, volume: 0.5 });
    }
    if (!this.ribbonsDone && this.beatT >= 0.3) {
      this.ribbonsDone = true;
      const w = this.layout.well;
      this.particles.ribbons(w.x, w.x + w.w, w.y + 4);
    }
    if (this.beatT >= VICTORY_BEAT) this.finish();
  }

  private finish(): void {
    const won = this.outcome === 'won';
    this.gameState = 'ended';
    this.extendedGameData = {
      cells_cleared: this.board.safeOpened,
      games_won: won ? 1 : 0,
      fast_win: won && this.elapsedSec <= 60 ? 60 : 0,
      flags_used: this.playerFlags,
      difficulty: this.difficulty,
    };
    this.endGame();
  }

  protected onGameEnd(finalScore: GameScore): void {
    void finalScore;
    this.services?.analytics?.trackGameSpecificStat?.(
      'minesweeper',
      'cells_cleared',
      this.board.safeOpened
    );
    if (this.outcome === 'won') {
      this.services?.analytics?.trackGameSpecificStat?.(
        'minesweeper',
        'games_won',
        1
      );
    }
  }

  // ========================================================== render ====

  protected onRender(ctx: CanvasRenderingContext2D): void {
    this.boardRenderer.renderDesk(ctx);
    const o = this.shake.offset();
    ctx.save();
    ctx.translate(o.x, o.y);
    this.boardRenderer.renderHousing(ctx, this.layout);
    this.boardRenderer.renderField(ctx, this.boardView());
    // Effects stay inside the instrument: nothing crosses the readouts.
    const w = this.layout.well;
    ctx.beginPath();
    ctx.rect(w.x, w.y, w.w, w.h);
    ctx.clip();
    this.particles.render(ctx);
    ctx.restore();
  }

  protected onRenderUI(ctx: CanvasRenderingContext2D): void {
    const v = this.hudView();
    const o = this.shake.offset();
    ctx.save();
    ctx.translate(o.x, o.y);
    this.hud.renderHeader(ctx, v);
    ctx.restore();
    this.hud.renderFooter(ctx, v);
    this.hud.renderTag(ctx, v);
    this.hud.renderReadyCard(ctx, v);
  }

  /** The board as the run ended, dimmed under the shell's summary. */
  protected onRenderEnded(ctx: CanvasRenderingContext2D): void {
    this.boardRenderer.renderDesk(ctx);
    this.boardRenderer.renderHousing(ctx, this.layout);
    this.boardRenderer.renderField(ctx, {
      ...this.boardView(),
      // Far enough ahead that every animation reads as settled.
      now: this.clock + 10,
      hitFlash: false,
      hover: null,
      pressed: [],
      ghostFlag: null,
      longPress: null,
      cursor: null,
      sheen: null,
      dim: 0.55,
    });
    const v = { ...this.hudView(), readyCard: 0, facePressed: false };
    this.hud.renderHeader(ctx, v);
    this.hud.renderFooter(ctx, v);
    this.hud.renderTag(ctx, v);
  }

  private boardView(): BoardView {
    const live = this.gameState === 'ready' || this.gameState === 'playing';
    const pressCell = this.pressCell();
    const pressedCell =
      pressCell && live ? this.board.at(pressCell.row, pressCell.col) : null;

    const pressed: CellRef[] = [];
    let ghostFlag: CellRef | null = null;
    if (pressCell && pressedCell) {
      if (pressedCell.revealed) {
        if (this.gameState === 'playing') {
          const state = this.board.chordState(pressCell.row, pressCell.col);
          if (state.kind !== 'none') pressed.push(...state.cells);
        }
      } else if (!pressedCell.flagged || this.flagMode) {
        if (this.flagMode && this.gameState === 'playing') {
          if (!pressedCell.flagged) ghostFlag = pressCell;
        } else if (!pressedCell.flagged) {
          pressed.push(pressCell);
        }
      }
    }
    if (this.pendingChord) pressed.push(...this.pendingChord.cells);
    if (this.peek) pressed.push(...this.peek.cells);

    let sheen: number | null = null;
    let dim = 0;
    if (this.gameState === 'won') {
      const k = (this.beatT - 0.2) / 0.9;
      sheen = k >= 0 && k <= 1 ? k : null;
    } else if (this.gameState === 'dying') {
      dim = smooth((this.beatT - 1.2) / 0.35) * 0.5;
    }

    return {
      board: this.board,
      fx: this.fx,
      layout: this.layout,
      now: this.clock,
      hit: this.hit,
      hitFlash: this.gameState === 'dying' && this.hitstop > 0,
      hover: live && !this.cursor.visible && !this.press ? this.hover : null,
      pressed,
      ghostFlag,
      longPress:
        this.longPressT > 0 && pressCell
          ? { cell: pressCell, t: this.longPressT }
          : null,
      cursor:
        live && this.cursor.visible
          ? { row: this.cursor.row, col: this.cursor.col }
          : null,
      sheen,
      dim,
    };
  }

  /** The tile a held pointer is pushing down: it follows the pointer. */
  private pressCell(): CellRef | null {
    if (!this.press || this.press.flagged) return null;
    if (this.press.target?.kind !== 'cell') return null;
    if (!this.tracker.pointerDown()) return null;
    const pos = this.tracker.pointerPosition();
    return cellAt(this.layout, pos.x, pos.y);
  }

  private pressTargetUnderPointer(kind: HudTarget['kind']): HudTarget | null {
    if (!this.press || this.press.target?.kind !== kind) return null;
    if (!this.tracker.pointerDown()) return null;
    const pos = this.tracker.pointerPosition();
    const under = hitTest(this.layout, pos.x, pos.y);
    return under?.kind === kind ? under : null;
  }

  private mood(): Mood {
    if (this.outcome === 'lost') return 'dead';
    if (this.outcome === 'won') return 'cool';
    if (this.pressCell()) return 'tense';
    return 'idle';
  }

  private hudView(): HudView {
    const key = this.pressTargetUnderPointer('key');
    return {
      layout: this.layout,
      now: this.clock,
      difficulty: this.difficulty,
      minesLeft: this.board.minesLeft,
      minesPulse:
        this.gameState === 'playing' &&
        this.board.minesLeft === 0 &&
        !this.board.isCleared()
          ? 0.5 + 0.5 * Math.sin(this.clock * 6)
          : 0,
      time: this.elapsedSec,
      mood: this.mood(),
      facePressed: this.pressTargetUnderPointer('face') !== null,
      keysLocked: this.keysLocked(),
      keyPressed: key?.kind === 'key' ? key.id : null,
      keyNudge: this.keyNudge,
      flagMode: this.flagMode,
      switchPressed: this.pressTargetUnderPointer('flagSwitch') !== null,
      best: this.bestTimeSec,
      hint: this.hintText(),
      readyCard:
        this.gameState === 'ready'
          ? Math.min(1, this.readyCardT / CARD_FADE)
          : 0,
      banner: this.bannerView(),
    };
  }

  private bannerView(): BannerView | null {
    const ended = this.gameState === 'ended';
    if (this.outcome === 'lost') {
      return {
        kind: 'boom',
        title: 'BOOM',
        sub: [
          {
            text: `${this.board.safeOpened} of ${this.board.safeTotal} tiles cleared`,
          },
        ],
        t: ended ? 1 : smooth((this.beatT - 1.2) / 0.3),
      };
    }
    if (this.outcome === 'won') {
      const best = this.bestTimeSec ?? this.elapsedSec;
      return {
        kind: 'clear',
        title: 'CLEARED',
        sub: [
          { text: `${this.elapsedSec.toFixed(1)}s` },
          { text: ' · ' },
          this.newBest
            ? { text: 'NEW BEST', color: FIELD.litDeep }
            : { text: `best ${best.toFixed(1)}s` },
        ],
        t: ended ? 1 : smooth((this.beatT - 0.55) / 0.3),
      };
    }
    return null;
  }

  private hintText(): string {
    const verb = this.modality === 'mouse' ? 'click' : 'tap';
    const Verb = verb === 'click' ? 'Click' : 'Tap';
    if (this.gameState === 'ready') {
      if (this.modality === 'keyboard') {
        return 'Arrows move · Space opens · F flags · the first tile is always safe';
      }
      if (this.flagMode) {
        return `Flag mode is on · your first ${verb} still opens, safely`;
      }
      if (this.modality === 'mouse') {
        return 'Click to reveal · right-click or hold to flag · first click is always safe';
      }
      return 'Tap to reveal · hold to flag · first tap is always safe';
    }
    if (this.gameState === 'playing') {
      if (this.modality === 'keyboard') {
        const ref = gridRef(this.cursor.row, this.cursor.col);
        return `${ref} · Space opens or chords · F flags · arrows move`;
      }
      if (this.flagMode) {
        return `Flag mode · ${verb}s plant flags · ${verb} a number to chord`;
      }
      return `${Verb} a number to chord · it opens the rest once its flags are placed`;
    }
    return '';
  }

  // ========================================================= storage ====

  private loadDifficulty(): void {
    try {
      const saved = localStorage.getItem(DIFFICULTY_KEY);
      if (isDifficulty(saved)) this.difficulty = saved;
    } catch {
      /* storage unavailable: keep the default */
    }
  }

  private bestTimeKey(): string {
    return `minesweeper_best_${this.difficulty}`;
  }

  private loadBestTime(): void {
    try {
      const saved = localStorage.getItem(this.bestTimeKey());
      const value = saved ? parseFloat(saved) : NaN;
      this.bestTimeSec = Number.isFinite(value) ? value : null;
    } catch {
      this.bestTimeSec = null;
    }
  }

  private saveBestTime(timeSec: number): void {
    this.bestTimeSec = timeSec;
    try {
      localStorage.setItem(this.bestTimeKey(), String(timeSec));
    } catch {
      /* storage unavailable: the best lasts this session */
    }
  }
}
