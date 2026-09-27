// ===== src/games/minesweeper/systems/BoardRenderer.ts =====
//
// Draws the instrument and the field. Three offscreen layers carry almost
// every pixel:
//
//   desk     the ground and its survey contours. Built once.
//   housing  the slate slab, the readout recesses, the well, the ruler
//            ticks and the corner screws. Rebuilt when the layout changes.
//   tiles    one image of the whole field. Each cell remembers a signature
//            of what it last drew there; a cell is redrawn only when its
//            signature changes. A cell that is mid-animation parks a neutral
//            signature in the cache and is drawn live on top instead.
//
// So a settled frame is three blits plus the few live cells (hover, press,
// cursor, a planting flag). The renderer keeps its caches as its own state;
// it never writes to the game.

import {
  UI,
  displayFont,
  ease,
  roundRectPath,
  tracked,
  trackedWidth,
} from '@/games/shared/hud/canvasUi';
import type { Board, CellRef } from './Board';
import type { FieldLayout, Rect } from './Layout';
import { FIELD } from './palette';
import {
  KeyState,
  drawBurntPlate,
  drawFlag,
  drawKey,
  drawMine,
  drawNumber,
  drawPlate,
  drawScorch,
  drawWrongMark,
} from '../entities/TileArt';

/** Per-cell animation clocks, in the game's animation time. */
export interface CellFx {
  /** When the tile pops open. Infinity while it is closed. */
  revealT: number;
  /** When the current flag planted. -Infinity if never. */
  flagT: number;
  /** When a flag was last pulled. -Infinity if never. */
  unflagT: number;
  /** Loss only: when this mine went off. Infinity until it does. */
  detonateT: number;
  /** Loss only: when this (wrong) flag was crossed out. */
  wrongT: number;
  /** Planted by the victory wave rather than by the player. */
  auto: boolean;
}

export function freshFx(): CellFx {
  return {
    revealT: Infinity,
    flagT: -Infinity,
    unflagT: -Infinity,
    detonateT: Infinity,
    wrongT: Infinity,
    auto: false,
  };
}

export const POP_TIME = 0.18;
export const PLANT_TIME = 0.24;
const UNPLANT_TIME = 0.12;
const FLASH_TIME = 0.32;
const CROSS_TIME = 0.18;

export interface BoardView {
  board: Board;
  fx: CellFx[][];
  layout: FieldLayout;
  /** Animation clock. */
  now: number;
  /** The mine that ended the run. */
  hit: CellRef | null;
  /** The hit tile strobes while the game holds its breath. */
  hitFlash: boolean;
  hover: CellRef | null;
  /** Keys drawn pushed into the plate: a press, a chord, a peek. */
  pressed: CellRef[];
  /** Flag-mode press preview. */
  ghostFlag: CellRef | null;
  /** Long-press progress ring, 0..1. */
  longPress: { cell: CellRef; t: number } | null;
  cursor: CellRef | null;
  /** Victory sheen sweep, 0..1, or null. */
  sheen: number | null;
  /** 0..1 darkening laid over the field. */
  dim: number;
}

const SIG_KEY = 0;
const SIG_FLAG = 1;
const SIG_WRONG = 2;
const SIG_PLATE = 10; // + neighbour count
const SIG_MINE = 20;
const SIG_HIT = 21;
const SIG_NONE = -1;

interface Layer {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
}

function makeLayer(w: number, h: number): Layer | null {
  try {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.ceil(w));
    canvas.height = Math.max(1, Math.ceil(h));
    const ctx = canvas.getContext('2d');
    return ctx ? { canvas, ctx } : null;
  } catch {
    return null;
  }
}

export class BoardRenderer {
  /** Off only for the perf comparison in the capture harness. */
  cacheEnabled = true;
  private desk: Layer | null = null;
  private housing: Layer | null = null;
  private housingKey = '';
  private tiles: Layer | null = null;
  private tilesKey = '';
  private sigs: number[][] = [];
  /** Cells redrawn into the tile cache on the last frame (for tests). */
  lastRedraws = 0;

  constructor(
    private readonly width: number,
    private readonly height: number
  ) {}

