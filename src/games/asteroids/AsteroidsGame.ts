// ===== src/games/asteroids/AsteroidsGame.ts =====
import { BaseGame } from '@/games/shared/BaseGame';
import { GameManifest } from '@/lib/types';

// ============================================
// TYPES & INTERFACES
// ============================================

interface Vector2 {
  x: number;
  y: number;
}

interface Ship {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  thrusting: boolean;
  invincible: boolean;
  invincibleTimer: number;
  shieldActive: boolean;
  shieldTimer: number;
}

interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  lifetime: number;
  piercing: boolean;
}

interface Asteroid {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: 'large' | 'medium' | 'small';
  radius: number;
  rotation: number;
  rotationSpeed: number;
  vertices: Vector2[];
  health: number;
}

interface UFO {
  x: number;
  y: number;
  vx: number;
  vy: number;
  type: 'large' | 'small';
  radius: number;
  shootTimer: number;
  health: number;
  directionTimer: number;
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
}

interface PowerUp {
  x: number;
  y: number;
  type: 'rapidFire' | 'spread' | 'shield' | 'extraLife' | 'bomb';
  lifetime: number;
  pulsePhase: number;
}

interface Debris {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  rotationSpeed: number;
  lifetime: number;
  size: number;
  color: string;
}

// ============================================
// CONSTANTS
// ============================================

const SHIP_SIZE = 20;
const SHIP_THRUST = 300;
const SHIP_ROTATION_SPEED = 4.5;
const SHIP_DRAG = 0.99;
const SHIP_MAX_SPEED = 400;
const INVINCIBILITY_DURATION = 3;

const BULLET_SPEED = 500;
const BULLET_LIFETIME = 1.5;
const FIRE_RATE = 0.15;
const RAPID_FIRE_RATE = 0.06;
const RAPID_FIRE_DURATION = 8;
const SPREAD_SHOT_DURATION = 10;

const ASTEROID_SPEEDS = { large: 60, medium: 100, small: 150 };
const ASTEROID_RADII = { large: 45, medium: 25, small: 12 };
const ASTEROID_SCORES = { large: 20, medium: 50, small: 100 };
const ASTEROID_HEALTH = { large: 3, medium: 2, small: 1 };

const UFO_LARGE_RADIUS = 25;
const UFO_SMALL_RADIUS = 15;
const UFO_LARGE_SPEED = 80;
const UFO_SMALL_SPEED = 120;
const UFO_SPAWN_CHANCE = 0.002;
const UFO_SHOOT_INTERVAL_LARGE = 2.5;
const UFO_SHOOT_INTERVAL_SMALL = 1.5;
const UFO_LARGE_SCORE = 200;
const UFO_SMALL_SCORE = 1000;

const POWERUP_SPAWN_CHANCE = 0.15;
const POWERUP_LIFETIME = 12;
const SHIELD_DURATION = 8;

const STARTING_LIVES = 3;
const EXTRA_LIFE_SCORE = 10000;

// Colors (Neon Retro Theme)
const COLORS = {
  ship: '#00ffff',
  shipThrust: '#ff6600',
  bullet: '#ffff00',
  asteroid: '#00ff88',
  asteroidOutline: '#00ffaa',
  ufoLarge: '#ff00ff',
  ufoSmall: '#ff4466',
  shield: '#00ccff',
  explosion: ['#ff6600', '#ffaa00', '#ffff00', '#ff4400'],
  powerUp: {
    rapidFire: '#ffff00',
    spread: '#ff00ff',
    shield: '#00ccff',
    extraLife: '#00ff00',
    bomb: '#ff4400',
  },
  text: '#ffffff',
  hud: '#00ffff',
  background: '#0a0a1a',
};

// ============================================
// ASTEROIDS GAME CLASS
// ============================================

export class AsteroidsGame extends BaseGame {
  manifest: GameManifest = {
    id: 'asteroids',
    title: 'Asteroids',
    thumbnail: '/games/asteroids/asteroids-thumb.svg',
    inputSchema: ['keyboard'],
    assetBudgetKB: 120,
    tier: 2,
    description: 'Blast space rocks in this retro shooter!',
  };

  // Game state
  private ship!: Ship;
  private bullets: Bullet[] = [];
  private asteroids: Asteroid[] = [];
  private ufos: UFO[] = [];
  private particles: Particle[] = [];
  private powerUps: PowerUp[] = [];
  private debris: Debris[] = [];
  private ufoBullets: Bullet[] = [];

  // Scoring & progression
  private lives = STARTING_LIVES;
  private wave = 1;
  private combo = 0;
  private maxCombo = 0;
  private comboTimer = 0;
  private totalKills = 0;
  private nextExtraLife = EXTRA_LIFE_SCORE;

  // Weapon state
  private fireTimer = 0;
  private rapidFireActive = false;
  private rapidFireTimer = 0;
  private spreadShotActive = false;
  private spreadShotTimer = 0;

  // Screen shake
  private screenShake = 0;
  private shakeIntensity = 0;

  // Stars background
  private stars: { x: number; y: number; size: number; brightness: number }[] = [];

  // Wave transition
  private waveTransition = false;
  private waveTransitionTimer = 0;

  // Game over
  private gameOver = false;
  private gameOverTimer = 0;

  // Input state (for thrust visual)
  private keys = {
    up: false,
    down: false,
    left: false,
    right: false,
    space: false,
  };

  // ============================================
  // BASEGAME LIFECYCLE HOOKS
  // ============================================

  protected onInit(): void {
    // Disable base HUD - we render our own
    this.renderBaseHud = false;
    
    this.resetGameState();
    this.generateStars();
    this.spawnWaveAsteroids();
  }

  protected onRestart(): void {
    this.resetGameState();
    this.generateStars();
    this.spawnWaveAsteroids();
  }

