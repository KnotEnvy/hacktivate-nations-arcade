// ===== src/games/bubble/entities/Shooter.ts =====

import { Bubble, BubbleColor, PowerUpType, BUBBLE_COLORS, POWERUP_COLORS } from './Bubble';

export interface ShooterConfig {
  x: number;
  y: number;
  canvasWidth: number;
  canvasHeight: number;
}

export class Shooter {
  public x: number;
  public y: number;
  private canvasWidth: number;
  private canvasHeight: number;

  // Aiming
  public angle: number = -Math.PI / 2; // Pointing up
  private targetAngle: number = -Math.PI / 2;
  private readonly MIN_ANGLE = -Math.PI + 0.3;
  private readonly MAX_ANGLE = -0.3;
  private readonly AIM_SMOOTHING = 0.15;

  // Current and next bubble
  public currentBubble: Bubble | null = null;
  public nextBubble: Bubble | null = null;

  // Shooting
  private shootingBubble: Bubble | null = null;
  private shootVelocity: { x: number; y: number } = { x: 0, y: 0 };
  private readonly SHOOT_SPEED = 800;

  // Visual
  private chargePhase: number = 0;
  private swapAnimation: number = 0;
  private isSwapping: boolean = false;

  // Trajectory preview
  private trajectoryPoints: { x: number; y: number }[] = [];

  constructor(config: ShooterConfig) {
    this.x = config.x;
    this.y = config.y;
    this.canvasWidth = config.canvasWidth;
    this.canvasHeight = config.canvasHeight;
  }

  public update(dt: number): void {
    this.chargePhase += dt * 4;

    // Smooth aim interpolation
    const angleDiff = this.targetAngle - this.angle;
    this.angle += angleDiff * this.AIM_SMOOTHING;

    // Update swap animation
    if (this.isSwapping) {
      this.swapAnimation += dt * 8;
      if (this.swapAnimation >= 1) {
        this.swapAnimation = 0;
        this.isSwapping = false;
      }
    }

    // Update shooting bubble
    if (this.shootingBubble) {
      this.shootingBubble.x += this.shootVelocity.x * dt;
      this.shootingBubble.y += this.shootVelocity.y * dt;

      // Wall bouncing
      const radius = this.shootingBubble.radius;
      if (this.shootingBubble.x - radius < 0) {
        this.shootingBubble.x = radius;
        this.shootVelocity.x = Math.abs(this.shootVelocity.x);
      } else if (this.shootingBubble.x + radius > this.canvasWidth) {
        this.shootingBubble.x = this.canvasWidth - radius;
        this.shootVelocity.x = -Math.abs(this.shootVelocity.x);
      }

      // Update bubble animation
      this.shootingBubble.update(dt);
    }

    // Calculate trajectory
    this.calculateTrajectory();
  }

  public aimAt(x: number, y: number): void {
    // Calculate angle from shooter to target
    const dx = x - this.x;
    const dy = y - this.y;
    this.targetAngle = Math.atan2(dy, dx);

    // Clamp angle
    this.targetAngle = Math.max(this.MIN_ANGLE, Math.min(this.MAX_ANGLE, this.targetAngle));
  }

  public aimWithKeys(left: boolean, right: boolean, dt: number): void {
    const aimSpeed = 2;
    if (left) {
      this.targetAngle -= aimSpeed * dt;
    }
    if (right) {
      this.targetAngle += aimSpeed * dt;
    }
    this.targetAngle = Math.max(this.MIN_ANGLE, Math.min(this.MAX_ANGLE, this.targetAngle));
  }

  public shoot(): Bubble | null {
    if (!this.currentBubble || this.shootingBubble) return null;

    const bubble = this.currentBubble;
    bubble.x = this.x;
    bubble.y = this.y;

    this.shootVelocity = {
      x: Math.cos(this.angle) * this.SHOOT_SPEED,
      y: Math.sin(this.angle) * this.SHOOT_SPEED,
    };

    this.shootingBubble = bubble;
    this.currentBubble = null;

    // Move next to current
    this.loadNextBubble();

    return bubble;
  }

  private loadNextBubble(): void {
    this.currentBubble = this.nextBubble;
    this.nextBubble = null;
    this.isSwapping = true;
    this.swapAnimation = 0;
  }

  public setNextBubble(color: BubbleColor, powerUp?: PowerUpType): void {
    this.nextBubble = new Bubble({
      gridX: -1,
      gridY: -1,
      color: powerUp ? null : color,
      powerUp: powerUp,
    });
    this.nextBubble.radius = 18;
  }

  public setCurrentBubble(color: BubbleColor, powerUp?: PowerUpType): void {
    this.currentBubble = new Bubble({
      gridX: -1,
      gridY: -1,
      color: powerUp ? null : color,
      powerUp: powerUp,
    });
    this.currentBubble.radius = 18;
  }

  public swapBubbles(): void {
    if (!this.currentBubble || !this.nextBubble || this.isSwapping) return;

    const temp = this.currentBubble;
    this.currentBubble = this.nextBubble;
    this.nextBubble = temp;
    this.isSwapping = true;
    this.swapAnimation = 0;
  }

  public getShootingBubble(): Bubble | null {
    return this.shootingBubble;
  }

  public clearShootingBubble(): void {
    this.shootingBubble = null;
  }

  public isReadyToShoot(): boolean {
    return this.currentBubble !== null && this.shootingBubble === null;
  }

  public hasShootingBubble(): boolean {
    return this.shootingBubble !== null;
  }

