// Manages boss appearances. First boss doesn't spawn until the player has
// cleared at least one section; after that, a weighted picker chooses between
// Bomb Chopper, Tank, and Drone Swarm each cycle. Active bombs/shells/drones
// are owned here so collisions can be resolved by SpeedRacerGame in one place.

import { BombChopper, Bomb, type ChopperDirection } from '../entities/BombChopper';
import { Tank, TankShell, Drone, spawnDroneSwarm, spawnTank } from '../entities/BossEnemies';
import type { RoadProfile } from './RoadProfile';

const FIRST_BOSS_DELAY = 14;          // seconds after sectionsCleared >= 1
const COOLDOWN_MIN = 38;
const COOLDOWN_MAX = 58;

type BossKind = 'chopper' | 'tank' | 'drones';

// Per-section boss weights — tuned so each terrain has a signature threat.
// Order matches the picker: [chopper, drones, tank]. Sections not listed fall
// back to DEFAULT_BOSS_WEIGHTS (the v3 baseline).
const DEFAULT_BOSS_WEIGHTS: readonly [number, number, number] = [0.45, 0.3, 0.25];
const BOSS_WEIGHTS_BY_SECTION: Record<string, readonly [number, number, number]> = {
  'harbor-run': [0.6, 0.3, 0.1],  // chopper-heavy — air strikes over water read well
  'alpine-pass': [0.25, 0.2, 0.55], // tank-heavy — mountain road corridors favor tanks
  'steel-span': [0.45, 0.3, 0.25],  // balanced baseline (explicit for clarity)
};

export class BossSpawner {
  private choppers: BombChopper[] = [];
  private bombs: Bomb[] = [];
  private tanks: Tank[] = [];
  private shells: TankShell[] = [];
  private drones: Drone[] = [];
  private cooldown = FIRST_BOSS_DELAY;
  private bossesSpawned = 0;
  private roadProfile: RoadProfile;

  constructor(roadProfile: RoadProfile) {
    this.roadProfile = roadProfile;
  }

  reset(): void {
    this.choppers.length = 0;
    this.bombs.length = 0;
    this.tanks.length = 0;
    this.shells.length = 0;
    this.drones.length = 0;
    this.cooldown = FIRST_BOSS_DELAY;
    this.bossesSpawned = 0;
  }

  update(
    dt: number,
    sectionsCleared: number,
    playerX: number,
    playerY: number,
    playerSpeed: number,
    sectionId: string,
  ): void {
    if (sectionsCleared >= 1) {
      this.cooldown -= dt;
      if (this.cooldown <= 0 && this.isClearOfBosses()) {
        this.spawnBoss(playerX, sectionId);
        this.cooldown = COOLDOWN_MIN + Math.random() * (COOLDOWN_MAX - COOLDOWN_MIN);
      }
    }

    for (const chopper of this.choppers) {
      chopper.update(dt, (bx, by) => this.dropBomb(bx, by, playerX));
    }
    this.choppers = this.choppers.filter((c) => c.alive);

    for (const bomb of this.bombs) bomb.update(dt);
    this.bombs = this.bombs.filter((b) => b.isAlive());

    for (const tank of this.tanks) {
      tank.update(dt, playerSpeed, playerX, playerY, (sx, sy) => this.fireShell(sx, sy));
    }
    this.tanks = this.tanks.filter((t) => t.alive);

    for (const shell of this.shells) shell.update(dt);
    this.shells = this.shells.filter((s) => s.alive);

    for (const drone of this.drones) drone.update(dt, playerX, playerY);
    this.drones = this.drones.filter((d) => d.alive);
  }

  private isClearOfBosses(): boolean {
    return (
      this.choppers.every((c) => !c.alive) &&
      this.tanks.every((t) => !t.alive) &&
      this.drones.every((d) => !d.alive)
    );
  }

  private spawnBoss(playerX: number, sectionId: string): void {
    // First boss is always a chopper (already established in v2).
    // After that, section-weighted pick: [chopper, drones, tank].
    let kind: BossKind = 'chopper';
    if (this.bossesSpawned > 0) {
      const weights = BOSS_WEIGHTS_BY_SECTION[sectionId] ?? DEFAULT_BOSS_WEIGHTS;
      const total = weights[0] + weights[1] + weights[2];
      let r = Math.random() * total;
      r -= weights[0];
      if (r <= 0) kind = 'chopper';
      else {
        r -= weights[1];
        kind = r <= 0 ? 'drones' : 'tank';
      }
    }
    this.bossesSpawned += 1;

    if (kind === 'chopper') {
      const direction: ChopperDirection = playerX > 200 ? 'left-to-right' : 'right-to-left';
      this.choppers.push(new BombChopper(direction));
    } else if (kind === 'tank') {
      this.tanks.push(spawnTank(this.roadProfile));
    } else {
      this.drones.push(...spawnDroneSwarm(this.roadProfile));
    }
  }

  private dropBomb(startX: number, startY: number, playerX: number): void {
    const lead = (Math.random() - 0.5) * 40;
    const targetX = Math.max(80, Math.min(320, playerX + lead));
    const targetY = 360;
    this.bombs.push(new Bomb(startX, startY, targetX, targetY));
  }

  private fireShell(x: number, y: number): void {
    this.shells.push(new TankShell(x, y));
  }

  getChoppers(): BombChopper[] {
    return this.choppers;
  }

  getBombs(): Bomb[] {
    return this.bombs;
  }

  getTanks(): Tank[] {
    return this.tanks;
  }

  getShells(): TankShell[] {
    return this.shells;
  }

  getDrones(): Drone[] {
    return this.drones;
  }

  render(ctx: CanvasRenderingContext2D): void {
    for (const bomb of this.bombs) bomb.render(ctx);
    for (const chopper of this.choppers) chopper.render(ctx);
    for (const tank of this.tanks) tank.render(ctx);
    for (const shell of this.shells) shell.render(ctx);
    for (const drone of this.drones) drone.render(ctx);
  }
}
