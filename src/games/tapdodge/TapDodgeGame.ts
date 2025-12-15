// ===== src/games/tapdodge/TapDodgeGame.ts =====
import { BaseGame } from '@/games/shared/BaseGame';
import { GameManifest } from '@/lib/types';

// Entities
import { Player } from './entities/Player';
import { Obstacle, ObstacleConfig } from './entities/Obstacle';
import { Coin } from './entities/Coin';
import { PowerUp, PowerUpType, POWERUP_CONFIG } from './entities/PowerUp';
import { Gem } from './entities/Gem';

// Systems
import { ParticleSystem } from './systems/ParticleSystem';
import { ScreenShake } from './systems/ScreenShake';
import { ComboSystem } from './systems/ComboSystem';
import { WaveSystem, ZoneConfig } from './systems/WaveSystem';
import { BackgroundSystem } from './systems/BackgroundSystem';
import { FeverSystem } from './systems/FeverSystem';
import { LaneWarningSystem } from './systems/LaneWarningSystem';

interface ActivePowerUp {
  type: PowerUpType;
  duration: number;
  maxDuration: number;
}

interface Popup {
  x: number;
  y: number;
  text: string;
  life: number;
  color: string;
}

interface Bullet {
  x: number;
  y: number;
  vy: number;
}

export class TapDodgeGame extends BaseGame {
  manifest: GameManifest = {
    id: 'tapdodge',
    title: 'Tap Dodge',
    thumbnail: '/games/tapdodge/tapdodge-thumb.svg',
    inputSchema: ['touch', 'keyboard'],
    assetBudgetKB: 60,
    tier: 0,
    description: 'Survive the onslaught! Dodge falling obstacles, collect coins, and master near-misses.'
  };

  // ===== Entities =====
  private player!: Player;
  private obstacles: Obstacle[] = [];
  private coins: Coin[] = [];
  private gems: Gem[] = [];
  private powerUps: PowerUp[] = [];
  private bullets: Bullet[] = [];

  // ===== Systems =====
  private particles!: ParticleSystem;
  private screenShake!: ScreenShake;
  private comboSystem!: ComboSystem;
  private waveSystem!: WaveSystem;
  private backgroundSystem!: BackgroundSystem;
  private feverSystem!: FeverSystem;
  private laneWarningSystem!: LaneWarningSystem;

  // ===== Power-ups =====
  private activePowerUps: ActivePowerUp[] = [];
  private readonly MAGNET_RANGE = 150;
  private readonly MAGNET_STRENGTH = 250;

  // ===== Game State =====
  private lives: number = 3;
  private isStarted: boolean = false;
  private readyTimer: number = 1.5;
  private spawnTimer: number = 0;
  private droneFireTimer: number = 0;

  // ===== Popups =====
  private popups: Popup[] = [];

  // ===== Timers =====
  private slowMoTimer: number = 0;
  private finishingTimer: number = 0;

  // ===== Input =====
  private lastTouchX: number = 0;
  private hasTouchInput: boolean = false;
  private lastMoveDir: number = 0;

  // ===== Stats =====
  private highScore: number = 0;
  private gameStartTime: number = 0;
  private gemsCollected: number = 0;

  // ===== Visual State =====
  private bannerText: string = '';
  private bannerTimer: number = 0;
  private currentZoneColors = {
    primary: '#1E3A5F',
    secondary: '#0D1B2A',
    accent: '#22D3EE'
  };

  // ===== Stats Recap =====
  private showingRecap: boolean = false;
  private recapTimer: number = 0;
  private recapAnimPhase: number = 0;
  private recapStats: {
    score: number;
    highScore: number;
    isNewRecord: boolean;
    survivalTime: number;
    nearMisses: number;
    maxChain: number;
    coinsCollected: number;
    gemsCollected: number;
    maxFever: number;
    zoneReached: number;
    bossesCleared: number;
  } | null = null;

  protected onInit(): void {
    // Initialize systems
    this.particles = new ParticleSystem();
    this.screenShake = new ScreenShake();
    this.comboSystem = new ComboSystem();
    this.waveSystem = new WaveSystem();
    this.backgroundSystem = new BackgroundSystem(this.canvas.width, this.canvas.height);
    this.feverSystem = new FeverSystem();
    this.laneWarningSystem = new LaneWarningSystem(this.canvas.width);

    // Initialize player
    this.player = new Player(this.canvas.width, this.canvas.height);

    // Set up wave system callbacks
    this.waveSystem.setOnZoneChange((zone: ZoneConfig) => {
      this.showBanner(zone.name);
      this.currentZoneColors = zone.colors;
      this.services.audio.playSound('success');
    });

    this.waveSystem.setOnBossWaveWarning((countdown: number) => {
      this.showBanner(`BOSS WAVE IN ${countdown}!`);
      this.particles.createBossWarning(this.canvas.width, this.canvas.height);
      this.services.audio.playSound('click');
    });

    this.waveSystem.setOnBossWaveStart(() => {
      this.showBanner('SURVIVE!');
      this.screenShake.shake(8, 0.5);
      this.services.audio.playSound('powerup');
    });

    this.waveSystem.setOnBossWaveEnd((survived: boolean) => {
      if (survived) {
        this.showBanner('BOSS CLEARED! +500');
        this.score += 500;
        this.particles.createCoinShower(this.canvas.width);
        this.services.audio.playSound('unlock');
      }
    });

    // Load high score
    try {
      const saved = localStorage.getItem('tapdodge_best');
      this.highScore = saved ? parseInt(saved, 10) || 0 : 0;
    } catch { /* ignore */ }

    this.showBanner('Tap Dodge');
  }

