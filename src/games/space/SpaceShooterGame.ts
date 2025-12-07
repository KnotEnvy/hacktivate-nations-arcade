// ===== SpaceShooterGame.ts =====
// A complete Tier 2 space shooter with 7 key features:
// 1. Fluid Ship Controls - smooth physics with acceleration
// 2. Weapon Systems & Power-ups - multiple weapon types and upgrades
// 3. Enemy Variety & AI - 6 unique enemy types with behaviors
// 4. Boss Battles - multi-phase boss fights
// 5. Particle Effects - explosions, trails, screen shake
// 6. Wave Progression - 5 waves + boss per level
// 7. Combo Scoring - kill streaks and multipliers

import { BaseGame } from '@/games/shared/BaseGame';
import { GameManifest, GameScore } from '@/lib/types';

// ============= TYPE DEFINITIONS =============

interface Vector2 {
  x: number;
  y: number;
}

interface Star {
  x: number;
  y: number;
  z: number; // depth for parallax
  size: number;
  brightness: number;
}

interface Nebula {
  x: number;
  y: number;
  radius: number;
  color: string;
  alpha: number;
}

// Permanent ship upgrades purchased between levels
interface ShipUpgrades {
  maxHp: number;           // +1 max HP per level (max 5)
  fireRate: number;        // +10% fire rate per level (max 5)
  moveSpeed: number;       // +10% move speed per level (max 5)
  startingBombs: number;   // +1 starting bomb per level (max 3)
  coinMagnet: number;      // +20 pickup range per level (max 5)
  critChance: number;      // +5% crit chance per level (max 5)
  shieldDuration: number;  // +2s shield duration per level (max 3)
  startingWeapon: number;  // +1 starting weapon level (max 2)
}

interface UpgradeDefinition {
  id: keyof ShipUpgrades;
  name: string;
  description: string;
  maxLevel: number;
  baseCost: number;
  costMultiplier: number;
  icon: string;
}

interface Ship {
  pos: Vector2;
  vel: Vector2;
  width: number;
  height: number;
  hp: number;
  maxHp: number;
  invincibleTime: number;
  shieldTime: number;
  weaponLevel: number;
  weaponType: 'normal' | 'rapid';
  rapidFireTime: number;
  speedBoostTime: number;
  bombs: number;
}

interface Bullet {
  pos: Vector2;
  vel: Vector2;
  damage: number;
  size: number;
  color: string;
  piercing: boolean;
}

interface EnemyBullet {
  pos: Vector2;
  vel: Vector2;
  size: number;
  damage: number;
  color: string;
}

interface Enemy {
  pos: Vector2;
  vel: Vector2;
  width: number;
  height: number;
  hp: number;
  maxHp: number;
  type: 'basic' | 'sine' | 'shooter' | 'diver' | 'spinner' | 'tanker';
  t: number;
  shootTimer: number;
  startX: number;
  spinAngle: number;
  spinRadius: number;
  spinCenter: Vector2;
  value: number;
  hitFlash: number;
  groupId: number; // Track which spawn group this enemy belongs to
  // Elite enemy properties
  isElite: boolean;
  eliteShield: number;      // For elite tanker's regenerating shield
  eliteAbilityTimer: number; // Cooldown for elite abilities
  homingTarget: Vector2 | null; // For elite shooter's homing missiles
}

interface Boss {
  pos: Vector2;
  width: number;
  height: number;
  hp: number;
  maxHp: number;
  phase: 1 | 2 | 3;
  phaseTimer: number;
  shootTimer: number;
  moveTimer: number;
  targetX: number;
  hitFlash: number;
  entered: boolean;
}

interface PowerUp {
  pos: Vector2;
  vel: Vector2;
  type: 'weapon' | 'shield' | 'bomb' | 'heal' | 'rapid' | 'speed';
  size: number;
  pulsePhase: number;
}

interface Particle {
  pos: Vector2;
  vel: Vector2;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  type: 'spark' | 'smoke' | 'debris' | 'ring' | 'trail';
  rotation: number;
  rotationSpeed: number;
}

interface ScorePopup {
  pos: Vector2;
  text: string;
  life: number;
  color: string;
  scale: number;
}

interface ScreenShake {
  intensity: number;
  duration: number;
  time: number;
}

interface LevelStats {
  shotsHit: number;
  shotsFired: number;
  enemiesKilled: number;
  damageTaken: number;
  powerUpsCollected: number;
  maxComboThisLevel: number;
  bossTime: number;
  groupClears: number;
}

// ============= GAME CONSTANTS =============

const SHIP_ACCELERATION = 2000;
const SHIP_MAX_SPEED = 400;
const SHIP_BOOSTED_MAX_SPEED = 600;
const SHIP_DRAG = 4;
const BULLET_SPEED = 700;
const FIRE_RATE = 0.12;
const RAPID_FIRE_RATE = 0.06;
const INVINCIBLE_DURATION = 2;
const SHIELD_DURATION = 7;
const RAPID_FIRE_DURATION = 8;
const SPEED_BOOST_DURATION = 10;
const COMBO_TIMEOUT = 2;
const GROUP_CLEAR_BONUS_SCORE = 500;
const GROUP_CLEAR_BONUS_PICKUPS = 3;

// Elite enemy constants
const ELITE_SPAWN_CHANCE = 0.12; // 12% chance for elite variant
const ELITE_HP_MULTIPLIER = 2.5;
const ELITE_VALUE_MULTIPLIER = 3;
const ELITE_SIZE_MULTIPLIER = 1.2;

// Upgrade shop definitions
const UPGRADE_DEFINITIONS: UpgradeDefinition[] = [
  { id: 'maxHp', name: 'Hull Plating', description: '+1 Max HP', maxLevel: 5, baseCost: 30, costMultiplier: 1.5, icon: '❤️' },
  { id: 'fireRate', name: 'Rapid Cycling', description: '+10% Fire Rate', maxLevel: 5, baseCost: 40, costMultiplier: 1.6, icon: '🔥' },
  { id: 'moveSpeed', name: 'Thruster Boost', description: '+10% Move Speed', maxLevel: 5, baseCost: 35, costMultiplier: 1.5, icon: '⚡' },
  { id: 'startingBombs', name: 'Bomb Bay', description: '+1 Starting Bomb', maxLevel: 3, baseCost: 50, costMultiplier: 2.0, icon: '💣' },
  { id: 'coinMagnet', name: 'Tractor Beam', description: '+20 Pickup Range', maxLevel: 5, baseCost: 25, costMultiplier: 1.4, icon: '🧲' },
  { id: 'critChance', name: 'Targeting CPU', description: '+5% Crit Chance', maxLevel: 5, baseCost: 45, costMultiplier: 1.7, icon: '🎯' },
  { id: 'shieldDuration', name: 'Shield Capacitor', description: '+2s Shield Duration', maxLevel: 3, baseCost: 55, costMultiplier: 1.8, icon: '🛡️' },
  { id: 'startingWeapon', name: 'Weapons Bay', description: '+1 Starting Weapon Lvl', maxLevel: 2, baseCost: 80, costMultiplier: 2.5, icon: '🚀' },
];

const ENEMY_CONFIGS = {
  basic: { hp: 1, speed: 100, value: 100, width: 30, height: 30 },     // Dies in 1 hit - fodder
  sine: { hp: 3, speed: 80, value: 150, width: 35, height: 35 },       // Takes a few hits
  shooter: { hp: 6, speed: 60, value: 250, width: 40, height: 40 },    // Armed & dangerous, needs focus
  diver: { hp: 2, speed: 250, value: 175, width: 28, height: 35 },     // Fast but fragile
  spinner: { hp: 8, speed: 120, value: 300, width: 45, height: 45 },   // Annoying, takes sustained fire
  tanker: { hp: 20, speed: 40, value: 500, width: 60, height: 50 },    // TANK - requires real effort
};

const WAVE_DEFINITIONS = [
  // Wave 1: Introduction
  [
    { time: 0, type: 'basic', count: 5, pattern: 'line' },
    { time: 3, type: 'basic', count: 3, pattern: 'random' },
    { time: 6, type: 'basic', count: 7, pattern: 'arc' },
  ],
  // Wave 2: Sine movers
  [
    { time: 0, type: 'sine', count: 4, pattern: 'line' },
    { time: 3, type: 'basic', count: 5, pattern: 'random' },
    { time: 5, type: 'sine', count: 5, pattern: 'arc' },
    { time: 8, type: 'basic', count: 6, pattern: 'v' },
  ],
  // Wave 3: Shooters introduced
  [
    { time: 0, type: 'shooter', count: 2, pattern: 'line' },
    { time: 2, type: 'sine', count: 4, pattern: 'random' },
    { time: 4, type: 'basic', count: 8, pattern: 'arc' },
    { time: 7, type: 'shooter', count: 3, pattern: 'line' },
  ],
  // Wave 4: Divers attack
  [
    { time: 0, type: 'diver', count: 3, pattern: 'random' },
    { time: 2, type: 'shooter', count: 2, pattern: 'line' },
    { time: 4, type: 'diver', count: 4, pattern: 'random' },
    { time: 6, type: 'sine', count: 5, pattern: 'arc' },
    { time: 9, type: 'tanker', count: 1, pattern: 'line' },
  ],
  // Wave 5: Full chaos
  [
    { time: 0, type: 'spinner', count: 2, pattern: 'line' },
    { time: 2, type: 'tanker', count: 2, pattern: 'line' },
    { time: 4, type: 'shooter', count: 4, pattern: 'arc' },
    { time: 6, type: 'diver', count: 5, pattern: 'random' },
    { time: 8, type: 'spinner', count: 3, pattern: 'random' },
    { time: 10, type: 'sine', count: 6, pattern: 'v' },
  ],
];

// ============= MAIN GAME CLASS =============

export class SpaceShooterGame extends BaseGame {
  manifest: GameManifest = {
    id: 'space',
    title: 'Space Shooter',
    thumbnail: '/games/space/space-thumb.svg',
    inputSchema: ['keyboard'],
    assetBudgetKB: 100,
    tier: 2,
    description: 'Defend the galaxy from alien waves! Features 6 enemy types, boss battles, power-ups, and combo scoring.',
  };

  // Game objects
  private ship!: Ship;
  private bullets: Bullet[] = [];
  private enemyBullets: EnemyBullet[] = [];
  private enemies: Enemy[] = [];
  private boss: Boss | null = null;
  private powerUps: PowerUp[] = [];
  private particles: Particle[] = [];
  private scorePopups: ScorePopup[] = [];
  
  // Background
  private stars: Star[] = [];
  private nebulae: Nebula[] = [];
  
  // Game state
  private waveNumber: number = 1;
  private waveTime: number = 0;
  private waveSpawnIndex: number = 0;
  private waveComplete: boolean = false;
  private bossDefeated: boolean = false;
  private levelNumber: number = 1;
  private gameOver: boolean = false;
  
  // Combat state
  private fireTimer: number = 0;
  private comboCount: number = 0;
  private comboTimer: number = 0;
  private maxCombo: number = 0;
  private totalKills: number = 0;
  
  // Effects
  private screenShake: ScreenShake = { intensity: 0, duration: 0, time: 0 };
  private flashAlpha: number = 0;
  
  // Input state
  private keys: Set<string> = new Set();
  
  // Stats tracking for level completion screen
  private shotsHitThisLevel: number = 0;
  private shotsFiredThisLevel: number = 0;
  private enemiesKilledThisLevel: number = 0;
  private damageTakenThisLevel: number = 0;
  private powerUpsCollectedThisLevel: number = 0;
  private maxComboThisLevel: number = 0;
  private bossTimer: number = 0;
  private levelStats: LevelStats | null = null;
  private showingStats: boolean = false;
  private statsTimer: number = 0;
  
  // Group tracking for group clear bonuses
  private currentGroupId: number = 0;
  private groupSizes: Map<number, number> = new Map(); // groupId -> total count
  private groupKills: Map<number, number> = new Map(); // groupId -> kills so far
  private groupClearsThisLevel: number = 0;
  
  // Ship upgrades (persistent across games in session)
  private shipUpgrades: ShipUpgrades = {
    maxHp: 0,
    fireRate: 0,
    moveSpeed: 0,
    startingBombs: 0,
    coinMagnet: 0,
    critChance: 0,
    shieldDuration: 0,
    startingWeapon: 0,
  };
  
  // Upgrade shop state
  private showingShop: boolean = false;
  private shopSelectedIndex: number = 0;
  private totalCoinsEarned: number = 0; // Persistent coin balance for upgrades
  
  // Elite enemy tracking
  private elitesKilledThisLevel: number = 0;
  private homingBullets: { pos: Vector2; vel: Vector2; target: Vector2; life: number }[] = [];
  
  // Prevent multiple endGame calls
  private hasEnded: boolean = false;
  private cachedFinalScore: number = 0;
  private cachedFinalPickups: number = 0;

  // ============= INITIALIZATION =============

  protected onInit(): void {
    this.initShip();
    this.initBackground();
    this.initInputHandlers();
    this.startWave(1);
    
    this.renderBaseHud = false; // We'll render our own HUD
    
    // Play start sound
    this.services?.audio?.playSound?.('powerup');
  }

