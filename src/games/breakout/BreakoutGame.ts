import { BaseGame } from '@/games/shared/BaseGame';
import { GameManifest } from '@/lib/types';

interface Vec2 { x: number; y: number }
interface Brick { x: number; y: number; w: number; h: number; hp: number; alive: boolean; color: string }
interface Particle { x: number; y: number; vx: number; vy: number; life: number; color: string; size: number }
type PowerType = 'widen' | 'multi' | 'slow' | 'life';
interface PowerUp { x: number; y: number; w: number; h: number; vy: number; type: PowerType }
interface Ball { x: number; y: number; vx: number; vy: number; r: number }

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
  private balls: Ball[] = [];
  private bricks: Brick[] = [];
  private rows = 5;
  private cols = 10;
  private lives = 3;
  private started = false;
  private particles: Particle[] = [];
  private powerups: PowerUp[] = [];
  private widenTimer = 0; // active widen seconds
  private shakeTime = 0; private shakeMag = 0;
  private level = 1;
  private speedScale = 1;
  private slowTimer = 0;
  private readyTimer = 0; // countdown before auto launch
  private bannerText: string | null = null;
  private bannerTimer = 0;
  private trails: Array<{ x: number; y: number; alpha: number }> = [];
  private pauseLatch = false;
  private highScore = 0;
  
  // Achievement tracking
  private bricksDestroyedThisGame = 0;
  private levelsCompletedThisGame = 0;
  private powerupsCollectedThisGame = 0;

  protected onInit(): void {
    // Load high score
    try {
      const s = localStorage.getItem('breakout_high_score');
      this.highScore = s ? parseInt(s, 10) || 0 : 0;
    } catch {}
    this.resetLevel();
    this.showBanner(`Level ${this.level}`);
    this.readyTimer = 1.2;
  }

  protected onRestart(): void {
    this.score = 0;
    this.pickups = 0;
    this.lives = 3;
    this.started = false;
    this.level = 1;
    this.rows = 5;
    this.cols = 10;
    this.speedScale = 1;
    this.slowTimer = 0;
    this.bricksDestroyedThisGame = 0;
    this.levelsCompletedThisGame = 0;
    this.powerupsCollectedThisGame = 0;
    this.resetLevel();
    this.showBanner(`Level ${this.level}`);
    this.readyTimer = 1.2;
  }

  private resetLevel(): void {
    // Paddle in bottom center
    this.paddle.w = Math.max(70, Math.min(120, Math.floor(this.canvas.width * 0.12)));
    this.paddle.x = this.canvas.width / 2 - this.paddle.w / 2;
    this.paddle.y = this.canvas.height - 40;
    // Balls reset
    this.balls = [];
    this.addBallOnPaddle();
    // Build bricks
    this.buildBricks();
    this.particles = [];
    this.powerups = [];
  }

  

  protected onUpdate(dt: number): void {
    this.handleInput(dt);

    if (!this.started) {
      // Keep first ball on paddle until first action
      if (this.balls.length === 0) this.addBallOnPaddle();
      const b0 = this.balls[0];
      b0.x = this.paddle.x + this.paddle.w / 2;
      b0.y = this.paddle.y - b0.r - 1;
      // Keep any extra balls removed until start
      this.balls = [b0];
      // Auto start after countdown
      if (this.readyTimer > 0) {
        this.readyTimer -= dt;
        if (this.readyTimer <= 0) {
          this.started = true;
          // Give a slight random initial angle
          const angle = (Math.random() * 0.4 - 0.2);
          const speed = Math.hypot(this.balls[0].vx, this.balls[0].vy);
          this.balls[0].vx = Math.sin(angle) * speed;
          this.balls[0].vy = -Math.cos(angle) * speed;
        }
      }
      return;
    }

    // Move balls
    for (const ball of this.balls) {
      ball.x += ball.vx * dt * this.speedScale;
      ball.y += ball.vy * dt * this.speedScale;
    }

    // Wall collisions
    for (const ball of this.balls) {
      if (ball.x < ball.r) { ball.x = ball.r; ball.vx *= -1; this.services.audio.playSound('collision'); }
      if (ball.x > this.canvas.width - ball.r) { ball.x = this.canvas.width - ball.r; ball.vx *= -1; this.services.audio.playSound('collision'); }
      if (ball.y < ball.r) { ball.y = ball.r; ball.vy *= -1; this.services.audio.playSound('collision'); this.ensureMinAngle(ball); }
    }

    // Paddle collision
    for (const ball of this.balls) {
      if (ball.y + ball.r >= this.paddle.y && ball.y - ball.r <= this.paddle.y + this.paddle.h) {
        if (ball.x > this.paddle.x && ball.x < this.paddle.x + this.paddle.w && ball.vy > 0) {
          // Reflect with angle based on hit position
          const hit = (ball.x - (this.paddle.x + this.paddle.w / 2)) / (this.paddle.w / 2);
          const speed = Math.min(520, Math.hypot(ball.vx, ball.vy) * 1.03);
          const angle = hit * (Math.PI / 3); // +/-60 degrees
          ball.vx = Math.sin(angle) * speed;
          ball.vy = -Math.cos(angle) * speed;
          ball.y = this.paddle.y - ball.r - 1;
          this.services.audio.playSound('click');
          this.ensureMinAngle(ball);
        }
      }
    }

    // Brick collisions (simple AABB)
    for (const ball of this.balls) {
      for (const b of this.bricks) {
        if (!b.alive) continue;
        if (ball.x + ball.r < b.x || ball.x - ball.r > b.x + b.w || ball.y + ball.r < b.y || ball.y - ball.r > b.y + b.h) continue;
        // Hit: decide bounce axis by penetration and separate ball out
        const overlapX = Math.min(ball.x + ball.r - b.x, b.x + b.w - (ball.x - ball.r));
        const overlapY = Math.min(ball.y + ball.r - b.y, b.y + b.h - (ball.y - ball.r));
        if (overlapX < overlapY) {
          ball.vx *= -1;
          // push out on X
          if (ball.x < b.x) ball.x = b.x - ball.r; else ball.x = b.x + b.w + ball.r;
        } else {
          ball.vy *= -1;
          if (ball.y < b.y) ball.y = b.y - ball.r; else ball.y = b.y + b.h + ball.r;
        }
        // Damage brick
        b.hp -= 1;
        if (b.hp <= 0) {
          b.alive = false; this.score += 50; this.pickups += 1;
          this.bricksDestroyedThisGame += 1;
          this.spawnParticles(b, 12);
          this.maybeDropPowerUp(b);
          this.addShake(0.08, 3);
          this.services.analytics.trackFeatureUsage('breakout_brick_break', { level: this.level });
        } else { this.score += 10; this.spawnParticles(b, 6); }
        this.services.audio.playSound('collision');
        break;
      }
    }

    // Ball fell below
    this.balls = this.balls.filter(ball => ball.y - ball.r <= this.canvas.height);
    if (this.balls.length === 0) {
      this.lives -= 1;
      if (this.lives <= 0) { this.endGame(); return; }
      this.started = false;
      this.services.audio.playSound('game_over');
      this.addBallOnPaddle();
      this.readyTimer = 1.2;
    }

    // Level cleared
    if (this.bricks.every(b => !b.alive)) {
      this.score += 200;
      this.levelsCompletedThisGame += 1;
      this.level += 1;
      this.rows = Math.min(8, 4 + Math.floor(this.level / 2));
      this.cols = 10;
      this.started = false;
      this.buildBricks();
      this.services.audio.playSound('success');
      this.services.analytics.trackFeatureUsage('breakout_level_clear', { level: this.level - 1, score: this.score });
      this.showBanner(`Level ${this.level}`);
      this.readyTimer = 1.2;
    }

    // Update power-ups
    for (const p of this.powerups) p.y += p.vy * dt;
    // Paddle catches power-ups
    for (const p of this.powerups) {
      if (p.y + p.h >= this.paddle.y && p.y <= this.paddle.y + this.paddle.h && p.x + p.w >= this.paddle.x && p.x <= this.paddle.x + this.paddle.w) {
        this.powerupsCollectedThisGame += 1;
        switch (p.type) {
          case 'widen':
            this.widenTimer = Math.min(8, this.widenTimer + 6); // stack
            this.services.audio.playSound('powerup');
            break;
          case 'multi': {
            const cap = 6;
            const toAdd = Math.min(2, cap - this.balls.length);
            for (let i = 0; i < toAdd; i++) {
              const angle = (i === 0 ? -Math.PI / 6 : Math.PI / 6);
              const speed = 260;
              this.balls.push({
                x: this.paddle.x + this.paddle.w / 2,
                y: this.paddle.y - 8,
                vx: Math.sin(angle) * speed,
                vy: -Math.cos(angle) * speed,
                r: 6,
              });
            }
            this.services.audio.playSound('powerup');
            break;
          }
          case 'slow':
            this.speedScale = 0.75;
            this.slowTimer = 6.0;
            this.services.audio.playSound('powerup');
            break;
          case 'life':
            this.lives += 1;
            this.services.audio.playSound('success');
            break;
        }
        p.y = this.canvas.height + 100; // collect
      }
    }
    this.powerups = this.powerups.filter(p => p.y < this.canvas.height + 40);

    // Apply widen effect & slow effect decay (if any)
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

    // Slow effect decay
    if (this.slowTimer > 0) {
      this.slowTimer -= dt;
      if (this.slowTimer <= 0) this.speedScale = 1;
    }

    // Trails update
    for (const ball of this.balls) {
      this.trails.push({ x: ball.x, y: ball.y, alpha: 0.6 });
    }
    for (const t of this.trails) t.alpha = Math.max(0, t.alpha - dt * 2.2);
    if (this.trails.length > 200) this.trails.splice(0, this.trails.length - 200);

    // Track best in memory; persist on game end only
    if (this.score > this.highScore) { this.highScore = this.score; }
  }

  private handleInput(dt: number): void {
    const move = this.paddle.speed * dt;
    if (this.services.input.isLeftPressed()) this.paddle.x -= move;
    if (this.services.input.isRightPressed()) this.paddle.x += move;

    // Pause toggle on Escape/P (edge-triggered)
    const pausePressed = this.services.input.isKeyPressed?.('Escape') || this.services.input.isKeyPressed?.('KeyP');
    if (pausePressed && !this.pauseLatch) {
      this.pauseLatch = true;
      if (this.isPaused) this.resume(); else this.pause();
    } else if (!pausePressed) {
      this.pauseLatch = false;
    }

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
    // Trails
    for (const t of this.trails) {
      ctx.globalAlpha = t.alpha * 0.6;
      ctx.fillStyle = '#FBBF24';
      ctx.beginPath();
      ctx.arc(t.x, t.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // Bricks
    for (const b of this.bricks) {
      if (!b.alive) continue;
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, b.w, b.h);
    }

    // Power-ups
    for (const p of this.powerups) {
      const color = p.type === 'widen' ? '#10B981' : p.type === 'multi' ? '#F59E0B' : p.type === 'slow' ? '#8B5CF6' : '#F472B6';
      ctx.fillStyle = color;
      ctx.fillRect(p.x, p.y, p.w, p.h);
    }

    // Paddle
    ctx.fillStyle = '#22D3EE';
    ctx.fillRect(this.paddle.x, this.paddle.y, this.paddle.w, this.paddle.h);

    // Balls
    ctx.fillStyle = '#FBBF24';
    for (const ball of this.balls) {
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
      ctx.fill();
    }

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
    // BaseGame renders Score and Coins; render additional HUD info below
    let y = this.getHudStartY();
    ctx.fillText(`Lives: ${this.lives}`, 16, y); y += 20;
    if (this.widenTimer > 0) { ctx.fillText(`Widen: ${this.widenTimer.toFixed(1)}s`, 16, y); y += 20; }
    ctx.fillText(`Level: ${this.level}`, 16, y); y += 20;
    ctx.fillText(`Balls: ${this.balls.length}`, 16, y); y += 20;
    ctx.fillText(`Best: ${this.highScore}`, 16, y); y += 20;
    if (!this.started) {
      ctx.textAlign = 'center';
      if (this.readyTimer > 0) {
        ctx.fillText(`Get Ready: ${Math.ceil(this.readyTimer)}`, this.canvas.width / 2, this.canvas.height / 2);
      } else {
        ctx.fillText('Press Space/Touch to Launch', this.canvas.width / 2, this.canvas.height / 2 + 40);
      }
    }

    // Banner
    if (this.bannerText && this.bannerTimer > 0) {
      const alpha = Math.min(1, this.bannerTimer);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      const w = this.canvas.width * 0.6;
      const h = 50;
      ctx.fillRect((this.canvas.width - w) / 2, 80, w, h);
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.font = 'bold 22px Arial';
      ctx.fillText(this.bannerText, this.canvas.width / 2, 112);
      ctx.restore();
      this.bannerTimer -= 1 / 60;
      if (this.bannerTimer <= 0) this.bannerText = null;
    }

    // Paused overlay
    if (this.isPaused) {
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.font = 'bold 24px Arial';
      ctx.fillText('Paused', this.canvas.width / 2, this.canvas.height / 2);
      ctx.restore();
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
    const p = Math.random();
    if (p < 0.15) {
      const size = 16;
      const roll = Math.random();
      const type: PowerType = roll < 0.4 ? 'widen' : roll < 0.7 ? 'multi' : roll < 0.9 ? 'slow' : 'life';
      this.powerups.push({ x: b.x + b.w / 2 - size / 2, y: b.y + b.h / 2, w: size, h: size, vy: 120, type });
    }
  }

  private addShake(time: number, magnitude: number): void {
    this.shakeTime = Math.max(this.shakeTime, time);
    this.shakeMag = Math.max(this.shakeMag, magnitude);
  }

  private addBallOnPaddle(): void {
    const r = 6;
    this.balls.push({ x: this.paddle.x + this.paddle.w / 2, y: this.paddle.y - r - 1, vx: 180, vy: -220, r });
  }

  private buildBricks(): void {
    // Level-based simple patterns: 1=grid, 2=checkerboard, 3=staggered, then repeat with more HP
    this.bricks = [];
    const margin = 20;
    const top = 60;
    const w = (this.canvas.width - margin * 2) / this.cols - 6;
    const h = 18;
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        let skip = false;
        const pattern = ((this.level - 1) % 3) + 1;
        if (pattern === 2) skip = ((r + c) % 2 === 1); // checkerboard gaps
        if (pattern === 3) skip = (r % 2 === 1 && c % 3 === 0); // staggered gaps
        if (skip) continue;
        const x = margin + c * (w + 6);
        const y = top + r * (h + 6);
        let hp = r < 2 ? 1 : r < 4 ? 2 : 3;
        hp += Math.floor((this.level - 1) / 3); // scale every 3 levels
        hp = Math.min(hp, 4);
        const color = hp <= 1 ? '#60A5FA' : hp === 2 ? '#F59E0B' : hp === 3 ? '#EF4444' : '#9CA3AF';
        this.bricks.push({ x, y, w, h, hp, alive: true, color });
      }
    }
  }

  protected onGameEnd(finalScore: import('@/lib/types').GameScore): void {
    try {
      const prev = parseInt(localStorage.getItem('breakout_high_score') || '0', 10) || 0;
      if (finalScore.score > prev) localStorage.setItem('breakout_high_score', String(finalScore.score));
    } catch {}

    this.extendedGameData = {
      bricks_broken: this.bricksDestroyedThisGame,
      levels_cleared: this.levelsCompletedThisGame,
      powerups_collected: this.powerupsCollectedThisGame,
      total_bricks_broken: this.bricksDestroyedThisGame,
      max_level: this.level,
      final_lives: this.lives
    };

    this.services?.analytics?.trackGameSpecificStat?.('breakout', 'bricks_broken', this.bricksDestroyedThisGame);
    this.services?.analytics?.trackGameSpecificStat?.('breakout', 'levels_cleared', this.levelsCompletedThisGame);
    this.services?.analytics?.trackGameSpecificStat?.('breakout', 'powerups_collected', this.powerupsCollectedThisGame);
    this.services?.analytics?.trackGameSpecificStat?.('breakout', 'total_bricks_broken', this.bricksDestroyedThisGame);
    this.services?.analytics?.trackGameSpecificStat?.('breakout', 'max_level', this.level);

    super.onGameEnd?.(finalScore);
  }

  private ensureMinAngle(ball: Ball): void {
    const minVy = 120; // pixels/sec
    const speed = Math.max(60, Math.hypot(ball.vx, ball.vy));
    if (Math.abs(ball.vy) < minVy) {
      const sign = ball.vy >= 0 ? 1 : -1;
      const vy = sign * minVy;
      const vxSign = ball.vx >= 0 ? 1 : -1;
      const vx = Math.sqrt(Math.max(0, speed * speed - vy * vy)) * vxSign;
      ball.vx = vx; ball.vy = vy;
    }
  }

  private showBanner(text: string): void {
    this.bannerText = text; this.bannerTimer = 2.0;
  }
}
