import { BaseGame } from '@/games/shared/BaseGame';
import { GameManifest } from '@/lib/types';
import { Vector2, Rectangle } from '@/games/shared/utils/Vector2';

interface Star {
  x: number;
  y: number;
  speed: number;
  size: number;
}

interface Bullet {
  pos: Vector2;
  speed: number;
}

interface Enemy {
  pos: Vector2;
  speed: number;
  size: number;
}

export class SpaceShooterGame extends BaseGame {
  manifest: GameManifest = {
    id: 'space',
    title: 'Space Shooter',
    thumbnail: '/games/space/space-thumb.svg',
    inputSchema: ['keyboard'],
    assetBudgetKB: 100,
    tier: 2,
    description: 'Defend the galaxy from waves of alien ships!',
  };

  private player: Vector2 = new Vector2();
  private playerWidth = 32;
  private playerHeight = 26;

  private stars: Star[] = [];
  private bullets: Bullet[] = [];
  private enemies: Enemy[] = [];

  private bulletCooldown = 0;
  private enemySpawnTimer = 0;
  private enemySpawnInterval = 1.5;

  protected onInit(): void {
    this.player = new Vector2(this.canvas.width / 2, this.canvas.height - 60);
    this.generateStars();
  }

  protected onUpdate(dt: number): void {
    this.updateStars(dt);
    this.handleInput(dt);

    this.bulletCooldown -= dt;
    this.enemySpawnTimer += dt;

    if (this.enemySpawnTimer >= this.enemySpawnInterval) {
      this.spawnEnemy();
      this.enemySpawnTimer = 0;
      this.enemySpawnInterval = Math.max(0.5, this.enemySpawnInterval * 0.98);
    }

    this.updateBullets(dt);
    this.updateEnemies(dt);
    this.checkCollisions();
  }

  protected onRender(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    this.renderStars(ctx);
    this.renderPlayer(ctx);
    this.renderBullets(ctx);
    this.renderEnemies(ctx);
  }

  protected onRestart(): void {
    this.bullets = [];
    this.enemies = [];
    this.score = 0;
    this.pickups = 0;
    this.enemySpawnInterval = 1.5;
    this.player = new Vector2(this.canvas.width / 2, this.canvas.height - 60);
    this.generateStars();
  }

  private generateStars(): void {
    this.stars = [];
    for (let i = 0; i < 80; i++) {
      this.stars.push({
        x: Math.random() * this.canvas.width,
        y: Math.random() * this.canvas.height,
        speed: 30 + Math.random() * 70,
        size: Math.random() * 2 + 1,
      });
    }
  }

  private updateStars(dt: number): void {
    for (const star of this.stars) {
      star.y += star.speed * dt;
      if (star.y > this.canvas.height) {
        star.y = 0;
        star.x = Math.random() * this.canvas.width;
      }
    }
  }

  private renderStars(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#FFFFFF';
    for (const star of this.stars) {
      ctx.fillRect(star.x, star.y, star.size, star.size);
    }
  }

  private handleInput(dt: number): void {
    const moveSpeed = 250;
    if (this.services.input.isLeftPressed()) {
      this.player.x -= moveSpeed * dt;
    }
    if (this.services.input.isRightPressed()) {
      this.player.x += moveSpeed * dt;
    }
    this.player.x = Math.max(
      this.playerWidth / 2,
      Math.min(this.canvas.width - this.playerWidth / 2, this.player.x)
    );

    if (this.services.input.isActionPressed() && this.bulletCooldown <= 0) {
      this.bullets.push({
        pos: new Vector2(this.player.x, this.player.y - this.playerHeight / 2),
        speed: 400,
      });
      this.bulletCooldown = 0.3;
      this.services.audio.playSound('powerup');
    }
  }

  private updateBullets(dt: number): void {
    this.bullets.forEach((b) => {
      b.pos.y -= b.speed * dt;
    });
    this.bullets = this.bullets.filter((b) => b.pos.y > -10);
  }

  private updateEnemies(dt: number): void {
    this.enemies.forEach((e) => {
      e.pos.y += e.speed * dt;
    });
    this.enemies = this.enemies.filter((e) => e.pos.y < this.canvas.height + e.size);
  }

  private spawnEnemy(): void {
    const size = 24 + Math.random() * 16;
    this.enemies.push({
      pos: new Vector2(Math.random() * (this.canvas.width - size) + size / 2, -size),
      speed: 40 + Math.random() * 60,
      size,
    });
  }

  private checkCollisions(): void {
    const playerRect = Rectangle.fromCenter(
      this.player,
      this.playerWidth,
      this.playerHeight
    );

    for (const enemy of this.enemies) {
      const enemyRect = Rectangle.fromCenter(enemy.pos, enemy.size, enemy.size);
      if (enemyRect.intersects(playerRect) || enemy.pos.y > this.canvas.height) {
        this.endGame();
        return;
      }
      for (const bullet of this.bullets) {
        const bulletRect = Rectangle.fromCenter(bullet.pos, 4, 8);
        if (bulletRect.intersects(enemyRect)) {
          this.score += 10;
          this.services.audio.playSound('collision');
          enemy.pos.y = this.canvas.height + 100; // mark for removal
          bullet.pos.y = -20;
          break;
        }
      }
    }
  }

  private renderPlayer(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#22D3EE';
    ctx.beginPath();
    ctx.moveTo(this.player.x, this.player.y - this.playerHeight / 2);
    ctx.lineTo(this.player.x - this.playerWidth / 2, this.player.y + this.playerHeight / 2);
    ctx.lineTo(this.player.x + this.playerWidth / 2, this.player.y + this.playerHeight / 2);
    ctx.closePath();
    ctx.fill();
  }

  private renderBullets(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#FBBF24';
    for (const b of this.bullets) {
      ctx.fillRect(b.pos.x - 2, b.pos.y - 8, 4, 8);
    }
  }

  private renderEnemies(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#EF4444';
    for (const e of this.enemies) {
      ctx.beginPath();
      ctx.moveTo(e.pos.x, e.pos.y - e.size / 2);
      ctx.lineTo(e.pos.x - e.size / 2, e.pos.y + e.size / 2);
      ctx.lineTo(e.pos.x + e.size / 2, e.pos.y + e.size / 2);
      ctx.closePath();
      ctx.fill();
    }
  }
}
