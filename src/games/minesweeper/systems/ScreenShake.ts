// ===== src/games/minesweeper/systems/ScreenShake.ts =====
//
// A decaying two-axis wobble. It is a pure function of its own elapsed
// time (no Math.random), so a frame is identical every time it is played
// back and reading the offset never changes anything.

export class ScreenShake {
  private amp = 0;
  private duration = 0;
  private elapsed = 0;

  shake(amplitude: number, duration: number): void {
    // A weaker shake never cuts a stronger one short.
    if (amplitude < this.current()) return;
    this.amp = amplitude;
    this.duration = duration;
    this.elapsed = 0;
  }

  update(dt: number): void {
    if (this.elapsed < this.duration) this.elapsed += dt;
  }

  private current(): number {
    if (this.duration <= 0 || this.elapsed >= this.duration) return 0;
    const k = 1 - this.elapsed / this.duration;
    return this.amp * k * k;
  }

  offset(): { x: number; y: number } {
    const a = this.current();
    if (a <= 0) return { x: 0, y: 0 };
    const t = this.elapsed;
    return { x: Math.sin(t * 71) * a, y: Math.cos(t * 53 + 1.3) * a * 0.8 };
  }

  stop(): void {
    this.amp = 0;
    this.duration = 0;
    this.elapsed = 0;
  }
}
