import { EnemyCar, EnemyType, EnemyVisual } from '../entities/EnemyCar';
import { Civilian } from '../entities/Civilian';
import { Projectile } from '../entities/Projectile';
import { WeaponVan } from '../entities/WeaponVan';
import { pickRandomSecondary } from '../data/secondaryWeapons';
import type { RoadProfile } from './RoadProfile';

const SPAWN_Y = -80;

export interface SpawnerOptions {
  spawnInterval: number;
  enemyTypes: EnemyType[];
  enemyTypeWeights: number[];
  civilianChance: number; // 0..1 — probability that a spawn is a civilian instead of enemy
  civilianSpawnInterval: number; // independent civilian timer
  vanIntervalMin: number;
  vanIntervalMax: number;
  // Render mode for enemies — sections set this to 'jetboat' on water.
  // AI is unchanged; only the sprite differs.
  enemyVisual: EnemyVisual;
  // 0..1 — chance a freshly spawned shooter fires 3-shot bursts instead of
  // single shots. Gated by section so sections 1-2 stay single-shot.
  shooterBurstChance: number;
  // 0..1 — chance a spawn tick rolls a scripted formation (multiple enemies
  // spawned as a readable setpiece) instead of a single enemy. Formations
  // require ram/shooter/armored present at non-zero weight; they silently
  // fall back to a single spawn if the section doesn't allow them.
  formationChance: number;
}

const BURST_INTRA_COOLDOWN = 0.18; // seconds between shots inside a burst
const MAX_AIM_LEAD_VX = 200; // px/sec — caps bullet angle so leads don't look absurd

export class EnemySpawner {
  private enemies: EnemyCar[] = [];
  private civilians: Civilian[] = [];
  private projectiles: Projectile[] = [];
  private vans: WeaponVan[] = [];
  private spawnTimer = 0.8;
  private civTimer = 1.4;
  private vanTimer = 18;
  private roadProfile: RoadProfile;

  constructor(roadProfile: RoadProfile) {
    this.roadProfile = roadProfile;
  }
  private opts: SpawnerOptions = {
    spawnInterval: 1.6,
    enemyTypes: ['ram'],
    enemyTypeWeights: [1],
    civilianChance: 0,
    civilianSpawnInterval: 2.2,
    vanIntervalMin: 22,
    vanIntervalMax: 35,
    enemyVisual: 'car',
    shooterBurstChance: 0,
    formationChance: 0,
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
    // enemyVisual defaults back to 'car' on each section change unless the
    // section explicitly opts in. Otherwise advancing from HARBOR_RUN back to
    // a road section would inherit jetboat sprites. shooterBurstChance resets
    // for the same reason — otherwise a section without a bursts would
    // inherit the prior section's value.
    this.opts = {
      ...this.opts,
      enemyVisual: 'car',
      shooterBurstChance: 0,
      formationChance: 0,
      ...opts,
    };
  }

  // Arm an early van spawn (used by section-clear reward). Respects the
  // existing "one van on screen at a time" gate.
  scheduleVanIn(seconds: number): void {
    if (this.vanTimer > seconds) this.vanTimer = seconds;
  }

