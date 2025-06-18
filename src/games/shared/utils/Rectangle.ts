// ===== src/games/shared/utils/Rectangle.ts =====
import { Vector2 } from './Vector2';

export class Rectangle {
  constructor(
    public x: number,
    public y: number,
    public width: number,
    public height: number
  ) {}

  get left(): number { return this.x; }
  get right(): number { return this.x + this.width; }
  get top(): number { return this.y; }
  get bottom(): number { return this.y + this.height; }

  get center(): Vector2 {
    return new Vector2(
      this.x + this.width / 2,
      this.y + this.height / 2
    );
  }

  contains(point: Vector2): boolean {
    return point.x >= this.left && 
           point.x <= this.right && 
           point.y >= this.top && 
           point.y <= this.bottom;
  }

  intersects(other: Rectangle): boolean {
    return this.left < other.right &&
           this.right > other.left &&
           this.top < other.bottom &&
           this.bottom > other.top;
  }

  static fromCenter(center: Vector2, width: number, height: number): Rectangle {
    return new Rectangle(
      center.x - width / 2,
      center.y - height / 2,
      width,
      height
    );
  }
}
