// ===== src/games/memory/entities/Card.ts =====
//
// One card on the table, and the layout that places a table's cards between
// the two rails. A card's LOGICAL state is `faceUp` (the player turned it)
// and `matched`; `peeked` is a temporary reveal owned by PEEK / HINT and the
// time-out finale, kept apart so a peek can never undo the player's flip.
// Everything else is animation, advanced with dt in the game's update.

export interface Card {
  id: number;
  row: number;
  col: number;
  /** Index into the icon set; the two cards of a pair share it. */
  value: number;
  /** Slot rectangle on the table. */
  x: number;
  y: number;
  w: number;
  h: number;

  faceUp: boolean;
  matched: boolean;
  peeked: boolean;
  /** Has this card ever been seen face up? Drives the recall ghost. */
  seen: boolean;

  /** 0 = back, 1 = face; eased toward the target with dt. */
  shown: number;
  /** Hover lift, 0..1. */
  hover: number;
  /** Seconds left on the match pop / emerald pulse / mismatch shake. */
  pop: number;
  pulse: number;
  shake: number;
  /** Seconds left on the red mismatch edge. */
  miss: number;
  /** Seconds left on the recall ghost. */
  ghost: number;
  /** Deal-in progress 0..1 (1 = in its slot) and its start delay. */
  deal: number;
  dealDelay: number;
  /** Fan-out progress on a table clear, 0..1. */
  leave: number;
}

/** Whether the card's face should be showing right now. */
export function faceTarget(c: Card): boolean {
  return c.faceUp || c.matched || c.peeked;
}

export function makeCard(
  id: number,
  row: number,
  col: number,
  value: number
): Card {
  return {
    id,
    row,
    col,
    value,
    x: 0,
    y: 0,
    w: 0,
    h: 0,
    faceUp: false,
    matched: false,
    peeked: false,
    seen: false,
    shown: 0,
    hover: 0,
    pop: 0,
    pulse: 0,
    shake: 0,
    miss: 0,
    ghost: 0,
    deal: 0,
    dealDelay: 0,
    leave: 0,
  };
}

// ------------------------------------------------------------- layout ----

/** The two rails: HUD on top, power-ups and the hint line on the bottom. */
export const TOP_BAND = 56;
export const BOTTOM_BAND = 60;

export interface GridLayout {
  rows: number;
  cols: number;
  cardW: number;
  cardH: number;
  gap: number;
  originX: number;
  originY: number;
  /** The whole grid's bounds, for the table inlay. */
  width: number;
  height: number;
}

/** Card width over height. A little squarer than a playing card. */
const ASPECT = 0.8;
const MAX_CARD_H = 128;
const PAD = 16;

export function computeLayout(
  rows: number,
  cols: number,
  canvasW: number,
  canvasH: number
): GridLayout {
  const areaW = canvasW - PAD * 2;
  const areaH = canvasH - TOP_BAND - BOTTOM_BAND - PAD * 2;
  const gap = rows >= 6 ? 8 : rows >= 5 ? 9 : 12;

  let cardH = Math.min(MAX_CARD_H, (areaH - (rows - 1) * gap) / rows);
  let cardW = cardH * ASPECT;
  const fitW = (areaW - (cols - 1) * gap) / cols;
  if (cardW > fitW) {
    cardW = fitW;
    cardH = cardW / ASPECT;
  }
  cardW = Math.floor(cardW);
  cardH = Math.floor(cardH);

  const width = cols * cardW + (cols - 1) * gap;
  const height = rows * cardH + (rows - 1) * gap;
  const originX = Math.round((canvasW - width) / 2);
  const originY = Math.round(
    TOP_BAND + (canvasH - TOP_BAND - BOTTOM_BAND - height) / 2
  );
  return { rows, cols, cardW, cardH, gap, originX, originY, width, height };
}

export function placeCard(card: Card, layout: GridLayout): void {
  card.x = layout.originX + card.col * (layout.cardW + layout.gap);
  card.y = layout.originY + card.row * (layout.cardH + layout.gap);
  card.w = layout.cardW;
  card.h = layout.cardH;
}

/** The card whose slot contains the point, or null. */
export function cardAt(
  cards: readonly Card[],
  x: number,
  y: number
): Card | null {
  for (const c of cards) {
    if (x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h) return c;
  }
  return null;
}
