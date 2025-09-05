import { BaseGame } from '@/games/shared/BaseGame';
import { GameManifest } from '@/lib/types';

interface Vec2 { x: number; y: number }
interface Brick { x: number; y: number; w: number; h: number; hp: number; alive: boolean; color: string }
interface Particle { x: number; y: number; vx: number; vy: number; life: number; color: string; size: number }
interface PowerUp { x: number; y: number; w: number; h: number; vy: number; type: 'widen' }

export class BreakoutGame extends BaseGame {
  manifest: GameManifest = {
    id: 'breakout',
    title: 'Mini Breakout',
    thumbnail: '/games/breakout/breakout-thumb.svg',
    inputSchema: ['keyboard', 'touch'],
    assetBudgetKB: 60,
    tier: 0,
    description: 'Break bricks with a paddle. Clear the board!'
  };

  private paddle = { x: 0, y: 0, w: 100, h: 14, speed: 420 };
  private ball: Vec2 = { x: 0, y: 0 };
  private ballVel: Vec2 = { x: 180, y: -220 };
  private ballR = 6;
  private bricks: Brick[] = [];
  private rows = 5;
  private cols = 10;
  private lives = 3;
  private started = false;
  private particles: Particle[] = [];
  private powerups: PowerUp[] = [];
  private widenTimer = 0; // active widen seconds
  private shakeTime = 0; private shakeMag = 0;

  protected onInit(): void {
    this.resetLevel();
  }

  protected onRestart(): void {
    this.score = 0;
    this.pickups = 0;
    this.lives = 3;
    this.started = false;
    this.resetLevel();
  }

  private resetLevel(): void {
    // Paddle in bottom center
    this.paddle.w = Math.max(70, Math.min(120, Math.floor(this.canvas.width * 0.12)));
    this.paddle.x = this.canvas.width / 2 - this.paddle.w / 2;
    this.paddle.y = this.canvas.height - 40;
    // Ball sits on paddle until started
    this.ball.x = this.paddle.x + this.paddle.w / 2;
    this.ball.y = this.paddle.y - this.ballR - 1;
    this.ballVel = { x: 180, y: -220 };
    // Build bricks
    this.buildBricks();
    this.particles = [];
    this.powerups = [];
  }

