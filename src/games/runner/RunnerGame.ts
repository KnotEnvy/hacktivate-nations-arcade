// ===== src/games/runner/RunnerGame.ts (ENHANCED) =====
import { BaseGame } from '@/games/shared/BaseGame';
import { GameManifest } from '@/lib/types';
import { Player } from './entities/Player';
import { Obstacle } from './entities/Obstacle';
import { Coin } from './entities/Coin';
import { PowerUp, PowerUpType } from './entities/PowerUp';
import { FlyingEnemy } from './entities/FlyingEnemy';
import { HoverEnemy } from './entities/HoverEnemy';
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

    // Check state before update
    const wasGrounded = this.player.getIsGrounded();
    const jumpsBefore = this.player.getJumpsRemaining();


    // Update player with power-ups
    const hasDoubleJump = this.hasPowerUp('double-jump');
    this.player.update(dt, jumpPressed, hasDoubleJump, leftPressed, rightPressed);


    // Detect jump start by comparing jumps remaining
    const jumpsAfter = this.player.getJumpsRemaining();
    const jumpStarted = jumpsAfter < jumpsBefore;

    const isGrounded = this.player.getIsGrounded();
    const landing = wasGrounded === false && isGrounded === true;

    if (jumpStarted) {
      this.services.audio.playSound('jump');
      this.jumpInProgress = true;
    }

    if (landing && this.jumpInProgress) {
      this.jumps++;
      this.jumpInProgress = false;
    }

    // Handle particle effects
    this.handlePlayerEffects(jumpStarted, landing);

    
    // Update game speed and distance
    const baseIncrement = this.gameSpeed * dt * 100;
    this.distance += baseIncrement;
    this.gameSpeed = 1 + Math.floor(this.distance / 1000) * 0.2;

    // Apply speed boost power-up
    const speedMultiplier = this.hasPowerUp('speed-boost') ? 1.5 : 1;
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
      // maxCombo: this.maxCombo,
      speed: this.gameSpeed,
      combo: this.comboSystem?.getCombo?.() ?? 0,
      // Add more as needed
    };
  }


  private handlePlayerEffects(jumpStarted: boolean, landing: boolean): void {


    if (jumpStarted) {
      this.particles.createJumpDust(this.player.position.x, this.player.position.y);
    }


    if (landing) {
      this.particles.createLandingDust(this.player.position.x, this.player.position.y);
      this.screenShake.shake(3, 0.1);
    }

  }

  private updateEntities(dt: number, gameSpeed: number): void {
    // Update obstacles
    this.obstacles.forEach(obstacle => obstacle.update(dt, gameSpeed));
    this.obstacles = this.obstacles.filter(obstacle => !obstacle.isOffScreen());

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

    // Update flying enemies
    this.flyingEnemies.forEach(enemy => enemy.update(dt, gameSpeed));
    this.flyingEnemies = this.flyingEnemies.filter(enemy => !enemy.isOffScreen());

    // Update hover enemies
    this.hoverEnemies.forEach(enemy => enemy.update(dt, gameSpeed));
    this.hoverEnemies = this.hoverEnemies.filter(enemy => !enemy.isOffScreen());
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
    
    // Update camera shake
    this.cameraOffset = this.screenShake.getOffset();
  }

  private handleSpawning(): void {
    if (this.distance >= this.nextObstacleDistance) {
      // Occasionally spawn a short pattern of two obstacles
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

      this.scheduleNextObstacle();
    }

    if (this.distance >= this.nextAerialDistance) {
      if (Math.random() < 0.5 && this.distance > 500) {
        this.spawnFlyingEnemy();
      }

      if (Math.random() < 0.4 && this.distance > 800) {
        this.spawnHoverEnemy();
      }

      this.scheduleNextAerial();
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
    
    // Render player with invincibility effect
    if (this.hasPowerUp('invincibility')) {
      const flash = Math.sin(Date.now() * 0.02) > 0;
      if (flash) {
        ctx.globalAlpha = 0.7;
        ctx.shadowColor = '#10B981';
        ctx.shadowBlur = 10;
      }
    }
    
    this.player.render(ctx);
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    
    this.particles.render(ctx);
    
    ctx.restore();
  }

  protected onRenderUI(ctx: CanvasRenderingContext2D): void {
    // Base UI
    // super.onRenderUI(ctx);
        // Speed indicator
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '16px Arial';
    ctx.textAlign = 'right';
    ctx.fillText(`Speed: ${this.gameSpeed.toFixed(1)}x`, this.canvas.width - 20, 40);
    
    // Distance
    ctx.fillText(`Distance: ${Math.floor(this.distance)}m`, this.canvas.width - 20, 65);

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

  private spawnObstacle(offset: number = 50): void {
    const x = this.canvas.width + offset;
    const y = this.groundY - 48;
    this.obstacles.push(new Obstacle(x, y));
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
    
    // Check obstacle collisions
    if (!isInvincible) {
      for (const obstacle of this.obstacles) {
        if (playerBounds.intersects(obstacle.getBounds())) {
          this.services.audio.playSound('collision');
          this.screenShake.shake(10, 0.3);
          this.endGame();
          return;
        }
      }
      
      // Check flying enemy collisions
      for (const enemy of this.flyingEnemies) {
        if (playerBounds.intersects(enemy.getBounds())) {
          this.services.audio.playSound('collision');
          this.screenShake.shake(8, 0.25);
          this.endGame();
          return;
        }
      }

      // Check hover enemy collisions
      for (const enemy of this.hoverEnemies) {
        if (playerBounds.intersects(enemy.getBounds())) {
          this.services.audio.playSound('collision');
          this.screenShake.shake(8, 0.25);
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

  protected onRestart(): void {
    this.obstacles = [];
    this.coins = [];
    this.powerUps = [];
    this.flyingEnemies = [];
    this.hoverEnemies = [];
    this.activePowerUps = [];
    this.particles = new ParticleSystem();
    this.screenShake = new ScreenShake();
    this.comboSystem = new ComboSystem();
    this.environmentSystem = new EnvironmentSystem();
    this.gameSpeed = 1;
    this.distance = 0;
    this.scheduleNextObstacle();
    this.scheduleNextAerial();
    this.jumps = 0;
    this.powerupsUsed = 0;
    this.powerupTypesUsed.clear();
    this.player = new Player(100, this.groundY - 32, this.groundY, this.canvas.width);
    this.parallaxSystem.reset();
  }
}