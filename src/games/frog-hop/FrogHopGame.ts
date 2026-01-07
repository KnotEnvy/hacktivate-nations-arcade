// ===== src/games/frog-hop/FrogHopGame.ts =====
import { BaseGame } from '@/games/shared/BaseGame';
import { GameManifest } from '@/lib/types';

// ============================================
// TYPES & INTERFACES
// ============================================

type GameState = 'playing' | 'dying' | 'respawning' | 'roundComplete' | 'gameOver';
type Direction = 'up' | 'down' | 'left' | 'right';
type VehicleType = 'car' | 'truck' | 'bus' | 'motorcycle';
type PowerUpType = 'coin' | 'timeExtend' | 'shield' | 'speedBoost';

interface Frog {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  direction: Direction;
  isMoving: boolean;
  moveProgress: number;
  hasShield: boolean;
  shieldTimer: number;
  hasSpeedBoost: boolean;
  speedBoostTimer: number;
  isInvincible: boolean;
  invincibleTimer: number;
  hopSquash: number;
  hopHeight: number;  // Vertical offset during hop arc
  idleTimer: number;
}

interface Vehicle {
  x: number;
  y: number;
  width: number;
  height: number;
  speed: number;
  direction: 1 | -1;
  type: VehicleType;
  color: string;
  lane: number;
}

interface Log {
  x: number;
  y: number;
  width: number;
  speed: number;
  direction: 1 | -1;
  lane: number;
}

interface Turtle {
  x: number;
  y: number;
  count: 1 | 2 | 3;
  speed: number;
  direction: 1 | -1;
  lane: number;
  submergeTimer: number;
  submergePhase: number;
  isSubmerged: boolean;
  canSubmerge: boolean; // Some turtles are stable and never submerge
}

interface Crocodile {
  x: number;
  y: number;
  width: number;
  speed: number;
  direction: 1 | -1;
  lane: number;
  mouthOpen: boolean;
  mouthTimer: number;
}

interface LilyPad {
  x: number;
  y: number;
  filled: boolean;
  hasFly: boolean;
  flyTimer: number;
  pulsePhase: number;
}

interface PowerUp {
  x: number;
  y: number;
  type: PowerUpType;
  lane: number;
  lifetime: number;
  pulsePhase: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  lifetime: number;
  maxLifetime: number;
  color: string;
  size: number;
  type: 'splash' | 'explosion' | 'sparkle' | 'leaf' | 'ripple';
}

// Visual enhancement types
interface Cloud {
  x: number;
  y: number;
  width: number;
  height: number;
  speed: number;
  opacity: number;
  layer: number; // 0 = far, 1 = mid, 2 = near
}

interface Tree {
  x: number;
  type: 'pine' | 'oak' | 'bush';
  scale: number;
  layer: number;
}

// Gameplay enhancement types
interface ScorePopup {
  x: number;
  y: number;
  text: string;
  color: string;
  lifetime: number;
  maxLifetime: number;
  scale: number;
}

interface LadyFrog {
  x: number;
  y: number;
  logIndex: number;
  lifetime: number;
  rescued: boolean;
  bobPhase: number;
}

// ============================================
// CONSTANTS
// ============================================

const GRID_SIZE = 40;
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;

const COLORS = {
  // Environment
  grass: '#228B22',
  grassLight: '#32CD32',
  grassDark: '#1B5E1B',
  road: '#333333',
  roadLine: '#FFD700',
  roadLineWhite: '#FFFFFF',
  water: '#1E90FF',
  waterDark: '#0066CC',
  waterLight: '#87CEEB',
  median: '#666666',

  // Frog
  frogBody: '#32CD32',
  frogBelly: '#90EE90',
  frogEye: '#FFFFFF',
  frogPupil: '#000000',
  frogSpots: '#228B22',

  // Vehicles
  carColors: ['#E53935', '#1E88E5', '#FDD835', '#8E24AA', '#00ACC1', '#FF7043'],
  truckBody: '#795548',
  truckCargo: '#5D4037',
  busBody: '#FF9800',
  busWindow: '#81D4FA',
  motorcycleBody: '#212121',

  // Platforms
  logMain: '#8B4513',
  logHighlight: '#A0522D',
  logDark: '#5D4037',
  turtleShell: '#556B2F',
  turtleBody: '#6B8E23',
  turtleHighlight: '#8FBC8F',
  crocBody: '#2E7D32',
  crocBelly: '#A5D6A7',
  crocTeeth: '#FFFFFF',
  crocEye: '#FFEB3B',

  // UI
  timerFull: '#4CAF50',
  timerMid: '#FFC107',
  timerLow: '#F44336',
  lilyPad: '#228B22',
  lilyPadHighlight: '#4CAF50',
  fly: '#2C2C2C',
  flyWing: '#87CEEB',

  // Power-ups
  coinGold: '#FFD700',
  coinHighlight: '#FFF59D',
  shieldBlue: '#2196F3',
  shieldGlow: '#64B5F6',
  timeGreen: '#4CAF50',
  speedOrange: '#FF9800',
};

const LANE_CONFIG = {
  startZone: { y: 560, height: 40, type: 'safe' },
  roadLanes: [
    { y: 520, direction: 1, baseSpeed: 60, vehicleType: 'truck' as VehicleType },
    { y: 480, direction: -1, baseSpeed: 100, vehicleType: 'motorcycle' as VehicleType },
    { y: 440, direction: 1, baseSpeed: 50, vehicleType: 'bus' as VehicleType },
    { y: 400, direction: -1, baseSpeed: 80, vehicleType: 'car' as VehicleType },
  ],
  medianZone: { y: 360, height: 40, type: 'safe' },
  riverLanes: [
    { y: 320, direction: 1, baseSpeed: 45, platformType: 'log' },
    { y: 280, direction: -1, baseSpeed: 50, platformType: 'turtle' },
    { y: 240, direction: 1, baseSpeed: 70, platformType: 'log' },  // Fast log lane - reduces waiting
    { y: 200, direction: -1, baseSpeed: 45, platformType: 'turtle' },
    { y: 160, direction: 1, baseSpeed: 50, platformType: 'log' },
  ],
  goalZone: { y: 100, height: 60, type: 'goal' },
};

// ============================================
// MAIN GAME CLASS
// ============================================

export class FrogHopGame extends BaseGame {
  manifest: GameManifest = {
    id: 'frog-hop',
    title: 'Frog Hop',
    thumbnail: '/games/frog-hop/frog-hop-thumb.svg',
    inputSchema: ['keyboard', 'touch'],
    assetBudgetKB: 120,
    tier: 2,
    description: 'Guide your frog across busy roads and treacherous rivers!',
  };

  // Game state
  private gameState: GameState = 'playing';
  private round: number = 1;
  private lives: number = 3;
  private timer: number = 30000; // 30 seconds in ms
  private maxTimer: number = 30000;

  // Entities
  private frog!: Frog;
  private vehicles: Vehicle[] = [];
  private logs: Log[] = [];
  private turtles: Turtle[] = [];
  private crocodiles: Crocodile[] = [];
  private lilyPads: LilyPad[] = [];
  private powerUps: PowerUp[] = [];
  private particles: Particle[] = [];

  // Input state
  private inputCooldown: number = 0;
  private lastInputTime: number = 0;
  private keysPressed: Set<string> = new Set();
  private touchStart: { x: number; y: number } | null = null;

  // Visual effects
  private waterOffset: number = 0;
  private screenShake: number = 0;
  private flashTimer: number = 0;

  // Round celebration
  private celebrationTimer: number = 0;
  private celebrationPhase: number = 0;
  private dancingFrogY: number = 0;

  // Parallax background
  private clouds: Cloud[] = [];
  private trees: Tree[] = [];

  // Gameplay enhancements
  private scorePopups: ScorePopup[] = [];
  private ladyFrog: LadyFrog | null = null;
  private comboCount: number = 0;
  private comboTimer: number = 0;
  private lastNearMissTime: number = 0;
  private nearMissCombo: number = 0;

  // Stats for achievements
  private frogsRescued: number = 0;
  private coinsCollected: number = 0;
  private powerupsUsed: number = 0;
  private perfectRounds: number = 0;
  private deathsThisRound: number = 0;
  private closeCallCount: number = 0;
  private maxRoundReached: number = 1;

  // ==========================================
  // LIFECYCLE METHODS
  // ==========================================

  protected onInit(): void {
    this.renderBaseHud = false; // Custom HUD
    this.setupInputHandlers();
    this.initializeParallaxBackground();
    this.initializeRound();
  }

  private initializeParallaxBackground(): void {
    // Create clouds at different layers
    this.clouds = [];
    for (let layer = 0; layer < 3; layer++) {
      const cloudCount = 3 + layer * 2;
      for (let i = 0; i < cloudCount; i++) {
        this.clouds.push({
          x: Math.random() * (CANVAS_WIDTH + 200) - 100,
          y: 10 + Math.random() * 60 + layer * 15,
          width: 60 + Math.random() * 80 - layer * 15,
          height: 25 + Math.random() * 20 - layer * 5,
          speed: 8 + layer * 6 + Math.random() * 5,
          opacity: 0.3 + layer * 0.2,
          layer,
        });
      }
    }

    // Create trees along the top grass area
    this.trees = [];
    const treePositions = [30, 90, 180, 280, 380, 500, 600, 700, 770];
    for (const x of treePositions) {
      const rand = Math.random();
      let type: 'pine' | 'oak' | 'bush';
      if (rand < 0.4) type = 'pine';
      else if (rand < 0.7) type = 'oak';
      else type = 'bush';

      this.trees.push({
        x,
        type,
        scale: 0.6 + Math.random() * 0.5,
        layer: Math.random() < 0.5 ? 0 : 1,
      });
    }
    // Sort trees by layer for proper rendering order
    this.trees.sort((a, b) => a.layer - b.layer);
  }

  protected onUpdate(dt: number): void {
    // dt is already in seconds - clamp to prevent huge jumps
    dt = Math.min(dt, 0.033);
    const dtMs = dt * 1000; // For millisecond-based timers

    // Update visual effects
    this.waterOffset += dt * 50;
    if (this.screenShake > 0) this.screenShake -= dt * 10;
    if (this.flashTimer > 0) this.flashTimer -= dtMs;

    // Update parallax clouds
    for (const cloud of this.clouds) {
      cloud.x += cloud.speed * dt;
      if (cloud.x > CANVAS_WIDTH + 100) {
        cloud.x = -cloud.width - 50;
        cloud.y = 10 + Math.random() * 60 + cloud.layer * 15;
      }
    }

    // Update input cooldown
    if (this.inputCooldown > 0) this.inputCooldown -= dtMs;

    switch (this.gameState) {
      case 'playing':
        this.updatePlaying(dt, dtMs);
        break;
      case 'dying':
        this.updateDying();
        break;
      case 'respawning':
        this.updateRespawning();
        break;
      case 'roundComplete':
        this.updateRoundComplete();
        this.updateCelebration(dt);
        break;
      case 'gameOver':
        // Wait for restart
        break;
    }

    // Always update particles
    this.updateParticles(dt);
  }

  protected onRender(ctx: CanvasRenderingContext2D): void {
    // Apply screen shake
    ctx.save();
    if (this.screenShake > 0) {
      const shakeX = (Math.random() - 0.5) * this.screenShake * 2;
      const shakeY = (Math.random() - 0.5) * this.screenShake * 2;
      ctx.translate(shakeX, shakeY);
    }

    // Render layers
    this.renderBackground(ctx);
    this.renderWater(ctx);
    this.renderRoad(ctx);
    this.renderMedian(ctx);
    this.renderGoalZone(ctx);
    this.renderLilyPads(ctx);
    this.renderLogs(ctx);
    this.renderTurtles(ctx);
    this.renderCrocodiles(ctx);
    this.renderLadyFrog(ctx);
    this.renderVehicles(ctx);
    this.renderPowerUps(ctx);
    this.renderFrog(ctx);
    this.renderParticles(ctx);
    this.renderScorePopups(ctx);

    ctx.restore();

    // Render UI (not affected by screen shake)
    this.renderHUD(ctx);

    // Flash effect
    if (this.flashTimer > 0) {
      ctx.fillStyle = `rgba(255, 255, 255, ${this.flashTimer / 200})`;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    }

    // Round celebration overlay
    if (this.gameState === 'roundComplete' && this.celebrationTimer > 0) {
      this.renderCelebration(ctx);
    }

    // Game over overlay
    if (this.gameState === 'gameOver') {
      this.renderGameOver(ctx);
    }
  }

