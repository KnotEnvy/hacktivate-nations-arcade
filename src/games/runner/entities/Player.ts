// ===== src/games/runner/entities/Player.ts (FIXED) =====
import { Vector2, Rectangle } from '@/games/shared/utils/Vector2';

export class Player {
  position: Vector2;
  velocity: Vector2;
  size: Vector2;
  
  private isGrounded: boolean = true;
  private jumpPower: number = -9;
  private maxJumpHoldTime: number = 0.2;
  private jumpHoldTime: number = 0;
  private jumpHoldBoost: number = -0.6;
  private isJumping: boolean = false;
  private gravity: number = 0.8;
  private groundY: number;
  private jumpsRemaining: number = 1;
  private maxJumps: number = 1;
  private lastJumpPressed: boolean = false;

  // Animation
  private frameTime: number = 0;
  private currentFrame: number = 0;
  private animationSpeed: number = 0.15;
  private runTime: number = 0;
  private squashStretch: number = 1;

  // Trail effect
  private trailPositions: Vector2[] = [];
  private maxTrailLength: number = 8;

  constructor(x: number, y: number, groundY: number) {
    this.position = new Vector2(x, y);
    this.velocity = new Vector2(0, 0);
    this.size = new Vector2(32, 32);
    this.groundY = groundY;
  }

  update(dt: number, inputPressed: boolean, hasDoubleJump: boolean = false): void {
    // Update max jumps based on power-up
    this.maxJumps = hasDoubleJump ? 2 : 1;
    
    // Handle jumping (only on button press, not hold)
    if (inputPressed && !this.lastJumpPressed && this.jumpsRemaining > 0) {
      this.jump();
      this.isJumping = true;
      this.jumpHoldTime = 0;
    }

    // Variable jump height while holding the button
    if (
      this.isJumping &&
      inputPressed &&
      !this.isGrounded &&
      this.jumpHoldTime < this.maxJumpHoldTime
    ) {
      this.velocity.y += this.jumpHoldBoost;
      this.jumpHoldTime += dt;
    } else if (!inputPressed || this.jumpHoldTime >= this.maxJumpHoldTime) {
      this.isJumping = false;
    }
    this.lastJumpPressed = inputPressed;

    // Apply gravity
    this.velocity.y += this.gravity;

    // Update position
    this.position = this.position.add(this.velocity.multiply(dt * 60));

    // Ground collision
    if (this.position.y >= this.groundY - this.size.y) {
      const wasAirborne = !this.isGrounded;
      this.position.y = this.groundY - this.size.y;
      this.velocity.y = 0;
      this.isGrounded = true;
      this.jumpsRemaining = this.maxJumps;

      this.isJumping = false;
      this.jumpHoldTime = this.maxJumpHoldTime;
      
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

  jump(): void {
    if (this.jumpsRemaining > 0) {
      this.velocity.y = this.jumpPower;
      this.jumpsRemaining--;
      
      // Stretch effect on jump
      this.squashStretch = 0.6; // More pronounced stretch
      
      if (!this.isGrounded) {
        // Double jump effect - slightly weaker but still good
        this.velocity.y = this.jumpPower * 0.85;
        console.log('🦅 Double jump activated!'); // Debug log
      } else {
        this.isGrounded = false;
      }
      
      console.log(`🎮 Jump! Jumps remaining: ${this.jumpsRemaining}`); // Debug log
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    // Render trail
    this.renderTrail(ctx);
    
    const bob = this.isGrounded ? Math.sin(this.runTime) * 1.5 : 0;
    
    ctx.save();
    ctx.translate(this.position.x + this.size.x / 2, this.position.y + this.size.y / 2 + bob);
    
    // Apply squash and stretch
    ctx.scale(this.squashStretch, 2 - this.squashStretch);
    
    // Slight rotation based on vertical velocity
    ctx.rotate(this.velocity.y * 0.02);
    
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
    return new Rectangle(this.position.x, this.position.y, this.size.x, this.size.y);
  }

  getIsGrounded(): boolean {
    return this.isGrounded;
  }

  getJumpsRemaining(): number {
    return this.jumpsRemaining;
  }
}
