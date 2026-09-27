// Court layouts. Five patterns rotate — full wall, checker, pyramid, columns
// with windows, and a fortress around a 4hp core — and from level 6 a
// shuttle row slides across under the layout. Hit points climb one step
// every five levels; serve speed climbs 4% a level up to +40% (level 11).

import {
  ARENA,
  BASE_SPEED,
  BRICK_COLS,
  BRICK_H,
  BRICK_PITCH_X,
  BRICK_PITCH_Y,
  BRICK_RAMP,
  BRICK_SIDE_PAD,
  BRICK_TOP,
  BRICK_W,
  COURT,
  LEVEL_SPEED_CAP,
  LEVEL_SPEED_STEP,
  ROW_DROP_DELAY,
} from '../constants';
import type { Brick, CrackPath, Point } from '../entities/types';

export const LAYOUT_NAMES = [
  'wall',
  'checker',
  'pyramid',
  'columns',
  'fortress',
] as const;
export type LayoutName = (typeof LAYOUT_NAMES)[number];

export interface BrickSpec {
  row: number;
  col: number;
  hp: number;
  armored?: boolean;
}

export interface Layout {
  name: LayoutName;
  rows: number;
  specs: BrickSpec[];
}

/** First level the shuttle row appears on. */
export const SHUTTLE_LEVEL = 6;

export function layoutName(level: number): LayoutName {
  return LAYOUT_NAMES[(Math.max(1, level) - 1) % LAYOUT_NAMES.length];
}

/** Serve speed for a level: +4% a level, capped at +40%. */
export function levelSpeed(level: number): number {
  const scale = Math.min(
    LEVEL_SPEED_CAP,
    1 + LEVEL_SPEED_STEP * (Math.max(1, level) - 1)
  );
  return BASE_SPEED * scale;
}

/** Extra hit points on every non-steel brick: +1 at level 6, +2 at 11. */
export function hpBonus(level: number): number {
  return Math.floor((Math.max(1, level) - 1) / 5);
}

function grid(
  rows: number,
  keep: (r: number, c: number) => boolean,
  hp: (r: number, c: number) => number
): BrickSpec[] {
  const out: BrickSpec[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < BRICK_COLS; c++) {
      if (keep(r, c)) out.push({ row: r, col: c, hp: hp(r, c) });
    }
  }
  return out;
}

function fortress(): BrickSpec[] {
  // Curtain wall on top, towers down both sides, a 4hp core behind a steel
  // shield, and a gate in the bottom wall. The side passages reach the core
  // without breaking steel, so the level never needs a BLAST to clear.
  const rows = [
    'WWWWWWWWWW',
    'T.bbbbbb.T',
    'T.SbbbbS.T',
    'T.bCCCCb.T',
    'T..SSSS..T',
    'TTb....bTT',
    'bbbb..bbbb',
  ];
  const out: BrickSpec[] = [];
  rows.forEach((line, r) => {
    [...line].forEach((ch, c) => {
      if (ch === 'W') out.push({ row: r, col: c, hp: 2 });
      else if (ch === 'T') out.push({ row: r, col: c, hp: 2 });
      else if (ch === 'b') out.push({ row: r, col: c, hp: 1 });
      else if (ch === 'C') out.push({ row: r, col: c, hp: 4 });
      else if (ch === 'S') out.push({ row: r, col: c, hp: 4, armored: true });
    });
  });
  return out;
}

export function buildLayout(level: number): Layout {
  const name = layoutName(level);
  switch (name) {
    case 'wall':
      return {
        name,
        rows: 5,
        specs: grid(
          5,
          () => true,
          r => (r === 0 ? 2 : 1)
        ),
      };
    case 'checker':
      return {
        name,
        rows: 6,
        specs: grid(
          6,
          (r, c) => (r + c) % 2 === 0,
          r => (r < 2 ? 2 : 1)
        ),
      };
    case 'pyramid':
      return {
        name,
        rows: 7,
        specs: grid(
          7,
          (r, c) => c >= Math.max(0, 4 - r) && c <= Math.min(9, 5 + r),
          r => (r === 0 ? 3 : r < 3 ? 2 : 1)
        ),
      };
    case 'columns':
      return {
        name,
        rows: 7,
        specs: grid(
          7,
          (r, c) => c % 3 !== 2 && r !== (Math.floor(c / 3) % 2 === 0 ? 2 : 4),
          r => (r < 2 ? 2 : 1)
        ),
      };
    case 'fortress':
    default:
      return { name: 'fortress', rows: 7, specs: fortress() };
  }
}

