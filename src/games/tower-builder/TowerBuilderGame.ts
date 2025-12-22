// ===== src/games/tower-builder/TowerBuilderGame.ts =====
// Tower Builder - A precision stacking game with 7 key features:
// 1. Swinging Block Placement - Blocks swing back and forth requiring timing
// 2. Physics & Balance System - Realistic stacking with wobble and collapse
// 3. Height Progression & Scoring - Score based on height and precision
// 4. Perfect Landing Combos - Combo multiplier for consecutive perfects
// 5. Visual Effects & Polish - Particles, shake, smooth animations
// 6. Power-ups System - Slow motion, wider blocks, auto-perfect
// 7. Dynamic Camera & Parallax - Camera follows tower with parallax background

import { BaseGame } from '@/games/shared/BaseGame';
import { GameManifest, GameScore } from '@/lib/types';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

type GameState = 'ready' | 'swinging' | 'dropping' | 'landing' | 'wobbling' | 'gameOver';
type PowerUpType = 'slowmo' | 'widen' | 'perfect';

interface Block {
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  settled: boolean;
  velocity: { x: number; y: number };
  rotation: number;
  rotationVel: number;
  isPerfect: boolean;
}

interface SwingingBlock {
  x: number;
  width: number;
  direction: number; // 1 or -1
  speed: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  life: number;
  maxLife: number;
  type: 'spark' | 'star' | 'dust' | 'confetti';
  rotation: number;
  rotationSpeed: number;
}

interface PowerUp {
  type: PowerUpType;
  x: number;
  y: number;
  collected: boolean;
  floatOffset: number;
}

interface BackgroundLayer {
  buildings: { x: number; width: number; height: number; color: string; windows: boolean }[];
  speed: number;
  yOffset: number;
}

interface CloudType {
  x: number;
  y: number;
  width: number;
  speed: number;
  opacity: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const CANVAS_WIDTH = 520;
const CANVAS_HEIGHT = 600;
const BLOCK_HEIGHT = 30;
const INITIAL_BLOCK_WIDTH = 200;
const MIN_BLOCK_WIDTH = 20;
const GROUND_Y = CANVAS_HEIGHT - 60;
const GRAVITY = 1200;
const DROP_SPEED = 800;
const PERFECT_THRESHOLD = 5;
const GOOD_THRESHOLD = 15;

// Swing settings
const BASE_SWING_SPEED = 250;
const MAX_SWING_SPEED = 500;
const SWING_ACCELERATION = 8; // Speed increase per block

// Visual settings
const BLOCK_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
  '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
];

// Power-up settings
const POWERUP_SPAWN_CHANCE = 0.15;
const SLOWMO_DURATION = 5;
const WIDEN_AMOUNT = 40;

// ============================================================================
// MAIN GAME CLASS
// ============================================================================

export class TowerBuilderGame extends BaseGame {
  manifest: GameManifest = {
    id: 'tower-builder',
    title: 'Tower Builder',
    thumbnail: '/games/tower-builder/tower-builder-thumb.svg',
    inputSchema: ['keyboard', 'touch'],
    assetBudgetKB: 80,
    tier: 1,
    description: 'Stack blocks with precision timing! Build the tallest tower you can!'
  };

  // Game state
  private gameState: GameState = 'ready';
  private tower: Block[] = [];
  private swingingBlock: SwingingBlock | null = null;
  private droppingBlock: Block | null = null;

  // Scoring & combos
  private height: number = 0;
  private perfectStreak: number = 0;
  private maxPerfectStreak: number = 0;
  private blocksPlaced: number = 0;
  private totalPerfects: number = 0;

  // Camera
  private cameraY: number = 0;
  private targetCameraY: number = 0;

  // Visual effects
  private particles: Particle[] = [];
  private screenShake: number = 0;
  private flashAlpha: number = 0;
  private comboScale: number = 1;

  // Power-ups
  private powerUps: PowerUp[] = [];
  private activePowerUps: { type: PowerUpType; timeLeft: number }[] = [];
  private slowMotionActive: boolean = false;

  // Background
  private backgroundLayers: BackgroundLayer[] = [];
  private clouds: CloudType[] = [];
  private skyGradientOffset: number = 0;
  private stars: { x: number; y: number; size: number; twinkle: number }[] = [];

  // Input state
  private inputPressed: boolean = false;
  private lastInputState: boolean = false;

  // Animation timers
  private readyTimer: number = 0;
  private gameOverTimer: number = 0;

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  protected onInit(): void {
    this.renderBaseHud = false;
    this.initializeBackground();
    this.initializeClouds();
    this.initializeStars();
    this.startNewGame();
  }

  private initializeBackground(): void {
    // Create 3 parallax layers of city buildings
    this.backgroundLayers = [];

    // Far layer (slowest, darkest)
    const farBuildings: BackgroundLayer['buildings'] = [];
    for (let x = 0; x < CANVAS_WIDTH + 200; x += 60 + Math.random() * 40) {
      farBuildings.push({
        x,
        width: 40 + Math.random() * 30,
        height: 100 + Math.random() * 150,
        color: '#1a1a2e',
        windows: false
      });
    }
    this.backgroundLayers.push({ buildings: farBuildings, speed: 0.1, yOffset: 0 });

    // Mid layer
    const midBuildings: BackgroundLayer['buildings'] = [];
    for (let x = 0; x < CANVAS_WIDTH + 200; x += 50 + Math.random() * 30) {
      midBuildings.push({
        x,
        width: 35 + Math.random() * 25,
        height: 80 + Math.random() * 180,
        color: '#16213e',
        windows: true
      });
    }
    this.backgroundLayers.push({ buildings: midBuildings, speed: 0.2, yOffset: 0 });

    // Near layer (fastest, lightest)
    const nearBuildings: BackgroundLayer['buildings'] = [];
    for (let x = 0; x < CANVAS_WIDTH + 200; x += 70 + Math.random() * 50) {
      nearBuildings.push({
        x,
        width: 50 + Math.random() * 40,
        height: 60 + Math.random() * 200,
        color: '#0f3460',
        windows: true
      });
    }
    this.backgroundLayers.push({ buildings: nearBuildings, speed: 0.35, yOffset: 0 });
  }