  private resetGameState(): void {
    // Reset inherited state
    this.score = 0;
    this.pickups = 0;

    // Reset game-specific state
    this.lives = STARTING_LIVES;
    this.wave = 1;
    this.combo = 0;
    this.maxCombo = 0;
    this.totalKills = 0;
    this.nextExtraLife = EXTRA_LIFE_SCORE;
    this.gameOver = false;
    this.gameOverTimer = 0;
    this.waveTransition = false;

    // Initialize ship at center
    this.ship = {
      x: this.canvas.width / 2,
      y: this.canvas.height / 2,
      vx: 0,
      vy: 0,
      rotation: -Math.PI / 2,
      thrusting: false,
      invincible: true,
      invincibleTimer: INVINCIBILITY_DURATION,
      shieldActive: false,
      shieldTimer: 0,
    };

    // Clear arrays
    this.bullets = [];
    this.asteroids = [];
    this.ufos = [];
    this.particles = [];
    this.powerUps = [];
    this.debris = [];
    this.ufoBullets = [];

    // Reset weapon state
    this.fireTimer = 0;
    this.rapidFireActive = false;
    this.rapidFireTimer = 0;
    this.spreadShotActive = false;
    this.spreadShotTimer = 0;
  }

  private generateStars(): void {
    this.stars = [];
    for (let i = 0; i < 150; i++) {
      this.stars.push({
        x: Math.random() * this.canvas.width,
        y: Math.random() * this.canvas.height,
        size: Math.random() * 2 + 0.5,
        brightness: Math.random() * 0.5 + 0.3,
      });
    }
  }

  protected onUpdate(dt: number): void {
    if (this.gameOver) {
      this.gameOverTimer += dt;
      this.updateParticles(dt);
      this.updateDebris(dt);
      
      // After showing game over screen, when player presses space, call endGame
      if (this.gameOverTimer > 1 && this.services.input.isKeyPressed('Space')) {
        // Now actually end the game and let platform take over
        this.endGame();
      }
      return;
    }

    // Wave transition
    if (this.waveTransition) {
      this.waveTransitionTimer -= dt;
      if (this.waveTransitionTimer <= 0) {
        this.waveTransition = false;
        this.wave++;
        this.spawnWaveAsteroids();
      }
      this.updateParticles(dt);
      this.updateDebris(dt);
      return;
    }

    this.handleInput(dt);
    this.updateShip(dt);
    this.updateBullets(dt);
    this.updateAsteroids(dt);
    this.updateUFOs(dt);
    this.updateUFOBullets(dt);
    this.updateParticles(dt);
    this.updatePowerUps(dt);
    this.updateDebris(dt);
    this.updateWeaponTimers(dt);
    this.updateCombo(dt);
    this.updateScreenShake(dt);

    this.checkCollisions();
    this.checkWaveComplete();
    this.trySpawnUFO();

    // Update extended data for achievements
    this.extendedGameData = {
      maxCombo: this.maxCombo,
      totalKills: this.totalKills,
      wave: this.wave,
      lives: this.lives,
    };
  }

  protected onRender(ctx: CanvasRenderingContext2D): void {
    // Apply screen shake
    ctx.save();
    if (this.screenShake > 0) {
      const shakeX = (Math.random() - 0.5) * this.shakeIntensity;
      const shakeY = (Math.random() - 0.5) * this.shakeIntensity;
      ctx.translate(shakeX, shakeY);
    }

    // Background
    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Stars
    this.renderStars(ctx);

    // Game objects
    this.renderDebris(ctx);
    this.renderParticles(ctx);
    this.renderPowerUps(ctx);
    this.renderAsteroids(ctx);
    this.renderUFOs(ctx);
    this.renderBullets(ctx);
    this.renderUFOBullets(ctx);

    if (!this.gameOver) {
      this.renderShip(ctx);
    }

    ctx.restore();

    // Wave transition overlay
    if (this.waveTransition) {
      this.renderWaveTransition(ctx);
    }

    // Game over overlay
    if (this.gameOver) {
      this.renderGameOver(ctx);
    }
  }

  protected onRenderUI(ctx: CanvasRenderingContext2D): void {
    // Custom HUD
    ctx.fillStyle = COLORS.hud;
    ctx.font = 'bold 20px monospace';

    // Score
    ctx.textAlign = 'left';
    ctx.fillText(`SCORE: ${this.score.toLocaleString()}`, 20, 35);

    // Wave
    ctx.fillText(`WAVE: ${this.wave}`, 20, 60);

    // Combo
    if (this.combo > 1) {
      ctx.fillStyle = '#ffff00';
      ctx.fillText(`COMBO x${this.combo}`, 20, 85);
    }

    // Lives
    ctx.fillStyle = COLORS.ship;
    ctx.textAlign = 'right';
    for (let i = 0; i < this.lives; i++) {
      this.renderMiniShip(ctx, this.canvas.width - 30 - i * 25, 35);
    }

    // Active power-ups
    let powerUpY = 65;
    ctx.font = '14px monospace';
    ctx.textAlign = 'right';

    if (this.rapidFireActive) {
      ctx.fillStyle = COLORS.powerUp.rapidFire;
      ctx.fillText(`RAPID: ${this.rapidFireTimer.toFixed(1)}s`, this.canvas.width - 20, powerUpY);
      powerUpY += 20;
    }

    if (this.spreadShotActive) {
      ctx.fillStyle = COLORS.powerUp.spread;
      ctx.fillText(`SPREAD: ${this.spreadShotTimer.toFixed(1)}s`, this.canvas.width - 20, powerUpY);
      powerUpY += 20;
    }

    if (this.ship.shieldActive) {
      ctx.fillStyle = COLORS.powerUp.shield;
      ctx.fillText(`SHIELD: ${this.ship.shieldTimer.toFixed(1)}s`, this.canvas.width - 20, powerUpY);
    }
  }

  // isGameOver() is inherited from BaseGame - returns !this.isRunning
  // endGame() sets isRunning = false, so isGameOver() becomes true after player presses SPACE

