import { Hazard } from '../entities/Hazard';
import { Missile } from '../entities/Missile';
import { SECONDARY_CONFIGS, SecondaryWeaponType } from '../data/secondaryWeapons';

export interface FireResult {
  fired: boolean;
  missile?: Missile;
  hazard?: Hazard;
}

export class SecondaryWeaponSystem {
  active: SecondaryWeaponType | null = null;
  ammo = 0;
  cooldown = 0;
  private missiles: Missile[] = [];
  private hazards: Hazard[] = [];
  totalUsed = 0;

  reset(): void {
    this.active = null;
    this.ammo = 0;
    this.cooldown = 0;
    this.missiles = [];
    this.hazards = [];
    this.totalUsed = 0;
  }

  equip(type: SecondaryWeaponType): void {
    const cfg = SECONDARY_CONFIGS[type];
    this.active = type;
    this.ammo = cfg.ammo;
    this.cooldown = 0;
  }

  canFire(): boolean {
    return this.active !== null && this.ammo > 0 && this.cooldown <= 0;
  }

  // Returns the spawned projectile/hazard so the game can place it correctly
  fire(playerX: number, playerY: number, playerHeight: number): FireResult {
    if (!this.canFire() || this.active === null) return { fired: false };
    const cfg = SECONDARY_CONFIGS[this.active];
    this.cooldown = cfg.cooldown;
    this.ammo -= 1;
    this.totalUsed += 1;
    const result: FireResult = { fired: true };

    if (this.active === 'missile') {
      const m = new Missile(playerX, playerY - playerHeight / 2 - 6);
      this.missiles.push(m);
      result.missile = m;
    } else if (this.active === 'oil') {
      const h = new Hazard('oil', playerX, playerY + playerHeight / 2 + 30);
      this.hazards.push(h);
      result.hazard = h;
    } else if (this.active === 'smoke') {
      const h = new Hazard('smoke', playerX, playerY + playerHeight / 2 + 50);
      this.hazards.push(h);
      result.hazard = h;
    }

    if (this.ammo <= 0) {
      this.active = null;
    }
    return result;
  }

  update(dt: number, playerSpeed: number): void {
    if (this.cooldown > 0) this.cooldown = Math.max(0, this.cooldown - dt);
    for (const m of this.missiles) m.update(dt);
    this.missiles = this.missiles.filter((m) => m.alive);
    for (const h of this.hazards) h.update(dt, playerSpeed);
    this.hazards = this.hazards.filter((h) => h.alive);
  }

  render(ctx: CanvasRenderingContext2D): void {
    // Hazards render below cars; missiles above
    for (const h of this.hazards) h.render(ctx);
    for (const m of this.missiles) m.render(ctx);
  }

  getMissiles(): Missile[] {
    return this.missiles;
  }

  getHazards(): Hazard[] {
    return this.hazards;
  }
}
