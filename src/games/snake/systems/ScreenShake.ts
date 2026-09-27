// ===== src/games/snake/systems/ScreenShake.ts =====
//
// A decaying board shake. The offset is a pair of incommensurate sines on
// the shake's own clock rather than Math.random, so two runs of the same
// inputs shake identically and a paused frame holds still.

export class ScreenShake {
  private intensity = 0;
  private duration = 0;
  private elapsed = 0;
  private clock = 0;
  private offsetX = 0;
  private offsetY = 0;

  /** Start a shake unless a stronger one is already running. */
  shake(intensity: number, duration: number): void {
    const current = this.currentIntensity();
    if (intensity < current) return;
    this.intensity = intensity;
    this.duration = duration;
    this.elapsed = 0;
  }

  update(dt: number): void {
    this.clock += dt;
    if (this.elapsed < this.duration) this.elapsed += dt;
    const amp = this.currentIntensity();
    if (amp <= 0) {
      this.offsetX = 0;
      this.offsetY = 0;
      return;
    }
    this.offsetX = amp * Math.sin(this.clock * 71.3);
    this.offsetY = amp * Math.cos(this.clock * 57.9 + 1.3);
  }

  getOffset(): { x: number; y: number } {
    return { x: this.offsetX, y: this.offsetY };
  }

  isShaking(): boolean {
    return this.currentIntensity() > 0;
  }

  stop(): void {
    this.intensity = 0;
    this.duration = 0;
    this.elapsed = 0;
    this.offsetX = 0;
    this.offsetY = 0;
  }

  private currentIntensity(): number {
    if (this.duration <= 0 || this.elapsed >= this.duration) return 0;
    const k = 1 - this.elapsed / this.duration;
    return this.intensity * k * k;
  }
}
