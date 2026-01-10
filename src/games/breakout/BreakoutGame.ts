import { BaseGame } from '@/games/shared/BaseGame';
import { GameManifest } from '@/lib/types';
import { ParticleSystem } from './systems/ParticleSystem';
import { ScreenShake } from './systems/ScreenShake';

interface Vec2 { x: number; y: number }
interface Brick { x: number; y: number; w: number; h: number; hp: number; alive: boolean; color: string }
type PowerType = 'widen' | 'multi' | 'slow' | 'life';
interface PowerUp { x: number; y: number; w: number; h: number; vy: number; type: PowerType }
interface Ball { x: number; y: number; vx: number; vy: number; r: number }

type GameState = 'playing' | 'dying' | 'won';

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

  // Visual systems
  private particleSystem = new ParticleSystem();
  private screenShake = new ScreenShake();

  private paddle = { x: 0, y: 0, w: 100, h: 14, speed: 420 };
  private balls: Ball[] = [];
  private bricks: Brick[] = [];
  private rows = 5;
  private cols = 10;
  private lives = 3;
  private started = false;
  private powerups: PowerUp[] = [];
  private widenTimer = 0;
  private level = 1;
  private speedScale = 1;
  private slowTimer = 0;
  private readyTimer = 0;
  private bannerText: string | null = null;
  private bannerTimer = 0;
  private trails: Array<{ x: number; y: number; alpha: number }> = [];
  private pauseLatch = false;
  private highScore = 0;

  // Game state for death animation
  private gameState: GameState = 'playing';
  private deathTimer = 0;
  private readonly deathDuration = 1.5;
  private lastBallPos: Vec2 | null = null;

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
    this.gameState = 'playing';
    this.deathTimer = 0;
    this.lastBallPos = null;
    this.bricksDestroyedThisGame = 0;
    this.levelsCompletedThisGame = 0;
    this.powerupsCollectedThisGame = 0;
    this.particleSystem.clear();
    this.screenShake.stop();
    this.resetLevel();
    this.showBanner(`Level ${this.level}`);
    this.readyTimer = 1.2;
  }

  private resetLevel(): void {
    this.paddle.w = Math.max(70, Math.min(120, Math.floor(this.canvas.width * 0.12)));
    this.paddle.x = this.canvas.width / 2 - this.paddle.w / 2;
    this.paddle.y = this.canvas.height - 40;
    this.balls = [];
    this.addBallOnPaddle();
    this.buildBricks();
    this.powerups = [];
    this.trails = [];
  }

  protected onUpdate(dt: number): void {
    // Update visual systems
    this.particleSystem.update(dt);
    this.screenShake.update(dt);

    // Handle death animation state
    if (this.gameState === 'dying') {
      this.deathTimer += dt;
      if (this.deathTimer >= this.deathDuration) {
        if (this.lives <= 0) {
          this.endGame();
          return;
        }
        // Reset for next life
        this.gameState = 'playing';
        this.deathTimer = 0;
        this.started = false;
        this.addBallOnPaddle();
        this.readyTimer = 1.2;
      }
      return;
    }

    this.handleInput(dt);

    if (!this.started) {
      if (this.balls.length === 0) this.addBallOnPaddle();
      const b0 = this.balls[0];
      b0.x = this.paddle.x + this.paddle.w / 2;
      b0.y = this.paddle.y - b0.r - 1;
      this.balls = [b0];
      if (this.readyTimer > 0) {
        this.readyTimer -= dt;
        if (this.readyTimer <= 0) {
          this.started = true;
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
          const hit = (ball.x - (this.paddle.x + this.paddle.w / 2)) / (this.paddle.w / 2);
          const speed = Math.min(520, Math.hypot(ball.vx, ball.vy) * 1.03);
          const angle = hit * (Math.PI / 3);
          ball.vx = Math.sin(angle) * speed;
          ball.vy = -Math.cos(angle) * speed;
          ball.y = this.paddle.y - ball.r - 1;
          this.services.audio.playSound('click');
          this.particleSystem.createPaddleHitGlow(ball.x, ball.y);
          this.ensureMinAngle(ball);
        }
      }
    }

    // Brick collisions
    for (const ball of this.balls) {
      for (const b of this.bricks) {
        if (!b.alive) continue;
        if (ball.x + ball.r < b.x || ball.x - ball.r > b.x + b.w || ball.y + ball.r < b.y || ball.y - ball.r > b.y + b.h) continue;

        const overlapX = Math.min(ball.x + ball.r - b.x, b.x + b.w - (ball.x - ball.r));
        const overlapY = Math.min(ball.y + ball.r - b.y, b.y + b.h - (ball.y - ball.r));
        if (overlapX < overlapY) {
          ball.vx *= -1;
          if (ball.x < b.x) ball.x = b.x - ball.r; else ball.x = b.x + b.w + ball.r;
        } else {
          ball.vy *= -1;
          if (ball.y < b.y) ball.y = b.y - ball.r; else ball.y = b.y + b.h + ball.r;
        }

        b.hp -= 1;
        if (b.hp <= 0) {
          b.alive = false;
          this.score += 50;
          this.pickups += 1;
          this.bricksDestroyedThisGame += 1;

          // Visual effects
          this.particleSystem.createBrickBurst(b.x + b.w / 2, b.y + b.h / 2, b.color);
          this.particleSystem.addScorePopup(b.x + b.w / 2, b.y, '+50', b.color);
          this.screenShake.shake(4, 0.1);

          this.maybeDropPowerUp(b);
          this.services.analytics.trackFeatureUsage('breakout_brick_break', { level: this.level });
        } else {
          this.score += 10;
          this.particleSystem.addScorePopup(b.x + b.w / 2, b.y, '+10', '#FFFFFF');
        }
        this.services.audio.playSound('collision');
        break;
      }
    }

    // Ball fell below - trigger death animation
    const previousBallCount = this.balls.length;
    this.balls = this.balls.filter(ball => {
      if (ball.y - ball.r > this.canvas.height) {
        this.lastBallPos = { x: ball.x, y: this.canvas.height };
        return false;
      }
      return true;
    });

    if (this.balls.length === 0 && previousBallCount > 0) {
      this.lives -= 1;
      this.services.audio.playSound('game_over');

      // Create explosion at last ball position
      if (this.lastBallPos) {
        this.particleSystem.createBallLostExplosion(this.lastBallPos.x, this.lastBallPos.y);
        this.screenShake.shake(8, 0.3);
      }

      // Enter death animation state
      this.gameState = 'dying';
      this.deathTimer = 0;
    }

    // Level cleared - victory!
    if (this.bricks.every(b => !b.alive)) {
      this.score += 200;
      this.levelsCompletedThisGame += 1;
      this.level += 1;
      this.rows = Math.min(8, 4 + Math.floor(this.level / 2));
      this.cols = 10;
      this.started = false;

      // Victory effects
      this.particleSystem.createConfetti(this.canvas.width);
      this.particleSystem.addScorePopup(this.canvas.width / 2, this.canvas.height / 2, 'LEVEL UP!', '#10B981');
      this.screenShake.shake(6, 0.2);

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
        const color = p.type === 'widen' ? '#10B981' : p.type === 'multi' ? '#F59E0B' : p.type === 'slow' ? '#8B5CF6' : '#F472B6';
        this.particleSystem.createPowerUpSparkle(p.x + p.w / 2, p.y + p.h / 2, color);

        switch (p.type) {
          case 'widen':
            this.widenTimer = Math.min(8, this.widenTimer + 6);
            this.services.audio.playSound('powerup');
            this.particleSystem.addScorePopup(p.x, p.y, 'WIDEN!', color);
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
            this.particleSystem.addScorePopup(p.x, p.y, 'MULTI!', color);
            break;
          }
          case 'slow':
            this.speedScale = 0.75;
            this.slowTimer = 6.0;
            this.services.audio.playSound('powerup');
            this.particleSystem.addScorePopup(p.x, p.y, 'SLOW!', color);
            break;
          case 'life':
            this.lives += 1;
            this.services.audio.playSound('success');
            this.particleSystem.addScorePopup(p.x, p.y, '+1 LIFE!', color);
            break;
        }
        p.y = this.canvas.height + 100;
      }
    }
    this.powerups = this.powerups.filter(p => p.y < this.canvas.height + 40);

    // Widen effect decay
    if (this.widenTimer > 0) {
      this.widenTimer -= dt;
      const base = Math.max(70, Math.min(120, Math.floor(this.canvas.width * 0.12)));
      const widened = base * 1.35;
      const target = this.widenTimer > 0 ? widened : base;
      this.paddle.w += (target - this.paddle.w) * Math.min(1, dt * 10);
      this.paddle.x = Math.max(0, Math.min(this.canvas.width - this.paddle.w, this.paddle.x));
    }

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
    this.trails = this.trails.filter(t => t.alpha > 0);
    if (this.trails.length > 150) this.trails.splice(0, this.trails.length - 150);

    // Track best score
    if (this.score > this.highScore) { this.highScore = this.score; }
  }

  private handleInput(dt: number): void {
    if (this.gameState === 'dying') return;

    const move = this.paddle.speed * dt;
    if (this.services.input.isLeftPressed()) this.paddle.x -= move;
    if (this.services.input.isRightPressed()) this.paddle.x += move;

    const pausePressed = this.services.input.isKeyPressed?.('Escape') || this.services.input.isKeyPressed?.('KeyP');
    if (pausePressed && !this.pauseLatch) {
      this.pauseLatch = true;
      if (this.isPaused) this.resume(); else this.pause();
    } else if (!pausePressed) {
      this.pauseLatch = false;
    }

    const touches = this.services.input.getTouches?.() || [];
    if (touches.length > 0) {
      const target = touches[0].x - this.paddle.w / 2;
      const lerp = 1 - Math.pow(0.001, dt);
      this.paddle.x = this.paddle.x + (target - this.paddle.x) * lerp;
      if (!this.started) this.started = true;
    }

    this.paddle.x = Math.max(0, Math.min(this.canvas.width - this.paddle.w, this.paddle.x));

    if (!this.started && this.services.input.isActionPressed()) {
      this.started = true;
      this.services.audio.playSound('click');
    }
  }

  protected onRender(ctx: CanvasRenderingContext2D): void {
    const shake = this.screenShake.getOffset();

    ctx.save();
    ctx.translate(shake.x, shake.y);

    // Gradient background
    const gradient = ctx.createLinearGradient(0, 0, 0, this.canvas.height);
    gradient.addColorStop(0, '#0a0f1a');
    gradient.addColorStop(0.5, '#0d1526');
    gradient.addColorStop(1, '#0b1020');
    ctx.fillStyle = gradient;
    ctx.fillRect(-10, -10, this.canvas.width + 20, this.canvas.height + 20);

    // Subtle vignette
    const vignette = ctx.createRadialGradient(
      this.canvas.width / 2, this.canvas.height / 2, 0,
      this.canvas.width / 2, this.canvas.height / 2, this.canvas.width * 0.7
    );
    vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vignette.addColorStop(1, 'rgba(0, 0, 0, 0.4)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    this.renderScene(ctx);

    // Render particles on top
    this.particleSystem.render(ctx);

    ctx.restore();
  }

  private renderScene(ctx: CanvasRenderingContext2D): void {
    // Trails with glow
    ctx.save();
    for (const t of this.trails) {
      ctx.globalAlpha = t.alpha * 0.5;
      ctx.shadowColor = '#FBBF24';
      ctx.shadowBlur = 8;
      ctx.fillStyle = '#FBBF24';
      ctx.beginPath();
      ctx.arc(t.x, t.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Bricks with subtle glow for high HP
    for (const b of this.bricks) {
      if (!b.alive) continue;
      ctx.save();
      if (b.hp >= 3) {
        ctx.shadowColor = b.color;
        ctx.shadowBlur = 6;
      }
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, b.w, b.h);

      // Brick highlight (3D effect)
      ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.fillRect(b.x, b.y, b.w, 2);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.fillRect(b.x, b.y + b.h - 2, b.w, 2);
      ctx.restore();
    }

    // Power-ups with glow
    for (const p of this.powerups) {
      const color = p.type === 'widen' ? '#10B981' : p.type === 'multi' ? '#F59E0B' : p.type === 'slow' ? '#8B5CF6' : '#F472B6';
      ctx.save();
      ctx.shadowColor = color;
      ctx.shadowBlur = 12;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(p.x + p.w / 2, p.y + p.h / 2, p.w / 2, 0, Math.PI * 2);
      ctx.fill();

      // Icon inside
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 10px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const icon = p.type === 'widen' ? 'W' : p.type === 'multi' ? 'M' : p.type === 'slow' ? 'S' : '♥';
      ctx.fillText(icon, p.x + p.w / 2, p.y + p.h / 2);
      ctx.restore();
    }

    // Paddle with glow
    ctx.save();
    ctx.shadowColor = '#22D3EE';
    ctx.shadowBlur = this.widenTimer > 0 ? 16 : 8;
    ctx.fillStyle = this.widenTimer > 0 ? '#34D399' : '#22D3EE';
    ctx.beginPath();
    ctx.roundRect(this.paddle.x, this.paddle.y, this.paddle.w, this.paddle.h, 4);
    ctx.fill();
    ctx.restore();

    // Balls with glow
    ctx.save();
    ctx.shadowColor = '#FBBF24';
    ctx.shadowBlur = 10;
    ctx.fillStyle = '#FBBF24';
    for (const ball of this.balls) {
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  protected onRenderUI(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'left';

    let y = this.getHudStartY();
    ctx.fillText(`Lives: ${this.lives}`, 16, y); y += 20;
    if (this.widenTimer > 0) { ctx.fillText(`Widen: ${this.widenTimer.toFixed(1)}s`, 16, y); y += 20; }
    ctx.fillText(`Level: ${this.level}`, 16, y); y += 20;
    ctx.fillText(`Balls: ${this.balls.length}`, 16, y); y += 20;
    ctx.fillText(`Best: ${this.highScore}`, 16, y);

    // Death state message
    if (this.gameState === 'dying') {
      ctx.save();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      ctx.fillStyle = this.lives > 0 ? '#F59E0B' : '#EF4444';
      ctx.font = 'bold 28px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(this.lives > 0 ? 'Ball Lost!' : 'Game Over!', this.canvas.width / 2, this.canvas.height / 2);
      if (this.lives > 0) {
        ctx.font = '18px Arial';
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(`${this.lives} ${this.lives === 1 ? 'life' : 'lives'} remaining`, this.canvas.width / 2, this.canvas.height / 2 + 30);
      }
      ctx.restore();
    }

    if (!this.started && this.gameState === 'playing') {
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
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      const w = this.canvas.width * 0.6;
      const h = 50;
      ctx.beginPath();
      ctx.roundRect((this.canvas.width - w) / 2, 80, w, h, 8);
      ctx.fill();
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
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.font = 'bold 28px Arial';
      ctx.fillText('Paused', this.canvas.width / 2, this.canvas.height / 2);
      ctx.font = '16px Arial';
      ctx.fillText('Press ESC or P to resume', this.canvas.width / 2, this.canvas.height / 2 + 30);
      ctx.restore();
    }
  }

  private maybeDropPowerUp(b: Brick): void {
    const p = Math.random();
    if (p < 0.15) {
      const size = 18;
      const roll = Math.random();
      const type: PowerType = roll < 0.4 ? 'widen' : roll < 0.7 ? 'multi' : roll < 0.9 ? 'slow' : 'life';
      this.powerups.push({ x: b.x + b.w / 2 - size / 2, y: b.y + b.h / 2, w: size, h: size, vy: 120, type });
    }
  }

  private addBallOnPaddle(): void {
    const r = 6;
    this.balls.push({ x: this.paddle.x + this.paddle.w / 2, y: this.paddle.y - r - 1, vx: 180, vy: -220, r });
  }

  private buildBricks(): void {
    this.bricks = [];
    const margin = 20;
    const top = 60;
    const w = (this.canvas.width - margin * 2) / this.cols - 6;
    const h = 18;
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        let skip = false;
        const pattern = ((this.level - 1) % 3) + 1;
        if (pattern === 2) skip = ((r + c) % 2 === 1);
        if (pattern === 3) skip = (r % 2 === 1 && c % 3 === 0);
        if (skip) continue;
        const x = margin + c * (w + 6);
        const y = top + r * (h + 6);
        let hp = r < 2 ? 1 : r < 4 ? 2 : 3;
        hp += Math.floor((this.level - 1) / 3);
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
    const minVy = 120;
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
    this.bannerText = text;
    this.bannerTimer = 2.0;
  }
}