  private initializeClouds(): void {
    this.clouds = [];
    for (let i = 0; i < 8; i++) {
      this.clouds.push({
        x: Math.random() * CANVAS_WIDTH * 2,
        y: 50 + Math.random() * 200,
        width: 80 + Math.random() * 120,
        speed: 10 + Math.random() * 20,
        opacity: 0.3 + Math.random() * 0.4
      });
    }
  }

  private initializeStars(): void {
    this.stars = [];
    for (let i = 0; i < 50; i++) {
      this.stars.push({
        x: Math.random() * CANVAS_WIDTH,
        y: Math.random() * 300,
        size: 1 + Math.random() * 2,
        twinkle: Math.random() * Math.PI * 2
      });
    }
  }

  private startNewGame(): void {
    this.tower = [];
    this.particles = [];
    this.powerUps = [];
    this.activePowerUps = [];

    this.score = 0;
    this.height = 0;
    this.perfectStreak = 0;
    this.maxPerfectStreak = 0;
    this.blocksPlaced = 0;
    this.totalPerfects = 0;
    this.pickups = 0;

    this.cameraY = 0;
    this.targetCameraY = 0;
    this.screenShake = 0;
    this.slowMotionActive = false;

    // Create foundation block
    const foundation: Block = {
      x: CANVAS_WIDTH / 2,
      y: GROUND_Y,
      width: INITIAL_BLOCK_WIDTH,
      height: BLOCK_HEIGHT,
      color: '#2C3E50',
      settled: true,
      velocity: { x: 0, y: 0 },
      rotation: 0,
      rotationVel: 0,
      isPerfect: false
    };
    this.tower.push(foundation);

    this.gameState = 'ready';
    this.readyTimer = 0;
    this.spawnSwingingBlock();
  }

  private spawnSwingingBlock(): void {
    const lastBlock = this.tower[this.tower.length - 1];
    const speedIncrease = Math.min(this.blocksPlaced * SWING_ACCELERATION, MAX_SWING_SPEED - BASE_SWING_SPEED);
    const currentSpeed = BASE_SWING_SPEED + speedIncrease;

    // Apply slow motion if active
    const effectiveSpeed = this.slowMotionActive ? currentSpeed * 0.4 : currentSpeed;

    this.swingingBlock = {
      x: -lastBlock.width / 2,
      width: lastBlock.width,
      direction: 1,
      speed: effectiveSpeed
    };

    // Maybe spawn a power-up
    if (Math.random() < POWERUP_SPAWN_CHANCE && this.blocksPlaced > 2) {
      this.spawnPowerUp();
    }

    this.gameState = 'swinging';
  }

  private spawnPowerUp(): void {
    const types: PowerUpType[] = ['slowmo', 'widen', 'perfect'];
    const type = types[Math.floor(Math.random() * types.length)];
    const lastBlock = this.tower[this.tower.length - 1];

    this.powerUps.push({
      type,
      x: CANVAS_WIDTH / 2 + (Math.random() - 0.5) * 100,
      y: lastBlock.y - BLOCK_HEIGHT * 3,
      collected: false,
      floatOffset: 0
    });
  }

  // ============================================================================
  // UPDATE LOOP
  // ============================================================================

  protected onUpdate(dt: number): void {
    // Time scale for slow motion
    const timeScale = this.slowMotionActive ? 0.4 : 1;
    const scaledDt = dt * timeScale;

    this.updateInput();
    this.updatePowerUps(dt);
    this.updateBackground(scaledDt);
    this.updateClouds(scaledDt);
    this.updateStars(dt);
    this.updateParticles(dt);
    this.updateCamera(dt);
    this.updateVisualEffects(dt);

    switch (this.gameState) {
      case 'ready':
        this.readyTimer += dt;
        if (this.readyTimer > 0.5) {
          this.gameState = 'swinging';
        }
        break;

      case 'swinging':
        this.updateSwinging(scaledDt);
        break;

      case 'dropping':
        this.updateDropping(scaledDt);
        break;

      case 'landing':
        this.processLanding();
        break;

      case 'wobbling':
        this.updateWobbling(scaledDt);
        break;

      case 'gameOver':
        this.gameOverTimer += dt;
        break;
    }
  }

  private updateInput(): void {
    const input = this.services.input;
    const currentInput = input.isKeyPressed('Space') ||
      input.isKeyPressed('Enter') ||
      input.isMouseDown?.() ||
      input.isTouchActive?.();

    // Detect new press (rising edge)
    this.inputPressed = currentInput && !this.lastInputState;
    this.lastInputState = currentInput;

    if (this.inputPressed) {
      if (this.gameState === 'swinging') {
        this.dropBlock();
      } else if (this.gameState === 'gameOver' && this.gameOverTimer > 1) {
        this.restart();
      }
    }
  }

