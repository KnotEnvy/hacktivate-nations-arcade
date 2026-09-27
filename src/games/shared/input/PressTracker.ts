// ===== src/games/shared/input/PressTracker.ts =====
//
// InputManager reports LEVEL state (is this key down right now?). Most game
// actions want EDGES (was it pressed this frame?): a card flip, a flag
// toggle, a difficulty button, a lane hop. Polling level state for those
// fires the action on every frame the key is held — a held "2" rebuilds a
// board sixty times a second, a held mouse button flips every card the
// cursor crosses. This tracker turns level into edges, and folds mouse and
// touch into one "pointer" so a game handles a tap and a click the same way.
//
// Call update() exactly once per frame, before reading anything else.

export interface PointerLike {
  x: number;
  y: number;
}

export interface InputSource {
  isKeyPressed(code: string): boolean;
  isMousePressed(button?: number): boolean;
  getMousePosition(): PointerLike;
  getTouches(): Array<{ id: number; x: number; y: number }>;
}

export class PressTracker {
  private prevKeys = new Set<string>();
  private currKeys = new Set<string>();

  private prevPointer = false;
  private currPointer = false;
  private pointerPos: PointerLike = { x: 0, y: 0 };
  private pointerDownPos: PointerLike = { x: 0, y: 0 };
  private heldFor = 0;
  private longPressConsumed = false;
  private usingTouch = false;

  private prevRight = false;
  private currRight = false;

  /**
   * Sample the input once for this frame. `codes` lists every key code the
   * game cares about; keys outside it never register an edge.
   */
  update(input: InputSource, codes: readonly string[], dt: number): void {
    this.prevKeys = this.currKeys;
    this.currKeys = new Set<string>();
    for (const code of codes) {
      if (input.isKeyPressed(code)) this.currKeys.add(code);
    }

    const touches = input.getTouches();
    const touchDown = touches.length > 0;
    const mouseDown = input.isMousePressed(0);

    this.prevPointer = this.currPointer;
    this.currPointer = touchDown || mouseDown;

    if (touchDown) {
      this.usingTouch = true;
      this.pointerPos = { x: touches[0].x, y: touches[0].y };
    } else if (mouseDown) {
      // A mouse press always carries its own position, including on the
      // first mouse frame after a touch session (otherwise that press would
      // start at the last finger position).
      this.usingTouch = false;
      const m = input.getMousePosition();
      this.pointerPos = { x: m.x, y: m.y };
    } else if (!this.usingTouch) {
      // Hover: follow the mouse. A finger lifted leaves no position behind,
      // so in touch mode keep the last one and a release still knows where
      // it happened.
      const m = input.getMousePosition();
      this.pointerPos = { x: m.x, y: m.y };
    }

    if (this.currPointer && !this.prevPointer) {
      this.pointerDownPos = { ...this.pointerPos };
      this.heldFor = 0;
      this.longPressConsumed = false;
    } else if (this.currPointer) {
      this.heldFor += dt;
    }

    this.prevRight = this.currRight;
    this.currRight = input.isMousePressed(2);
  }

  /** True on the single frame the key went down. */
  justPressed(code: string): boolean {
    return this.currKeys.has(code) && !this.prevKeys.has(code);
  }

  /** True on the single frame the key came up. */
  justReleased(code: string): boolean {
    return !this.currKeys.has(code) && this.prevKeys.has(code);
  }

  isDown(code: string): boolean {
    return this.currKeys.has(code);
  }

  /** True on the frame any of the codes went down. */
  anyJustPressed(codes: readonly string[]): boolean {
    return codes.some(c => this.justPressed(c));
  }

  /** Mouse button 0 or any touch is down. */
  pointerDown(): boolean {
    return this.currPointer;
  }

  pointerJustPressed(): boolean {
    return this.currPointer && !this.prevPointer;
  }

  pointerJustReleased(): boolean {
    return !this.currPointer && this.prevPointer;
  }

  /** Where the pointer is (or was, on the frame it was released). */
  pointerPosition(): PointerLike {
    return { ...this.pointerPos };
  }

  /** Where the current/last press started. */
  pointerDownPosition(): PointerLike {
    return { ...this.pointerDownPos };
  }

  /** Seconds the pointer has been held in the current press. */
  pointerHeldFor(): number {
    return this.currPointer ? this.heldFor : 0;
  }

  /** Whether the last pointer input came from touch rather than a mouse. */
  isTouch(): boolean {
    return this.usingTouch;
  }

  /**
   * A release that was short and did not travel: a tap or click. Games use
   * this for "reveal" so a long press (flag) never also reveals.
   */
  tapped(maxHold = 0.35, maxDrift = 14): boolean {
    if (!this.pointerJustReleased()) return false;
    if (this.longPressConsumed) return false;
    if (this.heldFor > maxHold) return false;
    const dx = this.pointerPos.x - this.pointerDownPos.x;
    const dy = this.pointerPos.y - this.pointerDownPos.y;
    return dx * dx + dy * dy <= maxDrift * maxDrift;
  }

  /**
   * Fires ONCE per press when the pointer has been held still for
   * `threshold` seconds. The press that long-pressed will not also tap.
   */
  longPressed(threshold = 0.45, maxDrift = 14): boolean {
    if (!this.currPointer || this.longPressConsumed) return false;
    if (this.heldFor < threshold) return false;
    const dx = this.pointerPos.x - this.pointerDownPos.x;
    const dy = this.pointerPos.y - this.pointerDownPos.y;
    if (dx * dx + dy * dy > maxDrift * maxDrift) return false;
    this.longPressConsumed = true;
    return true;
  }

  /** Right mouse button edge, for desktop "secondary" actions. */
  rightJustPressed(): boolean {
    return this.currRight && !this.prevRight;
  }

  /**
   * Swipe direction from the current press, once it has travelled
   * `threshold` px from where it started; null until then. The caller
   * decides whether to consume it once or re-arm on the next press.
   */
  swipe(threshold = 24): 'left' | 'right' | 'up' | 'down' | null {
    if (!this.currPointer) return null;
    const dx = this.pointerPos.x - this.pointerDownPos.x;
    const dy = this.pointerPos.y - this.pointerDownPos.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < threshold) return null;
    if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'right' : 'left';
    return dy > 0 ? 'down' : 'up';
  }

  /** Re-anchor the current press (after a swipe has been consumed). */
  rearmSwipe(): void {
    this.pointerDownPos = { ...this.pointerPos };
  }

  reset(): void {
    this.prevKeys = new Set();
    this.currKeys = new Set();
    this.prevPointer = false;
    this.currPointer = false;
    this.heldFor = 0;
    this.longPressConsumed = false;
    this.prevRight = false;
    this.currRight = false;
  }
}
