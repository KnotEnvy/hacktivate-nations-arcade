// ===== src/games/runner/RunnerGame.ts (ENHANCED) =====
import { BaseGame } from '@/games/shared/BaseGame';
import { GameManifest, GameScore } from '@/lib/types';
import { Rectangle } from '@/games/shared/utils/Vector2';
import { Player } from './entities/Player';
import { Obstacle, ObstacleType } from './entities/Obstacle';
import { Coin } from './entities/Coin';
import { PowerUp, PowerUpType } from './entities/PowerUp';
import { FlyingEnemy } from './entities/FlyingEnemy';
import { HoverEnemy } from './entities/HoverEnemy';
import { Boss, AttackType } from './entities/Boss';
import { BossProjectile } from './entities/BossProjectile';
import { GroundPound } from './entities/GroundPound';
import { ParticleSystem } from './systems/ParticleSystem';
import { ScreenShake } from './systems/ScreenShake';
import { ComboSystem } from './systems/ComboSystem';
import { ComboFlash } from './systems/ComboFlash';
import { EnvironmentSystem } from './systems/EnvironmentSystem';
import { ParallaxSystem } from './systems/ParallaxSystem';
import { PlayerAura } from './entities/PlayerAura';
import { HudRenderer, HudState, sansFamily } from './systems/HudRenderer';
import { ScorePopups } from './systems/ScorePopups';
import { GrazeSystem, Grazeable } from './systems/GrazeSystem';
import {
  StageFeature,
  StageFeatureKind,
  FEATURE_FOR_THEME,
} from './entities/StageFeature';

/**
 * Said once, the first time a run meets each stage feature. After that the
 * shape of the thing is the instruction.
 */
const FEATURE_HINTS: Record<StageFeatureKind, { title: string; body: string }> = {
  geyser: { title: 'EMBER VENT', body: 'It flares on a cycle. Cross it while it sleeps.' },
  updraft: { title: 'UPDRAFT', body: 'Ride the column to the high route.' },
  gust: { title: 'SAND GUST', body: 'Hold RIGHT to keep your ground.' },
  bounce: { title: 'SPORE PAD', body: 'Land on it for a launch no jump can match.' },
};

/** How long a first-encounter hint stays up, in seconds. */
const HINT_DURATION = 3.4;

/** Metres of clean running per bonus, and what each one is worth. */
const CLEAN_STEP = 750;
const CLEAN_BONUS = 150;
import { Director, DirectorState, SpawnApi } from './systems/Director';
import { GameCamera } from './systems/GameCamera';
import { WorldRenderer } from './systems/WorldRenderer';

/** Coins awarded for felling a boss. Referenced by the victory screen too, so
 *  the number the player is promised is the number they are paid. */
const BOSS_BONUS_COINS = 15;

/**
 * Awards, in score.
 *
 * These are deliberately modest. A first pass paid 1000 for a boss and 100
 * per hit on it, which — at a dozen hits a boss — made a single fight worth
 * roughly ten times the distance run to reach it, and turned an endless
 * runner's score into a boss-kill counter. Distance stays the spine; this is
 * the topping. A skilled player's grazes are what should close the gap.
 */
const BOSS_BONUS_SCORE = 250;
const BOSS_HIT_SCORE = 25;
const STOMP_SCORE = 25;


/** How long the "stage begins" banner stays up, in seconds. */
const STAGE_BANNER_DURATION = 2.6;

/**
 * How far past each edge of the canvas the world is drawn.
 *
 * The camera pulls back as the run speeds up, which reveals area outside the
 * canvas rectangle. Anything that fills the frame — the sky, the floor, the
 * ground dressing — has to reach this far past it or the pull-back exposes
 * bare background at the edges.
 */
export const WORLD_OVERSCAN = 110;

/** How long the red hurt vignette lingers, in seconds. */
const HURT_FLASH_DURATION = 0.55;

/**
 * One procedural track per stage, plus a boss theme.
 *
 * The runner shipped silent apart from its effects. These are all existing
 * ProceduralMusicEngine tracks (see GAME_TRACK_MAPPING), chosen so the mood
 * climbs across the five stages and drops into tension for a boss.
 */
const STAGE_MUSIC = [
  'arcade_bounce',
  'action_chase',
  'space_exploration',
  'action_intense',
  'epic_heroic',
] as const;
const BOSS_MUSIC = 'epic_tension';
const MENU_MUSIC = 'arcade_retro';

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

export class RunnerGame extends BaseGame implements SpawnApi {
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
  private groundPounds: GroundPound[] = [];
  private particles!: ParticleSystem;
  private screenShake!: ScreenShake;
  private comboSystem!: ComboSystem;
  private comboFlash!: ComboFlash;
  private environmentSystem!: EnvironmentSystem;
  private playerAura!: PlayerAura;
  
  private gameSpeed: number = 1;
  // Distance based spawning
  private nextObstacleDistance: number = 0;
  private nextAerialDistance: number = 0;
  private distance: number = 0;
  private groundY: number = 0;
  private jumps: number = 0;
  private enemiesStomped: number = 0;
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

  // Boss and theme system (decoupled from distance)
  private themeLevel: number = 0;              // Current theme index (0-4, cycles through 5 themes)
  private bossDefeatedForTheme: boolean = false; // Prevents duplicate boss spawns in same theme
  private themeProgress: number = 0;           // Progress within current theme (0 to THEME_DISTANCE)
  private readonly BOSS_SPAWN_THRESHOLD: number = 2800;
  private readonly BOSS_WARNING_THRESHOLD: number = 2500;
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

  /** Frames of frozen simulation left, for hit impact. */
  private hitStopTimer: number = 0;
  /** Seconds before the boss can be stomped again. */
  private bossHitCooldown: number = 0;
  /** Countdown on the red edge flash after a hit. */
  private hurtFlashTimer: number = 0;

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

  /** World odometer for the ground dressing, so tufts keep their shape. */
  private groundScroll: number = 0;

  //paralax system
  private parallaxSystem!: ParallaxSystem;

  private hud!: HudRenderer;
  private popups!: ScorePopups;
  private grazes!: GrazeSystem;
  private stageFeatures: StageFeature[] = [];
  private director = new Director();
  private camera!: GameCamera;
  private world!: WorldRenderer;
  /**
   * Score earned by doing things, as opposed to by covering ground. `score`
   * is recomputed from distance every frame, so awards have to live here or
   * they would be wiped on the next tick.
   */
  private bonusScore: number = 0;
  /** Metres since the last hit, and how many clean bonuses that has paid. */
  private cleanDistance: number = 0;
  private cleanAwards: number = 0;
  /** Feature kinds already introduced this run. */
  private hintedFeatures = new Set<StageFeatureKind>();
  private hintKind: StageFeatureKind | null = null;
  private hintTimer: number = 0;
  /** What the music director last asked for, so it only switches on change. */
  private currentTrack: string | null = null;
  /** Best score across restarts within this mount, shown on the menu. */
  private sessionBest: number = 0;
  private maxSpeedReached: number = 1;
  private stageBannerTimer: number = 0;


