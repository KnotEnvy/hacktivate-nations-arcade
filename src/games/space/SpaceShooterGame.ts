import { BaseGame } from '@/games/shared/BaseGame';
import { GameManifest } from '@/lib/types';
import { Vector2, Rectangle } from '@/games/shared/utils/Vector2';

interface Star {
  x: number;
  y: number;
  speed: number;
  size: number;
  layer?: 1 | 2 | 3;
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
  type: 'basic' | 'sine' | 'shooter' | 'diver' | 'spinner' | 'tanker';
  t: number; // local timer for movement / shooting
  formationId?: number;
  offset?: Vector2; // position offset within a formation
  pivot?: Vector2; // for spinner
  angle?: number; // for spinner
  hitT?: number; // recent hit timer for flash
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

interface Particle {
  pos: Vector2;
  vel: Vector2;
  life: number; // seconds remaining
  color: string;
  size: number;
}

interface ScorePopup {
  pos: Vector2;
  text: string;
  life: number;
}

interface WaveEntry {
  t: number; // spawn time from level start (seconds)
  count: number;
  type: Enemy['type'] | 'formation' | 'diver';
  speed: number;
  size: number;
  pattern?: 'line' | 'arc' | 'random' | 'v' | 'wedge';
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

interface Formation {
  id: number;
  anchor: Vector2;
  vx: number;
  vy: number;
  t: number;
  members: Enemy[];
  shape: 'line' | 'v' | 'wedge';
  sideEntry?: 'left' | 'right';
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
  private particles: Particle[] = [];
  private popups: ScorePopup[] = [];

  private bulletCooldown = 0;
  private enemySpawnTimer = 0;
  private enemySpawnInterval = 1.5;

  // Level and boss state
  private levelTime = 0; // time since level start
  private waves: WaveEntry[] = [];
  private waveIndex = 0;
  private boss: Boss | null = null;
  private levelCompleted = false;

  // Galaga-like progression
  private stage = 1;
  private wavesSinceBoss = 0;
  private formations: Formation[] = [];
  private nextFormationId = 1;
  private unlockedTypes: Array<WaveEntry['type']> = ['basic'];

  // FX state
  private shakeTime = 0;
  private shakeMag = 0;
  private bannerText = '';
  private bannerTime = 0;
  private invulnTime = 0; // seconds of i-frames after hit
  
  // Achievement tracking
  private bossesDefeated = 0;
  private enemiesDestroyed = 0;
  private powerupsCollected = 0;

  protected onInit(): void {
    this.player = new Vector2(this.canvas.width / 2, this.canvas.height - 60);
    this.generateStars();
    this.buildStage();
    this.showBanner(`Stage ${this.stage}`);
  }

  protected onUpdate(dt: number): void {
    this.updateStars(dt);
    this.handleInput(dt);

    this.bulletCooldown -= dt;
    this.enemySpawnTimer += dt;

    // Decrement i-frames once per frame
    if (this.invulnTime > 0) this.invulnTime = Math.max(0, this.invulnTime - dt);

    // Level timeline and waves
    this.levelTime += dt;
    while (
      this.waveIndex < this.waves.length &&
      this.levelTime >= this.waves[this.waveIndex].t
    ) {
      this.spawnWave(this.waves[this.waveIndex]);
      this.waveIndex++;
      this.wavesSinceBoss++;
    }

    // Old endless spawn fallback if no waves (shouldn't happen after build)
    if (this.waves.length === 0 && this.enemySpawnTimer >= this.enemySpawnInterval) {
      this.spawnEnemy('basic');
      this.enemySpawnTimer = 0;
      this.enemySpawnInterval = Math.max(0.5, this.enemySpawnInterval * 0.98);
    }

    this.updateBullets(dt);
    this.updateEnemies(dt);
    this.updateFormations(dt);
    this.updateEnemyBullets(dt);
    this.updatePowerUps(dt);
    this.updateBoss(dt);
    this.updateParticles(dt);
    this.checkCollisions();
  }

