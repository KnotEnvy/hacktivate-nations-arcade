// ===== src/games/snake/systems/Respawn.ts =====
//
// Where a snake hatches after losing a life. The old game froze the snake
// nose-first into the wall it hit and waited for a turn; if none came the
// next step cost another life, then the last one. Now the snake hatches at
// the board centre, half its length (never under START_LENGTH), laid out
// behind the head, facing the direction with the most open room.
//
// The body is laid as a boustrophedon behind the head: straight back to
// the wall, then folding row by row toward one side. That keeps every cell
// adjacent to the next, keeps the head's forward line clear, and fits any
// length up to the region's capacity (longer bodies are trimmed to it).

import { COLS, ROWS } from '../constants';
import { DIRS, DIR_VEC, Dir, OPPOSITE } from './TurnQueue';

export interface Cell {
  x: number;
  y: number;
}

export const RESPAWN_CELL: Cell = {
  x: Math.floor(COLS / 2),
  y: Math.floor(ROWS / 2),
};

export function inBounds(x: number, y: number): boolean {
  return x >= 0 && x < COLS && y >= 0 && y < ROWS;
}

/** Free cells in a straight line from `from` (exclusive) toward `dir`. */
export function openRoom(from: Cell, dir: Dir): number {
  const v = DIR_VEC[dir];
  let n = 0;
  let x = from.x + v.x;
  let y = from.y + v.y;
  while (inBounds(x, y)) {
    n++;
    x += v.x;
    y += v.y;
  }
  return n;
}

/**
 * Pick the facing with the most room ahead. Ties go to the direction that
 * points away from `away` (where the last life ended), then to DIRS order.
 */
export function respawnFacing(away: Cell | null): Dir {
  const head = RESPAWN_CELL;
  let best: Dir = 'right';
  let bestScore = -Infinity;
  for (const d of DIRS) {
    const v = DIR_VEC[d];
    const room = openRoom(head, d);
    const lean = away ? v.x * (head.x - away.x) + v.y * (head.y - away.y) : 0;
    const score = room * 1000 + Math.sign(lean) * 10;
    if (score > bestScore) {
      bestScore = score;
      best = d;
    }
  }
  return best;
}

/** Lay out a snake of `length` cells, head first, facing `facing`. */
export function layoutRespawn(length: number, facing: Dir): Cell[] {
  const head = RESPAWN_CELL;
  const f = DIR_VEC[facing];
  const perp: Dir[] =
    facing === 'left' || facing === 'right'
      ? ['down', 'up']
      : ['right', 'left'];
  const side =
    openRoom(head, perp[0]) >= openRoom(head, perp[1]) ? perp[0] : perp[1];
  const s = DIR_VEC[side];
  const back = openRoom(head, OPPOSITE[facing]);
  const rows = openRoom(head, side);

  const at = (a: number, b: number): Cell => ({
    x: head.x + a * f.x + b * s.x,
    y: head.y + a * f.y + b * s.y,
  });

  const cells: Cell[] = [{ ...head }];
  // Row 0: straight back from the head.
  for (let a = -1; a >= -back && cells.length < length; a--) {
    cells.push(at(a, 0));
  }
  // Then fold toward the side, row by row, never in front of the head.
  for (let b = 1; b <= rows && cells.length < length; b++) {
    const forward = b % 2 === 1;
    for (let i = 0; i <= back && cells.length < length; i++) {
      const a = forward ? -back + i : -i;
      cells.push(at(a, b));
    }
  }
  return cells;
}