  private buildBricks(): void {
    this.bricks = [];
    const margin = 20;
    const top = 60;
    const w = (this.canvas.width - margin * 2) / this.cols - 6;
    const h = 18;
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const x = margin + c * (w + 6);
        const y = top + r * (h + 6);
        const hp = r < 2 ? 1 : r < 4 ? 2 : 3;
        const color = hp === 1 ? '#60A5FA' : hp === 2 ? '#F59E0B' : '#EF4444';
        this.bricks.push({ x, y, w, h, hp, alive: true, color });
      }
    }
  }

  protected onUpdate(dt: number): void {
    this.handleInput(dt);

    if (!this.started) {
      // Keep ball on paddle until first action
      this.ball.x = this.paddle.x + this.paddle.w / 2;
      this.ball.y = this.paddle.y - this.ballR - 1;
      return;
    }

    // Move ball
    this.ball.x += this.ballVel.x * dt;
    this.ball.y += this.ballVel.y * dt;

    // Wall collisions
    if (this.ball.x < this.ballR) { this.ball.x = this.ballR; this.ballVel.x *= -1; this.services.audio.playSound('collision'); }
    if (this.ball.x > this.canvas.width - this.ballR) { this.ball.x = this.canvas.width - this.ballR; this.ballVel.x *= -1; this.services.audio.playSound('collision'); }
    if (this.ball.y < this.ballR) { this.ball.y = this.ballR; this.ballVel.y *= -1; this.services.audio.playSound('collision'); }

    // Paddle collision
    if (this.ball.y + this.ballR >= this.paddle.y && this.ball.y - this.ballR <= this.paddle.y + this.paddle.h) {
      if (this.ball.x > this.paddle.x && this.ball.x < this.paddle.x + this.paddle.w && this.ballVel.y > 0) {
        // Reflect with angle based on hit position
        const hit = (this.ball.x - (this.paddle.x + this.paddle.w / 2)) / (this.paddle.w / 2);
        const speed = Math.hypot(this.ballVel.x, this.ballVel.y) * 1.02;
        const angle = hit * (Math.PI / 3); // +/-60 degrees
        this.ballVel.x = Math.sin(angle) * speed;
        this.ballVel.y = -Math.cos(angle) * speed;
        this.ball.y = this.paddle.y - this.ballR - 1;
        this.services.audio.playSound('click');
      }
    }

    // Brick collisions (simple AABB)
    for (const b of this.bricks) {
      if (!b.alive) continue;
      if (this.ball.x + this.ballR < b.x || this.ball.x - this.ballR > b.x + b.w || this.ball.y + this.ballR < b.y || this.ball.y - this.ballR > b.y + b.h) continue;
      // Hit: decide bounce axis by penetration
      const overlapX = Math.min(this.ball.x + this.ballR - b.x, b.x + b.w - (this.ball.x - this.ballR));
      const overlapY = Math.min(this.ball.y + this.ballR - b.y, b.y + b.h - (this.ball.y - this.ballR));
      if (overlapX < overlapY) {
        this.ballVel.x *= -1;
      } else {
        this.ballVel.y *= -1;
      }
      // Damage brick
      b.hp -= 1;
      if (b.hp <= 0) {
        b.alive = false; this.score += 50; this.pickups += 1;
        this.spawnParticles(b, 12);
        this.maybeDropPowerUp(b);
        this.addShake(0.08, 3);
      } else { this.score += 10; this.spawnParticles(b, 6); }
      this.services.audio.playSound('collision');
      break;
    }

    // Ball fell below
    if (this.ball.y - this.ballR > this.canvas.height) {
      this.lives -= 1;
      if (this.lives <= 0) {
        this.endGame();
        return;
      }
      this.started = false;
      this.services.audio.playSound('game_over');
      // Reset ball
      this.ball.x = this.paddle.x + this.paddle.w / 2;
      this.ball.y = this.paddle.y - this.ballR - 1;
      this.ballVel = { x: 180 * (Math.random() > 0.5 ? 1 : -1), y: -220 };
    }

    // Level cleared
    if (this.bricks.every(b => !b.alive)) {
      this.score += 200;
      this.rows = Math.min(8, this.rows + 1);
      this.cols = Math.min(12, this.cols + 0);
      this.started = false;
      this.buildBricks();
      this.services.audio.playSound('success');
    }

    // Update power-ups
    for (const p of this.powerups) p.y += p.vy * dt;
    // Paddle catches power-ups
    for (const p of this.powerups) {
      if (p.y + p.h >= this.paddle.y && p.y <= this.paddle.y + this.paddle.h && p.x + p.w >= this.paddle.x && p.x <= this.paddle.x + this.paddle.w) {
        if (p.type === 'widen') {
          this.widenTimer = Math.min(8, this.widenTimer + 6); // stack duration up to 8s
          this.services.audio.playSound('powerup');
        }
        p.y = this.canvas.height + 100; // collect
      }
    }
    this.powerups = this.powerups.filter(p => p.y < this.canvas.height + 40);

    // Apply widen effect
    if (this.widenTimer > 0) {
      this.widenTimer -= dt;
      const base = Math.max(70, Math.min(120, Math.floor(this.canvas.width * 0.12)));
      const widened = base * 1.35;
      const target = this.widenTimer > 0 ? widened : base;
      // Smooth towards target
      this.paddle.w += (target - this.paddle.w) * Math.min(1, dt * 10);
      // Keep paddle within bounds
      this.paddle.x = Math.max(0, Math.min(this.canvas.width - this.paddle.w, this.paddle.x));
    }

    // Update particles
    for (const pt of this.particles) {
      pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.life -= dt; pt.vy += 300 * dt; // gravity
    }
    this.particles = this.particles.filter(pt => pt.life > 0).slice(-200);
  }

  private handleInput(dt: number): void {
    const move = this.paddle.speed * dt;
    if (this.services.input.isLeftPressed()) this.paddle.x -= move;
    if (this.services.input.isRightPressed()) this.paddle.x += move;

    // Touch follows finger
    const touches = this.services.input.getTouches?.() || [];
    if (touches.length > 0) {
      const target = touches[0].x - this.paddle.w / 2;
      const lerp = 1 - Math.pow(0.001, dt);
      this.paddle.x = this.paddle.x + (target - this.paddle.x) * lerp;
      if (!this.started) this.started = true; // start on touch
    }

    // Clamp
    this.paddle.x = Math.max(0, Math.min(this.canvas.width - this.paddle.w, this.paddle.x));

    // Start on action (keyboard/mouse)
    if (!this.started && this.services.input.isActionPressed()) {
      this.started = true;
      this.services.audio.playSound('click');
    }
  }

  protected onRender(ctx: CanvasRenderingContext2D): void {
    // Background with tiny shake
    ctx.fillStyle = '#0B1020';
    if (this.shakeTime > 0) {
      this.shakeTime = Math.max(0, this.shakeTime - 1 / 60);
      const m = this.shakeMag * this.shakeTime;
      ctx.save();
      ctx.translate((Math.random() - 0.5) * 2 * m, (Math.random() - 0.5) * 2 * m);
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      this.renderScene(ctx);
      ctx.restore();
    } else {
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      this.renderScene(ctx);
    }
  }

  private renderScene(ctx: CanvasRenderingContext2D): void {
    // Bricks
    for (const b of this.bricks) {
      if (!b.alive) continue;
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, b.w, b.h);
    }

    // Power-ups
    for (const p of this.powerups) {
      ctx.fillStyle = '#10B981';
      ctx.fillRect(p.x, p.y, p.w, p.h);
    }

    // Paddle
    ctx.fillStyle = '#22D3EE';
    ctx.fillRect(this.paddle.x, this.paddle.y, this.paddle.w, this.paddle.h);

    // Ball
    ctx.fillStyle = '#FBBF24';
    ctx.beginPath();
    ctx.arc(this.ball.x, this.ball.y, this.ballR, 0, Math.PI * 2);
    ctx.fill();

    // Particles
    for (const pt of this.particles) {
      ctx.globalAlpha = Math.max(0, Math.min(1, pt.life));
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x, pt.y, pt.size, pt.size);
    }
    ctx.globalAlpha = 1;
  }

  protected onRenderUI(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`Score: ${this.score}`, 16, 24);
    ctx.fillText(`Lives: ${this.lives}`, 16, 44);
    if (this.widenTimer > 0) {
      ctx.fillText(`Widen: ${this.widenTimer.toFixed(1)}s`, 16, 64);
    }
    if (!this.started) {
      ctx.textAlign = 'center';
      ctx.fillText('Press Space/Touch to Launch', this.canvas.width / 2, this.canvas.height / 2 + 40);
    }
  }

  private spawnParticles(b: Brick, count: number): void {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 80 + Math.random() * 160;
      this.particles.push({
        x: b.x + b.w / 2,
        y: b.y + b.h / 2,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.4 + Math.random() * 0.4,
        color: b.color,
        size: 2 + Math.random() * 2,
      });
    }
  }

  private maybeDropPowerUp(b: Brick): void {
    if (Math.random() < 0.12) {
      const size = 16;
      this.powerups.push({ x: b.x + b.w / 2 - size / 2, y: b.y + b.h / 2, w: size, h: size, vy: 120, type: 'widen' });
    }
  }

  private addShake(time: number, magnitude: number): void {
    this.shakeTime = Math.max(this.shakeTime, time);
    this.shakeMag = Math.max(this.shakeMag, magnitude);
  }
}