  update(
    dt: number,
    playerSpeed: number,
    playerX: number,
    playerY: number,
    playerVx: number,
  ): void {
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      const rollFormation =
        this.opts.formationChance > 0 && Math.random() < this.opts.formationChance;
      if (!rollFormation || !this.trySpawnFormation()) {
        this.trySpawnEnemy();
      }
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
        this.updateShooter(e, dt, playerX, playerY, playerVx);
      }
    }
    this.enemies = this.enemies.filter((e) => e.alive);

    for (const c of this.civilians) c.update(dt, playerSpeed);
    this.civilians = this.civilians.filter((c) => c.alive);

    for (const p of this.projectiles) p.update(dt);
    this.projectiles = this.projectiles.filter((p) => p.alive);
  }

  private updateShooter(
    e: EnemyCar,
    dt: number,
    playerX: number,
    playerY: number,
    playerVx: number,
  ): void {
    e.fireCooldown -= dt;
    if (e.fireCooldown > 0) return;

    const distY = playerY - e.y;
    // Out of range — skip unless mid-burst (commit to the burst once started
    // so the player can punish the whole sequence by dodging cleanly)
    const inRange = distY > 60 && distY < 520 && Math.abs(playerX - e.x) < 160;
    if (!inRange && e.shotsInBurst === 0) return;

    const bulletSpeed = e.config.bulletSpeed ?? 520;
    const muzzleY = e.y + e.config.height / 2 + 4;

    // Aim-lead: predict where the player will be when the bullet arrives,
    // then set bullet vx so it arrives there. Cap vx to avoid extreme angles.
    const timeToReach = Math.max(0.1, (playerY - muzzleY) / bulletSpeed);
    const predictedX = playerX + playerVx * timeToReach;
    let leadVx = (predictedX - e.x) / timeToReach;
    if (leadVx > MAX_AIM_LEAD_VX) leadVx = MAX_AIM_LEAD_VX;
    else if (leadVx < -MAX_AIM_LEAD_VX) leadVx = -MAX_AIM_LEAD_VX;

    this.projectiles.push(new Projectile(e.x, muzzleY, bulletSpeed, 'enemy', 1, leadVx));
    e.shotsInBurst += 1;

    if (e.shotsInBurst >= e.burstCount) {
      e.shotsInBurst = 0;
      e.fireCooldown = 1.4 + Math.random() * 0.8;
    } else {
      e.fireCooldown = BURST_INTRA_COOLDOWN;
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

  // Pick a (segment, local-lane) pair at the spawn row. In single-road
  // sections this collapses to "lane 0..N-1 across the whole road"; in fork
  // sections it picks a side first, then a lane within that side, so spawns
  // distribute evenly across both forks.
  private pickSpawnLane(): { x: number; laneWidth: number } {
    const shape = this.roadProfile.shapeAtScreen(SPAWN_Y);
    if (shape.segments && shape.segments.length > 0) {
      const seg = shape.segments[Math.floor(Math.random() * shape.segments.length)];
      const laneWidth = (seg.xMax - seg.xMin) / seg.laneCount;
      const lane = Math.floor(Math.random() * seg.laneCount);
      return { x: seg.xMin + laneWidth * (lane + 0.5), laneWidth };
    }
    const laneCount = this.roadProfile.laneCountAtScreen(SPAWN_Y);
    const laneWidth = (shape.xMax - shape.xMin) / laneCount;
    const lane = Math.floor(Math.random() * laneCount);
    return { x: this.roadProfile.laneCenterAtScreen(SPAWN_Y, lane), laneWidth };
  }

  private trySpawnEnemy(): void {
    for (let attempt = 0; attempt < 4; attempt++) {
      const { x, laneWidth } = this.pickSpawnLane();
      if (!this.isLaneBlocked(x, laneWidth)) {
        const type = this.pickType();
        const enemy = new EnemyCar(type, x, SPAWN_Y, this.roadProfile, this.opts.enemyVisual);
        if (type === 'shooter' && Math.random() < this.opts.shooterBurstChance) {
          enemy.burstCount = 3;
        }
        this.enemies.push(enemy);
        return;
      }
    }
  }

  // Scripted multi-enemy spawns. Returns false if the section doesn't allow
  // the formation's types or if any required lane is currently blocked — the
  // caller falls back to a single-enemy spawn in that case.
  private trySpawnFormation(): boolean {
    const hasType = (t: EnemyType): boolean => {
      const idx = this.opts.enemyTypes.indexOf(t);
      return idx >= 0 && this.opts.enemyTypeWeights[idx] > 0;
    };
    if (!hasType('ram')) return false;

    // Formations are authored for a single 4-lane road. Bail in fork sections
    // (segments present) and in any narrow stretch with fewer than 4 lanes.
    const shape = this.roadProfile.shapeAtScreen(SPAWN_Y);
    if (shape.segments) return false;
    const laneCount = this.roadProfile.laneCountAtScreen(SPAWN_Y);
    if (laneCount < 4) return false;
    const laneWidth = (shape.xMax - shape.xMin) / laneCount;
    const laneX = (lane: number): number => this.roadProfile.laneCenterAtScreen(SPAWN_Y, lane);

    type Slot = { x: number; y: number; type: EnemyType };
    let slots: Slot[];

    const which = Math.random() < 0.5 ? 'flanked_ram' : 'armored_corridor';
    if (which === 'flanked_ram') {
      if (!hasType('shooter')) return false;
      const ramLane = Math.random() < 0.5 ? 1 : 2;
      slots = [
        { x: laneX(0), y: SPAWN_Y - 60, type: 'shooter' },
        { x: laneX(3), y: SPAWN_Y - 60, type: 'shooter' },
        { x: laneX(ramLane), y: SPAWN_Y, type: 'ram' },
      ];
    } else {
      if (!hasType('armored')) return false;
      const armoredLane = Math.random() < 0.5 ? 1 : 2;
      const flankLeft = armoredLane === 1 ? 0 : 1;
      const flankRight = armoredLane === 1 ? 2 : 3;
      slots = [
        { x: laneX(armoredLane), y: SPAWN_Y - 40, type: 'armored' },
        { x: laneX(flankLeft), y: SPAWN_Y - 100, type: 'ram' },
        { x: laneX(flankRight), y: SPAWN_Y - 100, type: 'ram' },
      ];
    }

    for (const s of slots) {
      if (this.isLaneBlocked(s.x, laneWidth)) return false;
    }
    for (const s of slots) {
      this.enemies.push(new EnemyCar(s.type, s.x, s.y, this.roadProfile, this.opts.enemyVisual));
    }
    return true;
  }

  private trySpawnCivilian(): void {
    for (let attempt = 0; attempt < 4; attempt++) {
      const { x, laneWidth } = this.pickSpawnLane();
      if (!this.isLaneBlocked(x, laneWidth)) {
        this.civilians.push(new Civilian(x, SPAWN_Y, this.roadProfile));
        return;
      }
    }
  }

  private trySpawnVan(): void {
    // Vans spawn in middle lanes for easier docking. In fork sections, pick a
    // side first and put the van in that side's middle lane.
    const shape = this.roadProfile.shapeAtScreen(SPAWN_Y);
    let x: number;
    if (shape.segments && shape.segments.length > 0) {
      const seg = shape.segments[Math.floor(Math.random() * shape.segments.length)];
      const laneWidth = (seg.xMax - seg.xMin) / seg.laneCount;
      // Middle lane of the segment (or center if fewer than 3 lanes).
      let lane: number;
      if (seg.laneCount >= 3) {
        lane = 1 + Math.floor(Math.random() * (seg.laneCount - 2));
      } else {
        lane = Math.floor(seg.laneCount / 2);
      }
      x = seg.xMin + laneWidth * (lane + 0.5);
    } else {
      const laneCount = this.roadProfile.laneCountAtScreen(SPAWN_Y);
      let lane: number;
      if (laneCount >= 3) {
        lane = 1 + Math.floor(Math.random() * (laneCount - 2));
      } else {
        lane = Math.floor(laneCount / 2);
      }
      x = this.roadProfile.laneCenterAtScreen(SPAWN_Y, lane);
    }
    this.vans.push(new WeaponVan(x, SPAWN_Y - 60, pickRandomSecondary(), this.roadProfile));
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
