// ===== src/games/runner/entities/Boss.ts =====
import { Vector2, Rectangle } from '@/games/shared/utils/Vector2';

export class Boss {
  position: Vector2;
  size: Vector2;
  health: number;
  maxHealth: number;
  velocity: Vector2;

  // Attack pattern
  private attackTimer: number = 0;
  private attackCooldown: number = 2; // seconds
  private animationTime: number = 0;
  private phase: 'intro' | 'fight' | 'defeat' = 'intro';
  private introTimer: number = 0;
  private introTime: number = 2; // 2 second intro

  // Movement pattern
  private movementTimer: number = 0;
  private targetY: number;
  private groundY: number;

  constructor(x: number, groundY: number) {
    this.groundY = groundY;
    this.position = new Vector2(x, groundY - 120);
    this.size = new Vector2(80, 80);
    this.velocity = new Vector2(-50, 0);
    this.health = 10;
    this.maxHealth = 10;
    this.targetY = this.position.y;
  }

  update(dt: number, gameSpeed: number): void {
    this.animationTime += dt;

    if (this.phase === 'intro') {
      this.introTimer += dt;
      if (this.introTimer >= this.introTime) {
        this.phase = 'fight';
      }
      // Slow entrance
      this.velocity.x = -30;
      this.position.x += this.velocity.x * dt * 60;

      // Stop at center-right of screen
      if (this.position.x < 600) {
        this.position.x = 600;
        this.velocity.x = 0;
      }
      return;
    }

    if (this.phase === 'defeat') {
      // Sink down
      this.velocity.y = 100;
      this.position.y += this.velocity.y * dt * 60;
      return;
    }

    // Fight phase
    this.attackTimer += dt;
    this.movementTimer += dt;

    // Vertical movement pattern (wave motion)
    this.targetY = this.groundY - 120 + Math.sin(this.movementTimer * 1.5) * 40;
    const dy = this.targetY - this.position.y;
    this.position.y += dy * dt * 3;

    // Horizontal bobbing
    this.position.x = 600 + Math.sin(this.movementTimer * 2) * 20;
  }

  takeDamage(amount: number = 1): boolean {
    this.health -= amount;
    if (this.health <= 0) {
      this.phase = 'defeat';
      return true;
    }
    return false;
  }

  shouldAttack(): boolean {
    if (this.phase !== 'fight') return false;

    if (this.attackTimer >= this.attackCooldown) {
      this.attackTimer = 0;
      return true;
    }
    return false;
  }

  render(ctx: CanvasRenderingContext2D): void {
    ctx.save();

    // Pulse effect when damaged
    const healthPercent = this.health / this.maxHealth;
    if (healthPercent < 0.3) {
      const flash = Math.sin(this.animationTime * 10) > 0;
      if (flash) {
        ctx.globalAlpha = 0.7;
      }
    }

    // Boss body with gradient
    const gradient = ctx.createRadialGradient(
      this.position.x + this.size.x / 2,
      this.position.y + this.size.y / 2,
      10,
      this.position.x + this.size.x / 2,
      this.position.y + this.size.y / 2,
      this.size.x
    );
    gradient.addColorStop(0, '#DC2626');
    gradient.addColorStop(0.5, '#991B1B');
    gradient.addColorStop(1, '#7F1D1D');

    ctx.fillStyle = gradient;
    ctx.fillRect(this.position.x, this.position.y, this.size.x, this.size.y);

    // Spikes around boss
    ctx.fillStyle = '#450A0A';
    const spikeCount = 8;
    for (let i = 0; i < spikeCount; i++) {
      const angle = (i / spikeCount) * Math.PI * 2 + this.animationTime;
      const x = this.position.x + this.size.x / 2 + Math.cos(angle) * (this.size.x / 2 + 8);
      const y = this.position.y + this.size.y / 2 + Math.sin(angle) * (this.size.y / 2 + 8);

      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(
        x + Math.cos(angle) * 12,
        y + Math.sin(angle) * 12
      );
      ctx.lineTo(
        x + Math.cos(angle + 0.3) * 8,
        y + Math.sin(angle + 0.3) * 8
      );
      ctx.closePath();
      ctx.fill();
    }

    // Evil eyes
    const eyeGlow = Math.sin(this.animationTime * 4) * 0.3 + 0.7;
    ctx.fillStyle = `rgba(239, 68, 68, ${eyeGlow})`;
    ctx.shadowColor = '#EF4444';
    ctx.shadowBlur = 15;
    ctx.fillRect(this.position.x + 20, this.position.y + 25, 12, 12);
    ctx.fillRect(this.position.x + 48, this.position.y + 25, 12, 12);
    ctx.shadowBlur = 0;

    // Health bar
    const barWidth = this.size.x;
    const barHeight = 6;
    const barX = this.position.x;
    const barY = this.position.y - 15;

    // Background
    ctx.fillStyle = '#374151';
    ctx.fillRect(barX, barY, barWidth, barHeight);

    // Health
    ctx.fillStyle = healthPercent > 0.3 ? '#EF4444' : '#FCA5A5';
    ctx.fillRect(barX, barY, barWidth * healthPercent, barHeight);

    // Border
    ctx.strokeStyle = '#1F2937';
    ctx.lineWidth = 2;
    ctx.strokeRect(barX, barY, barWidth, barHeight);

    ctx.restore();
  }

  getBounds(): Rectangle {
    return new Rectangle(this.position.x, this.position.y, this.size.x, this.size.y);
  }

  isDefeated(): boolean {
    return this.phase === 'defeat';
  }

  isOffScreen(): boolean {
    return this.position.y > this.groundY + 100;
  }

  getAttackPosition(): Vector2 {
    // Return position where boss attacks from
    return new Vector2(
      this.position.x,
      this.position.y + this.size.y / 2
    );
  }
}
