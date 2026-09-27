// How the paddle answers the player. Three inputs, one paddle:
//   - keys (← → / A D) accelerate it and friction stops it, so a tap nudges
//     and a hold sweeps, instead of a constant-speed snap
//   - a moving mouse takes over and the paddle chases the cursor's x
//   - a finger on the canvas does the same
// Whichever was used last wins until another one moves.

import {
  PADDLE_ACCEL,
  PADDLE_DECEL,
  PADDLE_FOLLOW,
  PADDLE_MAX_SPEED,
  PADDLE_TURN_ACCEL,
} from '../constants';
import type { Paddle, Point } from '../entities/types';
import type {
  InputSource,
  PressTracker,
} from '@/games/shared/input/PressTracker';

export type PaddleMode = 'keys' | 'pointer';

export class PaddleController {
  mode: PaddleMode = 'keys';
  /** Where the pointer wants the paddle's centre. */
  target = 0;
  private lastMouse: Point | null = null;
  /** True on a frame where the player moved the paddle by any means. */
  moved = false;

  reset(p: Paddle): void {
    this.mode = 'keys';
    this.target = p.cx;
    this.lastMouse = null;
    this.moved = false;
  }

  update(
    p: Paddle,
    input: InputSource,
    keys: PressTracker,
    dt: number,
    minX: number,
    maxX: number
  ): void {
    const left = keys.isDown('ArrowLeft') || keys.isDown('KeyA');
    const right = keys.isDown('ArrowRight') || keys.isDown('KeyD');
    const dir = (right ? 1 : 0) - (left ? 1 : 0);

    const touches = input.getTouches();
    const m = input.getMousePosition();
    const mouseMoved =
      this.lastMouse !== null &&
      (Math.abs(m.x - this.lastMouse.x) > 0.5 ||
        Math.abs(m.y - this.lastMouse.y) > 0.5);
    this.lastMouse = { x: m.x, y: m.y };

    this.moved = dir !== 0 || touches.length > 0 || mouseMoved;
    if (dir !== 0) {
      this.mode = 'keys';
    } else if (touches.length > 0) {
      this.mode = 'pointer';
      this.target = touches[0].x;
    } else if (mouseMoved) {
      this.mode = 'pointer';
      this.target = m.x;
    }

    const half = p.w / 2;
    const lo = minX + half;
    const hi = maxX - half;
    const before = p.cx;

    if (this.mode === 'keys') {
      if (dir !== 0) {
        const turning = p.vx !== 0 && Math.sign(p.vx) !== dir;
        p.vx += dir * (turning ? PADDLE_TURN_ACCEL : PADDLE_ACCEL) * dt;
        p.vx = Math.max(-PADDLE_MAX_SPEED, Math.min(PADDLE_MAX_SPEED, p.vx));
      } else if (p.vx !== 0) {
        const drop = PADDLE_DECEL * dt;
        p.vx = Math.abs(p.vx) <= drop ? 0 : p.vx - Math.sign(p.vx) * drop;
      }
      p.cx += p.vx * dt;
      if (p.cx < lo || p.cx > hi) {
        p.cx = Math.max(lo, Math.min(hi, p.cx));
        p.vx = 0;
      }
    } else {
      const goal = Math.max(lo, Math.min(hi, this.target));
      p.cx += (goal - p.cx) * (1 - Math.exp(-PADDLE_FOLLOW * dt));
      p.cx = Math.max(lo, Math.min(hi, p.cx));
      p.vx = dt > 0 ? (p.cx - before) / dt : 0;
    }

    const k = Math.min(1, Math.abs(p.vx) / PADDLE_MAX_SPEED);
    p.thrust += (k - p.thrust) * Math.min(1, dt * 12);
  }
}