  protected onRestart(): void {
    // Reset state
    this.obstacles = [];
    this.coins = [];
    this.gems = [];
    this.powerUps = [];
    this.bullets = [];
    this.activePowerUps = [];
    this.popups = [];
    this.lives = 3;
    this.isStarted = false;
    this.readyTimer = 1.5;
    this.spawnTimer = 0;
    this.slowMoTimer = 0;
    this.finishingTimer = 0;
    this.droneFireTimer = 0;
    this.gemsCollected = 0;

    // Reset systems
    this.particles.clear();
    this.screenShake.stop();
    this.comboSystem.resetAll();
    this.waveSystem.reset();
    this.feverSystem.reset();
    this.laneWarningSystem.clearWarnings();

    // Reset player
    this.player = new Player(this.canvas.width, this.canvas.height);

    this.currentZoneColors = {
      primary: '#1E3A5F',
      secondary: '#0D1B2A',
      accent: '#22D3EE'
    };

    this.showBanner('Ready');
  }

  protected onUpdate(dt: number): void {
    // Handle stats recap
    if (this.showingRecap) {
      this.updateRecap(dt);
      return;
    }

    // Handle finishing sequence
    if (this.finishingTimer > 0) {
      this.updateFinishingSequence(dt);
      return;
    }

    // Handle ready countdown
    if (!this.isStarted) {
      this.updateReadyPhase(dt);
      return;
    }

    // Calculate speed scale (slow-mo effects)
    const speedScale = this.getSpeedScale();
    const scaledDt = dt * speedScale;

    // Update input
    this.handleInput();

    // Update systems
    this.waveSystem.update(scaledDt);
    this.backgroundSystem.update(scaledDt, this.waveSystem.getSpeedMultiplier());
    this.particles.update(dt); // Particles don't slow down
    this.screenShake.update(dt);
    this.comboSystem.update(dt);
    this.feverSystem.update(dt); // Fever tracks real time
    this.laneWarningSystem.update(dt);
    this.updatePowerUps(dt);

    // Update entities
    this.player.update(dt);
    this.updateObstacles(scaledDt);
    this.updateCoins(scaledDt);
    this.updateGems(scaledDt);
    this.updatePowerUpEntities(scaledDt);
    this.updateBullets(scaledDt);
    this.updatePopups(dt);

    // Update lane warnings based on current obstacles/gems
    this.updateLaneWarnings();

    // Spawn logic
    this.handleSpawning(scaledDt);

    // Collision detection
    this.checkCollisions();

    // Score from survival (apply fever multiplier)
    this.score += Math.floor(scaledDt * 100 * this.feverSystem.getMultiplier());

    // Update slow-mo timer
    if (this.slowMoTimer > 0) {
      this.slowMoTimer -= dt;
    }

    // Track high score
    if (this.score > this.highScore) {
      this.highScore = this.score;
    }
  }

  private getSpeedScale(): number {
    // Slow time power-up
    if (this.hasPowerUp('slow')) return 0.5;
    // Near-miss slow-mo
    if (this.slowMoTimer > 0) return 0.65;
    return 1;
  }

  private updateReadyPhase(dt: number): void {
    if (this.readyTimer > 0) {
      this.readyTimer -= dt;
    }

    // Check for input to start
    const touches = this.services.input.getTouches?.() || [];
    const keyPressed = this.services.input.isLeftPressed() || this.services.input.isRightPressed() || this.services.input.isActionPressed();

    if (touches.length > 0 || keyPressed || this.readyTimer <= 0) {
      this.isStarted = true;
      this.gameStartTime = Date.now();
      this.player.setInvulnerable(0.8);
      this.services.audio.playSound('click');
    }

    // Still update visual systems
    this.player.update(dt);
    this.particles.update(dt);
    this.backgroundSystem.update(dt * 0.5, 1);
  }

  private updateFinishingSequence(dt: number): void {
    this.finishingTimer -= dt;
    this.particles.update(dt);
    this.updatePopups(dt);

    if (this.finishingTimer <= 0) {
      this.endGame();
    }
  }

  private updateRecap(dt: number): void {
    this.recapTimer += dt;
    this.recapAnimPhase += dt * 4;
    this.particles.update(dt);
    this.backgroundSystem.update(dt * 0.2, 0.3);

    // Continue to game over after player input or 8 seconds
    const touches = this.services.input.getTouches?.() || [];
    const keyPressed = this.services.input.isActionPressed?.() || this.services.input.isKeyPressed?.('Space') || this.services.input.isKeyPressed?.('Enter');

    if ((this.recapTimer > 2 && (touches.length > 0 || keyPressed)) || this.recapTimer > 8) {
      this.showingRecap = false;
      this.finishingTimer = 0.5;
    }
  }

  private handleInput(): void {
    // Touch input
    const touches = this.services.input.getTouches?.() || [];
    if (touches.length > 0) {
      const touch = touches[0];
      this.player.moveToPosition(touch.x);
      this.hasTouchInput = true;
      this.lastTouchX = touch.x;
    }

    // Keyboard input
    if (this.services.input.isLeftPressed()) {
      if (this.lastMoveDir !== -1) {
        this.player.moveLeft();
        this.lastMoveDir = -1;
      }
    } else if (this.services.input.isRightPressed()) {
      if (this.lastMoveDir !== 1) {
        this.player.moveRight();
        this.lastMoveDir = 1;
      }
    } else {
      this.lastMoveDir = 0;
    }

    // Up/Down input for laser dodge
    if (this.services.input.isUpPressed?.() || this.services.input.isKeyPressed?.('ArrowUp') || this.services.input.isKeyPressed?.('KeyW')) {
      this.player.jump();
    }
    if (this.services.input.isDownPressed?.() || this.services.input.isKeyPressed?.('ArrowDown') || this.services.input.isKeyPressed?.('KeyS')) {
      this.player.duck();
    }

    // Pause toggle
    const pausePressed = this.services.input.isKeyPressed?.('Escape') || this.services.input.isKeyPressed?.('KeyP');
    if (pausePressed && !this.isPaused) {
      this.pause();
    }
  }

