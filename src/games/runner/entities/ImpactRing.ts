// ===== src/games/runner/entities/ImpactRing.ts =====
export type ImpactRingType = 'jump' | 'land' | 'coin' | 'boss';

export class ImpactRing {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  life: number;
  maxLife: number;
  color: string;
  lineWidth: number;

  constructor(x: number, y: number, type: ImpactRingType) {
    this.x = x;
    this.y = y;
    this.life = this.maxLife = this.getLifeForType(type);
    this.radius = 5;
    this.maxRadius = this.getMaxRadiusForType(type);
    this.color = this.getColorForType(type);
    this.lineWidth = this.getLineWidthForType(type);
  }

  private getLifeForType(type: ImpactRingType): number {
    switch (type) {
      case 'jump': return 0.3;
      case 'land': return 0.4;
      case 'coin': return 0.35;
      case 'boss': return 0.6;
    }
  }

  private getMaxRadiusForType(type: ImpactRingType): number {
    switch (type) {
      case 'jump': return 30;
      case 'land': return 50;
      case 'coin': return 40;
      case 'boss': return 80;
    }
  }

  private getColorForType(type: ImpactRingType): string {
    switch (type) {
      case 'jump': return '#3B82F6'; // Blue
      case 'land': return '#FFFFFF'; // White
      case 'coin': return '#FCD34D'; // Gold
      case 'boss': return '#DC2626'; // Red
    }
  }

  private getLineWidthForType(type: ImpactRingType): number {
    switch (type) {
      case 'jump': return 2;
      case 'land': return 3;
      case 'coin': return 2;
      case 'boss': return 4;
    }
  }

  update(dt: number): boolean {
    this.life -= dt;
    const progress = 1 - (this.life / this.maxLife);
    this.radius = 5 + (this.maxRadius - 5) * this.easeOutQuad(progress);
    return this.life > 0;
  }

  private easeOutQuad(t: number): number {
    return t * (2 - t);
  }

  render(ctx: CanvasRenderingContext2D): void {
    const alpha = this.life / this.maxLife;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = this.color;
    ctx.lineWidth = this.lineWidth * alpha; // Thins as it fades
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}
