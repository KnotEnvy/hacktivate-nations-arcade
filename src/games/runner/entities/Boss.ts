// ===== src/games/runner/entities/Boss.ts =====
import { Vector2, Rectangle } from '@/games/shared/utils/Vector2';

export type BossType = 'sun' | 'phoenix' | 'shadow' | 'sandworm' | 'treant';

export type AttackType = 'projectile' | 'volley' | 'groundPound' | 'charge' | 'summon';

interface AttackPattern {
  type: AttackType;
  windupTime: number;  // Telegraph duration
  executeTime: number; // Attack duration
  cooldown: number;    // Time before next attack
}

interface BossConfig {
  name: string;
  hp: number;
  attackSpeed: number;      // Multiplier (1 = normal, 0.5 = faster)
  patterns: AttackPattern[];
  primaryColor: string;
  secondaryColor: string;
  glowColor: string;
  eyeColor: string;
}

/**
 * Health pools are sized against the OPENING, not against how fast a player
 * can mash. A boss is only stompable in the ~1.9s window after each attack,
 * which is room for two or three hits, and a cycle runs about three seconds.
 * These numbers put the five fights between roughly ten and twenty-five
 * seconds. They were nearly double this when a boss could be stomped at any
 * point its hover wave happened to dip.
 */
const BOSS_CONFIGS: Record<BossType, BossConfig> = {
  sun: {
    name: 'Sun Guardian',
    hp: 6,
    attackSpeed: 1,
    patterns: [
      { type: 'projectile', windupTime: 0.5, executeTime: 0.3, cooldown: 2 }
    ],
    primaryColor: '#FBBF24',
    secondaryColor: '#F59E0B',
    glowColor: '#FDE047',
    eyeColor: '#FFFFFF'
  },
  phoenix: {
    name: 'Phoenix',
    hp: 7,
    attackSpeed: 0.9,
    patterns: [
      { type: 'projectile', windupTime: 0.4, executeTime: 0.3, cooldown: 1.8 },
      { type: 'volley', windupTime: 0.6, executeTime: 0.5, cooldown: 3 }
    ],
    primaryColor: '#F97316',
    secondaryColor: '#DC2626',
    glowColor: '#FBBF24',
    eyeColor: '#FDE047'
  },
  shadow: {
    name: 'Shadow Beast',
    hp: 9,
    attackSpeed: 0.8,
    patterns: [
      { type: 'projectile', windupTime: 0.3, executeTime: 0.3, cooldown: 1.5 },
      { type: 'volley', windupTime: 0.5, executeTime: 0.5, cooldown: 2.5 },
      { type: 'groundPound', windupTime: 0.8, executeTime: 0.4, cooldown: 4 }
    ],
    primaryColor: '#6B21A8',
    secondaryColor: '#4C1D95',
    glowColor: '#A855F7',
    eyeColor: '#F472B6'
  },
  sandworm: {
    name: 'Sand Worm',
    hp: 11,
    attackSpeed: 0.75,
    patterns: [
      { type: 'projectile', windupTime: 0.3, executeTime: 0.3, cooldown: 1.2 },
      { type: 'charge', windupTime: 1, executeTime: 0.6, cooldown: 3.5 },
      { type: 'groundPound', windupTime: 0.6, executeTime: 0.4, cooldown: 3 }
    ],
    primaryColor: '#D97706',
    secondaryColor: '#92400E',
    glowColor: '#FCD34D',
    eyeColor: '#FBBF24'
  },
  treant: {
    name: 'Ancient Treant',
    hp: 13,
    attackSpeed: 0.7,
    patterns: [
      { type: 'volley', windupTime: 0.4, executeTime: 0.5, cooldown: 1.5 },
      { type: 'charge', windupTime: 0.8, executeTime: 0.6, cooldown: 3 },
      { type: 'groundPound', windupTime: 0.6, executeTime: 0.4, cooldown: 2.5 },
      { type: 'summon', windupTime: 1.2, executeTime: 0.5, cooldown: 5 }
    ],
    primaryColor: '#16A34A',
    secondaryColor: '#166534',
    glowColor: '#4ADE80',
    // Amber, not near-white: in the carved sockets a white disc reads as an
    // eyeball stuck on a tree, where a warm one reads as something burning
    // inside it.
    eyeColor: '#FDBA74'
  }
};

const BOSS_TYPE_BY_THEME: BossType[] = ['sun', 'phoenix', 'shadow', 'sandworm', 'treant'];

export class Boss {
  position: Vector2;
  size: Vector2;
  health: number;
  maxHealth: number;
  velocity: Vector2;

  // Boss identity
  private bossType: BossType;
  private config: BossConfig;
  private bossNumber: number;

  // Phase management
  private phase: 'intro' | 'fight' | 'rage' | 'defeat' = 'intro';
  private introTimer: number = 0;
  private introPhase: 'approach' | 'stop' | 'name' | 'ready' = 'approach';
  private readonly introApproachTime: number = 1;
  private readonly introStopTime: number = 0.5;
  private readonly introNameTime: number = 1.1;
  private readonly introReadyTime: number = 0.3;

  // Attack system
  private attackTimer: number = 0;
  private currentAttackIndex: number = 0;
  private attackState: 'idle' | 'windup' | 'execute' | 'cooldown' = 'idle';
  private attackStateTimer: number = 0;
  private pendingAttack: AttackPattern | null = null;

  // Attack outputs (read by RunnerGame)
  private attackQueue: { type: AttackType; x: number; y: number }[] = [];

  // Movement
  private movementTimer: number = 0;
  private targetY: number;
  private groundY: number;
  private baseX: number = 600;
  private chargeTargetX: number = 0;
  private chargingActive: boolean = false;

  /**
   * Seconds of vulnerability left.
   *
   * The five fights used to be the same fight: the boss rode a sine wave and
   * could be stomped whenever the wave happened to dip. That made the attacks
   * decoration — you never had to respond to one, only to stand somewhere and
   * wait. Now a boss rides HIGH by default and drops into reach only after it
   * finishes an attack. The rhythm of every fight becomes dodge, then punish.
   */
  private exposedTimer: number = 0;
  private readonly exposeDuration: number = 1.9;

  // Animation
  private animationTime: number = 0;
  private damageFlashTimer: number = 0;
  private rageIntensity: number = 0;

  // Intro text animation
  private introTextAlpha: number = 0;
  private introTextScale: number = 1;

  // Defeat animation
  private defeatTimer: number = 0;
  private defeatExplosions: { x: number; y: number; timer: number; size: number }[] = [];

