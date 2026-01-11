// ===== src/games/bubble/BubblePopGame.ts =====

import { BaseGame } from '@/games/shared/BaseGame';
import { GameManifest, GameScore } from '@/lib/types';

// Entities
import { Bubble, BubbleColor, PowerUpType, BUBBLE_COLORS } from './entities/Bubble';
import { Shooter } from './entities/Shooter';

// Systems
import { BubbleGrid, MatchResult } from './systems/BubbleGrid';
import { ParticleSystem } from './systems/ParticleSystem';
import { ScreenShake } from './systems/ScreenShake';
import { ComboSystem } from './systems/ComboSystem';
import { FeverSystem } from './systems/FeverSystem';
import { BackgroundSystem } from './systems/BackgroundSystem';

type GameState = 'ready' | 'playing' | 'shooting' | 'processing' | 'game-over' | 'victory' | 'stats-recap';

interface GameStats {
  bubblesPopped: number;
  cascadePops: number;
  powerUpsUsed: number;
  shotsTotal: number;
  shotsHit: number;
  maxCombo: number;
  maxChain: number;
  maxFever: number;
  perfectClears: number;
}

export class BubblePopGame extends BaseGame {
  manifest: GameManifest = {
    id: 'bubble',
    title: 'Bubble Pop',
    thumbnail: '/games/bubble/bubble-thumb.svg',
    inputSchema: ['keyboard', 'touch'],
    assetBudgetKB: 50,
    tier: 1,
    description: 'Pop bubbles by matching 3 or more! Chain combos and use power-ups to clear the board!'
  };

  // Core systems
  private grid!: BubbleGrid;
  private shooter!: Shooter;
  private particles!: ParticleSystem;
  private screenShake!: ScreenShake;
  private comboSystem!: ComboSystem;
  private feverSystem!: FeverSystem;
  private backgroundSystem!: BackgroundSystem;

  // Game state
  private gameState: GameState = 'ready';
  private readyTimer: number = 2;

  // Grid configuration
  private readonly GRID_COLS = 10;
  private readonly GRID_ROWS = 15;
  private readonly BUBBLE_SIZE = 38;
  private gridOffsetX: number = 0;
  private gridOffsetY: number = 50;

  // Progressive difficulty
  private ceilingDescentTimer: number = 0;
  private ceilingDescentInterval: number = 30; // seconds between descent
  private ceilingDescentSpeed: number = 1; // multiplier
  private isFrozen: boolean = false;
  private freezeTimer: number = 0;
  private readonly FREEZE_DURATION = 10;

  // Danger zone
  private readonly DANGER_LINE_Y = 450;

  // Stats
  private stats: GameStats = {
    bubblesPopped: 0,
    cascadePops: 0,
    powerUpsUsed: 0,
    shotsTotal: 0,
    shotsHit: 0,
    maxCombo: 0,
    maxChain: 0,
    maxFever: 0,
    perfectClears: 0,
  };

  // Input state
  private lastMouseX: number = 0;
  private lastMouseY: number = 0;
  private isAiming: boolean = false;

  // Power-up spawn tracking
  private shotsSincePowerUp: number = 0;
  private readonly POWERUP_SPAWN_INTERVAL = 8;

  // Processing state
  private processingDelay: number = 0;

  // Stats recap
  private recapTimer: number = 0;
  private showingRecap: boolean = false;

  protected onInit(): void {
    // Calculate grid offset to center it
    this.gridOffsetX = (this.canvas.width - this.GRID_COLS * this.BUBBLE_SIZE) / 2;

    // Initialize systems
    this.grid = new BubbleGrid({
      cols: this.GRID_COLS,
      rows: this.GRID_ROWS,
      bubbleSize: this.BUBBLE_SIZE,
      offsetX: this.gridOffsetX,
      offsetY: this.gridOffsetY,
    });

    this.shooter = new Shooter({
      x: this.canvas.width / 2,
      y: this.canvas.height - 60,
      canvasWidth: this.canvas.width,
      canvasHeight: this.canvas.height,
    });

    this.particles = new ParticleSystem();
    this.screenShake = new ScreenShake();
    this.comboSystem = new ComboSystem();
    this.feverSystem = new FeverSystem();
    this.backgroundSystem = new BackgroundSystem(this.canvas.width, this.canvas.height);

    // Fill initial bubbles (5 rows)
    this.grid.fillInitialBubbles(5);

    // Load initial bubbles for shooter
    this.loadNextBubbles();

    this.gameState = 'ready';
  }

