// ===== src/games/runner/systems/GameCamera.ts =====
//
// A camera that reacts, instead of a fixed window with shake bolted on.
//
// Three jobs, all of them about making speed and height felt rather than read:
//
//   ZOOM    pulls back as the run speeds up, so a fast run shows more of what
//           is coming — which is also the fair thing to do, since hazards
//           arrive sooner at speed.
//   FOLLOW  drifts down as the player goes high, so a bounce-pad launch or a
//           ride up an updraft does not leave them pinned at the top edge.
//   SHAKE   the existing impact offset, folded in here so the render path has
//           one transform rather than two.
//
// Everything is critically damped toward a target: the camera never snaps, and
// it always settles.

export interface CameraTargetState {
  /** Current run speed multiplier. */
  gameSpeed: number;
  /** How far above the ground line the player's feet are. */
  playerHeight: number;
  /** Extra kick, e.g. entering rage or clearing a boss. */
  punch: number;
}

export class GameCamera {
  private width: number;
  private height: number;

  private zoom = 1;
  private zoomTarget = 1;
  private offsetY = 0;
  private offsetYTarget = 0;

  /** A brief extra pull-back, decaying on its own. */
  private punch = 0;

  /** Shake, supplied by ScreenShake and applied inside the same transform. */
  private shakeX = 0;
  private shakeY = 0;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  /** Kick the camera out briefly — a boss arriving, a stage clearing. */
  kick(amount: number): void {
    this.punch = Math.max(this.punch, amount);
  }

  update(dt: number, state: CameraTargetState, shake: { x: number; y: number }): void {
    // Pull back up to 9% over the speed range. More than that and the sprites
    // start to look small on a phone.
    const speedPull = Math.min(1, Math.max(0, (state.gameSpeed - 1) / 2.1));
    this.punch = Math.max(0, this.punch - dt * 1.6);
    this.zoomTarget = 1 - speedPull * 0.09 - this.punch * 0.03;

    // Follow only once the player is genuinely high, and only part of the way,
    // so ordinary jumps do not move the world.
    const followFrom = 150;
    const excess = Math.max(0, state.playerHeight - followFrom);
    this.offsetYTarget = Math.min(90, excess * 0.55);

    // Damping: the follow is quicker than the zoom, because height changes
    // fast and speed does not.
    this.zoom += (this.zoomTarget - this.zoom) * Math.min(1, dt * 3.5);
    this.offsetY += (this.offsetYTarget - this.offsetY) * Math.min(1, dt * 7);

    this.shakeX = shake.x;
    this.shakeY = shake.y;
  }

  /**
   * Apply the camera. Zoom is anchored on the bottom centre of the frame, so
   * the ground line stays put and the extra view opens upward and outward —
   * anchoring on the middle would slide the floor around under the player.
   */
  apply(ctx: CanvasRenderingContext2D): void {
    const anchorX = this.width / 2;
    const anchorY = this.height;

    ctx.translate(anchorX + this.shakeX, anchorY + this.shakeY + this.offsetY);
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-anchorX, -anchorY);
  }

  /** How much world is visible beyond the canvas edges at the current zoom. */
  getOverscan(): { x: number; y: number } {
    const extra = (1 / this.zoom - 1) / 2;
    return { x: this.width * extra, y: this.height * extra };
  }

  getZoom(): number {
    return this.zoom;
  }

  reset(): void {
    this.zoom = 1;
    this.zoomTarget = 1;
    this.offsetY = 0;
    this.offsetYTarget = 0;
    this.punch = 0;
    this.shakeX = 0;
    this.shakeY = 0;
  }
}