  protected onInit(): void {
    this.groundY = this.canvas.height - 50;
    this.player = new Player(100, this.groundY - 32, this.groundY, this.canvas.width);
    this.particles = new ParticleSystem();
    this.screenShake = new ScreenShake();
    this.comboSystem = new ComboSystem();
    this.comboFlash = new ComboFlash();
    this.environmentSystem = new EnvironmentSystem();
    this.playerAura = new PlayerAura();

    // Connect combo flash to combo system
    this.comboSystem.setOnResetCallback(() => this.comboFlash.resetMilestones());
    // Initialize the new parallax system
    this.parallaxSystem = new ParallaxSystem(
      this.canvas.width,
      this.canvas.height,
      this.groundY
    );
    this.parallaxSystem.setOverscan(WORLD_OVERSCAN);
    this.parallaxSystem.reset();
    this.hud = new HudRenderer(this.canvas.width, this.canvas.height);
    this.popups = new ScorePopups();
    this.popups.setViewport(this.canvas.width, this.canvas.height);
    this.camera = new GameCamera(this.canvas.width, this.canvas.height);
    this.world = new WorldRenderer(
      this.canvas.width,
      this.canvas.height,
      this.groundY,
      WORLD_OVERSCAN
    );
    this.grazes = new GrazeSystem();
    // The runner draws its own chrome; the base Score/Coins overlay would sit
    // straight on top of it.
    this.renderBaseHud = false;
    this.startTime = Date.now();
    this.jumps = 0;
    this.enemiesStomped = 0;
    this.powerupsUsed = 0;
    this.powerupTypesUsed.clear();

    // Schedule first spawns
    this.director.rescheduleAll(this.directorState());

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

    this.hud.update(dt);
    this.updateMusic();

    if (this.hurtFlashTimer > 0) this.hurtFlashTimer = Math.max(0, this.hurtFlashTimer - dt);
    if (this.hintTimer > 0) this.hintTimer = Math.max(0, this.hintTimer - dt);
    if (this.bossHitCooldown > 0) this.bossHitCooldown = Math.max(0, this.bossHitCooldown - dt);

    // Hit-stop freezes the SIMULATION only. The HUD clock and the music above
    // keep running, so the pause reads as impact rather than as a stall.
    if (this.hitStopTimer > 0) {
      this.hitStopTimer -= dt;
      this.screenShake.update(dt);
      this.cameraOffset = this.screenShake.getOffset();
      return;
    }

    // Handle menu state
    if (this.gameState === 'menu') {
      this.handleMenuUpdate(dt, upPressed, downPressed, jumpPressed);
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

    // Update player afterimages (for speed boost visual effect)
    this.player.updateAfterimages(dt, this.hasPowerUp('speed-boost'));

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
      this.services.audio.playSound('land', { volume: 0.5 });
      this.jumps++;
      this.jumpInProgress = false;

      // Tutorial tracking
      if (this.gameState === 'tutorial' && this.tutorialProgress.currentStep === 0) {
        this.tutorialProgress.jumpsCompleted++;
      }
    }

    if (slideStarted) {
      this.services.audio.playSound('whoosh');

      // Tutorial tracking
      if (this.gameState === 'tutorial' && this.tutorialProgress.currentStep === 1) {
        this.tutorialProgress.slidesCompleted++;
      }
    }

    // Handle particle effects
    this.handlePlayerEffects(jumpStarted, landing, slideStarted);


    // Update game speed and distance.
    //
    // A boss fight is fought in place, so the odometer only trickles. Left at
    // the full rate a player could camp in a fight they had no intention of
    // winning and farm score indefinitely just by dodging — distance is
    // supposed to mean distance.
    const baseIncrement = this.gameSpeed * dt * 100 * (this.boss ? 0.2 : 1);
    this.distance += baseIncrement;
    // A smooth, CAPPED ramp. The old `1 + floor(distance/1000) * 0.2` had no
    // ceiling, so a long run eventually outran its own jump arc.
    this.gameSpeed = 1 + 2.1 * (1 - Math.exp(-this.distance / 5200));
    this.maxSpeedReached = Math.max(this.maxSpeedReached, this.gameSpeed);

    // Apply speed boost power-up and speed zone event
    let speedMultiplier = this.hasPowerUp('speed-boost') ? 1.5 : 1;
    if (this.activeEvent === 'speed-zone') {
      // 2x was unsurvivable once the base speed had ramped: the screen moved
      // further in a jump arc than the player could see coming.
      speedMultiplier *= 1.45;
    }
    const effectiveSpeed = this.gameSpeed * speedMultiplier;
    const distanceIncrement = effectiveSpeed * dt * 100;

    // Update theme progress (separate from distance - for boss spawning)
    this.themeProgress += distanceIncrement;
    this.groundScroll += distanceIncrement;

    // Clean running pays. Taking a hit resets it, which is what makes the
    // last stretch before a bonus genuinely tense.
    if (this.gameState === 'playing') {
      this.cleanDistance += baseIncrement;
      const due = Math.floor(this.cleanDistance / CLEAN_STEP);
      if (due > this.cleanAwards) {
        this.cleanAwards = due;
        this.bonusScore += CLEAN_BONUS;
        this.popups.add(
          this.player.position.x + 16,
          this.player.position.y - 30,
          `CLEAN ${due * CLEAN_STEP}m  +${CLEAN_BONUS}`,
          'bonus'
        );
        this.services.audio.playSound('success', { volume: 0.4 });
      }
    }

    // Update all entities
    this.updateEntities(dt, effectiveSpeed);
    this.updateSystems(dt);

    // Update environment using themeLevel directly (NOT distance)
    this.environmentSystem.setTheme(this.themeLevel);
    this.player.setAccent(this.environmentSystem.getAccentColor());
    
    // Handle spawning
    this.handleSpawning();
    
    // Handle collisions
    this.checkCollisions();

    // Check tutorial progress
    if (this.gameState === 'tutorial') {
      this.checkTutorialProgress();
    }

    // Update score. Distance is the spine; everything the player actively
    // does adds on top, so a skilful run outscores a long one.
    this.score = Math.floor(this.distance / 10) + this.bonusScore;
    // Scroll parallax layers by the distance moved this frame
    this.parallaxSystem.update(distanceIncrement, dt);
  }

