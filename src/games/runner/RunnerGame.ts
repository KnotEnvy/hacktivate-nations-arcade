// ===== src/games/runner/RunnerGame.ts (ENHANCED) =====
import { BaseGame } from '@/games/shared/BaseGame';
import { GameManifest } from '@/lib/types';
import { Player } from './entities/Player';
import { Obstacle, ObstacleType } from './entities/Obstacle';
import { Coin } from './entities/Coin';
import { PowerUp, PowerUpType } from './entities/PowerUp';
import { FlyingEnemy } from './entities/FlyingEnemy';
import { HoverEnemy } from './entities/HoverEnemy';
import { Boss } from './entities/Boss';
import { BossProjectile } from './entities/BossProjectile';
import { ParticleSystem } from './systems/ParticleSystem';
import { ScreenShake } from './systems/ScreenShake';
import { ComboSystem } from './systems/ComboSystem';
import { EnvironmentSystem } from './systems/EnvironmentSystem';
import { ParallaxSystem } from './systems/ParallaxSystem';

// Deterministic noise function for ground textures
const pseudoNoise = (x: number, y: number): number => {
  return Math.abs(Math.sin(x * 12.9898 + y * 78.233)) % 1;
};

interface ActivePowerUp {
  type: PowerUpType;
  duration: number;
  maxDuration: number;
}

type GameState = 'menu' | 'tutorial' | 'playing' | 'boss-victory' | 'death-animation' | 'stats-recap';

interface TutorialProgress {
  jumpsCompleted: number;
  slidesCompleted: number;
  coinsCollected: number;
  requiredJumps: number;
  requiredSlides: number;
  requiredCoins: number;
  currentStep: number;
}

export class RunnerGame extends BaseGame {
  manifest: GameManifest = {
    id: 'runner',
    title: 'Endless Runner',
    thumbnail: '/runner-thumb.svg',
    inputSchema: ['keyboard', 'touch'],
    assetBudgetKB: 50,
    tier: 0,
    description: 'Jump and collect coins in this fast-paced endless runner!'
  };

  private player!: Player;
  private obstacles: Obstacle[] = [];
  private coins: Coin[] = [];
  private powerUps: PowerUp[] = [];
  private flyingEnemies: FlyingEnemy[] = [];
  private hoverEnemies: HoverEnemy[] = [];
  private boss: Boss | null = null;
  private bossProjectiles: BossProjectile[] = [];
  private particles!: ParticleSystem;
  private screenShake!: ScreenShake;
  private comboSystem!: ComboSystem;
  private environmentSystem!: EnvironmentSystem;
  
  private gameSpeed: number = 1;
  // Distance based spawning
  private nextObstacleDistance: number = 0;
  private nextAerialDistance: number = 0;
  private distance: number = 0;
  private groundY: number = 0;
  private jumps: number = 0;
  private powerupsUsed: number = 0;
  private powerupTypesUsed: Set<PowerUpType> = new Set();

  // Game state
  private gameState: GameState = 'menu';
  private menuSelection: 'play' | 'tutorial' = 'play';
  private inputCooldown: number = 0;
  private inputCooldownDuration: number = 0.2; // seconds

  // Tutorial system
  private tutorialProgress: TutorialProgress = {
    jumpsCompleted: 0,
    slidesCompleted: 0,
    coinsCollected: 0,
    requiredJumps: 3,
    requiredSlides: 2,
    requiredCoins: 5,
    currentStep: 0, // 0=jump, 1=slide, 2=coins, 3=complete
  };

  // Boss system
  private currentThemeIndex: number = 0;
  private bossesDefeated: number = 0;
  private bossVictoryTimer: number = 0;
  private bossVictoryDuration: number = 3; // seconds

  // Special events (combo-based)
  private specialEventMeter: number = 0;
  private specialEventThreshold: number = 15; // combo count needed
  private activeEvent: 'none' | 'coin-shower' | 'speed-zone' = 'none';
  private eventTimer: number = 0;
  private eventDuration: number = 5; // seconds

  // Lives system
  private lives: number = 3;
  private maxLives: number = 3;
  private isInvulnerable: boolean = false;
  private invulnerabilityTimer: number = 0;
  private invulnerabilityDuration: number = 2; // seconds

  // Death animation
  private deathAnimationTimer: number = 0;
  private deathAnimationDuration: number = 1; // seconds
  private deathAnimationScale: number = 1;


  
  // Power-up system
  private activePowerUps: ActivePowerUp[] = [];
  private coinMagnetRange: number = 80;
  

  // Jump tracking
  private jumpInProgress: boolean = false;

  private cameraOffset: { x: number; y: number } = { x: 0, y: 0 };

  //paralax system
  private parallaxSystem!: ParallaxSystem;


  protected onInit(): void {
    this.groundY = this.canvas.height - 50;
    this.player = new Player(100, this.groundY - 32, this.groundY, this.canvas.width);
    this.particles = new ParticleSystem();
    this.screenShake = new ScreenShake();
    this.comboSystem = new ComboSystem();
    this.environmentSystem = new EnvironmentSystem();
    // Initialize the new parallax system
    this.parallaxSystem = new ParallaxSystem(
      this.canvas.width,
      this.canvas.height,
      this.groundY
    );
    this.parallaxSystem.reset();
    this.startTime = Date.now();
    this.jumps = 0;
    this.powerupsUsed = 0;
    this.powerupTypesUsed.clear();

    // Schedule first spawns
    this.scheduleNextObstacle();
    this.scheduleNextAerial();

    // Spawn initial content
    this.spawnObstacle();
    this.spawnCoin();
  }

