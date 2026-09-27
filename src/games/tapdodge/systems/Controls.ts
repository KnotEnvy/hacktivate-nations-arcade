// ===== src/games/tapdodge/systems/Controls.ts =====
//
// Every input the game reads, turned into edges by PressTracker and then
// into intents. Nothing here polls level state, so a held key is one action,
// never a stream of them.
//
//   keyboard  left/right (A/D)  one hop per press
//             up (W)            one jump per press
//             down (S)          one duck per press
//   touch     tap left third    hop left   (tap = short, still press)
//             tap right third   hop right
//             drag sideways     the ship follows the finger, lane-snapped
//             swipe up / down   jump / duck; re-armed after each swipe, so
//                               one press can flick up and then down
//
// A press that became a drag or a swipe is never also a tap.

import { PressTracker, InputSource } from '@/games/shared/input/PressTracker';
import type { DodgeKind } from '../entities/Player';
import { VIEW_W, laneAt } from './layout';

export const KEYS = {
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  up: ['ArrowUp', 'KeyW'],
  down: ['ArrowDown', 'KeyS'],
  confirm: ['Space', 'Enter'],
} as const;

export const ALL_KEYS: readonly string[] = [
  ...KEYS.left,
  ...KEYS.right,
  ...KEYS.up,
  ...KEYS.down,
  ...KEYS.confirm,
];

/** A release inside this drift (canvas px) and hold time is a tap. */
export const TAP_DRIFT = 26;
export const TAP_HOLD = 0.3;
/** Horizontal travel that turns a press into a drag. */
export const DRAG_PX = 26;
/** Vertical travel that fires a swipe. */
export const SWIPE_PX = 38;

export interface Intents {
  /** Hop directions in the order pressed this frame (-1 / +1). */
  hops: number[];
  /** A drag's absolute lane, or null. */
  steer: number | null;
  dodge: DodgeKind | null;
  /** Any fresh key or pointer press (READY and the recap listen). */
  anyPress: boolean;
}

export class Controls {
  readonly tracker = new PressTracker();
  private dragging = false;
  private gestureUsed = false;

  reset(): void {
    this.tracker.reset();
    this.dragging = false;
    this.gestureUsed = false;
  }

  /** The current press was spent (it started the run): no tap on release. */
  consumePress(): void {
    this.gestureUsed = true;
  }

  update(input: InputSource, dt: number): Intents {
    const t = this.tracker;
    t.update(input, ALL_KEYS, dt);
    const out: Intents = {
      hops: [],
      steer: null,
      dodge: null,
      anyPress: false,
    };

    if (t.anyJustPressed(KEYS.left)) out.hops.push(-1);
    if (t.anyJustPressed(KEYS.right)) out.hops.push(1);
    if (t.anyJustPressed(KEYS.up)) out.dodge = 'jump';
    else if (t.anyJustPressed(KEYS.down)) out.dodge = 'duck';
    if (t.anyJustPressed(ALL_KEYS)) out.anyPress = true;

    if (t.pointerJustPressed()) {
      this.dragging = false;
      this.gestureUsed = false;
      out.anyPress = true;
    }

    if (t.pointerDown()) {
      const p = t.pointerPosition();
      const a = t.pointerDownPosition();
      const dx = p.x - a.x;
      const dy = p.y - a.y;
      if (Math.abs(dy) >= SWIPE_PX && Math.abs(dy) > Math.abs(dx) * 1.2) {
        out.dodge = dy < 0 ? 'jump' : 'duck';
        this.gestureUsed = true;
        t.rearmSwipe();
      } else if (this.dragging) {
        out.steer = laneAt(p.x);
        // Keep sideways travel from masking a later flick: re-anchor while
        // the motion is horizontal, so a swipe measures only itself.
        if (Math.abs(dx) >= Math.abs(dy)) t.rearmSwipe();
      } else if (Math.abs(dx) >= DRAG_PX && Math.abs(dx) > Math.abs(dy)) {
        this.dragging = true;
        this.gestureUsed = true;
        out.steer = laneAt(p.x);
        t.rearmSwipe();
      }
    }

    if (!this.gestureUsed && t.tapped(TAP_HOLD, TAP_DRIFT)) {
      const x = t.pointerPosition().x;
      if (x < VIEW_W / 3) out.hops.push(-1);
      else if (x > (VIEW_W * 2) / 3) out.hops.push(1);
    }
    if (t.pointerJustReleased()) this.dragging = false;

    return out;
  }
}