  private calculateTrajectory(): void {
    this.trajectoryPoints = [];

    let x = this.x;
    let y = this.y;
    let vx = Math.cos(this.angle) * this.SHOOT_SPEED;
    let vy = Math.sin(this.angle) * this.SHOOT_SPEED;
    const radius = 18;
    const dt = 0.016; // 60fps timestep
    const maxPoints = 60;
    const bounceLimit = 3;
    let bounces = 0;

    for (let i = 0; i < maxPoints && bounces <= bounceLimit; i++) {
      x += vx * dt;
      y += vy * dt;

      // Wall bouncing
      if (x - radius < 0) {
        x = radius;
        vx = Math.abs(vx);
        bounces++;
      } else if (x + radius > this.canvasWidth) {
        x = this.canvasWidth - radius;
        vx = -Math.abs(vx);
        bounces++;
      }

      // Stop at top
      if (y < 50) {
        this.trajectoryPoints.push({ x, y });
        break;
      }

      // Add point every few steps
      if (i % 3 === 0) {
        this.trajectoryPoints.push({ x, y });
      }
    }
  }

  public render(ctx: CanvasRenderingContext2D): void {
    // Render trajectory preview
    this.renderTrajectory(ctx);

    // Render shooter base
    this.renderBase(ctx);

    // Render cannon
    this.renderCannon(ctx);

    // Render current bubble
    if (this.currentBubble) {
      this.renderCurrentBubble(ctx);
    }

    // Render next bubble
    if (this.nextBubble) {
      this.renderNextBubble(ctx);
    }

    // Render shooting bubble
    if (this.shootingBubble) {
      this.shootingBubble.render(ctx);
    }
  }

  private renderTrajectory(ctx: CanvasRenderingContext2D): void {
    if (this.trajectoryPoints.length < 2) return;

    ctx.save();

    // Dotted line trajectory
    for (let i = 0; i < this.trajectoryPoints.length; i++) {
      const point = this.trajectoryPoints[i];
      const alpha = 1 - (i / this.trajectoryPoints.length) * 0.7;
      const size = 4 - (i / this.trajectoryPoints.length) * 2;

      ctx.globalAlpha = alpha * 0.5;
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(point.x, point.y, size, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  private renderBase(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.translate(this.x, this.y);

    // Base platform
    const gradient = ctx.createLinearGradient(-50, -10, -50, 30);
    gradient.addColorStop(0, '#4B5563');
    gradient.addColorStop(1, '#1F2937');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(-50, 0);
    ctx.lineTo(-40, -15);
    ctx.lineTo(40, -15);
    ctx.lineTo(50, 0);
    ctx.lineTo(50, 20);
    ctx.lineTo(-50, 20);
    ctx.closePath();
    ctx.fill();

    // Metallic highlight
    ctx.strokeStyle = '#6B7280';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.restore();
  }

  private renderCannon(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle + Math.PI / 2);

    // Cannon barrel
    const barrelGradient = ctx.createLinearGradient(-15, 0, 15, 0);
    barrelGradient.addColorStop(0, '#374151');
    barrelGradient.addColorStop(0.5, '#6B7280');
    barrelGradient.addColorStop(1, '#374151');

    ctx.fillStyle = barrelGradient;
    ctx.fillRect(-12, -60, 24, 50);

    // Barrel tip
    ctx.fillStyle = '#1F2937';
    ctx.fillRect(-14, -65, 28, 8);

    // Barrel rings
    ctx.strokeStyle = '#9CA3AF';
    ctx.lineWidth = 2;
    ctx.strokeRect(-13, -55, 26, 6);
    ctx.strokeRect(-13, -40, 26, 6);

    // Cannon base (circular)
    ctx.fillStyle = '#4B5563';
    ctx.beginPath();
    ctx.arc(0, 0, 20, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#6B7280';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Center bolt
    ctx.fillStyle = '#1F2937';
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  private renderCurrentBubble(ctx: CanvasRenderingContext2D): void {
    if (!this.currentBubble) return;

    ctx.save();

    // Position at cannon tip
    const offsetY = this.isSwapping ? -30 + this.swapAnimation * -30 : -60;
    ctx.translate(
      this.x + Math.cos(this.angle) * Math.abs(offsetY),
      this.y + Math.sin(this.angle) * Math.abs(offsetY)
    );

    // Pulsing glow
    const pulse = Math.sin(this.chargePhase) * 0.2 + 0.8;
    ctx.globalAlpha = pulse;

    // Set bubble position for rendering
    this.currentBubble.x = 0;
    this.currentBubble.y = 0;

    // Render at origin (already translated)
    ctx.save();
    ctx.translate(-this.currentBubble.x, -this.currentBubble.y);
    this.currentBubble.render(ctx);
    ctx.restore();

    ctx.restore();
  }

  private renderNextBubble(ctx: CanvasRenderingContext2D): void {
    if (!this.nextBubble) return;

    ctx.save();

    // Position to the side
    const sideX = this.x - 60;
    const sideY = this.y + 10;

    ctx.translate(sideX, sideY);

    // Smaller scale for next bubble
    ctx.scale(0.7, 0.7);

    // Label
    ctx.fillStyle = '#9CA3AF';
    ctx.font = '10px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('NEXT', 0, -30);

    // Render bubble
    this.nextBubble.x = 0;
    this.nextBubble.y = 0;
    ctx.save();
    ctx.translate(-this.nextBubble.x, -this.nextBubble.y);
    this.nextBubble.render(ctx);
    ctx.restore();

    ctx.restore();
  }

  public resize(canvasWidth: number, canvasHeight: number): void {
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;
    this.x = canvasWidth / 2;
    this.y = canvasHeight - 60;
  }
}