  protected onUpdate(dt: number): void {
    const jumpPressed = this.services.input.isActionPressed();
    const leftPressed = this.services.input.isLeftPressed();
    const rightPressed = this.services.input.isRightPressed();
    const downPressed = this.services.input.isDownPressed();
    const upPressed = this.services.input.isUpPressed();

    // Handle menu state
    if (this.gameState === 'menu') {
      this.handleMenuUpdate(upPressed, downPressed, jumpPressed);
      return;
    }

    // Handle boss victory state
    if (this.gameState === 'boss-victory') {
      this.handleBossVictoryUpdate(dt);
      return;
    }

    // Handle death animation state
    if (this.gameState === 'death-animation') {
      this.handleDeathAnimation(dt);
      return;
    }

    // Handle stats recap state
    if (this.gameState === 'stats-recap') {
      // Just wait for input to proceed to game over
      if (jumpPressed) {
        this.endGame();
      }
      return;
    }

    // Check state before update
    const wasGrounded = this.player.getIsGrounded();
    const jumpsBefore = this.player.getJumpsRemaining();
    const wasSliding = this.player.getIsSliding();

    // Update player with power-ups
    const hasDoubleJump = this.hasPowerUp('double-jump');
    this.player.update(dt, jumpPressed, hasDoubleJump, leftPressed, rightPressed, downPressed);


    // Detect jump start by comparing jumps remaining
    const jumpsAfter = this.player.getJumpsRemaining();
    const jumpStarted = jumpsAfter < jumpsBefore;

    const isGrounded = this.player.getIsGrounded();
    const isSliding = this.player.getIsSliding();
    const landing = wasGrounded === false && isGrounded === true;
    const slideStarted = !wasSliding && isSliding;

    if (jumpStarted) {
      this.services.audio.playSound('jump');
      this.jumpInProgress = true;
    }

    if (landing && this.jumpInProgress) {
      this.jumps++;
      this.jumpInProgress = false;

      // Tutorial tracking
      if (this.gameState === 'tutorial' && this.tutorialProgress.currentStep === 0) {
        this.tutorialProgress.jumpsCompleted++;
      }
    }

    if (slideStarted) {
      this.services.audio.playSound('powerup'); // Slide sound

      // Tutorial tracking
      if (this.gameState === 'tutorial' && this.tutorialProgress.currentStep === 1) {
        this.tutorialProgress.slidesCompleted++;
      }
    }

    // Handle particle effects
    this.handlePlayerEffects(jumpStarted, landing, slideStarted);


    // Update game speed and distance
    const baseIncrement = this.gameSpeed * dt * 100;
    this.distance += baseIncrement;
    this.gameSpeed = 1 + Math.floor(this.distance / 1000) * 0.2;

    // Apply speed boost power-up and speed zone event
    let speedMultiplier = this.hasPowerUp('speed-boost') ? 1.5 : 1;
    if (this.activeEvent === 'speed-zone') {
      speedMultiplier *= 2; // Double speed during speed zone
    }
    const effectiveSpeed = this.gameSpeed * speedMultiplier;
    const distanceIncrement = effectiveSpeed * dt * 100;
    
    // Update all entities
    this.updateEntities(dt, effectiveSpeed);
    this.updateSystems(dt);
    
    // Update environment
    this.environmentSystem.updateTheme(this.distance);
    
    // Handle spawning
    this.handleSpawning();
    
    // Handle collisions
    this.checkCollisions();

    // Check tutorial progress
    if (this.gameState === 'tutorial') {
      this.checkTutorialProgress();
    }

    // Update score
    this.score = Math.floor(this.distance / 10);
    // Scroll parallax layers by the distance moved this frame
    this.parallaxSystem.update(distanceIncrement);
  }

  public getScore() {
    const baseScore = super.getScore?.() || {
      score: this.score,
      pickups: this.pickups,
      timePlayedMs: Date.now() - this.startTime,
      coinsEarned: 0,
    };
    return {
      ...baseScore,
      distance: Math.floor(this.distance),
      jumps: this.jumps,
      powerupsUsed: this.powerupsUsed,
      powerupTypesUsed: Array.from(this.powerupTypesUsed),
      speed: this.gameSpeed,
      combo: this.comboSystem?.getCombo?.() ?? 0,
      bossesDefeated: this.bossesDefeated,
    };
  }


  private handlePlayerEffects(jumpStarted: boolean, landing: boolean, slideStarted: boolean = false): void {
    if (jumpStarted) {
      this.particles.createJumpDust(this.player.position.x, this.player.position.y);
    }

    if (landing) {
      this.particles.createLandingDust(this.player.position.x, this.player.position.y);
      this.screenShake.shake(3, 0.1);
    }

    if (slideStarted) {
      this.particles.createLandingDust(this.player.position.x, this.player.position.y + 16);
    }
  }

  private updateEntities(dt: number, gameSpeed: number): void {
    // Update obstacles (don't spawn during boss fight)
    if (!this.boss) {
      this.obstacles.forEach(obstacle => obstacle.update(dt, gameSpeed));
      this.obstacles = this.obstacles.filter(obstacle => !obstacle.isOffScreen());
    }

    // Update coins with magnet effect
    this.coins.forEach(coin => {
      coin.update(dt, gameSpeed);

      // Coin magnet effect
      if (this.hasPowerUp('coin-magnet')) {
        const distance = this.player.position.distance(coin.position);
        if (distance < this.coinMagnetRange) {
          const direction = this.player.position.subtract(coin.position).normalize();
          coin.position = coin.position.add(direction.multiply(dt * 300));
        }
      }
    });
    this.coins = this.coins.filter(coin => !coin.isOffScreen());

    // Update power-ups
    this.powerUps.forEach(powerUp => powerUp.update(dt, gameSpeed));
    this.powerUps = this.powerUps.filter(powerUp => !powerUp.isOffScreen());

    // Update flying enemies (don't spawn during boss fight)
    if (!this.boss) {
      this.flyingEnemies.forEach(enemy => enemy.update(dt, gameSpeed));
      this.flyingEnemies = this.flyingEnemies.filter(enemy => !enemy.isOffScreen());

      // Update hover enemies
      this.hoverEnemies.forEach(enemy => enemy.update(dt, gameSpeed));
      this.hoverEnemies = this.hoverEnemies.filter(enemy => !enemy.isOffScreen());
    }

    // Update boss
    if (this.boss) {
      this.boss.update(dt, gameSpeed);

      // Boss attacks
      if (this.boss.shouldAttack()) {
        const attackPos = this.boss.getAttackPosition();
        this.bossProjectiles.push(
          new BossProjectile(attackPos.x, attackPos.y, this.groundY - 32)
        );
        this.services.audio.playSound('powerup');
      }

      // Transition to boss victory when defeated
      if (this.boss.isDefeated() && this.boss.isOffScreen()) {
        this.bossesDefeated++;
        this.pickups += 10; // Bonus coins
        this.gameState = 'boss-victory';
        this.bossVictoryTimer = 0;
        this.boss = null;
        this.screenShake.shake(15, 0.5);
        this.services.audio.playSound('success');
      }
    }

    // Update boss projectiles
    this.bossProjectiles.forEach(proj => proj.update(dt, gameSpeed));
    this.bossProjectiles = this.bossProjectiles.filter(proj => !proj.isOffScreen());
  }