  private updateSwinging(dt: number): void {
    if (!this.swingingBlock) return;

    const block = this.swingingBlock;
    block.x += block.direction * block.speed * dt;

    // Bounce off edges
    const leftEdge = block.width / 2;
    const rightEdge = CANVAS_WIDTH - block.width / 2;

    if (block.x >= rightEdge) {
      block.x = rightEdge;
      block.direction = -1;
      this.services.audio.playSound('click');
    } else if (block.x <= leftEdge) {
      block.x = leftEdge;
      block.direction = 1;
      this.services.audio.playSound('click');
    }
  }

  private dropBlock(): void {
    if (!this.swingingBlock) return;

    const lastBlock = this.tower[this.tower.length - 1];
    const swing = this.swingingBlock;

    // Check for auto-perfect power-up
    let dropX = swing.x;
    const perfectPowerUp = this.activePowerUps.find(p => p.type === 'perfect');
    if (perfectPowerUp) {
      dropX = lastBlock.x;
      perfectPowerUp.timeLeft = 0;
      this.createPerfectEffect(dropX, lastBlock.y - BLOCK_HEIGHT);
    }

    // Apply widen power-up
    let blockWidth = swing.width;
    const widenPowerUp = this.activePowerUps.find(p => p.type === 'widen');
    if (widenPowerUp) {
      blockWidth = Math.min(blockWidth + WIDEN_AMOUNT, INITIAL_BLOCK_WIDTH);
      widenPowerUp.timeLeft = 0;
    }

    this.droppingBlock = {
      x: dropX,
      y: lastBlock.y - BLOCK_HEIGHT - 300 + this.cameraY,
      width: blockWidth,
      height: BLOCK_HEIGHT,
      color: BLOCK_COLORS[this.blocksPlaced % BLOCK_COLORS.length],
      settled: false,
      velocity: { x: 0, y: DROP_SPEED },
      rotation: 0,
      rotationVel: 0,
      isPerfect: false
    };

    this.swingingBlock = null;
    this.gameState = 'dropping';
    this.services.audio.playSound('whoosh');
  }

  private updateDropping(dt: number): void {
    if (!this.droppingBlock) return;

    const block = this.droppingBlock;
    block.velocity.y += GRAVITY * dt;
    block.y += block.velocity.y * dt;

    // Check collision with top of tower
    const lastBlock = this.tower[this.tower.length - 1];
    const targetY = lastBlock.y - BLOCK_HEIGHT;

    if (block.y >= targetY) {
      block.y = targetY;
      this.gameState = 'landing';
    }
  }

  private processLanding(): void {
    if (!this.droppingBlock) return;

    const block = this.droppingBlock;
    const lastBlock = this.tower[this.tower.length - 1];

    // Calculate overlap
    const blockLeft = block.x - block.width / 2;
    const blockRight = block.x + block.width / 2;
    const lastLeft = lastBlock.x - lastBlock.width / 2;
    const lastRight = lastBlock.x + lastBlock.width / 2;

    const overlapLeft = Math.max(blockLeft, lastLeft);
    const overlapRight = Math.min(blockRight, lastRight);
    const overlapWidth = overlapRight - overlapLeft;

    if (overlapWidth <= 0) {
      // Complete miss - game over
      this.triggerGameOver(block);
      return;
    }

    // Calculate offset from center
    const offset = Math.abs(block.x - lastBlock.x);
    const isPerfect = offset <= PERFECT_THRESHOLD;
    const isGood = offset <= GOOD_THRESHOLD;

    // Create the new settled block
    const settledBlock: Block = {
      x: overlapLeft + overlapWidth / 2,
      y: block.y,
      width: overlapWidth,
      height: BLOCK_HEIGHT,
      color: block.color,
      settled: true,
      velocity: { x: 0, y: 0 },
      rotation: 0,
      rotationVel: 0,
      isPerfect
    };

    this.tower.push(settledBlock);
    this.blocksPlaced++;
    this.height = this.blocksPlaced;

    // Handle perfect/good/normal landing
    if (isPerfect) {
      this.handlePerfectLanding(settledBlock);
    } else if (isGood) {
      this.handleGoodLanding(settledBlock);
    } else {
      this.handleNormalLanding(settledBlock, overlapWidth, block.width);
    }

    // Check for power-up collection
    this.checkPowerUpCollection(settledBlock);

    // Update camera target
    this.targetCameraY = Math.max(0, (this.tower.length - 8) * BLOCK_HEIGHT);

    // Spawn next block
    this.droppingBlock = null;
    this.gameState = 'wobbling';
  }

  private handlePerfectLanding(block: Block): void {
    this.perfectStreak++;
    this.totalPerfects++;
    this.maxPerfectStreak = Math.max(this.maxPerfectStreak, this.perfectStreak);

    // Perfect bonus scoring
    const comboBonus = Math.min(this.perfectStreak, 10);
    const pointsEarned = 100 + (comboBonus * 50);
    this.score += pointsEarned;
    this.pickups += Math.floor(pointsEarned / 50);

    // Visual feedback
    this.flashAlpha = 0.4;
    this.comboScale = 1.5;
    this.screenShake = 5;

    // Create celebration particles
    this.createPerfectParticles(block.x, block.y);
    this.services.audio.playSound('powerup');

    // Play combo sound for streaks
    if (this.perfectStreak >= 3) {
      this.services.audio.playSound('achievement');
    }
  }