  public getScore() {
    const baseScore = super.getScore?.() || {
      score: this.score,
      pickups: this.pickups,
      timePlayedMs: Math.round(this.gameTime * 1000),
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
      enemiesStomped: this.enemiesStomped,
      nearMisses: this.grazes.getTotal(),
    };
  }


  private handlePlayerEffects(jumpStarted: boolean, landing: boolean, slideStarted: boolean = false): void {
    if (jumpStarted) {
      this.particles.createJumpDust(this.player.position.x, this.player.position.y);
      // Impact ring on jump
      this.particles.createImpactRing(
        this.player.position.x + this.player.size.x / 2,
        this.player.position.y + this.player.size.y,
        'jump'
      );
    }

    if (landing) {
      this.particles.createLandingDust(this.player.position.x, this.player.position.y);
      // Impact ring on landing
      this.particles.createImpactRing(
        this.player.position.x + this.player.size.x / 2,
        this.groundY,
        'land'
      );
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
          coin.markAttracted();
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
    } else {
      // During a boss fight the arena is cleared of obstacles, but a summoned
      // minion still has to animate and die.
      this.hoverEnemies.forEach(enemy => enemy.update(dt, gameSpeed));
      this.hoverEnemies = this.hoverEnemies.filter(enemy => !enemy.isOffScreen());
    }

    // Update boss
    if (this.boss) {
      this.boss.update(dt, gameSpeed);

      // Boss charge trail particles
      if (this.boss.isCharging()) {
        this.particles.createChargeTrail(
          this.boss.position.x + this.boss.size.x,
          this.boss.position.y,
          this.boss.getBossType()
        );
      }

      // Boss rage particles
      if (this.boss.getPhase() === 'rage' && Math.random() < 0.3) {
        this.particles.createBossRageEffect(
          this.boss.position.x + this.boss.size.x / 2,
          this.boss.position.y + this.boss.size.y / 2
        );
      }

      // Process boss attack queue
      const attacks = this.boss.consumeAttacks();
      for (const attack of attacks) {
        this.handleBossAttack(attack.type, attack.x, attack.y);
      }

      // Transition to boss victory when defeated
      if (this.boss.isDefeated() && this.boss.isOffScreen()) {
        this.bossesDefeated++;
        this.pickups += BOSS_BONUS_COINS;
        this.bonusScore += BOSS_BONUS_SCORE;
        this.popups.add(
          this.boss.position.x + this.boss.size.x / 2,
          this.boss.position.y,
          `+${BOSS_BONUS_SCORE}`,
          'bonus'
        );
        this.bossDefeatedForTheme = true; // Mark boss as defeated for this theme
        this.gameState = 'boss-victory';
        this.bossVictoryTimer = 0;

        // Spawn victory coins at boss death location
        const bossX = this.boss.position.x + this.boss.size.x / 2;
        const bossY = this.boss.position.y + this.boss.size.y / 2;
        this.spawnVictoryCoins(bossX, bossY);

        // Boss explosion particles
        this.particles.createBossExplosion(bossX, bossY, this.boss.getBossType());

        this.boss = null;
        this.groundPounds = []; // Clear any remaining ground pounds
        this.screenShake.shake(20, 0.6);
        this.services.audio.playSound('success');
      }
    }

    // Update boss projectiles
    this.bossProjectiles.forEach(proj => {
      proj.update(dt, gameSpeed);
      // Add fire trail particles
      if (Math.random() < 0.5) {
        this.particles.createProjectileTrail(
          proj.position.x + proj.size.x,
          proj.position.y + proj.size.y / 2
        );
      }
    });
    this.bossProjectiles = this.bossProjectiles.filter(proj => !proj.isOffScreen());

    // Update ground pounds
    this.groundPounds.forEach(gp => gp.update(dt));
    this.groundPounds = this.groundPounds.filter(gp => !gp.isOffScreen());

    // Stage features keep running during a boss fight so a gust or a geyser
    // already on screen finishes its business rather than vanishing.
    this.stageFeatures.forEach(f => f.update(dt, gameSpeed));
    this.stageFeatures = this.stageFeatures.filter(f => !f.isOffScreen());
  }

  /**
   * Pick the track the current moment wants and switch only when it changes —
   * playMusic tears the old track down and starts a new one, so calling it
   * every frame would stutter forever.
   */
  private updateMusic(): void {
    let wanted: string | null;
    switch (this.gameState) {
      case 'menu':
      case 'stats-recap':
        wanted = MENU_MUSIC;
        break;
      case 'death-animation':
        wanted = null;
        break;
      default:
        wanted = this.boss
          ? BOSS_MUSIC
          : STAGE_MUSIC[this.themeLevel % STAGE_MUSIC.length];
    }

    if (wanted === this.currentTrack) return;
    this.currentTrack = wanted;

    if (wanted === null) {
      this.services?.audio?.stopMusic?.(0.4);
      return;
    }
    this.services?.audio?.playMusic?.(
      wanted as Parameters<NonNullable<typeof this.services.audio.playMusic>>[0],
      0.8
    );
  }

  private updateSystems(dt: number): void {
    this.hud.update(dt);
    this.popups.update(dt);
    this.grazes.update(dt);
    if (this.stageBannerTimer > 0) this.stageBannerTimer = Math.max(0, this.stageBannerTimer - dt);
    this.particles.update(dt);
    this.screenShake.update(dt);
    this.comboSystem.update(dt);
    this.comboFlash.update(dt);

    // Update player aura based on game state
    this.playerAura.update(dt, {
      combo: this.comboSystem.getCombo(),
      hasSpeedBoost: this.hasPowerUp('speed-boost'),
      hasInvincibility: this.hasPowerUp('invincibility'),
      gameSpeed: this.gameSpeed
    });

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

    // The camera folds the shake in, so the render path has one transform.
    this.cameraOffset = this.screenShake.getOffset();
    this.camera.update(
      dt,
      {
        gameSpeed: this.gameSpeed,
        playerHeight: this.groundY - (this.player.position.y + this.player.size.y),
        punch: 0,
      },
      this.cameraOffset
    );
  }

  private handleSpawning(): void {
    if (this.gameState !== 'playing' && this.gameState !== 'tutorial') return;

    // Boss spawning: based on themeProgress, not distance
    if (
      !this.boss &&
      !this.bossDefeatedForTheme &&
      this.themeProgress >= this.BOSS_SPAWN_THRESHOLD &&
      this.gameState === 'playing'
    ) {
      this.spawnBoss();
      // Clear the arena for the fight.
      this.obstacles = [];
      this.flyingEnemies = [];
      this.hoverEnemies = [];
      this.stageFeatures = [];
      return;
    }

    // Special events (combo- and graze-charged)
    if (
      this.specialEventMeter >= this.specialEventThreshold &&
      this.activeEvent === 'none' &&
      !this.boss &&
      this.gameState === 'playing'
    ) {
      this.triggerSpecialEvent();
    }

    if (this.activeEvent === 'coin-shower' && Math.random() < 0.3) {
      this.spawnCoin(Math.random() * 100);
    }

    // Everything else is the director's call.
    if (!this.boss) this.director.update(this.directorState(), this);
  }

