// ===== src/games/snake/systems/TurnQueue.ts =====
//
// The snake moves one cell per step, but players turn between steps. The
// old code kept a single "next direction" and checked it against the LAST
// MOVED heading, so "up then left" tapped inside one step dropped the left:
// it read as a reverse of the still-current right heading. At 7-13 steps a
// second that was most of the deaths a good player suffered.
//
// This queue holds up to two pending turns. Each one is validated against
// the direction the queue will ALREADY be facing when it runs, so a quick
// two-key corner is kept, and a 180 is never accepted from any source.

export type Dir = 'up' | 'down' | 'left' | 'right';

export const DIRS: readonly Dir[] = ['up', 'down', 'left', 'right'];

export const DIR_VEC: Record<Dir, { x: number; y: number }> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

export const OPPOSITE: Record<Dir, Dir> = {
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
};

export function dirAngle(dir: Dir): number {
  const v = DIR_VEC[dir];
  return Math.atan2(v.y, v.x);
}

export class TurnQueue {
  private pending: Dir[] = [];
  private moved: Dir;

  constructor(
    heading: Dir = 'right',
    private readonly capacity = 2
  ) {
    this.moved = heading;
  }

  /** The direction of the last step the snake actually took. */
  get heading(): Dir {
    return this.moved;
  }

  /** The direction the snake will face once every queued turn has run. */
  last(): Dir {
    return this.pending.length > 0
      ? this.pending[this.pending.length - 1]
      : this.moved;
  }

  /** Whether `dir` would be accepted right now. */
  accepts(dir: Dir): boolean {
    if (this.pending.length >= this.capacity) return false;
    const prev = this.last();
    return dir !== prev && dir !== OPPOSITE[prev];
  }

  push(dir: Dir): boolean {
    if (!this.accepts(dir)) return false;
    this.pending.push(dir);
    return true;
  }

  /**
   * Queue every direction pressed on one frame. Two keys can land on the
   * same frame; order them so the turn that is legal now goes first
   * (right-heading, up+left together → up, then left), instead of letting
   * array order decide which one is dropped as a reverse.
   */
  pushAll(dirs: readonly Dir[]): void {
    const left = [...dirs];
    let progressed = true;
    while (left.length > 0 && progressed) {
      progressed = false;
      for (let i = 0; i < left.length; i++) {
        if (this.push(left[i])) {
          left.splice(i, 1);
          progressed = true;
          break;
        }
      }
    }
  }

  /** Take the direction for this step (the next queued turn, if any). */
  next(): Dir {
    const turn = this.pending.shift();
    if (turn) this.moved = turn;
    return this.moved;
  }

  /** Point the snake somewhere without a turn (respawn, steering). */
  force(dir: Dir): void {
    this.moved = dir;
    this.pending = [];
  }

  queued(): readonly Dir[] {
    return this.pending;
  }

  reset(heading: Dir): void {
    this.moved = heading;
    this.pending = [];
  }
}
