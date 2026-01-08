// ===== src/games/snake/SnakeGame.ts =====
import { BaseGame } from '@/games/shared/BaseGame';
import { GameManifest } from '@/lib/types';
import { Vector2 } from '@/games/shared/utils/Vector2';
import { ParticleSystem } from './systems/ParticleSystem';
import { ScreenShake } from './systems/ScreenShake';
import { ComboSystem } from './systems/ComboSystem';
import { Food } from './entities/Food';
import { Coin } from './entities/Coin';
import { PowerUp, SnakePowerUpType, POWERUP_CONFIGS } from './entities/PowerUp';

// ============================================
// TYPES & INTERFACES
// ============================================

type GameState = 'playing' | 'dying' | 'gameOver';

interface SnakeSegment {
  x: number;
  y: number;
}

interface ActivePowerUp {
  type: SnakePowerUpType;
  duration: number;
  maxDuration: number;
}

// ============================================
// CONSTANTS
// ============================================

const COLORS = {
  // Background
  bgGradientTop: '#083344',
  bgGradientBottom: '#065f46',
  gridLine: 'rgba(255, 255, 255, 0.05)',
  gridLineBright: 'rgba(255, 255, 255, 0.1)',

  // Snake
  snakeHead: '#4ade80',
  snakeBody: '#10b981',
  snakeTail: '#059669',
  snakeEye: '#ffffff',
  snakePupil: '#1f2937',

  // UI
  textPrimary: '#ffffff',
  textSecondary: '#94a3b8',
  comboText: '#fbbf24',
  heartFull: '#ef4444',
  heartEmpty: '#4b5563',
};

// ============================================
// SNAKE GAME CLASS
// ============================================

export class SnakeGame extends BaseGame {
  manifest: GameManifest = {
    id: 'snake',
    title: 'Snake',
    thumbnail: '/games/snake/snake-thumb.svg',
    inputSchema: ['keyboard', 'touch'],
    assetBudgetKB: 80,
    tier: 0,
    description: 'Classic snake action with modern flair. Eat food, collect coins, grow longer!',
  };

  // Grid configuration (larger for more action)
  private gridSize = 24;
  private gridWidth = 32;
  private gridHeight = 24;

  private get offsetX(): number {
    return (this.canvas.width - this.gridWidth * this.gridSize) / 2;
  }

  private get offsetY(): number {
    return (this.canvas.height - this.gridHeight * this.gridSize) / 2;
  }

  // Game state
  private gameState: GameState = 'playing';
  private deathTimer: number = 0;
  private readonly deathDuration: number = 1.5;

  // Snake
  private snake: SnakeSegment[] = [];
  private direction: Vector2 = new Vector2(1, 0);
  private nextDirection: Vector2 = new Vector2(1, 0);
  private pendingGrowth: number = 0;
  private rainbowTimer: number = 0;
  private readonly rainbowDuration: number = 1.25;

  // Movement
  private moveTimer: number = 0;
  private baseSpeed: number = 7;

  // Touch input
  private lastTouch: { x: number; y: number } | null = null;
  private readonly touchThreshold: number = 20;

  // Entities
  private food!: Food;
  private coins: Coin[] = [];
  private powerUps: PowerUp[] = [];

  // Timers
  private coinTimer: number = 0;
  private readonly coinInterval: number = 4;
  private powerUpTimer: number = 0;
  private readonly powerUpInterval: number = 10;

  // Active power-ups
  private activePowerUps: ActivePowerUp[] = [];

  // Systems
  private particles!: ParticleSystem;
  private screenShake!: ScreenShake;
  private comboSystem!: ComboSystem;

  // Lives system
  private lives: number = 3;
  private maxLives: number = 3;
  private isInvulnerable: boolean = false;
  private invulnerabilityTimer: number = 0;
  private readonly invulnerabilityDuration: number = 2;

  // Stats
  private foodEaten: number = 0;
  private maxLength: number = 0;
  private highScore: number = 0;
  private powerupsUsed: number = 0;
  private powerupTypesUsed: Set<SnakePowerUpType> = new Set();