  private updateSystems(dt: number): void {
    this.particles.update(dt);
    this.screenShake.update(dt);
    this.comboSystem.update(dt);

    // Update active power-ups
    this.activePowerUps = this.activePowerUps.filter(powerUp => {
      powerUp.duration -= dt;
      return powerUp.duration > 0;
    });

    // Update special events
    if (this.activeEvent !== 'none') {
      this.eventTimer += dt;
      if (this.eventTimer >= this.eventDuration) {
        this.activeEvent = 'none';
        this.eventTimer = 0;
      }
    }

    // Update invulnerability
    if (this.isInvulnerable) {
      this.invulnerabilityTimer -= dt;
      if (this.invulnerabilityTimer <= 0) {
        this.isInvulnerable = false;
        this.invulnerabilityTimer = 0;
      }
    }

    // Update camera shake
    this.cameraOffset = this.screenShake.getOffset();
  }

  private handleSpawning(): void {
    // Only spawn during playing state
    if (this.gameState !== 'playing' && this.gameState !== 'tutorial') return;

    const THEME_DISTANCE = 2000;
    const BOSS_TRIGGER_OFFSET = 1800; // Boss appears 200m before theme change

    // Boss spawning before theme changes
    const distanceInTheme = this.distance % THEME_DISTANCE;
    if (distanceInTheme >= BOSS_TRIGGER_OFFSET && !this.boss && this.gameState === 'playing') {
      const nextThemeDistance = Math.floor(this.distance / THEME_DISTANCE) * THEME_DISTANCE + THEME_DISTANCE;
      // Only spawn if we haven't spawned for this theme yet
      const currentTheme = Math.floor(this.distance / THEME_DISTANCE);
      if (currentTheme > this.currentThemeIndex) {
        this.currentThemeIndex = currentTheme;
        this.spawnBoss();
        // Clear obstacles and enemies for boss fight
        this.obstacles = [];
        this.flyingEnemies = [];
        this.hoverEnemies = [];
        return;
      }
    }

    // Special events (combo-based)
    if (this.specialEventMeter >= this.specialEventThreshold && this.activeEvent === 'none' && !this.boss && this.gameState === 'playing') {
      this.triggerSpecialEvent();
    }

    // Coin shower event
    if (this.activeEvent === 'coin-shower') {
      if (Math.random() < 0.3) {
        this.spawnCoin(Math.random() * 100);
      }
    }

    // Regular spawning (only when no boss is active)
    if (!this.boss) {
      if (this.distance >= this.nextObstacleDistance) {
        // Tutorial mode - simpler spawning
        if (this.gameState === 'tutorial') {
          this.spawnObstacle();
          if (Math.random() < 0.7) {
            this.spawnCoin();
          }
        } else {
          // Normal gameplay - varied spawning
          if (Math.random() < 0.25) {
            this.spawnObstacle();
            this.spawnObstacle(100);
          } else {
            this.spawnObstacle();
          }

          if (Math.random() < 0.6) {
            this.spawnCoin();
          }

          if (Math.random() < 0.15 && this.distance > 300) {
            this.spawnPowerUp();
          }
        }

        this.scheduleNextObstacle();
      }

      if (this.distance >= this.nextAerialDistance && this.gameState === 'playing') {
        if (Math.random() < 0.5 && this.distance > 500) {
          this.spawnFlyingEnemy();
        }

        if (Math.random() < 0.4 && this.distance > 800) {
          this.spawnHoverEnemy();
        }

        this.scheduleNextAerial();
      }
    }
  }

  private triggerSpecialEvent(): void {
    const events: ('coin-shower' | 'speed-zone')[] = ['coin-shower', 'speed-zone'];
    this.activeEvent = events[Math.floor(Math.random() * events.length)];
    this.eventTimer = 0;
    this.specialEventMeter = 0; // Reset meter
    this.screenShake.shake(6, 0.2);
    this.services.audio.playSound('powerup');
  }

  private handleMenuUpdate(upPressed: boolean, downPressed: boolean, selectPressed: boolean): void {
    // Update cooldown
    if (this.inputCooldown > 0) {
      this.inputCooldown -= 1/60; // Assuming 60 FPS
      return;
    }

    // Toggle selection with up/down
    if (upPressed || downPressed) {
      this.menuSelection = this.menuSelection === 'play' ? 'tutorial' : 'play';
      this.services.audio.playSound('coin');
      this.inputCooldown = this.inputCooldownDuration;
    }

    // Start game with space/enter
    if (selectPressed) {
      if (this.menuSelection === 'play') {
        this.gameState = 'playing';
      } else {
        this.gameState = 'tutorial';
        this.resetTutorialProgress();
      }
      this.services.audio.playSound('powerup');
      this.inputCooldown = this.inputCooldownDuration;
    }
  }

  private handleBossVictoryUpdate(dt: number): void {
    this.bossVictoryTimer += dt;

    // Continue scrolling background slowly
    const slowSpeed = 0.3;
    this.parallaxSystem.update(slowSpeed * dt * 100);

    // Transition back to playing after victory duration
    if (this.bossVictoryTimer >= this.bossVictoryDuration) {
      this.gameState = 'playing';
      this.bossVictoryTimer = 0;

      // CHANGE THEME after boss defeat
      // Force environment to update to next theme
      const themes: any[] = ['day', 'sunset', 'night', 'desert', 'forest'];
      const nextThemeIndex = (this.currentThemeIndex) % themes.length;
      // Manually update distance to trigger theme change
      const THEME_DISTANCE = 2000;
      this.distance = nextThemeIndex * THEME_DISTANCE;
      this.environmentSystem.updateTheme(this.distance);
    }
  }

