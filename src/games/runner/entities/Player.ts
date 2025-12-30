// ===== src/games/runner/entities/Player.ts (FIXED) =====
import { Vector2, Rectangle } from '@/games/shared/utils/Vector2';

export class Player {
  position: Vector2;
  velocity: Vector2;
  size: Vector2;

  private isGrounded = true;
  private isJumping = false;
  private isSliding = false;
  private slideDuration = 0;
  private slideMaxDuration = 0.4; // seconds
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
  private moveSpeed = 5;

  // Animation
  private frameTime: number = 0;
  private currentFrame: number = 0;
  private animationSpeed: number = 0.15;
  private runTime: number = 0;
  private squashStretch: number = 1;

  // Trail effect
  private trailPositions: Vector2[] = [];
  private maxTrailLength = 8;

  // Afterimage effect (for speed boost)
  private afterimages: {x: number, y: number, alpha: number, scale: number}[] = [];
  private afterimageTimer: number = 0;
  private afterimageInterval: number = 0.03; // Generate every 30ms

  constructor(x: number, y: number, groundY: number, worldWidth: number) {
    this.position = new Vector2(x, y);
    this.velocity = new Vector2(0, 0);
    this.size = new Vector2(32, 32);
    this.groundY = groundY;
    this.worldWidth = worldWidth;
  }

  update(
    dt: number,
    inputPressed: boolean,
    hasDoubleJump: boolean = false,
    leftPressed: boolean = false,
    rightPressed: boolean = false,
    downPressed: boolean = false
  ): void {
    // Update max jumps based on power-up
    this.maxJumps = hasDoubleJump ? 2 : 1;

    // Horizontal movement (disabled while sliding)
    if (!this.isSliding) {
      this.velocity.x = 0;
      if (leftPressed) this.velocity.x -= this.moveSpeed;
      if (rightPressed) this.velocity.x += this.moveSpeed;
    }

    // Handle slide start (only when grounded and not already sliding)
    if (downPressed && !this.lastSlidePressed && this.isGrounded && !this.isSliding) {
      this.startSlide();
    }

    // Update slide duration
    if (this.isSliding) {
      this.slideDuration += dt;
      if (this.slideDuration >= this.slideMaxDuration || !downPressed) {
        this.endSlide();
      }
    }

    this.lastSlidePressed = downPressed;

    // Handle jump start (can't jump while sliding)
    if (inputPressed && !this.lastJumpPressed && this.jumpsRemaining > 0 && !this.isSliding) {
      this.jump();
    }

    // Variable jump height while holding the button
    if (this.isJumping && inputPressed && this.jumpHoldTime < this.maxJumpHoldTime) {
      this.velocity.y += this.jumpHoldBoost;
      this.jumpHoldTime += dt;
    } else if (!inputPressed) {
      this.isJumping = false;
    }

    this.lastJumpPressed = inputPressed;

    // Apply gravity
    this.velocity.y += this.gravity;

    // Update position
    this.position = this.position.add(this.velocity.multiply(dt * 60));

    // Clamp horizontal position
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
      
      // Squash effect on landing (only if we were in the air)
      if (wasAirborne) {
        this.squashStretch = 1.4; // More pronounced squash
      }
    } else {
      this.isGrounded = false;
    }

    // Update animations
    this.updateAnimations(dt);
    
