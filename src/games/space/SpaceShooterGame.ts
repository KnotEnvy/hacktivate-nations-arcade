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
  damage: number;
  vx?: number; // for angled shots
}

interface Enemy {
  pos: Vector2;
  speed: number;
  size: number;
  hp: number;
  type: 'basic' | 'sine' | 'shooter';
  t: number; // local timer for movement / shooting
}

interface EnemyBullet {
  pos: Vector2;
  vx: number;
  vy: number;
  size: number;
  damage: number;
}

interface PowerUp {
  pos: Vector2;
  kind: 'shield' | 'spread' | 'heal' | 'score';
  vy: number;
  size: number;
}

interface WaveEntry {
  t: number; // spawn time from level start (seconds)
  count: number;
  type: Enemy['type'];
  speed: number;
  size: number;
  pattern?: 'line' | 'arc' | 'random';
}

interface Boss {
  pos: Vector2;
  width: number;
  height: number;
  hp: number;
  maxHp: number;
  phase: 1 | 2 | 3;
  t: number; // phase timer
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
  private playerHp = 3;
  private playerShield = 0; // absorbs hits first
  private weaponLevel: 1 | 2 | 3 = 1;

  private stars: Star[] = [];
  private bullets: Bullet[] = [];
  private enemies: Enemy[] = [];
  private enemyBullets: EnemyBullet[] = [];
  private powerups: PowerUp[] = [];

  private bulletCooldown = 0;
  private enemySpawnTimer = 0;
  private enemySpawnInterval = 1.5;

  // Level and boss state
  private levelTime = 0; // time since level start
  private waves: WaveEntry[] = [];
  private waveIndex = 0;
  private boss: Boss | null = null;
  private levelCompleted = false;

  protected onInit(): void {
    this.player = new Vector2(this.canvas.width / 2, this.canvas.height - 60);
    this.generateStars();
    this.buildLevel1();
  }

  protected onUpdate(dt: number): void {
    this.updateStars(dt);
    this.handleInput(dt);

    this.bulletCooldown -= dt;
    this.enemySpawnTimer += dt;

    // Level timeline and waves
    this.levelTime += dt;
    while (
      this.waveIndex < this.waves.length &&
      this.levelTime >= this.waves[this.waveIndex].t
    ) {
      this.spawnWave(this.waves[this.waveIndex]);
      this.waveIndex++;
    }

    // Old endless spawn fallback if no waves (shouldn't happen after build)
    if (this.waves.length === 0 && this.enemySpawnTimer >= this.enemySpawnInterval) {
      this.spawnEnemy('basic');
      this.enemySpawnTimer = 0;
      this.enemySpawnInterval = Math.max(0.5, this.enemySpawnInterval * 0.98);
    }

    this.updateBullets(dt);
    this.updateEnemies(dt);
    this.updateEnemyBullets(dt);
    this.updatePowerUps(dt);
    this.updateBoss(dt);
    this.checkCollisions();
  }

  protected onRender(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    this.renderStars(ctx);
    this.renderPlayer(ctx);
    this.renderBullets(ctx);
    this.renderEnemies(ctx);
    this.renderEnemyBullets(ctx);
    this.renderPowerUps(ctx);
    this.renderBoss(ctx);
  }

