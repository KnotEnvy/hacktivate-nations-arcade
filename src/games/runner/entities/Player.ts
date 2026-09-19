// ===== src/games/runner/entities/Player.ts =====
import { Vector2, Rectangle } from '@/games/shared/utils/Vector2';

interface Afterimage {
  x: number;
  y: number;
  alpha: number;
  scale: number;
  pose: 'run' | 'air' | 'slide';
  lean: number;
}

interface ScarfNode {
  x: number;
  y: number;
}

/**
 * The runner.
 *
 * Feel notes, because they are the part that is easy to lose:
 *  - Gravity and the jump hold are scaled by dt, so the jump arc is identical
 *    on a 60Hz and a 144Hz display. The constants are tuned so 60Hz matches
 *    what the game shipped with.
 *  - COYOTE TIME lets a jump register for a moment after running off an edge.
 *  - JUMP BUFFERING lets a jump pressed just before landing fire on touchdown.
 *    Between them, the "I definitely pressed jump" deaths go away.
 */
export class Player {
  position: Vector2;
  velocity: Vector2;
  size: Vector2;

  private isGrounded = true;
  private isJumping = false;
  private isSliding = false;
  private slideDuration = 0;
  /** A tapped slide still lasts this long, so the move is never a no-op. */
  private slideMinDuration = 0.28;
  private groundY: number;
  private worldWidth: number;

  private jumpsRemaining = 1;
  private maxJumps = 1;
  private lastJumpPressed = false;
  private lastSlidePressed = false;

  private jumpPower = -11;
  private jumpHoldBoost = -0.6;
  private maxJumpHoldTime = 0.25;
  private jumpHoldTime = 0;

  private gravity = 0.8;
  /** Falling is heavier than rising: the classic snappy-jump trick. */
  private fallGravityScale = 1.35;
  private moveSpeed = 5;

  // Forgiveness windows.
  private coyoteTime = 0;
  private readonly coyoteWindow = 0.11;
  private jumpBuffer = 0;
  private readonly jumpBufferWindow = 0.13;

  // Animation
  private runTime = 0;
  private squashStretch = 1;
  /** Full rotation played on a double jump. */
  private flipAngle = 0;
  private flipping = false;
  private lean = 0;

  /** Rim-light colour, set from the current stage palette. */
  private accent = '#FFFFFF';

  /** Seconds of knockback left after a hit; control is damped while it runs. */
  private hurtTimer = 0;

  private scarf: ScarfNode[] = [];
  private afterimages: Afterimage[] = [];
  private afterimageTimer = 0;
  private afterimageInterval = 0.03;

  constructor(x: number, y: number, groundY: number, worldWidth: number) {
    this.position = new Vector2(x, y);
    this.velocity = new Vector2(0, 0);
    this.size = new Vector2(32, 32);
    this.groundY = groundY;
    this.worldWidth = worldWidth;
    for (let i = 0; i < 5; i++) this.scarf.push({ x, y });
  }

  /** Tint the rim light to the stage so the runner sits in its light. */
  setAccent(color: string): void {
    this.accent = color;
  }

  update(
    dt: number,
    inputPressed: boolean,
    hasDoubleJump: boolean = false,
    leftPressed: boolean = false,
    rightPressed: boolean = false,
    downPressed: boolean = false
  ): void {
    this.maxJumps = hasDoubleJump ? 2 : 1;

    // Horizontal movement (disabled while sliding, damped while hurt).
    if (this.hurtTimer > 0) {
      this.hurtTimer = Math.max(0, this.hurtTimer - dt);
      // Ease the knockback out rather than snapping control back.
      this.velocity.x *= Math.max(0, 1 - dt * 6);
    } else if (!this.isSliding) {
      this.velocity.x = 0;
      if (leftPressed) this.velocity.x -= this.moveSpeed;
      if (rightPressed) this.velocity.x += this.moveSpeed;
    }

    // Slide start (only when grounded and not already sliding)
    if (downPressed && !this.lastSlidePressed && this.isGrounded && !this.isSliding) {
      this.startSlide();
    }

    if (this.isSliding) {
      this.slideDuration += dt;
      // A slide lasts as long as the button is held.
      //
      // It used to stop dead at 0.55s whatever the player was doing, and
      // because starting one needs a fresh press, holding DOWN through a run
      // of barriers stood the runner straight up into the second one. Sliding
      // is not a free dodge — a blocker still stops it and a pit still opens
      // under it — so there is no reason to cap it.
      if (!downPressed && this.slideDuration >= this.slideMinDuration) {
        this.endSlide();
      }
    }

    this.lastSlidePressed = downPressed;

    // Buffer the press, then spend it the moment a jump is legal.
    if (inputPressed && !this.lastJumpPressed) {
      this.jumpBuffer = this.jumpBufferWindow;
    }
    this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);
    this.coyoteTime = Math.max(0, this.coyoteTime - dt);

