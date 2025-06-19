// ===== src/games/runner/systems/ScreenShake.ts =====
export class ScreenShake {
  private intensity: number = 0;
  private duration: number = 0;
  private maxDuration: number = 0;
  
  shake(intensity: number, duration: number): void {
    this.intensity = Math.max(this.intensity, intensity);
    this.duration = Math.max(this.duration, duration);
    this.maxDuration = Math.max(this.maxDuration, duration);
  }
  
  update(dt: number): void {
    if (this.duration > 0) {
      this.duration -= dt;
      if (this.duration <= 0) {
        this.intensity = 0;
        this.duration = 0;
        this.maxDuration = 0;
      }
    }
  }
  
  getOffset(): { x: number; y: number } {
    if (this.duration <= 0) return { x: 0, y: 0 };
    
    const progress = this.duration / this.maxDuration;
    const currentIntensity = this.intensity * progress;
    
    return {
      x: (Math.random() - 0.5) * currentIntensity,
      y: (Math.random() - 0.5) * currentIntensity
    };
  }
}
