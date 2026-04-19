import { EnemyCar, EnemyType } from '../entities/EnemyCar';
import { Civilian } from '../entities/Civilian';
import { Projectile } from '../entities/Projectile';
import { WeaponVan } from '../entities/WeaponVan';
import { pickRandomSecondary } from '../data/secondaryWeapons';
import { ROAD } from '../data/constants';

const SPAWN_Y = -80;
const ENEMY_BULLET_SPEED = 520;

export interface SpawnerOptions {
  spawnInterval: number;
  enemyTypes: EnemyType[];
  enemyTypeWeights: number[];
  civilianChance: number; // 0..1 — probability that a spawn is a civilian instead of enemy
  civilianSpawnInterval: number; // independent civilian timer
  vanIntervalMin: number;
  vanIntervalMax: number;
}

export class EnemySpawner {
  private enemies: EnemyCar[] = [];
  private civilians: Civilian[] = [];
  private projectiles: Projectile[] = [];
  private vans: WeaponVan[] = [];
  private spawnTimer = 0.8;
  private civTimer = 1.4;
  private vanTimer = 18;
  private opts: SpawnerOptions = {
    spawnInterval: 1.6,
    enemyTypes: ['ram'],
    enemyTypeWeights: [1],
    civilianChance: 0,
    civilianSpawnInterval: 2.2,
    vanIntervalMin: 22,
    vanIntervalMax: 35,
  };

  reset(): void {
    this.enemies = [];
    this.civilians = [];
    this.projectiles = [];
    this.vans = [];
    this.spawnTimer = 0.8;
    this.civTimer = 1.4;
    this.vanTimer = 18;
  }

  configure(opts: Partial<SpawnerOptions>): void {
    this.opts = { ...this.opts, ...opts };
  }

  update(dt: number, playerSpeed: number, playerX: number, playerY: number): void {
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.trySpawnEnemy();
      this.spawnTimer = this.opts.spawnInterval;
    }

    this.civTimer -= dt;
    if (this.civTimer <= 0) {
      if (this.opts.civilianChance > 0 && Math.random() < this.opts.civilianChance) {
        this.trySpawnCivilian();
      }
      this.civTimer = this.opts.civilianSpawnInterval;
    }

    this.vanTimer -= dt;
    if (this.vanTimer <= 0 && this.vans.length === 0) {
      this.trySpawnVan();
      const range = this.opts.vanIntervalMax - this.opts.vanIntervalMin;
      this.vanTimer = this.opts.vanIntervalMin + Math.random() * range;
    }

    for (const v of this.vans) v.update(dt, playerSpeed);
    this.vans = this.vans.filter((v) => v.alive);

    for (const e of this.enemies) {
      e.update(dt, playerSpeed, playerX, playerY);
      if (e.config.type === 'shooter' && e.alive) {
        this.updateShooter(e, dt, playerX, playerY);
      }
    }
    this.enemies = this.enemies.filter((e) => e.alive);

    for (const c of this.civilians) c.update(dt, playerSpeed);
    this.civilians = this.civilians.filter((c) => c.alive);

    for (const p of this.projectiles) p.update(dt);
    this.projectiles = this.projectiles.filter((p) => p.alive);
  }

  private updateShooter(e: EnemyCar, dt: number, playerX: number, playerY: number): void {
    e.fireCooldown -= dt;
    const distY = playerY - e.y;
    // Only fire when ahead of and roughly in line with player
    if (e.fireCooldown <= 0 && distY > 60 && distY < 520 && Math.abs(playerX - e.x) < 80) {
      const muzzleY = e.y + e.config.height / 2 + 4;
      this.projectiles.push(new Projectile(e.x, muzzleY, ENEMY_BULLET_SPEED, 'enemy', 1));
      e.fireCooldown = 1.4 + Math.random() * 0.8;
    }
  }

  private isLaneBlocked(x: number, laneWidth: number): boolean {
    const enemyBlock = this.enemies.some((e) => {
      const dx = Math.abs(e.x - x);
      const dy = Math.abs(e.y - SPAWN_Y);
      return dx < laneWidth * 0.8 && dy < 180;
    });
    if (enemyBlock) return true;
    return this.civilians.some((c) => {
      const dx = Math.abs(c.x - x);
      const dy = Math.abs(c.y - SPAWN_Y);
      return dx < laneWidth * 0.8 && dy < 180;
    });
  }

  private trySpawnEnemy(): void {
    const laneWidth = ROAD.WIDTH / ROAD.LANE_COUNT;
    for (let attempt = 0; attempt < 4; attempt++) {
      const lane = Math.floor(Math.random() * ROAD.LANE_COUNT);
      const x = ROAD.X_MIN + laneWidth * (lane + 0.5);
      if (!this.isLaneBlocked(x, laneWidth)) {
        const type = this.pickType();
        this.enemies.push(new EnemyCar(type, x, SPAWN_Y));
        return;
      }
    }
  }

  private trySpawnCivilian(): void {
    const laneWidth = ROAD.WIDTH / ROAD.LANE_COUNT;
    for (let attempt = 0; attempt < 4; attempt++) {
      const lane = Math.floor(Math.random() * ROAD.LANE_COUNT);
      const x = ROAD.X_MIN + laneWidth * (lane + 0.5);
      if (!this.isLaneBlocked(x, laneWidth)) {
        this.civilians.push(new Civilian(x, SPAWN_Y));
        return;
      }
    }
  }

  private trySpawnVan(): void {
    // Vans spawn in middle two lanes for easier docking
    const laneWidth = ROAD.WIDTH / ROAD.LANE_COUNT;
    const lane = 1 + Math.floor(Math.random() * (ROAD.LANE_COUNT - 2));
    const x = ROAD.X_MIN + laneWidth * (lane + 0.5);
    this.vans.push(new WeaponVan(x, SPAWN_Y - 60, pickRandomSecondary()));
  }

  private pickType(): EnemyType {
    const total = this.opts.enemyTypeWeights.reduce((s, w) => s + w, 0);
    let r = Math.random() * total;
    for (let i = 0; i < this.opts.enemyTypes.length; i++) {
      r -= this.opts.enemyTypeWeights[i];
      if (r <= 0) return this.opts.enemyTypes[i];
    }
    return this.opts.enemyTypes[0];
  }

  render(ctx: CanvasRenderingContext2D): void {
    for (const v of this.vans) v.render(ctx);
    for (const c of this.civilians) c.render(ctx);
    for (const e of this.enemies) e.render(ctx);
    for (const p of this.projectiles) p.render(ctx);
  }

  getEnemies(): EnemyCar[] {
    return this.enemies;
  }

  getCivilians(): Civilian[] {
    return this.civilians;
  }

  getProjectiles(): Projectile[] {
    return this.projectiles;
  }

  getVans(): WeaponVan[] {
    return this.vans;
  }
}