    const groundJumpAvailable = this.isGrounded || this.coyoteTime > 0;
    const canJump =
      !this.isSliding && (groundJumpAvailable || this.jumpsRemaining > 0);

    if (this.jumpBuffer > 0 && canJump) {
      // A coyote jump spends the ground jump rather than an air jump.
      if (!this.isGrounded && this.coyoteTime > 0) {
        this.jumpsRemaining = this.maxJumps;
      }
      this.jump();
      this.jumpBuffer = 0;
      this.coyoteTime = 0;
    }

    // Variable jump height while the button is held.
    if (this.isJumping && inputPressed && this.jumpHoldTime < this.maxJumpHoldTime) {
      this.velocity.y += this.jumpHoldBoost * dt * 60;
      this.jumpHoldTime += dt;
    } else if (!inputPressed) {
      this.isJumping = false;
    }

    this.lastJumpPressed = inputPressed;

    // Gravity, dt-scaled, heavier on the way down.
    const g = this.velocity.y > 0 ? this.gravity * this.fallGravityScale : this.gravity;
    this.velocity.y += g * dt * 60;

    this.position = this.position.add(this.velocity.multiply(dt * 60));
    this.position.x = Math.max(0, Math.min(this.worldWidth - this.size.x, this.position.x));

    // Ground collision
    if (this.position.y >= this.groundY - this.size.y) {
      const wasAirborne = !this.isGrounded;
      this.position.y = this.groundY - this.size.y;
      this.velocity.y = 0;
      this.isGrounded = true;
      this.isJumping = false;
      this.jumpsRemaining = this.maxJumps;
      this.jumpHoldTime = 0;
      this.coyoteTime = this.coyoteWindow;
      this.flipping = false;
      this.flipAngle = 0;

      if (wasAirborne) this.squashStretch = 1.4;
    } else {
      if (this.isGrounded) this.coyoteTime = this.coyoteWindow;
      this.isGrounded = false;
    }

