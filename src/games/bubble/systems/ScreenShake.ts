// ===== src/games/bubble/systems/ScreenShake.ts =====

export class ScreenShake {
  private intensity: number = 0;
  private duration: number = 0;
  private maxDuration: number = 0;
  private offsetX: number = 0;
  private offsetY: number = 0;

  public update(dt: number): void {
    if (this.duration > 0) {
      this.duration -= dt;

      // Calculate current shake intensity
      const progress = this.duration / this.maxDuration;
      const currentIntensity = this.intensity * progress;

      // Random offset
      this.offsetX = (Math.random() - 0.5) * 2 * currentIntensity;
      this.offsetY = (Math.random() - 0.5) * 2 * currentIntensity;
    } else {
      this.offsetX = 0;
      this.offsetY = 0;
    }
  }

  public shake(intensity: number, duration: number): void {
    // Only override if new shake is stronger
    if (intensity > this.intensity || this.duration <= 0) {
      this.intensity = intensity;
      this.duration = duration;
      this.maxDuration = duration;
    }
  }

  public getOffset(): { x: number; y: number } {
    return { x: this.offsetX, y: this.offsetY };
  }

  public isShaking(): boolean {
    return this.duration > 0;
  }

  public stop(): void {
    this.duration = 0;
    this.offsetX = 0;
    this.offsetY = 0;
  }
}