  private handleSpawning(dt: number): void {
    this.spawnTimer += dt;

    const spawnInterval = this.waveSystem.getSpawnInterval();
    if (this.spawnTimer >= spawnInterval) {
      this.spawnTimer = 0;

      // Decide what pattern to spawn
      if (this.waveSystem.shouldSpawnWall()) {
        this.spawnWallWithGap();
      } else {
        this.spawnSingleObstacle();
      }

      // Power-up spawning
      if (this.waveSystem.shouldSpawnPowerUp()) {
        this.spawnPowerUp();
      }
    }
  }

  private spawnSingleObstacle(): void {
    const laneCount = 5;
    const laneWidth = this.canvas.width / laneCount;
    const lane = Math.floor(Math.random() * laneCount);

    const obstacleType = this.waveSystem.getRandomObstacleType();
    const baseSpeed = 180 * this.waveSystem.getSpeedMultiplier();

    const config: ObstacleConfig = {
      x: lane * laneWidth + laneWidth * 0.1,
      y: -40,
      width: laneWidth * 0.8,
      height: 30 + Math.random() * 20,
      speed: baseSpeed + Math.random() * 40,
      type: obstacleType === 'wall' ? 'block' : obstacleType,
      isDestructible: true
    };

    // Moving obstacles oscillate
    if (obstacleType === 'moving') {
      config.movingRange = laneWidth * 0.8;
    }

    this.obstacles.push(new Obstacle(config));

    // Random chance to spawn laser instead (10% chance after zone 2)
    if (this.waveSystem.getZoneIndex() >= 1 && Math.random() < 0.1) {
      this.spawnLaser();
    }

    // Random chance to spawn coin or gem alongside
    if (Math.random() < 0.3) {
      const coinLane = (lane + 1 + Math.floor(Math.random() * 3)) % laneCount;
      const coinX = coinLane * laneWidth + laneWidth / 2;

      // 1 in 8 chance for gem instead of coin
      if (Math.random() < 0.125) {
        this.gems.push(new Gem(coinX, -50, baseSpeed));
      } else {
        this.coins.push(new Coin(coinX, -50, baseSpeed));
      }
    }
  }

  private spawnLaser(): void {
    const baseSpeed = 150 * this.waveSystem.getSpeedMultiplier();
    const isHigh = Math.random() < 0.5;

    const config: ObstacleConfig = {
      x: 0,
      y: -30,
      width: this.canvas.width,
      height: 20,
      speed: baseSpeed,
      type: 'laser',
      laserPosition: isHigh ? 'high' : 'low',
      isDestructible: false
    };

    this.obstacles.push(new Obstacle(config));
  }

  private spawnWallWithGap(): void {
    const laneCount = 5;
    const laneWidth = this.canvas.width / laneCount;
    const gapLane = Math.floor(Math.random() * laneCount);
    const baseSpeed = 160 * this.waveSystem.getSpeedMultiplier();

    for (let lane = 0; lane < laneCount; lane++) {
      if (lane === gapLane) continue;

      const config: ObstacleConfig = {
        x: lane * laneWidth + laneWidth * 0.05,
        y: -30,
        width: laneWidth * 0.9,
        height: 28,
        speed: baseSpeed,
        type: 'wall',
        isDestructible: false
      };

      this.obstacles.push(new Obstacle(config));
    }

    // Spawn coin or gem in the gap
    const collectibleX = gapLane * laneWidth + laneWidth / 2;
    if (Math.random() < 0.125) {
      this.gems.push(new Gem(collectibleX, -50, baseSpeed));
    } else {
      this.coins.push(new Coin(collectibleX, -50, baseSpeed));
    }
  }

  private spawnPowerUp(): void {
    const types: PowerUpType[] = ['shield', 'magnet', 'slow', 'ghost', 'drone'];
    const type = types[Math.floor(Math.random() * types.length)];

    const laneCount = 5;
    const laneWidth = this.canvas.width / laneCount;
    const lane = Math.floor(Math.random() * laneCount);
    const x = lane * laneWidth + laneWidth / 2;
    const speed = 120 + Math.random() * 40;

    this.powerUps.push(new PowerUp(x, -30, speed, type));
  }

  private updateObstacles(dt: number): void {
    const speedMult = this.waveSystem.getSpeedMultiplier();

    for (const obstacle of this.obstacles) {
      obstacle.update(dt, speedMult);
    }

    this.obstacles = this.obstacles.filter(o => !o.isOffScreen(this.canvas.height));
  }

  private updateCoins(dt: number): void {
    const speedMult = this.waveSystem.getSpeedMultiplier();
    const hasMagnet = this.hasPowerUp('magnet');

    for (const coin of this.coins) {
      coin.update(dt, speedMult);

      // Magnet attraction
      if (hasMagnet) {
        const dx = this.player.getCenterX() - coin.x;
        const dy = this.player.getCenterY() - coin.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < this.MAGNET_RANGE) {
          coin.attractTo(this.player.getCenterX(), this.player.getCenterY(), this.MAGNET_STRENGTH, dt);
        }
      }
    }