    this.updateAnimations(dt);
    this.updateScarf(dt);
  }

  private updateAnimations(dt: number): void {
    this.runTime += dt * (this.isGrounded ? 11 : 6);

    // Squash and stretch recovery.
    if (this.squashStretch < 1) {
      this.squashStretch = Math.min(1, this.squashStretch + dt * 3.2);
    } else if (this.squashStretch > 1) {
      this.squashStretch = Math.max(1, this.squashStretch - dt * 3.2);
    }

    // The double-jump flip, once round and done.
    if (this.flipping) {
      this.flipAngle += dt * 13;
      if (this.flipAngle >= Math.PI * 2) {
        this.flipAngle = 0;
        this.flipping = false;
      }
    }

    // Lean into the motion: forward while running, back while rising.
    const targetLean = this.isSliding
      ? 0.34
      : this.isGrounded
        ? 0.1
        : Math.max(-0.28, Math.min(0.3, this.velocity.y * 0.025));
    this.lean += (targetLean - this.lean) * Math.min(1, dt * 12);
  }

  /** The scarf chases the body with a lag per node — cheap, reads as cloth. */
  private updateScarf(dt: number): void {
    const anchorX = this.position.x + 9;
    const anchorY = this.position.y + (this.isSliding ? 20 : 11);
    const follow = Math.min(1, dt * 22);

    let px = anchorX;
    let py = anchorY;
    for (let i = 0; i < this.scarf.length; i++) {
      const node = this.scarf[i];
      // Each node trails the one ahead, pushed back by the run and lifted by
      // upward motion, so the scarf streams behind and flicks on a jump.
      const targetX = px - (i === 0 ? 4 : 5.5) - (this.isSliding ? 2 : 0);
      // Gravity on the tail plus a travelling wave: the old version pinned
      // every node at shoulder height, which read as a stiff red blade.
      const droop = this.isSliding ? 0.6 : 1.6 + i * 0.5;
      const targetY =
        py + droop + this.velocity.y * 0.2 + Math.sin(this.runTime * 0.9 + i * 0.9) * 2.2;
      node.x += (targetX - node.x) * follow;
      node.y += (targetY - node.y) * follow;
      px = node.x;
      py = node.y;
    }
  }

  updateAfterimages(dt: number, hasSpeedBoost: boolean): void {
    if (hasSpeedBoost) {
      this.afterimageTimer += dt;
      if (this.afterimageTimer >= this.afterimageInterval) {
        this.afterimageTimer = 0;
        this.afterimages.unshift({
          x: this.position.x,
          y: this.position.y,
          alpha: 0.55,
          scale: 1,
          pose: this.isSliding ? 'slide' : this.isGrounded ? 'run' : 'air',
          lean: this.lean,
        });
        if (this.afterimages.length > 6) this.afterimages.pop();
      }
    } else {
      this.afterimages = [];
      this.afterimageTimer = 0;
    }

    this.afterimages = this.afterimages.filter(img => {
      img.alpha -= dt * 2.2;
      img.scale -= dt * 0.25;
      return img.alpha > 0 && img.scale > 0.5;
    });
  }

  jump(): void {
    if (this.jumpsRemaining <= 0) return;

    const wasAirborne = !this.isGrounded;
    this.velocity.y = wasAirborne ? this.jumpPower * 0.88 : this.jumpPower;
    this.jumpsRemaining--;
    this.isJumping = true;
    this.jumpHoldTime = 0;
    this.squashStretch = 0.62;
    this.isGrounded = false;

    // The second jump gets a flip, so it looks as good as it feels.
    if (wasAirborne) {
      this.flipping = true;
      this.flipAngle = 0;
    }
  }

  /**
   * Take a hit: a short knockback the player rides out.
   *
   * velocity here is px per frame at 60Hz, not px per second — the old call
   * site set -200 and teleported the runner into the left wall in one step.
   */
  hurt(): void {
    this.hurtTimer = 0.3;
    this.velocity.x = -3.2;
    this.velocity.y = -6;
    this.isSliding = false;
    this.squashStretch = 1.35;
  }

  startSlide(): void {
    this.isSliding = true;
    this.slideDuration = 0;
    this.squashStretch = 1.3;
  }

  endSlide(): void {
    this.isSliding = false;
    this.slideDuration = 0;
  }

  render(ctx: CanvasRenderingContext2D): void {
    this.renderAfterimages(ctx);
    this.renderShadow(ctx);
    this.renderScarf(ctx);

    const bob = this.isGrounded && !this.isSliding ? Math.sin(this.runTime * 2) * 1.2 : 0;

    ctx.save();
    ctx.translate(
      this.position.x + this.size.x / 2,
      this.position.y + this.size.y / 2 + bob
    );

    if (this.flipping) ctx.rotate(this.flipAngle);
    else ctx.rotate(this.lean * 0.55);

    if (this.isSliding) ctx.scale(1.22, 0.78);
    else ctx.scale(this.squashStretch, 2 - this.squashStretch);

    ctx.translate(-this.size.x / 2, -this.size.y / 2);

    if (this.isSliding) this.drawSlidePose(ctx);
    else if (this.isGrounded) this.drawRunPose(ctx);
    else this.drawAirPose(ctx);

    ctx.restore();
  }

  // --------------------------------------------------------------- poses ---
  //
  // All poses are drawn in a 32x32 box. Shared palette, so the silhouette
  // stays the same colour block however it is posed.

  // A DARK body with BRIGHT trim, deliberately.
  //
  // The first pass dressed the runner in green, which vanished against the
  // meadow and the forest floor. A dark slate silhouette holds up against the
  // four bright stages, and the cyan trim plus the white chest panel hold up
  // against the dark one. The red scarf is the single warm note, and it is
  // never a colour any stage uses for its ground.
  private readonly suit = '#2A3852';
  private readonly suitDark = '#1A2436';
  private readonly suitLight = '#44597E';
  private readonly trim = '#3BE0D0';
  private readonly panel = '#E9EEF5';
  private readonly skin = '#F6C89A';
  private readonly visor = '#0B1B2A';
  private readonly boot = '#141E2E';

  private drawRunPose(ctx: CanvasRenderingContext2D): void {
    const phase = this.runTime;
    const swing = Math.sin(phase);
    const swing2 = Math.sin(phase + Math.PI);

    // Back limbs first, so the body overlaps them. The back pair is darker,
    // which is what sells the depth at this size.
    this.drawLeg(ctx, 13, swing2, this.suitDark, 1, true);
    this.drawArm(ctx, 11, swing2, this.suitDark, true);

    this.drawTorso(ctx);
    this.drawHead(ctx, 0);

    this.drawLeg(ctx, 18, swing, this.suit);
    this.drawArm(ctx, 20, swing, this.suitLight);
  }

  private drawAirPose(ctx: CanvasRenderingContext2D): void {
    const rising = this.velocity.y < 0;
    // Tucked going up, reaching going down — reads at a glance which way.
    const tuck = rising ? 1 : 0.25;

    this.drawLeg(ctx, 12, -0.9 * tuck, this.suitDark, 0.7, true);
    this.drawArm(ctx, 10, rising ? -1.3 : 0.9, this.suitDark, true);

    this.drawTorso(ctx);
    this.drawHead(ctx, rising ? -1 : 1);

    this.drawLeg(ctx, 18, -0.4 * tuck, this.suit, 0.8);
    this.drawArm(ctx, 20, rising ? -1.5 : 1.1, this.suitLight);
  }

  private drawSlidePose(ctx: CanvasRenderingContext2D): void {
    // Low and long: legs forward, one hand planted behind.
    ctx.fillStyle = this.suitDark;
    this.roundRect(ctx, 2, 20, 14, 9, 4);

    ctx.fillStyle = this.suit;
    this.roundRect(ctx, 8, 15, 19, 13, 6);

    ctx.fillStyle = this.panel;
    this.roundRect(ctx, 12, 17, 11, 4, 2);
    ctx.fillStyle = this.trim;
    ctx.fillRect(10, 24, 16, 2);

    // Planted hand.
    ctx.fillStyle = this.skin;
    this.roundRect(ctx, 1, 26, 6, 5, 2);

    // Head, turned forward and low.
    ctx.fillStyle = this.skin;
    this.roundRect(ctx, 20, 12, 12, 11, 5);
    ctx.fillStyle = this.suit;
    this.roundRect(ctx, 19, 10, 13, 6, 3);
    ctx.fillStyle = this.trim;
    ctx.fillRect(19, 14, 13, 1.5);
    ctx.fillStyle = this.visor;
    this.roundRect(ctx, 24, 16, 8, 4, 2);

    // Boots out front, cyan sole forward.
    ctx.fillStyle = this.boot;
    this.roundRect(ctx, 24, 24, 10, 6, 3);
    ctx.fillStyle = this.trim;
    ctx.fillRect(31, 25, 3, 4);

    this.rimLight(ctx, 8, 14, 20, 15);
  }

  private drawTorso(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = this.suit;
    this.roundRect(ctx, 9, 12, 15, 15, 5);

    // A white chest panel and one cyan stripe: the two marks that keep the
    // runner legible against a dark night skyline.
    ctx.fillStyle = this.panel;
    this.roundRect(ctx, 12, 14, 9, 6, 2);
    ctx.fillStyle = this.trim;
    ctx.fillRect(9, 21, 15, 2);
    ctx.fillStyle = this.suitDark;
    ctx.fillRect(9, 24, 15, 3);

    this.rimLight(ctx, 9, 12, 15, 15);
  }

  private drawHead(ctx: CanvasRenderingContext2D, tilt: number): void {
    const y = 2 + tilt * 0.6;
    ctx.fillStyle = this.skin;
    this.roundRect(ctx, 11, y + 1, 13, 12, 5);

    // Jaw shadow, so the head is not one flat oval.
    ctx.fillStyle = 'rgba(160, 110, 70, 0.35)';
    ctx.fillRect(12, y + 10, 11, 2);

    // Helmet over the crown, with a cyan stripe front to back.
    ctx.fillStyle = this.suit;
    this.roundRect(ctx, 10, y, 15, 7, 4);
    ctx.fillStyle = this.trim;
    ctx.fillRect(10, y + 3, 15, 1.5);
    ctx.fillStyle = this.suitDark;
    ctx.fillRect(10, y + 5.5, 15, 2);

    // Visor: the one dark shape, so the face always reads.
    ctx.fillStyle = this.visor;
    this.roundRect(ctx, 16, y + 6.5, 9, 4, 2);
    ctx.fillStyle = this.trim;
    ctx.fillRect(21, y + 7.5, 3, 1);
  }

  private drawArm(
    ctx: CanvasRenderingContext2D,
    x: number,
    swing: number,
    color: string,
    back = false
  ): void {
    ctx.save();
    ctx.translate(x, 15);
    // A wide swing: at 32px a subtle one is invisible.
    ctx.rotate(swing * 1.15);
    ctx.fillStyle = color;
    this.roundRect(ctx, -2.5, 0, 5, 9, 2.5);
    // Fist, dimmed on the far arm so the near one stays the readable one.
    ctx.fillStyle = back ? 'rgba(180, 146, 112, 1)' : this.skin;
    ctx.beginPath();
    ctx.arc(0, 11, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawLeg(
    ctx: CanvasRenderingContext2D,
    x: number,
    swing: number,
    color: string,
    lengthScale = 1,
    back = false
  ): void {
    ctx.save();
    ctx.translate(x, 23);
    ctx.rotate(swing * 0.82);
    ctx.fillStyle = color;
    this.roundRect(ctx, -3, 0, 6, 10 * lengthScale, 3);
    // Boot, with a cyan sole on the near leg.
    ctx.fillStyle = this.boot;
    this.roundRect(ctx, -3.5, 8 * lengthScale, 8, 5, 2);
    if (!back) {
      ctx.fillStyle = this.trim;
      ctx.fillRect(-3.5, 8 * lengthScale + 4, 8, 1.5);
    }
    ctx.restore();
  }

  /** A thin lit edge in the stage's accent, so the runner sits in the scene. */
  private rimLight(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number
  ): void {
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = this.accent;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x + w, y + 3);
    ctx.lineTo(x + w, y + h - 3);
    ctx.stroke();
    ctx.restore();
  }

  private roundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
  ): void {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.arcTo(x + w, y, x + w, y + radius, radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.arcTo(x + w, y + h, x + w - radius, y + h, radius);
    ctx.lineTo(x + radius, y + h);
    ctx.arcTo(x, y + h, x, y + h - radius, radius);
    ctx.lineTo(x, y + radius);
    ctx.arcTo(x, y, x + radius, y, radius);
    ctx.closePath();
    ctx.fill();
  }

  // ------------------------------------------------------------ trimmings --

  /** Contact shadow: the cheapest possible read on how high the jump is. */
  private renderShadow(ctx: CanvasRenderingContext2D): void {
    const height = this.groundY - (this.position.y + this.size.y);
    const fade = Math.max(0, 1 - height / 170);
    if (fade <= 0.02) return;

    ctx.save();
    ctx.globalAlpha = 0.3 * fade;
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.ellipse(
      this.position.x + this.size.x / 2,
      this.groundY - 2,
      13 * (0.55 + fade * 0.45),
      4 * (0.55 + fade * 0.45),
      0,
      0,
      Math.PI * 2
    );
    ctx.fill();
    ctx.restore();
  }

  private renderScarf(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#E8443C';

    // Start at the shoulder so the scarf is attached to the runner rather
    // than trailing as a separate red streak behind them.
    let prev = {
      x: this.position.x + 11,
      y: this.position.y + (this.isSliding ? 20 : 11),
    };
    for (let i = 0; i < this.scarf.length; i++) {
      const node = this.scarf[i];
      ctx.globalAlpha = 1 - (i / this.scarf.length) * 0.6;
      ctx.lineWidth = Math.max(1.5, 7 - i * 1.1);
      ctx.beginPath();
      ctx.moveTo(prev.x, prev.y);
      ctx.lineTo(node.x, node.y);
      ctx.stroke();
      prev = node;
    }
    ctx.restore();
  }

  private renderAfterimages(ctx: CanvasRenderingContext2D): void {
    if (this.afterimages.length === 0) return;

    for (let i = this.afterimages.length - 1; i >= 0; i--) {
      const img = this.afterimages[i];
      ctx.save();
      ctx.globalAlpha = img.alpha * 0.45;
      ctx.translate(img.x + this.size.x / 2, img.y + this.size.y / 2);
      ctx.rotate(img.lean * 0.55);
      ctx.scale(img.scale, img.scale);
      ctx.translate(-this.size.x / 2, -this.size.y / 2);
      // A flat silhouette rather than a full redraw: six ghosts of the whole
      // character every frame is not worth the cost.
      ctx.fillStyle = 'rgba(249, 115, 22, 0.85)';
      if (img.pose === 'slide') this.roundRect(ctx, 6, 14, 22, 15, 6);
      else this.roundRect(ctx, 9, 4, 15, 25, 6);
      ctx.restore();
    }
  }

  getBounds(): Rectangle {
    // Sliding ducks the hitbox into the bottom half of the box.
    if (this.isSliding) {
      return new Rectangle(
        this.position.x + 2,
        this.position.y + this.size.y / 2,
        this.size.x - 4,
        this.size.y / 2
      );
    }
    // A hair narrower than the sprite: near-misses should feel like misses.
    return new Rectangle(
      this.position.x + 3,
      this.position.y + 2,
      this.size.x - 6,
      this.size.y - 2
    );
  }

  getIsGrounded(): boolean {
    return this.isGrounded;
  }

  getJumpsRemaining(): number {
    return this.jumpsRemaining;
  }

  getIsSliding(): boolean {
    return this.isSliding;
  }
}
