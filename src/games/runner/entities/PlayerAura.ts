// ===== src/games/runner/entities/PlayerAura.ts =====
export interface AuraState {
  combo: number;
  hasSpeedBoost: boolean;
  hasInvincibility: boolean;
  gameSpeed: number;
}

interface AuraLayer {
  color: string;
  alpha: number;
  pulseSpeed: number;
  baseSize: number;
}

export class PlayerAura {
  private layers: AuraLayer[] = [];
  private time: number = 0;

  update(dt: number, state: AuraState): void {
    this.time += dt;
    this.layers = [];

    // Base aura (always present, very subtle)
    this.layers.push({
      color: '255, 255, 255',
      alpha: 0.1,
      pulseSpeed: 2,
      baseSize: 5
    });

    // Combo aura (golden, intensifies with combo)
    if (state.combo >= 5) {
      const comboIntensity = Math.min((state.combo - 5) / 15, 1); // Max at 20 combo
      this.layers.push({
        color: '251, 191, 36',
        alpha: 0.2 + comboIntensity * 0.3,
        pulseSpeed: 4 + comboIntensity * 2,
        baseSize: 8 + comboIntensity * 8
      });
    }

    // Speed boost aura (orange/flame)
    if (state.hasSpeedBoost) {
      this.layers.push({
        color: '249, 115, 22',
        alpha: 0.4,
        pulseSpeed: 8,
        baseSize: 12
      });
    }

    // Invincibility aura (green shield)
    if (state.hasInvincibility) {
      this.layers.push({
        color: '16, 185, 129',
        alpha: 0.5,
        pulseSpeed: 3,
        baseSize: 15
      });
    }

    // High speed aura (white streaks at 2x+ speed)
    if (state.gameSpeed >= 2) {
      const speedIntensity = Math.min((state.gameSpeed - 2) / 2, 1);
      this.layers.push({
        color: '255, 255, 255',
        alpha: 0.3 + speedIntensity * 0.2,
        pulseSpeed: 10,
        baseSize: 6 + speedIntensity * 6
      });
    }
  }

  render(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number): void {
    if (this.layers.length <= 1) return; // Skip if only base layer

    const centerX = x + width / 2;
    const centerY = y + height / 2;

    ctx.save();

    // Render each layer (inner to outer)
    for (const layer of this.layers) {
      const pulse = Math.sin(this.time * layer.pulseSpeed) * 0.3 + 0.7;
      const size = Math.max(width, height) / 2 + layer.baseSize * pulse;

      const gradient = ctx.createRadialGradient(
        centerX, centerY, 0,
        centerX, centerY, size
      );
      gradient.addColorStop(0, `rgba(${layer.color}, ${layer.alpha})`);
      gradient.addColorStop(0.6, `rgba(${layer.color}, ${layer.alpha * 0.5})`);
      gradient.addColorStop(1, `rgba(${layer.color}, 0)`);

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(centerX, centerY, size, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}