  private resetTutorialProgress(): void {
    this.tutorialProgress = {
      jumpsCompleted: 0,
      slidesCompleted: 0,
      coinsCollected: 0,
      requiredJumps: 3,
      requiredSlides: 2,
      requiredCoins: 5,
      currentStep: 0,
    };
  }

  private checkTutorialProgress(): void {
    const progress = this.tutorialProgress;

    switch (progress.currentStep) {
      case 0: // Jump step
        if (progress.jumpsCompleted >= progress.requiredJumps) {
          progress.currentStep = 1;
          this.services.audio.playSound('success');
        }
        break;
      case 1: // Slide step
        if (progress.slidesCompleted >= progress.requiredSlides) {
          progress.currentStep = 2;
          this.services.audio.playSound('success');
        }
        break;
      case 2: // Coin collection step
        if (progress.coinsCollected >= progress.requiredCoins) {
          progress.currentStep = 3;
          this.services.audio.playSound('unlock');
          // Transition to playing mode
          setTimeout(() => {
            this.gameState = 'playing';
          }, 1000);
        }
        break;
    }
  }

  private takeDamage(): void {
    this.lives--;
    this.services.audio.playSound('collision');
    this.screenShake.shake(10, 0.3);

    if (this.lives <= 0) {
      // Trigger death animation
      this.gameState = 'death-animation';
      this.deathAnimationTimer = 0;
      this.deathAnimationScale = 1;
    } else {
      // Bounce back and make invulnerable
      this.player.velocity.x = -200; // Push back
      this.player.velocity.y = -8; // Slight bounce up
      this.isInvulnerable = true;
      this.invulnerabilityTimer = this.invulnerabilityDuration;

      // Clear nearby obstacles to give player breathing room
      this.obstacles = this.obstacles.filter(obs => obs.position.x > this.player.position.x + 200);
    }
  }

  private handleDeathAnimation(dt: number): void {
    this.deathAnimationTimer += dt;
    const progress = this.deathAnimationTimer / this.deathAnimationDuration;

    // Shrink player (Pac-Man style)
    this.deathAnimationScale = 1 - progress;

    // Also rotate for effect
    this.player.velocity.y += 0.5; // Continue falling
    this.player.position.y += this.player.velocity.y;

    if (this.deathAnimationTimer >= this.deathAnimationDuration) {
      // Transition to stats recap
      this.gameState = 'stats-recap';
    }
  }

  protected onRender(ctx: CanvasRenderingContext2D): void {
    ctx.save();

    // Apply camera shake
    ctx.translate(this.cameraOffset.x, this.cameraOffset.y);

    this.renderEnhancedBackground(ctx);
    this.renderGround(ctx);

    // Render all entities
    this.obstacles.forEach(obstacle => obstacle.render(ctx));
    this.flyingEnemies.forEach(enemy => enemy.render(ctx));
    this.hoverEnemies.forEach(enemy => enemy.render(ctx));
    this.coins.forEach(coin => coin.render(ctx));
    this.powerUps.forEach(powerUp => powerUp.render(ctx));

    // Render boss and boss projectiles
    if (this.boss) {
      this.boss.render(ctx);
    }
    this.bossProjectiles.forEach(proj => proj.render(ctx));

    // Apply death animation scale
    if (this.gameState === 'death-animation') {
      ctx.save();
      ctx.translate(
        this.player.position.x + this.player.size.x / 2,
        this.player.position.y + this.player.size.y / 2
      );
      ctx.scale(this.deathAnimationScale, this.deathAnimationScale);
      ctx.rotate(this.deathAnimationTimer * 10); // Spin while shrinking
      ctx.translate(
        -(this.player.position.x + this.player.size.x / 2),
        -(this.player.position.y + this.player.size.y / 2)
      );
      this.player.render(ctx);
      ctx.restore();
    } else {
      // Render player with effects
      const hasInvincibilityPowerUp = this.hasPowerUp('invincibility');
      const isBlinking = this.isInvulnerable;

      // Blinking effect when invulnerable
      if (isBlinking) {
        const flash = Math.sin(Date.now() * 0.03) > 0;
        if (!flash) {
          ctx.globalAlpha = 0.4;
        }
      }

      // Invincibility power-up effect
      if (hasInvincibilityPowerUp) {
        ctx.shadowColor = '#10B981';
        ctx.shadowBlur = 10;
      }

      this.player.render(ctx);
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
    }

    this.particles.render(ctx);

    ctx.restore();
  }

  protected onRenderUI(ctx: CanvasRenderingContext2D): void {
    // Menu state
    if (this.gameState === 'menu') {
      this.renderMenu(ctx);
      return;
    }

    // Boss victory screen
    if (this.gameState === 'boss-victory') {
      this.renderBossVictory(ctx);
      return;
    }

    // Tutorial UI
    if (this.gameState === 'tutorial') {
      this.renderTutorialUI(ctx);
      return;
    }

    // Death animation - no UI
    if (this.gameState === 'death-animation') {
      return;
    }

    // Stats recap screen
    if (this.gameState === 'stats-recap') {
      this.renderStatsRecap(ctx);
      return;
    }

    // Playing UI
    this.renderPlayingUI(ctx);
  }