  constructor(x: number, groundY: number, themeLevel: number = 0) {
    this.groundY = groundY;
    this.bossNumber = themeLevel + 1; // 1-indexed for display
    this.bossType = BOSS_TYPE_BY_THEME[themeLevel % 5];
    this.config = BOSS_CONFIGS[this.bossType];

    this.position = new Vector2(x, groundY - 210);
    this.size = new Vector2(112, 112);
    this.velocity = new Vector2(-50, 0);

    // Scale HP based on boss number (for endless progression)
    const hpMultiplier = 1 + Math.floor(themeLevel / 5) * 0.5;
    this.maxHealth = Math.floor(this.config.hp * hpMultiplier);
    this.health = this.maxHealth;

    this.targetY = this.position.y;
  }

  update(dt: number, gameSpeed: number): void {
    this.animationTime += dt;
    if (this.exposedTimer > 0) this.exposedTimer = Math.max(0, this.exposedTimer - dt);

    // Damage flash decay
    if (this.damageFlashTimer > 0) {
      this.damageFlashTimer -= dt;
    }

    // Handle different phases
    switch (this.phase) {
      case 'intro':
        this.updateIntro(dt);
        break;
      case 'fight':
      case 'rage':
        this.updateFight(dt, gameSpeed);
        break;
      case 'defeat':
        this.updateDefeat(dt);
        break;
    }
  }

  private updateIntro(dt: number): void {
    this.introTimer += dt;

    switch (this.introPhase) {
      case 'approach':
        // Entrance from the right. At the old 80px/s this leg alone ran over
        // three seconds, and with the rest of the sequence the player spent
        // 5.4s watching before a boss fight could start — five times a lap.
        this.velocity.x = -170;
        this.position.x += this.velocity.x * dt;

        if (this.position.x <= this.baseX + 50) {
          this.introPhase = 'stop';
          this.introTimer = 0;
        }
        break;

      case 'stop':
        // Halt and prepare
        this.velocity.x = 0;
        const targetX = this.baseX;
        this.position.x += (targetX - this.position.x) * dt * 5;

        if (this.introTimer >= this.introStopTime) {
          this.introPhase = 'name';
          this.introTimer = 0;
          this.introTextAlpha = 0;
          this.introTextScale = 2;
        }
        break;

      case 'name':
        // Show boss name with dramatic effect
        this.introTextAlpha = Math.min(1, this.introTimer / 0.3);
        this.introTextScale = 1 + (1 - Math.min(1, this.introTimer / 0.3));

        // Subtle hover during the name card, in the same band the fight uses
        // so the boss does not jump position when the intro ends.
        this.position.y = this.groundY - 196 + Math.sin(this.animationTime * 3) * 5;

        if (this.introTimer >= this.introNameTime) {
          this.introPhase = 'ready';
          this.introTimer = 0;
        }
        break;

      case 'ready':
        // Fade out name and start fight
        this.introTextAlpha = Math.max(0, 1 - this.introTimer / 0.3);

        if (this.introTimer >= this.introReadyTime) {
          this.phase = 'fight';
          this.attackState = 'idle';
          this.attackTimer = 1; // Short delay before first attack
        }
        break;
    }
  }

  private updateFight(dt: number, gameSpeed: number): void {
    void gameSpeed;
    // Check for rage mode
    const healthPercent = this.health / this.maxHealth;
    if (healthPercent <= 0.3 && this.phase !== 'rage') {
      this.phase = 'rage';
      this.rageIntensity = 0;
    }

    // Increase rage intensity
    if (this.phase === 'rage') {
      this.rageIntensity = Math.min(1, this.rageIntensity + dt * 0.5);
    }

    // Attack state machine
    this.updateAttackState(dt);

    // Movement (unless charging)
    if (!this.chargingActive) {
      this.updateMovement(dt);
    } else {
      this.updateCharge(dt);
    }
  }

  private updateAttackState(dt: number): void {
    const speedMult = this.config.attackSpeed * (this.phase === 'rage' ? 0.7 : 1);

    switch (this.attackState) {
      case 'idle':
        this.attackTimer += dt;
        const nextPattern = this.getNextAttackPattern();

        if (this.attackTimer >= nextPattern.cooldown * speedMult) {
          this.attackState = 'windup';
          this.attackStateTimer = 0;
          this.pendingAttack = nextPattern;
        }
        break;

      case 'windup':
        this.attackStateTimer += dt;
        if (this.pendingAttack && this.attackStateTimer >= this.pendingAttack.windupTime * speedMult) {
          this.attackState = 'execute';
          this.attackStateTimer = 0;
          this.executeAttack(this.pendingAttack);
        }
        break;

      case 'execute':
        this.attackStateTimer += dt;
        if (this.pendingAttack && this.attackStateTimer >= this.pendingAttack.executeTime) {
          this.attackState = 'cooldown';
          this.attackStateTimer = 0;
          // The opening. Committing to an attack is what leaves it open.
          this.exposedTimer = this.exposeDuration;
        }
        break;

      case 'cooldown':
        this.attackStateTimer += dt;
        if (this.attackStateTimer >= 0.3) {
          this.attackState = 'idle';
          this.attackTimer = 0;
          this.currentAttackIndex = (this.currentAttackIndex + 1) % this.config.patterns.length;
          this.pendingAttack = null;
        }
        break;
    }
  }

  private getNextAttackPattern(): AttackPattern {
    return this.config.patterns[this.currentAttackIndex];
  }

  private executeAttack(pattern: AttackPattern): void {
    const attackX = this.position.x;
    const attackY = this.position.y + this.size.y / 2;

    switch (pattern.type) {
      case 'projectile':
        this.attackQueue.push({ type: 'projectile', x: attackX, y: attackY });
        break;

      case 'volley':
        // Fire 3-5 projectiles in spread
        const count = this.phase === 'rage' ? 5 : 3;
        for (let i = 0; i < count; i++) {
          const yOffset = (i - Math.floor(count / 2)) * 30;
          this.attackQueue.push({
            type: 'projectile',
            x: attackX,
            y: attackY + yOffset
          });
        }
        break;

      case 'groundPound':
        this.attackQueue.push({ type: 'groundPound', x: attackX, y: this.groundY });
        break;

      case 'charge':
        this.chargingActive = true;
        this.chargeTargetX = 100; // Charge toward left side
        break;

      case 'summon':
        this.attackQueue.push({ type: 'summon', x: attackX - 100, y: this.groundY - 40 });
        break;
    }
  }