  private directorState(): DirectorState {
    return {
      distance: this.distance,
      gameSpeed: this.gameSpeed,
      tutorial: this.gameState === 'tutorial',
      tutorialStep: this.tutorialProgress.currentStep,
      feature:
        FEATURE_FOR_THEME[this.environmentSystem.getCurrentTheme()] ?? null,
    };
  }

  // --- SpawnApi -------------------------------------------------------------
  //
  // The director decides WHAT and WHEN; these put it on screen. They are
  // public because Director takes the game as its SpawnApi.

  groundBusy(range: number): boolean {
    const spawnX = this.canvas.width + 50;
    return this.obstacles.some(o => Math.abs(o.position.x - spawnX) < range);
  }

  spawnStageFeature(kind: StageFeatureKind): void {
    const spawnX = this.canvas.width + 60;
    this.stageFeatures.push(new StageFeature(spawnX, this.groundY, kind));

    // Introduce it once per run, as it arrives.
    if (!this.hintedFeatures.has(kind)) {
      this.hintedFeatures.add(kind);
      this.hintKind = kind;
      this.hintTimer = HINT_DURATION;
    }

    // Each feature arrives with the reward for engaging with it, so its
    // purpose is legible the first time the player meets one.
    switch (kind) {
      case 'updraft':
        // A coin line up the column and along the high route it opens.
        for (let i = 0; i < 5; i++) {
          this.coins.push(
            new Coin(spawnX + 22 + i * 30, this.groundY - 120 - i * 26)
          );
        }
        break;
      case 'bounce':
        // Coins stacked above the pad: proof of what the launch is for.
        for (let i = 0; i < 4; i++) {
          this.coins.push(
            new Coin(spawnX + 16 + i * 8, this.groundY - 120 - i * 46)
          );
        }
        break;
      case 'geyser':
        // Coins just past the vent, so crossing it is worth the timing.
        this.spawnCoinArc(110, 3, 70);
        break;
      case 'gust':
        // Coins strung through the gust: holding ground pays.
        this.spawnLowCoins(70, 4);
        break;
    }
  }

  private triggerSpecialEvent(): void {
    const events: ('coin-shower' | 'speed-zone')[] = ['coin-shower', 'speed-zone'];
    this.activeEvent = events[Math.floor(Math.random() * events.length)];
    this.eventTimer = 0;
    this.specialEventMeter = 0; // Reset meter
    this.screenShake.shake(6, 0.2);
    this.services.audio.playSound('achievement');
  }

  private handleMenuUpdate(
    dt: number,
    upPressed: boolean,
    downPressed: boolean,
    selectPressed: boolean
  ): void {
    // The menu keeps its own scroll running so the title screen is alive.
    this.parallaxSystem.update(28 * dt, dt);

    if (this.inputCooldown > 0) {
      this.inputCooldown -= dt;
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
        this.stageBannerTimer = STAGE_BANNER_DURATION;
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
    this.parallaxSystem.update(slowSpeed * dt * 100, dt);

    // Transition back to playing after victory duration
    if (this.bossVictoryTimer >= this.bossVictoryDuration) {
      this.gameState = 'playing';
      this.bossVictoryTimer = 0;

      // CLEAN THEME TRANSITION:
      // 1. Advance to next theme level
      this.themeLevel = (this.themeLevel + 1) % 5;

      // 2. Reset theme progress (start fresh in new theme)
      this.themeProgress = 0;

      // 3. Reset boss-defeated flag for new theme
      this.bossDefeatedForTheme = false;

      // 4. Update environment to new theme
      this.environmentSystem.setTheme(this.themeLevel);
      this.stageBannerTimer = STAGE_BANNER_DURATION;

      // NOTE: distance is NOT touched - it continues as pure progress metric
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
    this.services.audio.playSound('hurt_grunt');
    this.screenShake.shake(12, 0.35);

    // Freeze the sim for a beat. Hit-stop is the cheapest way to make a hit
    // land, and it costs nothing but a timer.
    this.hitStopTimer = 0.09;
    this.hurtFlashTimer = HURT_FLASH_DURATION;

    // A hit breaks every chain — that is the real cost of a mistake.
    this.comboSystem.resetCombo();
    this.cleanDistance = 0;
    this.cleanAwards = 0;

    this.particles.createLandingDust(this.player.position.x, this.player.position.y);
    this.particles.createImpactRing(
      this.player.position.x + this.player.size.x / 2,
      this.player.position.y + this.player.size.y / 2,
      'boss'
    );

    if (this.lives <= 0) {
      this.gameState = 'death-animation';
      this.deathAnimationTimer = 0;
      this.deathAnimationScale = 1;
      this.services.audio.playSound('death_cry');
      this.screenShake.shake(22, 0.6);
      return;
    }

    // Knock back, then hand control straight back.
    //
    // The old version set velocity.x to -200, which is expressed in px PER
    // FRAME here, so it teleported the runner 200px left in a single step
    // before Player.update zeroed it again.
    this.player.hurt();
    this.isInvulnerable = true;
    this.invulnerabilityTimer = this.invulnerabilityDuration;

    // Clear the way ahead so the player is not hit again while blinking.
    this.obstacles = this.obstacles.filter(
      obs => obs.position.x > this.player.position.x + 210
    );
    this.hoverEnemies = this.hoverEnemies.filter(
      e => e.position.x > this.player.position.x + 210
    );
    this.flyingEnemies = this.flyingEnemies.filter(
      e => e.position.x > this.player.position.x + 210
    );
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
      this.gameState = 'stats-recap';
      this.sessionBest = Math.max(this.sessionBest, this.score);
    }
  }

  protected onRender(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    this.camera.apply(ctx);

    this.renderEnhancedBackground(ctx);
    this.world.renderGround(
      ctx,
      this.environmentSystem.getPalette(),
      this.groundScroll
    );

    // Stage features sit behind the hazards: an updraft column or a gust is
    // atmosphere the rest of the scene plays in front of.
    this.stageFeatures.forEach(f => f.render(ctx));

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
    this.groundPounds.forEach(gp => gp.render(ctx));

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

      // Render player aura (behind player)
      this.playerAura.render(
        ctx,
        this.player.position.x,
        this.player.position.y,
        this.player.size.x,
        this.player.size.y
      );

      this.player.render(ctx);
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
    }

    this.particles.render(ctx);

    // The occluding band goes over the entities but under the readouts.
    this.parallaxSystem.renderForeground(
      ctx,
      this.environmentSystem.getCurrentTheme()
    );

    this.popups.render(ctx, sansFamily());

    // End of the camera transform. Everything past here is a SCREEN-space
    // effect — it must not zoom with the world, and it has to cover the full
    // frame rather than the overscanned world rectangle.
    ctx.restore();

    this.world.renderAmbientLight(ctx, this.environmentSystem.getPalette());
    this.world.renderVignettes(ctx, {
      hurt: this.hurtFlashTimer / HURT_FLASH_DURATION,
      lastLife: this.lives === 1 && this.gameState === 'playing',
      time: this.gameTime,
    });
    this.world.renderSpeedLines(ctx, this.speedHeat(), this.distance);

    // Render combo flash overlay (on top of everything in game layer)
    this.comboFlash.render(ctx, this.canvas.width, this.canvas.height);
  }