  protected onRestart(): void {
    // Reset all systems
    this.grid.reset();
    this.grid.fillInitialBubbles(5);

    this.particles.clear();
    this.screenShake.stop();
    this.comboSystem.reset();
    this.feverSystem.reset();

    // Reset state
    this.gameState = 'ready';
    this.readyTimer = 2;
    this.ceilingDescentTimer = 0;
    this.ceilingDescentSpeed = 1;
    this.isFrozen = false;
    this.freezeTimer = 0;
    this.shotsSincePowerUp = 0;
    this.processingDelay = 0;
    this.showingRecap = false;
    this.recapTimer = 0;

    // Reset stats
    this.stats = {
      bubblesPopped: 0,
      cascadePops: 0,
      powerUpsUsed: 0,
      shotsTotal: 0,
      shotsHit: 0,
      maxCombo: 0,
      maxChain: 0,
      maxFever: 0,
      perfectClears: 0,
    };

    // Reload shooter
    this.loadNextBubbles();
  }

  private loadNextBubbles(): void {
    // Load current bubble if empty
    if (!this.shooter.currentBubble) {
      const color = this.grid.getRandomAvailableColor();
      const powerUp = this.shouldSpawnPowerUp() ? this.getRandomPowerUp() : undefined;
      this.shooter.setCurrentBubble(color, powerUp);
      if (powerUp) {
        this.shotsSincePowerUp = 0;
      }
    }

    // Load next bubble if empty
    if (!this.shooter.nextBubble) {
      const color = this.grid.getRandomAvailableColor();
      this.shooter.setNextBubble(color);
    }
  }

  private shouldSpawnPowerUp(): boolean {
    this.shotsSincePowerUp++;
    return this.shotsSincePowerUp >= this.POWERUP_SPAWN_INTERVAL && Math.random() < 0.4;
  }

  private getRandomPowerUp(): PowerUpType {
    const types: PowerUpType[] = ['bomb', 'rainbow', 'lightning', 'freeze', 'star'];
    const weights = [0.25, 0.2, 0.2, 0.2, 0.15];

    const rand = Math.random();
    let cumulative = 0;
    for (let i = 0; i < types.length; i++) {
      cumulative += weights[i];
      if (rand < cumulative) {
        return types[i];
      }
    }
    return 'bomb';
  }

  protected onUpdate(dt: number): void {
    // Handle stats recap
    if (this.showingRecap) {
      this.updateRecap(dt);
      return;
    }

    // Update systems
    this.particles.update(dt);
    this.screenShake.update(dt);
    this.backgroundSystem.update(dt);

    // Handle ready countdown
    if (this.gameState === 'ready') {
      this.updateReady(dt);
      return;
    }

    // Handle game over
    if (this.gameState === 'game-over' || this.gameState === 'victory') {
      // Wait for input
      if (this.services.input.isActionPressed()) {
        this.showingRecap = true;
        this.recapTimer = 0;
      }
      return;
    }

    // Update game systems
    this.comboSystem.update(dt);
    this.feverSystem.update(dt);
    this.grid.update(dt);
    this.shooter.update(dt);

    // Handle freeze
    if (this.isFrozen) {
      this.freezeTimer -= dt;
      if (this.freezeTimer <= 0) {
        this.isFrozen = false;
      }
    }

    // Handle ceiling descent
    if (!this.isFrozen && this.gameState === 'playing') {
      this.ceilingDescentTimer += dt * this.ceilingDescentSpeed;
      if (this.ceilingDescentTimer >= this.ceilingDescentInterval) {
        this.ceilingDescentTimer = 0;
        this.descendCeiling();
      }
    }

    // Handle input
    this.handleInput();

    // Handle processing delay (after matches)
    if (this.gameState === 'processing') {
      this.processingDelay -= dt;
      if (this.processingDelay <= 0) {
        this.finishProcessing();
      }
      return;
    }

    // Handle shooting
    if (this.gameState === 'shooting') {
      this.updateShooting(dt);
    }

    // Check win/lose conditions
    this.checkGameConditions();
  }

