// Ball physics: substepped movement and the angle rules.
//
// The loop clamps dt at 0.05s, and a ball at MAX_BALL_SPEED covers 28px in
// that time — more than a brick (20px) or the paddle (14px) is tall. So the
// ball never moves more than MAX_SUBSTEP px between collision checks, and a
// collision is resolved by pushing the ball fully outside what it hit.

import {
  MAX_BOUNCE_ANGLE,
  MAX_SUBSTEP,
  MIN_OFF_VERTICAL,
  MIN_VY_FRACTION,
  PADDLE_MAX_SPEED,
} from '../constants';
import type { Ball, Brick } from '../entities/types';

export type RailSide = 'left' | 'right' | 'top';

export interface Bounds {
  left: number;
  right: number;
  top: number;
}

export interface PaddleBox {
  cx: number;
  y: number;
  w: number;
  h: number;
}

/** What the game does when the ball touches something. */
export interface CollisionHandlers {
  wall(side: RailSide, x: number, y: number): void;
  /** Must leave the ball moving up, or stuck. */
  paddle(ball: Ball): void;
  brick(ball: Ball, brick: Brick): void;
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/**
 * Keep the ball out of the near-horizontal ping-pong: its vertical speed is
 * never less than MIN_VY_FRACTION of its speed. A dead-flat ball goes up.
 */
export function ensureMinAngle(ball: Ball): void {
  const speed = Math.hypot(ball.vx, ball.vy);
  if (speed === 0) return;
  const minVy = speed * MIN_VY_FRACTION;
  if (Math.abs(ball.vy) >= minVy) return;
  const sy = ball.vy > 0 ? 1 : -1;
  const sx = ball.vx >= 0 ? 1 : -1;
  ball.vy = sy * minVy;
  ball.vx = sx * Math.sqrt(Math.max(0, speed * speed - minVy * minVy));
}

/**
 * The angle (radians off vertical, + is right) a ball leaves the paddle at:
 * where it sits on the paddle (-1 left end .. 1 right end) plus the paddle's
 * own velocity. Always between MIN_OFF_VERTICAL and MAX_BOUNCE_ANGLE either
 * side of vertical; `lean` (±1) picks the side when the aim is dead centre.
 */
export function launchAngle(
  offset: number,
  paddleVx: number,
  english: number,
  lean = 1
): number {
  const o = clamp(offset, -1, 1);
  const v = clamp(paddleVx / PADDLE_MAX_SPEED, -1, 1);
  const raw = o * MAX_BOUNCE_ANGLE + v * english;
  if (Math.abs(raw) < MIN_OFF_VERTICAL) {
    const side = raw !== 0 ? Math.sign(raw) : lean < 0 ? -1 : 1;
    return side * MIN_OFF_VERTICAL;
  }
  return clamp(raw, -MAX_BOUNCE_ANGLE, MAX_BOUNCE_ANGLE);
}

/** Point the ball up at `angle` off vertical, at `speed`. */
export function aimBall(ball: Ball, angle: number, speed: number): void {
  ball.vx = Math.sin(angle) * speed;
  ball.vy = -Math.cos(angle) * speed;
  ensureMinAngle(ball);
}

/** Where on the paddle the ball is, -1 (left end) .. 1 (right end). */
export function paddleOffset(ball: Ball, paddle: PaddleBox): number {
  return clamp((ball.x - paddle.cx) / (paddle.w / 2), -1, 1);
}

function touchesPaddle(ball: Ball, p: PaddleBox): boolean {
  // Once the centre is below the paddle's underside it has been missed.
  if (ball.y > p.y + p.h) return false;
  const left = p.cx - p.w / 2;
  const nx = clamp(ball.x, left, left + p.w);
  const ny = clamp(ball.y, p.y, p.y + p.h);
  const dx = ball.x - nx;
  const dy = ball.y - ny;
  return dx * dx + dy * dy <= ball.r * ball.r;
}

function overlapsBrick(ball: Ball, b: Brick): boolean {
  const nx = clamp(ball.x, b.x, b.x + b.w);
  const ny = clamp(ball.y, b.y, b.y + b.h);
  const dx = ball.x - nx;
  const dy = ball.y - ny;
  return dx * dx + dy * dy < ball.r * ball.r;
}

/** The live brick the ball overlaps most deeply, if any. */
export function findOverlap(ball: Ball, bricks: Brick[]): Brick | null {
  let best: Brick | null = null;
  let bestDist = Infinity;
  for (const b of bricks) {
    if (!b.alive) continue;
    if (!overlapsBrick(ball, b)) continue;
    const d = Math.hypot(ball.x - (b.x + b.w / 2), ball.y - (b.y + b.h / 2));
    if (d < bestDist) {
      bestDist = d;
      best = b;
    }
  }
  return best;
}

/**
 * Push the ball out of `b` and reflect it. The side is judged from where the
 * ball was before this substep: coming from above or below flips vy, from
 * the side flips vx, and a corner goes to the shallower penetration.
 */
export function resolveBrick(
  ball: Ball,
  b: Brick,
  prevX: number,
  prevY: number
): void {
  const withinX = prevX >= b.x && prevX <= b.x + b.w;
  const withinY = prevY >= b.y && prevY <= b.y + b.h;
  let vertical: boolean;
  if (withinX && !withinY) vertical = true;
  else if (withinY && !withinX) vertical = false;
  else {
    const penX = Math.min(ball.x + ball.r - b.x, b.x + b.w - (ball.x - ball.r));
    const penY = Math.min(ball.y + ball.r - b.y, b.y + b.h - (ball.y - ball.r));
    vertical = penY <= penX;
  }
  if (vertical) {
    if (ball.y < b.y + b.h / 2) {
      ball.y = b.y - ball.r - 0.01;
      ball.vy = -Math.abs(ball.vy);
    } else {
      ball.y = b.y + b.h + ball.r + 0.01;
      ball.vy = Math.abs(ball.vy);
    }
  } else if (ball.x < b.x + b.w / 2) {
    ball.x = b.x - ball.r - 0.01;
    ball.vx = -Math.abs(ball.vx);
  } else {
    ball.x = b.x + b.w + ball.r + 0.01;
    ball.vx = Math.abs(ball.vx);
  }
  ensureMinAngle(ball);
}

/** How many substeps a move of `dt` needs. */
export function substepsFor(ball: Ball, dt: number): number {
  const dist = Math.hypot(ball.vx, ball.vy) * dt;
  return Math.max(1, Math.ceil(dist / MAX_SUBSTEP));
}

/**
 * Move one ball through `dt` seconds, never more than MAX_SUBSTEP px at a
 * time, calling back into the game for every contact.
 */
export function moveBall(
  ball: Ball,
  dt: number,
  bounds: Bounds,
  paddle: PaddleBox | null,
  bricks: Brick[],
  on: CollisionHandlers
): void {
  if (ball.stuck || dt <= 0) return;
  const steps = substepsFor(ball, dt);
  const h = dt / steps;
  for (let i = 0; i < steps; i++) {
    if (ball.stuck) return;
    const px = ball.x;
    const py = ball.y;
    ball.x += ball.vx * h;
    ball.y += ball.vy * h;

    if (ball.x - ball.r < bounds.left) {
      ball.x = bounds.left + ball.r;
      ball.vx = Math.abs(ball.vx);
      on.wall('left', bounds.left, ball.y);
    } else if (ball.x + ball.r > bounds.right) {
      ball.x = bounds.right - ball.r;
      ball.vx = -Math.abs(ball.vx);
      on.wall('right', bounds.right, ball.y);
    }
    if (ball.y - ball.r < bounds.top) {
      ball.y = bounds.top + ball.r;
      ball.vy = Math.abs(ball.vy);
      on.wall('top', ball.x, bounds.top);
    }

    if (paddle && ball.vy > 0 && touchesPaddle(ball, paddle)) {
      on.paddle(ball);
      continue;
    }

    // A pocket between two bricks can touch both in one substep.
    for (let k = 0; k < 3; k++) {
      const b = findOverlap(ball, bricks);
      if (!b) break;
      resolveBrick(ball, b, px, py);
      on.brick(ball, b);
    }
  }
}