  protected onRenderUI(ctx: CanvasRenderingContext2D): void {
    switch (this.gameState) {
      case 'menu':
        this.hud.renderMenu(ctx, this.menuSelection, this.sessionBest);
        return;
      case 'boss-victory':
        this.hud.renderBossVictory(
          ctx,
          this.bossesDefeated,
          BOSS_BONUS_COINS,
          EnvironmentSystem.paletteForIndex(this.themeLevel + 1).name,
          EnvironmentSystem.paletteForIndex(this.themeLevel + 1).accent,
          this.bossVictoryDuration - this.bossVictoryTimer,
          this.bossVictoryDuration
        );
        return;
      case 'death-animation':
        // The death beat plays with no chrome at all.
        return;
      case 'stats-recap':
        this.hud.renderRecap(
          ctx,
          this.buildRecapStats(),
          this.score,
          this.buildGrade(),
          this.score > 0 && this.score >= this.sessionBest
        );
        return;
      case 'tutorial':
        this.hud.renderPlaying(ctx, this.buildHudState(), false);
        this.hud.renderTutorial(
          ctx,
          this.tutorialProgress.currentStep,
          this.tutorialStepDone(),
          this.tutorialStepNeeded()
        );
        return;
      default:
        this.hud.renderPlaying(ctx, this.buildHudState());
    }
  }

  private buildHudState(): HudState {
    const palette = this.environmentSystem.getPalette();
    const bossApproaching =
      !this.boss &&
      !this.bossDefeatedForTheme &&
      this.themeProgress >= this.BOSS_WARNING_THRESHOLD &&
      this.gameState === 'playing';

    return {
      score: this.score,
      coins: this.pickups,
      lives: this.lives,
      maxLives: this.maxLives,
      distance: this.distance,
      speed: this.gameSpeed,
      combo: this.comboSystem.getCombo(),
      comboTimeLeft: this.comboSystem.getTimeLeft(),
      comboTimeLimit: this.comboSystem.getTimeLimit(),
      comboMultiplier: this.comboSystem.getMultiplier(),
      comboScale: this.comboFlash.getTextScale(),
      powerUps: this.activePowerUps,
      eventMeter: this.specialEventMeter,
      eventThreshold: this.specialEventThreshold,
      activeEvent: this.activeEvent,
      eventTimeLeft: this.eventDuration - this.eventTimer,
      eventDuration: this.eventDuration,
      boss:
        this.boss && !this.boss.isDefeated()
          ? {
              name: this.boss.getBossName(),
              number: this.boss.getBossNumber(),
              health: this.boss.health,
              maxHealth: this.boss.maxHealth,
              phase: this.boss.getPhase(),
              exposed: this.boss.isExposed(),
              glowColor: this.boss.getConfig().glowColor,
              primaryColor: this.boss.getConfig().primaryColor,
              secondaryColor: this.boss.getConfig().secondaryColor,
            }
          : null,
      bossIn: bossApproaching
        ? this.BOSS_SPAWN_THRESHOLD - this.themeProgress
        : null,
      grazeStreak: this.grazes.getStreak(),
      grazeWindowLeft: this.grazes.getStreakTimeLeft(),
      stageProgress: this.themeProgress / this.BOSS_SPAWN_THRESHOLD,
      cleanDistance: this.cleanDistance,
      hint:
        this.hintKind && this.hintTimer > 0
          ? {
              ...FEATURE_HINTS[this.hintKind],
              // Fade in and out at the ends, hold in the middle.
              alpha: Math.min(
                1,
                (HINT_DURATION - this.hintTimer) / 0.4,
                this.hintTimer / 0.5
              ),
            }
          : null,
      stageName: palette.name,
      stageNumber: this.themeLevel + 1,
      accent: palette.accent,
      stageBanner: this.stageBannerAlpha(),
      invulnerable: this.isInvulnerable,
    };
  }

  /**
   * The stage banner's opacity: a 0.6s fade in, a hold, a 0.6s fade out.
   * `stageBannerTimer` counts DOWN from STAGE_BANNER_DURATION to zero.
   */
  private stageBannerAlpha(): number {
    if (this.stageBannerTimer <= 0) return 0;
    const fade = 0.6;
    const elapsed = STAGE_BANNER_DURATION - this.stageBannerTimer;
    return Math.min(1, elapsed / fade, this.stageBannerTimer / fade);
  }

  private tutorialStepDone(): number {
    const p = this.tutorialProgress;
    switch (p.currentStep) {
      case 0: return p.jumpsCompleted;
      case 1: return p.slidesCompleted;
      case 2: return p.coinsCollected;
      default: return 0;
    }
  }

  private tutorialStepNeeded(): number {
    const p = this.tutorialProgress;
    switch (p.currentStep) {
      case 0: return p.requiredJumps;
      case 1: return p.requiredSlides;
      case 2: return p.requiredCoins;
      default: return 0;
    }
  }

  private buildRecapStats(): { label: string; value: string; highlight?: boolean }[] {
    return [
      { label: 'Distance', value: `${Math.floor(this.distance)}m` },
      { label: 'Coins', value: String(this.pickups), highlight: true },
      { label: 'Best combo', value: `${this.comboSystem.getMaxCombo()}x` },
      { label: 'Top speed', value: `${this.maxSpeedReached.toFixed(1)}x` },
      { label: 'Stage reached', value: `${this.themeLevel + 1} / 5` },
      { label: 'Bosses beaten', value: String(this.bossesDefeated) },
      { label: 'Near misses', value: String(this.grazes.getTotal()) },
      { label: 'Best chain', value: `${this.grazes.getBest()}x` },
    ];
  }

