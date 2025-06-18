// ===== src/games/runner/entities/Player.ts =====
import { Vector2, Rectangle } from '@/games/shared/utils/Vector2';

export class Player {
  position: Vector2;
  velocity: Vector2;
  size: Vector2;
  
  private isGrounded: boolean = true;
  private jumpPower: number = -15;
  private gravity: number = 0.8;
  private groundY: number;

  // Animation
  private frameTime: number = 0;
  private currentFrame: number = 0;
  private animationSpeed: number = 0.15;

  constructor(x: number, y: number, groundY: number) {
    this.position = new Vector2(x, y);
    this.velocity = new Vector2(0, 0);
    this.size = new Vector2(32, 32);
    this.groundY = groundY;
  }

  update(dt: number, inputPressed: boolean): void {
    // Handle jumping
    if (inputPressed && this.isGrounded) {
      this.jump();
    }

    // Apply gravity
    this.velocity.y += this.gravity;

    // Update position
    this.position = this.position.add(this.velocity.multiply(dt * 60));

    // Ground collision
    if (this.position.y >= this.groundY - this.size.y) {
      this.position.y = this.groundY - this.size.y;
      this.velocity.y = 0;
      this.isGrounded = true;
    } else {
      this.isGrounded = false;
    }

    // Update animation
    this.frameTime += dt;
    if (this.frameTime >= this.animationSpeed) {
      this.currentFrame = (this.currentFrame + 1) % 4;
      this.frameTime = 0;
    }
  }

  jump(): void {
    if (this.isGrounded) {
      this.velocity.y = this.jumpPower;
      this.isGrounded = false;
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = this.isGrounded ? '#4ADE80' : '#22C55E'; // Green, darker when jumping
    
    // Simple character representation
    ctx.fillRect(
      this.position.x, 
      this.position.y, 
      this.size.x, 
      this.size.y
    );

    // Add some character details
    ctx.fillStyle = '#FFFFFF';
    // Eyes
    ctx.fillRect(this.position.x + 8, this.position.y + 8, 4, 4);
    ctx.fillRect(this.position.x + 20, this.position.y + 8, 4, 4);
    
    // Running animation - simple leg movement
    if (this.isGrounded) {
      const legOffset = Math.sin(this.currentFrame * Math.PI) * 3;
      ctx.fillStyle = '#22C55E';
      ctx.fillRect(this.position.x + 6 + legOffset, this.position.y + 28, 6, 8);
      ctx.fillRect(this.position.x + 20 - legOffset, this.position.y + 28, 6, 8);
    }
  }

  getBounds(): Rectangle {
    return new Rectangle(this.position.x, this.position.y, this.size.x, this.size.y);
  }

  getIsGrounded(): boolean {
    return this.isGrounded;
  }
}