  private initShip(): void {
    // Calculate upgraded stats
    const baseMaxHp = 5 + this.shipUpgrades.maxHp;
    const startingHp = 3 + Math.floor(this.shipUpgrades.maxHp / 2); // Start with more HP too
    const startingBombs = 2 + this.shipUpgrades.startingBombs;
    const startingWeapon = 1 + this.shipUpgrades.startingWeapon;
    
    this.ship = {
      pos: { x: this.canvas.width / 2, y: this.canvas.height - 100 },
      vel: { x: 0, y: 0 },
      width: 50,
      height: 60,
      hp: Math.min(startingHp, baseMaxHp),
      maxHp: baseMaxHp,
      invincibleTime: 0,
      shieldTime: 0,
      weaponLevel: startingWeapon,
      weaponType: 'normal',
      rapidFireTime: 0,
      speedBoostTime: 0,
      bombs: startingBombs,
    };
  }

  private initBackground(): void {
    // Create parallax star field with 3 layers
    this.stars = [];
    for (let i = 0; i < 150; i++) {
      this.stars.push({
        x: Math.random() * this.canvas.width,
        y: Math.random() * this.canvas.height,
        z: Math.random() * 3 + 1, // 1-4 depth
        size: Math.random() * 2 + 0.5,
        brightness: Math.random() * 0.5 + 0.5,
      });
    }
    
    // Create colorful nebulae
    this.nebulae = [];
    const nebulaColors = [
      'rgba(100, 50, 150, 0.1)',
      'rgba(50, 100, 180, 0.08)',
      'rgba(150, 50, 80, 0.1)',
      'rgba(50, 150, 100, 0.08)',
    ];
    for (let i = 0; i < 5; i++) {
      this.nebulae.push({
        x: Math.random() * this.canvas.width,
        y: Math.random() * this.canvas.height,
        radius: Math.random() * 200 + 100,
        color: nebulaColors[Math.floor(Math.random() * nebulaColors.length)],
        alpha: Math.random() * 0.3 + 0.1,
      });
    }
  }

  private initInputHandlers(): void {
    const handleKeyDown = (e: KeyboardEvent) => {
      this.keys.add(e.code);
      
      // Shop navigation
      if (this.showingShop) {
        if (e.code === 'ArrowUp' || e.code === 'KeyW') {
          this.shopSelectedIndex = Math.max(0, this.shopSelectedIndex - 1);
          this.services?.audio?.playSound?.('click');
        }
        if (e.code === 'ArrowDown' || e.code === 'KeyS') {
          this.shopSelectedIndex = Math.min(UPGRADE_DEFINITIONS.length - 1, this.shopSelectedIndex + 1);
          this.services?.audio?.playSound?.('click');
        }
        if (e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyZ') {
          this.purchaseUpgrade(this.shopSelectedIndex);
        }
        if (e.code === 'Escape' || e.code === 'KeyX') {
          this.showingShop = false;
          this.proceedToNextLevel();
        }
        return;
      }
      
      // Bomb with B key only (Space is now for firing)
      if (e.code === 'KeyB' && !this.gameOver && !this.showingStats && !this.showingShop) {
        this.useBomb();
      }
      
      // Restart with R
      if (e.code === 'KeyR' && this.gameOver) {
        this.restart();
      }
    };
    
    const handleKeyUp = (e: KeyboardEvent) => {
      this.keys.delete(e.code);
    };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
  }
  
  private purchaseUpgrade(index: number): void {
    const upgrade = UPGRADE_DEFINITIONS[index];
    const currentLevel = this.shipUpgrades[upgrade.id];
    
    if (currentLevel >= upgrade.maxLevel) {
      // Already maxed
      this.services?.audio?.playSound?.('click');
      return;
    }
    
    const cost = Math.floor(upgrade.baseCost * Math.pow(upgrade.costMultiplier, currentLevel));
    
    if (this.totalCoinsEarned >= cost) {
      this.totalCoinsEarned -= cost;
      this.shipUpgrades[upgrade.id]++;
      
      this.services?.audio?.playSound?.('powerup');
      
      // Show purchase confirmation
      this.scorePopups.push({
        pos: { x: this.canvas.width / 2, y: this.canvas.height / 2 },
        text: `${upgrade.name} UPGRADED!`,
        life: 1.5,
        color: '#44ff44',
        scale: 0,
      });
    } else {
      // Not enough coins
      this.services?.audio?.playSound?.('game_over');
    }
  }

  // ============= GAME UPDATE =============

  protected onUpdate(dt: number): void {
    if (this.gameOver) return;
    
    // Upgrade shop handling
    if (this.showingShop) {
      this.updateBackground(dt);
      this.updateParticles(dt);
      // Shop input handled in key handlers
      return;
    }
    
    // Stats screen handling - pause gameplay and wait for input
    if (this.showingStats) {
      this.statsTimer -= dt;
      this.updateParticles(dt); // Keep particles moving for visual interest
      this.updateScorePopups(dt);
      this.updateBackground(dt);
      
      // Check for any key press to dismiss stats screen and show shop
      const anyKeyPressed = this.keys.size > 0 && 
        !this.keys.has('ArrowLeft') && !this.keys.has('ArrowRight') &&
        !this.keys.has('ArrowUp') && !this.keys.has('ArrowDown') &&
        !this.keys.has('KeyA') && !this.keys.has('KeyD') &&
        !this.keys.has('KeyW') && !this.keys.has('KeyS');
      
      if (this.statsTimer <= 0 || anyKeyPressed) {
        this.showingStats = false;
        this.levelStats = null;
        // Transfer pickups to persistent coins for the shop
        this.totalCoinsEarned += this.pickups;
        // Show upgrade shop
        this.showingShop = true;
        this.shopSelectedIndex = 0;
      }
      return;
    }
    
    // Clamp dt to prevent huge jumps
    dt = Math.min(dt, 0.033);
    
    this.updateShip(dt);
    this.updateBullets(dt);
    this.updateEnemies(dt);
    this.updateEnemyBullets(dt);
    this.updateBoss(dt);
    this.updatePowerUps(dt);
    this.updateParticles(dt);
    this.updateScorePopups(dt);
    this.updateBackground(dt);
    this.updateWaveLogic(dt);
    this.updateScreenShake(dt);
    this.updateCombo(dt);
    this.checkCollisions();
  }

  private updateShip(dt: number): void {
    // Update timers
    if (this.ship.invincibleTime > 0) this.ship.invincibleTime -= dt;
    if (this.ship.shieldTime > 0) this.ship.shieldTime -= dt;
    if (this.ship.rapidFireTime > 0) this.ship.rapidFireTime -= dt;
    if (this.ship.speedBoostTime > 0) this.ship.speedBoostTime -= dt;
    
    // Movement with acceleration physics
    let ax = 0, ay = 0;
    
    if (this.keys.has('ArrowLeft') || this.keys.has('KeyA')) ax -= 1;
    if (this.keys.has('ArrowRight') || this.keys.has('KeyD')) ax += 1;
    if (this.keys.has('ArrowUp') || this.keys.has('KeyW')) ay -= 1;
    if (this.keys.has('ArrowDown') || this.keys.has('KeyS')) ay += 1;
    
    // Normalize diagonal movement
    if (ax !== 0 && ay !== 0) {
      const len = Math.sqrt(ax * ax + ay * ay);
      ax /= len;
      ay /= len;
    }
    
    // Apply acceleration (boosted when speed power-up active)
    const speedUpgradeBonus = 1 + (this.shipUpgrades.moveSpeed * 0.1); // +10% per level
    const accelMultiplier = (this.ship.speedBoostTime > 0 ? 1.5 : 1) * speedUpgradeBonus;
    this.ship.vel.x += ax * SHIP_ACCELERATION * accelMultiplier * dt;
    this.ship.vel.y += ay * SHIP_ACCELERATION * accelMultiplier * dt;
    
    // Apply drag (less drag when boosted for smoother fast movement)
    const dragMultiplier = this.ship.speedBoostTime > 0 ? 0.7 : 1;
    this.ship.vel.x *= Math.pow(1 - SHIP_DRAG * dragMultiplier * dt, 1);
    this.ship.vel.y *= Math.pow(1 - SHIP_DRAG * dragMultiplier * dt, 1);
    
    // Clamp velocity (higher max when speed boosted, plus upgrade bonus)
    const baseMaxSpeed = this.ship.speedBoostTime > 0 ? SHIP_BOOSTED_MAX_SPEED : SHIP_MAX_SPEED;
    const maxSpeed = baseMaxSpeed * speedUpgradeBonus;
    const speed = Math.sqrt(this.ship.vel.x ** 2 + this.ship.vel.y ** 2);
    if (speed > maxSpeed) {
      this.ship.vel.x = (this.ship.vel.x / speed) * maxSpeed;
      this.ship.vel.y = (this.ship.vel.y / speed) * maxSpeed;
    }
    
    // Update position
    this.ship.pos.x += this.ship.vel.x * dt;
    this.ship.pos.y += this.ship.vel.y * dt;
    
    // Clamp to screen bounds
    const hw = this.ship.width / 2;
    const hh = this.ship.height / 2;
    this.ship.pos.x = Math.max(hw, Math.min(this.canvas.width - hw, this.ship.pos.x));
    this.ship.pos.y = Math.max(hh, Math.min(this.canvas.height - hh, this.ship.pos.y));
    
    // Firing - manual with Space/J, or auto-fire during Rapid Fire power-up
    this.fireTimer -= dt;
    const fireRateUpgradeBonus = 1 + (this.shipUpgrades.fireRate * 0.1); // +10% per level (faster = lower time)
    const baseFireRate = this.ship.rapidFireTime > 0 ? RAPID_FIRE_RATE : FIRE_RATE;
    const fireRate = baseFireRate / fireRateUpgradeBonus;
    const wantsToFire = this.keys.has('Space') || this.keys.has('KeyJ') || this.keys.has('KeyZ');
    const hasAutoFire = this.ship.rapidFireTime > 0;
    
    if (this.fireTimer <= 0 && (wantsToFire || hasAutoFire)) {
      this.fireBullets();
      this.fireTimer = fireRate;
    }
    
    // Engine particles
    if (Math.random() < 0.5) {
      this.spawnEngineTrail();
    }
  }

  private fireBullets(): void {
    const x = this.ship.pos.x;
    const y = this.ship.pos.y - this.ship.height / 2;
    
    const weaponLevel = this.ship.weaponLevel;
    const isSpread = weaponLevel >= 3; // Spread shots at level 3+
    const damage = weaponLevel >= 2 ? 2 : 1;
    const piercing = weaponLevel >= 4;
    const color = weaponLevel >= 4 ? '#ff44ff' : weaponLevel >= 3 ? '#44ffff' : weaponLevel >= 2 ? '#ffff44' : '#44ff44';
    
    // Center bullet
    this.bullets.push({
      pos: { x, y },
      vel: { x: 0, y: -BULLET_SPEED },
      damage,
      size: 4,
      color,
      piercing,
    });
    
    // Side bullets based on weapon level
    if (weaponLevel >= 2) {
      this.bullets.push({
        pos: { x: x - 12, y: y + 10 },
        vel: { x: 0, y: -BULLET_SPEED },
        damage: 1,
        size: 3,
        color,
        piercing: false,
      });
      this.bullets.push({
        pos: { x: x + 12, y: y + 10 },
        vel: { x: 0, y: -BULLET_SPEED },
        damage: 1,
        size: 3,
        color,
        piercing: false,
      });
    }
    
    // Spread shots
    if (isSpread) {
      const spreadAngle = 0.3;
      this.bullets.push({
        pos: { x: x - 8, y },
        vel: { x: Math.sin(-spreadAngle) * BULLET_SPEED, y: -Math.cos(-spreadAngle) * BULLET_SPEED },
        damage: 1,
        size: 3,
        color,
        piercing: false,
      });
      this.bullets.push({
        pos: { x: x + 8, y },
        vel: { x: Math.sin(spreadAngle) * BULLET_SPEED, y: -Math.cos(spreadAngle) * BULLET_SPEED },
        damage: 1,
        size: 3,
        color,
        piercing: false,
      });
    }
    
    // Max level: rear guns
    if (weaponLevel >= 5) {
      this.bullets.push({
        pos: { x: x - 15, y: y + 30 },
        vel: { x: -BULLET_SPEED * 0.3, y: BULLET_SPEED * 0.5 },
        damage: 1,
        size: 2,
        color: '#ff8844',
        piercing: false,
      });
      this.bullets.push({
        pos: { x: x + 15, y: y + 30 },
        vel: { x: BULLET_SPEED * 0.3, y: BULLET_SPEED * 0.5 },
        damage: 1,
        size: 2,
        color: '#ff8844',
        piercing: false,
      });
    }
    
    // Track shots fired for stats
    let shotsThisVolley = 1; // Center bullet
    if (weaponLevel >= 2) shotsThisVolley += 2; // Side bullets
    if (isSpread) shotsThisVolley += 2; // Spread bullets
    if (weaponLevel >= 5) shotsThisVolley += 2; // Rear guns
    this.shotsFiredThisLevel += shotsThisVolley;
    
    this.services?.audio?.playSound?.('jump'); // Use jump as laser sound
  }

