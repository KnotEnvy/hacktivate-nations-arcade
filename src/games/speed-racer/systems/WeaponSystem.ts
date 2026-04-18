import { Projectile } from '../entities/Projectile';
import { PLAYER } from '../data/constants';

const FIRE_COOLDOWN = 0.085;
const BULLET_SPEED = 950;
const BARREL_OFFSET_X = 12;

export class WeaponSystem {
  private projectiles: Projectile[] = [];
  private fireCooldown = 0;
  private shotsFired = 0;

  reset(): void {
    this.projectiles = [];
    this.fireCooldown = 0;
    this.shotsFired = 0;
  }

  update(dt: number, firing: boolean, playerX: number, playerY: number): boolean {
    let fired = false;
    this.fireCooldown -= dt;
    if (firing && this.fireCooldown <= 0) {
      const muzzleY = playerY - PLAYER.HEIGHT / 2 - 8;
      this.projectiles.push(
        new Projectile(playerX - BARREL_OFFSET_X, muzzleY, -BULLET_SPEED, 'player'),
      );
      this.projectiles.push(
        new Projectile(playerX + BARREL_OFFSET_X, muzzleY, -BULLET_SPEED, 'player'),
      );
      this.fireCooldown = FIRE_COOLDOWN;
      this.shotsFired++;
      fired = true;
    }

    for (const p of this.projectiles) p.update(dt);
    this.projectiles = this.projectiles.filter((p) => p.alive);

    return fired;
  }

  render(ctx: CanvasRenderingContext2D): void {
    for (const p of this.projectiles) p.render(ctx);
  }

  getProjectiles(): Projectile[] {
    return this.projectiles;
  }
}