  /**
   * A letter for the run. Distance is the spine of the score, so the bands are
   * set on it, and the boss kills a player earned move them up.
   */
  private buildGrade(): { letter: string; color: string; caption: string } {
    // Skill counts, not just endurance: near misses and stomps are weighted
    // heavily enough that a short, sharp run can outgrade a long careful one.
    const rating =
      this.distance +
      this.bossesDefeated * 1500 +
      this.pickups * 8 +
      this.grazes.getTotal() * 40 +
      this.enemiesStomped * 60;
    if (rating >= 12000) return { letter: 'S', color: '#f0b429', caption: 'Untouchable' };
    if (rating >= 8000) return { letter: 'A', color: '#34d399', caption: 'Excellent' };
    if (rating >= 5000) return { letter: 'B', color: '#7c6bff', caption: 'Strong run' };
    if (rating >= 2500) return { letter: 'C', color: '#9182ff', caption: 'Getting there' };
    if (rating >= 1000) return { letter: 'D', color: '#a2a9b8', caption: 'Keep at it' };
    return { letter: 'E', color: '#6d7484', caption: 'Warming up' };
  }

  /** How fast the run FEELS, for the speed lines. 0 = still, 1 = flat out. */
  private speedHeat(): number {
    return Math.min(
      1,
      Math.max(0, (this.gameSpeed - 1.7) / 1.4) +
        (this.hasPowerUp('speed-boost') ? 0.45 : 0) +
        (this.activeEvent === 'speed-zone' ? 0.55 : 0)
    );
  }

  private renderEnhancedBackground(ctx: CanvasRenderingContext2D): void {
    // The parallax system owns the sky gradient too, so the horizon haze it
    // paints can sit between the sky and the distant silhouettes.
    this.parallaxSystem.render(ctx, this.environmentSystem.getCurrentTheme());
  }

  spawnPowerUp(): void {
    const types: PowerUpType[] = ['double-jump', 'coin-magnet', 'invincibility', 'speed-boost'];
    const type = types[Math.floor(Math.random() * types.length)];
    const x = this.canvas.width + 50;
    const y = this.groundY - 100 - Math.random() * 100;
    this.powerUps.push(new PowerUp(x, y, type));
  }

  spawnFlyingEnemy(): void {
    const x = this.canvas.width + 50;
    const y = this.groundY - 150 - Math.random() * 100;
    this.flyingEnemies.push(
      new FlyingEnemy(x, y, this.environmentSystem.getCurrentTheme())
    );
  }

  spawnHoverEnemy(): void {
    const x = this.canvas.width + 50;
    // At groundY - 84 the drone's box cleared a standing runner entirely, so
    // it was only ever a hazard to someone already mid-jump. Down here it is
    // a genuine obstacle: jump it, or land on it and pop it.
    const y = this.groundY - 48;
    this.hoverEnemies.push(
      new HoverEnemy(x, y, this.environmentSystem.getCurrentTheme())
    );
  }

  private spawnBoss(): void {
    this.boss = new Boss(this.canvas.width + 100, this.groundY, this.themeLevel);
    this.screenShake.shake(20, 0.8);
    this.services.audio.playSound('unlock');

    // Clear enemies for boss fight
    this.flyingEnemies = [];
    this.hoverEnemies = [];
  }

  private handleBossAttack(type: AttackType, x: number, y: number): void {
    switch (type) {
      case 'projectile':
        this.bossProjectiles.push(
          new BossProjectile(x, y, this.groundY - 32)
        );
        this.services.audio.playSound('powerup');
        break;

      case 'groundPound':
        this.groundPounds.push(new GroundPound(x, this.groundY));
        // Ground pound dust effect
        this.particles.createGroundPoundDust(x, this.groundY);
        this.screenShake.shake(10, 0.3);
        this.services.audio.playSound('hit');
        break;

      case 'summon':
        // Spawn a hover enemy as minion
        this.hoverEnemies.push(
          new HoverEnemy(x, y, this.environmentSystem.getCurrentTheme())
        );
        // Summon effect particles
        this.particles.createSummonEffect(x, y);
        this.services.audio.playSound('powerup');
        break;

      // Charge is handled internally by Boss
    }
  }

  private spawnVictoryCoins(bossX: number, bossY: number): void {
    // Spawn bonus coins in a burst pattern around boss death location
    const coinCount = 8;
    for (let i = 0; i < coinCount; i++) {
      // Spread coins in a circular pattern around boss position
      const angle = (i / coinCount) * Math.PI * 2;
      const distance = 30 + Math.random() * 50;
      const x = Math.max(20, Math.min(this.canvas.width - 20, bossX + Math.cos(angle) * distance));
      const y = Math.max(50, Math.min(this.groundY - 50, bossY + Math.sin(angle) * distance));
      const coin = new Coin(x, y);
      this.coins.push(coin);
    }
  }

  spawnObstacle(offset: number = 50, type: ObstacleType = 'cactus'): void {
    const x = this.canvas.width + offset;

    // Set position based on type.
    //
    // The barrier HANGS: its underside must sit above a sliding player's
    // hitbox (the bottom 16px of the 32px body) and below a standing one's
    // head, or the tutorial's "slide under barriers" is a lie. Bottom at
    // groundY - 20 gives a 20px slide gap and still clips anyone upright.
    let y = this.groundY - 48;
    if (type === 'spike') {
      y = this.groundY - 24;
    } else if (type === 'high-barrier') {
      y = this.groundY - 84;
    } else if (type === 'gap') {
      // A pit is anchored ON the ground line: Obstacle.renderGap cuts upward
      // through the crust from here, so the hole is a break in the floor
      // rather than a box hanging under an intact one.
      y = this.groundY;
    }

    this.obstacles.push(
      new Obstacle(x, y, type, this.environmentSystem.getCurrentTheme())
    );
  }

  /** An arc of coins over a hazard: the reward line for jumping it. */
  spawnCoinArc(offset: number, count: number, spread: number = 80): void {
    const startX = this.canvas.width + offset;
    const peak = this.groundY - 118;
    for (let i = 0; i < count; i++) {
      const t = count === 1 ? 0.5 : i / (count - 1);
      // A shallow parabola: highest in the middle, where the jump peaks.
      const lift = Math.sin(t * Math.PI) * 44;
      this.coins.push(new Coin(startX + t * spread, peak - lift + 40));
    }
  }