  private updateReady(dt: number): void {
    this.readyTimer -= dt;

    // Check for early start
    if (this.services.input.isActionPressed() || this.readyTimer <= 0) {
      this.gameState = 'playing';
      this.services.audio.playSound('powerup');
    }
  }

  private updateRecap(dt: number): void {
    this.recapTimer += dt;

    // Continue to game over after input or timeout
    if ((this.recapTimer > 1 && this.services.input.isActionPressed()) || this.recapTimer > 6) {
      this.endGame();
    }
  }

  private handleInput(): void {
    if (this.gameState !== 'playing') return;

    // Touch/mouse input for aiming
    const touches = this.services.input.getTouches?.() || [];
    if (touches.length > 0) {
      const touch = touches[0];
      this.lastMouseX = touch.x;
      this.lastMouseY = touch.y;
      this.shooter.aimAt(touch.x, touch.y);
      this.isAiming = true;
    }

    // Keyboard aiming
    const leftPressed = this.services.input.isLeftPressed();
    const rightPressed = this.services.input.isRightPressed();
    if (leftPressed || rightPressed) {
      this.shooter.aimWithKeys(leftPressed, rightPressed, 1 / 60);
    }

    // Swap bubbles with down
    if (this.services.input.isDownPressed()) {
      this.shooter.swapBubbles();
      this.services.audio.playSound('click');
    }

    // Shooting
    const shootPressed = this.services.input.isActionPressed() || this.services.input.isUpPressed();
    if (shootPressed && this.shooter.isReadyToShoot()) {
      this.shoot();
    }
  }

  private shoot(): void {
    const bubble = this.shooter.shoot();
    if (!bubble) return;

    this.gameState = 'shooting';
    this.stats.shotsTotal++;
    this.services.audio.playSound('jump');

    // Trail particles
    if (bubble.color) {
      this.particles.createShootTrail(
        this.shooter.x,
        this.shooter.y,
        BUBBLE_COLORS[bubble.color].primary
      );
    }
  }

  private updateShooting(dt: number): void {
    const bubble = this.shooter.getShootingBubble();
    if (!bubble) {
      this.gameState = 'playing';
      return;
    }

    // Check if hit ceiling first
    if (this.grid.isAtCeiling(bubble.y, bubble.radius)) {
      const ceilingSnap = this.grid.findCeilingSnapPosition(bubble.x);
      if (ceilingSnap) {
        this.landBubble(bubble, ceilingSnap);
        return;
      }
      // Fallback: calculate grid position directly
      const gridX = Math.round((bubble.x - this.gridOffsetX - this.BUBBLE_SIZE / 2) / this.BUBBLE_SIZE);
      const clampedGridX = Math.max(0, Math.min(this.GRID_COLS - 1, gridX));
      this.landBubble(bubble, { gridX: clampedGridX, gridY: 0 });
      return;
    }

    // Check for collision with any bubble in the grid
    const collision = this.grid.checkCollision(bubble.x, bubble.y, bubble.radius);

    if (collision.collided && collision.snapPosition) {
      this.landBubble(bubble, collision.snapPosition);
      return;
    }

    // Fallback: check original snap position method (for edge cases)
    const snapPos = this.grid.findSnapPosition(bubble.x, bubble.y);
    if (snapPos) {
      const pos = this.grid.getScreenPosition(snapPos.gridX, snapPos.gridY);
      const dist = Math.sqrt((bubble.x - pos.x) ** 2 + (bubble.y - pos.y) ** 2);

      if (dist < this.BUBBLE_SIZE * 0.6) {
        this.landBubble(bubble, snapPos);
      }
    }
  }

