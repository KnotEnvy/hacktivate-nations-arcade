// ===== src/games/shared/utils/Vector2.ts =====
export class Vector2 {
  constructor(public x: number = 0, public y: number = 0) {}

  static zero(): Vector2 {
    return new Vector2(0, 0);
  }

  static one(): Vector2 {
    return new Vector2(1, 1);
  }

  add(other: Vector2): Vector2 {
    return new Vector2(this.x + other.x, this.y + other.y);
  }

  subtract(other: Vector2): Vector2 {
    return new Vector2(this.x - other.x, this.y - other.y);
  }

  multiply(scalar: number): Vector2 {
    return new Vector2(this.x * scalar, this.y * scalar);
  }

  magnitude(): number {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  }

  normalize(): Vector2 {
    const mag = this.magnitude();
    if (mag === 0) return Vector2.zero();
    return new Vector2(this.x / mag, this.y / mag);
  }

  distance(other: Vector2): number {
    return this.subtract(other).magnitude();
  }

  clone(): Vector2 {
    return new Vector2(this.x, this.y);
  }
}

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