  // Visual effects
  private gridPulsePhase: number = 0;
  private cameraOffset: { x: number; y: number } = { x: 0, y: 0 };

  // ==========================================
  // LIFECYCLE METHODS
  // ==========================================

  protected onInit(): void {
    this.renderBaseHud = false; // Custom HUD

    // Initialize systems
    this.particles = new ParticleSystem();
    this.screenShake = new ScreenShake();
    this.comboSystem = new ComboSystem();

    // Load high score
    try {
      const saved = localStorage.getItem('snake_best');
      this.highScore = saved ? parseInt(saved, 10) || 0 : 0;
    } catch {
      this.highScore = 0;
    }

    this.reset();
  }

  protected onUpdate(dt: number): void {
    // Update visual effects
    this.gridPulsePhase += dt;
    this.screenShake.update(dt);
    this.cameraOffset = this.screenShake.getOffset();
    this.particles.update(dt);
    this.comboSystem.update(dt);

    // Update entities
    this.food.update(dt);
    for (const coin of this.coins) {
      coin.update(dt);
    }
    for (const powerUp of this.powerUps) {
      powerUp.update(dt);
    }

    // Decay active power-ups
    this.activePowerUps = this.activePowerUps.filter(p => {
      p.duration -= dt;
      return p.duration > 0;
    });

    // Handle game states
    switch (this.gameState) {
      case 'playing':
        this.updatePlaying(dt);
        break;
      case 'dying':
        this.updateDying(dt);
        break;
      case 'gameOver':
        // Wait for platform to handle
        break;
    }

    // Decay rainbow effect
    if (this.rainbowTimer > 0) {
      this.rainbowTimer = Math.max(0, this.rainbowTimer - dt);
    }

    // Decay invulnerability
    if (this.isInvulnerable) {
      this.invulnerabilityTimer -= dt;
      if (this.invulnerabilityTimer <= 0) {
        this.isInvulnerable = false;
      }
    }
  }

  private updatePlaying(dt: number): void {
    this.handleInput();

    // Calculate effective speed
    let effectiveSpeed = this.baseSpeed;
    if (this.hasPowerUp('slow')) {
      effectiveSpeed *= 0.6;
    }

    this.moveTimer += dt;
    if (this.moveTimer >= 1 / effectiveSpeed) {
      this.moveTimer = 0;
      this.step();
    }

    // Spawn timers
    this.coinTimer += dt;
    if (this.coinTimer >= this.coinInterval && this.coins.length < 2) {
      this.coinTimer = 0;
      this.spawnCoin();
    }

    this.powerUpTimer += dt;
    if (this.powerUpTimer >= this.powerUpInterval && this.powerUps.length < 1) {
      this.powerUpTimer = 0;
      this.spawnPowerUp();
    }

    // Clean up expired entities
    this.coins = this.coins.filter(c => !c.isExpired());
    this.powerUps = this.powerUps.filter(p => !p.isExpired());

    // Update score from survival
    this.score += Math.floor(dt * 2);
  }

  private updateDying(dt: number): void {
    this.deathTimer += dt;
    if (this.deathTimer >= this.deathDuration) {
      this.gameState = 'gameOver';
      this.endGame();
    }
  }

  protected onRender(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.translate(this.cameraOffset.x, this.cameraOffset.y);

    this.renderBackground(ctx);
    this.renderGrid(ctx);
    this.renderEntities(ctx);
    this.renderSnake(ctx);
    this.particles.render(ctx);

    ctx.restore();
  }

  protected onRenderUI(ctx: CanvasRenderingContext2D): void {
    this.renderHUD(ctx);
  }

  protected onRestart(): void {
    this.reset();
  }