  /** Coins along the floor, for the reward under a slide gate. */
  spawnLowCoins(offset: number, count: number): void {
    const startX = this.canvas.width + offset;
    for (let i = 0; i < count; i++) {
      this.coins.push(new Coin(startX + i * 30, this.groundY - 26));
    }
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

  private checkCollisions(): void {
    const playerBounds = this.player.getBounds();
    const isInvincible = this.hasPowerUp('invincibility');
    const canTakeDamage = !isInvincible && !this.isInvulnerable;

    this.applyStageFeatures(playerBounds, canTakeDamage);
    if (this.gameState === 'death-animation') return;
    this.awardGrazes(playerBounds);

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

      // Hover drones can be stomped. Coming down on the top plate pops one
      // for coins and a bounce; hitting it any other way still hurts.
      for (const enemy of this.hoverEnemies) {
        if (enemy.isPopped()) continue;
        if (!playerBounds.intersects(enemy.getBounds())) continue;

        const falling = this.player.velocity.y > 0;
        const aboveTop = playerBounds.bottom - 10 <= enemy.getTopY();
        if (falling && aboveTop) {
          this.stompHoverEnemy(enemy);
          break;
        }

        this.takeDamage();
        return;
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

      // Check ground pound collisions (must jump to avoid)
      for (const groundPound of this.groundPounds) {
        if (playerBounds.intersects(groundPound.getBounds())) {
          this.takeDamage();
          return;
        }
      }
    }

    // Boss contact.
    //
    // Three boxes, and which one applies depends on the fight's rhythm:
    //
    //   STOMP  the top 55%, full width, and ONLY while the boss is in its
    //          post-attack opening. Gating on the window rather than on how
    //          low the hover wave happens to be makes the rule something the
    //          game can state and the player can read, instead of a geometry
    //          accident. The boss also drops into reach while open, so the
    //          tell and the rule agree.
    //   GUARD  the same box while it is shut. Touching it is not punished —
    //          trying at the wrong moment should teach, not cost a life — but
    //          it bounces off and does no damage.
    //   BODY   the bottom 45%, inset 28% each side. This hurts: stand under a
    //          monster and you get hit. The inset leaves the flanks clear, so
    //          the approach is to jump at the boss's EDGE and come down.
    //
    // Damage from the boss respects the post-hit invulnerability window. It
    // did not before, so one bad approach drained three lives in a fifth of
    // a second.
    if (this.boss && !this.boss.isDefeated() && this.bossHitCooldown <= 0) {
      const b = this.boss.getBounds();
      const stompBox = new Rectangle(b.x, b.y, b.width, b.height * 0.55);
      const bodyBox = new Rectangle(
        b.x + b.width * 0.28,
        b.y + b.height * 0.55,
        b.width * 0.44,
        b.height * 0.45
      );

      if (playerBounds.intersects(stompBox)) {
        if (this.boss.isExposed()) {
          this.hitBoss();
        } else {
          // Shrugged off. A bounce and a thud, so the lesson is "not yet"
          // rather than "never do that".
          this.player.velocity.y = -6;
          this.bossHitCooldown = 0.35;
          this.screenShake.shake(3, 0.1);
          this.services.audio.playSound('bounce', { volume: 0.5 });
          this.popups.add(
            this.boss.position.x + this.boss.size.x / 2,
            this.boss.position.y - 10,
            'GUARDED',
            'warn'
          );
        }
      } else if (canTakeDamage && playerBounds.intersects(bodyBox)) {
        this.takeDamage();
        return;
      }
    }

    // Check coin collisions
    for (let i = this.coins.length - 1; i >= 0; i--) {
      const coin = this.coins[i];
      if (playerBounds.intersects(coin.getBounds())) {
        this.coins.splice(i, 1);

        const multiplier = this.comboSystem.addCoin();
        this.pickups += multiplier;
        this.popups.add(
          coin.position.x + coin.size / 2,
          coin.position.y,
          multiplier > 1 ? `+${multiplier}` : '+1',
          'coin'
        );

        this.particles.createCoinPickup(
          coin.position.x + coin.size/2,
          coin.position.y + coin.size/2
        );

        // Impact ring on coin pickup
        this.particles.createImpactRing(
          coin.position.x + coin.size/2,
          coin.position.y + coin.size/2,
          'coin'
        );

        // Trigger combo flash on milestones
        this.comboFlash.trigger(this.comboSystem.getCombo());

        // Screen shake for coin pickup. The pitch of the pickup rises with
        // the combo via volume, since the engine has no pitch parameter —
        // louder as the chain grows is the closest honest equivalent.
        this.screenShake.shake(2, 0.1);
        this.services.audio.playSound('coin', {
          volume: Math.min(1, 0.55 + this.comboSystem.getCombo() * 0.03),
        });

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
        this.popups.add(
          powerUp.position.x + powerUp.size.x / 2,
          powerUp.position.y,
          this.getPowerUpName(powerUp.type).toUpperCase(),
          'bonus'
        );
        
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

  /**
   * Stage features are resolved before the hazards, because a bounce pad can
   * carry the player clear of something they would otherwise have hit.
   */
  private applyStageFeatures(
    playerBounds: Rectangle,
    canTakeDamage: boolean
  ): void {
    for (const feature of this.stageFeatures) {
      const box = feature.getBounds();

      if (feature.kind === 'gust') {
        // Weather, not a wall: it pushes while you are inside it. Holding
        // RIGHT beats it, which is the only thing in the game that asks the
        // player to use the horizontal keys for anything.
        if (playerBounds.intersects(box)) {
          this.player.pushBy(-2.1);
        }
        continue;
      }

      if (feature.kind === 'updraft') {
        if (playerBounds.intersects(box)) {
          this.player.lift(-0.72);
          if (Math.random() < 0.25) {
            this.particles.createJumpDust(
              this.player.position.x,
              this.player.position.y + 20
            );
          }
        }
        continue;
      }

      if (feature.kind === 'bounce') {
        if (!playerBounds.intersects(box)) continue;
        // Only a descent onto the cap fires it; walking into the stalk does
        // nothing, the same rule as stomping a drone.
        const falling = this.player.velocity.y > 0;
        const above = playerBounds.bottom - 12 <= feature.getTopY();
        if (!falling || !above) continue;

        feature.compress();
        this.player.launch(-18);
        this.screenShake.shake(5, 0.14);
        this.services.audio.playSound('bounce');
        this.particles.createLandingDust(
          feature.position.x,
          feature.position.y - 10
        );
        this.popups.add(
          feature.position.x + feature.size.x / 2,
          feature.position.y - 26,
          'BOING!',
          'stomp'
        );
        continue;
      }

      // Geyser: only the erupting column hurts.
      if (!feature.isDangerous()) continue;
      if (canTakeDamage && playerBounds.intersects(box)) {
        this.takeDamage();
        return;
      }
    }
  }

  /**
   * Near misses. Everything currently dangerous is offered to the graze
   * system; anything the player skims without touching pays out.
   */
  private awardGrazes(playerBounds: Rectangle): void {
    if (this.gameState !== 'playing') return;
    // Nothing is a near miss while nothing can touch you. Paying out during
    // the invulnerability window would reward taking the hit.
    if (this.isInvulnerable || this.hasPowerUp('invincibility')) return;

    const hazards: Grazeable[] = [
      ...this.obstacles,
      ...this.flyingEnemies,
      ...this.hoverEnemies.filter(e => !e.isPopped()),
      ...this.bossProjectiles,
      ...this.groundPounds,
      ...this.stageFeatures.filter(f => f.isDangerous()),
    ];

    const result = this.grazes.check(playerBounds, hazards);
    if (result.hits.length === 0) return;

    for (const hit of result.hits) {
      const value = this.grazes.valueFor(result.streak);
      this.bonusScore += value;
      this.popups.add(
        hit.x,
        hit.y - 12,
        result.streak > 1 ? `x${result.streak} +${value}` : `+${value}`,
        'graze'
      );
      // Grazing charges the special-event meter, so precision is a second
      // route to an event alongside long coin chains.
      this.specialEventMeter = Math.min(
        this.specialEventThreshold,
        this.specialEventMeter + 1
      );
      this.particles.createImpactRing(hit.x, hit.y, 'coin');
    }

    this.services.audio.playSound('click', { volume: 0.35 });
  }

  /** A landed stomp on an open boss. */
  private hitBoss(): void {
    if (!this.boss) return;

    this.boss.takeDamage(1);
    this.player.velocity.y = -10;
    // Without a cooldown the bounce re-enters the box next frame and drains
    // the whole health bar in a handful of frames.
    this.bossHitCooldown = 0.4;

    const cx = this.boss.position.x + this.boss.size.x / 2;
    this.particles.createImpactRing(cx, this.boss.position.y, 'boss');
    this.particles.createBossHitEffect(
      cx,
      this.boss.position.y + this.boss.size.y / 2,
      this.boss.getBossType()
    );

    this.screenShake.shake(6, 0.16);
    this.hitStopTimer = 0.05;
    this.services.audio.playSound('hit');
    this.pickups += 2;
    this.bonusScore += BOSS_HIT_SCORE;
    this.popups.add(cx, this.boss.position.y - 10, `+${BOSS_HIT_SCORE}`, 'boss');
  }

  /** Pop a hover drone the player landed on: bounce, coins, feedback. */
  private stompHoverEnemy(enemy: HoverEnemy): void {
    enemy.pop();
    this.player.velocity.y = -9.5;

    const cx = enemy.position.x + enemy.size.x / 2;
    const cy = enemy.position.y + enemy.size.y / 2;
    this.particles.createImpactRing(cx, cy, 'boss');
    this.particles.createPowerUpPickup(cx, cy);
    this.screenShake.shake(5, 0.14);
    this.services.audio.playSound('explosion');

    // A stomp pays out, and feeds the combo like a coin would.
    const multiplier = this.comboSystem.addCoin();
    this.pickups += 2 * multiplier;
    this.bonusScore += STOMP_SCORE;
    this.popups.add(cx, cy - 18, `+${STOMP_SCORE}`, 'stomp');
    this.comboFlash.trigger(this.comboSystem.getCombo());
    this.enemiesStomped++;
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

  protected onGameEnd(finalScore: GameScore): void {
    // Store extended achievement data that will be picked up by getScore()
    this.extendedGameData = {
      distance: Math.floor(this.distance),
      speed: this.gameSpeed,
      jumps: this.jumps,
      combo: this.comboSystem.getMaxCombo(),
      powerupsUsed: this.powerupsUsed,
      powerupTypesUsed: this.powerupTypesUsed.size,
      bossesDefeated: this.bossesDefeated,
      enemiesStomped: this.enemiesStomped,
      nearMisses: this.grazes.getTotal()
    };

    // Track analytics for game-specific achievements
    this.services.analytics.trackGameSpecificStat(this.manifest.id, 'distance', Math.floor(this.distance));
    this.services.analytics.trackGameSpecificStat(this.manifest.id, 'max_speed', this.gameSpeed);
    this.services.analytics.trackGameSpecificStat(this.manifest.id, 'jumps', this.jumps);
    this.services.analytics.trackGameSpecificStat(this.manifest.id, 'max_combo', this.comboSystem.getMaxCombo());
    this.services.analytics.trackGameSpecificStat(this.manifest.id, 'powerups_total', this.powerupsUsed);
    this.services.analytics.trackGameSpecificStat(this.manifest.id, 'powerup_types', this.powerupTypesUsed.size);
    this.services.analytics.trackGameSpecificStat(this.manifest.id, 'bosses_defeated', this.bossesDefeated);
    this.services.analytics.trackGameSpecificStat(this.manifest.id, 'enemies_stomped', this.enemiesStomped);
    this.services.analytics.trackGameSpecificStat(this.manifest.id, 'near_misses', this.grazes.getTotal());

    // Call parent which will handle the final scoring and Hub callback
    super.onGameEnd?.(finalScore);
  }

  protected onDestroy(): void {
    // The hub stops music when it tears a game down, but a game that started
    // its own track should not rely on that to end it.
    this.services?.audio?.stopMusic?.(0.3);
    this.currentTrack = null;
  }

  protected onRestart(): void {
    this.obstacles = [];
    this.coins = [];
    this.powerUps = [];
    this.flyingEnemies = [];
    this.hoverEnemies = [];
    this.boss = null;
    this.bossProjectiles = [];
    this.groundPounds = [];
    this.stageFeatures = [];
    this.activePowerUps = [];
    this.particles = new ParticleSystem();
    this.screenShake = new ScreenShake();
    this.comboSystem?.resetAll?.();
    this.comboFlash = new ComboFlash();
    this.environmentSystem = new EnvironmentSystem();
    this.playerAura = new PlayerAura();
    this.comboSystem.setOnResetCallback(() => this.comboFlash.resetMilestones());
    this.gameSpeed = 1;
    this.distance = 0;
    this.bonusScore = 0;
    this.cleanDistance = 0;
    this.cleanAwards = 0;
    this.hintedFeatures.clear();
    this.hintKind = null;
    this.hintTimer = 0;
    this.groundScroll = 0;
    this.popups.clear();
    this.grazes.reset();
    this.themeLevel = 0;
    this.bossDefeatedForTheme = false;
    this.themeProgress = 0;
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
    this.hitStopTimer = 0;
    this.hurtFlashTimer = 0;
    this.bossHitCooldown = 0;
    this.currentTrack = null;
    this.maxSpeedReached = 1;
    this.stageBannerTimer = 0;
    this.resetTutorialProgress();
    this.director.reset();
    this.jumps = 0;
    this.enemiesStomped = 0;
    this.powerupsUsed = 0;
    this.powerupTypesUsed.clear();
    this.player = new Player(100, this.groundY - 32, this.groundY, this.canvas.width);
    this.parallaxSystem.reset();
    this.camera.reset();
  }
}