  private updateBullets(dt: number): void {
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.pos.x += b.vel.x * dt;
      b.pos.y += b.vel.y * dt;
      
      // Remove off-screen bullets
      if (b.pos.y < -20 || b.pos.y > this.canvas.height + 20 ||
          b.pos.x < -20 || b.pos.x > this.canvas.width + 20) {
        this.bullets.splice(i, 1);
      }
    }
  }

  private updateEnemies(dt: number): void {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      e.t += dt;
      e.shootTimer -= dt;
      if (e.hitFlash > 0) e.hitFlash -= dt;
      if (e.eliteAbilityTimer > 0) e.eliteAbilityTimer -= dt;
      
      // Elite tanker shield regeneration
      if (e.isElite && e.type === 'tanker' && e.eliteShield < 3) {
        if (e.eliteAbilityTimer <= 0) {
          e.eliteShield = Math.min(3, e.eliteShield + 1);
          e.eliteAbilityTimer = 3; // Regenerate 1 shield every 3 seconds
        }
      }
      
      // Movement based on type
      switch (e.type) {
        case 'basic':
          e.pos.y += e.vel.y * dt;
          break;
          
        case 'sine':
          e.pos.y += e.vel.y * dt;
          // Elite sine: wider, faster wave + leaves trail particles
          const waveAmplitude = e.isElite ? 120 : 80;
          const waveFrequency = e.isElite ? 4 : 3;
          e.pos.x = e.startX + Math.sin(e.t * waveFrequency) * waveAmplitude;
          if (e.isElite && Math.random() < 0.3) {
            this.particles.push({
              pos: { x: e.pos.x, y: e.pos.y },
              vel: { x: (Math.random() - 0.5) * 20, y: -30 },
              life: 0.5,
              maxLife: 0.5,
              size: 4,
              color: '#ff44ff',
              type: 'trail',
              rotation: 0,
              rotationSpeed: 0,
            });
          }
          break;
          
        case 'shooter':
          e.pos.y += e.vel.y * dt;
          if (e.pos.y > 50 && e.pos.y < this.canvas.height / 2) {
            e.vel.y *= 0.95; // Slow down to shoot
            if (e.shootTimer <= 0) {
              if (e.isElite) {
                // Elite shooter fires homing missiles!
                this.spawnHomingMissile(e.pos.x, e.pos.y + e.height / 2);
              } else {
                this.enemyShoot(e);
              }
              e.shootTimer = e.isElite ? 2 : 1.5;
            }
          }
          break;
          
        case 'diver':
          // Dive toward player
          if (e.t < 1) {
            e.pos.y += 50 * dt;
            // Elite diver: teleport warning
            if (e.isElite && e.t > 0.7 && !e.homingTarget) {
              e.homingTarget = { x: this.ship.pos.x, y: this.ship.pos.y };
              // Warning indicator
              this.particles.push({
                pos: { x: this.ship.pos.x, y: this.ship.pos.y },
                vel: { x: 0, y: 0 },
                life: 0.3,
                maxLife: 0.3,
                size: 50,
                color: '#ff0000',
                type: 'ring',
                rotation: 0,
                rotationSpeed: 0,
              });
            }
          } else {
            // Elite diver teleports to predicted position
            if (e.isElite && e.homingTarget && e.t < 1.1) {
              e.pos.x = e.homingTarget.x;
              e.pos.y = e.homingTarget.y - 150;
              e.homingTarget = null;
            }
            const dx = this.ship.pos.x - e.pos.x;
            const dy = this.ship.pos.y - e.pos.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const diverSpeed = e.isElite ? ENEMY_CONFIGS.diver.speed * 1.3 : ENEMY_CONFIGS.diver.speed;
            if (dist > 0) {
              e.vel.x = (dx / dist) * diverSpeed;
              e.vel.y = (dy / dist) * diverSpeed;
            }
            e.pos.x += e.vel.x * dt;
            e.pos.y += e.vel.y * dt;
          }
          break;
          
        case 'spinner':
          e.spinAngle += dt * 2;
          e.spinCenter.y += 30 * dt;
          e.pos.x = e.spinCenter.x + Math.cos(e.spinAngle) * e.spinRadius;
          e.pos.y = e.spinCenter.y + Math.sin(e.spinAngle) * e.spinRadius;
          if (e.shootTimer <= 0 && e.spinCenter.y > 100) {
            if (e.isElite) {
              // Elite spinner: bullet vortex!
              for (let j = 0; j < 8; j++) {
                const angle = (Math.PI * 2 / 8) * j + e.spinAngle;
                this.enemyBullets.push({
                  pos: { x: e.pos.x, y: e.pos.y },
                  vel: { x: Math.cos(angle) * 150, y: Math.sin(angle) * 150 },
                  size: 4,
                  damage: 1,
                  color: '#ff00ff',
                });
              }
              e.shootTimer = 1.2;
            } else {
              this.enemyShoot(e);
              e.shootTimer = 0.8;
            }
          }
          break;
          
        case 'tanker':
          e.pos.y += e.vel.y * dt;
          if (e.shootTimer <= 0 && e.pos.y > 80) {
            if (e.isElite) {
              // Elite tanker: wider spread + more bullets
              for (let j = -2; j <= 2; j++) {
                this.enemyBullets.push({
                  pos: { x: e.pos.x, y: e.pos.y + e.height / 2 },
                  vel: { x: j * 70, y: 180 },
                  size: 8,
                  damage: 1,
                  color: '#ffaa00',
                });
              }
              e.shootTimer = 1.5;
            } else {
              // Normal tanker shoots burst of 3
              for (let j = -1; j <= 1; j++) {
                this.enemyBullets.push({
                  pos: { x: e.pos.x, y: e.pos.y + e.height / 2 },
                  vel: { x: j * 80, y: 200 },
                  size: 6,
                  damage: 1,
                  color: '#ff6644',
                });
              }
              e.shootTimer = 2;
            }
            this.services?.audio?.playSound?.('click');
          }
          break;
      }
      
      // Remove off-screen enemies
      if (e.pos.y > this.canvas.height + 100 || 
          e.pos.x < -100 || e.pos.x > this.canvas.width + 100) {
        this.enemies.splice(i, 1);
      }
    }
    
    // Update homing missiles
    this.updateHomingMissiles(dt);
  }
  
  private spawnHomingMissile(x: number, y: number): void {
    this.homingBullets.push({
      pos: { x, y },
      vel: { x: 0, y: 100 },
      target: { x: this.ship.pos.x, y: this.ship.pos.y },
      life: 4,
    });
    this.services?.audio?.playSound?.('click');
  }
  
  private updateHomingMissiles(dt: number): void {
    for (let i = this.homingBullets.length - 1; i >= 0; i--) {
      const m = this.homingBullets[i];
      m.life -= dt;
      
      // Home toward player
      const dx = this.ship.pos.x - m.pos.x;
      const dy = this.ship.pos.y - m.pos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist > 0) {
        const turnSpeed = 3;
        m.vel.x += (dx / dist) * turnSpeed;
        m.vel.y += (dy / dist) * turnSpeed;
        
        // Limit speed
        const speed = Math.sqrt(m.vel.x ** 2 + m.vel.y ** 2);
        if (speed > 250) {
          m.vel.x = (m.vel.x / speed) * 250;
          m.vel.y = (m.vel.y / speed) * 250;
        }
      }
      
      m.pos.x += m.vel.x * dt;
      m.pos.y += m.vel.y * dt;
      
      // Trail particles
      if (Math.random() < 0.5) {
        this.particles.push({
          pos: { x: m.pos.x, y: m.pos.y },
          vel: { x: -m.vel.x * 0.2, y: -m.vel.y * 0.2 },
          life: 0.3,
          maxLife: 0.3,
          size: 3,
          color: '#ff4400',
          type: 'trail',
          rotation: 0,
          rotationSpeed: 0,
        });
      }
      
      // Check collision with player
      if (this.ship.invincibleTime <= 0) {
        const hitDist = Math.sqrt(
          (m.pos.x - this.ship.pos.x) ** 2 + 
          (m.pos.y - this.ship.pos.y) ** 2
        );
        if (hitDist < 25) {
          this.onShipHit(1);
          this.spawnExplosion(m.pos.x, m.pos.y, 20, '#ff4400');
          this.homingBullets.splice(i, 1);
          continue;
        }
      }
      
      // Remove if expired or off screen
      if (m.life <= 0 || m.pos.y > this.canvas.height + 50 || 
          m.pos.x < -50 || m.pos.x > this.canvas.width + 50) {
        this.homingBullets.splice(i, 1);
      }
    }
  }

  private enemyShoot(e: Enemy): void {
    const dx = this.ship.pos.x - e.pos.x;
    const dy = this.ship.pos.y - e.pos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const speed = 180;
    
    this.enemyBullets.push({
      pos: { x: e.pos.x, y: e.pos.y + e.height / 2 },
      vel: { x: (dx / dist) * speed, y: (dy / dist) * speed },
      size: 4,
      damage: 1,
      color: '#ff4444',
    });
    
    this.services?.audio?.playSound?.('click');
  }

  private updateEnemyBullets(dt: number): void {
    for (let i = this.enemyBullets.length - 1; i >= 0; i--) {
      const b = this.enemyBullets[i];
      b.pos.x += b.vel.x * dt;
      b.pos.y += b.vel.y * dt;
      
      if (b.pos.y < -20 || b.pos.y > this.canvas.height + 20 ||
          b.pos.x < -20 || b.pos.x > this.canvas.width + 20) {
        this.enemyBullets.splice(i, 1);
      }
    }
  }

  private updateBoss(dt: number): void {
    if (!this.boss) return;
    
    const b = this.boss;
    b.phaseTimer += dt;
    b.shootTimer -= dt;
    b.moveTimer -= dt;
    if (b.hitFlash > 0) b.hitFlash -= dt;
    
    // Track boss fight duration for stats
    if (b.entered) {
      this.bossTimer += dt;
    }
    
    // Entry animation
    if (!b.entered) {
      b.pos.y += 80 * dt;
      if (b.pos.y >= 100) {
        b.entered = true;
        b.targetX = this.canvas.width / 2;
      }
      return;
    }
    
    // Movement
    if (b.moveTimer <= 0) {
      b.targetX = Math.random() * (this.canvas.width - b.width - 100) + 50 + b.width / 2;
      b.moveTimer = 2;
    }
    
    const moveSpeed = 150 + (3 - b.phase) * 50;
    if (Math.abs(b.pos.x - b.targetX) > 5) {
      b.pos.x += Math.sign(b.targetX - b.pos.x) * moveSpeed * dt;
    }
    
    // Shooting based on phase
    if (b.shootTimer <= 0) {
      this.bossShoot(b);
    }
    
    // Phase transitions
    const hpPercent = b.hp / b.maxHp;
    if (hpPercent <= 0.3 && b.phase < 3) {
      b.phase = 3;
      this.triggerScreenShake(20, 0.5);
      this.spawnExplosion(b.pos.x, b.pos.y, 30, '#ffaa00');
    } else if (hpPercent <= 0.6 && b.phase < 2) {
      b.phase = 2;
      this.triggerScreenShake(15, 0.4);
      this.spawnExplosion(b.pos.x, b.pos.y, 20, '#ff6600');
    }
  }

  private bossShoot(b: Boss): void {
    const centerX = b.pos.x;
    const y = b.pos.y + b.height / 2;
    
    switch (b.phase) {
      case 1:
        // Simple spread
        for (let i = -2; i <= 2; i++) {
          this.enemyBullets.push({
            pos: { x: centerX, y },
            vel: { x: i * 60, y: 200 },
            size: 5,
            damage: 1,
            color: '#ff4488',
          });
        }
        b.shootTimer = 1.2;
        break;
        
      case 2:
        // Aimed burst + spread
        const dx = this.ship.pos.x - centerX;
        const dy = this.ship.pos.y - y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        for (let i = 0; i < 3; i++) {
          setTimeout(() => {
            if (this.boss) {
              this.enemyBullets.push({
                pos: { x: centerX, y },
                vel: { x: (dx / dist) * 250, y: (dy / dist) * 250 },
                size: 6,
                damage: 1,
                color: '#ff8844',
              });
            }
          }, i * 100);
        }
        
        // Side spread
        for (let i = -3; i <= 3; i++) {
          this.enemyBullets.push({
            pos: { x: centerX + i * 30, y },
            vel: { x: 0, y: 180 },
            size: 4,
            damage: 1,
            color: '#ff4488',
          });
        }
        b.shootTimer = 1.0;
        break;
        
      case 3:
        // Chaos mode: spiral + aimed
        const angle = b.phaseTimer * 5;
        for (let i = 0; i < 4; i++) {
          const a = angle + (Math.PI * 2 / 4) * i;
          this.enemyBullets.push({
            pos: { x: centerX, y },
            vel: { x: Math.cos(a) * 180, y: Math.sin(a) * 180 + 50 },
            size: 5,
            damage: 1,
            color: '#ff2266',
          });
        }
        
        // Occasional aimed shot
        if (Math.random() < 0.3) {
          const dx2 = this.ship.pos.x - centerX;
          const dy2 = this.ship.pos.y - y;
          const dist2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
          this.enemyBullets.push({
            pos: { x: centerX, y },
            vel: { x: (dx2 / dist2) * 280, y: (dy2 / dist2) * 280 },
            size: 8,
            damage: 2,
            color: '#ffff00',
          });
        }
        b.shootTimer = 0.3;
        break;
    }
    
    this.services?.audio?.playSound?.('click');
  }

  private updatePowerUps(dt: number): void {
    for (let i = this.powerUps.length - 1; i >= 0; i--) {
      const p = this.powerUps[i];
      p.pos.y += p.vel.y * dt;
      p.pulsePhase += dt * 4;
      
      if (p.pos.y > this.canvas.height + 50) {
        this.powerUps.splice(i, 1);
      }
    }
  }

  private updateParticles(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.pos.x += p.vel.x * dt;
      p.pos.y += p.vel.y * dt;
      p.life -= dt;
      p.rotation += p.rotationSpeed * dt;
      
      // Gravity for some particle types
      if (p.type === 'debris' || p.type === 'spark') {
        p.vel.y += 300 * dt;
      }
      
      // Fade and shrink
      if (p.type === 'smoke') {
        p.size += 20 * dt;
      }
      
      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  private updateScorePopups(dt: number): void {
    for (let i = this.scorePopups.length - 1; i >= 0; i--) {
      const p = this.scorePopups[i];
      p.pos.y -= 60 * dt;
      p.life -= dt;
      p.scale = Math.min(1, p.scale + dt * 3);
      
      if (p.life <= 0) {
        this.scorePopups.splice(i, 1);
      }
    }
  }

  private updateBackground(dt: number): void {
    // Parallax stars
    for (const star of this.stars) {
      star.y += star.z * 50 * dt;
      if (star.y > this.canvas.height) {
        star.y = -5;
        star.x = Math.random() * this.canvas.width;
      }
    }
    
    // Slow nebula drift
    for (const nebula of this.nebulae) {
      nebula.y += 15 * dt;
      if (nebula.y > this.canvas.height + nebula.radius) {
        nebula.y = -nebula.radius;
        nebula.x = Math.random() * this.canvas.width;
      }
    }
  }

  private updateWaveLogic(dt: number): void {
    if (this.boss) {
      // Boss active, don't spawn waves
      // IMPORTANT: Check bossDefeated flag to prevent calling onBossDefeated multiple times
      if (this.boss.hp <= 0 && !this.bossDefeated) {
        this.onBossDefeated();
      }
      return;
    }
    
    if (this.waveComplete) return;
    
    this.waveTime += dt;
    
    const waveIndex = Math.min(this.waveNumber - 1, WAVE_DEFINITIONS.length - 1);
    const wave = WAVE_DEFINITIONS[waveIndex];
    
    // Spawn enemies based on wave timing
    while (this.waveSpawnIndex < wave.length && wave[this.waveSpawnIndex].time <= this.waveTime) {
      const spawn = wave[this.waveSpawnIndex];
      this.spawnEnemyGroup(spawn.type as Enemy['type'], spawn.count, spawn.pattern);
      this.waveSpawnIndex++;
    }
    
    // Check wave completion
    if (this.waveSpawnIndex >= wave.length && this.enemies.length === 0) {
      this.onWaveComplete();
    }
  }

  private spawnEnemyGroup(type: Enemy['type'], count: number, pattern: string): void {
    const config = ENEMY_CONFIGS[type];
    
    // Assign a new group ID for this spawn group
    const groupId = ++this.currentGroupId;
    this.groupSizes.set(groupId, count);
    this.groupKills.set(groupId, 0);
    
    for (let i = 0; i < count; i++) {
      let x: number, delay: number;
      
      switch (pattern) {
        case 'line':
          x = ((i + 1) / (count + 1)) * this.canvas.width;
          delay = i * 0.15;
          break;
        case 'arc':
          const arcAngle = (Math.PI / (count + 1)) * (i + 1);
          x = this.canvas.width / 2 + Math.cos(arcAngle - Math.PI / 2) * 200;
          delay = Math.abs(i - count / 2) * 0.1;
          break;
        case 'v':
          x = this.canvas.width / 2 + (i - count / 2) * 50;
          delay = Math.abs(i - count / 2) * 0.2;
          break;
        case 'random':
        default:
          x = Math.random() * (this.canvas.width - 100) + 50;
          delay = i * 0.3;
          break;
      }
      
      setTimeout(() => {
        this.spawnEnemy(type, x, -50, groupId);
      }, delay * 1000);
    }
  }

  private spawnEnemy(type: Enemy['type'], x: number, y: number, groupId: number = 0): void {
    const config = ENEMY_CONFIGS[type];
    
    // Determine if this is an elite (higher chance in later levels)
    const eliteChance = ELITE_SPAWN_CHANCE + (this.levelNumber - 1) * 0.02; // +2% per level
    const isElite = Math.random() < eliteChance;
    
    // Calculate stats (elites are stronger)
    const hpMultiplier = isElite ? ELITE_HP_MULTIPLIER : 1;
    const sizeMultiplier = isElite ? ELITE_SIZE_MULTIPLIER : 1;
    const valueMultiplier = isElite ? ELITE_VALUE_MULTIPLIER : 1;
    
    const baseHp = config.hp + Math.floor((this.levelNumber - 1) * 0.3 * config.hp);
    const finalHp = Math.floor(baseHp * hpMultiplier);
    
    const enemy: Enemy = {
      pos: { x, y },
      vel: { x: 0, y: config.speed },
      width: Math.floor(config.width * sizeMultiplier),
      height: Math.floor(config.height * sizeMultiplier),
      hp: finalHp,
      maxHp: finalHp,
      type,
      t: 0,
      shootTimer: Math.random() * 2 + 1,
      startX: x,
      spinAngle: 0,
      spinRadius: 60,
      spinCenter: { x, y },
      value: Math.floor(config.value * valueMultiplier),
      hitFlash: 0,
      groupId,
      // Elite properties
      isElite,
      eliteShield: isElite && type === 'tanker' ? 3 : 0, // Tankers get regenerating shield
      eliteAbilityTimer: 0,
      homingTarget: null,
    };
    
    this.enemies.push(enemy);
    
    // Announce elite spawn
    if (isElite) {
      this.scorePopups.push({
        pos: { x, y: y + 30 },
        text: `⚠ ELITE ${type.toUpperCase()}!`,
        life: 1.5,
        color: '#ffcc00',
        scale: 0,
      });
    }
  }

  private onWaveComplete(): void {
    this.waveComplete = true;
    
    // Spawn power-up
    this.spawnPowerUp(this.canvas.width / 2, 100);
    
    setTimeout(() => {
      if (this.waveNumber >= 5) {
        // Spawn boss after wave 5
        this.spawnBoss();
      } else {
        this.waveNumber++;
        this.startWave(this.waveNumber);
      }
    }, 2000);
  }

  private startWave(num: number): void {
    this.waveNumber = num;
    this.waveTime = 0;
    this.waveSpawnIndex = 0;
    this.waveComplete = false;
    
    // Show wave notification
    this.scorePopups.push({
      pos: { x: this.canvas.width / 2, y: this.canvas.height / 2 },
      text: `WAVE ${num}`,
      life: 2,
      color: '#ffffff',
      scale: 0,
    });
    
    this.services?.audio?.playSound?.('success');
  }

  private spawnBoss(): void {
    // Boss HP scales significantly with level - should feel like a real fight!
    const bossBaseHp = 120;
    const bossHpPerLevel = 60;
    const bossHp = bossBaseHp + this.levelNumber * bossHpPerLevel;
    
    this.boss = {
      pos: { x: this.canvas.width / 2, y: -120 },
      width: 150,
      height: 100,
      hp: bossHp,
      maxHp: bossHp,
      phase: 1,
      phaseTimer: 0,
      shootTimer: 2,
      moveTimer: 0,
      targetX: this.canvas.width / 2,
      hitFlash: 0,
      entered: false,
    };
    
    this.scorePopups.push({
      pos: { x: this.canvas.width / 2, y: this.canvas.height / 2 },
      text: `WARNING: BOSS`,
      life: 3,
      color: '#ff4444',
      scale: 0,
    });
    
    this.services?.audio?.playSound?.('powerup');
    this.triggerScreenShake(10, 1);
  }

  private onBossDefeated(): void {
    // IMMEDIATELY set flag to prevent re-entry (fixes level jumping bug)
    this.bossDefeated = true;
    
    // Track stats for the stats screen
    this.levelStats = {
      shotsHit: this.shotsHitThisLevel,
      shotsFired: this.shotsFiredThisLevel,
      enemiesKilled: this.enemiesKilledThisLevel,
      damageTaken: this.damageTakenThisLevel,
      powerUpsCollected: this.powerUpsCollectedThisLevel,
      maxComboThisLevel: this.maxComboThisLevel,
      bossTime: this.bossTimer,
      groupClears: this.groupClearsThisLevel,
    };
    this.showingStats = true;
    this.statsTimer = 5; // Show stats for 5 seconds
    
    // Big explosion
    for (let i = 0; i < 5; i++) {
      setTimeout(() => {
        if (this.boss) {
          const ox = (Math.random() - 0.5) * this.boss.width;
          const oy = (Math.random() - 0.5) * this.boss.height;
          this.spawnExplosion(this.boss.pos.x + ox, this.boss.pos.y + oy, 40, '#ffaa00');
          this.triggerScreenShake(15, 0.3);
        }
      }, i * 200);
    }
    
    // Award big points
    const bossValue = 5000 + this.levelNumber * 2000;
    this.addScore(bossValue);
    this.pickups += 20;
    
    this.scorePopups.push({
      pos: { x: this.boss!.pos.x, y: this.boss!.pos.y },
      text: `+${bossValue}`,
      life: 2,
      color: '#ffff00',
      scale: 0,
    });
    
    this.services?.audio?.playSound?.('success');
  }
  
  private proceedToNextLevel(): void {
    this.boss = null;
    this.levelNumber++;
    
    // Clear remaining projectiles
    this.homingBullets = [];
    this.enemyBullets = [];
    
    // Reset level stats for next level
    this.shotsHitThisLevel = 0;
    this.shotsFiredThisLevel = 0;
    this.enemiesKilledThisLevel = 0;
    this.damageTakenThisLevel = 0;
    this.powerUpsCollectedThisLevel = 0;
    this.maxComboThisLevel = 0;
    this.bossTimer = 0;
    this.elitesKilledThisLevel = 0;
    
    // Reset group tracking for next level
    this.currentGroupId = 0;
    this.groupSizes.clear();
    this.groupKills.clear();
    this.groupClearsThisLevel = 0;
    
    // Start next level
    this.scorePopups.push({
      pos: { x: this.canvas.width / 2, y: this.canvas.height / 2 },
      text: `LEVEL ${this.levelNumber}`,
      life: 3,
      color: '#44ff44',
      scale: 0,
    });
    
    setTimeout(() => {
      this.bossDefeated = false;
      this.startWave(1);
    }, 2000);
  }

  private updateScreenShake(dt: number): void {
    if (this.screenShake.time > 0) {
      this.screenShake.time -= dt;
    }
    
    if (this.flashAlpha > 0) {
      this.flashAlpha -= dt * 3;
    }
  }

  private updateCombo(dt: number): void {
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.comboCount = 0;
      }
    }
  }

  // ============= COLLISION DETECTION =============

  private checkCollisions(): void {
    // Bullets vs Enemies
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      
      // Check against enemies
      for (let j = this.enemies.length - 1; j >= 0; j--) {
        const e = this.enemies[j];
        if (this.circleRect(b.pos.x, b.pos.y, b.size, 
            e.pos.x - e.width/2, e.pos.y - e.height/2, e.width, e.height)) {
          
          // Calculate damage with crit chance
          const critChance = this.shipUpgrades.critChance * 0.05; // 5% per level
          const isCrit = Math.random() < critChance;
          let damage = isCrit ? b.damage * 2 : b.damage;
          
          // Elite tanker shield absorbs damage
          if (e.isElite && e.type === 'tanker' && e.eliteShield > 0) {
            e.eliteShield--;
            e.hitFlash = 0.15;
            // Shield absorption effect
            this.spawnHitSparks(b.pos.x, b.pos.y, 8);
            this.particles.push({
              pos: { x: e.pos.x, y: e.pos.y },
              vel: { x: 0, y: 0 },
              life: 0.2,
              maxLife: 0.2,
              size: e.width,
              color: '#4488ff',
              type: 'ring',
              rotation: 0,
              rotationSpeed: 0,
            });
            if (!b.piercing) {
              this.bullets.splice(i, 1);
            }
            break;
          }
          
          e.hp -= damage;
          e.hitFlash = 0.1;
          
          // Track shots hit for stats
          this.shotsHitThisLevel++;
          
          // Spawn hit particles (more for crits)
          this.spawnHitSparks(b.pos.x, b.pos.y, isCrit ? 10 : 5);
          
          // Crit indicator
          if (isCrit) {
            this.scorePopups.push({
              pos: { x: b.pos.x, y: b.pos.y },
              text: 'CRIT!',
              life: 0.5,
              color: '#ff4444',
              scale: 0,
            });
          }
          
          if (!b.piercing) {
            this.bullets.splice(i, 1);
          }
          
          if (e.hp <= 0) {
            this.onEnemyKilled(e, j);
          }
          break;
        }
      }
      
      // Check against boss
      if (this.boss && this.boss.entered) {
        if (this.circleRect(b.pos.x, b.pos.y, b.size,
            this.boss.pos.x - this.boss.width/2, this.boss.pos.y - this.boss.height/2,
            this.boss.width, this.boss.height)) {
          
          // Crit chance on boss too
          const critChance = this.shipUpgrades.critChance * 0.05;
          const isCrit = Math.random() < critChance;
          const damage = isCrit ? b.damage * 2 : b.damage;
          
          this.boss.hp -= damage;
          this.boss.hitFlash = 0.1;
          this.spawnHitSparks(b.pos.x, b.pos.y, isCrit ? 6 : 3);
          
          if (isCrit) {
            this.scorePopups.push({
              pos: { x: b.pos.x, y: b.pos.y },
              text: 'CRIT!',
              life: 0.5,
              color: '#ff4444',
              scale: 0,
            });
          }
          
          // Track shots hit for stats
          this.shotsHitThisLevel++;
          
          if (!b.piercing) {
            this.bullets.splice(i, 1);
          }
        }
      }
    }
    
    // Enemy bullets vs Ship
    if (this.ship.invincibleTime <= 0) {
      for (let i = this.enemyBullets.length - 1; i >= 0; i--) {
        const b = this.enemyBullets[i];
        if (this.circleRect(b.pos.x, b.pos.y, b.size,
            this.ship.pos.x - this.ship.width/2, this.ship.pos.y - this.ship.height/2,
            this.ship.width, this.ship.height)) {
          this.enemyBullets.splice(i, 1);
          this.onShipHit(b.damage);
        }
      }
    }
    
    // Enemies vs Ship
    if (this.ship.invincibleTime <= 0) {
      for (const e of this.enemies) {
        if (this.rectRect(
            this.ship.pos.x - this.ship.width/2, this.ship.pos.y - this.ship.height/2,
            this.ship.width, this.ship.height,
            e.pos.x - e.width/2, e.pos.y - e.height/2, e.width, e.height)) {
          this.onShipHit(1);
          break;
        }
      }
    }
    
    // Power-ups vs Ship (with coin magnet upgrade)
    const magnetRange = this.ship.width / 2 + (this.shipUpgrades.coinMagnet * 20);
    for (let i = this.powerUps.length - 1; i >= 0; i--) {
      const p = this.powerUps[i];
      const dx = this.ship.pos.x - p.pos.x;
      const dy = this.ship.pos.y - p.pos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      // Magnet effect: pull power-ups toward player
      if (dist < magnetRange * 2 && dist > 0) {
        const pullStrength = 200 * (1 - dist / (magnetRange * 2));
        p.pos.x += (dx / dist) * pullStrength * 0.016; // Approximate dt
        p.pos.y += (dy / dist) * pullStrength * 0.016;
      }
      
      if (this.circleCircle(p.pos.x, p.pos.y, p.size,
          this.ship.pos.x, this.ship.pos.y, magnetRange)) {
        this.collectPowerUp(p);
        this.powerUps.splice(i, 1);
      }
    }
  }

  private circleRect(cx: number, cy: number, r: number, rx: number, ry: number, rw: number, rh: number): boolean {
    const closestX = Math.max(rx, Math.min(cx, rx + rw));
    const closestY = Math.max(ry, Math.min(cy, ry + rh));
    const dx = cx - closestX;
    const dy = cy - closestY;
    return (dx * dx + dy * dy) < (r * r);
  }

  private rectRect(x1: number, y1: number, w1: number, h1: number, x2: number, y2: number, w2: number, h2: number): boolean {
    return x1 < x2 + w2 && x1 + w1 > x2 && y1 < y2 + h2 && y1 + h1 > y2;
  }

  private circleCircle(x1: number, y1: number, r1: number, x2: number, y2: number, r2: number): boolean {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return (dx * dx + dy * dy) < (r1 + r2) * (r1 + r2);
  }

  private onEnemyKilled(e: Enemy, index: number): void {
    // Remove enemy
    this.enemies.splice(index, 1);
    
    // Elite kill tracking
    if (e.isElite) {
      this.elitesKilledThisLevel++;
    }
    
    // Explosion (bigger for elites)
    const explosionSize = e.isElite ? e.width * 1.5 : e.width;
    const explosionColor = e.isElite ? '#ffcc00' : this.getEnemyColor(e.type);
    this.spawnExplosion(e.pos.x, e.pos.y, explosionSize, explosionColor);
    
    // Extra explosion for elites
    if (e.isElite) {
      setTimeout(() => {
        this.spawnExplosion(e.pos.x + (Math.random() - 0.5) * 30, e.pos.y + (Math.random() - 0.5) * 30, 25, '#ffaa00');
      }, 100);
      this.triggerScreenShake(10, 0.2);
    }
    
    // Track group kills for group clear bonus
    if (e.groupId > 0) {
      const currentKills = (this.groupKills.get(e.groupId) || 0) + 1;
      this.groupKills.set(e.groupId, currentKills);
      
      const groupSize = this.groupSizes.get(e.groupId) || 0;
      if (currentKills === groupSize && groupSize > 1) {
        // Group cleared! Trigger bonus
        this.onGroupCleared(e.groupId, groupSize);
      }
    }
    
    // Combo system
    this.comboCount++;
    this.comboTimer = COMBO_TIMEOUT;
    if (this.comboCount > this.maxCombo) this.maxCombo = this.comboCount;
    if (this.comboCount > this.maxComboThisLevel) this.maxComboThisLevel = this.comboCount;
    
    // Track enemies killed for stats
    this.enemiesKilledThisLevel++;
    
    // Calculate score with combo multiplier
    const comboMultiplier = Math.min(1 + (this.comboCount - 1) * 0.1, 3);
    const points = Math.floor(e.value * comboMultiplier);
    this.addScore(points);
    this.totalKills++;
    
    // Score popup (golden for elites)
    const comboText = this.comboCount > 1 ? ` x${this.comboCount}` : '';
    const eliteText = e.isElite ? '★ ' : '';
    this.scorePopups.push({
      pos: { x: e.pos.x, y: e.pos.y },
      text: `${eliteText}+${points}${comboText}`,
      life: e.isElite ? 1.5 : 1,
      color: e.isElite ? '#ffcc00' : (this.comboCount > 5 ? '#ffff00' : this.comboCount > 3 ? '#ff8844' : '#ffffff'),
      scale: 0,
    });
    
    // Chance to drop power-up (higher for elites)
    const dropChance = e.isElite ? 0.5 : 0.08;
    if (Math.random() < dropChance) {
      this.spawnPowerUp(e.pos.x, e.pos.y);
    }
    
    // Elites drop a second power-up sometimes
    if (e.isElite && Math.random() < 0.3) {
      setTimeout(() => {
        this.spawnPowerUp(e.pos.x + (Math.random() - 0.5) * 40, e.pos.y);
      }, 200);
    }
    
    // Pickups (coins) - elites drop more
    const coinDrop = e.isElite ? 5 : 1;
    this.pickups += coinDrop;
    
    this.services?.audio?.playSound?.('coin');
    this.triggerScreenShake(e.isElite ? 8 : 5, 0.1);
  }
  
  private onGroupCleared(groupId: number, groupSize: number): void {
    // Calculate bonus based on group size
    const bonusScore = GROUP_CLEAR_BONUS_SCORE * groupSize;
    const bonusPickups = GROUP_CLEAR_BONUS_PICKUPS;
    
    // Award bonus
    this.addScore(bonusScore);
    this.pickups += bonusPickups;
    this.groupClearsThisLevel++;
    
    // Big flashy popup
    this.scorePopups.push({
      pos: { x: this.canvas.width / 2, y: this.canvas.height / 2 - 50 },
      text: `✦ PERFECT CLEAR! ✦`,
      life: 1.5,
      color: '#ffff00',
      scale: 0,
    });
    
    // Bonus score popup
    this.scorePopups.push({
      pos: { x: this.canvas.width / 2, y: this.canvas.height / 2 },
      text: `+${bonusScore} BONUS`,
      life: 1.5,
      color: '#44ffff',
      scale: 0,
    });
    
    // Spawn a guaranteed power-up for clearing a group
    this.spawnPowerUp(this.canvas.width / 2, 150);
    
    // Special ring explosion effect
    for (let i = 0; i < 20; i++) {
      const angle = (Math.PI * 2 / 20) * i;
      this.particles.push({
        pos: { x: this.canvas.width / 2, y: this.canvas.height / 2 },
        vel: { x: Math.cos(angle) * 300, y: Math.sin(angle) * 300 },
        life: 0.6,
        maxLife: 0.6,
        size: 6,
        color: '#ffff44',
        type: 'ring',
        rotation: 0,
        rotationSpeed: 0,
      });
    }
    
    // Screen flash and shake
    this.flashAlpha = 0.3;
    this.triggerScreenShake(12, 0.3);
    
    // Play success sound
    this.services?.audio?.playSound?.('success');
  }

  private onShipHit(damage: number): void {
    if (this.ship.shieldTime > 0) {
      // Shield absorbs hit
      this.spawnExplosion(this.ship.pos.x, this.ship.pos.y, 30, '#4488ff');
      this.services?.audio?.playSound?.('click');
      return;
    }
    
    this.ship.hp -= damage;
    this.ship.invincibleTime = INVINCIBLE_DURATION;
    
    // Track damage taken for stats
    this.damageTakenThisLevel += damage;
    
    // Lose weapon level on hit
    if (this.ship.weaponLevel > 1) {
      this.ship.weaponLevel--;
    }
    
    this.spawnExplosion(this.ship.pos.x, this.ship.pos.y, 20, '#ff4444');
    this.triggerScreenShake(15, 0.3);
    this.flashAlpha = 0.5;
    
    if (this.ship.hp <= 0) {
      this.onGameOver();
    } else {
      this.services?.audio?.playSound?.('game_over');
    }
  }

  private collectPowerUp(p: PowerUp): void {
    // Track power-ups collected for stats
    this.powerUpsCollectedThisLevel++;
    
    // Calculate upgraded shield duration
    const upgradedShieldDuration = SHIELD_DURATION + (this.shipUpgrades.shieldDuration * 2);
    
    switch (p.type) {
      case 'weapon':
        this.ship.weaponLevel = Math.min(5, this.ship.weaponLevel + 1);
        break;
      case 'speed':
        // Speed boost STACKS - add time instead of resetting
        this.ship.speedBoostTime += SPEED_BOOST_DURATION;
        break;
      case 'rapid':
        // Rapid fire STACKS - add time instead of resetting
        this.ship.rapidFireTime += RAPID_FIRE_DURATION;
        break;
      case 'shield':
        // Shield STACKS - add time instead of resetting (with upgrade bonus)
        this.ship.shieldTime += upgradedShieldDuration;
        break;
      case 'bomb':
        this.ship.bombs = Math.min(5 + this.shipUpgrades.startingBombs, this.ship.bombs + 1);
        break;
      case 'heal':
        this.ship.hp = Math.min(this.ship.maxHp, this.ship.hp + 1);
        break;
    }
    
    this.addScore(50);
    
    this.scorePopups.push({
      pos: { x: p.pos.x, y: p.pos.y },
      text: this.getPowerUpName(p.type),
      life: 1.5,
      color: '#44ff44',
      scale: 0,
    });
    
    this.services?.audio?.playSound?.('powerup');
  }

  private getPowerUpName(type: PowerUp['type']): string {
    switch (type) {
      case 'weapon': return 'POWER UP!';
      case 'speed': return 'SPEED BOOST!';
      case 'rapid': return 'RAPID FIRE!';
      case 'shield': return 'SHIELD!';
      case 'bomb': return '+BOMB';
      case 'heal': return '+HP';
      default: return 'BONUS';
    }
  }

  private useBomb(): void {
    if (this.ship.bombs <= 0) return;
    
    this.ship.bombs--;
    
    // Clear all enemy bullets
    this.enemyBullets = [];
    
    // Damage all enemies
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      e.hp -= 10;
      if (e.hp <= 0) {
        this.onEnemyKilled(e, i);
      } else {
        e.hitFlash = 0.3;
      }
    }
    
    // Damage boss
    if (this.boss && this.boss.entered) {
      this.boss.hp -= 15;
      this.boss.hitFlash = 0.3;
    }
    
    // Big screen effect
    this.flashAlpha = 1;
    this.triggerScreenShake(30, 0.5);
    
    // Ring particles
    for (let i = 0; i < 30; i++) {
      const angle = (Math.PI * 2 / 30) * i;
      this.particles.push({
        pos: { x: this.ship.pos.x, y: this.ship.pos.y },
        vel: { x: Math.cos(angle) * 400, y: Math.sin(angle) * 400 },
        life: 0.5,
        maxLife: 0.5,
        size: 8,
        color: '#ffffff',
        type: 'ring',
        rotation: 0,
        rotationSpeed: 0,
      });
    }
    
    this.services?.audio?.playSound?.('success');
  }

  private onGameOver(): void {
    // Prevent multiple game over triggers
    if (this.gameOver || this.hasEnded) return;
    
    this.gameOver = true;
    
    // Cache final values to prevent changes after game over
    this.cachedFinalScore = this.score;
    this.cachedFinalPickups = this.pickups;
    
    // Big ship explosion
    for (let i = 0; i < 8; i++) {
      setTimeout(() => {
        if (!this.hasEnded) {
          const ox = (Math.random() - 0.5) * this.ship.width;
          const oy = (Math.random() - 0.5) * this.ship.height;
          this.spawnExplosion(this.ship.pos.x + ox, this.ship.pos.y + oy, 30, '#ff6600');
          this.triggerScreenShake(20, 0.2);
        }
      }, i * 100);
    }
    
    this.services?.audio?.playSound?.('game_over');
    
    // Set extended data for achievements
    this.extendedGameData = {
      maxCombo: this.maxCombo,
      totalKills: this.totalKills,
      level: this.levelNumber,
      wave: this.waveNumber,
    };
    
    // End game after delay - only once!
    setTimeout(() => {
      if (!this.hasEnded) {
        this.hasEnded = true;
        this.endGame();
      }
    }, 1500);
  }

  // ============= SPAWN HELPERS =============

  private spawnPowerUp(x: number, y: number): void {
    const types: PowerUp['type'][] = ['weapon', 'weapon', 'weapon', 'speed', 'rapid', 'shield', 'bomb', 'heal'];
    const type = types[Math.floor(Math.random() * types.length)];
    
    this.powerUps.push({
      pos: { x, y },
      vel: { x: 0, y: 60 },
      type,
      size: 18,
      pulsePhase: 0,
    });
  }

  private spawnExplosion(x: number, y: number, size: number, color: string): void {
    // Core particles
    for (let i = 0; i < 15; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 200 + 100;
      this.particles.push({
        pos: { x, y },
        vel: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
        life: Math.random() * 0.5 + 0.3,
        maxLife: 0.8,
        size: Math.random() * size * 0.3 + 3,
        color,
        type: 'spark',
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 10,
      });
    }
    
    // Debris
    for (let i = 0; i < 5; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 150 + 50;
      this.particles.push({
        pos: { x, y },
        vel: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed - 50 },
        life: Math.random() * 0.8 + 0.4,
        maxLife: 1.2,
        size: Math.random() * 6 + 4,
        color: '#888888',
        type: 'debris',
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 15,
      });
    }
    
    // Smoke
    for (let i = 0; i < 3; i++) {
      this.particles.push({
        pos: { x: x + (Math.random() - 0.5) * 20, y: y + (Math.random() - 0.5) * 20 },
        vel: { x: (Math.random() - 0.5) * 30, y: -30 },
        life: Math.random() * 0.6 + 0.4,
        maxLife: 1,
        size: size * 0.4,
        color: 'rgba(100, 100, 100, 0.5)',
        type: 'smoke',
        rotation: 0,
        rotationSpeed: 0,
      });
    }
  }

  private spawnHitSparks(x: number, y: number, count: number): void {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 150 + 50;
      this.particles.push({
        pos: { x, y },
        vel: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
        life: Math.random() * 0.2 + 0.1,
        maxLife: 0.3,
        size: Math.random() * 3 + 2,
        color: '#ffff88',
        type: 'spark',
        rotation: 0,
        rotationSpeed: 0,
      });
    }
  }

  private spawnEngineTrail(): void {
    const offsetX = (Math.random() - 0.5) * 10;
    const isSpeedBoosted = this.ship.speedBoostTime > 0;
    
    // Use cyan/blue colors when speed boosted, orange/yellow normally
    const color = isSpeedBoosted 
      ? (Math.random() > 0.5 ? '#00ffff' : '#44aaff')
      : (Math.random() > 0.5 ? '#ff6600' : '#ffaa00');
    
    // Bigger, longer trails when speed boosted
    const size = isSpeedBoosted ? 6 + Math.random() * 6 : 4 + Math.random() * 4;
    const life = isSpeedBoosted ? 0.35 : 0.2;
    
    this.particles.push({
      pos: { x: this.ship.pos.x + offsetX, y: this.ship.pos.y + this.ship.height / 2 },
      vel: { x: offsetX * 2, y: 100 + Math.random() * 50 },
      life,
      maxLife: life,
      size,
      color,
      type: 'trail',
      rotation: 0,
      rotationSpeed: 0,
    });
  }

  private triggerScreenShake(intensity: number, duration: number): void {
    if (intensity > this.screenShake.intensity) {
      this.screenShake.intensity = intensity;
      this.screenShake.duration = duration;
      this.screenShake.time = duration;
    }
  }

  private addScore(points: number): void {
    // Don't add score after game over
    if (this.gameOver) return;
    this.score += points;
  }
  
  // Override getScore to return cached values after game over
  // This prevents the parent from recalculating rewards repeatedly
  getScore(): import('@/lib/types').GameScore {
    // If game is over, use cached values to prevent XP exploits
    const finalScore = this.gameOver ? this.cachedFinalScore : this.score;
    const finalPickups = this.gameOver ? this.cachedFinalPickups : this.pickups;
    
    const timePlayedMs = this.gameOver ? this.gameTime * 1000 : Date.now() - (this as any).startTime;
    const multiplier = this.services?.currency?.getBonusMultiplier?.() ?? 1;
    const coinsEarned = this.services?.currency?.calculateGameReward?.(
      finalScore,
      finalPickups,
      multiplier
    ) ?? 0;

    const baseScore = {
      score: finalScore,
      pickups: finalPickups,
      timePlayedMs,
      coinsEarned,
    };

    return this.extendedGameData 
      ? { ...baseScore, ...this.extendedGameData }
      : baseScore;
  }

  private getEnemyColor(type: Enemy['type']): string {
    switch (type) {
      case 'basic': return '#44aa44';
      case 'sine': return '#4488ff';
      case 'shooter': return '#ff8844';
      case 'diver': return '#ff4488';
      case 'spinner': return '#aa44ff';
      case 'tanker': return '#888888';
      default: return '#ffffff';
    }
  }

  // ============= RENDERING =============

  protected onRender(ctx: CanvasRenderingContext2D): void {
    // Apply screen shake
    ctx.save();
    if (this.screenShake.time > 0) {
      const shake = this.screenShake.intensity * (this.screenShake.time / this.screenShake.duration);
      ctx.translate(
        (Math.random() - 0.5) * shake,
        (Math.random() - 0.5) * shake
      );
    }
    
    // Background
    this.renderBackground(ctx);
    
    // Game objects
    this.renderPowerUps(ctx);
    this.renderEnemies(ctx);
    this.renderBoss(ctx);
    this.renderShip(ctx);
    this.renderBullets(ctx);
    this.renderEnemyBullets(ctx);
    this.renderHomingMissiles(ctx);
    this.renderParticles(ctx);
    this.renderScorePopups(ctx);
    
    ctx.restore();
    
    // UI (not affected by shake)
    this.renderHUD(ctx);
    
    // Screen flash
    if (this.flashAlpha > 0) {
      ctx.fillStyle = `rgba(255, 255, 255, ${this.flashAlpha})`;
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
    
    // Game over screen
    if (this.gameOver) {
      this.renderGameOver(ctx);
    }
    
    // Stats screen after boss defeat
    if (this.showingStats && this.levelStats) {
      this.renderStatsScreen(ctx);
    }
    
    // Upgrade shop
    if (this.showingShop) {
      this.renderUpgradeShop(ctx);
    }
  }
  
  private renderHomingMissiles(ctx: CanvasRenderingContext2D): void {
    for (const m of this.homingBullets) {
      ctx.save();
      ctx.translate(m.pos.x, m.pos.y);
      
      // Rotate to face direction
      const angle = Math.atan2(m.vel.y, m.vel.x) + Math.PI / 2;
      ctx.rotate(angle);
      
      // Missile body
      ctx.fillStyle = '#ff4400';
      ctx.shadowColor = '#ff4400';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.moveTo(0, -8);
      ctx.lineTo(-4, 6);
      ctx.lineTo(4, 6);
      ctx.closePath();
      ctx.fill();
      
      // Warhead
      ctx.fillStyle = '#ffcc00';
      ctx.beginPath();
      ctx.arc(0, -6, 2, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.shadowBlur = 0;
      ctx.restore();
    }
  }
  
  private renderUpgradeShop(ctx: CanvasRenderingContext2D): void {
    // Semi-transparent overlay
    ctx.fillStyle = 'rgba(0, 0, 30, 0.92)';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    const centerX = this.canvas.width / 2;
    const startY = 50;
    
    // Title
    ctx.fillStyle = '#44ffff';
    ctx.font = 'bold 32px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('⚙ UPGRADE SHOP ⚙', centerX, startY);
    
    // Coins display
    ctx.fillStyle = '#ffcc00';
    ctx.font = 'bold 24px Arial';
    ctx.fillText(`💰 ${this.totalCoinsEarned} COINS`, centerX, startY + 35);
    
    // Upgrade list
    const itemHeight = 55;
    const listStartY = startY + 70;
    const listWidth = 380;
    
    for (let i = 0; i < UPGRADE_DEFINITIONS.length; i++) {
      const upgrade = UPGRADE_DEFINITIONS[i];
      const currentLevel = this.shipUpgrades[upgrade.id];
      const isMaxed = currentLevel >= upgrade.maxLevel;
      const cost = isMaxed ? 0 : Math.floor(upgrade.baseCost * Math.pow(upgrade.costMultiplier, currentLevel));
      const canAfford = this.totalCoinsEarned >= cost;
      const isSelected = i === this.shopSelectedIndex;
      
      const y = listStartY + i * itemHeight;
      
      // Selection highlight
      if (isSelected) {
        ctx.fillStyle = 'rgba(68, 255, 255, 0.2)';
        ctx.fillRect(centerX - listWidth / 2 - 10, y - 20, listWidth + 20, itemHeight - 5);
        ctx.strokeStyle = '#44ffff';
        ctx.lineWidth = 2;
        ctx.strokeRect(centerX - listWidth / 2 - 10, y - 20, listWidth + 20, itemHeight - 5);
      }
      
      // Icon
      ctx.font = '24px Arial';
      ctx.textAlign = 'left';
      ctx.fillText(upgrade.icon, centerX - listWidth / 2, y);
      
      // Name
      ctx.fillStyle = isMaxed ? '#888888' : (isSelected ? '#ffffff' : '#cccccc');
      ctx.font = 'bold 18px Arial';
      ctx.fillText(upgrade.name, centerX - listWidth / 2 + 35, y - 3);
      
      // Description
      ctx.fillStyle = '#888888';
      ctx.font = '12px Arial';
      ctx.fillText(upgrade.description, centerX - listWidth / 2 + 35, y + 12);
      
      // Level indicators
      ctx.textAlign = 'right';
      for (let lvl = 0; lvl < upgrade.maxLevel; lvl++) {
        ctx.fillStyle = lvl < currentLevel ? '#44ff44' : '#333333';
        ctx.fillRect(centerX + listWidth / 2 - 80 + lvl * 14, y - 10, 10, 20);
      }
      
      // Cost or MAXED
      ctx.textAlign = 'right';
      if (isMaxed) {
        ctx.fillStyle = '#44ff44';
        ctx.font = 'bold 16px Arial';
        ctx.fillText('MAXED', centerX + listWidth / 2, y + 2);
      } else {
        ctx.fillStyle = canAfford ? '#ffcc00' : '#ff4444';
        ctx.font = 'bold 16px Arial';
        ctx.fillText(`${cost}`, centerX + listWidth / 2, y + 2);
      }
    }
    
    // Instructions
    ctx.fillStyle = '#666666';
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('↑↓ Navigate | SPACE/ENTER Buy | ESC Continue', centerX, this.canvas.height - 30);
    
    // Preview of selected upgrade effect
    const selectedUpgrade = UPGRADE_DEFINITIONS[this.shopSelectedIndex];
    const currentLvl = this.shipUpgrades[selectedUpgrade.id];
    if (currentLvl < selectedUpgrade.maxLevel) {
      ctx.fillStyle = '#44ffff';
      ctx.font = '14px Arial';
      ctx.fillText(`Current: Level ${currentLvl} → Level ${currentLvl + 1}`, centerX, this.canvas.height - 55);
    }
  }
  
  private renderStatsScreen(ctx: CanvasRenderingContext2D): void {
    if (!this.levelStats) return;
    
    // Semi-transparent overlay
    ctx.fillStyle = 'rgba(0, 0, 20, 0.85)';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    const centerX = this.canvas.width / 2;
    const startY = 80;
    
    // Title
    ctx.fillStyle = '#44ff44';
    ctx.font = 'bold 36px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`LEVEL ${this.levelNumber} COMPLETE!`, centerX, startY);
    
    // Decorative line
    ctx.strokeStyle = '#44ff44';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(centerX - 150, startY + 20);
    ctx.lineTo(centerX + 150, startY + 20);
    ctx.stroke();
    
    // Stats
    ctx.font = '20px Arial';
    ctx.textAlign = 'left';
    const leftX = centerX - 140;
    const rightX = centerX + 140;
    let y = startY + 60;
    const lineHeight = 35;
    
    // Accuracy
    const accuracy = this.levelStats.shotsFired > 0 
      ? Math.round((this.levelStats.shotsHit / this.levelStats.shotsFired) * 100) 
      : 0;
    const accuracyColor = accuracy >= 80 ? '#44ff44' : accuracy >= 50 ? '#ffff44' : '#ff8844';
    
    ctx.fillStyle = '#aaaaaa';
    ctx.fillText('Accuracy:', leftX, y);
    ctx.fillStyle = accuracyColor;
    ctx.textAlign = 'right';
    ctx.fillText(`${accuracy}%`, rightX, y);
    
    // Shots fired/hit
    y += lineHeight;
    ctx.fillStyle = '#aaaaaa';
    ctx.textAlign = 'left';
    ctx.fillText('Shots Fired:', leftX, y);
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'right';
    ctx.fillText(`${this.levelStats.shotsFired}`, rightX, y);
    
    y += lineHeight;
    ctx.fillStyle = '#aaaaaa';
    ctx.textAlign = 'left';
    ctx.fillText('Shots Hit:', leftX, y);
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'right';
    ctx.fillText(`${this.levelStats.shotsHit}`, rightX, y);
    
    // Enemies killed
    y += lineHeight;
    ctx.fillStyle = '#aaaaaa';
    ctx.textAlign = 'left';
    ctx.fillText('Enemies Destroyed:', leftX, y);
    ctx.fillStyle = '#ff8844';
    ctx.textAlign = 'right';
    ctx.fillText(`${this.levelStats.enemiesKilled}`, rightX, y);
    
    // Max combo
    y += lineHeight;
    ctx.fillStyle = '#aaaaaa';
    ctx.textAlign = 'left';
    ctx.fillText('Max Combo:', leftX, y);
    ctx.fillStyle = this.levelStats.maxComboThisLevel >= 10 ? '#ffff44' : '#ffffff';
    ctx.textAlign = 'right';
    ctx.fillText(`${this.levelStats.maxComboThisLevel}x`, rightX, y);
    
    // Damage taken
    y += lineHeight;
    ctx.fillStyle = '#aaaaaa';
    ctx.textAlign = 'left';
    ctx.fillText('Damage Taken:', leftX, y);
    ctx.fillStyle = this.levelStats.damageTaken === 0 ? '#44ff44' : '#ff4444';
    ctx.textAlign = 'right';
    ctx.fillText(`${this.levelStats.damageTaken}`, rightX, y);
    
    // Power-ups collected
    y += lineHeight;
    ctx.fillStyle = '#aaaaaa';
    ctx.textAlign = 'left';
    ctx.fillText('Power-ups Collected:', leftX, y);
    ctx.fillStyle = '#aa88ff';
    ctx.textAlign = 'right';
    ctx.fillText(`${this.levelStats.powerUpsCollected}`, rightX, y);
    
    // Perfect Clears (group clears)
    y += lineHeight;
    ctx.fillStyle = '#aaaaaa';
    ctx.textAlign = 'left';
    ctx.fillText('Perfect Clears:', leftX, y);
    ctx.fillStyle = this.levelStats.groupClears > 0 ? '#ffff44' : '#666666';
    ctx.textAlign = 'right';
    ctx.fillText(`${this.levelStats.groupClears}`, rightX, y);
    
    // Boss time
    y += lineHeight;
    ctx.fillStyle = '#aaaaaa';
    ctx.textAlign = 'left';
    ctx.fillText('Boss Fight Time:', leftX, y);
    ctx.fillStyle = '#4488ff';
    ctx.textAlign = 'right';
    const bossMinutes = Math.floor(this.levelStats.bossTime / 60);
    const bossSeconds = Math.floor(this.levelStats.bossTime % 60);
    ctx.fillText(`${bossMinutes}:${bossSeconds.toString().padStart(2, '0')}`, rightX, y);
    
    // Grade based on performance
    y += lineHeight + 20;
    const grade = this.calculateGrade();
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.fillStyle = grade.color;
    ctx.fillText(grade.letter, centerX, y);
    
    ctx.font = '16px Arial';
    ctx.fillStyle = '#888888';
    ctx.fillText(grade.description, centerX, y + 30);
    
    // Continue prompt
    ctx.font = '16px Arial';
    ctx.fillStyle = '#aaaaaa';
    ctx.textAlign = 'center';
    const blinkAlpha = 0.5 + 0.5 * Math.sin(this.gameTime * 4);
    ctx.globalAlpha = blinkAlpha;
    ctx.fillText('Press any key to continue...', centerX, this.canvas.height - 40);
    ctx.globalAlpha = 1;
    
    // Timer bar
    const timerWidth = 200;
    const timerHeight = 6;
    const timerX = centerX - timerWidth / 2;
    const timerY = this.canvas.height - 60;
    ctx.fillStyle = '#333333';
    ctx.fillRect(timerX, timerY, timerWidth, timerHeight);
    ctx.fillStyle = '#44ff44';
    ctx.fillRect(timerX, timerY, timerWidth * (this.statsTimer / 5), timerHeight);
  }
  
  private calculateGrade(): { letter: string; color: string; description: string } {
    if (!this.levelStats) return { letter: 'C', color: '#ffff44', description: 'Average' };
    
    const accuracy = this.levelStats.shotsFired > 0 
      ? (this.levelStats.shotsHit / this.levelStats.shotsFired) * 100 
      : 0;
    
    let score = 0;
    
    // Accuracy bonus (0-30 points)
    score += Math.min(30, accuracy * 0.4);
    
    // No damage bonus (20 points)
    if (this.levelStats.damageTaken === 0) score += 20;
    else if (this.levelStats.damageTaken === 1) score += 10;
    
    // Combo bonus (0-15 points)
    score += Math.min(15, this.levelStats.maxComboThisLevel * 1.5);
    
    // Perfect clears bonus (0-20 points) - reward for clearing groups!
    score += Math.min(20, this.levelStats.groupClears * 4);
    
    // Speed bonus (0-15 points) - faster boss kill = more points
    if (this.levelStats.bossTime < 30) score += 15;
    else if (this.levelStats.bossTime < 60) score += 12;
    else if (this.levelStats.bossTime < 90) score += 8;
    else score += 4;
    
    if (score >= 90) return { letter: 'S', color: '#ffff44', description: 'PERFECT!' };
    if (score >= 80) return { letter: 'A', color: '#44ff44', description: 'Excellent!' };
    if (score >= 70) return { letter: 'B', color: '#4488ff', description: 'Great!' };
    if (score >= 50) return { letter: 'C', color: '#ffaa44', description: 'Good' };
    return { letter: 'D', color: '#ff4444', description: 'Keep practicing!' };
  }

  private renderBackground(ctx: CanvasRenderingContext2D): void {
    // Deep space gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, this.canvas.height);
    gradient.addColorStop(0, '#0a0a15');
    gradient.addColorStop(0.5, '#0f0f25');
    gradient.addColorStop(1, '#151530');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Nebulae
    for (const nebula of this.nebulae) {
      const grad = ctx.createRadialGradient(
        nebula.x, nebula.y, 0,
        nebula.x, nebula.y, nebula.radius
      );
      grad.addColorStop(0, nebula.color);
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.fillRect(nebula.x - nebula.radius, nebula.y - nebula.radius, nebula.radius * 2, nebula.radius * 2);
    }
    
    // Stars
    for (const star of this.stars) {
      const alpha = star.brightness * (0.5 + 0.5 * Math.sin(this.gameTime * star.z));
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private renderShip(ctx: CanvasRenderingContext2D): void {
    if (this.gameOver) return;
    
    // Invincibility flicker
    if (this.ship.invincibleTime > 0 && Math.floor(this.ship.invincibleTime * 10) % 2 === 0) {
      ctx.globalAlpha = 0.5;
    }
    
    const x = this.ship.pos.x;
    const y = this.ship.pos.y;
    const w = this.ship.width;
    const h = this.ship.height;
    
    // Shield effect
    if (this.ship.shieldTime > 0) {
      ctx.strokeStyle = '#4488ff';
      ctx.lineWidth = 3;
      ctx.globalAlpha = 0.5 + 0.3 * Math.sin(this.gameTime * 8);
      ctx.beginPath();
      ctx.arc(x, y, w * 0.8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    
    // Main body
    ctx.fillStyle = '#3388ff';
    ctx.beginPath();
    ctx.moveTo(x, y - h / 2); // Nose
    ctx.lineTo(x - w / 2, y + h / 2); // Left wing
    ctx.lineTo(x - w / 4, y + h / 4); // Left inner
    ctx.lineTo(x, y + h / 3); // Bottom center
    ctx.lineTo(x + w / 4, y + h / 4); // Right inner
    ctx.lineTo(x + w / 2, y + h / 2); // Right wing
    ctx.closePath();
    ctx.fill();
    
    // Cockpit
    ctx.fillStyle = '#66ccff';
    ctx.beginPath();
    ctx.ellipse(x, y - h / 6, w / 6, h / 5, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Engine glow
    ctx.fillStyle = '#ff6600';
    ctx.beginPath();
    ctx.moveTo(x - w / 4, y + h / 3);
    ctx.lineTo(x, y + h / 2 + 5 + Math.random() * 8);
    ctx.lineTo(x + w / 4, y + h / 3);
    ctx.closePath();
    ctx.fill();
    
    // Wing details
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - w / 3, y);
    ctx.lineTo(x - w / 2 + 5, y + h / 3);
    ctx.moveTo(x + w / 3, y);
    ctx.lineTo(x + w / 2 - 5, y + h / 3);
    ctx.stroke();
    
    ctx.globalAlpha = 1;
  }

  private renderBullets(ctx: CanvasRenderingContext2D): void {
    for (const b of this.bullets) {
      // Glow
      ctx.shadowBlur = 10;
      ctx.shadowColor = b.color;
      
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.ellipse(b.pos.x, b.pos.y, b.size / 2, b.size, 0, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.shadowBlur = 0;
    }
  }

  private renderEnemyBullets(ctx: CanvasRenderingContext2D): void {
    for (const b of this.enemyBullets) {
      ctx.shadowBlur = 8;
      ctx.shadowColor = b.color;
      
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.arc(b.pos.x, b.pos.y, b.size, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.shadowBlur = 0;
    }
  }

  private renderEnemies(ctx: CanvasRenderingContext2D): void {
    for (const e of this.enemies) {
      const x = e.pos.x;
      const y = e.pos.y;
      const w = e.width;
      const h = e.height;
      
      // Elite glow effect
      if (e.isElite) {
        ctx.save();
        ctx.shadowColor = '#ffcc00';
        ctx.shadowBlur = 20;
        ctx.fillStyle = 'rgba(255, 204, 0, 0.3)';
        ctx.beginPath();
        ctx.arc(x, y, Math.max(w, h) * 0.7, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        
        // Elite tanker shield indicator
        if (e.type === 'tanker' && e.eliteShield > 0) {
          ctx.strokeStyle = `rgba(68, 136, 255, ${0.3 + e.eliteShield * 0.2})`;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(x, y, Math.max(w, h) * 0.6, 0, Math.PI * 2);
          ctx.stroke();
          
          // Shield count
          for (let s = 0; s < e.eliteShield; s++) {
            const angle = (Math.PI * 2 / 3) * s - Math.PI / 2;
            ctx.fillStyle = '#4488ff';
            ctx.beginPath();
            ctx.arc(x + Math.cos(angle) * 25, y + Math.sin(angle) * 25, 5, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
      
      // Hit flash
      if (e.hitFlash > 0) {
        ctx.globalAlpha = 0.8;
      }
      
      const baseColor = e.isElite ? '#ffcc00' : this.getEnemyColor(e.type);
      
      switch (e.type) {
        case 'basic':
          // Simple triangle enemy
          ctx.fillStyle = e.hitFlash > 0 ? '#ffffff' : baseColor;
          ctx.beginPath();
          ctx.moveTo(x, y + h / 2);
          ctx.lineTo(x - w / 2, y - h / 2);
          ctx.lineTo(x + w / 2, y - h / 2);
          ctx.closePath();
          ctx.fill();
          
          // Eye
          ctx.fillStyle = e.isElite ? '#ff0000' : '#ff4444';
          ctx.beginPath();
          ctx.arc(x, y, e.isElite ? 6 : 4, 0, Math.PI * 2);
          ctx.fill();
          break;
          
        case 'sine':
          // Wavy fish-like enemy
          ctx.fillStyle = e.hitFlash > 0 ? '#ffffff' : baseColor;
          ctx.beginPath();
          ctx.ellipse(x, y, w / 2, h / 3, 0, 0, Math.PI * 2);
          ctx.fill();
          
          // Fins
          ctx.beginPath();
          ctx.moveTo(x - w / 4, y - h / 3);
          ctx.lineTo(x, y - h / 2);
          ctx.lineTo(x + w / 4, y - h / 3);
          ctx.fill();
          
          // Eye
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(x + w / 4, y - 3, 4, 0, Math.PI * 2);
          ctx.fill();
          break;
          
        case 'shooter':
          // Armed enemy with gun
          ctx.fillStyle = e.hitFlash > 0 ? '#ffffff' : baseColor;
          ctx.fillRect(x - w / 2, y - h / 3, w, h * 2 / 3);
          
          // Turret
          ctx.fillStyle = e.isElite ? '#884400' : '#666666';
          ctx.beginPath();
          ctx.arc(x, y + h / 3, w / 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillRect(x - 3, y + h / 3, 6, h / 3);
          
          // Windows
          ctx.fillStyle = '#ffaa44';
          ctx.fillRect(x - w / 3, y - h / 6, w / 6, h / 6);
          ctx.fillRect(x + w / 6, y - h / 6, w / 6, h / 6);
          break;
          
        case 'diver':
          // Pointed dive-bomber
          ctx.fillStyle = e.hitFlash > 0 ? '#ffffff' : baseColor;
          ctx.beginPath();
          ctx.moveTo(x, y + h / 2);
          ctx.lineTo(x - w / 2, y - h / 4);
          ctx.lineTo(x - w / 4, y - h / 2);
          ctx.lineTo(x + w / 4, y - h / 2);
          ctx.lineTo(x + w / 2, y - h / 4);
          ctx.closePath();
          ctx.fill();
          
          // Stripe
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(x - w / 3, y - h / 4);
          ctx.lineTo(x + w / 3, y - h / 4);
          ctx.stroke();
          break;
          
        case 'spinner':
          // Rotating enemy
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(e.spinAngle);
          
          ctx.fillStyle = e.hitFlash > 0 ? '#ffffff' : baseColor;
          for (let i = 0; i < 4; i++) {
            ctx.rotate(Math.PI / 2);
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(-w / 4, -h / 2);
            ctx.lineTo(w / 4, -h / 2);
            ctx.closePath();
            ctx.fill();
          }
          
          // Center
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(0, 0, w / 6, 0, Math.PI * 2);
          ctx.fill();
          
          ctx.restore();
          break;
          
        case 'tanker':
          // Heavy armored enemy
          ctx.fillStyle = e.hitFlash > 0 ? '#ffffff' : baseColor;
          ctx.fillRect(x - w / 2, y - h / 2, w, h);
          
          // Armor plates
          ctx.fillStyle = '#555555';
          ctx.fillRect(x - w / 2 + 5, y - h / 2 + 5, w - 10, h / 4);
          ctx.fillRect(x - w / 2 + 5, y + h / 4 - 5, w - 10, h / 4);
          
          // Guns
          ctx.fillStyle = '#444444';
          ctx.fillRect(x - w / 2, y + h / 3, 10, 15);
          ctx.fillRect(x + w / 2 - 10, y + h / 3, 10, 15);
          
          // HP bar
          ctx.fillStyle = '#333333';
          ctx.fillRect(x - w / 2, y - h / 2 - 10, w, 5);
          ctx.fillStyle = '#44ff44';
          ctx.fillRect(x - w / 2, y - h / 2 - 10, w * (e.hp / e.maxHp), 5);
          break;
      }
      
      ctx.globalAlpha = 1;
    }
  }

  private renderBoss(ctx: CanvasRenderingContext2D): void {
    if (!this.boss) return;
    
    const b = this.boss;
    const x = b.pos.x;
    const y = b.pos.y;
    const w = b.width;
    const h = b.height;
    
    // Hit flash
    if (b.hitFlash > 0) {
      ctx.globalAlpha = 0.8;
    }
    
    // Phase colors
    const bodyColors = ['#664488', '#886644', '#884444'];
    const glowColors = ['#aa88ff', '#ffaa88', '#ff8888'];
    const bodyColor = b.hitFlash > 0 ? '#ffffff' : bodyColors[b.phase - 1];
    const glowColor = glowColors[b.phase - 1];
    
    // Glow effect
    ctx.shadowBlur = 20;
    ctx.shadowColor = glowColor;
    
    // Main body
    ctx.fillStyle = bodyColor;
    ctx.beginPath();
    ctx.moveTo(x, y - h / 2);
    ctx.lineTo(x - w / 2, y);
    ctx.lineTo(x - w / 3, y + h / 2);
    ctx.lineTo(x + w / 3, y + h / 2);
    ctx.lineTo(x + w / 2, y);
    ctx.closePath();
    ctx.fill();
    
    ctx.shadowBlur = 0;
    
    // Core
    ctx.fillStyle = glowColor;
    ctx.beginPath();
    ctx.ellipse(x, y, w / 4, h / 3, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Pulsing eye
    const eyeSize = 15 + Math.sin(this.gameTime * 5) * 3;
    ctx.fillStyle = '#ff0000';
    ctx.beginPath();
    ctx.arc(x, y, eyeSize, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x, y, eyeSize / 2, 0, Math.PI * 2);
    ctx.fill();
    
    // Wing cannons
    ctx.fillStyle = '#444444';
    ctx.fillRect(x - w / 2 - 10, y - 10, 20, 30);
    ctx.fillRect(x + w / 2 - 10, y - 10, 20, 30);
    
    // HP bar
    ctx.fillStyle = '#333333';
    ctx.fillRect(x - w / 2, y - h / 2 - 20, w, 10);
    ctx.fillStyle = b.phase === 3 ? '#ff4444' : b.phase === 2 ? '#ffaa44' : '#44ff44';
    ctx.fillRect(x - w / 2, y - h / 2 - 20, w * (b.hp / b.maxHp), 10);
    
    // Phase indicators
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = i < b.phase ? '#ff4444' : '#444444';
      ctx.beginPath();
      ctx.arc(x - 20 + i * 20, y - h / 2 - 35, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    
    ctx.globalAlpha = 1;
  }

  private renderPowerUps(ctx: CanvasRenderingContext2D): void {
    for (const p of this.powerUps) {
      const pulse = 1 + Math.sin(p.pulsePhase) * 0.2;
      const size = p.size * pulse;
      
      // Glow
      ctx.shadowBlur = 15;
      ctx.shadowColor = this.getPowerUpColor(p.type);
      
      // Outer ring
      ctx.strokeStyle = this.getPowerUpColor(p.type);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.pos.x, p.pos.y, size, 0, Math.PI * 2);
      ctx.stroke();
      
      // Inner icon
      ctx.fillStyle = this.getPowerUpColor(p.type);
      ctx.font = `bold ${size}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.getPowerUpIcon(p.type), p.pos.x, p.pos.y);
      
      ctx.shadowBlur = 0;
    }
  }

  private getPowerUpColor(type: PowerUp['type']): string {
    switch (type) {
      case 'weapon': return '#ff8844';
      case 'speed': return '#44ffff';  // Cyan for speed
      case 'rapid': return '#ffff44';
      case 'shield': return '#4488ff';
      case 'bomb': return '#ff4444';
      case 'heal': return '#44ff44';
      default: return '#ffffff';
    }
  }

  private getPowerUpIcon(type: PowerUp['type']): string {
    switch (type) {
      case 'weapon': return 'P';
      case 'speed': return 'S';  // S for Speed
      case 'rapid': return 'R';
      case 'shield': return 'O';
      case 'bomb': return 'B';
      case 'heal': return '+';
      default: return '?';
    }
  }

  private renderParticles(ctx: CanvasRenderingContext2D): void {
    for (const p of this.particles) {
      const alpha = p.life / p.maxLife;
      ctx.globalAlpha = alpha;
      
      switch (p.type) {
        case 'spark':
        case 'trail':
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.pos.x, p.pos.y, p.size * alpha, 0, Math.PI * 2);
          ctx.fill();
          break;
          
        case 'smoke':
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.pos.x, p.pos.y, p.size, 0, Math.PI * 2);
          ctx.fill();
          break;
          
        case 'debris':
          ctx.save();
          ctx.translate(p.pos.x, p.pos.y);
          ctx.rotate(p.rotation);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
          ctx.restore();
          break;
          
        case 'ring':
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 3 * alpha;
          ctx.beginPath();
          ctx.arc(p.pos.x, p.pos.y, p.size + (1 - alpha) * 50, 0, Math.PI * 2);
          ctx.stroke();
          break;
      }
    }
    ctx.globalAlpha = 1;
  }

  private renderScorePopups(ctx: CanvasRenderingContext2D): void {
    for (const p of this.scorePopups) {
      const alpha = Math.min(1, p.life);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.font = `bold ${16 * p.scale}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(p.text, p.pos.x, p.pos.y);
    }
    ctx.globalAlpha = 1;
  }

  private renderHUD(ctx: CanvasRenderingContext2D): void {
    const padding = 15;
    
    // Score
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`SCORE: ${this.score.toLocaleString()}`, padding, 35);
    
    // Level & Wave
    ctx.font = '16px Arial';
    ctx.fillStyle = '#aaaaaa';
    ctx.fillText(`LEVEL ${this.levelNumber} - WAVE ${this.waveNumber}/5`, padding, 58);
    
    // Combo
    if (this.comboCount > 1) {
      ctx.fillStyle = this.comboCount > 10 ? '#ffff00' : this.comboCount > 5 ? '#ff8844' : '#ffffff';
      ctx.font = 'bold 20px Arial';
      ctx.fillText(`${this.comboCount}x COMBO`, padding, 85);
    }
    
    // HP
    ctx.fillStyle = '#888888';
    ctx.fillRect(padding, this.canvas.height - 40, 120, 20);
    ctx.fillStyle = this.ship.hp <= 1 ? '#ff4444' : '#44ff44';
    ctx.fillRect(padding, this.canvas.height - 40, 120 * (this.ship.hp / this.ship.maxHp), 20);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.strokeRect(padding, this.canvas.height - 40, 120, 20);
    ctx.fillStyle = '#ffffff';
    ctx.font = '12px Arial';
    ctx.fillText(`HP: ${this.ship.hp}/${this.ship.maxHp}`, padding + 35, this.canvas.height - 26);
    
    // Bombs
    ctx.fillStyle = '#ffffff';
    ctx.font = '16px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`BOMBS: `, padding + 140, this.canvas.height - 26);
    for (let i = 0; i < this.ship.bombs; i++) {
      ctx.fillStyle = '#ff4444';
      ctx.beginPath();
      ctx.arc(padding + 210 + i * 20, this.canvas.height - 30, 8, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // Weapon level
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffffff';
    ctx.font = '14px Arial';
    const weaponText = `WEAPON LV.${this.ship.weaponLevel}`;
    ctx.fillText(weaponText, this.canvas.width - padding, this.canvas.height - 26);
    
    // Power-up timers
    let timerY = this.canvas.height - 60;
    if (this.ship.shieldTime > 0) {
      ctx.fillStyle = '#4488ff';
      ctx.fillText(`SHIELD: ${this.ship.shieldTime.toFixed(1)}s`, this.canvas.width - padding, timerY);
      timerY -= 20;
    }
    if (this.ship.rapidFireTime > 0) {
      ctx.fillStyle = '#ffff44';
      ctx.fillText(`RAPID: ${this.ship.rapidFireTime.toFixed(1)}s`, this.canvas.width - padding, timerY);
      timerY -= 20;
    }
    if (this.ship.speedBoostTime > 0) {
      ctx.fillStyle = '#44ffff';
      ctx.fillText(`SPEED: ${this.ship.speedBoostTime.toFixed(1)}s`, this.canvas.width - padding, timerY);
    }
    
    // Pickups (coins)
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffcc00';
    ctx.font = 'bold 20px Arial';
    ctx.fillText(`💰 ${this.pickups}`, this.canvas.width - padding, 35);
    
    // Controls hint
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('WASD/Arrows: Move | Space/J/Z: Fire | B: Bomb | R: Restart', this.canvas.width / 2, this.canvas.height - 10);
  }

  private renderGameOver(ctx: CanvasRenderingContext2D): void {
    // Dark overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Game Over text
    ctx.fillStyle = '#ff4444';
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('GAME OVER', this.canvas.width / 2, this.canvas.height / 2 - 60);
    
    // Stats
    ctx.fillStyle = '#ffffff';
    ctx.font = '24px Arial';
    ctx.fillText(`Final Score: ${this.score.toLocaleString()}`, this.canvas.width / 2, this.canvas.height / 2);
    ctx.font = '18px Arial';
    ctx.fillText(`Level ${this.levelNumber} - Wave ${this.waveNumber}`, this.canvas.width / 2, this.canvas.height / 2 + 35);
    ctx.fillText(`Enemies Destroyed: ${this.totalKills}`, this.canvas.width / 2, this.canvas.height / 2 + 60);
    ctx.fillText(`Max Combo: ${this.maxCombo}x`, this.canvas.width / 2, this.canvas.height / 2 + 85);
    
    // Coins earned
    ctx.fillStyle = '#ffcc00';
    ctx.font = 'bold 22px Arial';
    ctx.fillText(`💰 +${this.pickups * 10} Coins`, this.canvas.width / 2, this.canvas.height / 2 + 120);
    
    // Restart hint
    ctx.fillStyle = '#aaaaaa';
    ctx.font = '16px Arial';
    ctx.fillText('Press R to Restart', this.canvas.width / 2, this.canvas.height / 2 + 160);
  }

  // ============= LIFECYCLE METHODS =============

  protected onRestart(): void {
    // Reset all game state
    this.initShip();
    this.initBackground();
    
    this.bullets = [];
    this.enemyBullets = [];
    this.enemies = [];
    this.boss = null;
    this.powerUps = [];
    this.particles = [];
    this.scorePopups = [];
    this.homingBullets = [];
    
    this.waveNumber = 1;
    this.waveTime = 0;
    this.waveSpawnIndex = 0;
    this.waveComplete = false;
    this.bossDefeated = false;
    this.levelNumber = 1;
    this.gameOver = false;
    
    this.fireTimer = 0;
    this.comboCount = 0;
    this.comboTimer = 0;
    this.maxCombo = 0;
    this.totalKills = 0;
    
    this.screenShake = { intensity: 0, duration: 0, time: 0 };
    this.flashAlpha = 0;
    
    // Reset stats tracking
    this.shotsHitThisLevel = 0;
    this.shotsFiredThisLevel = 0;
    this.enemiesKilledThisLevel = 0;
    this.damageTakenThisLevel = 0;
    this.powerUpsCollectedThisLevel = 0;
    this.maxComboThisLevel = 0;
    this.bossTimer = 0;
    this.levelStats = null;
    this.showingStats = false;
    this.statsTimer = 0;
    
    // Reset group tracking
    this.currentGroupId = 0;
    this.groupSizes.clear();
    this.groupKills.clear();
    this.groupClearsThisLevel = 0;
    
    // Reset elite tracking
    this.elitesKilledThisLevel = 0;
    
    // Reset shop state (but NOT upgrades or totalCoinsEarned - those persist!)
    this.showingShop = false;
    this.shopSelectedIndex = 0;
    
    // Reset end game flags
    this.hasEnded = false;
    this.cachedFinalScore = 0;
    this.cachedFinalPickups = 0;
    
    this.startWave(1);
    this.services?.audio?.playSound?.('powerup');
  }

  protected onPause(): void {
    // Could add pause screen rendering
  }

  protected onResume(): void {
    // Resume game
  }

  protected onDestroy(): void {
    this.keys.clear();
  }
}