  protected onRestart(): void {
    this.bullets = [];
    this.enemies = [];
    this.enemyBullets = [];
    this.powerups = [];
    this.score = 0;
    this.pickups = 0;
    this.enemySpawnInterval = 1.5;
    this.player = new Vector2(this.canvas.width / 2, this.canvas.height - 60);
    this.playerHp = 3;
    this.playerShield = 0;
    this.weaponLevel = 1;
    this.levelTime = 0;
    this.waveIndex = 0;
    this.boss = null;
    this.levelCompleted = false;
    this.generateStars();
    this.buildLevel1();
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
      // Fire based on weapon level
      const fire = (offsetX: number, vx: number = 0) =>
        this.bullets.push({
          pos: new Vector2(this.player.x + offsetX, this.player.y - this.playerHeight / 2),
          speed: 500,
          damage: 1,
          vx,
        });

      if (this.weaponLevel === 1) {
        fire(0);
      } else if (this.weaponLevel === 2) {
        fire(-6);
        fire(6);
      } else {
        fire(-8, -80);
        fire(0, 0);
        fire(8, 80);
      }

      this.bulletCooldown = Math.max(0.12, 0.25 - (this.weaponLevel - 1) * 0.05);
      this.services.audio.playSound('powerup');
    }
  }

  private updateBullets(dt: number): void {
    this.bullets.forEach((b) => {
      b.pos.y -= b.speed * dt;
      if (b.vx) b.pos.x += b.vx * dt;
    });
    this.bullets = this.bullets.filter((b) => b.pos.y > -10);
  }

  private updateEnemies(dt: number): void {
    this.enemies.forEach((e) => {
      e.t += dt;
      if (e.type === 'basic') {
        e.pos.y += e.speed * dt;
      } else if (e.type === 'sine') {
        e.pos.y += e.speed * dt;
        const amp = 40;
        e.pos.x += Math.sin(e.t * 3) * 80 * dt;
        e.pos.x = Math.max(e.size / 2, Math.min(this.canvas.width - e.size / 2, e.pos.x));
      } else if (e.type === 'shooter') {
        e.pos.y += e.speed * dt * 0.7;
        // Fire at intervals
        if (e.t > 1.2) {
          e.t = 0;
          this.spawnEnemyBullet(e.pos.clone(), this.player.clone(), 160, 1);
        }
      }
    });
    this.enemies = this.enemies.filter((e) => e.pos.y < this.canvas.height + e.size);
  }

  private spawnEnemy(type: Enemy['type'] = 'basic'): void {
    const size = 22 + Math.random() * 20;
    const speed = 40 + Math.random() * 70;
    this.enemies.push({
      pos: new Vector2(Math.random() * (this.canvas.width - size) + size / 2, -size),
      speed,
      size,
      hp: Math.ceil(size / 12),
      type,
      t: 0,
    });
  }

  private spawnEnemyBullet(from: Vector2, target: Vector2, speed: number, damage: number): void {
    const dir = target.subtract(from).normalize();
    this.enemyBullets.push({
      pos: from.clone(),
      vx: dir.x * speed,
      vy: dir.y * speed,
      size: 6,
      damage,
    });
    this.services.audio.playSound('collision');
  }

  private checkCollisions(): void {
    const playerRect = Rectangle.fromCenter(
      this.player,
      this.playerWidth,
      this.playerHeight
    );

    // Player vs enemy
    for (const enemy of this.enemies) {
      const enemyRect = Rectangle.fromCenter(enemy.pos, enemy.size, enemy.size);
      if (enemyRect.intersects(playerRect)) {
        this.damagePlayer(1);
        enemy.pos.y = this.canvas.height + 100;
        continue;
      }
      // Bullets vs enemy
      for (const bullet of this.bullets) {
        const bulletRect = Rectangle.fromCenter(bullet.pos, 4, 8);
        if (bulletRect.intersects(enemyRect)) {
          enemy.hp -= bullet.damage;
          bullet.pos.y = -20; // remove
          if (enemy.hp <= 0) {
            this.score += 20;
            // Drop chance
            if (Math.random() < 0.15) this.spawnPowerUp(enemy.pos.clone());
            enemy.pos.y = this.canvas.height + 100; // mark for removal
            this.services.audio.playSound('collision');
          }
          break;
        }
      }
    }

    // Player vs enemy bullets
    for (const eb of this.enemyBullets) {
      const bRect = Rectangle.fromCenter(eb.pos, eb.size, eb.size);
      if (bRect.intersects(playerRect)) {
        this.damagePlayer(eb.damage);
        eb.pos.y = this.canvas.height + 100;
      }
    }

    // Player vs power-ups
    for (const p of this.powerups) {
      const pRect = Rectangle.fromCenter(p.pos, p.size, p.size);
      if (pRect.intersects(playerRect)) {
        this.applyPowerUp(p.kind);
        p.pos.y = this.canvas.height + 100;
      }
    }

    // Player out of bounds safety (bottom means death)
    if (this.player.y > this.canvas.height) {
      this.endGame();
      return;
    }

    // Boss collisions
    if (this.boss) {
      const bossRect = new Rectangle(
        this.boss.pos.x - this.boss.width / 2,
        this.boss.pos.y - this.boss.height / 2,
        this.boss.width,
        this.boss.height
      );
      // Player bullets damage boss
      for (const bullet of this.bullets) {
        const bulletRect = Rectangle.fromCenter(bullet.pos, 4, 8);
        if (bulletRect.intersects(bossRect)) {
          this.boss.hp -= bullet.damage;
          bullet.pos.y = -20;
          if (this.boss.hp <= 0) {
            this.onBossDefeated();
          }
        }
      }
      // Boss contact hurts player
      if (bossRect.intersects(playerRect)) {
        this.damagePlayer(1);
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

    // Shield glow
    if (this.playerShield > 0) {
      ctx.strokeStyle = 'rgba(34,211,238,0.4)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(this.player.x, this.player.y + 2, Math.max(this.playerWidth, this.playerHeight) / 1.3, 0, Math.PI * 2);
      ctx.stroke();
    }
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

  private renderEnemyBullets(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#F87171';
    for (const b of this.enemyBullets) {
      ctx.fillRect(b.pos.x - b.size / 2, b.pos.y - b.size / 2, b.size, b.size);
    }
  }

  private renderPowerUps(ctx: CanvasRenderingContext2D): void {
    for (const p of this.powerups) {
      if (p.kind === 'shield') ctx.fillStyle = '#22D3EE';
      else if (p.kind === 'spread') ctx.fillStyle = '#F59E0B';
      else if (p.kind === 'heal') ctx.fillStyle = '#10B981';
      else ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(p.pos.x, p.pos.y, p.size / 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private renderBoss(ctx: CanvasRenderingContext2D): void {
    if (!this.boss) return;
    ctx.fillStyle = '#7C3AED';
    ctx.fillRect(
      this.boss.pos.x - this.boss.width / 2,
      this.boss.pos.y - this.boss.height / 2,
      this.boss.width,
      this.boss.height
    );

    // Boss HP bar
    const barW = this.canvas.width * 0.7;
    const barH = 12;
    const x = (this.canvas.width - barW) / 2;
    const y = 20;
    ctx.fillStyle = '#111827';
    ctx.fillRect(x, y, barW, barH);
    ctx.fillStyle = '#8B5CF6';
    const pct = Math.max(0, this.boss.hp / this.boss.maxHp);
    ctx.fillRect(x, y, barW * pct, barH);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`Boss — Phase ${this.boss.phase}`, this.canvas.width / 2, y + barH + 14);
  }

  private updateEnemyBullets(dt: number): void {
    for (const b of this.enemyBullets) {
      b.pos.x += b.vx * dt;
      b.pos.y += b.vy * dt;
    }
    this.enemyBullets = this.enemyBullets.filter(
      (b) => b.pos.y < this.canvas.height + 20 && b.pos.y > -20 && b.pos.x > -20 && b.pos.x < this.canvas.width + 20
    );
  }

  private updatePowerUps(dt: number): void {
    for (const p of this.powerups) {
      p.pos.y += p.vy * dt;
    }
    this.powerups = this.powerups.filter((p) => p.pos.y < this.canvas.height + 30);
  }

  private damagePlayer(amount: number): void {
    if (this.playerShield > 0) {
      const absorb = Math.min(this.playerShield, amount);
      this.playerShield -= absorb;
      amount -= absorb;
    }
    if (amount > 0) {
      this.playerHp -= amount;
      this.services.audio.playSound('collision');
      if (this.playerHp <= 0) {
        this.endGame();
      }
    }
  }

  private spawnPowerUp(pos: Vector2): void {
    const r = Math.random();
    const kind: PowerUp['kind'] = r < 0.35 ? 'shield' : r < 0.65 ? 'spread' : r < 0.85 ? 'heal' : 'score';
    this.powerups.push({ pos, kind, vy: 60, size: 16 });
  }

  private applyPowerUp(kind: PowerUp['kind']): void {
    this.pickups += 1; // counts towards currency reward
    this.services.audio.playSound('powerup');
    this.services.analytics.trackGameAction({ type: 'powerup', timestamp: new Date(), metadata: { game: 'space', kind } });
    switch (kind) {
      case 'shield':
        this.playerShield = Math.min(3, this.playerShield + 2);
        break;
      case 'spread':
        this.weaponLevel = Math.min(3, (this.weaponLevel + 1) as 2 | 3);
        break;
      case 'heal':
        this.playerHp = Math.min(3, this.playerHp + 1);
        break;
      case 'score':
        this.score += 50;
        break;
    }
  }

  private buildLevel1(): void {
    // Simple curated wave timeline leading to a boss
    this.waves = [];
    let t = 1.0;
    const pushWave = (entry: Omit<WaveEntry, 't'>, delay: number) => {
      this.waves.push({ t, ...entry });
      t += delay;
    };

    // Opening skirmishes
    pushWave({ count: 6, type: 'basic', speed: 70, size: 26, pattern: 'line' }, 4);
    pushWave({ count: 8, type: 'sine', speed: 80, size: 24, pattern: 'random' }, 5);
    pushWave({ count: 6, type: 'shooter', speed: 70, size: 26, pattern: 'arc' }, 6);
    pushWave({ count: 10, type: 'sine', speed: 90, size: 24, pattern: 'arc' }, 6);

    // Final pre-boss push
    pushWave({ count: 12, type: 'basic', speed: 90, size: 24, pattern: 'line' }, 6);

    // Boss spawns once waves are done, handled in updateBoss when no enemies remain
  }

  private spawnWave(w: WaveEntry): void {
    const width = this.canvas.width;
    const margin = 30;
    const create = (x: number) =>
      this.enemies.push({
        pos: new Vector2(x, -w.size),
        speed: w.speed,
        size: w.size,
        hp: Math.ceil(w.size / 10),
        type: w.type,
        t: 0,
      });

    if (w.pattern === 'line') {
      for (let i = 0; i < w.count; i++) {
        const x = margin + (i / (w.count - 1)) * (width - margin * 2);
        create(x);
      }
    } else if (w.pattern === 'arc') {
      for (let i = 0; i < w.count; i++) {
        const ratio = i / (w.count - 1);
        const x = margin + ratio * (width - margin * 2);
        create(x);
      }
    } else {
      for (let i = 0; i < w.count; i++) {
        const x = margin + Math.random() * (width - margin * 2);
        create(x);
      }
    }

    this.services.analytics.trackFeatureUsage('space_wave_spawn', { index: this.waveIndex, type: w.type, count: w.count });
  }

  private updateBoss(dt: number): void {
    if (this.boss) {
      // Move slightly and run attack patterns by phase
      this.boss.t += dt;
      // Horizontal drift
      this.boss.pos.x = this.canvas.width / 2 + Math.sin(this.boss.t * 0.7) * 140;

      if (this.boss.phase === 1) {
        // Targeted shots
        if (this.boss.t > 0.9) {
          this.boss.t = 0;
          for (let i = -1; i <= 1; i++) {
            const target = this.player.clone();
            target.x += i * 60;
            this.spawnEnemyBullet(this.boss.pos.clone(), target, 180, 1);
          }
        }
        if (this.boss.hp < this.boss.maxHp * 0.66) this.boss.phase = 2;
      } else if (this.boss.phase === 2) {
        // Spread volleys
        if (this.boss.t > 1.2) {
          this.boss.t = 0;
          for (let a = -60; a <= 60; a += 20) {
            const rad = (Math.PI / 180) * a;
            const dir = new Vector2(Math.sin(rad), Math.cos(rad));
            this.enemyBullets.push({ pos: this.boss.pos.clone(), vx: dir.x * 150, vy: dir.y * 150, size: 6, damage: 1 });
          }
          this.services.audio.playSound('collision');
        }
        if (this.boss.hp < this.boss.maxHp * 0.33) this.boss.phase = 3;
      } else {
        // Laser walls (simulated by dense spreads)
        if (this.boss.t > 0.6) {
          this.boss.t = 0;
          for (let i = 0; i < 8; i++) {
            const x = (i + 0.5) * (this.canvas.width / 8);
            this.enemyBullets.push({ pos: new Vector2(x, this.boss.pos.y + this.boss.height / 2), vx: 0, vy: 220, size: 6, damage: 1 });
          }
        }
      }
      return;
    }

    // If all waves spawned and cleared, start boss
    const allWavesSpawned = this.waveIndex >= this.waves.length;
    if (!this.levelCompleted && allWavesSpawned && this.enemies.length === 0 && this.enemyBullets.length === 0) {
      this.startBoss();
    }
  }

  private startBoss(): void {
    this.boss = {
      pos: new Vector2(this.canvas.width / 2, 120),
      width: 160,
      height: 60,
      hp: 120,
      maxHp: 120,
      phase: 1,
      t: 0,
    };
    this.services.analytics.trackFeatureUsage('space_boss_start', { level: 1 });
  }

  private onBossDefeated(): void {
    if (!this.boss) return;
    this.score += 500;
    this.services.audio.playSound('success');
    this.services.analytics.trackFeatureUsage('space_boss_defeated', { level: 1 });
    this.boss = null;
    this.levelCompleted = true;

    // End game as completed after a short celebration window
    // Reuse BaseGame endGame with 'completed' outcome via analytics track in BaseGame
    setTimeout(() => this.endGame(), 500);
  }

  protected onRenderUI?(ctx: CanvasRenderingContext2D): void {
    // Extend UI: health, shield, weapon, wave indicator
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`HP: ${this.playerHp}`, 20, this.canvas.height - 50);
    ctx.fillText(`Shield: ${this.playerShield}`, 20, this.canvas.height - 30);
    ctx.fillText(`Weapon: ${this.weaponLevel}x`, 160, this.canvas.height - 30);
    const waveText = this.waveIndex < this.waves.length ? `Wave ${this.waveIndex + 1}/${this.waves.length}` : (this.boss ? 'Boss Fight' : this.levelCompleted ? 'Level Cleared!' : '');
    if (waveText) {
      ctx.textAlign = 'center';
      ctx.fillText(waveText, this.canvas.width / 2, 40);
    }
  }
}