  // ============================================
  // INPUT HANDLING
  // ============================================

  private handleInput(dt: number): void {
    const input = this.services?.input;
    if (!input) return;

    // Update key states using isKeyPressed (the correct method from InputManager)
    this.keys.up = input.isKeyPressed('ArrowUp') || input.isKeyPressed('KeyW');
    this.keys.left = input.isKeyPressed('ArrowLeft') || input.isKeyPressed('KeyA');
    this.keys.right = input.isKeyPressed('ArrowRight') || input.isKeyPressed('KeyD');
    this.keys.space = input.isKeyPressed('Space');

    // Rotation
    if (this.keys.left) {
      this.ship.rotation -= SHIP_ROTATION_SPEED * dt;
    }
    if (this.keys.right) {
      this.ship.rotation += SHIP_ROTATION_SPEED * dt;
    }

    // Thrust
    this.ship.thrusting = this.keys.up;
    if (this.ship.thrusting) {
      const thrustX = Math.cos(this.ship.rotation) * SHIP_THRUST * dt;
      const thrustY = Math.sin(this.ship.rotation) * SHIP_THRUST * dt;
      this.ship.vx += thrustX;
      this.ship.vy += thrustY;

      // Spawn thrust particles
      this.spawnThrustParticles();
    }

    // Fire
    if (this.keys.space && this.fireTimer <= 0) {
      this.fireBullet();
      const rate = this.rapidFireActive ? RAPID_FIRE_RATE : FIRE_RATE;
      this.fireTimer = rate;
    }
  }

  // ============================================
  // UPDATE METHODS
  // ============================================

  private updateShip(dt: number): void {
    // Apply drag
    this.ship.vx *= SHIP_DRAG;
    this.ship.vy *= SHIP_DRAG;

    // Clamp speed
    const speed = Math.sqrt(this.ship.vx ** 2 + this.ship.vy ** 2);
    if (speed > SHIP_MAX_SPEED) {
      const scale = SHIP_MAX_SPEED / speed;
      this.ship.vx *= scale;
      this.ship.vy *= scale;
    }

    // Update position
    this.ship.x += this.ship.vx * dt;
    this.ship.y += this.ship.vy * dt;

    // Wraparound
    this.wrapPosition(this.ship);

    // Update invincibility
    if (this.ship.invincible) {
      this.ship.invincibleTimer -= dt;
      if (this.ship.invincibleTimer <= 0) {
        this.ship.invincible = false;
      }
    }

    // Update shield
    if (this.ship.shieldActive) {
      this.ship.shieldTimer -= dt;
      if (this.ship.shieldTimer <= 0) {
        this.ship.shieldActive = false;
      }
    }
  }