    this.coins = this.coins.filter(c => !c.isOffScreen(this.canvas.height));
  }

  private updateGems(dt: number): void {
    const speedMult = this.waveSystem.getSpeedMultiplier();
    const hasMagnet = this.hasPowerUp('magnet');

    for (const gem of this.gems) {
      gem.update(dt, speedMult);

      // Magnet attraction (stronger for gems!)
      if (hasMagnet) {
        const dx = this.player.getCenterX() - gem.x;
        const dy = this.player.getCenterY() - gem.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < this.MAGNET_RANGE * 1.5) {
          gem.attractTo(this.player.getCenterX(), this.player.getCenterY(), this.MAGNET_STRENGTH * 1.5, dt);
        }
      }
    }

    this.gems = this.gems.filter(g => !g.isOffScreen(this.canvas.height));
  }

  private updatePowerUpEntities(dt: number): void {
    const speedMult = this.waveSystem.getSpeedMultiplier();

    for (const powerUp of this.powerUps) {
      powerUp.update(dt, speedMult);
    }

    this.powerUps = this.powerUps.filter(p => !p.isOffScreen(this.canvas.height));
  }

  private updatePowerUps(dt: number): void {
    // Decay active power-ups
    this.activePowerUps = this.activePowerUps.filter(p => {
      p.duration -= dt;
      return p.duration > 0;
    });

    // Drone shooting
    if (this.hasPowerUp('drone')) {
      this.droneFireTimer -= dt;
      if (this.droneFireTimer <= 0) {
        this.droneFireTimer = 0.3;
        this.fireDroneBullet();
      }
    }
  }

  private updateBullets(dt: number): void {
    for (const bullet of this.bullets) {
      bullet.y += bullet.vy * dt;
    }

    // Check bullet-obstacle collisions
    for (const bullet of this.bullets) {
      for (const obstacle of this.obstacles) {
        if (obstacle.isDestructible && !obstacle.isDestroyed) {
          const bounds = obstacle.getBounds();
          if (bullet.x > bounds.x && bullet.x < bounds.x + bounds.w &&
            bullet.y > bounds.y && bullet.y < bounds.y + bounds.h) {
            obstacle.destroy();
            bullet.y = -100; // Remove bullet

            this.score += 80;
            this.addPopup(bounds.x + bounds.w / 2, bounds.y, '+80', '#F59E0B');
            this.particles.createObstacleDestroy(bounds.x + bounds.w / 2, bounds.y + bounds.h / 2);
            this.screenShake.shake(4, 0.15);
            this.services.audio.playSound('success');
          }
        }
      }
    }

    this.bullets = this.bullets.filter(b => b.y > -20);
  }

  private fireDroneBullet(): void {
    this.bullets.push({
      x: this.player.getCenterX(),
      y: this.player.y - 10,
      vy: -400
    });
    this.particles.createDroneShot(this.player.getCenterX(), this.player.y);
    this.services.audio.playSound('click');
  }

  private updatePopups(dt: number): void {
    for (const popup of this.popups) {
      popup.y -= 40 * dt;
      popup.life -= dt;
    }
    this.popups = this.popups.filter(p => p.life > 0);
  }

  private updateLaneWarnings(): void {
    // Only show lane warnings during fever mode
    if (this.feverSystem.getLevel() < 1) return;

    const laneCount = 5;
    const laneWidth = this.canvas.width / laneCount;

    // Add warnings for obstacles (not lasers since they span all lanes)
    for (const obstacle of this.obstacles) {
      if (obstacle.y < 100 && obstacle.type !== 'laser') {
        const lane = Math.floor((obstacle.x + obstacle.width / 2) / laneWidth);
        const timeToImpact = (this.player.y - obstacle.y) / obstacle.speed;
        this.laneWarningSystem.addWarning(lane, timeToImpact, 'obstacle');
      }
    }

    // Add warnings for gems (positive indicator)
    for (const gem of this.gems) {
      if (gem.y < 100) {
        const lane = Math.floor(gem.x / laneWidth);
        const timeToImpact = (this.player.y - gem.y) / gem.speed;
        this.laneWarningSystem.addWarning(lane, timeToImpact, 'gem');
      }
    }
  }

  private checkCollisions(): void {
    const playerBounds = this.player.getBounds();
    const hasGhost = this.hasPowerUp('ghost');

    // Obstacle collisions
    if (!hasGhost) {
      for (const obstacle of this.obstacles) {
        if (obstacle.isDestroyed) continue;

        const obsBounds = obstacle.getBounds();

        // Special handling for laser obstacles
        if (obstacle.type === 'laser') {
          const isInLaserZone = this.intersects(playerBounds, obsBounds);

          if (isInLaserZone) {
            // Check if player is correctly dodging
            const isDodgingCorrectly =
              (obstacle.laserPosition === 'high' && this.player.getIsDucking()) ||
              (obstacle.laserPosition === 'low' && this.player.getIsJumping());

            if (isDodgingCorrectly) {
              // Successfully dodging - set visual feedback
              obstacle.setDodging(true);

              // Award near-miss if not already
              if (!obstacle.isNearMissed) {
                obstacle.isNearMissed = true;
                const result = this.comboSystem.addNearMiss();
                const bonus = Math.floor(result.bonus * 2 * this.feverSystem.getMultiplier());
                this.score += bonus;
                this.addPopup(this.player.getCenterX(), this.player.y - 30, `DODGE! +${bonus}`, '#22D3EE');
                this.particles.createNearMiss(this.player.getCenterX(), this.player.getCenterY());
                this.services.audio.playSound('success');
              }
            } else {
              // Not dodging correctly - hit!
              obstacle.setDodging(false);
              if (!this.player.isInvulnerable()) {
                const tookDamage = this.player.takeDamage();
                if (tookDamage) {
                  this.lives--;
                  this.feverSystem.onDamage();
                  this.particles.createExplosion(this.player.getCenterX(), this.player.getCenterY(), '#EF4444');
                  this.screenShake.shake(10, 0.4);
                  this.services.audio.playSound('collision');

                  if (this.lives <= 0) {
                    this.triggerGameOver();
                    return;
                  }
                }
              }
            }
          } else {
            obstacle.setDodging(false);
          }
          continue;
        }

        // Regular obstacle collision
        if (this.intersects(playerBounds, obsBounds)) {
          // Hit!
          if (this.player.isInvulnerable()) {
            // Absorb hit
            this.screenShake.shake(5, 0.3);
            continue;
          }

          // Take damage
          const tookDamage = this.player.takeDamage();
          if (tookDamage) {
            this.lives--;
            this.feverSystem.onDamage(); // Reset fever!
            this.particles.createExplosion(this.player.getCenterX(), this.player.getCenterY(), '#EF4444');
            this.screenShake.shake(10, 0.4);
            this.services.audio.playSound('collision');

            // Check game over
            if (this.lives <= 0) {
              this.triggerGameOver();
              return;
            }
          }
          continue;
        }

        // Near-miss detection
        if (!obstacle.isNearMissed) {
          const nearDist = this.getNearMissDistance(playerBounds, obsBounds);
          if (nearDist < 35 && nearDist > 0) {
            obstacle.isNearMissed = true;

            const result = this.comboSystem.addNearMiss();
            const feverBonus = Math.floor(result.bonus * this.feverSystem.getMultiplier());
            this.score += feverBonus;

            this.addPopup(
              this.player.getCenterX(),
              this.player.y - 20,
              `Near! +${feverBonus}`,
              '#60A5FA'
            );

            this.particles.createNearMiss(this.player.getCenterX(), this.player.getCenterY());
            this.slowMoTimer = 0.4;
            this.screenShake.shake(3, 0.1);
            this.services.audio.playSound('success');
            this.services.analytics.trackFeatureUsage('tapdodge_near_miss');
          }
        }
      }
    }

    // Coin collisions
    for (const coin of this.coins) {
      if (coin.isCollected) continue;

      const coinBounds = coin.getBounds();
      if (this.intersects(playerBounds, coinBounds)) {
        coin.collect();

        const multiplier = this.comboSystem.addCoin();
        const coinValue = Math.floor(100 * multiplier * this.feverSystem.getMultiplier());
        this.score += coinValue;
        this.pickups++;

        this.addPopup(coin.x, coin.y - 10, `+${coinValue}`, '#FBBF24');
        this.particles.createCoinPickup(coin.x, coin.y);
        this.services.audio.playSound('coin');
      }
    }

    // Gem collisions
    for (const gem of this.gems) {
      if (gem.isCollected) continue;

      const gemBounds = gem.getBounds();
      if (this.intersects(playerBounds, gemBounds)) {
        gem.collect();
        this.gemsCollected++;

        const multiplier = this.comboSystem.addCoin();
        const gemValue = Math.floor(500 * multiplier * this.feverSystem.getMultiplier());
        this.score += gemValue;
        this.pickups++;

        this.addPopup(gem.x, gem.y - 10, `💎 +${gemValue}`, '#A855F7');
        this.particles.createPowerUpPickup(gem.x, gem.y, '#A855F7');
        this.screenShake.shake(5, 0.2);
        this.services.audio.playSound('powerup');
        this.services.analytics.trackFeatureUsage('tapdodge_gem_collected');
      }
    }

    // Power-up collisions
    for (const powerUp of this.powerUps) {
      if (powerUp.isCollected) continue;

      const puBounds = powerUp.getBounds();
      if (this.intersects(playerBounds, puBounds)) {
        powerUp.collect();
        this.activatePowerUp(powerUp.type);

        this.addPopup(powerUp.x, powerUp.y - 10, POWERUP_CONFIG[powerUp.type].icon, '#FFFFFF');
        this.particles.createPowerUpPickup(powerUp.x, powerUp.y, POWERUP_CONFIG[powerUp.type].color);
        this.screenShake.shake(4, 0.15);
        this.services.audio.playSound('powerup');
        this.services.analytics.trackFeatureUsage('tapdodge_power', { type: powerUp.type });
      }
    }
  }

  private intersects(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }): boolean {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  private getNearMissDistance(player: { x: number; y: number; w: number; h: number }, obstacle: { x: number; y: number; w: number; h: number }): number {
    const px = player.x + player.w / 2;
    const py = player.y + player.h / 2;

    const closestX = Math.max(obstacle.x, Math.min(px, obstacle.x + obstacle.w));
    const closestY = Math.max(obstacle.y, Math.min(py, obstacle.y + obstacle.h));

    return Math.sqrt((px - closestX) ** 2 + (py - closestY) ** 2);
  }

  private activatePowerUp(type: PowerUpType): void {
    const duration = POWERUP_CONFIG[type].duration;

    // Check if already active
    const existing = this.activePowerUps.find(p => p.type === type);
    if (existing) {
      existing.duration += duration;
      existing.maxDuration += duration;
    } else {
      this.activePowerUps.push({ type, duration, maxDuration: duration });
    }

    // Special effects
    if (type === 'shield') {
      this.player.setInvulnerable(duration);
    }

    this.showBanner(type.toUpperCase() + ' ACTIVATED!');
  }

  private hasPowerUp(type: PowerUpType): boolean {
    return this.activePowerUps.some(p => p.type === type);
  }

  private triggerGameOver(): void {
    this.particles.createDeathExplosion(this.player.getCenterX(), this.player.getCenterY(), this.canvas.width);
    this.screenShake.shake(15, 0.8);

    // Fail boss wave if active
    this.waveSystem.failBossWave();

    // Calculate stats for recap
    const survivalTime = this.gameStartTime > 0 ? (Date.now() - this.gameStartTime) / 1000 : 0;
    const isNewRecord = this.score > this.highScore;

    this.recapStats = {
      score: this.score,
      highScore: Math.max(this.score, this.highScore),
      isNewRecord,
      survivalTime,
      nearMisses: this.comboSystem.getTotalNearMisses(),
      maxChain: this.comboSystem.getMaxNearMissChain(),
      coinsCollected: this.pickups,
      gemsCollected: this.gemsCollected,
      maxFever: this.feverSystem.getMaxLevelReached(),
      zoneReached: this.waveSystem.getZoneIndex(),
      bossesCleared: this.waveSystem.getBossesCleared()
    };

    // Show recap instead of immediately ending
    this.showingRecap = true;
    this.recapTimer = 0;
    this.recapAnimPhase = 0;

    this.services.analytics.trackFeatureUsage('tapdodge_game_over', {
      score: this.score,
      zone: this.waveSystem.getZoneIndex()
    });
  }

  private addPopup(x: number, y: number, text: string, color: string): void {
    this.popups.push({ x, y, text, life: 0.8, color });
  }

  private showBanner(text: string): void {
    this.bannerText = text;
    this.bannerTimer = 2.0;
  }

  // ===== RENDERING =====

  protected onRender(ctx: CanvasRenderingContext2D): void {
    ctx.save();

    // Apply screen shake
    const shakeOffset = this.screenShake.getOffset();
    ctx.translate(shakeOffset.x, shakeOffset.y);

    // Background
    this.backgroundSystem.render(ctx, this.currentZoneColors);

    // Fever overlay
    this.feverSystem.render(ctx, this.canvas.width, this.canvas.height);

    // Boss warning overlay
    if (this.waveSystem.isBossWarningActive()) {
      this.backgroundSystem.renderBossWarning(ctx, this.waveSystem.getBossWarningTimeLeft());
    }

    // Lane warnings at top
    this.laneWarningSystem.render(ctx);

    // Obstacles
    for (const obstacle of this.obstacles) {
      obstacle.render(ctx);
    }

    // Coins
    for (const coin of this.coins) {
      coin.render(ctx);
    }

    // Gems
    for (const gem of this.gems) {
      gem.render(ctx);
    }

    // Power-ups
    for (const powerUp of this.powerUps) {
      powerUp.render(ctx);
    }

    // Bullets
    ctx.fillStyle = '#60A5FA';
    for (const bullet of this.bullets) {
      ctx.beginPath();
      ctx.arc(bullet.x, bullet.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Player
    this.player.render(ctx, this.hasPowerUp('shield'), this.hasPowerUp('ghost'));

    // Particles
    this.particles.render(ctx);

    // Slow-mo vignette
    if (this.slowMoTimer > 0 || this.hasPowerUp('slow')) {
      const intensity = this.hasPowerUp('slow') ? 1 : this.slowMoTimer / 0.4;
      this.backgroundSystem.renderSlowMoVignette(ctx, intensity);
    }

    // Danger vignette (low lives)
    if (this.lives === 1) {
      const pulse = Math.sin(this.gameTime * 4) * 0.3 + 0.4;
      this.backgroundSystem.renderDangerVignette(ctx, pulse);
    }

    ctx.restore();

    // Popups (not affected by shake)
    this.renderPopups(ctx);

    // Banner
    this.renderBanner(ctx);
  }

  private renderPopups(ctx: CanvasRenderingContext2D): void {
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';

    for (const popup of this.popups) {
      ctx.globalAlpha = Math.min(1, popup.life * 2);
      ctx.fillStyle = popup.color;
      ctx.fillText(popup.text, popup.x, popup.y);
    }

    ctx.globalAlpha = 1;
  }

  private renderBanner(ctx: CanvasRenderingContext2D): void {
    if (this.bannerTimer <= 0) return;

    this.bannerTimer -= 1 / 60;
    const alpha = Math.min(1, this.bannerTimer);

    ctx.save();
    ctx.globalAlpha = alpha;

    // Banner background
    const bannerWidth = this.canvas.width * 0.7;
    const bannerHeight = 50;
    const bannerY = 80;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect((this.canvas.width - bannerWidth) / 2, bannerY, bannerWidth, bannerHeight);

    // Banner border
    ctx.strokeStyle = this.currentZoneColors.accent;
    ctx.lineWidth = 2;
    ctx.strokeRect((this.canvas.width - bannerWidth) / 2, bannerY, bannerWidth, bannerHeight);

    // Banner text
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.bannerText, this.canvas.width / 2, bannerY + bannerHeight / 2);

    ctx.restore();
  }

  private renderRecap(ctx: CanvasRenderingContext2D): void {
    if (!this.recapStats) return;

    const stats = this.recapStats;
    const cx = this.canvas.width / 2;
    const cy = this.canvas.height / 2;

    // Animate entry - items appear sequentially
    const itemDelay = 0.3;
    const getAlpha = (index: number) => {
      const delay = index * itemDelay;
      return Math.min(1, Math.max(0, (this.recapTimer - delay) * 2));
    };

    // Dark overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Subtle vignette
    const vignette = ctx.createRadialGradient(cx, cy, 0, cx, cy, this.canvas.width * 0.7);
    vignette.addColorStop(0, 'transparent');
    vignette.addColorStop(1, 'rgba(0, 0, 0, 0.5)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    let y = 60;

    // ===== HEADER: GAME OVER or NEW RECORD =====
    ctx.globalAlpha = getAlpha(0);
    ctx.textAlign = 'center';
    if (stats.isNewRecord) {
      ctx.fillStyle = '#FBBF24';
      ctx.font = 'bold 36px Arial';
      ctx.fillText('🏆 NEW RECORD! 🏆', cx, y);
    } else {
      ctx.fillStyle = '#EF4444';
      ctx.font = 'bold 32px Arial';
      ctx.fillText('GAME OVER', cx, y);
    }
    y += 50;

    // ===== SCORE =====
    ctx.globalAlpha = getAlpha(1);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 48px Arial';
    const displayScore = Math.floor(stats.score * Math.min(1, (this.recapTimer - 0.3) * 3));
    ctx.fillText(displayScore.toLocaleString(), cx, y);

    ctx.font = '16px Arial';
    ctx.fillStyle = '#94A3B8';
    ctx.fillText(`Best: ${stats.highScore.toLocaleString()}`, cx, y + 25);
    y += 60;

    // ===== STATS GRID =====
    const statsToShow = [
      { icon: '⏱️', label: 'Survival', value: `${stats.survivalTime.toFixed(1)}s`, color: '#22D3EE' },
      { icon: '💨', label: 'Near Misses', value: stats.nearMisses.toString(), color: '#60A5FA' },
      { icon: '🔥', label: 'Max Chain', value: `x${stats.maxChain}`, color: '#F97316' },
      { icon: '🪙', label: 'Coins', value: stats.coinsCollected.toString(), color: '#FBBF24' },
      { icon: '💎', label: 'Gems', value: stats.gemsCollected.toString(), color: '#A855F7' },
      { icon: '🌡️', label: 'Max Fever', value: `Lv.${stats.maxFever}`, color: '#EC4899' }
    ];

    const gridCols = 3;
    const gridWidth = Math.min(this.canvas.width - 40, 360);
    const cellWidth = gridWidth / gridCols;
    const startX = cx - gridWidth / 2;

    y += 10;
    for (let i = 0; i < statsToShow.length; i++) {
      const stat = statsToShow[i];
      const col = i % gridCols;
      const row = Math.floor(i / gridCols);
      const x = startX + col * cellWidth + cellWidth / 2;
      const rowY = y + row * 55;

      ctx.globalAlpha = getAlpha(2 + i * 0.3);

      // Icon
      ctx.font = '20px Arial';
      ctx.fillText(stat.icon, x, rowY);

      // Value
      ctx.fillStyle = stat.color;
      ctx.font = 'bold 18px Arial';
      ctx.fillText(stat.value, x, rowY + 22);

      // Label
      ctx.fillStyle = '#64748B';
      ctx.font = '11px Arial';
      ctx.fillText(stat.label, x, rowY + 36);
    }
    y += 120;

    // ===== ACHIEVEMENTS EARNED =====
    ctx.globalAlpha = getAlpha(5);
    const achievements: string[] = [];

    if (stats.zoneReached >= 1) achievements.push(`🏔️ Zone ${stats.zoneReached + 1} Reached`);
    if (stats.bossesCleared > 0) achievements.push(`👹 ${stats.bossesCleared} Boss${stats.bossesCleared > 1 ? 'es' : ''} Cleared`);
    if (stats.maxChain >= 5) achievements.push('⚡ Chain Master');
    if (stats.gemsCollected >= 3) achievements.push('💎 Gem Hunter');
    if (stats.maxFever >= 3) achievements.push('🔥 Fever Lord');
    if (stats.nearMisses >= 20) achievements.push('😎 Daredevil');
    if (stats.survivalTime >= 60) achievements.push('🕐 Survivor');

    if (achievements.length > 0) {
      ctx.fillStyle = '#FBBF24';
      ctx.font = 'bold 14px Arial';
      ctx.fillText('ACHIEVEMENTS', cx, y);
      y += 20;

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '13px Arial';
      ctx.fillText(achievements.slice(0, 3).join('  •  '), cx, y);
      if (achievements.length > 3) {
        y += 18;
        ctx.fillText(achievements.slice(3, 6).join('  •  '), cx, y);
      }
      y += 25;
    }

    // ===== MOTIVATIONAL MESSAGE =====
    ctx.globalAlpha = getAlpha(6);
    y += 10;

    let motivationalMessage = '';
    let messageColor = '#94A3B8';

    if (stats.isNewRecord) {
      motivationalMessage = 'You\'re on fire! Can you beat it again?';
      messageColor = '#FBBF24';
    } else if (stats.score < 500) {
      motivationalMessage = 'Tip: Near misses give bonus points!';
      messageColor = '#60A5FA';
    } else if (stats.maxFever < 2) {
      motivationalMessage = 'Challenge: Reach Fever Level 3!';
      messageColor = '#EC4899';
    } else if (stats.gemsCollected === 0) {
      motivationalMessage = 'Next goal: Collect a rare 💎 gem!';
      messageColor = '#A855F7';
    } else if (stats.bossesCleared === 0) {
      motivationalMessage = 'Next challenge: Survive a boss wave!';
      messageColor = '#F97316';
    } else {
      const tips = [
        'Fever mode = 3x points! Stay safe!',
        'Gems are worth 5x more than coins!',
        'Use Ghost to phase through danger!',
        'Near-miss chains stack up fast!'
      ];
      motivationalMessage = tips[Math.floor(Math.random() * tips.length)];
    }

    ctx.fillStyle = messageColor;
    ctx.font = 'bold 14px Arial';
    ctx.fillText(motivationalMessage, cx, y);

    // ===== TAP TO CONTINUE =====
    ctx.globalAlpha = getAlpha(7) * (Math.sin(this.recapAnimPhase * 2) * 0.3 + 0.7);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '16px Arial';
    ctx.fillText('Tap or Press SPACE to continue', cx, this.canvas.height - 40);

    ctx.globalAlpha = 1;
  }

  protected onRenderUI(ctx: CanvasRenderingContext2D): void {
    // Show recap screen if active
    if (this.showingRecap) {
      this.renderRecap(ctx);
      return;
    }

    // ===== TOP-LEFT: Zone and score info =====
    let topY = this.getHudStartY();

    // Zone indicator
    const zone = this.waveSystem.getCurrentZone();
    ctx.fillStyle = this.currentZoneColors.accent;
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(zone.name, 16, topY);
    topY += 20;

    // Best score
    ctx.fillStyle = '#94A3B8';
    ctx.font = '14px Arial';
    ctx.fillText(`Best: ${this.highScore}`, 16, topY);
    topY += 20;

    // Gems collected
    if (this.gemsCollected > 0) {
      ctx.fillStyle = '#A855F7';
      ctx.fillText(`💎 ${this.gemsCollected}`, 16, topY);
      topY += 20;
    }

    // ===== BOTTOM-LEFT: Fever meter and combos =====
    let bottomLeftY = this.canvas.height - 120;

    // Fever multiplier HUD
    bottomLeftY += this.feverSystem.renderHUD(ctx, 16, bottomLeftY);

    // Combos
    ctx.font = '14px Arial';

    const coinCombo = this.comboSystem.getCoinCombo();
    if (coinCombo > 0) {
      ctx.fillStyle = '#FBBF24';
      ctx.textAlign = 'left';
      ctx.fillText(`Coin x${this.comboSystem.getCoinMultiplier().toFixed(1)}`, 16, bottomLeftY);
      bottomLeftY += 18;
    }

    const nearChain = this.comboSystem.getNearMissChain();
    if (nearChain > 0) {
      ctx.fillStyle = '#60A5FA';
      ctx.textAlign = 'left';
      ctx.fillText(`Chain x${nearChain}`, 16, bottomLeftY);
      bottomLeftY += 18;
    }

    // Active power-ups
    for (const powerUp of this.activePowerUps) {
      const config = POWERUP_CONFIG[powerUp.type];
      ctx.fillStyle = config.color;
      ctx.textAlign = 'left';
      ctx.fillText(`${config.icon} ${powerUp.duration.toFixed(1)}s`, 16, bottomLeftY);
      bottomLeftY += 18;
    }

    // ===== BOTTOM-RIGHT: Lives =====
    ctx.fillStyle = '#EF4444';
    ctx.font = '24px Arial';
    ctx.textAlign = 'right';
    let heartsText = '';
    for (let i = 0; i < 3; i++) {
      heartsText += i < this.lives ? '❤️' : '🖤';
    }
    ctx.fillText(heartsText, this.canvas.width - 16, this.canvas.height - 30);

    // Dodge indicator when ducking/jumping
    if (this.player.getIsDucking()) {
      ctx.fillStyle = '#22D3EE';
      ctx.font = 'bold 16px Arial';
      ctx.fillText('⬇ DUCKING', this.canvas.width - 16, this.canvas.height - 60);
    } else if (this.player.getIsJumping()) {
      ctx.fillStyle = '#22D3EE';
      ctx.font = 'bold 16px Arial';
      ctx.fillText('⬆ JUMPING', this.canvas.width - 16, this.canvas.height - 60);
    }

    // Boss wave timer
    if (this.waveSystem.isBossWaveActive()) {
      ctx.fillStyle = '#EF4444';
      ctx.font = 'bold 16px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(`BOSS: ${this.waveSystem.getBossWaveTimeLeft().toFixed(1)}s`, this.canvas.width / 2, 50);
    }

    // Ready screen
    if (!this.isStarted) {
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 20px Arial';
      ctx.textAlign = 'center';

      if (this.readyTimer > 0) {
        ctx.fillText(`Starting in ${Math.ceil(this.readyTimer)}...`, this.canvas.width / 2, this.canvas.height / 2);
      } else {
        ctx.fillText('Tap or press arrow keys to start!', this.canvas.width / 2, this.canvas.height / 2);
      }

      ctx.font = '14px Arial';
      ctx.fillStyle = '#94A3B8';
      ctx.fillText('Dodge obstacles • Collect coins • Chain near-misses', this.canvas.width / 2, this.canvas.height / 2 + 30);
    }

    // Paused overlay
    if (this.isPaused) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 32px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('PAUSED', this.canvas.width / 2, this.canvas.height / 2);
    }
  }

  protected onGameEnd(finalScore: import('@/lib/types').GameScore): void {
    // Save high score
    try {
      const prev = parseInt(localStorage.getItem('tapdodge_best') || '0', 10) || 0;
      if (finalScore.score > prev) {
        localStorage.setItem('tapdodge_best', String(finalScore.score));
      }
    } catch { /* ignore */ }

    // Calculate survival time
    const survivalTime = this.gameStartTime > 0 ? (Date.now() - this.gameStartTime) / 1000 : 0;

    // Extended game data for achievements
    this.extendedGameData = {
      survival_time: survivalTime,
      near_misses: this.comboSystem.getTotalNearMisses(),
      max_near_chain: this.comboSystem.getMaxNearMissChain(),
      coins_collected: this.pickups,
      gems_collected: this.gemsCollected,
      max_combo: this.comboSystem.getMaxCoinCombo(),
      zone_reached: this.waveSystem.getZoneIndex(),
      max_fever_level: this.feverSystem.getMaxLevelReached()
    };

    // Track analytics
    this.services?.analytics?.trackGameSpecificStat?.('tapdodge', 'survival_time', survivalTime);
    this.services?.analytics?.trackGameSpecificStat?.('tapdodge', 'near_misses', this.comboSystem.getTotalNearMisses());
    this.services?.analytics?.trackGameSpecificStat?.('tapdodge', 'coins_collected', this.pickups);
    this.services?.analytics?.trackGameSpecificStat?.('tapdodge', 'gems_collected', this.gemsCollected);
    this.services?.analytics?.trackGameSpecificStat?.('tapdodge', 'max_combo', this.comboSystem.getMaxCoinCombo());
    this.services?.analytics?.trackGameSpecificStat?.('tapdodge', 'max_fever', this.feverSystem.getMaxLevelReached());

    super.onGameEnd?.(finalScore);
  }

  protected onResize(width: number, height: number): void {
    this.backgroundSystem?.resize(width, height);
    this.player?.resize(width, height);
    this.laneWarningSystem?.resize(width);
  }
}