  protected onRender(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    ctx.save();
    if (this.shakeTime > 0) {
      this.shakeTime = Math.max(0, this.shakeTime - 1 / 60);
      const m = this.shakeMag * (this.shakeTime);
      const ox = (Math.random() - 0.5) * 2 * m;
      const oy = (Math.random() - 0.5) * 2 * m;
      ctx.translate(ox, oy);
    }

    this.renderStars(ctx);
    this.renderPlayer(ctx);
    this.renderBullets(ctx);
    this.renderEnemies(ctx);
    this.renderEnemyBullets(ctx);
    this.renderPowerUps(ctx);
    this.renderBoss(ctx);
    this.renderParticles(ctx);
    this.renderPopups(ctx);
    ctx.restore();

    this.renderBanner(ctx);
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
    this.stage = 1;
    this.wavesSinceBoss = 0;
    this.unlockedTypes = ['basic'];
    this.formations = [];
    this.nextFormationId = 1;
    this.generateStars();
    this.buildStage();
  }

  private generateStars(): void {
    this.stars = [];
    const total = 140;
    for (let i = 0; i < total; i++) {
      const layer = (i % 3 === 0 ? 1 : i % 3 === 1 ? 2 : 3) as 1 | 2 | 3;
      const base = layer === 1 ? 20 : layer === 2 ? 40 : 70;
      const size = layer === 1 ? 1 : layer === 2 ? 1.5 : 2.2;
      this.stars.push({
        x: Math.random() * this.canvas.width,
        y: Math.random() * this.canvas.height,
        speed: base + Math.random() * 30,
        size,
        layer,
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
    for (const star of this.stars) {
      const layer = star.layer ?? 3;
      ctx.fillStyle = layer === 3 ? '#FFFFFF' : layer === 2 ? '#A7F3D0' : '#60A5FA';
      ctx.fillRect(star.x, star.y, star.size, star.size);
    }
  }

  private renderParticles(ctx: CanvasRenderingContext2D): void {
    for (const p of this.particles) {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillRect(p.pos.x, p.pos.y, p.size, p.size);
      ctx.globalAlpha = 1;
    }
  }

  private renderPopups(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    for (const s of this.popups) {
      const alpha = Math.max(0, Math.min(1, s.life));
      ctx.globalAlpha = alpha;
      ctx.fillText(s.text, s.pos.x, s.pos.y);
      ctx.globalAlpha = 1;
    }
  }

  private renderBanner(ctx: CanvasRenderingContext2D): void {
    if (this.bannerTime <= 0 || !this.bannerText) return;
    const alpha = Math.min(1, this.bannerTime);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    const w = this.canvas.width * 0.7;
    const h = 50;
    ctx.fillRect((this.canvas.width - w) / 2, 70, w, h);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 22px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(this.bannerText, this.canvas.width / 2, 70 + 32);
    ctx.restore();
    this.bannerTime -= 1 / 60;
  }

  private handleInput(dt: number): void {
    const moveSpeed = 250;
    // Keyboard movement
    if (this.services.input.isLeftPressed()) {
      this.player.x -= moveSpeed * dt;
    }
    if (this.services.input.isRightPressed()) {
      this.player.x += moveSpeed * dt;
    }
    // Touch horizontal follow (smoothing)
    const touches = this.services.input.getTouches?.() || [];
    if (touches.length > 0) {
      const targetX = touches[0].x;
      const lerp = 1 - Math.pow(0.001, dt); // ~fast smoothing
      this.player.x = this.player.x + (targetX - this.player.x) * lerp;
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
      if (e.formationId) {
        // Formation-controlled; position updated in updateFormations
        return;
      }
      if (e.type === 'basic') {
        e.pos.y += e.speed * dt;
      } else if (e.type === 'sine') {
        e.pos.y += e.speed * dt;
        e.pos.x += Math.sin(e.t * 3) * 80 * dt;
        e.pos.x = Math.max(e.size / 2, Math.min(this.canvas.width - e.size / 2, e.pos.x));
      } else if (e.type === 'shooter') {
        e.pos.y += e.speed * dt * 0.7;
        // Fire at intervals
        if (e.t > 1.2) {
          e.t = 0;
          this.spawnEnemyBullet(e.pos.clone(), this.player.clone(), 160, 1);
        }
      } else if (e.type === 'diver') {
        // Accelerate toward player's current position
        const dir = this.player.subtract(e.pos).normalize();
        e.pos.x += dir.x * (e.speed * 1.2) * dt;
        e.pos.y += dir.y * (e.speed * 1.2) * dt;
      } else if (e.type === 'spinner') {
        // Circle around a pivot and slowly descend
        e.angle = (e.angle ?? 0) + 2.5 * dt;
        const radius = 28;
        const pivot = e.pivot ?? (e.pivot = e.pos.clone());
        const cx = pivot.x;
        const cy = (pivot.y += 20 * dt);
        e.pos.x = cx + Math.cos(e.angle) * radius;
        e.pos.y = cy + Math.sin(e.angle) * radius;
        // Occasional radial shot (dt-scaled)
        if (Math.random() < 0.6 * dt) {
          for (let a = 0; a < 360; a += 60) {
            const rad = (Math.PI / 180) * a;
            const dir = new Vector2(Math.cos(rad), Math.sin(rad));
            this.enemyBullets.push({ pos: e.pos.clone(), vx: dir.x * 120, vy: dir.y * 120, size: 5, damage: 1 });
          }
        }
      } else if (e.type === 'tanker') {
        // Slow, high HP; occasionally fires straight
        e.pos.y += e.speed * dt * 0.5;
        if (e.t > 1.8) {
          e.t = 0;
          this.enemyBullets.push({ pos: e.pos.clone(), vx: 0, vy: 180, size: 8, damage: 1 });
        }
      }
      if (e.hitT && e.hitT > 0) e.hitT -= dt;
    });
    this.enemies = this.enemies.filter((e) => e.pos.y < this.canvas.height + e.size);
  }

  private spawnEnemy(type: Enemy['type'] | 'diver' = 'basic'): void {
    const size = 22 + Math.random() * 20;
    const speed = 40 + Math.random() * 70;
    const hpScale = this.getHpScale();
    const eType = (type as Enemy['type']) || 'basic';
    const pos = new Vector2(Math.random() * (this.canvas.width - size) + size / 2, -size);
    const base: Enemy = { pos, speed, size, hp: Math.max(1, Math.ceil((size / 14) * hpScale)), type: eType, t: 0 };
    if (eType === 'spinner') {
      base.hp = Math.ceil(base.hp * 1.1);
      base.pivot = pos.clone();
      base.angle = Math.random() * Math.PI * 2;
    } else if (eType === 'tanker') {
      base.size = size * 1.3;
      base.hp = Math.ceil((size / 10) * (hpScale + 0.5));
      base.speed = Math.max(30, speed * 0.6);
    }
    this.enemies.push(base);
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
      if (enemyRect.intersects(playerRect) && this.invulnTime <= 0) {
        this.damagePlayer(1);
        enemy.pos.y = this.canvas.height + 100;
        continue;
      }
      // Bullets vs enemy
      for (const bullet of this.bullets) {
        const bulletRect = Rectangle.fromCenter(bullet.pos, 4, 8);
        if (bulletRect.intersects(enemyRect)) {
          enemy.hp -= bullet.damage;
          enemy.hitT = 0.12;
          bullet.pos.y = -20; // remove
          if (enemy.hp <= 0) {
            this.score += 20;
            this.enemiesDestroyed++;
            // Dynamic drop chance
            if (Math.random() < this.getDropChance()) this.spawnPowerUp(enemy.pos.clone());
            enemy.pos.y = this.canvas.height + 100; // mark for removal
            this.services.audio.playSound('collision');
            this.spawnExplosion(enemy.pos.clone(), enemy.size, '#FCA5A5');
            this.addPopup('+20', enemy.pos.clone());
            this.addShake(0.25, 4);
          }
          break;
        }
      }
    }

    // Player vs enemy bullets
    for (const eb of this.enemyBullets) {
      const bRect = Rectangle.fromCenter(eb.pos, eb.size, eb.size);
      if (bRect.intersects(playerRect) && this.invulnTime <= 0) {
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
      if (bossRect.intersects(playerRect) && this.invulnTime <= 0) {
        this.damagePlayer(1);
      }
    }
  }

  private renderPlayer(ctx: CanvasRenderingContext2D): void {
    const alpha = this.invulnTime > 0 ? (Math.sin(this.gameTime * 20) > 0 ? 0.4 : 0.8) : 1;
    ctx.globalAlpha = alpha;
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
    ctx.globalAlpha = 1;
  }

  private renderBullets(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#FBBF24';
    for (const b of this.bullets) {
      ctx.fillRect(b.pos.x - 2, b.pos.y - 8, 4, 8);
    }
  }

  private renderEnemies(ctx: CanvasRenderingContext2D): void {
    for (const e of this.enemies) {
      // Color by type for readability
      if (e.type === 'basic') ctx.fillStyle = '#EF4444';
      else if (e.type === 'sine') ctx.fillStyle = '#F97316';
      else if (e.type === 'shooter') ctx.fillStyle = '#F59E0B';
      else if (e.type === 'diver') ctx.fillStyle = '#10B981';
      else if (e.type === 'spinner') ctx.fillStyle = '#22C55E';
      else if (e.type === 'tanker') ctx.fillStyle = '#93C5FD';
      else ctx.fillStyle = '#EF4444';

      ctx.beginPath();
      ctx.moveTo(e.pos.x, e.pos.y - e.size / 2);
      ctx.lineTo(e.pos.x - e.size / 2, e.pos.y + e.size / 2);
      ctx.lineTo(e.pos.x + e.size / 2, e.pos.y + e.size / 2);
      ctx.closePath();
      ctx.fill();
      if (e.hitT && e.hitT > 0) {
        ctx.strokeStyle = 'rgba(255,255,255,0.8)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
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
      this.invulnTime = 1.0;
      this.spawnExplosion(this.player.clone(), 28, '#93C5FD');
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
    this.powerupsCollected++; // track for achievements
    this.services.audio.playSound('powerup');
    this.services.analytics.trackGameAction({ type: 'powerup', timestamp: new Date(), metadata: { game: 'space', kind } });
    switch (kind) {
      case 'shield':
        this.playerShield = Math.min(3, this.playerShield + 2);
        break;
      case 'spread':
        this.weaponLevel = Math.min(3, this.weaponLevel + 1) as 1 | 2 | 3;
        break;
      case 'heal':
        this.playerHp = Math.min(3, this.playerHp + 1);
        break;
      case 'score':
        this.score += 50;
        break;
    }
  }

  private buildStage(): void {
    // Generate 5 waves for the current stage based on unlocked types
    this.waves = [];
    this.waveIndex = 0;
    this.levelTime = 0;
    let t = 1.0;
    const pushWave = (entry: Omit<WaveEntry, 't'>, delay: number) => {
      this.waves.push({ t, ...entry });
      t += delay;
    };

    // Compose waves: mix unlocked types and add at least one formation after stage 2
    const pickType = (): WaveEntry['type'] => {
      const pool = [...this.unlockedTypes];
      return pool[Math.floor(Math.random() * pool.length)];
    };

    for (let w = 0; w < 5; w++) {
      const type = pickType();
      if (type === 'formation') {
        // formation wave
        pushWave({ count: 8, type: 'formation', speed: 70 + this.stage * 5, size: 22, pattern: (this.stage % 2 === 0 ? 'v' : 'wedge') }, 5);
      } else {
        const pattern: WaveEntry['pattern'] = (w % 2 === 0 ? 'arc' : 'line');
        pushWave({ count: 6 + Math.floor(this.stage / 2), type: type as Enemy['type'], speed: 60 + w * 5, size: 24, pattern }, 4);
      }
    }
  }

  private spawnWave(w: WaveEntry): void {
    const width = this.canvas.width;
    const margin = 30;
    const create = (x: number) =>
      this.enemies.push({
        pos: new Vector2(x, -w.size),
        speed: w.speed,
        size: w.size,
        hp: Math.max(1, Math.ceil((w.size / 14) * this.getHpScale())),
        type: (w.type as Enemy['type']) || 'basic',
        t: 0,
      });

    if (w.type === 'formation') {
      this.spawnFormationWave(w);
    } else if (w.pattern === 'line') {
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
      // Stage-based timing scale (slower early, faster later)
      const rate = Math.max(0.7, 1 - (this.stage - 1) * 0.1);
      if (this.boss.phase === 1) {
        // Targeted shots
        if (this.boss.t > 0.9 / rate) {
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
        if (this.boss.t > 1.2 / rate) {
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
        if (this.boss.t > 0.6 / rate) {
          this.boss.t = 0;
          for (let i = 0; i < 8; i++) {
            const x = (i + 0.5) * (this.canvas.width / 8);
            this.enemyBullets.push({ pos: new Vector2(x, this.boss.pos.y + this.boss.height / 2), vx: 0, vy: 220, size: 6, damage: 1 });
          }
        }
      }
      return;
    }

    // Boss after every 5 waves
    const allWavesSpawned = this.waveIndex >= this.waves.length;
    if (
      !this.levelCompleted &&
      allWavesSpawned &&
      this.enemies.length === 0 &&
      this.enemyBullets.length === 0 &&
      this.wavesSinceBoss >= 5
    ) {
      this.startBoss();
    }
  }

  private startBoss(): void {
    const baseHp = 90 + (this.stage - 1) * 30;
    this.boss = {
      pos: new Vector2(this.canvas.width / 2, 120),
      width: 160,
      height: 60,
      hp: baseHp,
      maxHp: baseHp,
      phase: 1,
      t: 0,
    };
    this.services.analytics.trackFeatureUsage('space_boss_start', { level: 1 });
    this.showBanner('Boss Approaching');
  }

  private onBossDefeated(): void {
    if (!this.boss) return;
    this.score += 500;
    this.bossesDefeated++;
    this.services.audio.playSound('success');
    this.services.analytics.trackFeatureUsage('space_boss_defeated', { level: 1 });
    this.boss = null;
    this.levelCompleted = true;

    // End game as completed after a short celebration window
    // Reuse BaseGame endGame with 'completed' outcome via analytics track in BaseGame
    setTimeout(() => {
      // Stage progression: unlock next type/pattern and build next stage
      this.advanceStage();
      this.levelCompleted = false;
    }, 500);
  }

  protected onRenderUI?(ctx: CanvasRenderingContext2D): void {
    // Extend UI: health, shield, weapon, wave indicator
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`HP: ${this.playerHp}`, 20, this.canvas.height - 50);
    ctx.fillText(`Shield: ${this.playerShield}`, 20, this.canvas.height - 30);
    ctx.fillText(`Weapon: ${this.weaponLevel}x`, 160, this.canvas.height - 30);
    ctx.fillText(`Stage: ${this.stage}`, 260, this.canvas.height - 30);
    const waveText = this.waveIndex < this.waves.length ? `Wave ${this.waveIndex + 1}/5` : (this.boss ? 'Boss Fight' : this.levelCompleted ? 'Stage Clear!' : '');
    if (waveText) {
      ctx.textAlign = 'center';
      ctx.fillText(waveText, this.canvas.width / 2, 40);
    }
  }

  private spawnFormationWave(w: WaveEntry): void {
    const formationId = this.nextFormationId++;
    const count = w.count;
    const spacing = 36;
    const centerX = this.canvas.width / 2;
    const topY = -w.size * 2;
    const shape: Formation['shape'] = (w.pattern === 'v' ? 'v' : w.pattern === 'wedge' ? 'wedge' : 'line');
    const members: Enemy[] = [];

    const offsets: Vector2[] = [];
    if (shape === 'line') {
      for (let i = 0; i < count; i++) offsets.push(new Vector2((i - (count - 1) / 2) * spacing, 0));
    } else if (shape === 'v') {
      for (let i = 0; i < count; i++) {
        const side = i % 2 === 0 ? -1 : 1;
        const step = Math.floor(i / 2) + 1;
        offsets.push(new Vector2(side * step * spacing * 0.7, step * spacing * 0.5));
      }
    } else if (shape === 'wedge') {
      for (let i = 0; i < count; i++) {
        const row = Math.floor(i / 3);
        const col = (i % 3) - 1;
        offsets.push(new Vector2(col * spacing, row * spacing * 0.7));
      }
    }

    offsets.forEach((off) => {
      const enemy: Enemy = {
        pos: new Vector2(centerX + off.x, topY + off.y),
        speed: w.speed,
        size: w.size,
        hp: Math.max(1, Math.ceil((w.size / 16) * this.getHpScale())),
        type: 'basic',
        t: 0,
        formationId,
        offset: off,
      };
      this.enemies.push(enemy);
      members.push(enemy);
    });

    // Side entry chance
    const sideEntry = this.stage >= 2 && Math.random() < 0.5 ? (Math.random() < 0.5 ? 'left' : 'right') : undefined;
    const startX = sideEntry === 'left' ? -80 : sideEntry === 'right' ? this.canvas.width + 80 : centerX;
    const vx = sideEntry ? (sideEntry === 'left' ? 120 : -120) : 60 + this.stage * 10;
    const vy = 40 + this.stage * 5;
    this.formations.push({ id: formationId, anchor: new Vector2(startX, topY), vx, vy, t: 0, members, shape, sideEntry });
  }

  private updateFormations(dt: number): void {
    for (const f of this.formations) {
      f.t += dt;
      // Move anchor; if side entry, traverse across then oscillate
      f.anchor.y += (f.vy || 30) * dt;
      if (f.sideEntry && f.t < 2.0) {
        f.anchor.x += f.vx * dt;
      } else {
        const oscillate = Math.sin(f.t * 1.2) * Math.abs(f.vx);
        f.anchor.x = this.canvas.width / 2 + oscillate;
      }

      // Update members to follow anchor plus offset; occasional swoop
      for (const m of f.members) {
        if (!this.enemies.includes(m)) continue;
        const target = new Vector2(f.anchor.x + (m.offset?.x || 0), f.anchor.y + (m.offset?.y || 0));
        const dir = target.subtract(m.pos).normalize();
        m.pos.x += dir.x * Math.max(60, m.speed) * dt;
        m.pos.y += dir.y * Math.max(60, m.speed) * dt;

        // Split-and-swoop event after a few seconds, else rare swoop
        if (f.t > 4 && Math.random() < 0.005) {
          m.formationId = undefined;
          m.type = 'diver';
          m.speed *= 1.2;
        } else if (Math.random() < 0.002 && m.pos.y > 40) {
          const p = this.player.clone();
          const d = p.subtract(m.pos).normalize();
          m.pos.x += d.x * 140 * dt;
          m.pos.y += d.y * 140 * dt;
        }
      }
      // After some time, increase descent for stack-and-descend feel
      if (f.t > 6 && f.vy && f.vy < 120) f.vy = Math.min(120, f.vy + 10 * dt);
    }

    // Cleanup formations with no members alive or offscreen
    this.formations = this.formations.filter((f) => {
      f.members = f.members.filter((m) => this.enemies.includes(m));
      return f.members.length > 0 && f.anchor.y < this.canvas.height + 80;
    });
  }

  private advanceStage(): void {
    // Unlock a new type/pattern after each boss
    this.stage += 1;
    this.wavesSinceBoss = 0;

    const unlockOrder: Array<WaveEntry['type']> = ['sine', 'shooter', 'formation', 'diver', 'spinner', 'tanker'];
    const next = unlockOrder.find((t) => !this.unlockedTypes.includes(t));
    if (next) this.unlockedTypes.push(next);

    // Rebuild next stage waves
    this.buildStage();
  }

  private getHpScale(): number {
    // Easier early game, scales up slowly with stage
    if (this.stage <= 1) return 0.8;
    if (this.stage === 2) return 0.9;
    return 1 + (this.stage - 2) * 0.1;
  }

  private getDropChance(): number {
    // Base 12%, plus 5% per missing HP (up to +10%), plus small stage bonus up to +5%
    const hpBonus = Math.max(0, (3 - this.playerHp)) * 0.05; // 0..0.15
    const stageBonus = Math.min(0.05, (this.stage - 1) * 0.01);
    return Math.min(0.3, 0.12 + hpBonus + stageBonus);
  }

  // FX helpers
  private addShake(time: number, magnitude: number): void {
    this.shakeTime = Math.max(this.shakeTime, time);
    this.shakeMag = Math.max(this.shakeMag, magnitude);
  }

  private spawnExplosion(center: Vector2, size: number, color: string): void {
    const count = Math.min(24, Math.max(12, Math.floor(size / 2)));
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = 60 + Math.random() * 140;
      this.particles.push({
        pos: center.clone(),
        vel: new Vector2(Math.cos(angle) * spd, Math.sin(angle) * spd),
        life: 0.6 + Math.random() * 0.4,
        color,
        size: 2 + Math.random() * 3,
      });
    }
  }

  private addPopup(text: string, pos: Vector2): void {
    this.popups.push({ text, pos, life: 0.8 });
  }

  private showBanner(text: string): void {
    this.bannerText = text;
    this.bannerTime = 2.0;
  }

  private updateParticles(dt: number): void {
    for (const p of this.particles) {
      p.pos.x += p.vel.x * dt;
      p.pos.y += p.vel.y * dt;
      p.life -= dt;
      p.vel.x *= 0.98;
      p.vel.y += 20 * dt; // slight gravity
    }
    this.particles = this.particles.filter((p) => p.life > 0).slice(-200);
    for (const s of this.popups) {
      s.pos.y -= 20 * dt;
      s.life -= dt;
    }
    this.popups = this.popups.filter((s) => s.life > 0);
  }

  protected onGameEnd(finalScore: any): void {
    const survivalTimeSeconds = Math.floor((Date.now() - this.startTime) / 1000);
    
    // Store extended achievement data that will be picked up by getScore()
    this.extendedGameData = {
      waves_completed: this.waveIndex,
      bosses_defeated: this.bossesDefeated || 0,
      max_stage: this.stage,
      enemies_destroyed: this.enemiesDestroyed || 0,
      powerups_collected: this.powerupsCollected || 0,
      survival_time: survivalTimeSeconds
    };

    // Track analytics for game-specific achievements
    this.services.analytics.trackGameSpecificStat(this.manifest.id, 'waves_completed', this.waveIndex);
    this.services.analytics.trackGameSpecificStat(this.manifest.id, 'bosses_defeated', this.bossesDefeated || 0);
    this.services.analytics.trackGameSpecificStat(this.manifest.id, 'max_stage', this.stage);
    this.services.analytics.trackGameSpecificStat(this.manifest.id, 'enemies_destroyed', this.enemiesDestroyed || 0);
    this.services.analytics.trackGameSpecificStat(this.manifest.id, 'powerups_collected', this.powerupsCollected || 0);
    this.services.analytics.trackGameSpecificStat(this.manifest.id, 'survival_time', survivalTimeSeconds);

    // Call parent which will handle the final scoring and Hub callback
    super.onGameEnd?.(finalScore);
  }
}