  private updateBullets(dt: number): void {
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const bullet = this.bullets[i];
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
      bullet.lifetime -= dt;

      this.wrapPosition(bullet);

      if (bullet.lifetime <= 0) {
        this.bullets.splice(i, 1);
      }
    }
  }

  private updateAsteroids(dt: number): void {
    for (const asteroid of this.asteroids) {
      asteroid.x += asteroid.vx * dt;
      asteroid.y += asteroid.vy * dt;
      asteroid.rotation += asteroid.rotationSpeed * dt;

      this.wrapPosition(asteroid);
    }
  }

  private updateUFOs(dt: number): void {
    for (let i = this.ufos.length - 1; i >= 0; i--) {
      const ufo = this.ufos[i];
      ufo.x += ufo.vx * dt;
      ufo.y += ufo.vy * dt;

      // Change direction periodically
      ufo.directionTimer -= dt;
      if (ufo.directionTimer <= 0) {
        ufo.directionTimer = 2 + Math.random() * 2;
        ufo.vy = (Math.random() - 0.5) * (ufo.type === 'large' ? UFO_LARGE_SPEED : UFO_SMALL_SPEED);
      }

      // Shoot at player
      ufo.shootTimer -= dt;
      if (ufo.shootTimer <= 0) {
        this.ufoShoot(ufo);
        ufo.shootTimer =
          ufo.type === 'large' ? UFO_SHOOT_INTERVAL_LARGE : UFO_SHOOT_INTERVAL_SMALL;
      }

      // Remove if off screen
      if (ufo.x < -50 || ufo.x > this.canvas.width + 50) {
        this.ufos.splice(i, 1);
      }
    }
  }

  private updateUFOBullets(dt: number): void {
    for (let i = this.ufoBullets.length - 1; i >= 0; i--) {
      const bullet = this.ufoBullets[i];
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
      bullet.lifetime -= dt;

      if (
        bullet.lifetime <= 0 ||
        bullet.x < -10 ||
        bullet.x > this.canvas.width + 10 ||
        bullet.y < -10 ||
        bullet.y > this.canvas.height + 10
      ) {
        this.ufoBullets.splice(i, 1);
      }
    }
  }

  private updateParticles(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.lifetime -= dt;
      p.vx *= 0.98;
      p.vy *= 0.98;

      if (p.lifetime <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  private updatePowerUps(dt: number): void {
    for (let i = this.powerUps.length - 1; i >= 0; i--) {
      const pu = this.powerUps[i];
      pu.lifetime -= dt;
      pu.pulsePhase += dt * 4;

      if (pu.lifetime <= 0) {
        this.powerUps.splice(i, 1);
      }
    }
  }

  private updateDebris(dt: number): void {
    for (let i = this.debris.length - 1; i >= 0; i--) {
      const d = this.debris[i];
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.rotation += d.rotationSpeed * dt;
      d.lifetime -= dt;
      d.vx *= 0.99;
      d.vy *= 0.99;

      if (d.lifetime <= 0) {
        this.debris.splice(i, 1);
      }
    }
  }

  private updateWeaponTimers(dt: number): void {
    if (this.fireTimer > 0) {
      this.fireTimer -= dt;
    }

    if (this.rapidFireActive) {
      this.rapidFireTimer -= dt;
      if (this.rapidFireTimer <= 0) {
        this.rapidFireActive = false;
      }
    }

    if (this.spreadShotActive) {
      this.spreadShotTimer -= dt;
      if (this.spreadShotTimer <= 0) {
        this.spreadShotActive = false;
      }
    }
  }

  private updateCombo(dt: number): void {
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.combo = 0;
      }
    }
  }

  private updateScreenShake(dt: number): void {
    if (this.screenShake > 0) {
      this.screenShake -= dt;
      if (this.screenShake <= 0) {
        this.shakeIntensity = 0;
      }
    }
  }

  // ============================================
  // COLLISION DETECTION
  // ============================================

  private checkCollisions(): void {
    // Bullets vs Asteroids
    for (let bi = this.bullets.length - 1; bi >= 0; bi--) {
      const bullet = this.bullets[bi];
      for (let ai = this.asteroids.length - 1; ai >= 0; ai--) {
        const asteroid = this.asteroids[ai];
        if (this.circleCollision(bullet.x, bullet.y, 3, asteroid.x, asteroid.y, asteroid.radius)) {
          asteroid.health--;
          if (asteroid.health <= 0) {
            this.destroyAsteroid(ai);
          } else {
            this.spawnHitParticles(bullet.x, bullet.y);
          }
          if (!bullet.piercing) {
            this.bullets.splice(bi, 1);
          }
          break;
        }
      }
    }

    // Bullets vs UFOs
    for (let bi = this.bullets.length - 1; bi >= 0; bi--) {
      const bullet = this.bullets[bi];
      for (let ui = this.ufos.length - 1; ui >= 0; ui--) {
        const ufo = this.ufos[ui];
        if (this.circleCollision(bullet.x, bullet.y, 3, ufo.x, ufo.y, ufo.radius)) {
          ufo.health--;
          if (ufo.health <= 0) {
            this.destroyUFO(ui);
          } else {
            this.spawnHitParticles(bullet.x, bullet.y);
          }
          this.bullets.splice(bi, 1);
          break;
        }
      }
    }

    // Ship vs Asteroids
    if (!this.ship.invincible && !this.ship.shieldActive) {
      for (const asteroid of this.asteroids) {
        if (this.circleCollision(this.ship.x, this.ship.y, SHIP_SIZE * 0.5, asteroid.x, asteroid.y, asteroid.radius)) {
          this.shipHit();
          break;
        }
      }
    }

    // Ship vs UFOs
    if (!this.ship.invincible && !this.ship.shieldActive) {
      for (const ufo of this.ufos) {
        if (this.circleCollision(this.ship.x, this.ship.y, SHIP_SIZE * 0.5, ufo.x, ufo.y, ufo.radius)) {
          this.shipHit();
          break;
        }
      }
    }

    // Ship vs UFO Bullets
    if (!this.ship.invincible && !this.ship.shieldActive) {
      for (let i = this.ufoBullets.length - 1; i >= 0; i--) {
        const bullet = this.ufoBullets[i];
        if (this.circleCollision(this.ship.x, this.ship.y, SHIP_SIZE * 0.5, bullet.x, bullet.y, 4)) {
          this.ufoBullets.splice(i, 1);
          this.shipHit();
          break;
        }
      }
    }

    // Ship vs PowerUps
    for (let i = this.powerUps.length - 1; i >= 0; i--) {
      const pu = this.powerUps[i];
      if (this.circleCollision(this.ship.x, this.ship.y, SHIP_SIZE, pu.x, pu.y, 15)) {
        this.collectPowerUp(pu);
        this.powerUps.splice(i, 1);
      }
    }
  }

  private circleCollision(
    x1: number,
    y1: number,
    r1: number,
    x2: number,
    y2: number,
    r2: number
  ): boolean {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const dist = Math.sqrt(dx * dx + dy * dy);
    return dist < r1 + r2;
  }

  // ============================================
  // GAME ACTIONS
  // ============================================

  private fireBullet(): void {
    this.services?.audio?.playSound?.('shoot');

    const noseX = this.ship.x + Math.cos(this.ship.rotation) * SHIP_SIZE;
    const noseY = this.ship.y + Math.sin(this.ship.rotation) * SHIP_SIZE;

    if (this.spreadShotActive) {
      // Spread shot - 5 bullets in a fan
      const angles = [-0.3, -0.15, 0, 0.15, 0.3];
      for (const offset of angles) {
        const angle = this.ship.rotation + offset;
        this.bullets.push({
          x: noseX,
          y: noseY,
          vx: Math.cos(angle) * BULLET_SPEED + this.ship.vx * 0.5,
          vy: Math.sin(angle) * BULLET_SPEED + this.ship.vy * 0.5,
          lifetime: BULLET_LIFETIME,
          piercing: false,
        });
      }
    } else {
      this.bullets.push({
        x: noseX,
        y: noseY,
        vx: Math.cos(this.ship.rotation) * BULLET_SPEED + this.ship.vx * 0.5,
        vy: Math.sin(this.ship.rotation) * BULLET_SPEED + this.ship.vy * 0.5,
        lifetime: BULLET_LIFETIME,
        piercing: false,
      });
    }
  }

  private ufoShoot(ufo: UFO): void {
    this.services?.audio?.playSound?.('enemyShoot');

    let angle: number;
    if (ufo.type === 'small') {
      // Small UFO aims at player
      angle = Math.atan2(this.ship.y - ufo.y, this.ship.x - ufo.x);
      // Add slight randomness
      angle += (Math.random() - 0.5) * 0.2;
    } else {
      // Large UFO shoots randomly
      angle = Math.random() * Math.PI * 2;
    }

    this.ufoBullets.push({
      x: ufo.x,
      y: ufo.y,
      vx: Math.cos(angle) * 300,
      vy: Math.sin(angle) * 300,
      lifetime: 2,
      piercing: false,
    });
  }

  private destroyAsteroid(index: number): void {
    const asteroid = this.asteroids[index];
    const points = ASTEROID_SCORES[asteroid.size];

    // Combo system
    this.combo++;
    this.comboTimer = 2;
    if (this.combo > this.maxCombo) {
      this.maxCombo = this.combo;
    }

    const comboMultiplier = Math.min(1 + this.combo * 0.1, 3);
    this.score += Math.floor(points * comboMultiplier);
    this.totalKills++;
    this.pickups++;

    // Check for extra life
    if (this.score >= this.nextExtraLife) {
      this.lives++;
      this.nextExtraLife += EXTRA_LIFE_SCORE;
      this.services?.audio?.playSound?.('extraLife');
    }

    // Spawn explosion
    this.spawnExplosion(asteroid.x, asteroid.y, asteroid.radius);
    this.spawnDebris(asteroid.x, asteroid.y, asteroid.size);

    // Screen shake
    this.screenShake = 0.1;
    this.shakeIntensity = asteroid.size === 'large' ? 8 : asteroid.size === 'medium' ? 5 : 2;

    // Play sound
    this.services?.audio?.playSound?.('explosion');

    // Split asteroid
    if (asteroid.size !== 'small') {
      const newSize = asteroid.size === 'large' ? 'medium' : 'small';
      const count = 2;

      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = ASTEROID_SPEEDS[newSize] * (0.8 + Math.random() * 0.4);
        this.asteroids.push(this.createAsteroid(
          asteroid.x + (Math.random() - 0.5) * 20,
          asteroid.y + (Math.random() - 0.5) * 20,
          newSize,
          Math.cos(angle) * speed,
          Math.sin(angle) * speed
        ));
      }
    }

    // Chance to spawn power-up
    if (Math.random() < POWERUP_SPAWN_CHANCE) {
      this.spawnPowerUp(asteroid.x, asteroid.y);
    }

    this.asteroids.splice(index, 1);
  }

  private destroyUFO(index: number): void {
    const ufo = this.ufos[index];
    const points = ufo.type === 'large' ? UFO_LARGE_SCORE : UFO_SMALL_SCORE;

    this.combo++;
    this.comboTimer = 2;
    if (this.combo > this.maxCombo) {
      this.maxCombo = this.combo;
    }

    const comboMultiplier = Math.min(1 + this.combo * 0.1, 3);
    this.score += Math.floor(points * comboMultiplier);
    this.totalKills++;
    this.pickups += ufo.type === 'small' ? 5 : 2;

    this.spawnExplosion(ufo.x, ufo.y, ufo.radius * 2);
    this.screenShake = 0.2;
    this.shakeIntensity = 10;

    this.services?.audio?.playSound?.('explosion');

    // UFOs drop power-ups more often
    if (Math.random() < 0.4) {
      this.spawnPowerUp(ufo.x, ufo.y);
    }

    this.ufos.splice(index, 1);
  }

  private shipHit(): void {
    this.lives--;
    this.combo = 0;

    this.spawnExplosion(this.ship.x, this.ship.y, SHIP_SIZE * 2);
    this.screenShake = 0.3;
    this.shakeIntensity = 15;

    this.services?.audio?.playSound?.('playerHit');

    if (this.lives <= 0) {
      this.triggerGameOver();
    } else {
      // Respawn
      this.ship.x = this.canvas.width / 2;
      this.ship.y = this.canvas.height / 2;
      this.ship.vx = 0;
      this.ship.vy = 0;
      this.ship.invincible = true;
      this.ship.invincibleTimer = INVINCIBILITY_DURATION;
    }
  }

  private collectPowerUp(powerUp: PowerUp): void {
    this.services?.audio?.playSound?.('powerUp');
    this.pickups++;

    switch (powerUp.type) {
      case 'rapidFire':
        this.rapidFireActive = true;
        this.rapidFireTimer = RAPID_FIRE_DURATION;
        break;
      case 'spread':
        this.spreadShotActive = true;
        this.spreadShotTimer = SPREAD_SHOT_DURATION;
        break;
      case 'shield':
        this.ship.shieldActive = true;
        this.ship.shieldTimer = SHIELD_DURATION;
        break;
      case 'extraLife':
        this.lives++;
        break;
      case 'bomb':
        this.triggerBomb();
        break;
    }

    // Spawn collect effect
    for (let i = 0; i < 20; i++) {
      const angle = (i / 20) * Math.PI * 2;
      this.particles.push({
        x: powerUp.x,
        y: powerUp.y,
        vx: Math.cos(angle) * 100,
        vy: Math.sin(angle) * 100,
        lifetime: 0.5,
        maxLifetime: 0.5,
        color: COLORS.powerUp[powerUp.type],
        size: 4,
      });
    }
  }

  private triggerBomb(): void {
    this.services?.audio?.playSound?.('bomb');
    this.screenShake = 0.5;
    this.shakeIntensity = 20;

    // Destroy all asteroids on screen
    for (let i = this.asteroids.length - 1; i >= 0; i--) {
      const asteroid = this.asteroids[i];
      this.spawnExplosion(asteroid.x, asteroid.y, asteroid.radius);
      this.score += ASTEROID_SCORES[asteroid.size];
      this.totalKills++;
    }
    this.asteroids = [];

    // Destroy all UFOs
    for (const ufo of this.ufos) {
      this.spawnExplosion(ufo.x, ufo.y, ufo.radius * 2);
      this.score += ufo.type === 'large' ? UFO_LARGE_SCORE : UFO_SMALL_SCORE;
      this.totalKills++;
    }
    this.ufos = [];
    this.ufoBullets = [];

    // Ring effect
    for (let i = 0; i < 60; i++) {
      const angle = (i / 60) * Math.PI * 2;
      this.particles.push({
        x: this.ship.x,
        y: this.ship.y,
        vx: Math.cos(angle) * 400,
        vy: Math.sin(angle) * 400,
        lifetime: 1,
        maxLifetime: 1,
        color: '#ff4400',
        size: 6,
      });
    }
  }

  private triggerGameOver(): void {
    this.gameOver = true;
    this.gameOverTimer = 0;

    // Update extended data before ending
    this.extendedGameData = {
      maxCombo: this.maxCombo,
      totalKills: this.totalKills,
      wave: this.wave,
      lives: this.lives,
    };

    // Play game over sound
    this.services?.audio?.playSound?.('game_over');

    // NOTE: Don't call endGame() here - we want to show our game over screen first
    // endGame() will be called when player presses SPACE (handled in onUpdate)
  }

  // ============================================
  // SPAWNING
  // ============================================

  private spawnWaveAsteroids(): void {
    const count = 3 + this.wave;
    const healthBonus = Math.floor((this.wave - 1) / 2);

    for (let i = 0; i < count; i++) {
      // Spawn from edges, away from player
      let x: number, y: number;
      const edge = Math.floor(Math.random() * 4);
      switch (edge) {
        case 0:
          x = 0;
          y = Math.random() * this.canvas.height;
          break;
        case 1:
          x = this.canvas.width;
          y = Math.random() * this.canvas.height;
          break;
        case 2:
          x = Math.random() * this.canvas.width;
          y = 0;
          break;
        default:
          x = Math.random() * this.canvas.width;
          y = this.canvas.height;
      }

      const angle = Math.atan2(
        this.canvas.height / 2 - y + (Math.random() - 0.5) * 200,
        this.canvas.width / 2 - x + (Math.random() - 0.5) * 200
      );
      const speed = ASTEROID_SPEEDS.large * (0.8 + Math.random() * 0.4 + this.wave * 0.05);

      const asteroid = this.createAsteroid(
        x,
        y,
        'large',
        Math.cos(angle) * speed,
        Math.sin(angle) * speed
      );
      asteroid.health += healthBonus;
      this.asteroids.push(asteroid);
    }
  }

  private createAsteroid(
    x: number,
    y: number,
    size: 'large' | 'medium' | 'small',
    vx?: number,
    vy?: number
  ): Asteroid {
    const radius = ASTEROID_RADII[size];
    const speed = ASTEROID_SPEEDS[size];

    // Generate irregular polygon vertices
    const vertexCount = size === 'large' ? 12 : size === 'medium' ? 10 : 8;
    const vertices: Vector2[] = [];
    for (let i = 0; i < vertexCount; i++) {
      const angle = (i / vertexCount) * Math.PI * 2;
      const variance = 0.6 + Math.random() * 0.4;
      vertices.push({
        x: Math.cos(angle) * radius * variance,
        y: Math.sin(angle) * radius * variance,
      });
    }

    return {
      x,
      y,
      vx: vx ?? (Math.random() - 0.5) * speed * 2,
      vy: vy ?? (Math.random() - 0.5) * speed * 2,
      size,
      radius,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 2,
      vertices,
      health: ASTEROID_HEALTH[size],
    };
  }

  private trySpawnUFO(): void {
    if (this.ufos.length >= 2) return;
    if (Math.random() > UFO_SPAWN_CHANCE * (1 + this.wave * 0.1)) return;

    const isSmall = this.wave > 2 && Math.random() < 0.3;
    const type = isSmall ? 'small' : 'large';
    const fromLeft = Math.random() < 0.5;

    this.ufos.push({
      x: fromLeft ? -30 : this.canvas.width + 30,
      y: Math.random() * (this.canvas.height - 100) + 50,
      vx: (fromLeft ? 1 : -1) * (type === 'large' ? UFO_LARGE_SPEED : UFO_SMALL_SPEED),
      vy: 0,
      type,
      radius: type === 'large' ? UFO_LARGE_RADIUS : UFO_SMALL_RADIUS,
      shootTimer: 1,
      health: type === 'large' ? 3 : 2,
      directionTimer: 2,
    });

    this.services?.audio?.playSound?.('ufoSpawn');
  }

  private spawnPowerUp(x: number, y: number): void {
    const types: PowerUp['type'][] = ['rapidFire', 'spread', 'shield', 'extraLife', 'bomb'];
    const weights = [0.3, 0.25, 0.25, 0.1, 0.1];

    let random = Math.random();
    let type: PowerUp['type'] = 'rapidFire';
    for (let i = 0; i < types.length; i++) {
      if (random < weights[i]) {
        type = types[i];
        break;
      }
      random -= weights[i];
    }

    this.powerUps.push({
      x,
      y,
      type,
      lifetime: POWERUP_LIFETIME,
      pulsePhase: 0,
    });
  }

  // ============================================
  // PARTICLE EFFECTS
  // ============================================

  private spawnThrustParticles(): void {
    const angle = this.ship.rotation + Math.PI;
    const baseX = this.ship.x + Math.cos(angle) * SHIP_SIZE * 0.8;
    const baseY = this.ship.y + Math.sin(angle) * SHIP_SIZE * 0.8;

    for (let i = 0; i < 2; i++) {
      const spread = (Math.random() - 0.5) * 0.5;
      this.particles.push({
        x: baseX,
        y: baseY,
        vx: Math.cos(angle + spread) * (150 + Math.random() * 50) + this.ship.vx * 0.3,
        vy: Math.sin(angle + spread) * (150 + Math.random() * 50) + this.ship.vy * 0.3,
        lifetime: 0.3 + Math.random() * 0.2,
        maxLifetime: 0.5,
        color: COLORS.shipThrust,
        size: 3 + Math.random() * 3,
      });
    }
  }

  private spawnExplosion(x: number, y: number, radius: number): void {
    const particleCount = Math.floor(radius * 1.5);
    for (let i = 0; i < particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 50 + Math.random() * 150;
      this.particles.push({
        x: x + (Math.random() - 0.5) * radius * 0.5,
        y: y + (Math.random() - 0.5) * radius * 0.5,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        lifetime: 0.5 + Math.random() * 0.5,
        maxLifetime: 1,
        color: COLORS.explosion[Math.floor(Math.random() * COLORS.explosion.length)],
        size: 2 + Math.random() * 4,
      });
    }
  }

  private spawnHitParticles(x: number, y: number): void {
    for (let i = 0; i < 8; i++) {
      const angle = Math.random() * Math.PI * 2;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * 80,
        vy: Math.sin(angle) * 80,
        lifetime: 0.3,
        maxLifetime: 0.3,
        color: '#00ff88',
        size: 2,
      });
    }
  }

  private spawnDebris(x: number, y: number, size: 'large' | 'medium' | 'small'): void {
    const count = size === 'large' ? 8 : size === 'medium' ? 5 : 3;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 30 + Math.random() * 80;
      this.debris.push({
        x: x + (Math.random() - 0.5) * 20,
        y: y + (Math.random() - 0.5) * 20,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 8,
        lifetime: 1 + Math.random() * 1,
        size: 3 + Math.random() * 6,
        color: COLORS.asteroid,
      });
    }
  }

  // ============================================
  // UTILITY
  // ============================================

  private wrapPosition(obj: { x: number; y: number }): void {
    const margin = 20;
    if (obj.x < -margin) obj.x = this.canvas.width + margin;
    if (obj.x > this.canvas.width + margin) obj.x = -margin;
    if (obj.y < -margin) obj.y = this.canvas.height + margin;
    if (obj.y > this.canvas.height + margin) obj.y = -margin;
  }

  private checkWaveComplete(): void {
    if (this.asteroids.length === 0 && !this.waveTransition) {
      this.waveTransition = true;
      this.waveTransitionTimer = 2;
      this.services?.audio?.playSound?.('waveComplete');

      // Bonus points for wave completion
      this.score += this.wave * 500;
      this.pickups += this.wave;
    }
  }

  // ============================================
  // RENDERING
  // ============================================

  private renderStars(ctx: CanvasRenderingContext2D): void {
    for (const star of this.stars) {
      const twinkle = 0.5 + Math.sin(this.gameTime * 2 + star.x) * 0.5;
      ctx.fillStyle = `rgba(255, 255, 255, ${star.brightness * twinkle})`;
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private renderShip(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.translate(this.ship.x, this.ship.y);
    ctx.rotate(this.ship.rotation);

    // Invincibility flash
    if (this.ship.invincible && Math.floor(this.gameTime * 10) % 2 === 0) {
      ctx.globalAlpha = 0.5;
    }

    // Shield
    if (this.ship.shieldActive) {
      ctx.strokeStyle = COLORS.shield;
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.5 + Math.sin(this.gameTime * 8) * 0.3;
      ctx.beginPath();
      ctx.arc(0, 0, SHIP_SIZE * 1.5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // Ship body
    ctx.strokeStyle = COLORS.ship;
    ctx.lineWidth = 2;
    ctx.fillStyle = 'rgba(0, 255, 255, 0.1)';

    ctx.beginPath();
    ctx.moveTo(SHIP_SIZE, 0);
    ctx.lineTo(-SHIP_SIZE * 0.7, -SHIP_SIZE * 0.6);
    ctx.lineTo(-SHIP_SIZE * 0.4, 0);
    ctx.lineTo(-SHIP_SIZE * 0.7, SHIP_SIZE * 0.6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Cockpit glow
    ctx.fillStyle = COLORS.ship;
    ctx.beginPath();
    ctx.arc(SHIP_SIZE * 0.2, 0, 3, 0, Math.PI * 2);
    ctx.fill();

    // Thrust flame
    if (this.ship.thrusting) {
      ctx.fillStyle = COLORS.shipThrust;
      ctx.beginPath();
      ctx.moveTo(-SHIP_SIZE * 0.4, -SHIP_SIZE * 0.3);
      ctx.lineTo(-SHIP_SIZE * (0.8 + Math.random() * 0.4), 0);
      ctx.lineTo(-SHIP_SIZE * 0.4, SHIP_SIZE * 0.3);
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
  }

  private renderBullets(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = COLORS.bullet;
    ctx.shadowColor = COLORS.bullet;
    ctx.shadowBlur = 10;

    for (const bullet of this.bullets) {
      ctx.beginPath();
      ctx.arc(bullet.x, bullet.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.shadowBlur = 0;
  }

  private renderUFOBullets(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#ff0066';
    ctx.shadowColor = '#ff0066';
    ctx.shadowBlur = 8;

    for (const bullet of this.ufoBullets) {
      ctx.beginPath();
      ctx.arc(bullet.x, bullet.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.shadowBlur = 0;
  }

  private renderAsteroids(ctx: CanvasRenderingContext2D): void {
    for (const asteroid of this.asteroids) {
      ctx.save();
      ctx.translate(asteroid.x, asteroid.y);
      ctx.rotate(asteroid.rotation);

      // Glow effect
      ctx.shadowColor = COLORS.asteroid;
      ctx.shadowBlur = 15;

      // Asteroid shape
      ctx.strokeStyle = COLORS.asteroidOutline;
      ctx.lineWidth = 2;
      ctx.fillStyle = 'rgba(0, 255, 136, 0.1)';

      ctx.beginPath();
      ctx.moveTo(asteroid.vertices[0].x, asteroid.vertices[0].y);
      for (let i = 1; i < asteroid.vertices.length; i++) {
        ctx.lineTo(asteroid.vertices[i].x, asteroid.vertices[i].y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Health indicator (cracks)
      if (asteroid.health < ASTEROID_HEALTH[asteroid.size]) {
        ctx.strokeStyle = 'rgba(255, 100, 100, 0.5)';
        ctx.lineWidth = 1;
        const cracks = ASTEROID_HEALTH[asteroid.size] - asteroid.health;
        for (let i = 0; i < cracks; i++) {
          ctx.beginPath();
          ctx.moveTo(0, 0);
          const crackAngle = (i / cracks) * Math.PI * 2 + asteroid.rotation;
          ctx.lineTo(
            Math.cos(crackAngle) * asteroid.radius * 0.8,
            Math.sin(crackAngle) * asteroid.radius * 0.8
          );
          ctx.stroke();
        }
      }

      ctx.shadowBlur = 0;
      ctx.restore();
    }
  }

  private renderUFOs(ctx: CanvasRenderingContext2D): void {
    for (const ufo of this.ufos) {
      ctx.save();
      ctx.translate(ufo.x, ufo.y);

      const color = ufo.type === 'large' ? COLORS.ufoLarge : COLORS.ufoSmall;

      // Glow
      ctx.shadowColor = color;
      ctx.shadowBlur = 20;

      // UFO body (saucer shape)
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.fillStyle = `${color}22`;

      // Top dome
      ctx.beginPath();
      ctx.ellipse(0, -ufo.radius * 0.3, ufo.radius * 0.4, ufo.radius * 0.3, 0, Math.PI, 0);
      ctx.stroke();

      // Main body
      ctx.beginPath();
      ctx.ellipse(0, 0, ufo.radius, ufo.radius * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Bottom lights
      ctx.fillStyle = color;
      const lightCount = ufo.type === 'large' ? 5 : 3;
      for (let i = 0; i < lightCount; i++) {
        const lightAngle = (i / lightCount) * Math.PI - Math.PI / 2 + this.gameTime * 3;
        const lx = Math.cos(lightAngle) * ufo.radius * 0.6;
        const ly = ufo.radius * 0.2;
        ctx.beginPath();
        ctx.arc(lx, ly, 2, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.shadowBlur = 0;
      ctx.restore();
    }
  }

  private renderParticles(ctx: CanvasRenderingContext2D): void {
    for (const p of this.particles) {
      const alpha = p.lifetime / p.maxLifetime;
      ctx.fillStyle = p.color;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  private renderDebris(ctx: CanvasRenderingContext2D): void {
    for (const d of this.debris) {
      ctx.save();
      ctx.translate(d.x, d.y);
      ctx.rotate(d.rotation);
      ctx.globalAlpha = Math.min(1, d.lifetime);
      ctx.fillStyle = d.color;

      // Random polygon shape
      ctx.beginPath();
      ctx.moveTo(-d.size, -d.size * 0.5);
      ctx.lineTo(d.size * 0.5, -d.size);
      ctx.lineTo(d.size, d.size * 0.5);
      ctx.lineTo(-d.size * 0.5, d.size);
      ctx.closePath();
      ctx.fill();

      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  private renderPowerUps(ctx: CanvasRenderingContext2D): void {
    for (const pu of this.powerUps) {
      const pulse = 1 + Math.sin(pu.pulsePhase) * 0.2;
      const color = COLORS.powerUp[pu.type];

      ctx.save();
      ctx.translate(pu.x, pu.y);
      ctx.scale(pulse, pulse);

      // Glow
      ctx.shadowColor = color;
      ctx.shadowBlur = 20;

      // Outer ring
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 15, 0, Math.PI * 2);
      ctx.stroke();

      // Icon
      ctx.fillStyle = color;
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const icons: Record<PowerUp['type'], string> = {
        rapidFire: 'R',
        spread: 'S',
        shield: 'O',
        extraLife: '+',
        bomb: 'B',
      };
      ctx.fillText(icons[pu.type], 0, 0);

      ctx.shadowBlur = 0;
      ctx.restore();
    }
  }

  private renderMiniShip(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-Math.PI / 2);
    ctx.scale(0.5, 0.5);

    ctx.strokeStyle = COLORS.ship;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(SHIP_SIZE, 0);
    ctx.lineTo(-SHIP_SIZE * 0.7, -SHIP_SIZE * 0.6);
    ctx.lineTo(-SHIP_SIZE * 0.4, 0);
    ctx.lineTo(-SHIP_SIZE * 0.7, SHIP_SIZE * 0.6);
    ctx.closePath();
    ctx.stroke();

    ctx.restore();
  }

  private renderWaveTransition(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    ctx.fillStyle = COLORS.hud;
    ctx.font = 'bold 48px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const text = `WAVE ${this.wave} COMPLETE!`;
    ctx.fillText(text, this.canvas.width / 2, this.canvas.height / 2 - 30);

    ctx.font = '24px monospace';
    ctx.fillStyle = '#ffff00';
    ctx.fillText(`+${this.wave * 500} BONUS`, this.canvas.width / 2, this.canvas.height / 2 + 20);

    ctx.fillStyle = '#888888';
    ctx.font = '18px monospace';
    ctx.fillText('Next wave incoming...', this.canvas.width / 2, this.canvas.height / 2 + 60);
  }

  private renderGameOver(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    ctx.fillStyle = '#ff4444';
    ctx.font = 'bold 64px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('GAME OVER', this.canvas.width / 2, this.canvas.height / 2 - 80);

    ctx.fillStyle = COLORS.hud;
    ctx.font = '28px monospace';
    ctx.fillText(`FINAL SCORE: ${this.score.toLocaleString()}`, this.canvas.width / 2, this.canvas.height / 2 - 20);

    ctx.font = '22px monospace';
    ctx.fillStyle = '#888888';
    ctx.fillText(`Wave: ${this.wave}`, this.canvas.width / 2, this.canvas.height / 2 + 20);
    ctx.fillText(`Max Combo: ${this.maxCombo}x`, this.canvas.width / 2, this.canvas.height / 2 + 50);
    ctx.fillText(`Total Kills: ${this.totalKills}`, this.canvas.width / 2, this.canvas.height / 2 + 80);

    if (this.gameOverTimer > 1) {
      ctx.fillStyle = '#ffffff';
      ctx.font = '18px monospace';
      ctx.fillText('Press SPACE to continue', this.canvas.width / 2, this.canvas.height / 2 + 130);
    }
  }
}