    // Update trail
    this.updateTrail();
  }

  private updateAnimations(dt: number): void {
    // Running animation
    this.frameTime += dt;
    if (this.frameTime >= this.animationSpeed) {
      this.currentFrame = (this.currentFrame + 1) % 4;
      this.frameTime = 0;
    }
    this.runTime += dt * (this.isGrounded ? 10 : 6);
    
    // Squash and stretch recovery - FIXED!
    if (this.squashStretch < 1) {
      this.squashStretch = Math.min(1, this.squashStretch + dt * 1.5); // Faster recovery
    } else if (this.squashStretch > 1) {
      this.squashStretch = Math.max(1, this.squashStretch - dt * 1.5); // Recover from stretch too
    }
  }

  private updateTrail(): void {
    // Add current position to trail
    this.trailPositions.unshift(this.position.clone());

    // Limit trail length
    if (this.trailPositions.length > this.maxTrailLength) {
      this.trailPositions.pop();
    }
  }

  updateAfterimages(dt: number, hasSpeedBoost: boolean): void {
    // Only generate during speed boost
    if (hasSpeedBoost) {
      this.afterimageTimer += dt;
      if (this.afterimageTimer >= this.afterimageInterval) {
        this.afterimageTimer = 0;
        this.afterimages.unshift({
          x: this.position.x,
          y: this.position.y,
          alpha: 0.6,
          scale: 1
        });

        // Limit to 5 afterimages
        if (this.afterimages.length > 5) {
          this.afterimages.pop();
        }
      }
    } else {
      // Clear afterimages when speed boost ends
      this.afterimages = [];
      this.afterimageTimer = 0;
    }

    // Fade and shrink existing afterimages
    this.afterimages = this.afterimages.filter(img => {
      img.alpha -= dt * 2;
      img.scale -= dt * 0.3;
      return img.alpha > 0 && img.scale > 0.5;
    });
  }

  private renderAfterimages(ctx: CanvasRenderingContext2D): void {
    if (this.afterimages.length === 0) return;

    ctx.save();

    for (let i = this.afterimages.length - 1; i >= 0; i--) {
      const img = this.afterimages[i];

      ctx.save();
      ctx.globalAlpha = img.alpha * 0.5;
      ctx.translate(img.x + this.size.x / 2, img.y + this.size.y / 2);
      ctx.scale(img.scale, img.scale);
      ctx.translate(-this.size.x / 2, -this.size.y / 2);

      // Simplified player shape (orange tint for speed boost)
      ctx.fillStyle = `rgba(249, 115, 22, ${img.alpha})`;
      ctx.fillRect(0, 0, this.size.x, this.size.y);

      ctx.restore();
    }

    ctx.restore();
  }

  jump(): void {
    if (this.jumpsRemaining > 0) {
      this.velocity.y = this.jumpPower;
      this.jumpsRemaining--;
      this.isJumping = true;
      this.jumpHoldTime = 0;

      // Stretch effect on jump
      this.squashStretch = 0.6; // More pronounced stretch

      if (!this.isGrounded) {
        // Double jump effect - slightly weaker but still good
        this.velocity.y = this.jumpPower * 0.85;
      } else {
        this.isGrounded = false;
      }
    }
  }

  startSlide(): void {
    this.isSliding = true;
    this.slideDuration = 0;
    // Squash effect for slide
    this.squashStretch = 1.3;
  }

  endSlide(): void {
    this.isSliding = false;
    this.slideDuration = 0;
  }

  render(ctx: CanvasRenderingContext2D): void {
    // Render afterimages first (behind everything)
    this.renderAfterimages(ctx);

    // Render trail
    this.renderTrail(ctx);

    const bob = this.isGrounded && !this.isSliding ? Math.sin(this.runTime) * 1.5 : 0;

    ctx.save();
    ctx.translate(this.position.x + this.size.x / 2, this.position.y + this.size.y / 2 + bob);

    // Apply squash and stretch (more extreme when sliding)
    if (this.isSliding) {
      ctx.scale(1.5, 0.5);
    } else {
      ctx.scale(this.squashStretch, 2 - this.squashStretch);
    }

    // Slight rotation based on vertical velocity (or forward lean when sliding)
    if (this.isSliding) {
      ctx.rotate(0.1); // Forward lean
    } else {
      ctx.rotate(this.velocity.y * 0.02);
    }

    ctx.translate(-this.size.x / 2, -this.size.y / 2);

    // Body with enhanced visuals
    const gradient = ctx.createLinearGradient(0, 0, 0, this.size.y);
    gradient.addColorStop(0, '#4ADE80');
    gradient.addColorStop(1, '#22C55E');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.size.x, this.size.y);

    // Eyes with blink animation
    const blinkTime = Math.sin(this.runTime * 0.5);
    const eyeHeight = blinkTime > 0.95 ? 2 : 4;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(8, 8, 4, eyeHeight);
    ctx.fillRect(20, 8, 4, eyeHeight);

    // Moving arms
    const armOffset = Math.sin(this.runTime + Math.PI / 2) * 2;
    ctx.fillStyle = '#15803D';
    ctx.fillRect(2 + armOffset, 16, 4, 8);
    ctx.fillRect(this.size.x - 6 - armOffset, 16, 4, 8);

    // Moving legs (only when grounded)
    if (this.isGrounded) {
      const legOffset = Math.sin(this.runTime) * 3;
      ctx.fillStyle = '#22C55E';
      ctx.fillRect(6 + legOffset, 28, 6, 8);
      ctx.fillRect(20 - legOffset, 28, 6, 8);
    } else {
      // Legs in jump position
      ctx.fillStyle = '#22C55E';
      ctx.fillRect(6, 30, 6, 6);
      ctx.fillRect(20, 30, 6, 6);
    }

    // Enhanced cape effect when jumping - LONGER CAPE!
    if (!this.isGrounded) {
      ctx.fillStyle = '#DC2626';
      ctx.globalAlpha = 0.8;
      // Longer, more dramatic cape
      ctx.fillRect(-4, 6, 5, 24); // Wider and longer cape
      // Cape flowing effect
      const capeFlow = Math.sin(this.runTime * 2) * 2;
      ctx.fillRect(-6 + capeFlow, 10, 3, 20);
      ctx.globalAlpha = 1;
    }

    // Slide dust effect
    if (this.isSliding) {
      ctx.fillStyle = '#A8A29E';
      ctx.globalAlpha = 0.6;
      // Dust trail behind player
      for (let i = 0; i < 3; i++) {
        const offset = i * 8;
        const size = 4 - i;
        ctx.fillRect(this.size.x + offset, this.size.y - 4, size, size);
      }
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }

  private renderTrail(ctx: CanvasRenderingContext2D): void {
    if (this.trailPositions.length < 2) return;
    
    ctx.save();
    
    for (let i = 1; i < this.trailPositions.length; i++) {
      const pos = this.trailPositions[i];
      const alpha = (this.trailPositions.length - i) / this.trailPositions.length * 0.3;
      const size = (this.trailPositions.length - i) / this.trailPositions.length * this.size.x * 0.8;
      
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#4ADE80';
      ctx.fillRect(
        pos.x + (this.size.x - size) / 2, 
        pos.y + (this.size.y - size) / 2, 
        size, 
        size
      );
    }
    
    ctx.restore();
  }

  getBounds(): Rectangle {
    // Smaller hitbox when sliding
    if (this.isSliding) {
      return new Rectangle(
        this.position.x,
        this.position.y + this.size.y / 2,
        this.size.x,
        this.size.y / 2
      );
    }
    return new Rectangle(this.position.x, this.position.y, this.size.x, this.size.y);
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
