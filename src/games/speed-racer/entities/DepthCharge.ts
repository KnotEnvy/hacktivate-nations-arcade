// Depth charge — water analog of the chopper bomb. Dropped from a 'dropper'
// jet-boat at its stern, sits stationary in world-frame water (drifts down
// in screen-frame at playerSpeed, like a Hazard), telegraphs with a blinking
// red ring, then detonates in a radial blast. Player taking damage routes
// through 'depth_charge' DeathCause.
//
// Modeled after entities/BombChopper.ts Bomb: same justExploded / radial
// damage pattern so SpeedRacerGame can apply the same single-frame hit check.

const EXPLOSION_RADIUS = 56;
const EXPLOSION_LIFETIME = 0.4;
const DEFAULT_FUSE = 1.4;

export class DepthCharge {
  x: number;
  y: number;
  alive = true;
  exploded = false;
  // True only on the first frame after detonation — mirrors Bomb.justExploded
  // so the game's collision pass fires exactly once per charge.
  justExploded = false;
  private fuseTimer: number;
  private explosionTimer = EXPLOSION_LIFETIME;
  private pulse = 0;
  private readonly fuseTotal: number;

  constructor(x: number, y: number, fuseTime: number = DEFAULT_FUSE) {
    this.x = x;
    this.y = y;
    this.fuseTimer = fuseTime;
    this.fuseTotal = fuseTime;
  }

  update(dt: number, playerSpeed: number): void {
    // Ground-stuck — drifts down at playerSpeed so a charge planted ahead
    // of the player sweeps into their lane at exactly the rate the road does.
    this.y += playerSpeed * dt;
    this.pulse += dt;

    if (this.exploded) {
      this.justExploded = false;
      this.explosionTimer -= dt;
      if (this.explosionTimer <= 0) this.alive = false;
      return;
    }

    this.fuseTimer -= dt;
    if (this.fuseTimer <= 0) {
      this.exploded = true;
      this.justExploded = true;
    }

    if (this.y > 800) this.alive = false;
  }

  getExplosionCenter(): { x: number; y: number; r: number } {
    return { x: this.x, y: this.y, r: EXPLOSION_RADIUS };
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (this.exploded) {
      const t = 1 - this.explosionTimer / EXPLOSION_LIFETIME; // 0 → 1
      const r = EXPLOSION_RADIUS * (0.5 + 0.5 * t);
      ctx.save();
      ctx.globalAlpha = 1 - t;
      // Water-spume detonation — bright cyan-white core to a navy fade.
      const grad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, r);
      grad.addColorStop(0, 'rgba(255,255,255,0.95)');
      grad.addColorStop(0.4, 'rgba(140,230,255,0.65)');
      grad.addColorStop(1, 'rgba(20,60,140,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(this.x, this.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }

    // Pre-detonation telegraph. Blink rate ramps up as the fuse approaches
    // zero so the urgency of "move NOW" reads at a glance.
    const fuseFrac = Math.max(0, this.fuseTimer / this.fuseTotal);
    const blinkSpeed = 5 + (1 - fuseFrac) * 18;
    const blinkOn = Math.sin(this.pulse * blinkSpeed) > 0;

    ctx.save();

    if (blinkOn) {
      // Warning ring — grows + brightens as the fuse runs out.
      ctx.strokeStyle = `rgba(255,80,80,${(0.45 + (1 - fuseFrac) * 0.45).toFixed(3)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(this.x, this.y, 18 + (1 - fuseFrac) * 10, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Canister body — dark steel cylinder seen from above, gold band at the
    // shoulder, blinking indicator light on top.
    ctx.fillStyle = '#1a2a3a';
    ctx.beginPath();
    ctx.ellipse(this.x, this.y, 9, 11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#aab2bc';
    ctx.fillRect(this.x - 8, this.y - 1, 16, 2);
    ctx.fillStyle = '#FFD700';
    ctx.fillRect(this.x - 7, this.y - 6, 14, 2);

    // Indicator light
    if (blinkOn) {
      ctx.shadowColor = '#FF3333';
      ctx.shadowBlur = 6;
      ctx.fillStyle = '#FF3333';
    } else {
      ctx.fillStyle = '#330000';
    }
    ctx.fillRect(this.x - 1, this.y - 9, 2, 2);

    ctx.restore();
  }
}