  private landBubble(bubble: Bubble, snapPos: { gridX: number; gridY: number }): void {
    // Place bubble in grid
    bubble.gridX = snapPos.gridX;
    bubble.gridY = snapPos.gridY;

    const result = this.grid.addBubble(bubble);
    this.shooter.clearShootingBubble();

    // Handle power-up effects
    if (result.powerUpTriggered) {
      this.handlePowerUpEffect(result.powerUpTriggered, bubble);
      this.stats.powerUpsUsed++;
    }

    // Handle matches
    if (result.matches.length > 0) {
      this.handleMatches(result);
      this.stats.shotsHit++;

      // Start processing delay for cascades
      this.gameState = 'processing';
      this.processingDelay = 0.4;
    } else {
      // No match - end combo chain
      this.comboSystem.endShot();
      this.gameState = 'playing';
      this.loadNextBubbles();
    }

    this.services.audio.playSound('success');
  }

  private handleMatches(result: MatchResult): void {
    const matchCount = result.matches.length;

    // Add to fever
    this.feverSystem.addPops(matchCount);

    // Calculate score with multipliers
    const comboResult = this.comboSystem.addPop(matchCount);
    const feverMultiplier = this.feverSystem.getMultiplier();
    const baseScore = matchCount * 100;
    const totalScore = Math.floor(baseScore * comboResult.multiplier * feverMultiplier);

    this.score += totalScore;
    this.stats.bubblesPopped += matchCount;

    // Update max stats
    if (this.comboSystem.getCombo() > this.stats.maxCombo) {
      this.stats.maxCombo = this.comboSystem.getCombo();
    }
    if (this.grid.getCurrentChain() > this.stats.maxChain) {
      this.stats.maxChain = this.grid.getCurrentChain();
    }
    if (this.feverSystem.getMaxLevelReached() > this.stats.maxFever) {
      this.stats.maxFever = this.feverSystem.getMaxLevelReached();
    }

    // Pop particles
    for (const bubble of result.matches) {
      if (bubble.color) {
        this.particles.createBubblePop(bubble.x, bubble.y, bubble.color);
      }
    }

    // Screen effects based on combo
    if (comboResult.isComboActive) {
      this.screenShake.shake(this.comboSystem.getShakeIntensity(), 0.2);
      this.particles.createComboFlash(
        this.canvas.width,
        this.canvas.height,
        this.comboSystem.getCombo()
      );
    }

    // Cascade bonus
    if (result.orphans.length > 0) {
      const cascadeBonus = result.orphans.length * 50 * feverMultiplier;
      this.score += Math.floor(cascadeBonus);
      this.stats.cascadePops += result.orphans.length;
      this.stats.bubblesPopped += result.orphans.length;

      for (const orphan of result.orphans) {
        if (orphan.color) {
          this.particles.createCascade(orphan.x, orphan.y, orphan.color);
        }
      }
    }

    this.services.audio.playSound('coin');
  }

  private handlePowerUpEffect(type: PowerUpType, bubble: Bubble): void {
    switch (type) {
      case 'bomb':
        this.particles.createBombExplosion(bubble.x, bubble.y);
        this.screenShake.shake(15, 0.4);
        this.services.audio.playSound('collision');
        break;

      case 'rainbow':
        this.particles.createRainbowBurst(bubble.x, bubble.y);
        this.services.audio.playSound('unlock');
        break;

      case 'lightning':
        this.particles.createLightningStrike(this.canvas.width / 2, bubble.y, this.canvas.width);
        this.screenShake.shake(8, 0.3);
        this.services.audio.playSound('powerup');
        break;

      case 'freeze':
        this.particles.createFreezeEffect(bubble.x, bubble.y);
        this.isFrozen = true;
        this.freezeTimer = this.FREEZE_DURATION;
        this.services.audio.playSound('success');
        break;

      case 'star':
        this.particles.createStarBurst(bubble.x, bubble.y);
        this.services.audio.playSound('unlock');
        break;
    }
  }

