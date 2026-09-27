// ===== src/games/minesweeper/systems/Layout.ts =====
//
// Where everything sits, for a given field size. Three bands, top to
// bottom: the instrument (a readout strip and the field in one slate
// housing), then the desk strip (difficulty keys, the flag-mode switch, the
// best time, the hint line). The instrument is centred in the space above
// the desk, so a small field floats as one object instead of leaving its
// readouts stranded at the top of the screen. Nothing here draws; the
// renderers and the input path both read the same rects, so what is drawn
// is exactly what is clickable.

import type { Difficulty } from './Board';

export const CANVAS_W = 800;
export const CANVAS_H = 600;
/** The readout strip at the top of the housing. */
export const HEADER_H = 46;
/** The desk strip along the bottom of the canvas. */
export const FOOTER_H = 54;
/** Clear space between the tiles and any other band. */
export const BOARD_MARGIN = 12;
/**
 * Clear space above the housing and between it and the desk strip, so the
 * instrument never sits flush with the canvas edge (its screws and soft
 * shadow need the room).
 */
export const HOUSING_GAP = 12;
export const MIN_CELL = 20;
export const MAX_CELL = 36;
/** The housing never gets narrower than its readouts need. */
const MIN_HOUSING_W = 452;
/** Keeps the housing's edge off the canvas edge on the widest field. */
const SIDE_GUTTER = 8;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface FieldLayout {
  cols: number;
  rows: number;
  cell: number;
  /** The tiles themselves. */
  board: Rect;
  /** The tiles plus their margin: the recessed well inside the housing. */
  well: Rect;
  /** The readout strip. */
  header: Rect;
  /** Header and well together: the instrument. */
  housing: Rect;
  /** The desk strip. */
  footer: Rect;
  face: { x: number; y: number; r: number };
  minesReadout: Rect;
  timeReadout: Rect;
  keys: Record<Difficulty, Rect>;
  flagSwitch: Rect;
  best: Rect;
  hintY: number;
}

export type HudTarget =
  | { kind: 'cell'; row: number; col: number }
  | { kind: 'face' }
  | { kind: 'key'; id: Difficulty }
  | { kind: 'flagSwitch' };

const KEY_W: Record<Difficulty, number> = { easy: 96, medium: 128, hard: 114 };
const KEY_GAP = 6;
const SWITCH_W = 146;
const BEST_W = 124;
const GROUP_GAP = 22;
const ROW_H = 26;

export function computeLayout(
  cols: number,
  rows: number,
  width = CANVAS_W,
  height = CANVAS_H
): FieldLayout {
  const footer: Rect = { x: 0, y: height - FOOTER_H, w: width, h: FOOTER_H };

  const fitW = Math.floor((width - BOARD_MARGIN * 2 - SIDE_GUTTER * 2) / cols);
  const fitH = Math.floor(
    (footer.y - HOUSING_GAP * 2 - HEADER_H - BOARD_MARGIN * 2) / rows
  );
  const cell = Math.max(MIN_CELL, Math.min(MAX_CELL, fitW, fitH));

  const boardW = cols * cell;
  const boardH = rows * cell;
  const wellW = boardW + BOARD_MARGIN * 2;
  const wellH = boardH + BOARD_MARGIN * 2;
  const housingW = Math.max(wellW, MIN_HOUSING_W);
  const housingH = HEADER_H + wellH;
  const top = Math.max(HOUSING_GAP, Math.floor((footer.y - housingH) / 2));
  const housingX = Math.round((width - housingW) / 2);

  const housing: Rect = { x: housingX, y: top, w: housingW, h: housingH };
  const header: Rect = { x: housingX, y: top, w: housingW, h: HEADER_H };
  const board: Rect = {
    x: Math.round((width - boardW) / 2),
    y: top + HEADER_H + BOARD_MARGIN,
    w: boardW,
    h: boardH,
  };
  const well: Rect = {
    x: board.x - BOARD_MARGIN,
    y: board.y - BOARD_MARGIN,
    w: wellW,
    h: wellH,
  };

  const readoutW = 112;
  const readoutH = 30;
  const readoutY = header.y + 9;
  const minesReadout: Rect = {
    x: header.x + 12,
    y: readoutY,
    w: readoutW,
    h: readoutH,
  };
  const timeReadout: Rect = {
    x: header.x + header.w - 12 - readoutW,
    y: readoutY,
    w: readoutW,
    h: readoutH,
  };
  const face = { x: width / 2, y: header.y + HEADER_H / 2 + 1, r: 15 };

  // Desk strip: keys, a gap, the switch, a gap, the best time; centred.
  const keysW = KEY_W.easy + KEY_W.medium + KEY_W.hard + KEY_GAP * 2;
  const rowW = keysW + GROUP_GAP + SWITCH_W + GROUP_GAP + BEST_W;
  const rowY = footer.y + 7;
  let x = Math.round((width - rowW) / 2);
  const keys = {} as Record<Difficulty, Rect>;
  for (const id of ['easy', 'medium', 'hard'] as const) {
    keys[id] = { x, y: rowY, w: KEY_W[id], h: ROW_H };
    x += KEY_W[id] + KEY_GAP;
  }
  x += GROUP_GAP - KEY_GAP;
  const flagSwitch: Rect = { x, y: rowY, w: SWITCH_W, h: ROW_H };
  x += SWITCH_W + GROUP_GAP;
  const best: Rect = { x, y: rowY, w: BEST_W, h: ROW_H };

  return {
    cols,
    rows,
    cell,
    board,
    well,
    header,
    housing,
    footer,
    face,
    minesReadout,
    timeReadout,
    keys,
    flagSwitch,
    best,
    hintY: footer.y + 47,
  };
}

export function contains(r: Rect, x: number, y: number): boolean {
  return x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
}

export function intersects(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
  );
}

/** The tile under a canvas point, or null. */
export function cellAt(
  layout: FieldLayout,
  x: number,
  y: number
): { row: number; col: number } | null {
  if (!contains(layout.board, x, y)) return null;
  const col = Math.floor((x - layout.board.x) / layout.cell);
  const row = Math.floor((y - layout.board.y) / layout.cell);
  if (row < 0 || row >= layout.rows || col < 0 || col >= layout.cols) {
    return null;
  }
  return { row, col };
}

/** Centre of a tile in canvas pixels. */
export function cellCentre(
  layout: FieldLayout,
  row: number,
  col: number
): { x: number; y: number } {
  return {
    x: layout.board.x + (col + 0.5) * layout.cell,
    y: layout.board.y + (row + 0.5) * layout.cell,
  };
}

/** Everything the pointer can press, in one place. */
export function hitTest(
  layout: FieldLayout,
  x: number,
  y: number
): HudTarget | null {
  const cell = cellAt(layout, x, y);
  if (cell) return { kind: 'cell', ...cell };
  const dx = x - layout.face.x;
  const dy = y - layout.face.y;
  const reach = layout.face.r + 5;
  if (dx * dx + dy * dy <= reach * reach) return { kind: 'face' };
  for (const id of ['easy', 'medium', 'hard'] as const) {
    if (contains(layout.keys[id], x, y)) return { kind: 'key', id };
  }
  if (contains(layout.flagSwitch, x, y)) return { kind: 'flagSwitch' };
  return null;
}