  private renderMenu(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Title
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('ENDLESS RUNNER', this.canvas.width / 2, 150);

    ctx.font = '20px Arial';
    ctx.fillStyle = '#94A3B8';
    ctx.fillText('Your Flagship Adventure Awaits!', this.canvas.width / 2, 190);

    // Menu options
    const menuY = 300;
    const spacing = 80;

    // Play option
    if (this.menuSelection === 'play') {
      ctx.fillStyle = '#10B981';
      ctx.fillRect(this.canvas.width / 2 - 150, menuY - 35, 300, 60);
    }
    ctx.fillStyle = this.menuSelection === 'play' ? '#FFFFFF' : '#94A3B8';
    ctx.font = 'bold 28px Arial';
    ctx.fillText('▶ START GAME', this.canvas.width / 2, menuY);

    // Tutorial option
    if (this.menuSelection === 'tutorial') {
      ctx.fillStyle = '#3B82F6';
      ctx.fillRect(this.canvas.width / 2 - 150, menuY + spacing - 35, 300, 60);
    }
    ctx.fillStyle = this.menuSelection === 'tutorial' ? '#FFFFFF' : '#94A3B8';
    ctx.fillText('📚 TUTORIAL', this.canvas.width / 2, menuY + spacing);

    // Controls hint
    ctx.font = '16px Arial';
    ctx.fillStyle = '#64748B';
    ctx.fillText('Use UP/DOWN to select, SPACE to confirm', this.canvas.width / 2, 500);
  }

  private renderBossVictory(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Victory text
    ctx.fillStyle = '#FBBF24';
    ctx.font = 'bold 56px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('BOSS DEFEATED!', this.canvas.width / 2, this.canvas.height / 2 - 50);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '24px Arial';
    ctx.fillText(`Bosses Defeated: ${this.bossesDefeated}`, this.canvas.width / 2, this.canvas.height / 2 + 10);
    ctx.fillText(`Bonus Coins: +10`, this.canvas.width / 2, this.canvas.height / 2 + 50);

    // Transition hint
    const timeLeft = Math.ceil(this.bossVictoryDuration - this.bossVictoryTimer);
    ctx.font = '18px Arial';
    ctx.fillStyle = '#94A3B8';
    ctx.fillText(`Next stage in ${timeLeft}...`, this.canvas.width / 2, this.canvas.height / 2 + 100);
  }

  private renderTutorialUI(ctx: CanvasRenderingContext2D): void {
    const progress = this.tutorialProgress;

    // Tutorial step indicator - MOVED TO TOP
    const boxY = 80;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(this.canvas.width / 2 - 200, boxY, 400, 120);

    ctx.fillStyle = '#FBBF24';
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'center';

    switch (progress.currentStep) {
      case 0:
        ctx.fillText('TUTORIAL: Learn to Jump', this.canvas.width / 2, boxY + 30);
        ctx.font = '16px Arial';
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(`Press SPACE to jump over obstacles`, this.canvas.width / 2, boxY + 55);
        ctx.fillText(`Progress: ${progress.jumpsCompleted}/${progress.requiredJumps} jumps`, this.canvas.width / 2, boxY + 80);
        break;
      case 1:
        ctx.fillText('TUTORIAL: Learn to Slide', this.canvas.width / 2, boxY + 30);
        ctx.font = '16px Arial';
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(`Press DOWN to slide under barriers`, this.canvas.width / 2, boxY + 55);
        ctx.fillText(`Progress: ${progress.slidesCompleted}/${progress.requiredSlides} slides`, this.canvas.width / 2, boxY + 80);
        break;
      case 2:
        ctx.fillText('TUTORIAL: Collect Coins', this.canvas.width / 2, boxY + 30);
        ctx.font = '16px Arial';
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(`Collect coins to build combos!`, this.canvas.width / 2, boxY + 55);
        ctx.fillText(`Progress: ${progress.coinsCollected}/${progress.requiredCoins} coins`, this.canvas.width / 2, boxY + 80);
        break;
      case 3:
        ctx.fillStyle = '#10B981';
        ctx.fillText('TUTORIAL COMPLETE!', this.canvas.width / 2, boxY + 30);
        ctx.font = '16px Arial';
        ctx.fillText('Starting game...', this.canvas.width / 2, boxY + 60);
        break;
    }
  }

  private renderStatsRecap(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Title
    ctx.fillStyle = '#DC2626';
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('GAME OVER', this.canvas.width / 2, 100);

    // Stats
    const stats = [
      { label: 'Distance', value: `${Math.floor(this.distance)}m` },
      { label: 'Coins Collected', value: this.pickups },
      { label: 'Max Combo', value: `${this.comboSystem.getMaxCombo()}x` },
      { label: 'Jumps', value: this.jumps },
      { label: 'Bosses Defeated', value: this.bossesDefeated },
      { label: 'Max Speed', value: `${this.gameSpeed.toFixed(1)}x` },
    ];

    let y = 180;
    ctx.font = '20px Arial';
    ctx.fillStyle = '#FFFFFF';

    stats.forEach(stat => {
      ctx.textAlign = 'left';
      ctx.fillText(stat.label, this.canvas.width / 2 - 150, y);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#FBBF24';
      ctx.fillText(String(stat.value), this.canvas.width / 2 + 150, y);
      ctx.fillStyle = '#FFFFFF';
      y += 40;
    });

    // Final score
    ctx.fillStyle = '#10B981';
    ctx.font = 'bold 32px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`Final Score: ${this.score}`, this.canvas.width / 2, y + 40);

    // Continue hint
    ctx.font = '18px Arial';
    ctx.fillStyle = '#94A3B8';
    ctx.fillText('Press SPACE to continue', this.canvas.width / 2, this.canvas.height - 40);
  }