  protected onGameEnd(): void {
    // Save high score
    try {
      if (this.score > this.highScore) {
        this.highScore = this.score;
        localStorage.setItem('snake_best', String(this.highScore));
      }
    } catch { /* ignore */ }

    // Extended data for achievements
    this.extendedGameData = {
      snake_length: this.snake.length,
      final_speed: this.baseSpeed,
      food_eaten: this.foodEaten,
      max_length: this.maxLength,
      powerupsUsed: this.powerupsUsed,
      powerupTypesUsed: [...this.powerupTypesUsed],
      maxCombo: this.comboSystem.getMaxCombo(),
      livesRemaining: this.lives,
    };

    this.services?.analytics?.trackGameSpecificStat?.('snake', 'snake_length', this.snake.length);
    this.services?.analytics?.trackGameSpecificStat?.('snake', 'max_combo', this.comboSystem.getMaxCombo());
    this.services?.analytics?.trackGameSpecificStat?.('snake', 'food_eaten', this.foodEaten);
  }

  // ==========================================
  // GAME LOGIC
  // ==========================================

  private reset(): void {
    const centerX = Math.floor(this.gridWidth / 2);
    const centerY = Math.floor(this.gridHeight / 2);

    // Snake starts with 3 segments
    this.snake = [
      { x: centerX, y: centerY },
      { x: centerX - 1, y: centerY },
      { x: centerX - 2, y: centerY },
    ];

    this.direction = new Vector2(1, 0);
    this.nextDirection = new Vector2(1, 0);
    this.pendingGrowth = 0;

    // Initialize food
    this.food = new Food(0, 0, this.gridSize);
    this.spawnFood();

    // Clear entities
    this.coins = [];
    this.powerUps = [];
    this.activePowerUps = [];

    // Reset timers
    this.coinTimer = 0;
    this.powerUpTimer = 0;
    this.moveTimer = 0;
    this.rainbowTimer = 0;
    this.deathTimer = 0;

    // Reset state
    this.gameState = 'playing';
    this.baseSpeed = 7;
    this.lives = this.maxLives;
    this.isInvulnerable = false;
    this.invulnerabilityTimer = 0;

    // Reset stats
    this.score = 0;
    this.pickups = 0;
    this.foodEaten = 0;
    this.maxLength = this.snake.length;
    this.powerupsUsed = 0;
    this.powerupTypesUsed.clear();

    // Reset systems
    this.particles.clear();
    this.screenShake.stop();
    this.comboSystem.reset();
  }

  private step(): void {
    const head = this.snake[0];
    const newHead = {
      x: head.x + this.nextDirection.x,
      y: head.y + this.nextDirection.y,
    };

    // Handle wall wrap power-up
    if (this.hasPowerUp('wrap')) {
      if (newHead.x < 0) newHead.x = this.gridWidth - 1;
      if (newHead.x >= this.gridWidth) newHead.x = 0;
      if (newHead.y < 0) newHead.y = this.gridHeight - 1;
      if (newHead.y >= this.gridHeight) newHead.y = 0;
    }

    // Check wall collision
    if (!this.hasPowerUp('wrap') && this.hitWall(newHead)) {
      this.handleCollision();
      return;
    }

    // Check self collision (unless ghost power-up)
    if (!this.hasPowerUp('ghost')) {
      if (this.snake.some(seg => seg.x === newHead.x && seg.y === newHead.y)) {
        this.handleCollision();
        return;
      }
    }

    // Move snake
    this.snake.unshift(newHead);
    this.direction = this.nextDirection;

    // Check food
    if (newHead.x === this.food.x && newHead.y === this.food.y) {
      this.eatFood();
    } else {
      this.consumePendingGrowthOrPop();
    }

    // Check coins
    for (let i = this.coins.length - 1; i >= 0; i--) {
      const coin = this.coins[i];
      if (newHead.x === coin.x && newHead.y === coin.y) {
        this.collectCoin(i);
        break;
      }
    }

    // Check power-ups
    for (let i = this.powerUps.length - 1; i >= 0; i--) {
      const powerUp = this.powerUps[i];
      if (newHead.x === powerUp.x && newHead.y === powerUp.y) {
        this.collectPowerUp(i);
        break;
      }
    }

    // Magnet effect - attract nearby coins
    if (this.hasPowerUp('magnet')) {
      this.applyMagnetEffect();
    }

    // Update max length
    this.maxLength = Math.max(this.maxLength, this.snake.length);

    // Gradual speed increase
    this.baseSpeed += 0.002;
  }