  private updateMovement(dt: number): void {
    this.movementTimer += dt;

    // Vertical wave motion
    // Two bands, and which one the boss rides is the whole fight.
    //
    // Measured: a tapped jump lifts the runner 86px, a full-hold one 183px.
    //
    //   GUARD    centred 246px up, so its LOWEST point is still well above a
    //            full-hold jump. While the boss is guarding there is nothing
    //            to do but read its attacks and stay alive.
    //   EXPOSED  centred 178px up. The top edge dips to ~156px, inside the
    //            arc, and the underside still clears a standing runner's head
    //            so there is somewhere to line the jump up from.
    //
    // The two bands do not overlap: the drop has to be legible at a glance,
    // not a few pixels of difference.
    //
    // It eases between them rather than snapping, so the drop itself is the
    // tell that the window has opened.
    const exposed = this.isExposed();
    const waveSpeed = this.phase === 'rage' ? 2 : 1.5;
    const waveAmplitude = exposed ? 22 : 30;
    const band = exposed ? 178 : 246;
    this.targetY =
      this.groundY - band + Math.sin(this.movementTimer * waveSpeed) * waveAmplitude;

    const dy = this.targetY - this.position.y;
    this.position.y += dy * dt * 4.2;

    // Horizontal bobbing
    const bobAmplitude = this.phase === 'rage' ? 30 : 20;
    this.position.x = this.baseX + Math.sin(this.movementTimer * 2) * bobAmplitude;
  }

  private updateCharge(dt: number): void {
    // Charge toward target
    const chargeSpeed = 400;
    this.position.x -= chargeSpeed * dt;

    // Hit left boundary - return
    if (this.position.x <= this.chargeTargetX) {
      this.chargingActive = false;
      // Return to base position
      this.position.x = this.chargeTargetX;
    }

    // Return to base after charge
    if (!this.chargingActive && this.position.x < this.baseX) {
      this.position.x += 200 * dt;
      if (this.position.x >= this.baseX) {
        this.position.x = this.baseX;
      }
    }
  }

  private updateDefeat(dt: number): void {
    this.defeatTimer += dt;

    // Generate explosions
    if (this.defeatTimer < 1.5 && Math.random() < 0.3) {
      this.defeatExplosions.push({
        x: this.position.x + Math.random() * this.size.x,
        y: this.position.y + Math.random() * this.size.y,
        timer: 0,
        size: 20 + Math.random() * 30
      });
    }

    // Update explosions
    this.defeatExplosions = this.defeatExplosions.filter(exp => {
      exp.timer += dt;
      return exp.timer < 0.5;
    });

    // Shrink and sink
    if (this.defeatTimer > 0.5) {
      const shrinkProgress = Math.min(1, (this.defeatTimer - 0.5) / 1);
      this.size.x = 80 * (1 - shrinkProgress * 0.8);
      this.size.y = 80 * (1 - shrinkProgress * 0.8);
      this.position.y += 50 * dt;
    }

    // Shake during defeat
    this.position.x += (Math.random() - 0.5) * 10;
  }

  takeDamage(amount: number = 1): boolean {
    if (this.phase === 'intro') return false; // Invulnerable during intro

    this.health -= amount;
    this.damageFlashTimer = 0.15;

    if (this.health <= 0) {
      this.phase = 'defeat';
      this.defeatTimer = 0;
      return true;
    }
    return false;
  }

  // Called by RunnerGame to get pending attacks
  consumeAttacks(): { type: AttackType; x: number; y: number }[] {
    const attacks = [...this.attackQueue];
    this.attackQueue = [];
    return attacks;
  }

  render(ctx: CanvasRenderingContext2D): void {
    ctx.save();

    // Damage flash
    if (this.damageFlashTimer > 0) {
      ctx.globalAlpha = 0.5 + Math.sin(this.damageFlashTimer * 50) * 0.5;
    }

    // Rage shake
    let offsetX = 0;
    let offsetY = 0;
    if (this.phase === 'rage') {
      offsetX = (Math.random() - 0.5) * 4 * this.rageIntensity;
      offsetY = (Math.random() - 0.5) * 4 * this.rageIntensity;
    }

    // Draw boss based on type
    this.renderBossBody(ctx, offsetX, offsetY);

    // Render defeat explosions
    this.renderDefeatExplosions(ctx);

    // Intro text
    if (this.phase === 'intro' && this.introPhase === 'name' ||
        (this.phase === 'intro' && this.introPhase === 'ready' && this.introTextAlpha > 0)) {
      this.renderIntroText(ctx);
    }

    // Attack windup indicator
    if (this.attackState === 'windup' && this.pendingAttack) {
      this.renderWindupIndicator(ctx);
    }

    ctx.restore();
  }