  private finishProcessing(): void {
    this.comboSystem.endShot();
    this.gameState = 'playing';
    this.loadNextBubbles();

    // Check for perfect clear
    if (this.grid.isEmpty()) {
      this.stats.perfectClears++;
      this.score += 5000;
      this.particles.createVictory(this.canvas.width, this.canvas.height);
      this.services.audio.playSound('unlock');

      // Refill grid with fewer rows
      this.grid.fillInitialBubbles(3);
      this.ceilingDescentSpeed += 0.2; // Increase difficulty
    }
  }

  private descendCeiling(): void {
    this.grid.addRow();
    this.particles.createCeilingWarning(this.canvas.width, this.gridOffsetY);
    this.screenShake.shake(5, 0.2);
    this.services.audio.playSound('click');
  }

  private checkGameConditions(): void {
    // Check lose condition - bubbles reached danger line
    const lowestY = this.grid.getLowestBubbleY();
    if (lowestY >= this.DANGER_LINE_Y) {
      this.gameState = 'game-over';
      this.screenShake.shake(20, 0.5);
      this.services.audio.playSound('collision');
    }

    // Check win condition - all bubbles cleared (handled in finishProcessing)
  }

  protected onRender(ctx: CanvasRenderingContext2D): void {
    ctx.save();

    // Apply screen shake
    const shakeOffset = this.screenShake.getOffset();
    ctx.translate(shakeOffset.x, shakeOffset.y);

    // Background
    this.backgroundSystem.render(ctx);

    // Fever overlay
    this.feverSystem.render(ctx, this.canvas.width, this.canvas.height);

    // Game area
    this.backgroundSystem.renderGameArea(ctx, this.gridOffsetY + this.grid.ceilingOffset);

    // Danger zone indicator
    this.backgroundSystem.renderDangerZone(ctx, this.DANGER_LINE_Y);

    // Shooter area
    this.backgroundSystem.renderShooterArea(ctx);

    // Bubble grid
    this.grid.render(ctx);

    // Shooter
    this.shooter.render(ctx);

    // Particles
    this.particles.render(ctx);

    ctx.restore();
  }

  protected onRenderUI(ctx: CanvasRenderingContext2D): void {
    // Stats recap screen
    if (this.showingRecap) {
      this.renderRecap(ctx);
      return;
    }

    // Ready countdown
    if (this.gameState === 'ready') {
      this.renderReadyScreen(ctx);
      return;
    }

    // Game over screen
    if (this.gameState === 'game-over') {
      this.renderGameOver(ctx);
      return;
    }

    // Victory screen
    if (this.gameState === 'victory') {
      this.renderVictory(ctx);
      return;
    }

    // Playing UI
    this.renderPlayingUI(ctx);
  }

  private renderReadyScreen(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('BUBBLE POP', this.canvas.width / 2, this.canvas.height / 2 - 50);

    ctx.font = '20px Arial';
    ctx.fillStyle = '#94A3B8';
    ctx.fillText('Match 3+ bubbles to pop them!', this.canvas.width / 2, this.canvas.height / 2);

    if (this.readyTimer > 0) {
      ctx.font = 'bold 36px Arial';
      ctx.fillStyle = '#FBBF24';
      ctx.fillText(`${Math.ceil(this.readyTimer)}`, this.canvas.width / 2, this.canvas.height / 2 + 60);
    } else {
      ctx.font = '24px Arial';
      ctx.fillStyle = '#22C55E';
      ctx.fillText('Tap or Press SPACE to start!', this.canvas.width / 2, this.canvas.height / 2 + 60);
    }

    // Controls hint
    ctx.font = '14px Arial';
    ctx.fillStyle = '#64748B';
    ctx.fillText('Move: Arrow Keys / Touch', this.canvas.width / 2, this.canvas.height - 80);
    ctx.fillText('Shoot: Space / Tap | Swap: Down Arrow', this.canvas.width / 2, this.canvas.height - 60);
  }

