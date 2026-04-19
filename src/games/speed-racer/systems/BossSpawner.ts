// Manages Bomb Chopper boss appearances. Chopper does not spawn until the
// player has cleared at least one section, then re-appears on a randomized
// cooldown. Active bombs are owned here so collisions can be resolved by
// SpeedRacerGame in one place.

import { BombChopper, Bomb, type ChopperDirection } from '../entities/BombChopper';

const FIRST_CHOPPER_DELAY = 14;       // seconds after sectionsCleared >= 1
const COOLDOWN_MIN = 38;
const COOLDOWN_MAX = 58;

export class BossSpawner {
  private choppers: BombChopper[] = [];
  private bombs: Bomb[] = [];
  private cooldown = FIRST_CHOPPER_DELAY;

  reset(): void {
    this.choppers.length = 0;
    this.bombs.length = 0;
    this.cooldown = FIRST_CHOPPER_DELAY;
  }

  update(dt: number, sectionsCleared: number, playerX: number): void {
    if (sectionsCleared >= 1) {
      this.cooldown -= dt;
      if (this.cooldown <= 0 && this.choppers.every((c) => !c.alive)) {
        this.spawnChopper(playerX);
        this.cooldown = COOLDOWN_MIN + Math.random() * (COOLDOWN_MAX - COOLDOWN_MIN);
      }
    }

    for (const chopper of this.choppers) {
      chopper.update(dt, (bx, by) => this.dropBomb(bx, by, playerX));
    }
    this.choppers = this.choppers.filter((c) => c.alive);

    for (const bomb of this.bombs) bomb.update(dt);
    this.bombs = this.bombs.filter((b) => b.isAlive());
  }

  private spawnChopper(playerX: number): void {
    // Enter from the side opposite the player so the chopper crosses the screen
    const direction: ChopperDirection = playerX > 200 ? 'left-to-right' : 'right-to-left';
    this.choppers.push(new BombChopper(direction));
  }

  private dropBomb(startX: number, startY: number, playerX: number): void {
    // Aim slightly ahead/at the player's CURRENT x — bomb won't track after release,
    // giving the player a chance to dodge by changing lanes.
    const lead = (Math.random() - 0.5) * 40;
    const targetX = Math.max(80, Math.min(320, playerX + lead));
    const targetY = 360; // road area
    this.bombs.push(new Bomb(startX, startY, targetX, targetY));
  }

  getChoppers(): BombChopper[] {
    return this.choppers;
  }

  getBombs(): Bomb[] {
    return this.bombs;
  }

  render(ctx: CanvasRenderingContext2D): void {
    // Bombs first so chopper draws over reticles when overlapping
    for (const bomb of this.bombs) bomb.render(ctx);
    for (const chopper of this.choppers) chopper.render(ctx);
  }
}