  private renderBossBody(ctx: CanvasRenderingContext2D, offsetX: number, offsetY: number): void {
    const x = this.position.x + offsetX;
    const y = this.position.y + offsetY;
    const w = this.size.x;
    const h = this.size.y;
    const cx = x + w / 2;
    const cy = y + h / 2;

    // A pool of shade under the boss: without it the treant vanishes into the
    // forest and the shadow beast into the night.
    const shade = ctx.createRadialGradient(cx, cy, w * 0.2, cx, cy, w * 0.95);
    shade.addColorStop(0, 'rgba(0, 0, 0, 0.35)');
    shade.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = shade;
    ctx.beginPath();
    ctx.arc(cx, cy, w * 0.95, 0, Math.PI * 2);
    ctx.fill();

    // Outer glow
    const glowRadius = w * 0.8;
    const glowGradient = ctx.createRadialGradient(cx, cy, w * 0.3, cx, cy, glowRadius);
    glowGradient.addColorStop(0, this.config.glowColor + '40');
    glowGradient.addColorStop(1, this.config.glowColor + '00');
    ctx.fillStyle = glowGradient;
    ctx.fillRect(x - glowRadius, y - glowRadius, w + glowRadius * 2, h + glowRadius * 2);

    // Main body gradient
    const bodyGradient = ctx.createRadialGradient(cx, cy, 10, cx, cy, w);
    bodyGradient.addColorStop(0, this.config.primaryColor);
    bodyGradient.addColorStop(0.5, this.config.secondaryColor);
    bodyGradient.addColorStop(1, this.adjustColor(this.config.secondaryColor, -30));

    ctx.fillStyle = bodyGradient;

    // Different shapes per boss type
    switch (this.bossType) {
      case 'sun':
        this.renderSunBoss(ctx, cx, cy, w, h);
        break;
      case 'phoenix':
        this.renderPhoenixBoss(ctx, cx, cy, w, h);
        break;
      case 'shadow':
        this.renderShadowBoss(ctx, cx, cy, w, h);
        break;
      case 'sandworm':
        this.renderSandwormBoss(ctx, cx, cy, w, h);
        break;
      case 'treant':
        this.renderTreantBoss(ctx, cx, cy, w, h);
        break;
    }

    // Faces are per-boss; only the anger is shared.
    this.renderRageBrow(ctx, x, y, w);
    this.renderExposedTell(ctx, cx, cy, w);

    // Rage aura
    if (this.phase === 'rage') {
      ctx.strokeStyle = '#EF4444';
      ctx.lineWidth = 3;
      ctx.globalAlpha = 0.5 + Math.sin(this.animationTime * 10) * 0.3;
      ctx.beginPath();
      ctx.arc(cx, cy, w * 0.6 + Math.sin(this.animationTime * 8) * 5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  // ======================================================================
  // Boss bodies.
  //
  // Each one owns its whole silhouette INCLUDING its face, because a shared
  // pair of dots read as googly eyes stuck onto five different shapes. What is
  // shared is the language: a hot core colour, a darker shell, one glowing
  // feature that tells you where the thing is looking, and an animation that
  // keeps moving while it waits so it never looks switched off.
  // ======================================================================

  /** Sun Guardian: a solar disc behind a gold mask, two counter-rotating coronas. */
  private renderSunBoss(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    w: number,
    h: number
  ): void {
    void h;
    const r = w * 0.34;

    // Two ray crowns turning opposite ways: the classic "living star" read.
    for (let layer = 0; layer < 2; layer++) {
      const rayCount = layer === 0 ? 16 : 8;
      const dir = layer === 0 ? 1 : -1;
      const inner = r * (layer === 0 ? 1.02 : 1.1);
      ctx.fillStyle = layer === 0 ? this.config.glowColor : this.config.primaryColor;
      ctx.globalAlpha = layer === 0 ? 0.9 : 0.55;
      for (let i = 0; i < rayCount; i++) {
        const angle =
          (i / rayCount) * Math.PI * 2 + this.animationTime * 0.45 * dir;
        const outer =
          inner + r * (layer === 0 ? 0.5 : 0.85) +
          Math.sin(this.animationTime * 3 + i) * 5;
        const spread = layer === 0 ? 0.1 : 0.05;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(angle - spread) * inner, cy + Math.sin(angle - spread) * inner);
        ctx.lineTo(cx + Math.cos(angle) * outer, cy + Math.sin(angle) * outer);
        ctx.lineTo(cx + Math.cos(angle + spread) * inner, cy + Math.sin(angle + spread) * inner);
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;

    // Molten core.
    const core = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, 0, cx, cy, r);
    core.addColorStop(0, '#FFFBE8');
    core.addColorStop(0.45, this.config.primaryColor);
    core.addColorStop(1, this.config.secondaryColor);
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    // Sunspots, drifting across the face.
    ctx.fillStyle = 'rgba(160, 70, 10, 0.35)';
    for (let i = 0; i < 4; i++) {
      const a = this.animationTime * 0.3 + i * 1.7;
      ctx.beginPath();
      ctx.ellipse(
        cx + Math.cos(a) * r * 0.5,
        cy + Math.sin(a * 0.7) * r * 0.4,
        r * 0.16,
        r * 0.1,
        a,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }

    // The mask.
    //
    // Round white eyes plus a curved mouth read as a cartoon face however the
    // mouth is bent — the first two passes came out cheerful, then worried.
    // Angled slots with a hot core inside are what actually reads as a glare.
    ctx.fillStyle = '#93590F';
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.86, cy - r * 0.28);
    ctx.quadraticCurveTo(cx, cy - r * 0.84, cx + r * 0.86, cy - r * 0.28);
    ctx.quadraticCurveTo(cx, cy - r * 0.44, cx - r * 0.86, cy - r * 0.28);
    ctx.closePath();
    ctx.fill();

    // Eye slots: wedges angled down toward the nose.
    for (const side of [-1, 1]) {
      const ex = cx + side * r * 0.4;
      ctx.save();
      ctx.translate(ex, cy - r * 0.04);
      // INNER end low, OUTER end high. Rotating the other way tilts the
      // inner corners up, which is the universal "sad" eyebrow.
      ctx.rotate(-side * 0.46);
      ctx.fillStyle = '#5E2C04';
      ctx.beginPath();
      ctx.moveTo(-r * 0.3, -r * 0.1);
      ctx.lineTo(r * 0.3, -r * 0.2);
      ctx.lineTo(r * 0.3, r * 0.06);
      ctx.lineTo(-r * 0.3, r * 0.1);
      ctx.closePath();
      ctx.fill();

      // The glow inside the slot, hotter in rage.
      const hot = this.phase === 'rage' ? '#FF5533' : '#FFF3C4';
      const glow = ctx.createLinearGradient(-r * 0.3, 0, r * 0.3, 0);
      glow.addColorStop(0, this.hexToRgba(hot, 0.1));
      glow.addColorStop(0.6, hot);
      glow.addColorStop(1, this.hexToRgba(hot, 0.35));
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.moveTo(-r * 0.22, -r * 0.04);
      ctx.lineTo(r * 0.24, -r * 0.13);
      ctx.lineTo(r * 0.24, r * 0.0);
      ctx.lineTo(-r * 0.22, r * 0.05);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // Mouth: a hard down-turned bar, widening into a snarl in rage.
    ctx.fillStyle = '#5E2C04';
    if (this.phase === 'rage') {
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.34, cy + r * 0.34);
      ctx.quadraticCurveTo(cx, cy + r * 0.82, cx + r * 0.34, cy + r * 0.34);
      ctx.quadraticCurveTo(cx, cy + r * 0.44, cx - r * 0.34, cy + r * 0.34);
      ctx.closePath();
      ctx.fill();
      // Bared teeth.
      ctx.fillStyle = '#FFF3C4';
      for (let i = 0; i < 4; i++) {
        const tx = cx - r * 0.26 + i * r * 0.17;
        ctx.beginPath();
        ctx.moveTo(tx, cy + r * 0.38);
        ctx.lineTo(tx + r * 0.1, cy + r * 0.38);
        ctx.lineTo(tx + r * 0.05, cy + r * 0.54);
        ctx.closePath();
        ctx.fill();
      }
    } else {
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.3, cy + r * 0.48);
      ctx.quadraticCurveTo(cx, cy + r * 0.3, cx + r * 0.3, cy + r * 0.48);
      ctx.lineTo(cx + r * 0.3, cy + r * 0.56);
      ctx.quadraticCurveTo(cx, cy + r * 0.38, cx - r * 0.3, cy + r * 0.56);
      ctx.closePath();
      ctx.fill();
    }
  }

  /** Phoenix: an actual bird — neck, beak, layered wings, a tail of flame. */
  private renderPhoenixBoss(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    w: number,
    h: number
  ): void {
    const flap = Math.sin(this.animationTime * 5);

    // Tail: three flame feathers streaming behind.
    for (let i = 0; i < 3; i++) {
      const wave = Math.sin(this.animationTime * 6 + i * 0.8) * 8;
      ctx.fillStyle = i === 1 ? this.config.glowColor : this.config.secondaryColor;
      ctx.beginPath();
      ctx.moveTo(cx - w * 0.1, cy + h * 0.12 + i * 5);
      ctx.quadraticCurveTo(
        cx - w * 0.45,
        cy + h * 0.2 + i * 9 + wave,
        cx - w * 0.72,
        cy + h * 0.02 + i * 13 + wave
      );
      ctx.quadraticCurveTo(cx - w * 0.4, cy + h * 0.3 + i * 8, cx - w * 0.1, cy + h * 0.22 + i * 5);
      ctx.closePath();
      ctx.fill();
    }

    // Far wing.
    this.phoenixWing(ctx, cx, cy, w, h, -flap, 0.8, this.config.secondaryColor);

    // Body.
    const body = ctx.createLinearGradient(cx, cy - h * 0.3, cx, cy + h * 0.3);
    body.addColorStop(0, this.config.glowColor);
    body.addColorStop(0.5, this.config.primaryColor);
    body.addColorStop(1, this.config.secondaryColor);
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.ellipse(cx, cy + h * 0.04, w * 0.27, h * 0.3, -0.1, 0, Math.PI * 2);
    ctx.fill();

    // Neck and head, held high.
    const headX = cx + w * 0.22;
    const headY = cy - h * 0.3 + Math.sin(this.animationTime * 3) * 3;
    ctx.fillStyle = this.config.primaryColor;
    ctx.beginPath();
    ctx.moveTo(cx + w * 0.04, cy - h * 0.12);
    ctx.quadraticCurveTo(cx + w * 0.16, cy - h * 0.3, headX, headY);
    ctx.lineTo(headX, headY + h * 0.16);
    ctx.quadraticCurveTo(cx + w * 0.12, cy - h * 0.06, cx + w * 0.02, cy + h * 0.04);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = this.config.glowColor;
    ctx.beginPath();
    ctx.ellipse(headX, headY + h * 0.03, w * 0.11, h * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();

    // Crest feathers.
    ctx.fillStyle = this.config.secondaryColor;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(headX - w * 0.04 + i * 3, headY - h * 0.06);
      ctx.lineTo(headX - w * 0.14 + i * 5, headY - h * 0.2 - i * 3);
      ctx.lineTo(headX + i * 3, headY - h * 0.04);
      ctx.closePath();
      ctx.fill();
    }

    // Beak: hooked, gold.
    ctx.fillStyle = '#F7C948';
    ctx.beginPath();
    ctx.moveTo(headX + w * 0.08, headY);
    ctx.lineTo(headX + w * 0.24, headY + h * 0.04);
    ctx.lineTo(headX + w * 0.08, headY + h * 0.08);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#B8860B';
    ctx.beginPath();
    ctx.moveTo(headX + w * 0.08, headY + h * 0.045);
    ctx.lineTo(headX + w * 0.2, headY + h * 0.05);
    ctx.lineTo(headX + w * 0.08, headY + h * 0.08);
    ctx.closePath();
    ctx.fill();

    this.glowEye(ctx, headX + w * 0.02, headY + h * 0.01, w * 0.045, this.config.eyeColor);

    // Talons, tucked.
    ctx.strokeStyle = '#F7C948';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    for (let i = 0; i < 2; i++) {
      ctx.beginPath();
      ctx.moveTo(cx + w * 0.02 + i * 9, cy + h * 0.26);
      ctx.lineTo(cx + w * 0.08 + i * 9, cy + h * 0.36);
      ctx.lineTo(cx + w * 0.16 + i * 9, cy + h * 0.33);
      ctx.stroke();
    }

    // Near wing, over everything.
    this.phoenixWing(ctx, cx, cy, w, h, flap, 1, this.config.primaryColor);
  }

  private phoenixWing(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    w: number,
    h: number,
    flap: number,
    scale: number,
    color: string
  ): void {
    ctx.save();
    ctx.translate(cx, cy - h * 0.04);
    ctx.scale(scale, scale);
    ctx.rotate(flap * 0.35);

    // Three feather ranks, each shorter than the last.
    const ranks: [number, number, string][] = [
      [0.62, 0.5, this.config.secondaryColor],
      [0.5, 0.38, color],
      [0.36, 0.26, this.config.glowColor],
    ];
    for (const [reach, drop, c] of ranks) {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(-w * reach * 0.5, -h * 0.42, -w * reach, -h * drop * 0.3);
      ctx.quadraticCurveTo(-w * reach * 0.7, h * drop * 0.3, 0, h * 0.14);
      ctx.closePath();
      ctx.fill();
    }

    // Feather separations.
    ctx.strokeStyle = 'rgba(120, 20, 0, 0.35)';
    ctx.lineWidth = 2;
    for (let i = 1; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(-w * 0.06, h * 0.02);
      ctx.lineTo(-w * (0.2 + i * 0.12), -h * (0.18 - i * 0.04));
      ctx.stroke();
    }
    ctx.restore();
  }

  /** Shadow Beast: a hole in the world with a maw and too many eyes. */
  private renderShadowBoss(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    w: number,
    h: number
  ): void {
    // Smoke skirts trailing off the body.
    ctx.fillStyle = this.config.secondaryColor;
    ctx.globalAlpha = 0.4;
    for (let i = 0; i < 5; i++) {
      const a = this.animationTime * 1.2 + i * 1.25;
      const rr = w * (0.34 + (i % 2) * 0.1);
      ctx.beginPath();
      ctx.ellipse(
        cx + Math.cos(a) * w * 0.34,
        cy + Math.sin(a * 0.8) * h * 0.3,
        rr * 0.5,
        rr * 0.36,
        a,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // The mass itself: a wobbling blob with a hard edge.
    ctx.beginPath();
    for (let i = 0; i <= 40; i++) {
      const angle = (i / 40) * Math.PI * 2;
      const wobble =
        Math.sin(angle * 5 + this.animationTime * 2.4) * 6 +
        Math.sin(angle * 9 - this.animationTime * 1.6) * 3;
      const r = w * 0.38 + wobble;
      const px = cx + Math.cos(angle) * r;
      const py = cy + Math.sin(angle) * r * 0.95;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    const void_ = ctx.createRadialGradient(cx, cy, w * 0.05, cx, cy, w * 0.42);
    void_.addColorStop(0, '#120726');
    void_.addColorStop(0.7, this.config.secondaryColor);
    void_.addColorStop(1, this.config.primaryColor);
    ctx.fillStyle = void_;
    ctx.fill();

    // Rim light, so the silhouette survives a dark background.
    ctx.strokeStyle = this.config.glowColor;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Three eyes, the middle one larger, all blinking out of step.
    const eyes: [number, number, number][] = [
      [-0.24, -0.1, 0.075],
      [0.02, -0.19, 0.105],
      [0.26, -0.06, 0.075],
    ];
    eyes.forEach(([ex, ey, er], i) => {
      const blink = Math.sin(this.animationTime * 1.7 + i * 2.1);
      if (blink > 0.94) return;
      this.glowEye(ctx, cx + w * ex, cy + h * ey, w * er, this.config.eyeColor);
    });

    // Maw: a jagged grin of pale teeth.
    const open = this.phase === 'rage' ? 0.14 : 0.07;
    ctx.fillStyle = '#0A0414';
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.22, cy + h * 0.12);
    ctx.quadraticCurveTo(cx, cy + h * (0.12 + open * 2.2), cx + w * 0.22, cy + h * 0.12);
    ctx.quadraticCurveTo(cx, cy + h * 0.1, cx - w * 0.22, cy + h * 0.12);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#E9D5FF';
    for (let i = 0; i < 6; i++) {
      const t = i / 5;
      const tx = cx - w * 0.2 + t * w * 0.4;
      const ty = cy + h * 0.118;
      ctx.beginPath();
      ctx.moveTo(tx - 3, ty);
      ctx.lineTo(tx, ty + h * (0.05 + open));
      ctx.lineTo(tx + 3, ty);
      ctx.closePath();
      ctx.fill();
    }
  }

  /** Sand Worm: segmented body rising from the dune, ringed with teeth. */
  private renderSandwormBoss(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    w: number,
    h: number
  ): void {
    // Everything below the ground line is buried, so the segments read as
    // emerging rather than as a tail dangling through the floor.
    ctx.save();
    ctx.beginPath();
    ctx.rect(cx - w, cy - h * 2, w * 2, this.groundY - (cy - h * 2));
    ctx.clip();

    // Body segments, drawn back to front so the head sits on top.
    const segments = 6;
    for (let i = segments - 1; i >= 1; i--) {
      const sway = Math.sin(this.animationTime * 2.6 - i * 0.55) * (6 + i * 2.5);
      const sy = cy + i * h * 0.15;
      const sr = w * (0.34 - i * 0.032);

      ctx.fillStyle = i % 2 === 0 ? this.config.secondaryColor : this.adjustColor(this.config.secondaryColor, -18);
      ctx.beginPath();
      ctx.ellipse(cx + sway, sy, sr, sr * 0.82, 0, 0, Math.PI * 2);
      ctx.fill();

      // Chitin plate along the front of each segment.
      ctx.fillStyle = this.adjustColor(this.config.primaryColor, -10);
      ctx.beginPath();
      ctx.ellipse(cx + sway, sy - sr * 0.3, sr * 0.72, sr * 0.34, 0, Math.PI, Math.PI * 2);
      ctx.fill();
    }

    // Head.
    const headSway = Math.sin(this.animationTime * 2.6) * 4;
    const hx = cx + headSway;
    const hy = cy - h * 0.08;
    const hr = w * 0.35;

    const shell = ctx.createRadialGradient(hx - hr * 0.3, hy - hr * 0.4, 0, hx, hy, hr);
    shell.addColorStop(0, this.adjustColor(this.config.primaryColor, 30));
    shell.addColorStop(1, this.config.secondaryColor);
    ctx.fillStyle = shell;
    ctx.beginPath();
    ctx.ellipse(hx, hy, hr, hr * 0.94, 0, 0, Math.PI * 2);
    ctx.fill();

    // The maw: two concentric rings of teeth around a dark throat.
    const gape = (this.phase === 'rage' ? 0.62 : 0.5) +
      Math.sin(this.animationTime * 3) * 0.05;
    ctx.fillStyle = '#2B1405';
    ctx.beginPath();
    ctx.arc(hx, hy, hr * gape, 0, Math.PI * 2);
    ctx.fill();

    for (let ring = 0; ring < 2; ring++) {
      const rr = hr * gape * (ring === 0 ? 1 : 0.62);
      const teeth = ring === 0 ? 12 : 8;
      const len = hr * (ring === 0 ? 0.22 : 0.16);
      ctx.fillStyle = ring === 0 ? '#FDF3D8' : '#E3CFA4';
      for (let i = 0; i < teeth; i++) {
        const a = (i / teeth) * Math.PI * 2 + this.animationTime * (ring === 0 ? 0.3 : -0.45);
        ctx.save();
        ctx.translate(hx + Math.cos(a) * rr, hy + Math.sin(a) * rr);
        ctx.rotate(a + Math.PI / 2);
        ctx.beginPath();
        ctx.moveTo(-3, 0);
        ctx.lineTo(0, -len);
        ctx.lineTo(3, 0);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }

    // Eye clusters on the shell, above the maw.
    this.glowEye(ctx, hx - hr * 0.72, hy - hr * 0.5, hr * 0.13, this.config.eyeColor);
    this.glowEye(ctx, hx + hr * 0.72, hy - hr * 0.5, hr * 0.13, this.config.eyeColor);

    // Mandibles hinged either side.
    const mandible = Math.sin(this.animationTime * 4) * 0.18;
    ctx.fillStyle = this.adjustColor(this.config.secondaryColor, -40);
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.translate(hx + side * hr * 0.92, hy - hr * 0.1);
      ctx.rotate(side * (0.5 + mandible));
      ctx.beginPath();
      ctx.moveTo(0, -5);
      ctx.quadraticCurveTo(side * 22, -2, side * 26, 10);
      ctx.quadraticCurveTo(side * 16, 2, 0, 5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // Sand spilling off the body.
    ctx.fillStyle = 'rgba(240, 214, 160, 0.5)';
    for (let i = 0; i < 8; i++) {
      const t = (this.animationTime * 1.6 + i * 0.37) % 1;
      ctx.globalAlpha = 0.5 * (1 - t);
      ctx.fillRect(
        hx - hr + (i / 8) * hr * 2,
        hy + hr * 0.5 + t * h * 0.5,
        2,
        5
      );
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    // The mound it burst out of, drawn on top of the buried segments.
    ctx.fillStyle = 'rgba(180, 140, 80, 0.85)';
    ctx.beginPath();
    ctx.ellipse(cx, this.groundY - 4, w * 0.62, 16, 0, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(232, 200, 146, 0.9)';
    ctx.beginPath();
    ctx.ellipse(cx, this.groundY - 6, w * 0.46, 11, 0, Math.PI, Math.PI * 2);
    ctx.fill();
  }

  /** Ancient Treant: a walking trunk with a carved face and a mossy crown. */
  private renderTreantBoss(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    w: number,
    h: number
  ): void {
    const sway = Math.sin(this.animationTime * 1.4) * 4;

    // Roots, splayed at the base.
    ctx.strokeStyle = '#4A3122';
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    for (let i = -2; i <= 2; i++) {
      if (i === 0) continue;
      ctx.beginPath();
      ctx.moveTo(cx, cy + h * 0.32);
      ctx.quadraticCurveTo(
        cx + i * w * 0.14,
        cy + h * 0.42,
        cx + i * w * 0.22,
        cy + h * 0.5
      );
      ctx.stroke();
    }

    // Trunk.
    const bark = ctx.createLinearGradient(cx - w * 0.3, 0, cx + w * 0.3, 0);
    bark.addColorStop(0, '#3E2A1B');
    bark.addColorStop(0.45, '#6B4B2E');
    bark.addColorStop(1, '#2F2013');
    ctx.fillStyle = bark;
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.28, cy + h * 0.36);
    ctx.quadraticCurveTo(cx - w * 0.22, cy - h * 0.1, cx - w * 0.24 + sway, cy - h * 0.3);
    ctx.lineTo(cx + w * 0.24 + sway, cy - h * 0.3);
    ctx.quadraticCurveTo(cx + w * 0.22, cy - h * 0.1, cx + w * 0.28, cy + h * 0.36);
    ctx.closePath();
    ctx.fill();

    // Bark grain.
    ctx.strokeStyle = 'rgba(30, 18, 8, 0.55)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 5; i++) {
      const gx = cx - w * 0.18 + i * w * 0.09;
      ctx.beginPath();
      ctx.moveTo(gx, cy + h * 0.32);
      ctx.quadraticCurveTo(gx + 4, cy, gx + sway * 0.6, cy - h * 0.28);
      ctx.stroke();
    }

    // Branch arms with a knuckle each, swinging slightly out of phase.
    ctx.strokeStyle = '#4A3122';
    ctx.lineWidth = 9;
    for (const side of [-1, 1]) {
      const armWave = Math.sin(this.animationTime * 1.8 + (side > 0 ? 1 : 0)) * 7;
      ctx.beginPath();
      ctx.moveTo(cx + side * w * 0.2, cy - h * 0.02);
      ctx.quadraticCurveTo(
        cx + side * w * 0.42,
        cy - h * 0.1 + armWave,
        cx + side * w * 0.52,
        cy + h * 0.1 + armWave
      );
      ctx.stroke();
      // Fist of twigs.
      ctx.fillStyle = '#5A3D26';
      ctx.beginPath();
      ctx.arc(cx + side * w * 0.52, cy + h * 0.1 + armWave, 9, 0, Math.PI * 2);
      ctx.fill();
    }

    // Canopy crown: overlapping clumps, breathing.
    const breathe = Math.sin(this.animationTime * 1.1) * 2;
    const clumps: [number, number, number, string][] = [
      [-0.3, -0.34, 0.24, this.config.secondaryColor],
      [0.3, -0.34, 0.24, this.config.secondaryColor],
      [-0.14, -0.48, 0.26, this.config.primaryColor],
      [0.16, -0.5, 0.24, this.config.primaryColor],
      [0, -0.6, 0.22, this.config.glowColor],
    ];
    for (const [dx, dy, r, color] of clumps) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(cx + w * dx + sway, cy + h * dy + breathe, w * r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Hanging vines.
    ctx.strokeStyle = this.config.secondaryColor;
    ctx.lineWidth = 3;
    for (let i = 0; i < 4; i++) {
      const vx = cx - w * 0.36 + i * w * 0.24;
      const len = h * (0.12 + (i % 2) * 0.08);
      ctx.beginPath();
      ctx.moveTo(vx, cy - h * 0.28);
      ctx.quadraticCurveTo(vx + Math.sin(this.animationTime * 2 + i) * 5, cy - h * 0.28 + len * 0.6, vx, cy - h * 0.28 + len);
      ctx.stroke();
    }

    // The face, carved into the trunk: hollow sockets and a splintered mouth.
    ctx.fillStyle = '#20150C';
    ctx.beginPath();
    ctx.ellipse(cx - w * 0.12 + sway, cy - h * 0.13, w * 0.09, h * 0.07, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx + w * 0.12 + sway, cy - h * 0.13, w * 0.09, h * 0.07, 0.2, 0, Math.PI * 2);
    ctx.fill();

    this.glowEye(ctx, cx - w * 0.12 + sway, cy - h * 0.13, w * 0.045, this.config.eyeColor);
    this.glowEye(ctx, cx + w * 0.12 + sway, cy - h * 0.13, w * 0.045, this.config.eyeColor);

    ctx.fillStyle = '#20150C';
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.14 + sway, cy + h * 0.04);
    ctx.lineTo(cx + w * 0.14 + sway, cy + h * 0.04);
    ctx.lineTo(cx + w * 0.1 + sway, cy + h * (this.phase === 'rage' ? 0.2 : 0.13));
    ctx.lineTo(cx - w * 0.1 + sway, cy + h * (this.phase === 'rage' ? 0.2 : 0.13));
    ctx.closePath();
    ctx.fill();
    // Splinter teeth.
    ctx.fillStyle = '#8A6A45';
    for (let i = 0; i < 4; i++) {
      const tx = cx - w * 0.11 + i * w * 0.074 + sway;
      ctx.beginPath();
      ctx.moveTo(tx, cy + h * 0.04);
      ctx.lineTo(tx + 4, cy + h * 0.04);
      ctx.lineTo(tx + 2, cy + h * 0.1);
      ctx.closePath();
      ctx.fill();
    }
  }

  /** A pupil that actually glows, used by every boss for its eyes. */
  private glowEye(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    r: number,
    color: string
  ): void {
    ctx.save();
    const glow = ctx.createRadialGradient(x, y, 0, x, y, r * 2.6);
    glow.addColorStop(0, this.hexToRgba(color, 0.6));
    glow.addColorStop(1, this.hexToRgba(color, 0));
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, r * 2.6, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();

    // Slit pupil, so the eye has a direction.
    ctx.fillStyle = 'rgba(20, 5, 5, 0.9)';
    ctx.beginPath();
    ctx.ellipse(x, y, Math.max(0.6, r * 0.34), r * 0.86, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /**
   * The opening, drawn so it cannot be missed: a bright ring closing in as
   * the window runs out, and a chevron pointing down at the landing spot.
   * Without a tell, a timing window is just an invisible rule.
   */
  private renderExposedTell(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    w: number
  ): void {
    if (!this.isExposed()) return;
    const t = this.exposedTimer / this.exposeDuration;

    ctx.save();
    // The ring shrinks toward the boss as the window closes.
    const radius = w * (0.5 + t * 0.32);
    ctx.strokeStyle = '#FFF6C9';
    ctx.globalAlpha = 0.35 + t * 0.4;
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 8]);
    ctx.lineDashOffset = -this.animationTime * 30;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // A down-chevron over the crown: land HERE.
    const bob = Math.sin(this.animationTime * 9) * 4;
    ctx.globalAlpha = 0.55 + Math.abs(Math.sin(this.animationTime * 6)) * 0.45;
    ctx.fillStyle = '#FFF6C9';
    const topY = cy - w * 0.52 - 16 + bob;
    ctx.beginPath();
    ctx.moveTo(cx - 11, topY);
    ctx.lineTo(cx + 11, topY);
    ctx.lineTo(cx, topY + 14);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  /** Rage brow: one shared overlay, so anger reads the same on every boss. */
  private renderRageBrow(ctx: CanvasRenderingContext2D, x: number, y: number, w: number): void {
    if (this.phase !== 'rage') return;
    const eyeY = y + this.size.y * 0.3;
    const spacing = w * 0.3;
    ctx.save();
    ctx.strokeStyle = '#FF4438';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.moveTo(x + w / 2 - spacing - 10, eyeY - 14);
    ctx.lineTo(x + w / 2 - spacing + 10, eyeY - 6);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + w / 2 + spacing + 10, eyeY - 14);
    ctx.lineTo(x + w / 2 + spacing - 10, eyeY - 6);
    ctx.stroke();
    ctx.restore();
  }

  private hexToRgba(hex: string, alpha: number): string {
    const n = parseInt(hex.replace('#', ''), 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
  }

  private renderDefeatExplosions(ctx: CanvasRenderingContext2D): void {
    for (const exp of this.defeatExplosions) {
      const progress = exp.timer / 0.5;
      const alpha = 1 - progress;
      const size = exp.size * (1 + progress);

      ctx.globalAlpha = alpha;
      const gradient = ctx.createRadialGradient(exp.x, exp.y, 0, exp.x, exp.y, size);
      gradient.addColorStop(0, '#FFFFFF');
      gradient.addColorStop(0.3, this.config.glowColor);
      gradient.addColorStop(1, this.config.primaryColor + '00');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(exp.x, exp.y, size, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  private renderIntroText(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.globalAlpha = this.introTextAlpha;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const text = this.config.name.toUpperCase();
    // Clamp to the viewport: the boss enters from off the right edge, and a
    // banner anchored to it was being cut in half on arrival.
    const viewWidth = ctx.canvas?.width ?? 800;
    const cx = Math.max(
      viewWidth * 0.3,
      Math.min(viewWidth * 0.7, this.position.x + this.size.x / 2)
    );
    const textY = Math.max(64, this.position.y - 44);
    const size = 30 * this.introTextScale;

    ctx.font = `bold ${size}px Arial`;
    const width = ctx.measureText(text).width;

    // A solid banner: this has to read on a pale desert sky and a black night
    // skyline alike, so it brings its own background rather than relying on a
    // stroke against whatever happens to be behind it.
    const plateW = width + 64;
    const plateH = size * 2.05;
    const plateY = textY - size * 0.78;

    ctx.fillStyle = 'rgba(8, 10, 18, 0.82)';
    ctx.fillRect(cx - plateW / 2, plateY, plateW, plateH);
    ctx.fillStyle = this.config.secondaryColor;
    ctx.fillRect(cx - plateW / 2, plateY, plateW, 3);
    ctx.fillRect(cx - plateW / 2, plateY + plateH - 3, plateW, 3);

    // Chevrons on the ends, for the arcade-marquee feel.
    ctx.fillStyle = this.config.glowColor;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx + side * (plateW / 2 - 6), plateY + 8);
      ctx.lineTo(cx + side * (plateW / 2 - 22), plateY + plateH / 2);
      ctx.lineTo(cx + side * (plateW / 2 - 6), plateY + plateH - 8);
      ctx.closePath();
      ctx.fill();
    }

    ctx.fillStyle = this.config.glowColor;
    ctx.fillText(text, cx, textY - size * 0.08);

    ctx.font = `bold ${size * 0.38}px Arial`;
    ctx.fillStyle = '#FFFFFF';
    ctx.globalAlpha = this.introTextAlpha * 0.75;
    ctx.fillText('AWAKENS', cx, textY + size * 0.66);
    ctx.restore();
  }

  private renderWindupIndicator(ctx: CanvasRenderingContext2D): void {
    if (!this.pendingAttack) return;

    const progress = this.attackStateTimer / (this.pendingAttack.windupTime * this.config.attackSpeed);
    const cx = this.position.x + this.size.x / 2;
    const cy = this.position.y + this.size.y / 2;

    ctx.save();

    // A ring that fills as the attack charges — the timing read.
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(cx, cy, this.size.x * 0.58, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = '#FF4438';
    ctx.lineCap = 'round';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(cx, cy, this.size.x * 0.58, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
    ctx.stroke();

    // The label says what to DO, not what the boss is called.
    const labels: Record<AttackType, string> = {
      projectile: 'FIREBALL',
      volley: 'VOLLEY',
      groundPound: 'JUMP!',
      charge: 'CHARGING',
      summon: 'SUMMONING',
    };
    const label = labels[this.pendingAttack.type];

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 15px Arial';
    const ly = this.position.y - 16;
    const lw = ctx.measureText(label).width + 16;

    // Flash the plate faster as the windup completes.
    const urgency = 0.55 + Math.abs(Math.sin(progress * Math.PI * 6)) * 0.45;
    ctx.globalAlpha = urgency;
    ctx.fillStyle = '#B91C1C';
    ctx.fillRect(cx - lw / 2, ly - 11, lw, 22);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(label, cx, ly);

    // A pointer down at the boss, so the label is never ambiguous.
    ctx.fillStyle = '#B91C1C';
    ctx.globalAlpha = urgency;
    ctx.beginPath();
    ctx.moveTo(cx - 6, ly + 11);
    ctx.lineTo(cx + 6, ly + 11);
    ctx.lineTo(cx, ly + 18);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  private adjustColor(hex: string, amount: number): string {
    const num = parseInt(hex.replace('#', ''), 16);
    const r = Math.max(0, Math.min(255, ((num >> 16) & 0xff) + amount));
    const g = Math.max(0, Math.min(255, ((num >> 8) & 0xff) + amount));
    const b = Math.max(0, Math.min(255, (num & 0xff) + amount));
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
  }

  // Getters
  getBounds(): Rectangle {
    return new Rectangle(this.position.x, this.position.y, this.size.x, this.size.y);
  }

  /** True while the boss is in its post-attack opening. */
  isExposed(): boolean {
    return this.exposedTimer > 0 && this.phase !== 'intro' && this.phase !== 'defeat';
  }

  isDefeated(): boolean {
    return this.phase === 'defeat';
  }

  isOffScreen(): boolean {
    return this.phase === 'defeat' && this.defeatTimer > 2;
  }

  isCharging(): boolean {
    return this.chargingActive;
  }

  getPhase(): string {
    return this.phase;
  }

  getBossType(): BossType {
    return this.bossType;
  }

  getBossName(): string {
    return this.config.name;
  }

  getBossNumber(): number {
    return this.bossNumber;
  }

  getConfig(): BossConfig {
    return this.config;
  }
}