/** Tiny deterministic PRNG so a brick's cracks are the same every run. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Three jagged cracks per brick, relative to its top-left corner. */
export function rollCracks(w: number, h: number, seed: number): CrackPath[] {
  const rand = seeded(seed);
  const out: CrackPath[] = [];
  for (let i = 0; i < 3; i++) {
    const fromTop = rand() < 0.5;
    // Spread the three cracks across the tile so each new one is visible.
    const x0 = w * (0.18 + 0.3 * i + rand() * 0.14);
    const pts: Point[] = [{ x: x0, y: fromTop ? 0 : h }];
    let x = x0;
    let y = fromTop ? 0 : h;
    const segs = 3 + Math.floor(rand() * 2);
    for (let s = 0; s < segs; s++) {
      x += (rand() - 0.5) * 14;
      y += ((fromTop ? 1 : -1) * h * (0.45 + rand() * 0.35)) / (segs - 1);
      pts.push({ x, y: Math.max(1, Math.min(h - 1, y)) });
    }
    out.push({ points: pts });
  }
  return out;
}

function rowColor(row: number, rows: number): string {
  if (rows <= 1) return BRICK_RAMP[0];
  const idx = Math.round((row / (rows - 1)) * (BRICK_RAMP.length - 1));
  return BRICK_RAMP[idx];
}

/**
 * Turn a level into bricks. `animate` staggers a drop-in row by row; the
 * physics always uses the settled position, the drop is only drawn.
 */
export function makeBricks(level: number, animate: boolean): Brick[] {
  const layout = buildLayout(level);
  const bonus = hpBonus(level);
  const bricks: Brick[] = [];
  const x0 = ARENA.left + BRICK_SIDE_PAD;

  const push = (
    spec: BrickSpec,
    color: string,
    y: number,
    drift: number
  ): void => {
    const hp = spec.armored ? 4 : Math.min(4, spec.hp + bonus);
    const x = x0 + spec.col * BRICK_PITCH_X;
    bricks.push({
      x,
      y,
      w: BRICK_W,
      h: BRICK_H,
      row: spec.row,
      col: spec.col,
      hp,
      maxHp: hp,
      alive: true,
      armored: !!spec.armored,
      color: spec.armored ? COURT.steel : color,
      shake: 0,
      flash: 0,
      enterDelay: animate ? spec.row * ROW_DROP_DELAY : 0,
      enter: animate ? 0 : 1,
      baseX: x,
      drift,
      cracks: rollCracks(
        BRICK_W,
        BRICK_H,
        level * 977 + spec.row * 131 + spec.col * 17
      ),
    });
  };

  for (const spec of layout.specs) {
    push(
      spec,
      rowColor(spec.row, layout.rows),
      BRICK_TOP + spec.row * BRICK_PITCH_Y,
      0
    );
  }

  if (level >= SHUTTLE_LEVEL) {
    // Four bricks one row under the layout, sliding a full column each way.
    const row = layout.rows + 1;
    for (const col of [1, 3, 5, 7]) {
      push(
        { row, col, hp: 1 },
        BRICK_RAMP[BRICK_RAMP.length - 1],
        BRICK_TOP + row * BRICK_PITCH_Y,
        BRICK_PITCH_X
      );
    }
  }
  return bricks;
}

/** Bricks the player has to break to clear the court (steel is optional). */
export function requiredLeft(bricks: Brick[]): number {
  let n = 0;
  for (const b of bricks) if (b.alive && !b.armored) n++;
  return n;
}