  /** Forget every cache (new board, new layout). */
  invalidate(): void {
    this.tilesKey = '';
    this.housingKey = '';
  }

  // ---------------------------------------------------------- the desk ----

  renderDesk(ctx: CanvasRenderingContext2D): void {
    if (this.cacheEnabled && !this.desk) {
      this.desk = makeLayer(this.width, this.height);
      if (this.desk) this.paintDesk(this.desk.ctx);
    }
    if (this.cacheEnabled && this.desk) {
      ctx.drawImage(this.desk.canvas, 0, 0);
    } else {
      this.paintDesk(ctx);
    }
  }

  private paintDesk(ctx: CanvasRenderingContext2D): void {
    const { width: w, height: h } = this;
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, FIELD.desk);
    g.addColorStop(1, FIELD.deskDeep);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // Survey contours: closed wobbling loops around two summits.
    ctx.save();
    ctx.strokeStyle = FIELD.contour;
    ctx.lineWidth = 1;
    const summits = [
      { x: w * 0.14, y: h * 0.2, seed: 3 },
      { x: w * 0.88, y: h * 0.78, seed: 11 },
    ];
    for (const s of summits) {
      for (let k = 1; k <= 14; k++) {
        const base = 18 + k * 26;
        ctx.beginPath();
        for (let i = 0; i <= 96; i++) {
          const a = (Math.PI * 2 * i) / 96;
          const r =
            base +
            Math.sin(a * 3 + s.seed + k * 0.35) * (4 + k * 1.1) +
            Math.sin(a * 5 + s.seed * 2) * (2 + k * 0.5);
          const px = s.x + Math.cos(a) * r * 1.25;
          const py = s.y + Math.sin(a) * r;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();
      }
    }
    ctx.restore();

    const v = ctx.createRadialGradient(
      w / 2,
      h * 0.45,
      h * 0.3,
      w / 2,
      h * 0.45,
      w * 0.75
    );
    v.addColorStop(0, 'rgba(0, 0, 0, 0)');
    v.addColorStop(1, 'rgba(0, 0, 0, 0.5)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, w, h);
  }

  // ------------------------------------------------------- the housing ----

  renderHousing(ctx: CanvasRenderingContext2D, layout: FieldLayout): void {
    const key = `${layout.cols}x${layout.rows}@${layout.cell}`;
    if (this.cacheEnabled && (this.housingKey !== key || !this.housing)) {
      this.housing = makeLayer(this.width, this.height);
      this.housingKey = key;
      if (this.housing) this.paintHousing(this.housing.ctx, layout);
    }
    if (this.cacheEnabled && this.housing) {
      ctx.drawImage(this.housing.canvas, 0, 0);
    } else {
      this.paintHousing(ctx, layout);
    }
  }

  private paintHousing(ctx: CanvasRenderingContext2D, L: FieldLayout): void {
    const h = L.housing;
    ctx.save();
    // The one soft shadow in the game, and it is baked, not per-frame.
    ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
    ctx.shadowBlur = 26;
    ctx.shadowOffsetY = 10;
    ctx.fillStyle = FIELD.housing;
    roundRectPath(ctx, h.x, h.y, h.w, h.h, 14);
    ctx.fill();
    ctx.restore();

    ctx.save();
    const g = ctx.createLinearGradient(0, h.y, 0, h.y + h.h);
    g.addColorStop(0, FIELD.housingTop);
    g.addColorStop(0.12, FIELD.housing);
    g.addColorStop(1, FIELD.housingLow);
    ctx.fillStyle = g;
    roundRectPath(ctx, h.x, h.y, h.w, h.h, 14);
    ctx.fill();
    ctx.strokeStyle = FIELD.housingEdge;
    ctx.lineWidth = 1;
    roundRectPath(ctx, h.x + 0.5, h.y + 0.5, h.w - 1, h.h - 1, 14);
    ctx.stroke();

    // Corner screws: four slotted heads, the instrument's fasteners.
    const screws = [
      [h.x + 9, h.y + 9],
      [h.x + h.w - 9, h.y + 9],
      [h.x + 9, h.y + h.h - 9],
      [h.x + h.w - 9, h.y + h.h - 9],
    ];
    for (const [sx, sy] of screws) {
      ctx.fillStyle = '#161c21';
      ctx.beginPath();
      ctx.arc(sx, sy, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
      ctx.beginPath();
      ctx.moveTo(sx - 2.2, sy + 1.2);
      ctx.lineTo(sx + 2.2, sy - 1.2);
      ctx.stroke();
    }

    this.recess(ctx, L.minesReadout, 7);
    this.recess(ctx, L.timeReadout, 7);
    this.makersMark(ctx, L);
    this.recess(ctx, L.well, 8);

    // The plate the keys sit on.
    ctx.fillStyle = FIELD.plate;
    ctx.fillRect(L.board.x, L.board.y, L.board.w, L.board.h);

    // Ruler ticks along the top and left of the well, a long one every five.
    ctx.fillStyle = FIELD.tick;
    for (let c = 0; c <= L.cols; c++) {
      const x = L.board.x + c * L.cell;
      const len = c % 5 === 0 ? 6 : 3;
      ctx.fillRect(Math.round(x) - 0.5, L.board.y - 2 - len, 1, len);
    }
    for (let r = 0; r <= L.rows; r++) {
      const y = L.board.y + r * L.cell;
      const len = r % 5 === 0 ? 6 : 3;
      ctx.fillRect(L.board.x - 2 - len, Math.round(y) - 0.5, len, 1);
    }
    ctx.restore();
  }

  /** The maker's name, debossed either side of the face button. */
  private makersMark(ctx: CanvasRenderingContext2D, L: FieldLayout): void {
    const y = L.face.y + 3;
    const gapL =
      L.face.x - L.face.r - 4 - (L.minesReadout.x + L.minesReadout.w);
    const gapR = L.timeReadout.x - (L.face.x + L.face.r + 4);
    ctx.save();
    ctx.font = displayFont(7.5, 800);
    const words: Array<[string, number, number]> = [
      ['FIELDMARK', L.minesReadout.x + L.minesReadout.w + gapL / 2, gapL],
      ['SURVEYOR', L.face.x + L.face.r + 4 + gapR / 2, gapR],
    ];
    for (const [word, cx, room] of words) {
      const w = trackedWidth(ctx, word, 2.2);
      if (w + 12 > room) continue;
      ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.07)';
      tracked(ctx, word, cx - w / 2, y + 1, 2.2);
      ctx.fillStyle = 'rgba(4, 7, 9, 0.55)';
      tracked(ctx, word, cx - w / 2, y, 2.2);
    }
    ctx.restore();
  }

  private recess(ctx: CanvasRenderingContext2D, r: Rect, radius: number): void {
    ctx.fillStyle = FIELD.readout;
    roundRectPath(ctx, r.x, r.y, r.w, r.h, radius);
    ctx.fill();
    ctx.save();
    roundRectPath(ctx, r.x, r.y, r.w, r.h, radius);
    ctx.clip();
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.lineWidth = 3;
    roundRectPath(ctx, r.x - 1, r.y - 1, r.w + 2, r.h + 4, radius);
    ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(r.x + radius, r.y + r.h + 0.5);
    ctx.lineTo(r.x + r.w - radius, r.y + r.h + 0.5);
    ctx.stroke();
  }

  // --------------------------------------------------------- the field ----

  renderField(ctx: CanvasRenderingContext2D, v: BoardView): void {
    const L = v.layout;
    const s = L.cell;
    const live = this.syncTiles(ctx, v);

    for (const cell of live) this.drawLive(ctx, v, cell.row, cell.col);

    for (const p of v.pressed) {
      const c = v.board.at(p.row, p.col);
      if (!c || c.revealed) continue;
      this.closedCell(ctx, v, p.row, p.col, 'pressed');
    }
    if (v.hover && !v.pressed.some(p => sameCell(p, v.hover!))) {
      const c = v.board.at(v.hover.row, v.hover.col);
      if (c && !c.revealed) {
        this.closedCell(ctx, v, v.hover.row, v.hover.col, 'hover');
      }
    }
    if (v.ghostFlag) {
      const x = L.board.x + v.ghostFlag.col * s;
      const y = L.board.y + v.ghostFlag.row * s;
      drawFlag(ctx, x, y, s, 1, 0.45);
    }
    if (v.hit && v.hitFlash) {
      const x = L.board.x + v.hit.col * s;
      const y = L.board.y + v.hit.row * s;
      ctx.save();
      ctx.fillStyle = Math.floor(v.now * 40) % 2 === 0 ? '#fff4ef' : UI.bad;
      ctx.globalAlpha = 0.85;
      ctx.fillRect(x, y, s, s);
      ctx.restore();
      drawMine(ctx, x + s / 2, y + s / 2, s * 0.24);
    }
    if (v.longPress) this.ring(ctx, L, v.longPress.cell, v.longPress.t);
    if (v.cursor) this.reticle(ctx, L, v.cursor, v.now);
    if (v.sheen !== null) this.sheen(ctx, L.board, v.sheen);
    if (v.dim > 0) {
      ctx.save();
      ctx.fillStyle = `rgba(6, 8, 9, ${Math.min(0.85, v.dim)})`;
      ctx.fillRect(L.well.x, L.well.y, L.well.w, L.well.h);
      ctx.restore();
    }
  }

  /**
   * Bring the tile cache up to date and blit it. Returns the cells that
   * are mid-animation and must be drawn live this frame.
   */
  private syncTiles(ctx: CanvasRenderingContext2D, v: BoardView): CellRef[] {
    const L = v.layout;
    const s = L.cell;
    const key = `${L.cols}x${L.rows}@${s}`;
    if (this.cacheEnabled && (this.tilesKey !== key || !this.tiles)) {
      this.tiles = makeLayer(L.board.w, L.board.h);
      this.tilesKey = key;
      this.sigs = [];
      for (let r = 0; r < L.rows; r++)
        this.sigs.push(new Array(L.cols).fill(SIG_NONE));
    }
    const cached = this.cacheEnabled && this.tiles !== null;
    const target = cached ? this.tiles!.ctx : ctx;
    const ox = cached ? 0 : L.board.x;
    const oy = cached ? 0 : L.board.y;

    const live: CellRef[] = [];
    let redraws = 0;
    for (let r = 0; r < L.rows; r++) {
      for (let c = 0; c < L.cols; c++) {
        const cell = v.board.cells[r][c];
        const fx = v.fx[r][c];
        const sig = this.signature(v, r, c);
        if (this.isLive(cell, fx, v.now)) live.push({ row: r, col: c });
        if (cached && this.sigs[r][c] === sig) continue;
        this.paintSettled(
          target,
          ox + c * s,
          oy + r * s,
          s,
          sig,
          cell.neighbors,
          r * 97 + c
        );
        if (cached) this.sigs[r][c] = sig;
        redraws++;
      }
    }
    this.lastRedraws = redraws;
    if (cached) ctx.drawImage(this.tiles!.canvas, L.board.x, L.board.y);
    return live;
  }

  /** What a cell looks like with every in-flight animation stripped off. */
  private signature(v: BoardView, r: number, c: number): number {
    const cell = v.board.cells[r][c];
    const fx = v.fx[r][c];
    const now = v.now;
    if (v.hit && v.hit.row === r && v.hit.col === c) return SIG_HIT;
    if (cell.revealed && !cell.mine) {
      if (now < fx.revealT) return SIG_KEY;
      if (now < fx.revealT + POP_TIME) return SIG_PLATE;
      return SIG_PLATE + cell.neighbors;
    }
    if (cell.mine && fx.detonateT <= now) return SIG_MINE;
    if (cell.flagged) {
      if (now < fx.flagT + PLANT_TIME) return SIG_KEY;
      if (fx.wrongT + CROSS_TIME <= now) return SIG_WRONG;
      return SIG_FLAG;
    }
    return SIG_KEY;
  }

  private isLive(
    cell: { revealed: boolean; flagged: boolean; mine: boolean },
    fx: CellFx,
    now: number
  ): boolean {
    if (cell.revealed && now >= fx.revealT && now < fx.revealT + POP_TIME) {
      return true;
    }
    if (cell.flagged && now >= fx.flagT && now < fx.flagT + PLANT_TIME) {
      return true;
    }
    if (!cell.flagged && now >= fx.unflagT && now < fx.unflagT + UNPLANT_TIME) {
      return true;
    }
    if (now >= fx.detonateT && now < fx.detonateT + FLASH_TIME) return true;
    if (now >= fx.wrongT && now < fx.wrongT + CROSS_TIME) return true;
    return false;
  }

  private paintSettled(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    s: number,
    sig: number,
    neighbours: number,
    seed: number
  ): void {
    if (sig === SIG_HIT) {
      drawScorch(ctx, x, y, s, seed);
      drawMine(ctx, x + s / 2, y + s / 2, s * 0.24);
      return;
    }
    drawPlate(ctx, x, y, s);
    if (sig >= SIG_PLATE && sig < SIG_MINE) {
      drawNumber(ctx, x, y, s, neighbours);
    } else if (sig === SIG_MINE) {
      drawBurntPlate(ctx, x, y, s);
      drawMine(ctx, x + s / 2, y + s / 2, s * 0.24);
    } else if (sig === SIG_KEY || sig === SIG_FLAG || sig === SIG_WRONG) {
      drawKey(ctx, x, y, s, 'idle', seed);
      if (sig === SIG_FLAG) drawFlag(ctx, x, y, s);
      if (sig === SIG_WRONG) {
        drawFlag(ctx, x, y, s, 1, 0.45);
        drawWrongMark(ctx, x, y, s);
      }
    }
  }

  /** A cell mid-animation, drawn over its neutral cached state. */
  private drawLive(
    ctx: CanvasRenderingContext2D,
    v: BoardView,
    r: number,
    c: number
  ): void {
    const L = v.layout;
    const s = L.cell;
    const x = L.board.x + c * s;
    const y = L.board.y + r * s;
    const cell = v.board.cells[r][c];
    const fx = v.fx[r][c];
    const now = v.now;

    if (cell.revealed && !cell.mine && now < fx.revealT + POP_TIME) {
      const k = (now - fx.revealT) / POP_TIME;
      // The key lifts off and shrinks away...
      if (k < 0.55) {
        const q = k / 0.55;
        ctx.save();
        ctx.globalAlpha = 1 - q;
        const sc = 1 - 0.3 * q;
        ctx.translate(x + s / 2, y + s / 2 - q * s * 0.12);
        ctx.scale(sc, sc);
        drawKey(ctx, -s / 2, -s / 2, s, 'idle', r * 97 + c);
        ctx.restore();
      }
      // ...and the number underneath pops up to size.
      if (cell.neighbors > 0) {
        const sc = 0.85 + 0.15 * ease.outBack(k);
        ctx.save();
        ctx.globalAlpha = Math.min(1, k * 2.2);
        ctx.translate(x + s / 2, y + s / 2);
        ctx.scale(sc, sc);
        drawNumber(ctx, -s / 2, -s / 2, s, cell.neighbors);
        ctx.restore();
      }
      return;
    }
    if (now >= fx.detonateT && now < fx.detonateT + FLASH_TIME) {
      // A red bloom with a white-hot core that burns out first.
      const k = (now - fx.detonateT) / FLASH_TIME;
      ctx.save();
      ctx.globalAlpha = (1 - k) * 0.85;
      ctx.fillStyle = UI.bad;
      ctx.beginPath();
      ctx.arc(x + s / 2, y + s / 2, s * (0.25 + 0.45 * k), 0, Math.PI * 2);
      ctx.fill();
      if (k < 0.4) {
        ctx.globalAlpha = 1 - k / 0.4;
        ctx.fillStyle = '#fff4ef';
        ctx.beginPath();
        ctx.arc(x + s / 2, y + s / 2, s * 0.16, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      return;
    }
    if (cell.flagged && now < fx.flagT + PLANT_TIME) {
      const k = (now - fx.flagT) / PLANT_TIME;
      drawFlag(ctx, x, y, s, ease.outBack(k), Math.min(1, k * 3));
      return;
    }
    if (!cell.flagged && now < fx.unflagT + UNPLANT_TIME) {
      const k = (now - fx.unflagT) / UNPLANT_TIME;
      drawFlag(ctx, x, y, s, 1 - k, 1 - k);
      return;
    }
    if (now >= fx.wrongT && now < fx.wrongT + CROSS_TIME) {
      drawFlag(ctx, x, y, s, 1, 0.45);
      drawWrongMark(ctx, x, y, s, (now - fx.wrongT) / CROSS_TIME);
    }
  }

  private closedCell(
    ctx: CanvasRenderingContext2D,
    v: BoardView,
    r: number,
    c: number,
    state: KeyState
  ): void {
    const L = v.layout;
    const s = L.cell;
    const x = L.board.x + c * s;
    const y = L.board.y + r * s;
    drawPlate(ctx, x, y, s);
    drawKey(ctx, x, y, s, state, r * 97 + c);
    const cell = v.board.cells[r][c];
    if (cell.flagged && v.now >= v.fx[r][c].flagT + PLANT_TIME) {
      drawFlag(ctx, x, y + (state === 'pressed' ? 1 : 0), s);
    }
  }

  /** The long-press ring: tape-pink, sweeping clockwise to a flag. */
  private ring(
    ctx: CanvasRenderingContext2D,
    L: FieldLayout,
    cell: CellRef,
    t: number
  ): void {
    const cx = L.board.x + (cell.col + 0.5) * L.cell;
    const cy = L.board.y + (cell.row + 0.5) * L.cell;
    const r = L.cell * 0.62 + 4 * (1 - t);
    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(6, 8, 9, 0.55)';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = FIELD.tape;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * t);
    ctx.stroke();
    ctx.restore();
  }

  /** The keyboard cursor: survey reticle corners around the tile. */
  private reticle(
    ctx: CanvasRenderingContext2D,
    L: FieldLayout,
    cell: CellRef,
    now: number
  ): void {
    const s = L.cell;
    const x = L.board.x + cell.col * s;
    const y = L.board.y + cell.row * s;
    const pad = 1.5 + Math.sin(now * 6) * 1;
    const arm = Math.max(5, s * 0.28);
    ctx.save();
    ctx.strokeStyle = FIELD.bone;
    ctx.lineWidth = 2;
    ctx.lineCap = 'square';
    const x0 = x - pad;
    const y0 = y - pad;
    const x1 = x + s + pad;
    const y1 = y + s + pad;
    ctx.beginPath();
    ctx.moveTo(x0, y0 + arm);
    ctx.lineTo(x0, y0);
    ctx.lineTo(x0 + arm, y0);
    ctx.moveTo(x1 - arm, y0);
    ctx.lineTo(x1, y0);
    ctx.lineTo(x1, y0 + arm);
    ctx.moveTo(x1, y1 - arm);
    ctx.lineTo(x1, y1);
    ctx.lineTo(x1 - arm, y1);
    ctx.moveTo(x0 + arm, y1);
    ctx.lineTo(x0, y1);
    ctx.lineTo(x0, y1 - arm);
    ctx.stroke();
    ctx.restore();
  }

  /** The victory sheen: one diagonal band of light across the field. */
  private sheen(ctx: CanvasRenderingContext2D, b: Rect, t: number): void {
    const k = ease.inOutSine(t);
    const span = b.w + b.h;
    const cx = b.x - b.h + k * (span + b.h);
    ctx.save();
    ctx.beginPath();
    ctx.rect(b.x, b.y, b.w, b.h);
    ctx.clip();
    const g = ctx.createLinearGradient(cx - 60, b.y, cx + 60, b.y + b.h * 0.3);
    g.addColorStop(0, 'rgba(255, 255, 255, 0)');
    g.addColorStop(0.5, 'rgba(236, 229, 214, 0.22)');
    g.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.restore();
  }
}

export function sameCell(a: CellRef, b: CellRef): boolean {
  return a.row === b.row && a.col === b.col;
}
