// ===== src/games/dungeon-crawl/systems/ScreenShake.ts =====
// House-style trauma shake: add() stacks trauma, offset decays as trauma².

export class ScreenShake {
  private trauma = 0;

  add(amount: number): void {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  update(dt: number): void {
    this.trauma = Math.max(0, this.trauma - dt * 1.6);
  }

  getOffset(): { x: number; y: number } {
    if (this.trauma <= 0) return { x: 0, y: 0 };
    const magnitude = this.trauma * this.trauma * 12;
    return {
      x: (Math.random() * 2 - 1) * magnitude,
      y: (Math.random() * 2 - 1) * magnitude,
    };
  }

  reset(): void {
    this.trauma = 0;
  }
}
