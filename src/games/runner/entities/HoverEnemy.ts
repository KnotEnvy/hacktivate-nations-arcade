import { Vector2, Rectangle } from '@/games/shared/utils/Vector2';

export class HoverEnemy {
  position: Vector2;
  velocity: Vector2;
  size: Vector2;

  private bobOffset = 0;
  private bobSpeed = 3;

  constructor(x: number, y: number) {
    this.position = new Vector2(x, y);
    this.velocity = new Vector2(-180, 0);
    this.size = new Vector2(32, 24);
  }

  update(dt: number, gameSpeed: number): void {
    this.velocity.x = -180 * gameSpeed;
    this.position = this.position.add(this.velocity.multiply(dt));

    this.bobOffset = Math.sin((Date.now() / 1000) * this.bobSpeed) * 5;
  }

  render(ctx: CanvasRenderingContext2D): void {
    const renderY = this.position.y + this.bobOffset;
    ctx.save();
    ctx.translate(this.position.x + this.size.x / 2, renderY + this.size.y / 2);

    ctx.fillStyle = '#4B5563';
    ctx.fillRect(-this.size.x / 2, -this.size.y / 2, this.size.x, this.size.y);

    ctx.fillStyle = '#F87171';
    ctx.fillRect(6 - this.size.x / 2, -2, 4, 4);
    ctx.fillRect(this.size.x / 2 - 10, -2, 4, 4);

    ctx.restore();
  }

  getBounds(): Rectangle {
    return new Rectangle(
      this.position.x,
      this.position.y + this.bobOffset,
      this.size.x,
      this.size.y,
    );
  }

  isOffScreen(): boolean {
    return this.position.x + this.size.x < 0;
  }
}