  private renderPlayingUI(ctx: CanvasRenderingContext2D): void {
    // Combo display
    this.comboSystem.renderComboUI(ctx, this.canvas.width / 2, 20);

    // Fever meter
    this.feverSystem.renderHUD(ctx, this.canvas.width - 130, this.getHudStartY(), 120);

    // Freeze indicator
    if (this.isFrozen) {
      ctx.fillStyle = '#06B6D4';
      ctx.font = 'bold 16px Arial';
      ctx.textAlign = 'left';
      ctx.fillText(`FREEZE: ${this.freezeTimer.toFixed(1)}s`, 20, this.getHudStartY() + 20);
    }

    // Ceiling descent warning
    const timeToDescend = this.ceilingDescentInterval - this.ceilingDescentTimer;
    if (timeToDescend <= 5 && !this.isFrozen) {
      const pulse = Math.sin(this.gameTime * 8) > 0;
      ctx.fillStyle = pulse ? '#EF4444' : '#FCA5A5';
      ctx.font = 'bold 14px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(`Ceiling in ${timeToDescend.toFixed(1)}s!`, this.canvas.width / 2, this.canvas.height - 110);
    }

    // Bubble count
    ctx.fillStyle = '#94A3B8';
    ctx.font = '14px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`Bubbles: ${this.grid.getBubbleCount()}`, 20, this.canvas.height - 20);

    // Shots counter
    ctx.textAlign = 'right';
    ctx.fillText(`Shots: ${this.stats.shotsTotal}`, this.canvas.width - 20, this.canvas.height - 20);
  }

  private renderGameOver(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    ctx.fillStyle = '#EF4444';
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('GAME OVER', this.canvas.width / 2, this.canvas.height / 2 - 40);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 32px Arial';
    ctx.fillText(`Score: ${this.score}`, this.canvas.width / 2, this.canvas.height / 2 + 20);

    ctx.font = '18px Arial';
    ctx.fillStyle = '#94A3B8';
    ctx.fillText('Press SPACE to continue', this.canvas.width / 2, this.canvas.height / 2 + 80);
  }

  private renderVictory(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    ctx.fillStyle = '#FBBF24';
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('VICTORY!', this.canvas.width / 2, this.canvas.height / 2 - 40);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 32px Arial';
    ctx.fillText(`Score: ${this.score}`, this.canvas.width / 2, this.canvas.height / 2 + 20);

    ctx.font = '18px Arial';
    ctx.fillStyle = '#94A3B8';
    ctx.fillText('Press SPACE to continue', this.canvas.width / 2, this.canvas.height / 2 + 80);
  }

  private renderRecap(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.92)';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    const cx = this.canvas.width / 2;
    let y = 60;

    // Title
    ctx.fillStyle = this.gameState === 'victory' ? '#FBBF24' : '#EF4444';
    ctx.font = 'bold 36px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(this.gameState === 'victory' ? 'VICTORY!' : 'GAME OVER', cx, y);
    y += 50;

    // Score
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 48px Arial';
    ctx.fillText(this.score.toLocaleString(), cx, y);
    y += 50;

    // Stats grid
    const stats = [
      { icon: '💥', label: 'Bubbles Popped', value: this.stats.bubblesPopped.toString(), color: '#EF4444' },
      { icon: '🔗', label: 'Cascade Pops', value: this.stats.cascadePops.toString(), color: '#A855F7' },
      { icon: '🎯', label: 'Accuracy', value: `${this.stats.shotsTotal > 0 ? Math.round((this.stats.shotsHit / this.stats.shotsTotal) * 100) : 0}%`, color: '#22C55E' },
      { icon: '🔥', label: 'Max Combo', value: `${this.stats.maxCombo}x`, color: '#F59E0B' },
      { icon: '⚡', label: 'Max Chain', value: this.stats.maxChain.toString(), color: '#3B82F6' },
      { icon: '🌡️', label: 'Max Fever', value: `Lv.${this.stats.maxFever}`, color: '#EC4899' },
    ];

