// ===== src/games/runner/RunnerGame.ts =====
import { BaseGame } from '@/games/shared/BaseGame';
import { GameManifest } from '@/lib/types';
import { Player } from './entities/Player';
import { Obstacle } from './entities/Obstacle';
import { Coin } from './entities/Coin';
import { ParticleSystem } from './systems/ParticleSystem';

export class RunnerGame extends BaseGame {
  manifest: GameManifest = {
    id: 'runner',
    title: 'Endless Runner',
    thumbnail: '/images/runner-thumb.png',
    inputSchema: ['keyboard', 'touch'],
    assetBudgetKB: 50,
    tier: 0,
    description: 'Jump and collect coins in this fast-paced endless runner!'
  };

  private player!: Player;
  private obstacles: Obstacle[] = [];
  private coins: Coin[] = [];
  private particles!: ParticleSystem;
  
  private gameSpeed: number = 1;
  private spawnTimer: number = 0;
  private spawnInterval: number = 2; // seconds
  private distance: number = 0;
  
  private groundY: number = 0;
  private wasGrounded: boolean = true;
  private wasJumpPressed: boolean = false;

  protected onInit(): void {
    this.groundY = this.canvas.height - 50;
    this.player = new Player(100, this.groundY - 32, this.groundY);
    this.particles = new ParticleSystem();
    
    // Spawn initial obstacles and coins
    this.spawnObstacle();
    this.spawnCoin();
  }

  protected onUpdate(dt: number): void {
    const jumpPressed = this.services.input.isActionPressed();
    
    // Update player
    this.player.update(dt, jumpPressed);
    
    // Particle effects for jumping and landing
    if (jumpPressed && !this.wasJumpPressed && this.player.getIsGrounded()) {
      this.particles.createJumpDust(this.player.position.x, this.player.position.y);
      this.services.audio.playSound('jump');
    }
    
    if (!this.wasGrounded && this.player.getIsGrounded()) {
      this.particles.createLandingDust(this.player.position.x, this.player.position.y);
    }
    
    this.wasJumpPressed = jumpPressed;
    this.wasGrounded = this.player.getIsGrounded();

    // Update game speed based on distance
    this.distance += this.gameSpeed * dt * 100;
    this.gameSpeed = 1 + Math.floor(this.distance / 1000) * 0.2;

    // Update obstacles
    this.obstacles.forEach(obstacle => obstacle.update(dt, this.gameSpeed));
    this.obstacles = this.obstacles.filter(obstacle => !obstacle.isOffScreen());

    // Update coins
    this.coins.forEach(coin => coin.update(dt, this.gameSpeed));
    this.coins = this.coins.filter(coin => !coin.isOffScreen());

    // Update particles
    this.particles.update(dt);

    // Spawn new obstacles and coins
    this.spawnTimer += dt;
    if (this.spawnTimer >= this.spawnInterval) {
      this.spawnTimer = 0;
      
      if (Math.random() < 0.7) {
        this.spawnObstacle();
      }
      
      if (Math.random() < 0.5) {
        this.spawnCoin();
      }
      
      // Decrease spawn interval as game gets faster
      this.spawnInterval = Math.max(1.2, 2 - (this.gameSpeed - 1) * 0.3);
    }

    // Check collisions
    this.checkCollisions();

    // Update score based on distance
    this.score = Math.floor(this.distance / 10);
  }

  protected onRender(ctx: CanvasRenderingContext2D): void {
    this.renderBackground(ctx);
    this.renderGround(ctx);
    
    // Render game objects
    this.obstacles.forEach(obstacle => obstacle.render(ctx));
    this.coins.forEach(coin => coin.render(ctx));
    this.player.render(ctx);
    this.particles.render(ctx);
  }

  protected onRenderUI(ctx: CanvasRenderingContext2D): void {
    // Speed indicator
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '16px Arial';
    ctx.textAlign = 'right';
    ctx.fillText(`Speed: ${this.gameSpeed.toFixed(1)}x`, this.canvas.width - 20, 40);
    
    // Distance
    ctx.fillText(`Distance: ${Math.floor(this.distance)}m`, this.canvas.width - 20, 65);
  }

  private renderBackground(ctx: CanvasRenderingContext2D): void {
    // Gradient sky
    const gradient = ctx.createLinearGradient(0, 0, 0, this.canvas.height);
    gradient.addColorStop(0, '#87CEEB'); // Sky blue
    gradient.addColorStop(1, '#E0F6FF'); // Light blue
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.canvas.width, this.groundY);
    
    // Moving clouds (simple)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    const cloudOffset = (this.distance * 0.3) % (this.canvas.width + 200);
    for (let i = 0; i < 3; i++) {
      const x = (i * 300) - cloudOffset;
      const y = 50 + i * 30;
      this.renderCloud(ctx, x, y);
    }
  }

  private renderCloud(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    ctx.fillRect(x, y, 60, 20);
    ctx.fillRect(x + 10, y - 10, 40, 20);
    ctx.fillRect(x + 20, y - 15, 30, 20);
  }

  private renderGround(ctx: CanvasRenderingContext2D): void {
    // Ground
    ctx.fillStyle = '#8B7355'; // Brown
    ctx.fillRect(0, this.groundY, this.canvas.width, this.canvas.height - this.groundY);
    
    // Grass line
    ctx.fillStyle = '#22C55E'; // Green
    ctx.fillRect(0, this.groundY - 4, this.canvas.width, 4);
    
    // Ground details
    ctx.fillStyle = '#6B5B47';
    const grassOffset = (this.distance * 2) % 40;
    for (let x = -grassOffset; x < this.canvas.width; x += 40) {
      ctx.fillRect(x, this.groundY + 10, 2, 8);
      ctx.fillRect(x + 20, this.groundY + 15, 3, 6);
    }
  }

  private spawnObstacle(): void {
    const x = this.canvas.width + 50;
    const y = this.groundY - 48;
    this.obstacles.push(new Obstacle(x, y));
  }

  private spawnCoin(): void {
    const x = this.canvas.width + 50;
    const y = this.groundY - 16 - Math.random() * 100; // Random height
    this.coins.push(new Coin(x, y));
  }

  private checkCollisions(): void {
    const playerBounds = this.player.getBounds();
    
    // Check obstacle collisions
    for (const obstacle of this.obstacles) {
      if (playerBounds.intersects(obstacle.getBounds())) {
        this.endGame();
        return;
      }
    }
    
    // Check coin collisions
    for (let i = this.coins.length - 1; i >= 0; i--) {
      const coin = this.coins[i];
      if (playerBounds.intersects(coin.getBounds())) {
        this.coins.splice(i, 1);
        this.pickups++;
        this.particles.createCoinPickup(
          coin.position.x + coin.size/2, 
          coin.position.y + coin.size/2
        );
        this.services.audio.playSound('coin');
      }
    }
  }

  protected onRestart(): void {
    this.obstacles = [];
    this.coins = [];
    this.particles = new ParticleSystem();
    this.gameSpeed = 1;
    this.spawnTimer = 0;
    this.spawnInterval = 2;
    this.distance = 0;
    this.player = new Player(100, this.groundY - 32, this.groundY);
  }
}
