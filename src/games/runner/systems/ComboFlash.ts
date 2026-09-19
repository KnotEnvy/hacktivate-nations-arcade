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
  /** Every fifth coin in a chain is a milestone, with no upper bound. */
  private readonly milestoneStep: number = 5;

  trigger(combo: number): void {
    // The old version held a fixed list ending at 30, so a player who chained
    // past it got no further acknowledgement — exactly the player who most
    // deserves one.
    const milestone = Math.floor(combo / this.milestoneStep) * this.milestoneStep;
    if (milestone < this.milestoneStep || milestone <= this.lastMilestone) return;

    this.flashPhase = 'in';
    this.timer = 0;
    // The pop grows a little with the chain, then settles, so a deep combo
    // reads as bigger without becoming obnoxious.
    this.textScale = 1.4 + Math.min(0.5, milestone / 100);
    this.lastMilestone = milestone;
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