  private handleGoodLanding(block: Block): void {
    this.perfectStreak = 0;
    const pointsEarned = 50;
    this.score += pointsEarned;
    this.pickups += 1;

    this.screenShake = 3;
    this.createLandingParticles(block.x, block.y, block.color);
    this.services.audio.playSound('coin');
  }

  private handleNormalLanding(block: Block, overlapWidth: number, originalWidth: number): void {
    this.perfectStreak = 0;

    // Score based on precision
    const precision = overlapWidth / originalWidth;
    const pointsEarned = Math.floor(20 * precision);
    this.score += pointsEarned;

    this.screenShake = 2;
    this.createLandingParticles(block.x, block.y, block.color);

    // Create falling debris for the cut-off part
    if (overlapWidth < originalWidth * 0.9) {
      this.createDebrisParticles(block.x, block.y, block.color);
    }

    this.services.audio.playSound('click');
  }

  private triggerGameOver(fallingBlock: Block): void {
    this.gameState = 'gameOver';
    this.gameOverTimer = 0;

    // Create dramatic falling animation
    fallingBlock.velocity.y = 200;
    fallingBlock.rotationVel = (Math.random() - 0.5) * 5;

    // Explosion particles
    for (let i = 0; i < 30; i++) {
      const angle = (Math.PI * 2 * i) / 30;
      this.particles.push({
        x: fallingBlock.x,
        y: fallingBlock.y,
        vx: Math.cos(angle) * (100 + Math.random() * 150),
        vy: Math.sin(angle) * (100 + Math.random() * 150) - 100,
        size: 4 + Math.random() * 6,
        color: fallingBlock.color,
        life: 1.5,
        maxLife: 1.5,
        type: 'confetti',
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 10
      });
    }

    this.screenShake = 15;
    this.services.audio.playSound('game_over');

    // Update extended game data for achievements
    this.extendedGameData = {
      height_reached: this.height,
      perfect_streak: this.maxPerfectStreak,
      total_perfects: this.totalPerfects,
      blocks_placed: this.blocksPlaced
    };

    this.endGame();
  }

  private updateWobbling(dt: number): void {
    // Brief wobble state before spawning next block
    this.readyTimer += dt;
    if (this.readyTimer > 0.3) {
      this.readyTimer = 0;
      this.spawnSwingingBlock();
    }
  }

  // ============================================================================
  // POWER-UP SYSTEM
  // ============================================================================

  private updatePowerUps(dt: number): void {
    // Update floating animation
    this.powerUps.forEach(pu => {
      pu.floatOffset += dt * 3;
    });

    // Update active power-up timers
    this.activePowerUps = this.activePowerUps.filter(p => {
      p.timeLeft -= dt;
      if (p.type === 'slowmo' && p.timeLeft <= 0) {
        this.slowMotionActive = false;
      }
      return p.timeLeft > 0;
    });
  }

  private checkPowerUpCollection(block: Block): void {
    this.powerUps.forEach(pu => {
      if (pu.collected) return;

      const distance = Math.abs(pu.y - block.y);
      if (distance < BLOCK_HEIGHT * 2) {
        pu.collected = true;
        this.activatePowerUp(pu.type);
        this.createPowerUpParticles(pu.x, pu.y, pu.type);
        this.services.audio.playSound('powerup');
      }
    });

    // Clean up collected power-ups
    this.powerUps = this.powerUps.filter(p => !p.collected);
  }

  private activatePowerUp(type: PowerUpType): void {
    switch (type) {
      case 'slowmo':
        this.slowMotionActive = true;
        this.activePowerUps.push({ type: 'slowmo', timeLeft: SLOWMO_DURATION });
        break;
      case 'widen':
        this.activePowerUps.push({ type: 'widen', timeLeft: 999 }); // One-time use
        break;
      case 'perfect':
        this.activePowerUps.push({ type: 'perfect', timeLeft: 999 }); // One-time use
        break;
    }
  }

  // ============================================================================
  // VISUAL EFFECTS
  // ============================================================================

