export class CameraShake {
  private trauma = 0;
  private offsetX = 0;
  private offsetY = 0;

  reset(): void {
    this.trauma = 0;
    this.offsetX = 0;
    this.offsetY = 0;
  }

  add(amount: number): void {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  update(dt: number): void {
    if (this.trauma > 0) {
      const intensity = this.trauma * this.trauma;
      this.offsetX = (Math.random() - 0.5) * 18 * intensity;
      this.offsetY = (Math.random() - 0.5) * 18 * intensity;
      this.trauma = Math.max(0, this.trauma - dt * 1.4);
    } else {
      this.offsetX = 0;
      this.offsetY = 0;
    }
  }

  apply(ctx: CanvasRenderingContext2D): void {
    if (this.offsetX || this.offsetY) {
      ctx.translate(this.offsetX, this.offsetY);
    }
  }

  getOffset(): { x: number; y: number } {
    return { x: this.offsetX, y: this.offsetY };
  }
}