  protected onRestart(): void {
    this.gameState = 'playing';
    this.round = 1;
    this.lives = 3;
    this.frogsRescued = 0;
    this.coinsCollected = 0;
    this.powerupsUsed = 0;
    this.perfectRounds = 0;
    this.maxRoundReached = 1;
    this.deathsThisRound = 0;
    this.initializeRound();
  }

  protected onGameEnd(): void {
    this.extendedGameData = {
      roundsCompleted: this.round - 1,
      frogsRescued: this.frogsRescued,
      coinsCollected: this.coinsCollected,
      powerupsUsed: this.powerupsUsed,
      perfectRounds: this.perfectRounds,
      closeCallCount: this.closeCallCount,
      maxRound: this.maxRoundReached,
    };

    // Track achievements
    this.services?.analytics?.trackGameSpecificStat?.('frog-hop', 'rounds_completed', this.round - 1);
    this.services?.analytics?.trackGameSpecificStat?.('frog-hop', 'frogs_rescued', this.frogsRescued);
    this.services?.analytics?.trackGameSpecificStat?.('frog-hop', 'max_round', this.maxRoundReached);
  }

  // ==========================================
  // INPUT HANDLING
  // ==========================================

  private setupInputHandlers(): void {
    // Keyboard
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);

    // Touch
    this.canvas.addEventListener('touchstart', this.handleTouchStart);
    this.canvas.addEventListener('touchend', this.handleTouchEnd);
  }

  private handleKeyDown = (e: KeyboardEvent): void => {
    this.keysPressed.add(e.key.toLowerCase());

    const now = Date.now();
    if (now - this.lastInputTime < 100) return; // Debounce

    if (this.gameState === 'playing' && this.inputCooldown <= 0 && !this.frog.isMoving) {
      let moved = false;

      if (e.key === 'ArrowUp' || e.key.toLowerCase() === 'w') {
        this.moveFrog('up');
        moved = true;
      } else if (e.key === 'ArrowDown' || e.key.toLowerCase() === 's') {
        this.moveFrog('down');
        moved = true;
      } else if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'a') {
        this.moveFrog('left');
        moved = true;
      } else if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'd') {
        this.moveFrog('right');
        moved = true;
      }

      if (moved) {
        this.lastInputTime = now;
        this.inputCooldown = 80;
      }
    }

    if (this.gameState === 'gameOver' && (e.key === 'Enter' || e.key === ' ')) {
      this.restart();
    }
  };

  private handleKeyUp = (e: KeyboardEvent): void => {
    this.keysPressed.delete(e.key.toLowerCase());
  };

  private handleTouchStart = (e: TouchEvent): void => {
    e.preventDefault();
    const touch = e.touches[0];
    const rect = this.canvas.getBoundingClientRect();
    this.touchStart = {
      x: touch.clientX - rect.left,
      y: touch.clientY - rect.top,
    };
  };

  private handleTouchEnd = (e: TouchEvent): void => {
    e.preventDefault();
    if (!this.touchStart) return;

    const touch = e.changedTouches[0];
    const rect = this.canvas.getBoundingClientRect();
    const endX = touch.clientX - rect.left;
    const endY = touch.clientY - rect.top;

    const dx = endX - this.touchStart.x;
    const dy = endY - this.touchStart.y;
    const threshold = 30;

    if (this.gameState === 'playing' && !this.frog.isMoving) {
      if (Math.abs(dx) > Math.abs(dy)) {
        if (dx > threshold) this.moveFrog('right');
        else if (dx < -threshold) this.moveFrog('left');
      } else {
        if (dy < -threshold) this.moveFrog('up');
        else if (dy > threshold) this.moveFrog('down');
      }
    }

    if (this.gameState === 'gameOver') {
      this.restart();
    }

    this.touchStart = null;
  };

  // ==========================================
  // GAME LOGIC
  // ==========================================

  private initializeRound(): void {
    // Reset frog to start position
    this.frog = {
      x: CANVAS_WIDTH / 2 - GRID_SIZE / 2,
      y: LANE_CONFIG.startZone.y,
      targetX: CANVAS_WIDTH / 2 - GRID_SIZE / 2,
      targetY: LANE_CONFIG.startZone.y,
      direction: 'up',
      isMoving: false,
      moveProgress: 0,
      hasShield: false,
      shieldTimer: 0,
      hasSpeedBoost: false,
      speedBoostTimer: 0,
      isInvincible: false,
      invincibleTimer: 0,
      hopSquash: 0,
      hopHeight: 0,
      idleTimer: 0,
    };

    // Reset timer
    this.timer = this.maxTimer;
    this.deathsThisRound = 0;

    // Initialize lily pads
    this.lilyPads = [];
    const lilyPadPositions = [80, 200, 320, 480, 640];
    for (const xPos of lilyPadPositions) {
      this.lilyPads.push({
        x: xPos,
        y: LANE_CONFIG.goalZone.y + 10,
        filled: false,
        hasFly: Math.random() < 0.3,
        flyTimer: 0,
        pulsePhase: Math.random() * Math.PI * 2,
      });
    }

    // Spawn vehicles
    this.spawnVehicles();

    // Spawn river platforms
    this.spawnRiverPlatforms();

    // Clear power-ups
    this.powerUps = [];

    // Spawn initial power-ups
    this.spawnPowerUp();
  }

  private spawnVehicles(): void {
    this.vehicles = [];
    const speedMultiplier = 1 + (this.round - 1) * 0.12;

    // Frogger-style difficulty progression per lane
    // Round 1: Very easy - 1 slow vehicle per lane
    // Round 2: One lane gets 2 faster vehicles
    // Round 3+: Gradually add more vehicles and speed

    for (const lane of LANE_CONFIG.roadLanes) {
      const laneIndex = LANE_CONFIG.roadLanes.indexOf(lane);

      // Calculate vehicles per lane based on round
      let vehicleCount: number;
      let laneSpeedBonus = 1;

      if (this.round === 1) {
        // Round 1: Just 1 vehicle per lane, nice and easy
        vehicleCount = 1;
      } else if (this.round === 2) {
        // Round 2: Motorcycle lane (index 1) gets 2 fast vehicles, others stay at 1
        if (laneIndex === 1) {
          vehicleCount = 2;
          laneSpeedBonus = 1.3; // Faster motorcycles
        } else {
          vehicleCount = 1;
        }
      } else if (this.round === 3) {
        // Round 3: Most lanes get 2 vehicles
        vehicleCount = laneIndex === 2 ? 1 : 2; // Bus lane stays at 1
      } else if (this.round <= 5) {
        // Rounds 4-5: 2 vehicles per lane
        vehicleCount = 2;
      } else {
        // Round 6+: 2-3 vehicles, increasing
        vehicleCount = 2 + Math.floor((this.round - 5) / 2);
      }

      const spacing = CANVAS_WIDTH / Math.max(vehicleCount, 1);

      for (let i = 0; i < vehicleCount; i++) {
        const type = lane.vehicleType;
        let width = 60;
        let height = 30;

        switch (type) {
          case 'car':
            width = 50 + Math.random() * 20;
            break;
          case 'truck':
            width = 90 + Math.random() * 20;
            break;
          case 'bus':
            width = 100 + Math.random() * 20;
            break;
          case 'motorcycle':
            width = 35;
            height = 25;
            break;
        }

        this.vehicles.push({
          x: i * spacing + Math.random() * (spacing / 2),
          y: lane.y,
          width,
          height,
          speed: lane.baseSpeed * speedMultiplier * laneSpeedBonus * (0.85 + Math.random() * 0.3),
          direction: lane.direction as 1 | -1,
          type,
          color: COLORS.carColors[Math.floor(Math.random() * COLORS.carColors.length)],
          lane: laneIndex,
        });
      }
    }
  }

  private spawnRiverPlatforms(): void {
    this.logs = [];
    this.turtles = [];
    this.crocodiles = [];

    const speedMultiplier = 1 + (this.round - 1) * 0.08;

    for (const lane of LANE_CONFIG.riverLanes) {
      const laneIndex = LANE_CONFIG.riverLanes.indexOf(lane);

      if (lane.platformType === 'log') {
        // Add logs
        const logCount = 2 + Math.floor(Math.random() * 2);
        const spacing = CANVAS_WIDTH / logCount;

        for (let i = 0; i < logCount; i++) {
          const width = 80 + Math.random() * 60;
          this.logs.push({
            x: i * spacing + Math.random() * (spacing / 3),
            y: lane.y,
            width,
            speed: lane.baseSpeed * speedMultiplier,
            direction: lane.direction as 1 | -1,
            lane: laneIndex,
          });
        }

        // Maybe add a crocodile in later rounds
        if (this.round >= 3 && Math.random() < 0.3 + (this.round - 3) * 0.1) {
          this.crocodiles.push({
            x: Math.random() * CANVAS_WIDTH,
            y: lane.y,
            width: 100,
            speed: lane.baseSpeed * speedMultiplier * 0.9,
            direction: lane.direction as 1 | -1,
            lane: laneIndex,
            mouthOpen: false,
            mouthTimer: Math.random() * 3000,
          });
        }
      } else {
        // Add turtles
        const turtleGroupCount = 3;
        const spacing = CANVAS_WIDTH / turtleGroupCount;

        for (let i = 0; i < turtleGroupCount; i++) {
          // First turtle in each lane is stable (never submerges) for easier gameplay
          // In later rounds, fewer stable turtles
          const isStable = i === 0 || (i === 1 && this.round < 3);

          this.turtles.push({
            x: i * spacing + Math.random() * (spacing / 3),
            y: lane.y,
            count: (Math.floor(Math.random() * 3) + 1) as 1 | 2 | 3,
            speed: lane.baseSpeed * speedMultiplier,
            direction: lane.direction as 1 | -1,
            lane: laneIndex,
            // Stagger timers so they don't all submerge at once
            submergeTimer: 3000 + i * 2000 + Math.random() * 2000,
            submergePhase: 0,
            isSubmerged: false,
            canSubmerge: !isStable,
          });
        }
      }
    }
  }

  private spawnPowerUp(): void {
    if (this.powerUps.length >= 3) return;

    // Random lane (road or river)
    const isRiver = Math.random() < 0.5;
    const lanes = isRiver ? LANE_CONFIG.riverLanes : LANE_CONFIG.roadLanes;
    const laneIndex = Math.floor(Math.random() * lanes.length);
    const lane = lanes[laneIndex];

    // Random type with weights
    const rand = Math.random();
    let type: PowerUpType;
    if (rand < 0.5) type = 'coin';
    else if (rand < 0.75) type = 'timeExtend';
    else if (rand < 0.9) type = 'shield';
    else type = 'speedBoost';

    this.powerUps.push({
      x: Math.random() * (CANVAS_WIDTH - 40) + 20,
      y: lane.y + 5,
      type,
      lane: laneIndex,
      lifetime: 10000,
      pulsePhase: Math.random() * Math.PI * 2,
    });
  }

  private moveFrog(direction: Direction): void {
    if (this.frog.isMoving) return;

    let newX = this.frog.x;
    let newY = this.frog.y;

    switch (direction) {
      case 'up':
        newY -= GRID_SIZE;
        break;
      case 'down':
        newY += GRID_SIZE;
        break;
      case 'left':
        newX -= GRID_SIZE;
        break;
      case 'right':
        newX += GRID_SIZE;
        break;
    }

    // Bounds checking
    if (newX < 0 || newX > CANVAS_WIDTH - GRID_SIZE) return;
    if (newY < LANE_CONFIG.goalZone.y || newY > LANE_CONFIG.startZone.y) return;

    this.frog.targetX = newX;
    this.frog.targetY = newY;
    this.frog.direction = direction;
    this.frog.isMoving = true;
    this.frog.moveProgress = 0;
    this.frog.hopSquash = 1;

    this.services?.audio?.playSound?.('jump');
  }

  private updatePlaying(dt: number, dtMs: number): void {
    // Update timer (timer is in milliseconds)
    this.timer -= dtMs;
    if (this.timer <= 0) {
      this.killFrog('timeout');
      return;
    }

    // Update frog movement
    this.updateFrogMovement(dt);

    // Update frog timers (in milliseconds)
    if (this.frog.hasShield) {
      this.frog.shieldTimer -= dtMs;
      if (this.frog.shieldTimer <= 0) this.frog.hasShield = false;
    }
    if (this.frog.hasSpeedBoost) {
      this.frog.speedBoostTimer -= dtMs;
      if (this.frog.speedBoostTimer <= 0) this.frog.hasSpeedBoost = false;
    }
    if (this.frog.isInvincible) {
      this.frog.invincibleTimer -= dtMs;
      if (this.frog.invincibleTimer <= 0) this.frog.isInvincible = false;
    }

    // Update idle animation
    if (!this.frog.isMoving) {
      this.frog.idleTimer += dt;
    }

    // Update vehicles
    this.updateVehicles(dt);

    // Update river platforms
    this.updateRiverPlatforms(dt);

    // Update power-ups
    this.updatePowerUps(dt, dtMs);

    // Update lily pads
    for (const pad of this.lilyPads) {
      pad.pulsePhase += dt * 2;
      if (pad.hasFly) {
        pad.flyTimer += dt;
      }
    }

    // Update gameplay enhancements
    this.updateScorePopups(dt);
    this.updateCombo(dtMs);
    this.updateLadyFrog(dt, dtMs);

    // Check collisions
    if (!this.frog.isMoving) {
      this.checkCollisions();
    }

    // Spawn power-ups occasionally
    if (Math.random() < 0.001) {
      this.spawnPowerUp();
    }

    // Try to spawn lady frog occasionally
    if (Math.random() < 0.0005) {
      this.trySpawnLadyFrog();
    }
  }

  private updateFrogMovement(dt: number): void {
    if (!this.frog.isMoving) return;

    const moveSpeed = this.frog.hasSpeedBoost ? 12 : 8;
    this.frog.moveProgress += dt * moveSpeed;

    // Hop squash animation
    if (this.frog.moveProgress < 0.5) {
      this.frog.hopSquash = 1 + Math.sin(this.frog.moveProgress * Math.PI) * 0.3;
    } else {
      this.frog.hopSquash = 1 - Math.sin((this.frog.moveProgress - 0.5) * Math.PI) * 0.15;
    }

    // Hop height arc (peaks in middle of jump)
    this.frog.hopHeight = Math.sin(this.frog.moveProgress * Math.PI) * 15;

    if (this.frog.moveProgress >= 1) {
      this.frog.x = this.frog.targetX;
      this.frog.y = this.frog.targetY;
      this.frog.isMoving = false;
      this.frog.moveProgress = 0;
      this.frog.hopSquash = 1;
      this.frog.hopHeight = 0;

      // Spawn landing particles based on landing zone
      const landingY = this.frog.y + GRID_SIZE / 2;
      const landingX = this.frog.x + GRID_SIZE / 2;

      // Check if in water zone (river lanes area)
      const riverTopY = LANE_CONFIG.riverLanes[LANE_CONFIG.riverLanes.length - 1].y;
      const riverBottomY = LANE_CONFIG.riverLanes[0].y + GRID_SIZE;
      if (landingY >= riverTopY && landingY < riverBottomY) {
        // Water - spawn ripple
        this.spawnRipple(landingX, landingY);
      } else if (landingY < LANE_CONFIG.goalZone.y + GRID_SIZE) {
        // Goal zone - small dust puff
        this.spawnDust(landingX, landingY, 3);
      } else {
        // Road or start zone - spawn dust
        this.spawnDust(landingX, landingY, 5);
      }
    } else {
      const startX = this.frog.targetX - (this.frog.direction === 'right' ? GRID_SIZE : this.frog.direction === 'left' ? -GRID_SIZE : 0);
      const startY = this.frog.targetY - (this.frog.direction === 'down' ? GRID_SIZE : this.frog.direction === 'up' ? -GRID_SIZE : 0);

      this.frog.x = startX + (this.frog.targetX - startX) * this.frog.moveProgress;
      this.frog.y = startY + (this.frog.targetY - startY) * this.frog.moveProgress;
    }
  }

  private updateVehicles(dt: number): void {
    for (const vehicle of this.vehicles) {
      vehicle.x += vehicle.speed * vehicle.direction * dt;

      // Wrap around
      if (vehicle.direction === 1 && vehicle.x > CANVAS_WIDTH) {
        vehicle.x = -vehicle.width;
      } else if (vehicle.direction === -1 && vehicle.x < -vehicle.width) {
        vehicle.x = CANVAS_WIDTH;
      }
    }
  }

  private updateRiverPlatforms(dt: number): void {
    const dtMs = dt * 1000; // For millisecond-based timers

    // Update logs
    for (const log of this.logs) {
      log.x += log.speed * log.direction * dt;

      if (log.direction === 1 && log.x > CANVAS_WIDTH) {
        log.x = -log.width;
      } else if (log.direction === -1 && log.x < -log.width) {
        log.x = CANVAS_WIDTH;
      }
    }

    // Update turtles
    const submergeSpeed = 1 + (this.round - 1) * 0.15;
    for (const turtle of this.turtles) {
      turtle.x += turtle.speed * turtle.direction * dt;

      const turtleWidth = turtle.count * 35;
      if (turtle.direction === 1 && turtle.x > CANVAS_WIDTH) {
        turtle.x = -turtleWidth;
      } else if (turtle.direction === -1 && turtle.x < -turtleWidth) {
        turtle.x = CANVAS_WIDTH;
      }

      // Submerge logic (timers are in milliseconds) - only for turtles that can submerge
      if (turtle.canSubmerge) {
        turtle.submergeTimer -= dtMs * submergeSpeed;
        if (turtle.submergeTimer <= 0) {
          if (!turtle.isSubmerged) {
            turtle.isSubmerged = true;
            turtle.submergeTimer = 1500 / submergeSpeed;
          } else {
            turtle.isSubmerged = false;
            turtle.submergeTimer = (3000 + Math.random() * 2000) / submergeSpeed;
          }
        }

        // Submerge animation phase
        if (turtle.submergeTimer < 500 && !turtle.isSubmerged) {
          turtle.submergePhase = 1 - turtle.submergeTimer / 500;
        } else if (turtle.isSubmerged && turtle.submergeTimer > turtle.submergeTimer - 500) {
          turtle.submergePhase = 1;
        } else {
          turtle.submergePhase = turtle.isSubmerged ? 1 : 0;
        }
      } else {
        // Stable turtles never submerge
        turtle.submergePhase = 0;
        turtle.isSubmerged = false;
      }
    }

    // Update crocodiles
    for (const croc of this.crocodiles) {
      croc.x += croc.speed * croc.direction * dt;

      if (croc.direction === 1 && croc.x > CANVAS_WIDTH) {
        croc.x = -croc.width;
      } else if (croc.direction === -1 && croc.x < -croc.width) {
        croc.x = CANVAS_WIDTH;
      }

      // Mouth animation (timer is in milliseconds)
      croc.mouthTimer -= dtMs;
      if (croc.mouthTimer <= 0) {
        croc.mouthOpen = !croc.mouthOpen;
        croc.mouthTimer = croc.mouthOpen ? 800 : 2000 + Math.random() * 1500;
      }
    }

    // If frog is on river lane and not moving, ride the platform
    if (!this.frog.isMoving) {
      const frogLane = this.getFrogLane();
      if (frogLane?.type === 'river') {
        const platform = this.getFrogPlatform();
        if (platform) {
          const speed = 'width' in platform && typeof platform.width === 'number' && platform.width > 50
            ? (platform as Log | Crocodile).speed
            : (platform as Turtle).speed;
          const direction = 'direction' in platform ? platform.direction : 1;
          this.frog.x += speed * direction * dt;
          this.frog.targetX = this.frog.x;

          // Check if frog went off screen
          if (this.frog.x < -GRID_SIZE || this.frog.x > CANVAS_WIDTH) {
            this.killFrog('drowned');
          }
        } else {
          // Frog is in water without platform
          this.killFrog('drowned');
        }
      }
    }
  }

  private updatePowerUps(dt: number, dtMs: number): void {
    for (let i = this.powerUps.length - 1; i >= 0; i--) {
      const powerUp = this.powerUps[i];
      powerUp.lifetime -= dtMs;
      powerUp.pulsePhase += dt * 3;

      if (powerUp.lifetime <= 0) {
        this.powerUps.splice(i, 1);
        continue;
      }

      // Check collection
      const frogRect = { x: this.frog.x, y: this.frog.y, width: GRID_SIZE, height: GRID_SIZE };
      const powerUpRect = { x: powerUp.x - 15, y: powerUp.y - 15, width: 30, height: 30 };

      if (this.rectsOverlap(frogRect, powerUpRect)) {
        this.collectPowerUp(powerUp);
        this.powerUps.splice(i, 1);
      }
    }
  }

  private collectPowerUp(powerUp: PowerUp): void {
    this.services?.audio?.playSound?.(powerUp.type === 'coin' ? 'coin' : 'powerup');
    this.spawnSparkles(powerUp.x, powerUp.y, 8);

    let points = 0;
    let text = '';

    switch (powerUp.type) {
      case 'coin':
        this.pickups++;
        this.coinsCollected++;
        points = 25;
        text = '+25';
        break;
      case 'timeExtend':
        this.timer = Math.min(this.timer + 10000, this.maxTimer);
        this.powerupsUsed++;
        points = 50;
        text = '+10s';
        break;
      case 'shield':
        this.frog.hasShield = true;
        this.frog.shieldTimer = 8000;
        this.powerupsUsed++;
        points = 50;
        text = 'SHIELD!';
        break;
      case 'speedBoost':
        this.frog.hasSpeedBoost = true;
        this.frog.speedBoostTimer = 5000;
        this.powerupsUsed++;
        points = 50;
        text = 'SPEED!';
        break;
    }

    this.score += points;
    this.spawnScorePopup(powerUp.x, powerUp.y, points, text);
  }

  private checkCollisions(): void {
    const frogRect = {
      x: this.frog.x + 5,
      y: this.frog.y + 5,
      width: GRID_SIZE - 10,
      height: GRID_SIZE - 10,
    };

    // Check vehicle collisions
    if (!this.frog.isInvincible) {
      for (const vehicle of this.vehicles) {
        const vehicleRect = { x: vehicle.x, y: vehicle.y, width: vehicle.width, height: vehicle.height };
        if (this.rectsOverlap(frogRect, vehicleRect)) {
          if (this.frog.hasShield) {
            this.frog.hasShield = false;
            this.frog.isInvincible = true;
            this.frog.invincibleTimer = 1000;
            this.spawnSparkles(this.frog.x + GRID_SIZE / 2, this.frog.y + GRID_SIZE / 2, 12);
            this.services?.audio?.playSound?.('hit');
          } else {
            this.killFrog('hit');
            return;
          }
        }

        // Near-miss bonus detection - larger zone for better detection
        const nearMissMargin = 25; // Generous margin for near-miss detection
        const expandedRect = {
          x: vehicle.x - nearMissMargin,
          y: vehicle.y - 10,
          width: vehicle.width + nearMissMargin * 2,
          height: vehicle.height + 20
        };

        // Check if frog is in danger zone but not actually hit
        if (this.rectsOverlap(frogRect, expandedRect) && !this.rectsOverlap(frogRect, vehicleRect)) {
          const now = this.gameTime;
          // Only count near-miss once per 500ms per vehicle
          if (now - this.lastNearMissTime > 500) {
            this.closeCallCount++;
            this.nearMissCombo++;
            this.lastNearMissTime = now;

            // Award points for near-miss
            const nearMissPoints = 10 * this.nearMissCombo;
            this.score += nearMissPoints;
            this.spawnScorePopup(
              this.frog.x + GRID_SIZE / 2,
              this.frog.y - 10,
              nearMissPoints,
              this.nearMissCombo > 1 ? `CLOSE x${this.nearMissCombo}!` : 'CLOSE CALL!',
              '#FF6B6B'
            );
            this.services?.audio?.playSound?.('coin');
            this.screenShake = 3; // Small screen shake for feedback

            // Reset near-miss combo after 3 seconds
            setTimeout(() => {
              this.nearMissCombo = 0;
            }, 3000);
          }
        }
      }
    }

    // Check crocodile mouth collision
    for (const croc of this.crocodiles) {
      if (croc.mouthOpen && !this.frog.isInvincible) {
        const mouthX = croc.direction === 1 ? croc.x + croc.width - 30 : croc.x;
        const mouthRect = { x: mouthX, y: croc.y, width: 30, height: 35 };
        if (this.rectsOverlap(frogRect, mouthRect)) {
          if (this.frog.hasShield) {
            this.frog.hasShield = false;
            this.frog.isInvincible = true;
            this.frog.invincibleTimer = 1000;
          } else {
            this.killFrog('eaten');
            return;
          }
        }
      }
    }

    // Check lily pad goal
    for (const pad of this.lilyPads) {
      if (!pad.filled) {
        const padRect = { x: pad.x, y: pad.y, width: 60, height: 50 };
        if (this.rectsOverlap(frogRect, padRect)) {
          this.reachLilyPad(pad);
          return;
        }
      }
    }
  }

  private getFrogLane(): { type: 'road' | 'river' | 'safe' | 'goal'; index: number } | null {
    const frogY = this.frog.y;

    if (frogY >= LANE_CONFIG.startZone.y) {
      return { type: 'safe', index: -1 };
    }
    if (frogY >= LANE_CONFIG.medianZone.y && frogY < LANE_CONFIG.medianZone.y + LANE_CONFIG.medianZone.height) {
      return { type: 'safe', index: -1 };
    }
    if (frogY < LANE_CONFIG.goalZone.y + LANE_CONFIG.goalZone.height) {
      return { type: 'goal', index: -1 };
    }

    for (let i = 0; i < LANE_CONFIG.roadLanes.length; i++) {
      const lane = LANE_CONFIG.roadLanes[i];
      if (Math.abs(frogY - lane.y) < GRID_SIZE / 2) {
        return { type: 'road', index: i };
      }
    }

    for (let i = 0; i < LANE_CONFIG.riverLanes.length; i++) {
      const lane = LANE_CONFIG.riverLanes[i];
      if (Math.abs(frogY - lane.y) < GRID_SIZE / 2) {
        return { type: 'river', index: i };
      }
    }

    return null;
  }

  private getFrogPlatform(): Log | Turtle | Crocodile | null {
    const frogRect = {
      x: this.frog.x + 10,
      y: this.frog.y + 10,
      width: GRID_SIZE - 20,
      height: GRID_SIZE - 20,
    };

    // Check logs
    for (const log of this.logs) {
      const logRect = { x: log.x, y: log.y, width: log.width, height: 35 };
      if (this.rectsOverlap(frogRect, logRect)) {
        return log;
      }
    }

    // Check turtles (only if not submerged)
    for (const turtle of this.turtles) {
      if (!turtle.isSubmerged && turtle.submergePhase < 0.8) {
        const turtleWidth = turtle.count * 35;
        const turtleRect = { x: turtle.x, y: turtle.y, width: turtleWidth, height: 35 };
        if (this.rectsOverlap(frogRect, turtleRect)) {
          return turtle;
        }
      }
    }

    // Check crocodiles (body only, not mouth)
    for (const croc of this.crocodiles) {
      const bodyX = croc.direction === 1 ? croc.x : croc.x + 30;
      const bodyWidth = croc.width - 30;
      const bodyRect = { x: bodyX, y: croc.y, width: bodyWidth, height: 35 };
      if (this.rectsOverlap(frogRect, bodyRect)) {
        return croc;
      }
    }

    return null;
  }

  private rectsOverlap(a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }): boolean {
    return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
  }

  private reachLilyPad(pad: LilyPad): void {
    pad.filled = true;
    this.frogsRescued++;

    // Combo system
    const comboMultiplier = this.addCombo();

    // Base score
    let points = 100 + this.round * 20;
    let popupText = `+${points}`;

    // Fly bonus
    if (pad.hasFly) {
      points += 200;
      popupText = `FLY! +${points}`;
      pad.hasFly = false;
    }

    // Time bonus
    const timeBonus = Math.floor(this.timer / 100);
    points += timeBonus;

    // Apply combo multiplier
    if (comboMultiplier > 1) {
      points = Math.floor(points * (1 + (comboMultiplier - 1) * 0.5)); // 1.5x, 2x, 2.5x etc
      popupText = `${comboMultiplier}x COMBO! +${points}`;
    }

    this.score += points;
    this.flashTimer = 200;
    this.services?.audio?.playSound?.('success');
    this.spawnSparkles(pad.x + 30, pad.y + 25, 15);

    // Spawn score popup
    const popupColor = comboMultiplier > 1 ? '#FF00FF' : pad.hasFly ? '#FFD700' : '#4CAF50';
    this.spawnScorePopup(pad.x + 30, pad.y + 25, points, popupText, popupColor);

    // Check if all lily pads filled
    const allFilled = this.lilyPads.every(p => p.filled);
    if (allFilled) {
      // Round complete
      if (this.deathsThisRound === 0) {
        this.perfectRounds++;
        this.score += 500; // Perfect round bonus
        this.spawnScorePopup(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, 500, 'PERFECT! +500', '#FFD700');
      }
      this.gameState = 'roundComplete';
    } else {
      // Reset frog for next attempt
      this.frog.x = CANVAS_WIDTH / 2 - GRID_SIZE / 2;
      this.frog.y = LANE_CONFIG.startZone.y;
      this.frog.targetX = this.frog.x;
      this.frog.targetY = this.frog.y;
      this.timer = this.maxTimer;
    }
  }

  private killFrog(reason: 'hit' | 'drowned' | 'eaten' | 'timeout'): void {
    this.gameState = 'dying';
    this.deathsThisRound++;
    this.screenShake = 8;

    // Spawn particles based on death type
    if (reason === 'drowned') {
      this.spawnSplash(this.frog.x + GRID_SIZE / 2, this.frog.y + GRID_SIZE / 2);
      this.services?.audio?.playSound?.('splash');
    } else if (reason === 'hit' || reason === 'eaten') {
      this.spawnExplosion(this.frog.x + GRID_SIZE / 2, this.frog.y + GRID_SIZE / 2);
      this.services?.audio?.playSound?.('explosion');
    }

    // Set up respawn timer
    setTimeout(() => {
      this.lives--;
      if (this.lives <= 0) {
        this.gameState = 'gameOver';
        this.maxRoundReached = Math.max(this.maxRoundReached, this.round);
        this.endGame();
      } else {
        this.respawnFrog();
      }
    }, 1000);
  }

  private respawnFrog(): void {
    this.frog.x = CANVAS_WIDTH / 2 - GRID_SIZE / 2;
    this.frog.y = LANE_CONFIG.startZone.y;
    this.frog.targetX = this.frog.x;
    this.frog.targetY = this.frog.y;
    this.frog.isMoving = false;
    this.frog.moveProgress = 0;
    this.frog.isInvincible = true;
    this.frog.invincibleTimer = 2000;
    this.frog.hasShield = false;
    this.frog.hasSpeedBoost = false;
    this.timer = this.maxTimer;

    // Reset combo on death
    this.comboCount = 0;
    this.comboTimer = 0;
    this.nearMissCombo = 0;

    this.gameState = 'respawning';

    setTimeout(() => {
      this.gameState = 'playing';
    }, 500);
  }

  private updateDying(): void {
    // Just wait for respawn timer
  }

  private updateRespawning(): void {
    // Animate respawn
  }

  private updateRoundComplete(): void {
    // Already started celebration
    if (this.celebrationTimer > 0) return;

    // Start celebration
    this.celebrationTimer = 3000; // 3 seconds of celebration
    this.celebrationPhase = 0;
    this.dancingFrogY = CANVAS_HEIGHT / 2;
    this.services?.audio?.playSound?.('success');

    // Spawn confetti particles
    for (let i = 0; i < 30; i++) {
      this.particles.push({
        x: Math.random() * CANVAS_WIDTH,
        y: -20,
        vx: (Math.random() - 0.5) * 100,
        vy: 50 + Math.random() * 100,
        lifetime: 3,
        maxLifetime: 3,
        color: ['#FFD700', '#FF6B6B', '#4CAF50', '#2196F3', '#E91E63'][Math.floor(Math.random() * 5)],
        size: 6 + Math.random() * 4,
        type: 'sparkle',
      });
    }
  }

  private updateCelebration(dt: number): void {
    if (this.celebrationTimer <= 0) return;

    const dtMs = dt * 1000;
    this.celebrationTimer -= dtMs;
    this.celebrationPhase += dt * 10; // For animations

    // Dancing frog bounce
    this.dancingFrogY = CANVAS_HEIGHT / 2 + Math.sin(this.celebrationPhase * 3) * 20;

    // When celebration ends, start next round
    if (this.celebrationTimer <= 0) {
      this.round++;
      this.maxRoundReached = Math.max(this.maxRoundReached, this.round);
      this.score += 1000; // Round completion bonus
      this.initializeRound();
      this.gameState = 'playing';
    }
  }

  // ==========================================
  // PARTICLE SYSTEM
  // ==========================================

  private spawnSplash(x: number, y: number): void {
    for (let i = 0; i < 20; i++) {
      const angle = (i / 20) * Math.PI * 2;
      const speed = 80 + Math.random() * 60;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 50,
        lifetime: 0.8,
        maxLifetime: 0.8,
        color: Math.random() < 0.5 ? COLORS.water : COLORS.waterLight,
        size: 4 + Math.random() * 4,
        type: 'splash',
      });
    }
  }

  private spawnExplosion(x: number, y: number): void {
    const colors = ['#FF5722', '#FF9800', '#FFC107', '#FFEB3B'];
    for (let i = 0; i < 25; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 60 + Math.random() * 100;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        lifetime: 0.6 + Math.random() * 0.4,
        maxLifetime: 0.6 + Math.random() * 0.4,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 5 + Math.random() * 5,
        type: 'explosion',
      });
    }
  }

  private spawnSparkles(x: number, y: number, count: number): void {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 30 + Math.random() * 50;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 30,
        lifetime: 0.5 + Math.random() * 0.3,
        maxLifetime: 0.5 + Math.random() * 0.3,
        color: Math.random() < 0.5 ? COLORS.coinGold : COLORS.coinHighlight,
        size: 3 + Math.random() * 3,
        type: 'sparkle',
      });
    }
  }

  private spawnDust(x: number, y: number, count: number): void {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI - Math.PI / 2; // Spread upward
      const speed = 20 + Math.random() * 30;
      this.particles.push({
        x: x + (Math.random() - 0.5) * 10,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 10,
        lifetime: 0.3 + Math.random() * 0.2,
        maxLifetime: 0.3 + Math.random() * 0.2,
        color: '#A0886B',
        size: 3 + Math.random() * 3,
        type: 'leaf', // Reusing leaf type for dust
      });
    }
  }

  private spawnRipple(x: number, y: number): void {
    // Create expanding ring ripples
    for (let i = 0; i < 3; i++) {
      setTimeout(() => {
        this.particles.push({
          x,
          y,
          vx: 0,
          vy: 0,
          lifetime: 0.6,
          maxLifetime: 0.6,
          color: COLORS.waterLight,
          size: 8 + i * 6, // Staggered starting sizes
          type: 'ripple',
        });
      }, i * 100); // Stagger ripple spawning
    }
  }

  // ==========================================
  // SCORE POPUP SYSTEM
  // ==========================================

  private spawnScorePopup(x: number, y: number, points: number, text?: string, color?: string): void {
    const displayText = text || `+${points}`;
    const displayColor = color || (points >= 200 ? '#FFD700' : points >= 100 ? '#4CAF50' : '#FFFFFF');
    const scale = points >= 500 ? 1.5 : points >= 200 ? 1.2 : 1.0;

    this.scorePopups.push({
      x,
      y,
      text: displayText,
      color: displayColor,
      lifetime: 1.5,
      maxLifetime: 1.5,
      scale,
    });
  }

  private updateScorePopups(dt: number): void {
    for (let i = this.scorePopups.length - 1; i >= 0; i--) {
      const popup = this.scorePopups[i];
      popup.y -= dt * 40; // Float upward
      popup.lifetime -= dt;

      if (popup.lifetime <= 0) {
        this.scorePopups.splice(i, 1);
      }
    }
  }

  // ==========================================
  // COMBO SYSTEM
  // ==========================================

  private addCombo(): number {
    this.comboCount++;
    this.comboTimer = 5000; // 5 seconds to maintain combo

    if (this.comboCount >= 2) {
      return this.comboCount; // Return multiplier
    }
    return 1;
  }

  private updateCombo(dtMs: number): void {
    if (this.comboTimer > 0) {
      this.comboTimer -= dtMs;
      if (this.comboTimer <= 0) {
        this.comboCount = 0;
      }
    }
  }

  // ==========================================
  // LADY FROG SYSTEM
  // ==========================================

  private trySpawnLadyFrog(): void {
    // Only spawn if no lady frog exists and we're past round 1
    if (this.ladyFrog || this.round < 2) return;

    // 15% chance per check
    if (Math.random() < 0.15 && this.logs.length > 0) {
      const logIndex = Math.floor(Math.random() * this.logs.length);
      const log = this.logs[logIndex];

      this.ladyFrog = {
        x: log.x + log.width / 2,
        y: log.y,
        logIndex,
        lifetime: 15000, // 15 seconds to rescue
        rescued: false,
        bobPhase: 0,
      };
    }
  }

  private updateLadyFrog(dt: number, dtMs: number): void {
    if (!this.ladyFrog) return;

    // Update position to stay on log
    const log = this.logs[this.ladyFrog.logIndex];
    if (log) {
      this.ladyFrog.x = log.x + log.width / 2;
      this.ladyFrog.y = log.y;
    }

    this.ladyFrog.bobPhase += dt * 4;
    this.ladyFrog.lifetime -= dtMs;

    // Check if frog reached lady frog
    if (!this.ladyFrog.rescued && !this.frog.isMoving) {
      const dx = Math.abs(this.frog.x + GRID_SIZE / 2 - this.ladyFrog.x);
      const dy = Math.abs(this.frog.y + GRID_SIZE / 2 - this.ladyFrog.y);

      if (dx < 25 && dy < 25) {
        this.rescueLadyFrog();
        return; // ladyFrog is now null, exit early
      }
    }

    // Remove if expired
    if (this.ladyFrog.lifetime <= 0) {
      this.ladyFrog = null;
    }
  }

  private rescueLadyFrog(): void {
    if (!this.ladyFrog) return;

    const points = 500;
    this.score += points;
    this.spawnScorePopup(this.ladyFrog.x, this.ladyFrog.y, points, 'RESCUED! +500', '#FF69B4');
    this.spawnSparkles(this.ladyFrog.x, this.ladyFrog.y, 20);
    this.services?.audio?.playSound?.('success');
    this.flashTimer = 150;

    this.ladyFrog = null;
  }

  private updateParticles(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 200 * dt; // Gravity
      p.lifetime -= dt;

      if (p.lifetime <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  // ==========================================
  // RENDERING
  // ==========================================

  private renderBackground(ctx: CanvasRenderingContext2D): void {
    // Sky gradient at top
    const skyGradient = ctx.createLinearGradient(0, 0, 0, 160);
    skyGradient.addColorStop(0, '#87CEEB');
    skyGradient.addColorStop(1, '#B0E0E6');
    ctx.fillStyle = skyGradient;
    ctx.fillRect(0, 0, CANVAS_WIDTH, 160);

    // Render parallax clouds
    this.renderClouds(ctx);

    // Render trees behind goal zone
    this.renderTrees(ctx);

    // Grass zones
    ctx.fillStyle = COLORS.grass;
    ctx.fillRect(0, LANE_CONFIG.startZone.y, CANVAS_WIDTH, LANE_CONFIG.startZone.height);

    // Add grass texture
    this.renderGrassTexture(ctx, 0, LANE_CONFIG.startZone.y, CANVAS_WIDTH, LANE_CONFIG.startZone.height);
  }

  private renderClouds(ctx: CanvasRenderingContext2D): void {
    for (const cloud of this.clouds) {
      ctx.save();
      ctx.globalAlpha = cloud.opacity;
      ctx.fillStyle = '#FFFFFF';

      // Draw fluffy cloud shape using overlapping circles
      const cx = cloud.x + cloud.width / 2;
      const cy = cloud.y + cloud.height / 2;

      ctx.beginPath();
      // Main body
      ctx.ellipse(cx, cy, cloud.width * 0.4, cloud.height * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      // Left puff
      ctx.ellipse(cx - cloud.width * 0.25, cy + 2, cloud.width * 0.25, cloud.height * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      // Right puff
      ctx.ellipse(cx + cloud.width * 0.25, cy + 2, cloud.width * 0.3, cloud.height * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      // Top puff
      ctx.ellipse(cx + cloud.width * 0.1, cy - cloud.height * 0.2, cloud.width * 0.2, cloud.height * 0.35, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
  }

  private renderTrees(ctx: CanvasRenderingContext2D): void {
    const treeBaseY = LANE_CONFIG.goalZone.y + LANE_CONFIG.goalZone.height - 5;

    for (const tree of this.trees) {
      ctx.save();
      ctx.translate(tree.x, treeBaseY);
      ctx.scale(tree.scale, tree.scale);

      // Slightly darker for background layer trees
      if (tree.layer === 0) {
        ctx.globalAlpha = 0.7;
      }

      switch (tree.type) {
        case 'pine':
          this.renderPineTree(ctx);
          break;
        case 'oak':
          this.renderOakTree(ctx);
          break;
        case 'bush':
          this.renderBush(ctx);
          break;
      }

      ctx.restore();
    }
  }

  private renderPineTree(ctx: CanvasRenderingContext2D): void {
    // Trunk
    ctx.fillStyle = '#5D4037';
    ctx.fillRect(-4, -10, 8, 15);

    // Pine layers
    ctx.fillStyle = '#1B5E20';
    ctx.beginPath();
    ctx.moveTo(0, -55);
    ctx.lineTo(-18, -20);
    ctx.lineTo(18, -20);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#2E7D32';
    ctx.beginPath();
    ctx.moveTo(0, -45);
    ctx.lineTo(-22, -10);
    ctx.lineTo(22, -10);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#388E3C';
    ctx.beginPath();
    ctx.moveTo(0, -32);
    ctx.lineTo(-25, 0);
    ctx.lineTo(25, 0);
    ctx.closePath();
    ctx.fill();
  }

  private renderOakTree(ctx: CanvasRenderingContext2D): void {
    // Trunk
    ctx.fillStyle = '#5D4037';
    ctx.fillRect(-5, -15, 10, 20);

    // Foliage (overlapping circles)
    ctx.fillStyle = '#2E7D32';
    ctx.beginPath();
    ctx.arc(0, -35, 22, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#388E3C';
    ctx.beginPath();
    ctx.arc(-12, -28, 15, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(12, -28, 15, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#43A047';
    ctx.beginPath();
    ctx.arc(0, -42, 14, 0, Math.PI * 2);
    ctx.fill();
  }

  private renderBush(ctx: CanvasRenderingContext2D): void {
    // Bush (low overlapping circles)
    ctx.fillStyle = '#2E7D32';
    ctx.beginPath();
    ctx.arc(0, -10, 14, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#388E3C';
    ctx.beginPath();
    ctx.arc(-10, -8, 10, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(10, -8, 10, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#43A047';
    ctx.beginPath();
    ctx.arc(0, -15, 8, 0, Math.PI * 2);
    ctx.fill();
  }

  private renderGrassTexture(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number): void {
    ctx.strokeStyle = COLORS.grassDark;
    ctx.lineWidth = 1;

    for (let i = 0; i < width; i += 8) {
      const grassHeight = 5 + Math.sin(i * 0.5 + this.gameTime * 0.001) * 3;
      ctx.beginPath();
      ctx.moveTo(x + i, y + height);
      ctx.lineTo(x + i + 2, y + height - grassHeight);
      ctx.stroke();
    }
  }

  private renderWater(ctx: CanvasRenderingContext2D): void {
    const waterY = LANE_CONFIG.riverLanes[LANE_CONFIG.riverLanes.length - 1].y - 10;
    const waterHeight = LANE_CONFIG.riverLanes[0].y - waterY + 50;

    // Water gradient
    const waterGradient = ctx.createLinearGradient(0, waterY, 0, waterY + waterHeight);
    waterGradient.addColorStop(0, COLORS.waterDark);
    waterGradient.addColorStop(0.5, COLORS.water);
    waterGradient.addColorStop(1, COLORS.waterDark);
    ctx.fillStyle = waterGradient;
    ctx.fillRect(0, waterY, CANVAS_WIDTH, waterHeight);

    // Animated waves
    ctx.strokeStyle = COLORS.waterLight;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.3;

    for (let row = 0; row < 5; row++) {
      ctx.beginPath();
      const rowY = waterY + 20 + row * 35;
      for (let x = 0; x < CANVAS_WIDTH; x += 10) {
        const waveY = rowY + Math.sin((x + this.waterOffset + row * 50) * 0.03) * 5;
        if (x === 0) ctx.moveTo(x, waveY);
        else ctx.lineTo(x, waveY);
      }
      ctx.stroke();
    }

    // Water shimmer/sparkle effects
    ctx.globalAlpha = 0.6;
    for (let i = 0; i < 15; i++) {
      // Use deterministic positions based on index but animate with time
      const sparkleX = ((i * 137 + this.waterOffset * 0.5) % CANVAS_WIDTH);
      const sparkleY = waterY + 15 + (i * 23) % waterHeight;
      const sparklePhase = (this.waterOffset * 0.1 + i * 0.7) % (Math.PI * 2);
      const sparkleAlpha = Math.max(0, Math.sin(sparklePhase));

      if (sparkleAlpha > 0.3) {
        ctx.fillStyle = `rgba(255, 255, 255, ${sparkleAlpha * 0.7})`;
        ctx.beginPath();
        const size = 2 + sparkleAlpha * 2;
        ctx.arc(sparkleX, sparkleY, size, 0, Math.PI * 2);
        ctx.fill();

        // Star highlight on brightest sparkles
        if (sparkleAlpha > 0.7) {
          ctx.strokeStyle = `rgba(255, 255, 255, ${sparkleAlpha * 0.5})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(sparkleX - 4, sparkleY);
          ctx.lineTo(sparkleX + 4, sparkleY);
          ctx.moveTo(sparkleX, sparkleY - 4);
          ctx.lineTo(sparkleX, sparkleY + 4);
          ctx.stroke();
        }
      }
    }

    ctx.globalAlpha = 1;
  }

  private renderRoad(ctx: CanvasRenderingContext2D): void {
    const roadY = LANE_CONFIG.roadLanes[LANE_CONFIG.roadLanes.length - 1].y - 10;
    const roadHeight = LANE_CONFIG.roadLanes[0].y - roadY + 50;

    // Road surface
    ctx.fillStyle = COLORS.road;
    ctx.fillRect(0, roadY, CANVAS_WIDTH, roadHeight);

    // Lane markings
    ctx.strokeStyle = COLORS.roadLineWhite;
    ctx.setLineDash([20, 20]);
    ctx.lineWidth = 2;

    for (let i = 1; i < LANE_CONFIG.roadLanes.length; i++) {
      const y = LANE_CONFIG.roadLanes[i].y + 15;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(CANVAS_WIDTH, y);
      ctx.stroke();
    }

    ctx.setLineDash([]);

    // Road edges
    ctx.strokeStyle = COLORS.roadLine;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, roadY);
    ctx.lineTo(CANVAS_WIDTH, roadY);
    ctx.moveTo(0, roadY + roadHeight);
    ctx.lineTo(CANVAS_WIDTH, roadY + roadHeight);
    ctx.stroke();
  }

  private renderMedian(ctx: CanvasRenderingContext2D): void {
    const { y, height } = LANE_CONFIG.medianZone;

    ctx.fillStyle = COLORS.grass;
    ctx.fillRect(0, y, CANVAS_WIDTH, height);
    this.renderGrassTexture(ctx, 0, y, CANVAS_WIDTH, height);
  }

  private renderGoalZone(ctx: CanvasRenderingContext2D): void {
    const { y, height } = LANE_CONFIG.goalZone;

    // Grass behind lily pads
    ctx.fillStyle = COLORS.grassDark;
    ctx.fillRect(0, y, CANVAS_WIDTH, height);

    // Water between lily pads
    for (let i = 0; i < 5; i++) {
      const padX = this.lilyPads[i]?.x || 80 + i * 160;
      ctx.fillStyle = COLORS.waterDark;

      if (i === 0) {
        ctx.fillRect(0, y + 10, padX - 10, height - 20);
      }

      const nextPadX = this.lilyPads[i + 1]?.x || (i < 4 ? 80 + (i + 1) * 160 : CANVAS_WIDTH);
      ctx.fillRect(padX + 70, y + 10, nextPadX - padX - 80, height - 20);
    }
  }

  private renderLilyPads(ctx: CanvasRenderingContext2D): void {
    for (const pad of this.lilyPads) {
      const pulse = Math.sin(pad.pulsePhase) * 0.1 + 1;

      ctx.save();
      ctx.translate(pad.x + 30, pad.y + 25);

      // Add glow effect for unfilled lily pads (to guide player)
      if (!pad.filled) {
        const glowIntensity = 0.3 + Math.sin(pad.pulsePhase * 1.5) * 0.15;
        const glowGradient = ctx.createRadialGradient(0, 0, 10, 0, 0, 45);
        glowGradient.addColorStop(0, `rgba(76, 175, 80, ${glowIntensity})`);
        glowGradient.addColorStop(0.6, `rgba(76, 175, 80, ${glowIntensity * 0.3})`);
        glowGradient.addColorStop(1, 'rgba(76, 175, 80, 0)');
        ctx.fillStyle = glowGradient;
        ctx.beginPath();
        ctx.arc(0, 0, 45, 0, Math.PI * 2);
        ctx.fill();

        // Extra glow if has fly
        if (pad.hasFly) {
          const flyGlow = ctx.createRadialGradient(0, -5, 0, 0, -5, 30);
          flyGlow.addColorStop(0, 'rgba(255, 215, 0, 0.4)');
          flyGlow.addColorStop(1, 'rgba(255, 215, 0, 0)');
          ctx.fillStyle = flyGlow;
          ctx.beginPath();
          ctx.arc(0, -5, 30, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.scale(pulse, pulse);

      // Lily pad body
      ctx.fillStyle = pad.filled ? COLORS.frogBody : COLORS.lilyPad;
      ctx.beginPath();
      ctx.ellipse(0, 0, 30, 25, 0, 0, Math.PI * 2);
      ctx.fill();

      // Lily pad notch
      ctx.fillStyle = COLORS.waterDark;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-10, -25);
      ctx.lineTo(10, -25);
      ctx.closePath();
      ctx.fill();

      // Lily pad highlight
      ctx.strokeStyle = COLORS.lilyPadHighlight;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(0, 0, 28, 23, 0, 0, Math.PI * 2);
      ctx.stroke();

      // Draw frog if filled
      if (pad.filled) {
        this.renderMiniFrog(ctx, 0, 0);
      }

      // Draw fly if present
      if (pad.hasFly && !pad.filled) {
        const flyX = Math.sin(pad.flyTimer * 5) * 10;
        const flyY = Math.cos(pad.flyTimer * 3) * 5;
        this.renderFly(ctx, flyX, flyY);
      }

      ctx.restore();
    }
  }

  private renderMiniFrog(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    ctx.fillStyle = COLORS.frogBody;
    ctx.beginPath();
    ctx.ellipse(x, y, 12, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = COLORS.frogEye;
    ctx.beginPath();
    ctx.arc(x - 6, y - 5, 4, 0, Math.PI * 2);
    ctx.arc(x + 6, y - 5, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = COLORS.frogPupil;
    ctx.beginPath();
    ctx.arc(x - 6, y - 5, 2, 0, Math.PI * 2);
    ctx.arc(x + 6, y - 5, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  private renderFly(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    // Body
    ctx.fillStyle = COLORS.fly;
    ctx.beginPath();
    ctx.ellipse(x, y, 4, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Wings
    ctx.fillStyle = COLORS.flyWing;
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.ellipse(x - 4, y - 2, 4, 2, -0.3, 0, Math.PI * 2);
    ctx.ellipse(x + 4, y - 2, 4, 2, 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  private renderLogs(ctx: CanvasRenderingContext2D): void {
    for (const log of this.logs) {
      ctx.save();
      ctx.translate(log.x, log.y);

      // Main log body
      const gradient = ctx.createLinearGradient(0, 0, 0, 35);
      gradient.addColorStop(0, COLORS.logHighlight);
      gradient.addColorStop(0.5, COLORS.logMain);
      gradient.addColorStop(1, COLORS.logDark);

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.roundRect(0, 0, log.width, 35, 8);
      ctx.fill();

      // Wood grain lines
      ctx.strokeStyle = COLORS.logDark;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.3;
      for (let i = 10; i < log.width - 10; i += 15) {
        ctx.beginPath();
        ctx.moveTo(i, 5);
        ctx.lineTo(i + 5, 30);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // Log ends
      ctx.fillStyle = COLORS.logDark;
      ctx.beginPath();
      ctx.ellipse(4, 17, 4, 15, 0, 0, Math.PI * 2);
      ctx.ellipse(log.width - 4, 17, 4, 15, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
  }

  private renderTurtles(ctx: CanvasRenderingContext2D): void {
    for (const turtle of this.turtles) {
      ctx.save();
      ctx.translate(turtle.x, turtle.y);

      // Submerge effect
      if (turtle.submergePhase > 0) {
        ctx.globalAlpha = 1 - turtle.submergePhase * 0.8;
      }

      for (let i = 0; i < turtle.count; i++) {
        const tx = i * 35;

        // Shell
        const shellGradient = ctx.createRadialGradient(tx + 15, 17, 0, tx + 15, 17, 18);
        shellGradient.addColorStop(0, COLORS.turtleHighlight);
        shellGradient.addColorStop(0.7, COLORS.turtleShell);
        shellGradient.addColorStop(1, COLORS.turtleBody);

        ctx.fillStyle = shellGradient;
        ctx.beginPath();
        ctx.ellipse(tx + 15, 17, 15, 14, 0, 0, Math.PI * 2);
        ctx.fill();

        // Shell pattern
        ctx.strokeStyle = COLORS.turtleBody;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(tx + 15, 17, 8, 7, 0, 0, Math.PI * 2);
        ctx.stroke();

        // Head
        ctx.fillStyle = COLORS.turtleBody;
        ctx.beginPath();
        ctx.ellipse(tx + 28, 17, 5, 4, 0, 0, Math.PI * 2);
        ctx.fill();

        // Flippers
        ctx.fillStyle = COLORS.turtleBody;
        ctx.beginPath();
        ctx.ellipse(tx + 5, 8, 6, 3, -0.5, 0, Math.PI * 2);
        ctx.ellipse(tx + 5, 26, 6, 3, 0.5, 0, Math.PI * 2);
        ctx.ellipse(tx + 25, 8, 6, 3, 0.5, 0, Math.PI * 2);
        ctx.ellipse(tx + 25, 26, 6, 3, -0.5, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }
  }

  private renderCrocodiles(ctx: CanvasRenderingContext2D): void {
    for (const croc of this.crocodiles) {
      ctx.save();
      ctx.translate(croc.x, croc.y);
      if (croc.direction === -1) {
        ctx.scale(-1, 1);
        ctx.translate(-croc.width, 0);
      }

      // Body
      const bodyGradient = ctx.createLinearGradient(0, 0, 0, 35);
      bodyGradient.addColorStop(0, COLORS.crocBody);
      bodyGradient.addColorStop(0.5, '#1B5E20');
      bodyGradient.addColorStop(1, COLORS.crocBelly);

      ctx.fillStyle = bodyGradient;
      ctx.beginPath();
      ctx.moveTo(0, 17);
      ctx.lineTo(20, 5);
      ctx.lineTo(croc.width - 30, 5);
      ctx.lineTo(croc.width, 17);
      ctx.lineTo(croc.width - 30, 30);
      ctx.lineTo(20, 30);
      ctx.closePath();
      ctx.fill();

      // Scales
      ctx.fillStyle = '#1B5E20';
      for (let i = 25; i < croc.width - 35; i += 12) {
        ctx.beginPath();
        ctx.arc(i, 10, 4, 0, Math.PI * 2);
        ctx.fill();
      }

      // Head
      ctx.fillStyle = COLORS.crocBody;
      ctx.beginPath();
      ctx.moveTo(croc.width - 30, 5);
      ctx.lineTo(croc.width, 12);
      ctx.lineTo(croc.width, 23);
      ctx.lineTo(croc.width - 30, 30);
      ctx.closePath();
      ctx.fill();

      // Mouth
      if (croc.mouthOpen) {
        ctx.fillStyle = '#B71C1C';
        ctx.beginPath();
        ctx.moveTo(croc.width - 25, 17);
        ctx.lineTo(croc.width, 5);
        ctx.lineTo(croc.width, 17);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = COLORS.crocTeeth;
        for (let i = 0; i < 4; i++) {
          ctx.beginPath();
          ctx.moveTo(croc.width - 20 + i * 5, 17);
          ctx.lineTo(croc.width - 18 + i * 5, 12);
          ctx.lineTo(croc.width - 16 + i * 5, 17);
          ctx.closePath();
          ctx.fill();
        }
      }

      // Eye
      ctx.fillStyle = COLORS.crocEye;
      ctx.beginPath();
      ctx.arc(croc.width - 20, 12, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = COLORS.frogPupil;
      ctx.beginPath();
      ctx.arc(croc.width - 19, 12, 2, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
  }

  private renderVehicles(ctx: CanvasRenderingContext2D): void {
    for (const vehicle of this.vehicles) {
      // Draw shadow first
      ctx.save();
      ctx.translate(vehicle.x + 3, vehicle.y + 5);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
      ctx.beginPath();
      ctx.ellipse(vehicle.width / 2, vehicle.height / 2 + 5, vehicle.width * 0.45, vehicle.height * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.save();
      ctx.translate(vehicle.x, vehicle.y);
      if (vehicle.direction === -1) {
        ctx.scale(-1, 1);
        ctx.translate(-vehicle.width, 0);
      }

      switch (vehicle.type) {
        case 'car':
          this.renderCar(ctx, vehicle);
          break;
        case 'truck':
          this.renderTruck(ctx, vehicle);
          break;
        case 'bus':
          this.renderBus(ctx, vehicle);
          break;
        case 'motorcycle':
          this.renderMotorcycle(ctx, vehicle);
          break;
      }

      ctx.restore();
    }
  }

  private renderCar(ctx: CanvasRenderingContext2D, vehicle: Vehicle): void {
    // Car body
    ctx.fillStyle = vehicle.color;
    ctx.beginPath();
    ctx.roundRect(0, 8, vehicle.width, 22, 4);
    ctx.fill();

    // Roof
    ctx.fillStyle = vehicle.color;
    ctx.beginPath();
    ctx.roundRect(vehicle.width * 0.25, 2, vehicle.width * 0.5, 12, 3);
    ctx.fill();

    // Windows
    ctx.fillStyle = '#81D4FA';
    ctx.beginPath();
    ctx.roundRect(vehicle.width * 0.28, 5, vehicle.width * 0.2, 8, 2);
    ctx.roundRect(vehicle.width * 0.52, 5, vehicle.width * 0.18, 8, 2);
    ctx.fill();

    // Headlights
    ctx.fillStyle = '#FFEB3B';
    ctx.beginPath();
    ctx.arc(vehicle.width - 5, 15, 3, 0, Math.PI * 2);
    ctx.arc(vehicle.width - 5, 25, 3, 0, Math.PI * 2);
    ctx.fill();

    // Wheels
    ctx.fillStyle = '#212121';
    ctx.beginPath();
    ctx.arc(12, 30, 6, 0, Math.PI * 2);
    ctx.arc(vehicle.width - 12, 30, 6, 0, Math.PI * 2);
    ctx.fill();
  }

  private renderTruck(ctx: CanvasRenderingContext2D, vehicle: Vehicle): void {
    // Cargo
    ctx.fillStyle = COLORS.truckCargo;
    ctx.beginPath();
    ctx.roundRect(0, 3, vehicle.width * 0.65, 27, 3);
    ctx.fill();

    // Cab
    ctx.fillStyle = COLORS.truckBody;
    ctx.beginPath();
    ctx.roundRect(vehicle.width * 0.65, 8, vehicle.width * 0.35, 22, 4);
    ctx.fill();

    // Window
    ctx.fillStyle = '#81D4FA';
    ctx.beginPath();
    ctx.roundRect(vehicle.width * 0.72, 10, vehicle.width * 0.2, 10, 2);
    ctx.fill();

    // Wheels
    ctx.fillStyle = '#212121';
    ctx.beginPath();
    ctx.arc(15, 30, 7, 0, Math.PI * 2);
    ctx.arc(vehicle.width * 0.4, 30, 7, 0, Math.PI * 2);
    ctx.arc(vehicle.width - 15, 30, 7, 0, Math.PI * 2);
    ctx.fill();
  }

  private renderBus(ctx: CanvasRenderingContext2D, vehicle: Vehicle): void {
    // Bus body
    ctx.fillStyle = COLORS.busBody;
    ctx.beginPath();
    ctx.roundRect(0, 3, vehicle.width, 27, 5);
    ctx.fill();

    // Windows
    ctx.fillStyle = COLORS.busWindow;
    const windowWidth = 12;
    const windowGap = 5;
    for (let i = 10; i < vehicle.width - 20; i += windowWidth + windowGap) {
      ctx.beginPath();
      ctx.roundRect(i, 6, windowWidth, 12, 2);
      ctx.fill();
    }

    // Front windshield
    ctx.fillStyle = COLORS.busWindow;
    ctx.beginPath();
    ctx.roundRect(vehicle.width - 18, 5, 15, 14, 3);
    ctx.fill();

    // Stripe
    ctx.fillStyle = '#E65100';
    ctx.fillRect(0, 22, vehicle.width, 4);

    // Wheels
    ctx.fillStyle = '#212121';
    ctx.beginPath();
    ctx.arc(18, 30, 7, 0, Math.PI * 2);
    ctx.arc(vehicle.width - 18, 30, 7, 0, Math.PI * 2);
    ctx.fill();
  }

  private renderMotorcycle(ctx: CanvasRenderingContext2D, vehicle: Vehicle): void {
    // Body
    ctx.fillStyle = COLORS.motorcycleBody;
    ctx.beginPath();
    ctx.ellipse(vehicle.width / 2, 15, 12, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Rider helmet
    ctx.fillStyle = vehicle.color;
    ctx.beginPath();
    ctx.arc(vehicle.width / 2 + 3, 8, 6, 0, Math.PI * 2);
    ctx.fill();

    // Visor
    ctx.fillStyle = '#212121';
    ctx.beginPath();
    ctx.arc(vehicle.width / 2 + 6, 8, 3, -0.5, 0.5);
    ctx.fill();

    // Headlight
    ctx.fillStyle = '#FFEB3B';
    ctx.beginPath();
    ctx.arc(vehicle.width - 3, 15, 2, 0, Math.PI * 2);
    ctx.fill();

    // Wheels
    ctx.fillStyle = '#212121';
    ctx.beginPath();
    ctx.arc(6, 20, 5, 0, Math.PI * 2);
    ctx.arc(vehicle.width - 6, 20, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  private renderPowerUps(ctx: CanvasRenderingContext2D): void {
    for (const powerUp of this.powerUps) {
      const pulse = Math.sin(powerUp.pulsePhase) * 0.15 + 1;
      const alpha = powerUp.lifetime < 2000 ? powerUp.lifetime / 2000 : 1;

      ctx.save();
      ctx.translate(powerUp.x, powerUp.y);
      ctx.globalAlpha = alpha;

      // Add glow effect behind power-up
      let glowColor: string;
      switch (powerUp.type) {
        case 'coin': glowColor = COLORS.coinGold; break;
        case 'timeExtend': glowColor = COLORS.timeGreen; break;
        case 'shield': glowColor = COLORS.shieldBlue; break;
        case 'speedBoost': glowColor = COLORS.speedOrange; break;
      }

      // Outer glow
      const glowSize = 20 + Math.sin(powerUp.pulsePhase * 2) * 5;
      const glowGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, glowSize);
      glowGradient.addColorStop(0, glowColor);
      glowGradient.addColorStop(0.5, glowColor + '66');
      glowGradient.addColorStop(1, glowColor + '00');
      ctx.fillStyle = glowGradient;
      ctx.beginPath();
      ctx.arc(0, 0, glowSize, 0, Math.PI * 2);
      ctx.fill();

      ctx.scale(pulse, pulse);

      switch (powerUp.type) {
        case 'coin':
          this.renderCoin(ctx);
          break;
        case 'timeExtend':
          this.renderTimePowerUp(ctx);
          break;
        case 'shield':
          this.renderShieldPowerUp(ctx);
          break;
        case 'speedBoost':
          this.renderSpeedPowerUp(ctx);
          break;
      }

      ctx.restore();
    }
  }

  private renderCoin(ctx: CanvasRenderingContext2D): void {
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 10);
    gradient.addColorStop(0, COLORS.coinHighlight);
    gradient.addColorStop(0.7, COLORS.coinGold);
    gradient.addColorStop(1, '#B8860B');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#B8860B';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#B8860B';
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('$', 0, 1);
  }

  private renderTimePowerUp(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = COLORS.timeGreen;
    ctx.beginPath();
    ctx.arc(0, 0, 12, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#2E7D32';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('+', 0, 0);
  }

  private renderShieldPowerUp(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = COLORS.shieldBlue;
    ctx.beginPath();
    ctx.moveTo(0, -12);
    ctx.lineTo(10, -6);
    ctx.lineTo(10, 4);
    ctx.lineTo(0, 12);
    ctx.lineTo(-10, 4);
    ctx.lineTo(-10, -6);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = COLORS.shieldGlow;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  private renderSpeedPowerUp(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = COLORS.speedOrange;
    ctx.beginPath();
    ctx.arc(0, 0, 12, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.moveTo(-4, -6);
    ctx.lineTo(6, 0);
    ctx.lineTo(-4, 6);
    ctx.lineTo(-2, 0);
    ctx.closePath();
    ctx.fill();
  }

  private renderFrog(ctx: CanvasRenderingContext2D): void {
    if (this.gameState === 'dying') return;

    // Draw shadow first (before transformations)
    const shadowOffsetY = this.frog.isMoving ? 8 + this.frog.moveProgress * 4 : 6;
    const shadowScale = this.frog.isMoving ? 0.8 - this.frog.moveProgress * 0.15 : 0.85;
    ctx.save();
    ctx.translate(this.frog.x + GRID_SIZE / 2, this.frog.y + GRID_SIZE / 2 + shadowOffsetY);
    ctx.scale(shadowScale, shadowScale * 0.5);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.ellipse(0, 0, 16, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    // Apply hop height offset (negative Y = upward)
    ctx.translate(this.frog.x + GRID_SIZE / 2, this.frog.y + GRID_SIZE / 2 - this.frog.hopHeight);

    // Rotation based on direction
    let rotation = 0;
    switch (this.frog.direction) {
      case 'up': rotation = 0; break;
      case 'right': rotation = Math.PI / 2; break;
      case 'down': rotation = Math.PI; break;
      case 'left': rotation = -Math.PI / 2; break;
    }
    ctx.rotate(rotation);

    // Hop squash animation
    const scaleX = 1 / this.frog.hopSquash;
    const scaleY = this.frog.hopSquash;
    ctx.scale(scaleX, scaleY);

    // Invincibility blink
    if (this.frog.isInvincible && Math.floor(this.gameTime / 100) % 2 === 0) {
      ctx.globalAlpha = 0.5;
    }

    // Shield effect
    if (this.frog.hasShield) {
      ctx.fillStyle = COLORS.shieldGlow;
      ctx.globalAlpha = 0.3 + Math.sin(this.gameTime * 0.01) * 0.1;
      ctx.beginPath();
      ctx.arc(0, 0, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // Speed boost trail
    if (this.frog.hasSpeedBoost) {
      ctx.fillStyle = COLORS.speedOrange;
      ctx.globalAlpha = 0.3;
      for (let i = 1; i <= 3; i++) {
        ctx.beginPath();
        ctx.ellipse(0, i * 8, 10 - i * 2, 8 - i * 2, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // Back legs
    ctx.fillStyle = COLORS.frogBody;
    ctx.beginPath();
    ctx.ellipse(-10, 12, 6, 8, -0.3, 0, Math.PI * 2);
    ctx.ellipse(10, 12, 6, 8, 0.3, 0, Math.PI * 2);
    ctx.fill();

    // Front legs
    ctx.beginPath();
    ctx.ellipse(-8, -5, 4, 6, -0.2, 0, Math.PI * 2);
    ctx.ellipse(8, -5, 4, 6, 0.2, 0, Math.PI * 2);
    ctx.fill();

    // Body
    const bodyGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 16);
    bodyGradient.addColorStop(0, COLORS.frogBelly);
    bodyGradient.addColorStop(0.5, COLORS.frogBody);
    bodyGradient.addColorStop(1, COLORS.frogSpots);

    ctx.fillStyle = bodyGradient;
    ctx.beginPath();
    ctx.ellipse(0, 3, 12, 14, 0, 0, Math.PI * 2);
    ctx.fill();

    // Spots
    ctx.fillStyle = COLORS.frogSpots;
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.ellipse(-5, 5, 3, 2, 0.2, 0, Math.PI * 2);
    ctx.ellipse(5, 7, 2, 3, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Eyes
    const eyeBob = Math.sin(this.frog.idleTimer * 3) * 0.5;
    ctx.fillStyle = COLORS.frogEye;
    ctx.beginPath();
    ctx.arc(-6, -10 + eyeBob, 5, 0, Math.PI * 2);
    ctx.arc(6, -10 + eyeBob, 5, 0, Math.PI * 2);
    ctx.fill();

    // Pupils
    ctx.fillStyle = COLORS.frogPupil;
    ctx.beginPath();
    ctx.arc(-6, -10 + eyeBob, 2.5, 0, Math.PI * 2);
    ctx.arc(6, -10 + eyeBob, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Eye highlights
    ctx.fillStyle = COLORS.frogEye;
    ctx.beginPath();
    ctx.arc(-7, -11 + eyeBob, 1, 0, Math.PI * 2);
    ctx.arc(5, -11 + eyeBob, 1, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  private renderParticles(ctx: CanvasRenderingContext2D): void {
    for (const p of this.particles) {
      const lifeRatio = p.lifetime / p.maxLifetime;
      ctx.globalAlpha = lifeRatio;

      if (p.type === 'ripple') {
        // Ripples expand as they fade
        const expandedSize = p.size + (1 - lifeRatio) * 25;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 2 * lifeRatio;
        ctx.beginPath();
        ctx.arc(p.x, p.y, expandedSize, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        // Regular particles shrink as they fade
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * lifeRatio, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  private renderScorePopups(ctx: CanvasRenderingContext2D): void {
    for (const popup of this.scorePopups) {
      const alpha = popup.lifetime / popup.maxLifetime;
      const scale = popup.scale * (0.8 + alpha * 0.2);

      ctx.save();
      ctx.translate(popup.x, popup.y);
      ctx.scale(scale, scale);
      ctx.globalAlpha = alpha;

      // Text shadow
      ctx.fillStyle = '#000000';
      ctx.font = 'bold 18px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(popup.text, 2, 2);

      // Main text
      ctx.fillStyle = popup.color;
      ctx.fillText(popup.text, 0, 0);

      // Highlight
      ctx.fillStyle = '#FFFFFF';
      ctx.globalAlpha = alpha * 0.5;
      ctx.fillText(popup.text, -1, -1);

      ctx.restore();
    }
  }

  private renderLadyFrog(ctx: CanvasRenderingContext2D): void {
    if (!this.ladyFrog) return;

    ctx.save();
    ctx.translate(this.ladyFrog.x, this.ladyFrog.y + 5);

    // Bobbing animation
    const bobY = Math.sin(this.ladyFrog.bobPhase) * 3;
    ctx.translate(0, bobY);

    // Glow effect (pulsing to attract attention)
    const glowPulse = 0.4 + Math.sin(this.ladyFrog.bobPhase * 2) * 0.2;
    const glowGradient = ctx.createRadialGradient(0, 0, 5, 0, 0, 30);
    glowGradient.addColorStop(0, `rgba(255, 105, 180, ${glowPulse})`);
    glowGradient.addColorStop(1, 'rgba(255, 105, 180, 0)');
    ctx.fillStyle = glowGradient;
    ctx.beginPath();
    ctx.arc(0, 0, 30, 0, Math.PI * 2);
    ctx.fill();

    // Lady frog body (pink!)
    const bodyGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 12);
    bodyGradient.addColorStop(0, '#FFB6C1'); // Light pink
    bodyGradient.addColorStop(0.5, '#FF69B4'); // Hot pink
    bodyGradient.addColorStop(1, '#DB7093'); // Pale violet red

    ctx.fillStyle = bodyGradient;
    ctx.beginPath();
    ctx.ellipse(0, 3, 10, 12, 0, 0, Math.PI * 2);
    ctx.fill();

    // Bow on head
    ctx.fillStyle = '#FF1493'; // Deep pink
    ctx.beginPath();
    ctx.ellipse(-6, -10, 5, 3, -0.3, 0, Math.PI * 2);
    ctx.ellipse(6, -10, 5, 3, 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FFD700';
    ctx.beginPath();
    ctx.arc(0, -10, 3, 0, Math.PI * 2);
    ctx.fill();

    // Eyes
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(-4, -5, 4, 0, Math.PI * 2);
    ctx.arc(4, -5, 4, 0, Math.PI * 2);
    ctx.fill();

    // Pupils (with eyelashes look)
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(-4, -5, 2, 0, Math.PI * 2);
    ctx.arc(4, -5, 2, 0, Math.PI * 2);
    ctx.fill();

    // Eyelashes
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-7, -8);
    ctx.lineTo(-5, -6);
    ctx.moveTo(-4, -9);
    ctx.lineTo(-4, -7);
    ctx.moveTo(7, -8);
    ctx.lineTo(5, -6);
    ctx.moveTo(4, -9);
    ctx.lineTo(4, -7);
    ctx.stroke();

    // Blush
    ctx.fillStyle = 'rgba(255, 182, 193, 0.6)';
    ctx.beginPath();
    ctx.ellipse(-7, 0, 3, 2, 0, 0, Math.PI * 2);
    ctx.ellipse(7, 0, 3, 2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Timer indicator (urgency)
    if (this.ladyFrog.lifetime < 5000) {
      const urgency = 1 - this.ladyFrog.lifetime / 5000;
      ctx.fillStyle = `rgba(255, 0, 0, ${0.3 + urgency * 0.4})`;
      ctx.font = 'bold 10px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('HELP!', 0, -25);
    }

    ctx.restore();
  }

  private renderHUD(ctx: CanvasRenderingContext2D): void {
    // Background bar
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, CANVAS_WIDTH, 50);

    // Lives
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('Lives:', 15, 30);

    for (let i = 0; i < this.lives; i++) {
      ctx.fillStyle = COLORS.frogBody;
      ctx.beginPath();
      ctx.arc(80 + i * 25, 25, 10, 0, Math.PI * 2);
      ctx.fill();
    }

    // Score
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`Score: ${this.score}`, CANVAS_WIDTH / 2, 32);

    // Round
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'right';
    ctx.fillText(`Round: ${this.round}`, CANVAS_WIDTH - 150, 30);

    // Timer bar
    const timerWidth = 120;
    const timerHeight = 16;
    const timerX = CANVAS_WIDTH - 140;
    const timerY = 17;
    const timerPercent = this.timer / this.maxTimer;

    // Timer background
    ctx.fillStyle = '#333333';
    ctx.beginPath();
    ctx.roundRect(timerX, timerY, timerWidth, timerHeight, 3);
    ctx.fill();

    // Timer fill
    let timerColor = COLORS.timerFull;
    if (timerPercent < 0.33) {
      timerColor = COLORS.timerLow;
    } else if (timerPercent < 0.66) {
      timerColor = COLORS.timerMid;
    }

    // Flash when low
    if (timerPercent < 0.33 && Math.floor(this.gameTime / 200) % 2 === 0) {
      timerColor = '#FFFFFF';
    }

    ctx.fillStyle = timerColor;
    ctx.beginPath();
    ctx.roundRect(timerX + 2, timerY + 2, (timerWidth - 4) * timerPercent, timerHeight - 4, 2);
    ctx.fill();

    // Coins display
    ctx.fillStyle = COLORS.coinGold;
    ctx.beginPath();
    ctx.arc(165, 25, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`${this.pickups}`, 180, 30);

    // Combo indicator
    if (this.comboCount >= 2) {
      const comboX = 220;
      const comboY = 25;
      const pulse = 1 + Math.sin(this.gameTime / 100) * 0.1;

      ctx.save();
      ctx.translate(comboX, comboY);
      ctx.scale(pulse, pulse);

      // Glow effect
      ctx.shadowColor = '#FFD700';
      ctx.shadowBlur = 10;

      // Combo background
      ctx.fillStyle = 'rgba(255, 215, 0, 0.3)';
      ctx.beginPath();
      ctx.roundRect(-30, -12, 60, 24, 6);
      ctx.fill();

      // Combo text
      ctx.fillStyle = '#FFD700';
      ctx.font = 'bold 16px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(`x${this.comboCount}`, 0, 6);

      ctx.restore();

      // Combo timer bar (shows remaining time)
      const timerBarWidth = 50;
      const timerProgress = this.comboTimer / 5000;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(195, 38, timerBarWidth, 4);
      ctx.fillStyle = timerProgress > 0.3 ? '#FFD700' : '#FF5722';
      ctx.fillRect(195, 38, timerBarWidth * timerProgress, 4);
    }
  }

  private renderCelebration(ctx: CanvasRenderingContext2D): void {
    // Semi-transparent overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    const centerX = CANVAS_WIDTH / 2;
    const progress = 1 - (this.celebrationTimer / 3000);

    // "ROUND COMPLETE!" text with bounce
    const textScale = 1 + Math.sin(this.celebrationPhase * 2) * 0.1;
    ctx.save();
    ctx.translate(centerX, 150);
    ctx.scale(textScale, textScale);

    // Text shadow
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('ROUND COMPLETE!', 3, 3);

    // Rainbow gradient text
    const gradient = ctx.createLinearGradient(-150, 0, 150, 0);
    gradient.addColorStop(0, '#FFD700');
    gradient.addColorStop(0.5, '#4CAF50');
    gradient.addColorStop(1, '#FFD700');
    ctx.fillStyle = gradient;
    ctx.fillText('ROUND COMPLETE!', 0, 0);

    ctx.restore();

    // Dancing frog in center
    ctx.save();
    ctx.translate(centerX, this.dancingFrogY);

    // Rotate back and forth
    const wobble = Math.sin(this.celebrationPhase * 4) * 0.2;
    ctx.rotate(wobble);

    // Scale based on dance phase
    const danceScale = 1.5 + Math.sin(this.celebrationPhase * 6) * 0.15;
    ctx.scale(danceScale, danceScale);

    // Draw celebratory frog
    // Body
    const bodyGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 20);
    bodyGradient.addColorStop(0, '#90EE90');
    bodyGradient.addColorStop(0.5, '#32CD32');
    bodyGradient.addColorStop(1, '#228B22');
    ctx.fillStyle = bodyGradient;
    ctx.beginPath();
    ctx.ellipse(0, 3, 14, 16, 0, 0, Math.PI * 2);
    ctx.fill();

    // Legs extended outward (dancing pose)
    const legExtend = Math.abs(Math.sin(this.celebrationPhase * 6)) * 8;
    ctx.fillStyle = '#32CD32';
    ctx.beginPath();
    ctx.ellipse(-12 - legExtend, 12, 8, 6, -0.5, 0, Math.PI * 2);
    ctx.ellipse(12 + legExtend, 12, 8, 6, 0.5, 0, Math.PI * 2);
    ctx.fill();

    // Eyes (happy/closed expression when dancing)
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(-7, -10, 6, 0, Math.PI * 2);
    ctx.arc(7, -10, 6, 0, Math.PI * 2);
    ctx.fill();

    // Happy curved eyes (like ^_^)
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(-7, -9, 3, 0, Math.PI, true);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(7, -9, 3, 0, Math.PI, true);
    ctx.stroke();

    // Smile
    ctx.beginPath();
    ctx.arc(0, -2, 6, 0.2, Math.PI - 0.2);
    ctx.stroke();

    ctx.restore();

    // Next round text (fades in toward end)
    if (progress > 0.5) {
      const alpha = (progress - 0.5) * 2;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 36px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(`GET READY FOR`, centerX, CANVAS_HEIGHT - 150);
      ctx.fillStyle = '#FFD700';
      ctx.font = 'bold 52px Arial';
      ctx.fillText(`ROUND ${this.round + 1}`, centerX, CANVAS_HEIGHT - 95);
      ctx.globalAlpha = 1;
    }

    // Score bonus text
    ctx.fillStyle = '#4CAF50';
    ctx.font = 'bold 28px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('+1000 BONUS!', centerX, CANVAS_HEIGHT - 40);
  }

  private renderGameOver(ctx: CanvasRenderingContext2D): void {
    // Overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Game Over text
    ctx.fillStyle = '#FF5722';
    ctx.font = 'bold 64px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('GAME OVER', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 80);

    // Stats
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '24px Arial';
    ctx.fillText(`Final Score: ${this.score}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 20);
    ctx.fillText(`Round Reached: ${this.maxRoundReached}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 20);
    ctx.fillText(`Frogs Rescued: ${this.frogsRescued}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 60);

    // Restart prompt
    ctx.fillStyle = '#4CAF50';
    ctx.font = 'bold 20px Arial';
    ctx.fillText('Press ENTER or tap to restart', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 120);
  }

  // Cleanup
  protected onDestroy(): void {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    this.canvas.removeEventListener('touchstart', this.handleTouchStart);
    this.canvas.removeEventListener('touchend', this.handleTouchEnd);
  }
}