  private createPerfectParticles(x: number, y: number): void {
    // Golden star burst
    for (let i = 0; i < 20; i++) {
      const angle = (Math.PI * 2 * i) / 20;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * (80 + Math.random() * 60),
        vy: Math.sin(angle) * (80 + Math.random() * 60),
        size: 6 + Math.random() * 4,
        color: '#FFD700',
        life: 0.8,
        maxLife: 0.8,
        type: 'star',
        rotation: 0,
        rotationSpeed: (Math.random() - 0.5) * 8
      });
    }

    // Sparkles
    for (let i = 0; i < 15; i++) {
      this.particles.push({
        x: x + (Math.random() - 0.5) * 100,
        y: y + (Math.random() - 0.5) * 30,
        vx: (Math.random() - 0.5) * 100,
        vy: -100 - Math.random() * 100,
        size: 3 + Math.random() * 3,
        color: '#FFFFFF',
        life: 0.6,
        maxLife: 0.6,
        type: 'spark',
        rotation: 0,
        rotationSpeed: 0
      });
    }
  }

  private createLandingParticles(x: number, y: number, color: string): void {
    for (let i = 0; i < 10; i++) {
      this.particles.push({
        x: x + (Math.random() - 0.5) * 80,
        y,
        vx: (Math.random() - 0.5) * 80,
        vy: -50 - Math.random() * 50,
        size: 3 + Math.random() * 3,
        color,
        life: 0.5,
        maxLife: 0.5,
        type: 'dust',
        rotation: 0,
        rotationSpeed: 0
      });
    }
  }

  private createDebrisParticles(x: number, y: number, color: string): void {
    for (let i = 0; i < 8; i++) {
      const side = Math.random() > 0.5 ? 1 : -1;
      this.particles.push({
        x: x + side * 50,
        y,
        vx: side * (50 + Math.random() * 100),
        vy: -50 + Math.random() * 100,
        size: 5 + Math.random() * 8,
        color,
        life: 1.2,
        maxLife: 1.2,
        type: 'confetti',
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 10
      });
    }
  }

  private createPowerUpParticles(x: number, y: number, type: PowerUpType): void {
    const colors: Record<PowerUpType, string> = {
      slowmo: '#00FFFF',
      widen: '#00FF00',
      perfect: '#FFD700'
    };

    for (let i = 0; i < 15; i++) {
      const angle = (Math.PI * 2 * i) / 15;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * 100,
        vy: Math.sin(angle) * 100,
        size: 5,
        color: colors[type],
        life: 0.6,
        maxLife: 0.6,
        type: 'spark',
        rotation: 0,
        rotationSpeed: 0
      });
    }
  }

  private createPerfectEffect(x: number, y: number): void {
    // Rainbow burst for auto-perfect
    const colors = ['#FF0000', '#FF7F00', '#FFFF00', '#00FF00', '#0000FF', '#8B00FF'];
    colors.forEach((color, i) => {
      const angle = (Math.PI * 2 * i) / colors.length;
      for (let j = 0; j < 3; j++) {
        this.particles.push({
          x,
          y,
          vx: Math.cos(angle) * (60 + j * 30),
          vy: Math.sin(angle) * (60 + j * 30),
          size: 6,
          color,
          life: 0.8,
          maxLife: 0.8,
          type: 'star',
          rotation: 0,
          rotationSpeed: 5
        });
      }
    });
  }

  private updateParticles(dt: number): void {
    this.particles = this.particles.filter(p => {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 400 * dt; // Gravity
      p.life -= dt;
      p.rotation += p.rotationSpeed * dt;
      return p.life > 0;
    });
  }

  private updateCamera(dt: number): void {
    // Smooth camera follow
    const cameraDiff = this.targetCameraY - this.cameraY;
    this.cameraY += cameraDiff * 5 * dt;
  }

  private updateBackground(dt: number): void {
    // Update parallax layers based on camera
    this.backgroundLayers.forEach(layer => {
      layer.yOffset = this.cameraY * layer.speed;
    });
  }

  private updateClouds(dt: number): void {
    this.clouds.forEach(cloud => {
      cloud.x -= cloud.speed * dt;
      if (cloud.x + cloud.width < 0) {
        cloud.x = CANVAS_WIDTH + cloud.width;
        cloud.y = 50 + Math.random() * 200;
      }
    });
  }

  private updateStars(dt: number): void {
    this.stars.forEach(star => {
      star.twinkle += dt * 3;
    });
  }

  private updateVisualEffects(dt: number): void {
    // Decay screen shake
    this.screenShake *= 0.9;
    if (this.screenShake < 0.1) this.screenShake = 0;

    // Decay flash
    this.flashAlpha *= 0.95;

    // Decay combo scale
    this.comboScale += (1 - this.comboScale) * 10 * dt;

    // Update sky gradient for time progression
    this.skyGradientOffset = Math.min(1, this.blocksPlaced / 50);
  }

  // ============================================================================
  // RENDERING
  // ============================================================================

  protected onRender(ctx: CanvasRenderingContext2D): void {
    ctx.save();

    // Apply screen shake
    if (this.screenShake > 0) {
      ctx.translate(
        (Math.random() - 0.5) * this.screenShake,
        (Math.random() - 0.5) * this.screenShake
      );
    }

    this.renderSky(ctx);
    this.renderStars(ctx);
    this.renderClouds(ctx);
    this.renderBackground(ctx);
    this.renderGround(ctx);
    this.renderTower(ctx);
    this.renderPowerUps(ctx);
    this.renderSwingingBlock(ctx);
    this.renderDroppingBlock(ctx);
    this.renderParticles(ctx);
    this.renderFlash(ctx);

    ctx.restore();

    this.renderHUD(ctx);

    if (this.gameState === 'gameOver') {
      this.renderGameOver(ctx);
    }
  }

  private renderSky(ctx: CanvasRenderingContext2D): void {
    // Dynamic sky gradient that changes with height
    const gradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);

    // Transition from day to sunset to night as tower grows
    const t = this.skyGradientOffset;
    if (t < 0.5) {
      // Day to sunset
      const u = t * 2;
      gradient.addColorStop(0, this.lerpColor('#87CEEB', '#FF6B6B', u));
      gradient.addColorStop(0.5, this.lerpColor('#E0F6FF', '#FFB347', u));
      gradient.addColorStop(1, this.lerpColor('#B0E0E6', '#FF8C00', u));
    } else {
      // Sunset to night
      const u = (t - 0.5) * 2;
      gradient.addColorStop(0, this.lerpColor('#FF6B6B', '#0a0a2e', u));
      gradient.addColorStop(0.5, this.lerpColor('#FFB347', '#1a1a4e', u));
      gradient.addColorStop(1, this.lerpColor('#FF8C00', '#2a2a5e', u));
    }

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  }

  private lerpColor(color1: string, color2: string, t: number): string {
    const r1 = parseInt(color1.slice(1, 3), 16);
    const g1 = parseInt(color1.slice(3, 5), 16);
    const b1 = parseInt(color1.slice(5, 7), 16);
    const r2 = parseInt(color2.slice(1, 3), 16);
    const g2 = parseInt(color2.slice(3, 5), 16);
    const b2 = parseInt(color2.slice(5, 7), 16);

    const r = Math.round(r1 + (r2 - r1) * t);
    const g = Math.round(g1 + (g2 - g1) * t);
    const b = Math.round(b1 + (b2 - b1) * t);

    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }

  private renderStars(ctx: CanvasRenderingContext2D): void {
    // Only show stars at night (high tower)
    if (this.skyGradientOffset < 0.5) return;

    const starAlpha = (this.skyGradientOffset - 0.5) * 2;
    this.stars.forEach(star => {
      const twinkle = 0.5 + 0.5 * Math.sin(star.twinkle);
      ctx.fillStyle = `rgba(255, 255, 255, ${starAlpha * twinkle})`;
      ctx.beginPath();
      ctx.arc(star.x, star.y - this.cameraY * 0.05, star.size, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  private renderClouds(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    this.clouds.forEach(cloud => {
      const y = cloud.y - this.cameraY * 0.15;
      if (y > -50 && y < CANVAS_HEIGHT + 50) {
        ctx.globalAlpha = cloud.opacity * (1 - this.skyGradientOffset * 0.7);
        this.drawCloud(ctx, cloud.x, y, cloud.width);
        ctx.globalAlpha = 1;
      }
    });
  }

  private drawCloud(ctx: CanvasRenderingContext2D, x: number, y: number, width: number): void {
    const height = width * 0.4;
    ctx.beginPath();
    ctx.arc(x, y, height * 0.5, 0, Math.PI * 2);
    ctx.arc(x + width * 0.25, y - height * 0.2, height * 0.4, 0, Math.PI * 2);
    ctx.arc(x + width * 0.5, y, height * 0.35, 0, Math.PI * 2);
    ctx.arc(x + width * 0.3, y + height * 0.1, height * 0.3, 0, Math.PI * 2);
    ctx.fill();
  }

  private renderBackground(ctx: CanvasRenderingContext2D): void {
    this.backgroundLayers.forEach(layer => {
      layer.buildings.forEach(building => {
        const y = GROUND_Y - building.height + layer.yOffset;

        // Building body
        ctx.fillStyle = building.color;
        ctx.fillRect(building.x, y, building.width, building.height);

        // Windows
        if (building.windows) {
          const windowColor = this.skyGradientOffset > 0.3
            ? `rgba(255, 200, 100, ${0.3 + Math.random() * 0.4})`
            : 'rgba(100, 150, 200, 0.3)';

          const windowSize = 4;
          const windowSpacing = 10;
          for (let wx = building.x + 5; wx < building.x + building.width - 5; wx += windowSpacing) {
            for (let wy = y + 10; wy < GROUND_Y - 10; wy += windowSpacing) {
              if (Math.random() > 0.3) {
                ctx.fillStyle = windowColor;
                ctx.fillRect(wx, wy, windowSize, windowSize);
              }
            }
          }
        }
      });
    });
  }

  private renderGround(ctx: CanvasRenderingContext2D): void {
    const groundY = GROUND_Y + BLOCK_HEIGHT / 2 - this.cameraY;

    // Ground gradient
    const gradient = ctx.createLinearGradient(0, groundY, 0, CANVAS_HEIGHT);
    gradient.addColorStop(0, '#4a5568');
    gradient.addColorStop(0.3, '#2d3748');
    gradient.addColorStop(1, '#1a202c');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, groundY, CANVAS_WIDTH, CANVAS_HEIGHT - groundY);

    // Ground line
    ctx.strokeStyle = '#718096';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(CANVAS_WIDTH, groundY);
    ctx.stroke();
  }

  private renderTower(ctx: CanvasRenderingContext2D): void {
    this.tower.forEach((block, index) => {
      const screenY = block.y - this.cameraY;

      if (screenY > -BLOCK_HEIGHT && screenY < CANVAS_HEIGHT + BLOCK_HEIGHT) {
        ctx.save();
        ctx.translate(block.x, screenY);
        ctx.rotate(block.rotation);

        // Block shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.fillRect(-block.width / 2 + 3, -BLOCK_HEIGHT / 2 + 3, block.width, BLOCK_HEIGHT);

        // Block body with gradient
        const gradient = ctx.createLinearGradient(0, -BLOCK_HEIGHT / 2, 0, BLOCK_HEIGHT / 2);
        gradient.addColorStop(0, this.lightenColor(block.color, 30));
        gradient.addColorStop(0.5, block.color);
        gradient.addColorStop(1, this.darkenColor(block.color, 30));

        ctx.fillStyle = gradient;
        ctx.fillRect(-block.width / 2, -BLOCK_HEIGHT / 2, block.width, BLOCK_HEIGHT);

        // Block highlight
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.fillRect(-block.width / 2, -BLOCK_HEIGHT / 2, block.width, BLOCK_HEIGHT / 3);

        // Perfect indicator
        if (block.isPerfect && index > 0) {
          ctx.strokeStyle = '#FFD700';
          ctx.lineWidth = 2;
          ctx.strokeRect(-block.width / 2, -BLOCK_HEIGHT / 2, block.width, BLOCK_HEIGHT);

          // Sparkle effect
          ctx.fillStyle = '#FFD700';
          const sparkleSize = 4 + Math.sin(this.gameTime * 10) * 2;
          ctx.beginPath();
          ctx.arc(-block.width / 2 - 5, 0, sparkleSize, 0, Math.PI * 2);
          ctx.arc(block.width / 2 + 5, 0, sparkleSize, 0, Math.PI * 2);
          ctx.fill();
        }

        // Block border
        ctx.strokeStyle = this.darkenColor(block.color, 50);
        ctx.lineWidth = 2;
        ctx.strokeRect(-block.width / 2, -BLOCK_HEIGHT / 2, block.width, BLOCK_HEIGHT);

        ctx.restore();
      }
    });
  }

  private renderPowerUps(ctx: CanvasRenderingContext2D): void {
    this.powerUps.forEach(pu => {
      if (pu.collected) return;

      const screenY = pu.y - this.cameraY + Math.sin(pu.floatOffset) * 5;
      const colors: Record<PowerUpType, string> = {
        slowmo: '#00FFFF',
        widen: '#00FF00',
        perfect: '#FFD700'
      };
      const icons: Record<PowerUpType, string> = {
        slowmo: '⏱',
        widen: '↔',
        perfect: '★'
      };

      // Glow
      ctx.shadowColor = colors[pu.type];
      ctx.shadowBlur = 15;

      // Background circle
      ctx.fillStyle = colors[pu.type];
      ctx.globalAlpha = 0.3;
      ctx.beginPath();
      ctx.arc(pu.x, screenY, 20, 0, Math.PI * 2);
      ctx.fill();

      // Icon background
      ctx.globalAlpha = 1;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.beginPath();
      ctx.arc(pu.x, screenY, 15, 0, Math.PI * 2);
      ctx.fill();

      // Border
      ctx.strokeStyle = colors[pu.type];
      ctx.lineWidth = 2;
      ctx.stroke();

      // Icon
      ctx.fillStyle = colors[pu.type];
      ctx.font = 'bold 16px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(icons[pu.type], pu.x, screenY);

      ctx.shadowBlur = 0;
    });
  }

  private renderSwingingBlock(ctx: CanvasRenderingContext2D): void {
    if (!this.swingingBlock || this.gameState !== 'swinging') return;

    const block = this.swingingBlock;
    const lastBlock = this.tower[this.tower.length - 1];
    const y = lastBlock.y - BLOCK_HEIGHT - 100 - this.cameraY;

    // Swing indicator line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(block.x, y + BLOCK_HEIGHT);
    ctx.lineTo(block.x, CANVAS_HEIGHT);
    ctx.stroke();
    ctx.setLineDash([]);

    // Block shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(block.x - block.width / 2 + 5, y + 5, block.width, BLOCK_HEIGHT);

    // Block body
    const color = BLOCK_COLORS[this.blocksPlaced % BLOCK_COLORS.length];
    const gradient = ctx.createLinearGradient(0, y, 0, y + BLOCK_HEIGHT);
    gradient.addColorStop(0, this.lightenColor(color, 30));
    gradient.addColorStop(0.5, color);
    gradient.addColorStop(1, this.darkenColor(color, 30));

    ctx.fillStyle = gradient;
    ctx.fillRect(block.x - block.width / 2, y, block.width, BLOCK_HEIGHT);

    // Highlight
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.fillRect(block.x - block.width / 2, y, block.width, BLOCK_HEIGHT / 3);

    // Border
    ctx.strokeStyle = this.darkenColor(color, 50);
    ctx.lineWidth = 2;
    ctx.strokeRect(block.x - block.width / 2, y, block.width, BLOCK_HEIGHT);

    // Power-up indicators
    const widenActive = this.activePowerUps.some(p => p.type === 'widen');
    const perfectActive = this.activePowerUps.some(p => p.type === 'perfect');

    if (widenActive) {
      ctx.fillStyle = '#00FF00';
      ctx.font = 'bold 12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('WIDE', block.x, y - 10);
    }
    if (perfectActive) {
      ctx.fillStyle = '#FFD700';
      ctx.font = 'bold 12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('AUTO', block.x, y - 25);
    }
  }

  private renderDroppingBlock(ctx: CanvasRenderingContext2D): void {
    if (!this.droppingBlock) return;

    const block = this.droppingBlock;
    const screenY = block.y - this.cameraY;

    // Motion blur effect
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = block.color;
    ctx.fillRect(block.x - block.width / 2, screenY - 20, block.width, 20);
    ctx.globalAlpha = 1;

    // Block
    const gradient = ctx.createLinearGradient(0, screenY, 0, screenY + BLOCK_HEIGHT);
    gradient.addColorStop(0, this.lightenColor(block.color, 30));
    gradient.addColorStop(0.5, block.color);
    gradient.addColorStop(1, this.darkenColor(block.color, 30));

    ctx.fillStyle = gradient;
    ctx.fillRect(block.x - block.width / 2, screenY, block.width, BLOCK_HEIGHT);

    ctx.strokeStyle = this.darkenColor(block.color, 50);
    ctx.lineWidth = 2;
    ctx.strokeRect(block.x - block.width / 2, screenY, block.width, BLOCK_HEIGHT);
  }

  private renderParticles(ctx: CanvasRenderingContext2D): void {
    this.particles.forEach(p => {
      const screenY = p.y - this.cameraY;
      const alpha = p.life / p.maxLife;

      ctx.save();
      ctx.translate(p.x, screenY);
      ctx.rotate(p.rotation);
      ctx.globalAlpha = alpha;

      switch (p.type) {
        case 'star':
          this.drawStar(ctx, 0, 0, p.size, p.color);
          break;
        case 'spark':
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(0, 0, p.size, 0, Math.PI * 2);
          ctx.fill();
          break;
        case 'dust':
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
          break;
        case 'confetti':
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
          break;
      }

      ctx.restore();
    });
  }

  private drawStar(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string): void {
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const angle = (Math.PI * 2 * i) / 5 - Math.PI / 2;
      const outerX = x + Math.cos(angle) * size;
      const outerY = y + Math.sin(angle) * size;
      const innerAngle = angle + Math.PI / 5;
      const innerX = x + Math.cos(innerAngle) * size * 0.4;
      const innerY = y + Math.sin(innerAngle) * size * 0.4;

      if (i === 0) {
        ctx.moveTo(outerX, outerY);
      } else {
        ctx.lineTo(outerX, outerY);
      }
      ctx.lineTo(innerX, innerY);
    }
    ctx.closePath();
    ctx.fill();
  }

  private renderFlash(ctx: CanvasRenderingContext2D): void {
    if (this.flashAlpha > 0.01) {
      ctx.fillStyle = `rgba(255, 215, 0, ${this.flashAlpha})`;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    }
  }

  private renderHUD(ctx: CanvasRenderingContext2D): void {
    // Top bar background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, CANVAS_WIDTH, 50);

    // Height display
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`Height: ${this.height}`, 15, 32);

    // Score display
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.fillText(`Score: ${this.score}`, CANVAS_WIDTH / 2, 32);

    // Combo display
    if (this.perfectStreak >= 2) {
      ctx.save();
      ctx.translate(CANVAS_WIDTH - 80, 25);
      ctx.scale(this.comboScale, this.comboScale);

      ctx.fillStyle = '#FF6B6B';
      ctx.font = 'bold 18px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(`x${this.perfectStreak} COMBO!`, 0, 0);
      ctx.restore();
    }

    // Active power-ups display
    let powerUpX = 15;
    const powerUpY = 65;
    this.activePowerUps.forEach(pu => {
      if (pu.type === 'slowmo') {
        ctx.fillStyle = 'rgba(0, 255, 255, 0.3)';
        ctx.fillRect(powerUpX - 5, powerUpY - 15, 80, 25);
        ctx.fillStyle = '#00FFFF';
        ctx.font = '14px Arial';
        ctx.textAlign = 'left';
        ctx.fillText(`⏱ ${pu.timeLeft.toFixed(1)}s`, powerUpX, powerUpY);
        powerUpX += 90;
      }
    });

    // Slow motion indicator
    if (this.slowMotionActive) {
      ctx.fillStyle = 'rgba(0, 255, 255, 0.2)';
      ctx.fillRect(0, 50, CANVAS_WIDTH, 5);
    }

    // Instructions (only at start)
    if (this.gameState === 'swinging' && this.blocksPlaced === 0) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.font = '18px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('Tap or Press SPACE to drop!', CANVAS_WIDTH / 2, CANVAS_HEIGHT - 100);
    }
  }

  private renderGameOver(ctx: CanvasRenderingContext2D): void {
    // Fade overlay
    const alpha = Math.min(0.8, this.gameOverTimer * 2);
    ctx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    if (this.gameOverTimer < 0.5) return;

    const slideIn = Math.min(1, (this.gameOverTimer - 0.5) * 3);

    ctx.save();
    ctx.translate(0, (1 - slideIn) * -50);
    ctx.globalAlpha = slideIn;

    // Game Over title
    ctx.fillStyle = '#FF6B6B';
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('GAME OVER', CANVAS_WIDTH / 2, 180);

    // Stats panel
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.fillRect(CANVAS_WIDTH / 2 - 150, 220, 300, 200);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '24px Arial';
    ctx.fillText(`Final Height: ${this.height}`, CANVAS_WIDTH / 2, 270);
    ctx.fillText(`Score: ${this.score}`, CANVAS_WIDTH / 2, 310);
    ctx.fillText(`Best Combo: ${this.maxPerfectStreak}x`, CANVAS_WIDTH / 2, 350);

    ctx.fillStyle = '#FFD700';
    ctx.fillText(`Coins: +${this.pickups}`, CANVAS_WIDTH / 2, 390);

    // Restart prompt
    if (this.gameOverTimer > 1) {
      ctx.fillStyle = '#AAAAAA';
      ctx.font = '18px Arial';
      ctx.fillText('Tap or Press SPACE to play again', CANVAS_WIDTH / 2, 480);
    }

    ctx.restore();
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  private lightenColor(color: string, amount: number): string {
    const r = Math.min(255, parseInt(color.slice(1, 3), 16) + amount);
    const g = Math.min(255, parseInt(color.slice(3, 5), 16) + amount);
    const b = Math.min(255, parseInt(color.slice(5, 7), 16) + amount);
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }

  private darkenColor(color: string, amount: number): string {
    const r = Math.max(0, parseInt(color.slice(1, 3), 16) - amount);
    const g = Math.max(0, parseInt(color.slice(3, 5), 16) - amount);
    const b = Math.max(0, parseInt(color.slice(5, 7), 16) - amount);
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }

  // ============================================================================
  // LIFECYCLE
  // ============================================================================

  protected onRestart(): void {
    this.startNewGame();
  }

  protected onPause(): void {
    // Pause logic if needed
  }

  protected onResume(): void {
    // Resume logic if needed
  }
}