  private handleCollision(): void {
    if (this.isInvulnerable) {
      return;
    }

    this.lives--;
    this.services.audio.playSound('collision');
    this.screenShake.shake(12, 0.4);

    if (this.lives <= 0) {
      // Death - trigger explosion
      this.gameState = 'dying';
      this.deathTimer = 0;

      // Create death explosion
      const segments = this.snake.map(seg => ({
        x: this.offsetX + seg.x * this.gridSize,
        y: this.offsetY + seg.y * this.gridSize,
      }));
      this.particles.createDeathExplosion(segments, this.gridSize);
    } else {
      // Lose one life - make invulnerable
      this.isInvulnerable = true;
      this.invulnerabilityTimer = this.invulnerabilityDuration;
    }
  }

  private eatFood(): void {
    this.foodEaten++;
    const comboResult = this.comboSystem.addHit();
    const baseScore = 10;
    const scoreGain = Math.floor(baseScore * comboResult.multiplier);

    this.score += scoreGain;

    // Growth (double if power-up active)
    if (this.hasPowerUp('double')) {
      this.pendingGrowth += 2;
    } else {
      this.pendingGrowth += 1;
    }

    // Speed increase
    this.baseSpeed += 0.05;

    // Effects
    const foodX = this.offsetX + this.food.x * this.gridSize + this.gridSize / 2;
    const foodY = this.offsetY + this.food.y * this.gridSize + this.gridSize / 2;
    this.particles.createFoodBurst(foodX, foodY, '#e11d48');
    this.particles.addScorePopup(foodX, foodY - 10, `+${scoreGain}`, COLORS.textPrimary);

    if (comboResult.isMilestone) {
      this.particles.createComboFlash(foodX, foodY, comboResult.multiplier);
      this.particles.addScorePopup(foodX, foodY - 30, `COMBO x${comboResult.combo}!`, COLORS.comboText);
    }

    this.screenShake.shake(3, 0.1);
    this.services.audio.playSound('success');

    this.spawnFood();
  }

  private collectCoin(index: number): void {
    const coin = this.coins[index];
    const comboResult = this.comboSystem.addHit();
    const baseScore = 25;
    const scoreGain = Math.floor(baseScore * comboResult.multiplier);

    this.score += scoreGain;
    this.pickups++;
    this.rainbowTimer = this.rainbowDuration;

    // Effects
    const coinX = this.offsetX + coin.x * this.gridSize + this.gridSize / 2;
    const coinY = this.offsetY + coin.y * this.gridSize + this.gridSize / 2;
    this.particles.createCoinSparkle(coinX, coinY);
    this.particles.addScorePopup(coinX, coinY - 10, `+${scoreGain}`, '#FCD34D');

    this.screenShake.shake(2, 0.1);
    this.services.audio.playSound('coin');

    this.coins.splice(index, 1);
  }

  private collectPowerUp(index: number): void {
    const powerUp = this.powerUps[index];
    const config = powerUp.getConfig();

    // Add or extend power-up
    const existing = this.activePowerUps.find(p => p.type === powerUp.type);
    if (existing) {
      existing.duration += config.duration;
      existing.maxDuration += config.duration;
    } else {
      this.activePowerUps.push({
        type: powerUp.type,
        duration: config.duration,
        maxDuration: config.duration,
      });
    }

    this.powerupsUsed++;
    this.powerupTypesUsed.add(powerUp.type);
    this.score += 30;

    // Effects
    const puX = this.offsetX + powerUp.x * this.gridSize + this.gridSize / 2;
    const puY = this.offsetY + powerUp.y * this.gridSize + this.gridSize / 2;
    this.particles.createPowerUpGlow(puX, puY, config.color);
    this.particles.addScorePopup(puX, puY - 10, config.label, config.color);

    this.screenShake.shake(5, 0.2);
    this.services.audio.playSound('powerup');

    this.powerUps.splice(index, 1);
  }