    const gridCols = 3;
    const gridWidth = Math.min(this.canvas.width - 40, 360);
    const cellWidth = gridWidth / gridCols;
    const startX = cx - gridWidth / 2;

    for (let i = 0; i < stats.length; i++) {
      const stat = stats[i];
      const col = i % gridCols;
      const row = Math.floor(i / gridCols);
      const x = startX + col * cellWidth + cellWidth / 2;
      const rowY = y + row * 60;

      // Animate in
      const delay = i * 0.1;
      const alpha = Math.min(1, Math.max(0, (this.recapTimer - delay) * 3));
      ctx.globalAlpha = alpha;

      ctx.font = '20px Arial';
      ctx.fillText(stat.icon, x, rowY);

      ctx.fillStyle = stat.color;
      ctx.font = 'bold 18px Arial';
      ctx.fillText(stat.value, x, rowY + 22);

      ctx.fillStyle = '#64748B';
      ctx.font = '11px Arial';
      ctx.fillText(stat.label, x, rowY + 36);
    }

    ctx.globalAlpha = 1;
    y += 140;

    // Power-ups used
    if (this.stats.powerUpsUsed > 0) {
      ctx.fillStyle = '#FBBF24';
      ctx.font = 'bold 14px Arial';
      ctx.fillText(`Power-ups Used: ${this.stats.powerUpsUsed}`, cx, y);
      y += 25;
    }

    // Perfect clears
    if (this.stats.perfectClears > 0) {
      ctx.fillStyle = '#22C55E';
      ctx.font = 'bold 14px Arial';
      ctx.fillText(`Perfect Clears: ${this.stats.perfectClears}`, cx, y);
      y += 25;
    }

    // Continue hint
    const continueAlpha = Math.sin(this.recapTimer * 4) * 0.3 + 0.7;
    ctx.globalAlpha = continueAlpha;
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '16px Arial';
    ctx.fillText('Tap or Press SPACE to continue', cx, this.canvas.height - 40);
    ctx.globalAlpha = 1;
  }

  protected onGameEnd(finalScore: GameScore): void {
    // Extended game data for achievements
    this.extendedGameData = {
      bubbles_popped: this.stats.bubblesPopped,
      cascade_pops: this.stats.cascadePops,
      powerups_used: this.stats.powerUpsUsed,
      shots_total: this.stats.shotsTotal,
      shots_hit: this.stats.shotsHit,
      accuracy: this.stats.shotsTotal > 0 ? Math.round((this.stats.shotsHit / this.stats.shotsTotal) * 100) : 0,
      max_combo: this.stats.maxCombo,
      max_chain: this.stats.maxChain,
      max_fever: this.stats.maxFever,
      perfect_clears: this.stats.perfectClears,
    };

    // Track analytics
    this.services?.analytics?.trackGameSpecificStat?.('bubble', 'bubbles_popped', this.stats.bubblesPopped);
    this.services?.analytics?.trackGameSpecificStat?.('bubble', 'max_combo', this.stats.maxCombo);
    this.services?.analytics?.trackGameSpecificStat?.('bubble', 'max_chain', this.stats.maxChain);
    this.services?.analytics?.trackGameSpecificStat?.('bubble', 'powerups_used', this.stats.powerUpsUsed);
    this.services?.analytics?.trackGameSpecificStat?.('bubble', 'perfect_clears', this.stats.perfectClears);

    super.onGameEnd?.(finalScore);
  }

  protected onResize(width: number, height: number): void {
    this.gridOffsetX = (width - this.GRID_COLS * this.BUBBLE_SIZE) / 2;
    this.shooter?.resize(width, height);
    this.backgroundSystem?.resize(width, height);
  }
}
