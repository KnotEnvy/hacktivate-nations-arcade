export type ProjectileOwner = 'player' | 'enemy';

export class Projectile {
  x: number;
  y: number;
  vy: number;
  alive = true;
  readonly width: number;
  readonly height: number;
  readonly damage: number;
  readonly owner: ProjectileOwner;

  constructor(x: number, y: number, vy: number, owner: ProjectileOwner = 'player', damage = 1) {
    this.x = x;
    this.y = y;
    this.vy = vy;
    this.owner = owner;
    this.damage = damage;
    this.width = owner === 'player' ? 4 : 5;
    this.height = owner === 'player' ? 14 : 12;
  }

  update(dt: number): void {
    this.y += this.vy * dt;
    if (this.y + this.height < -20 || this.y > 720) this.alive = false;
  }

  getBounds(): { x: number; y: number; w: number; h: number } {
    return {
      x: this.x - this.width / 2,
      y: this.y,
      w: this.width,
      h: this.height,
    };
  }

  render(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    if (this.owner === 'player') {
      ctx.shadowColor = '#FFFF00';
      ctx.shadowBlur = 10;
      ctx.fillStyle = '#FFFFAA';
    } else {
      ctx.shadowColor = '#FF3030';
      ctx.shadowBlur = 8;
      ctx.fillStyle = '#FF8888';
    }
    ctx.fillRect(this.x - this.width / 2, this.y, this.width, this.height);
    ctx.restore();
  }
}