  private applyMagnetEffect(): void {
    const head = this.snake[0];
    const magnetRange = 4; // Grid cells

    // Attract coins
    for (const coin of this.coins) {
      const dx = head.x - coin.x;
      const dy = head.y - coin.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < magnetRange && dist > 0.5) {
        // Move coin toward snake
        if (Math.abs(dx) > Math.abs(dy)) {
          coin.x += Math.sign(dx);
        } else {
          coin.y += Math.sign(dy);
        }
      }
    }
  }

  private hitWall(pos: { x: number; y: number }): boolean {
    return pos.x < 0 || pos.x >= this.gridWidth || pos.y < 0 || pos.y >= this.gridHeight;
  }

  private consumePendingGrowthOrPop(): void {
    if (this.pendingGrowth > 0) {
      this.pendingGrowth--;
    } else {
      this.snake.pop();
    }
  }

  // ==========================================
  // SPAWNING
  // ==========================================

  private spawnFood(): void {
    const pos = this.randomEmptyCell();
    this.food.setPosition(pos.x, pos.y);
  }

  private spawnCoin(): void {
    const pos = this.randomEmptyCell();
    this.coins.push(new Coin(pos.x, pos.y, this.gridSize, 6, 1));
  }

  private spawnPowerUp(): void {
    const pos = this.randomEmptyCell();
    const types: SnakePowerUpType[] = ['wrap', 'slow', 'double', 'magnet', 'ghost'];
    const type = types[Math.floor(Math.random() * types.length)];
    this.powerUps.push(new PowerUp(pos.x, pos.y, this.gridSize, type, 8, 1.2));
  }

  private randomEmptyCell(): { x: number; y: number } {
    let pos: { x: number; y: number };
    let attempts = 0;
    const maxAttempts = 100;

    do {
      pos = {
        x: Math.floor(Math.random() * this.gridWidth),
        y: Math.floor(Math.random() * this.gridHeight),
      };
      attempts++;
    } while (
      attempts < maxAttempts &&
      (this.snake.some(s => s.x === pos.x && s.y === pos.y) ||
        (this.food && pos.x === this.food.x && pos.y === this.food.y) ||
        this.coins.some(c => c.x === pos.x && c.y === pos.y) ||
        this.powerUps.some(p => p.x === pos.x && p.y === pos.y))
    );

    return pos;
  }

  private hasPowerUp(type: SnakePowerUpType): boolean {
    return this.activePowerUps.some(p => p.type === type);
  }

  // ==========================================
  // INPUT HANDLING
  // ==========================================

  private handleInput(): void {
    // Touch input
    const touches = this.services.input.getTouches?.() || [];
    if (touches.length > 0) {
      const t = touches[0];
      if (!this.lastTouch) {
        this.lastTouch = { x: t.x, y: t.y };
      } else {
        const dx = t.x - this.lastTouch.x;
        const dy = t.y - this.lastTouch.y;
        const absDx = Math.abs(dx);
        const absDy = Math.abs(dy);

        if (Math.max(absDx, absDy) >= this.touchThreshold) {
          if (absDx > absDy) {
            if (dx > 0 && this.direction.x !== -1) {
              this.nextDirection = new Vector2(1, 0);
            } else if (dx < 0 && this.direction.x !== 1) {
              this.nextDirection = new Vector2(-1, 0);
            }
          } else {
            if (dy > 0 && this.direction.y !== -1) {
              this.nextDirection = new Vector2(0, 1);
            } else if (dy < 0 && this.direction.y !== 1) {
              this.nextDirection = new Vector2(0, -1);
            }
          }
          this.lastTouch = { x: t.x, y: t.y };
        }
      }
    } else {
      this.lastTouch = null;
    }

    // Keyboard input
    if (this.services.input.isLeftPressed() && this.direction.x !== 1) {
      this.nextDirection = new Vector2(-1, 0);
    } else if (this.services.input.isRightPressed() && this.direction.x !== -1) {
      this.nextDirection = new Vector2(1, 0);
    } else if (this.services.input.isUpPressed() && this.direction.y !== 1) {
      this.nextDirection = new Vector2(0, -1);
    } else if (this.services.input.isDownPressed() && this.direction.y !== -1) {
      this.nextDirection = new Vector2(0, 1);
    }
  }

  // ==========================================
  // RENDERING
  // ==========================================

  private renderBackground(ctx: CanvasRenderingContext2D): void {
    const boardW = this.gridWidth * this.gridSize;
    const boardH = this.gridHeight * this.gridSize;

    // Gradient background
    const gradient = ctx.createLinearGradient(0, this.offsetY, 0, this.offsetY + boardH);
    gradient.addColorStop(0, COLORS.bgGradientTop);
    gradient.addColorStop(1, COLORS.bgGradientBottom);
    ctx.fillStyle = gradient;
    ctx.fillRect(this.offsetX, this.offsetY, boardW, boardH);

    // Vignette effect
    const vignetteGradient = ctx.createRadialGradient(
      this.offsetX + boardW / 2,
      this.offsetY + boardH / 2,
      0,
      this.offsetX + boardW / 2,
      this.offsetY + boardH / 2,
      Math.max(boardW, boardH) * 0.7
    );
    vignetteGradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vignetteGradient.addColorStop(1, 'rgba(0, 0, 0, 0.3)');
    ctx.fillStyle = vignetteGradient;
    ctx.fillRect(this.offsetX, this.offsetY, boardW, boardH);
  }

  private renderGrid(ctx: CanvasRenderingContext2D): void {
    const boardW = this.gridWidth * this.gridSize;
    const boardH = this.gridHeight * this.gridSize;

    // Animated grid pulse
    const pulseAlpha = 0.03 + 0.02 * Math.sin(this.gridPulsePhase * 2);

    ctx.strokeStyle = `rgba(255, 255, 255, ${pulseAlpha})`;
    ctx.lineWidth = 1;

    // Vertical lines
    for (let x = 0; x <= this.gridWidth; x++) {
      const xPos = this.offsetX + x * this.gridSize;
      ctx.beginPath();
      ctx.moveTo(xPos, this.offsetY);
      ctx.lineTo(xPos, this.offsetY + boardH);
      ctx.stroke();
    }

    // Horizontal lines
    for (let y = 0; y <= this.gridHeight; y++) {
      const yPos = this.offsetY + y * this.gridSize;
      ctx.beginPath();
      ctx.moveTo(this.offsetX, yPos);
      ctx.lineTo(this.offsetX + boardW, yPos);
      ctx.stroke();
    }

    // Border
    ctx.strokeStyle = COLORS.gridLineBright;
    ctx.lineWidth = 2;
    ctx.strokeRect(this.offsetX, this.offsetY, boardW, boardH);
  }

  private renderEntities(ctx: CanvasRenderingContext2D): void {
    // Render food
    this.food.render(ctx, this.offsetX, this.offsetY);

    // Render coins
    for (const coin of this.coins) {
      coin.render(ctx, this.offsetX, this.offsetY);
    }

    // Render power-ups
    for (const powerUp of this.powerUps) {
      powerUp.render(ctx, this.offsetX, this.offsetY);
    }
  }

  private renderSnake(ctx: CanvasRenderingContext2D): void {
    if (this.gameState === 'dying') {
      return; // Don't render during death animation
    }

    const time = Date.now() * 0.002;

    // Blinking during invulnerability
    if (this.isInvulnerable && Math.floor(time * 10) % 2 === 0) {
      ctx.globalAlpha = 0.4;
    }

    for (let i = this.snake.length - 1; i >= 0; i--) {
      const seg = this.snake[i];
      const drawX = this.offsetX + seg.x * this.gridSize;
      const drawY = this.offsetY + seg.y * this.gridSize;

      // Calculate color gradient from head to tail
      const progress = i / Math.max(1, this.snake.length - 1);

      if (i === 0) {
        // Head
        this.renderSnakeHead(ctx, drawX, drawY);
      } else if (i === this.snake.length - 1) {
        // Tail
        ctx.fillStyle = COLORS.snakeTail;
        this.renderSegment(ctx, drawX, drawY, 0.8);
      } else {
        // Body - gradient or rainbow
        if (this.rainbowTimer > 0) {
          const hue = (time * 40 + i * 10) % 360;
          ctx.fillStyle = `hsl(${hue}, 80%, 50%)`;
        } else {
          // Gradient from bright to dark
          const r = Math.floor(16 + (4 - 16) * progress);
          const g = Math.floor(185 + (150 - 185) * progress);
          const b = Math.floor(129 + (105 - 129) * progress);
          ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
        }
        this.renderSegment(ctx, drawX, drawY, 1);
      }
    }

    ctx.globalAlpha = 1;
  }

  private renderSegment(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number): void {
    const size = this.gridSize - 2;
    const offset = (this.gridSize - size * scale) / 2;
    const radius = 4 * scale;

    ctx.beginPath();
    ctx.roundRect(x + offset, y + offset, size * scale, size * scale, radius);
    ctx.fill();
  }

  private renderSnakeHead(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    const size = this.gridSize - 2;

    // Head body
    ctx.fillStyle = COLORS.snakeHead;
    ctx.beginPath();
    ctx.roundRect(x + 1, y + 1, size, size, 6);
    ctx.fill();

    // Eyes based on direction
    const eyeSize = this.gridSize / 6;
    const eyeOffset = this.gridSize * 0.2;

    ctx.fillStyle = COLORS.snakeEye;

    // Calculate eye positions based on direction
    let eye1X: number, eye1Y: number, eye2X: number, eye2Y: number;

    if (this.direction.x === 1) {
      // Moving right
      eye1X = x + this.gridSize - eyeOffset - eyeSize;
      eye1Y = y + eyeOffset;
      eye2X = x + this.gridSize - eyeOffset - eyeSize;
      eye2Y = y + this.gridSize - eyeOffset - eyeSize;
    } else if (this.direction.x === -1) {
      // Moving left
      eye1X = x + eyeOffset;
      eye1Y = y + eyeOffset;
      eye2X = x + eyeOffset;
      eye2Y = y + this.gridSize - eyeOffset - eyeSize;
    } else if (this.direction.y === -1) {
      // Moving up
      eye1X = x + eyeOffset;
      eye1Y = y + eyeOffset;
      eye2X = x + this.gridSize - eyeOffset - eyeSize;
      eye2Y = y + eyeOffset;
    } else {
      // Moving down
      eye1X = x + eyeOffset;
      eye1Y = y + this.gridSize - eyeOffset - eyeSize;
      eye2X = x + this.gridSize - eyeOffset - eyeSize;
      eye2Y = y + this.gridSize - eyeOffset - eyeSize;
    }

    // Draw eyes
    ctx.fillRect(eye1X, eye1Y, eyeSize, eyeSize);
    ctx.fillRect(eye2X, eye2Y, eyeSize, eyeSize);

    // Pupils
    ctx.fillStyle = COLORS.snakePupil;
    const pupilSize = eyeSize * 0.5;
    const pupilOffset = (eyeSize - pupilSize) / 2;
    ctx.fillRect(eye1X + pupilOffset + this.direction.x, eye1Y + pupilOffset + this.direction.y, pupilSize, pupilSize);
    ctx.fillRect(eye2X + pupilOffset + this.direction.x, eye2Y + pupilOffset + this.direction.y, pupilSize, pupilSize);
  }

  private renderHUD(ctx: CanvasRenderingContext2D): void {
    // Score (top-left)
    ctx.fillStyle = COLORS.textPrimary;
    ctx.font = 'bold 28px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`${this.score}`, 24, 40);

    // Combo indicator
    const combo = this.comboSystem.getCombo();
    if (combo > 1) {
      ctx.fillStyle = COLORS.comboText;
      ctx.font = 'bold 18px Arial';
      ctx.fillText(`x${combo} COMBO`, 24, 65);

      // Combo timer bar
      const barWidth = 80;
      const progress = this.comboSystem.getComboProgress();
      ctx.fillStyle = 'rgba(251, 191, 36, 0.3)';
      ctx.fillRect(24, 72, barWidth, 4);
      ctx.fillStyle = COLORS.comboText;
      ctx.fillRect(24, 72, barWidth * progress, 4);
    }

    // High score (top-left, below score)
    ctx.fillStyle = COLORS.textSecondary;
    ctx.font = '14px Arial';
    ctx.fillText(`BEST: ${this.highScore}`, 24, combo > 1 ? 95 : 65);

    // Lives (top-right)
    ctx.textAlign = 'right';
    const heartSize = 20;
    const heartSpacing = 26;
    const heartsX = this.canvas.width - 24;
    const heartsY = 32;

    for (let i = 0; i < this.maxLives; i++) {
      const x = heartsX - (i * heartSpacing) - heartSize / 2;
      this.drawHeart(ctx, x, heartsY, heartSize, i < this.lives ? COLORS.heartFull : COLORS.heartEmpty);
    }

    // Length indicator
    ctx.fillStyle = COLORS.textSecondary;
    ctx.font = '14px Arial';
    ctx.fillText(`Length: ${this.snake.length}`, this.canvas.width - 24, 58);

    // Active power-ups (bottom)
    if (this.activePowerUps.length > 0) {
      const barY = this.canvas.height - 40;
      const barHeight = 24;
      const barSpacing = 10;
      let currentX = 24;

      ctx.font = '12px Arial';
      ctx.textAlign = 'left';

      for (const pu of this.activePowerUps) {
        const config = POWERUP_CONFIGS[pu.type];
        const progress = pu.duration / pu.maxDuration;
        const barWidth = 100;

        // Background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.fillRect(currentX, barY, barWidth, barHeight);

        // Progress
        ctx.fillStyle = config.color;
        ctx.globalAlpha = 0.7;
        ctx.fillRect(currentX, barY, barWidth * progress, barHeight);
        ctx.globalAlpha = 1;

        // Border
        ctx.strokeStyle = config.color;
        ctx.lineWidth = 1;
        ctx.strokeRect(currentX, barY, barWidth, barHeight);

        // Label
        ctx.fillStyle = COLORS.textPrimary;
        ctx.fillText(`${config.icon} ${pu.duration.toFixed(1)}s`, currentX + 6, barY + 16);

        currentX += barWidth + barSpacing;
      }
    }
  }

  private drawHeart(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string): void {
    ctx.fillStyle = color;
    ctx.beginPath();

    const width = size;
    const height = size;
    const topCurveHeight = height * 0.3;

    ctx.moveTo(x, y + topCurveHeight);
    // Left curve
    ctx.bezierCurveTo(
      x, y,
      x - width / 2, y,
      x - width / 2, y + topCurveHeight
    );
    // Left bottom
    ctx.bezierCurveTo(
      x - width / 2, y + (height + topCurveHeight) / 2,
      x, y + (height + topCurveHeight) / 2,
      x, y + height
    );
    // Right bottom
    ctx.bezierCurveTo(
      x, y + (height + topCurveHeight) / 2,
      x + width / 2, y + (height + topCurveHeight) / 2,
      x + width / 2, y + topCurveHeight
    );
    // Right curve
    ctx.bezierCurveTo(
      x + width / 2, y,
      x, y,
      x, y + topCurveHeight
    );

    ctx.fill();
  }

  isGameOver(): boolean {
    return this.gameState === 'gameOver';
  }
}
