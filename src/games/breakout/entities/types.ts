// The things on the court. Plain data: the systems move them and the
// renderers draw them, so a test can build any of them by hand.

import { BALL_R, PADDLE_H, PADDLE_W, PADDLE_Y, VIEW_W } from '../constants';

export interface Point {
  x: number;
  y: number;
}

export interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  /** Riding the paddle (serve, or caught by CATCH). */
  stuck: boolean;
  /** Where on the paddle it rides, -1 (left end) .. 1 (right end). */
  stuckOffset: number;
  /** Seconds it has been riding, for the auto-release. */
  stuckTime: number;
  /** Speed to leave with when released. */
  speed: number;
  /** Seconds of white flash left after a paddle return. */
  flash: number;
  /** Recent positions, oldest first, for the comet trail. */
  trail: Point[];
}

export interface CrackPath {
  points: Point[];
}

export interface Brick {
  x: number;
  y: number;
  w: number;
  h: number;
  row: number;
  col: number;
  hp: number;
  maxHp: number;
  alive: boolean;
  /** Steel: only a BLAST or a x3 streak dents it; not needed to clear. */
  armored: boolean;
  color: string;
  /** Seconds of hit shake / white flash left. */
  shake: number;
  flash: number;
  /** Drop-in: seconds to wait, then progress 0..1 to settled. */
  enterDelay: number;
  enter: number;
  /** Shuttle row: x swings around baseX by `drift` px. 0 = fixed. */
  baseX: number;
  drift: number;
  /** Pre-rolled cracks, shown one per point of damage. */
  cracks: CrackPath[];
}

export type PowerType = 'widen' | 'multi' | 'slow' | 'life' | 'catch' | 'blast';

export interface Capsule {
  x: number;
  y: number;
  vy: number;
  type: PowerType;
  /** Age in seconds, drives the wobble. */
  age: number;
}

export interface Paddle {
  /** Centre x. */
  cx: number;
  y: number;
  w: number;
  targetW: number;
  h: number;
  vx: number;
  /** Seconds of squash left after a return. */
  squash: number;
  /** 0..1 thruster brightness, eased toward current speed. */
  thrust: number;
}

export function makePaddle(): Paddle {
  return {
    cx: VIEW_W / 2,
    y: PADDLE_Y,
    w: PADDLE_W,
    targetW: PADDLE_W,
    h: PADDLE_H,
    vx: 0,
    squash: 0,
    thrust: 0,
  };
}

export function makeBall(x: number, y: number, vx = 0, vy = 0): Ball {
  return {
    x,
    y,
    vx,
    vy,
    r: BALL_R,
    stuck: false,
    stuckOffset: 0,
    stuckTime: 0,
    speed: Math.hypot(vx, vy),
    flash: 0,
    trail: [],
  };
}