  private renderPlayingUI(ctx: CanvasRenderingContext2D): void {
    // Lives display
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '16px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('Lives:', 20, 40);
    for (let i = 0; i < this.maxLives; i++) {
      if (i < this.lives) {
        ctx.fillStyle = '#DC2626';
      } else {
        ctx.fillStyle = '#374151';
      }
      ctx.fillRect(75 + i * 25, 28, 18, 18);
    }

    // Speed indicator
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '16px Arial';
    ctx.textAlign = 'right';
    ctx.fillText(`Speed: ${this.gameSpeed.toFixed(1)}x`, this.canvas.width - 20, 40);

    // Distance
    ctx.fillText(`Distance: ${Math.floor(this.distance)}m`, this.canvas.width - 20, 65);

    // Boss fight indicator
    if (this.boss && !this.boss.isDefeated()) {
      ctx.fillStyle = '#DC2626';
      ctx.font = 'bold 24px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('BOSS FIGHT!', this.canvas.width / 2, 40);

      // Boss health bar
      const barWidth = 200;
      const barHeight = 12;
      const barX = this.canvas.width / 2 - barWidth / 2;
      const barY = 50;
      const healthPercent = this.boss.health / this.boss.maxHealth;

      ctx.fillStyle = '#374151';
      ctx.fillRect(barX, barY, barWidth, barHeight);

      ctx.fillStyle = '#EF4444';
      ctx.fillRect(barX, barY, barWidth * healthPercent, barHeight);

      ctx.strokeStyle = '#1F2937';
      ctx.lineWidth = 2;
      ctx.strokeRect(barX, barY, barWidth, barHeight);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '12px Arial';
      ctx.fillText(`${this.boss.health}/${this.boss.maxHealth}`, this.canvas.width / 2, barY + barHeight + 15);
    }

    // Next boss warning
    if (!this.boss) {
      const THEME_DISTANCE = 2000;
      const distanceInTheme = this.distance % THEME_DISTANCE;
      const distanceToNextBoss = THEME_DISTANCE - distanceInTheme - 200;

      if (distanceInTheme >= 1600 && distanceInTheme < 1800) {
        ctx.fillStyle = '#FBBF24';
        ctx.font = 'bold 18px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`Boss approaching in ${Math.floor(distanceToNextBoss)}m!`, this.canvas.width / 2, 40);
      }
    }

    // Combo display
    if (this.comboSystem.getCombo() > 1) {
      ctx.fillStyle = '#F59E0B';
      ctx.font = 'bold 20px Arial';
      ctx.textAlign = 'right';
      ctx.fillText(`Combo: ${this.comboSystem.getCombo()}x`, this.canvas.width - 20, 100);
     
      // Combo timer bar
      const timeLeft = this.comboSystem.getTimeLeft();
      const maxTime = 2;
      const barWidth = 100;
      const barHeight = 4;
      const barX = this.canvas.width - 120;
      const barY = 110;
      
      ctx.fillStyle = '#374151';
      ctx.fillRect(barX, barY, barWidth, barHeight);
      
      ctx.fillStyle = '#F59E0B';
      ctx.fillRect(barX, barY, barWidth * (timeLeft / maxTime), barHeight);
    }
    
    
    // Active power-ups display
    let powerUpY = 140;
    this.activePowerUps.forEach(powerUp => {
      const remaining = Math.ceil(powerUp.duration);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '14px Arial';
      ctx.textAlign = 'right';
      ctx.fillText(`${this.getPowerUpName(powerUp.type)}: ${remaining}s`, this.canvas.width - 20, powerUpY);
      
      // Power-up timer bar
      const progress = powerUp.duration / powerUp.maxDuration;
      const barWidth = 80;
      const barHeight = 3;
      const barX = this.canvas.width - 100;
      
      ctx.fillStyle = '#374151';
      ctx.fillRect(barX, powerUpY + 5, barWidth, barHeight);
      
      ctx.fillStyle = this.getPowerUpColor(powerUp.type);
      ctx.fillRect(barX, powerUpY + 5, barWidth * progress, barHeight);
      
      powerUpY += 25;
    });
    
    // Special event meter (combo-based)
    if (this.activeEvent === 'none') {
      const meterProgress = this.specialEventMeter / this.specialEventThreshold;
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '14px Arial';
      ctx.textAlign = 'left';
      ctx.fillText('Special Event:', 20, 120);

      const barWidth = 100;
      const barHeight = 8;
      ctx.fillStyle = '#374151';
      ctx.fillRect(20, 130, barWidth, barHeight);

      const gradient = ctx.createLinearGradient(20, 0, 120, 0);
      gradient.addColorStop(0, '#3B82F6');
      gradient.addColorStop(1, '#FBBF24');
      ctx.fillStyle = gradient;
      ctx.fillRect(20, 130, barWidth * meterProgress, barHeight);

      ctx.font = '12px Arial';
      ctx.fillText(`${this.specialEventMeter}/${this.specialEventThreshold}`, 20, 150);
    }

    // Special event indicator
    if (this.activeEvent !== 'none') {
      const timeLeft = this.eventDuration - this.eventTimer;
      const eventName = this.activeEvent === 'coin-shower' ? 'COIN SHOWER!' : 'SPEED ZONE!';
      const eventColor = this.activeEvent === 'coin-shower' ? '#FBBF24' : '#3B82F6';

      ctx.fillStyle = eventColor;
      ctx.font = 'bold 20px Arial';
      ctx.textAlign = 'left';
      ctx.fillText(`⭐ ${eventName}`, 20, 120);

      // Event timer bar
      const barWidth = 100;
      const barHeight = 4;
      const progress = timeLeft / this.eventDuration;

      ctx.fillStyle = '#374151';
      ctx.fillRect(20, 130, barWidth, barHeight);

      ctx.fillStyle = eventColor;
      ctx.fillRect(20, 130, barWidth * progress, barHeight);
    }

    // Environment theme display
    ctx.fillStyle = '#94A3B8';
    ctx.font = '12px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`Theme: ${this.environmentSystem.getCurrentTheme()}`, 20, this.canvas.height - 20);
  }

  private renderEnhancedBackground(ctx: CanvasRenderingContext2D): void {
    const colors = this.environmentSystem.getSkyColors();
    
    // Still render the gradient sky as base layer
    const gradient = ctx.createLinearGradient(0, 0, 0, this.canvas.height);
    gradient.addColorStop(0, colors.top);
    gradient.addColorStop(1, colors.bottom);
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.canvas.width, this.groundY);
    
