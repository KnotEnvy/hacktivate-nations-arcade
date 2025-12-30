// ===== src/games/runner/systems/ComboFlash.ts =====
export class ComboFlash {
  private flashAlpha: number = 0;
  private flashPhase: 'none' | 'in' | 'out' = 'none';
  private fadeInDuration: number = 0.1;
  private fadeOutDuration: number = 0.2;
  private timer: number = 0;

  private textScale: number = 1;
  private textScaleTarget: number = 1;

  private lastMilestone: number = 0;
  private milestones: number[] = [5, 10, 15, 20, 25, 30];

  trigger(combo: number): void {
    // Check if we hit a new milestone
    for (const milestone of this.milestones) {
      if (combo >= milestone && this.lastMilestone < milestone) {
        this.flashPhase = 'in';
        this.timer = 0;
        this.textScale = 1.5; // Pop effect
        this.lastMilestone = milestone;
        break;
      }
    }
  }

  resetMilestones(): void {
    this.lastMilestone = 0;
  }

  update(dt: number): void {
    // Flash animation
    if (this.flashPhase === 'in') {
      this.timer += dt;
      this.flashAlpha = Math.min(this.timer / this.fadeInDuration, 1) * 0.4; // Max 40% opacity

      if (this.timer >= this.fadeInDuration) {
        this.flashPhase = 'out';
        this.timer = 0;
      }
    } else if (this.flashPhase === 'out') {
      this.timer += dt;
      this.flashAlpha = (1 - this.timer / this.fadeOutDuration) * 0.4;

      if (this.timer >= this.fadeOutDuration) {
        this.flashPhase = 'none';
        this.flashAlpha = 0;
      }
    }

    // Text scale recovery
    if (this.textScale > this.textScaleTarget) {
      this.textScale = Math.max(this.textScaleTarget, this.textScale - dt * 3);
    }
  }

  render(ctx: CanvasRenderingContext2D, canvasWidth: number, canvasHeight: number): void {
    if (this.flashAlpha <= 0) return;

    ctx.save();
    ctx.fillStyle = `rgba(255, 255, 255, ${this.flashAlpha})`;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    ctx.restore();
  }

  getTextScale(): number {
    return this.textScale;
  }
}
