export type HazardType = 'oil' | 'smoke';

const LIFETIME: Record<HazardType, number> = {
  oil: 5.0,
  smoke: 3.0,
};

export class Hazard {
  x: number;
  y: number;
  vy = 0;
  alive = true;
  type: HazardType;
  age = 0;
  readonly width: number;
  readonly height: number;

  constructor(type: HazardType, x: number, y: number) {
    this.type = type;
    this.x = x;
    this.y = y;
    if (type === 'oil') {
      this.width = 70;
      this.height = 36;
    } else {
      this.width = 110;
      this.height = 90;
    }
  }

  update(dt: number, playerSpeed: number): void {
    // Hazards are "stuck to the ground" — they scroll with the road
    this.vy = playerSpeed;
    this.y += this.vy * dt;
    this.age += dt;
    if (this.age >= LIFETIME[this.type] || this.y > 720) this.alive = false;
  }

  getBounds(): { x: number; y: number; w: number; h: number } {
    return {
      x: this.x - this.width / 2,
      y: this.y - this.height / 2,
      w: this.width,
      h: this.height,
    };
  }

  render(ctx: CanvasRenderingContext2D): void {
    const lifeFrac = 1 - this.age / LIFETIME[this.type];
    if (this.type === 'oil') {
      ctx.save();
      ctx.fillStyle = `rgba(40,0,60,${0.85 * lifeFrac})`;
      ctx.beginPath();
      ctx.ellipse(this.x, this.y, this.width / 2, this.height / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      // Rainbow sheen
      ctx.fillStyle = `rgba(0,255,255,${0.35 * lifeFrac})`;
      ctx.beginPath();
      ctx.ellipse(this.x - 6, this.y - 4, this.width / 3, this.height / 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(255,20,147,${0.3 * lifeFrac})`;
      ctx.beginPath();
      ctx.ellipse(this.x + 8, this.y + 4, this.width / 4, this.height / 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else {
      // Smoke — soft gray puffs
      ctx.save();
      const baseAlpha = 0.55 * lifeFrac;
      const puffs = 5;
      for (let i = 0; i < puffs; i++) {
        const angle = (i / puffs) * Math.PI * 2;
        const r = (this.width / 2) * (0.5 + 0.4 * Math.sin(this.age * 1.4 + i));
        const px = this.x + Math.cos(angle) * 16;
        const py = this.y + Math.sin(angle) * 10;
        ctx.fillStyle = `rgba(180,180,200,${baseAlpha})`;
        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = `rgba(220,220,230,${baseAlpha * 0.8})`;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.width / 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}