    // Render all parallax layers
    this.parallaxSystem.render(ctx, this.environmentSystem.getCurrentTheme());
  }

  private renderCloud(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    ctx.fillRect(x, y, 60, 20);
    ctx.fillRect(x + 10, y - 10, 40, 20);
    ctx.fillRect(x + 20, y - 15, 30, 20);
  }

  private renderGround(ctx: CanvasRenderingContext2D): void {
    const groundColor = this.environmentSystem.getGroundColor();
    const grassColor = this.environmentSystem.getGrassColor();
    
    // Main ground
    ctx.fillStyle = groundColor;
    ctx.fillRect(0, this.groundY, this.canvas.width, this.canvas.height - this.groundY);
    
    // Enhanced grass line with gradient
    const grassGradient = ctx.createLinearGradient(0, this.groundY - 8, 0, this.groundY);
    grassGradient.addColorStop(0, grassColor);
    grassGradient.addColorStop(1, groundColor);
    
    ctx.fillStyle = grassGradient;
    ctx.fillRect(0, this.groundY - 8, this.canvas.width, 8);
    
    // Add subtle deterministic ground texture
    ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
    const textureOffset = (this.distance * 1.5) % 20;
    for (let x = -textureOffset; x < this.canvas.width; x += 20) {
      for (let y = this.groundY + 10; y < this.canvas.height; y += 15) {
        const noise = pseudoNoise(x, y);
        if (noise > 0.7) {
          ctx.fillRect(x + (noise * 3) % 3, y, 1, 1);
        }
      }
    }
  }

  private spawnPowerUp(): void {
    const types: PowerUpType[] = ['double-jump', 'coin-magnet', 'invincibility', 'speed-boost'];
    const type = types[Math.floor(Math.random() * types.length)];
    const x = this.canvas.width + 50;
    const y = this.groundY - 100 - Math.random() * 100;
    this.powerUps.push(new PowerUp(x, y, type));
  }

  private spawnFlyingEnemy(): void {
    const x = this.canvas.width + 50;
    const y = this.groundY - 150 - Math.random() * 100;
    this.flyingEnemies.push(new FlyingEnemy(x, y));
  }

  private spawnHoverEnemy(): void {
    const x = this.canvas.width + 50;
    const y = this.groundY - 80;
    this.hoverEnemies.push(new HoverEnemy(x, y));
  }

  private spawnBoss(): void {
    this.boss = new Boss(this.canvas.width + 100, this.groundY);
    this.screenShake.shake(20, 0.8);
    this.services.audio.playSound('unlock');
  }

  private spawnObstacle(offset: number = 50): void {
    const x = this.canvas.width + offset;

    // Choose obstacle type based on distance and randomness
    let type: ObstacleType = 'cactus';
    const rand = Math.random();

    if (this.distance > 300) {
      // Introduce variety after 300m
      if (rand < 0.3) {
        type = 'spike';
      } else if (rand < 0.5 && this.distance > 500) {
        type = 'high-barrier';
      } else if (rand < 0.65 && this.distance > 700) {
        type = 'gap';
      } else {
        type = 'cactus';
      }
    }

    // Set position based on type
    let y = this.groundY - 48;
    if (type === 'spike') {
      y = this.groundY - 24;
    } else if (type === 'high-barrier') {
      y = this.groundY - 64;
    } else if (type === 'gap') {
      y = this.groundY - 10;
    }

    this.obstacles.push(new Obstacle(x, y, type));
  }

  private spawnCoin(offset: number = 50): void {
    let x = this.canvas.width + offset;
    // Ensure coins are not too close to existing obstacles
    let attempts = 0;
    while (
      this.obstacles.some(o => Math.abs(o.position.x - x) < o.size.x + 30) &&
      attempts < 5
    ) {
      x += 30;
      attempts++;
    }

    const minY = this.groundY - 80;
    const y = minY - Math.random() * 80;
    this.coins.push(new Coin(x, y));
  }

  private scheduleNextObstacle(): void {
    const base = 120;
    const variation = Math.random() * 80;
    const speedFactor = Math.max(0, (this.gameSpeed - 1) * 10);
    this.nextObstacleDistance = this.distance + base + variation - speedFactor;
  }

  private scheduleNextAerial(): void {
    const base = 220;
    const variation = Math.random() * 120;
    const speedFactor = Math.max(0, (this.gameSpeed - 1) * 15);
    this.nextAerialDistance = this.distance + base + variation - speedFactor;
  }

  private checkCollisions(): void {
    const playerBounds = this.player.getBounds();
    const isInvincible = this.hasPowerUp('invincibility');
    const canTakeDamage = !isInvincible && !this.isInvulnerable;

    // Check obstacle collisions
    if (canTakeDamage) {
      for (const obstacle of this.obstacles) {
        if (playerBounds.intersects(obstacle.getBounds())) {
          this.takeDamage();
          return;
        }
      }

      // Check flying enemy collisions
      for (const enemy of this.flyingEnemies) {
        if (playerBounds.intersects(enemy.getBounds())) {
          this.takeDamage();
          return;
        }
      }

      // Check hover enemy collisions
      for (const enemy of this.hoverEnemies) {
        if (playerBounds.intersects(enemy.getBounds())) {
          this.takeDamage();
          return;
        }
      }

      // Check boss projectile collisions
      for (let i = this.bossProjectiles.length - 1; i >= 0; i--) {
        const projectile = this.bossProjectiles[i];
        if (playerBounds.intersects(projectile.getBounds())) {
          this.bossProjectiles.splice(i, 1);
          this.takeDamage();
          return;
        }
      }
    }

    // Check boss collision (player can damage boss by jumping on it from above)
    if (this.boss && !this.boss.isDefeated()) {
      const bossBounds = this.boss.getBounds();
      if (playerBounds.intersects(bossBounds)) {
        // If player is above boss and falling, damage boss
        if (this.player.position.y + this.player.size.y < bossBounds.y + 20 && this.player.velocity.y > 0) {
          const defeated = this.boss.takeDamage(1);
          this.player.velocity.y = -8; // Bounce player up
          this.screenShake.shake(5, 0.15);
          this.services.audio.playSound('coin');
          this.pickups += 2; // Bonus coins for hitting boss

          if (defeated) {
            this.nextBossMilestone = Math.ceil(this.distance / 500) * 500 + 500;
          }
        } else if (!isInvincible) {
          // Side collision = death
          this.services.audio.playSound('collision');
          this.screenShake.shake(10, 0.3);
          this.endGame();
          return;
        }
      }
    }
    
    // Check coin collisions
    for (let i = this.coins.length - 1; i >= 0; i--) {
      const coin = this.coins[i];
      if (playerBounds.intersects(coin.getBounds())) {
        this.coins.splice(i, 1);

        const multiplier = this.comboSystem.addCoin();
        this.pickups += multiplier;

        this.particles.createCoinPickup(
          coin.position.x + coin.size/2,
          coin.position.y + coin.size/2
        );

        // Screen shake for coin pickup
        this.screenShake.shake(2, 0.1);
        this.services.audio.playSound('coin');

        // Tutorial tracking
        if (this.gameState === 'tutorial' && this.tutorialProgress.currentStep === 2) {
          this.tutorialProgress.coinsCollected++;
        }

        // Special event meter (combo-based)
        if (this.gameState === 'playing') {
          const currentCombo = this.comboSystem.getCombo();
          if (currentCombo >= 5) {
            this.specialEventMeter++;
          }
        }
      }
    }
    
    // Check power-up collisions
    for (let i = this.powerUps.length - 1; i >= 0; i--) {
      const powerUp = this.powerUps[i];
      if (playerBounds.intersects(powerUp.getBounds())) {
        this.powerUps.splice(i, 1);

        this.activatePowerUp(powerUp.type);
        this.powerupTypesUsed.add(powerUp.type);
        
        this.particles.createPowerUpPickup(
          powerUp.position.x + powerUp.size.x/2,
          powerUp.position.y + powerUp.size.y/2
        );
        
        this.screenShake.shake(4, 0.15);
        this.powerupsUsed++;
        this.services.audio.playSound('powerup');
      }
    }
  }

  private activatePowerUp(type: PowerUpType): void {
    const duration = this.getPowerUpDuration(type);

    const existing = this.activePowerUps.find(p => p.type === type);
    if (existing) {
      existing.duration += duration;
      existing.maxDuration += duration;
    } else {
      this.activePowerUps.push({
        type,
        duration,
        maxDuration: duration,
      });
    }
  }

  private hasPowerUp(type: PowerUpType): boolean {
    return this.activePowerUps.some(p => p.type === type);
  }

  private getPowerUpDuration(type: PowerUpType): number {
    switch (type) {
      case 'double-jump': return 10;
      case 'coin-magnet': return 8;
      case 'invincibility': return 5;
      case 'speed-boost': return 6;
      default: return 5;
    }
  }

  private getPowerUpName(type: PowerUpType): string {
    switch (type) {
      case 'double-jump': return 'Double Jump';
      case 'coin-magnet': return 'Coin Magnet';
      case 'invincibility': return 'Shield';
      case 'speed-boost': return 'Speed Boost';
      default: return 'Power-Up';
    }
  }

  private getPowerUpColor(type: PowerUpType): string {
    switch (type) {
      case 'double-jump': return '#3B82F6';
      case 'coin-magnet': return '#DC2626';
      case 'invincibility': return '#10B981';
      case 'speed-boost': return '#F59E0B';
      default: return '#FFFFFF';
    }
  }

  protected onGameEnd(finalScore: any): void {
    // Store extended achievement data that will be picked up by getScore()
    this.extendedGameData = {
      distance: Math.floor(this.distance),
      speed: this.gameSpeed,
      jumps: this.jumps,
      combo: this.comboSystem.getMaxCombo(),
      powerupsUsed: this.powerupsUsed,
      powerupTypesUsed: this.powerupTypesUsed.size,
      bossesDefeated: this.bossesDefeated
    };

    // Track analytics for game-specific achievements
    this.services.analytics.trackGameSpecificStat(this.manifest.id, 'distance', Math.floor(this.distance));
    this.services.analytics.trackGameSpecificStat(this.manifest.id, 'max_speed', this.gameSpeed);
    this.services.analytics.trackGameSpecificStat(this.manifest.id, 'jumps', this.jumps);
    this.services.analytics.trackGameSpecificStat(this.manifest.id, 'max_combo', this.comboSystem.getMaxCombo());
    this.services.analytics.trackGameSpecificStat(this.manifest.id, 'powerups_total', this.powerupsUsed);
    this.services.analytics.trackGameSpecificStat(this.manifest.id, 'powerup_types', this.powerupTypesUsed.size);
    this.services.analytics.trackGameSpecificStat(this.manifest.id, 'bosses_defeated', this.bossesDefeated);

    // Call parent which will handle the final scoring and Hub callback
    super.onGameEnd?.(finalScore);
  }

  protected onRestart(): void {
    this.obstacles = [];
    this.coins = [];
    this.powerUps = [];
    this.flyingEnemies = [];
    this.hoverEnemies = [];
    this.boss = null;
    this.bossProjectiles = [];
    this.activePowerUps = [];
    this.particles = new ParticleSystem();
    this.screenShake = new ScreenShake();
    this.comboSystem?.resetAll?.();
    this.environmentSystem = new EnvironmentSystem();
    this.gameSpeed = 1;
    this.distance = 0;
    this.currentThemeIndex = 0;
    this.bossesDefeated = 0;
    this.bossVictoryTimer = 0;
    this.specialEventMeter = 0;
    this.activeEvent = 'none';
    this.eventTimer = 0;
    this.gameState = 'menu';
    this.menuSelection = 'play';
    this.inputCooldown = 0;
    this.lives = this.maxLives;
    this.isInvulnerable = false;
    this.invulnerabilityTimer = 0;
    this.deathAnimationTimer = 0;
    this.deathAnimationScale = 1;
    this.resetTutorialProgress();
    this.scheduleNextObstacle();
    this.scheduleNextAerial();
    this.jumps = 0;
    this.powerupsUsed = 0;
    this.powerupTypesUsed.clear();
    this.player = new Player(100, this.groundY - 32, this.groundY, this.canvas.width);
    this.parallaxSystem.reset();
  }
}
