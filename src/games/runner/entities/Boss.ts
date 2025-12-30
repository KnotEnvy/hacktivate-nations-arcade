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

const BOSS_CONFIGS: Record<BossType, BossConfig> = {
  sun: {
    name: 'Sun Guardian',
    hp: 10,
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
    hp: 12,
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
    hp: 15,
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
    hp: 18,
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
    hp: 20,
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
    eyeColor: '#DCFCE7'
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
  private readonly introNameTime: number = 1.5;
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

    this.position = new Vector2(x, groundY - 120);
    this.size = new Vector2(80, 80);
    this.velocity = new Vector2(-50, 0);

    // Scale HP based on boss number (for endless progression)
    const hpMultiplier = 1 + Math.floor(themeLevel / 5) * 0.5;
    this.maxHealth = Math.floor(this.config.hp * hpMultiplier);
    this.health = this.maxHealth;

    this.targetY = this.position.y;
  }

  update(dt: number, gameSpeed: number): void {
    this.animationTime += dt;

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
        // Slow entrance from right
        this.velocity.x = -80;
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

        // Subtle hover during name display
        this.position.y = this.groundY - 120 + Math.sin(this.animationTime * 3) * 5;

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
    const waveSpeed = this.phase === 'rage' ? 2 : 1.5;
    const waveAmplitude = this.phase === 'rage' ? 50 : 40;
    this.targetY = this.groundY - 120 + Math.sin(this.movementTimer * waveSpeed) * waveAmplitude;

    const dy = this.targetY - this.position.y;
    this.position.y += dy * dt * 3;

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

  shouldAttack(): boolean {
    // Legacy method - now attacks are queued via consumeAttacks()
    return false;
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

    // Eyes (common to all)
    this.renderEyes(ctx, x, y, w);

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

  private renderSunBoss(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number, h: number): void {
    // Main circle
    ctx.beginPath();
    ctx.arc(cx, cy, w * 0.4, 0, Math.PI * 2);
    ctx.fill();

    // Sun rays
    ctx.fillStyle = this.config.glowColor;
    const rayCount = 12;
    for (let i = 0; i < rayCount; i++) {
      const angle = (i / rayCount) * Math.PI * 2 + this.animationTime * 0.5;
      const innerR = w * 0.4;
      const outerR = w * 0.55 + Math.sin(this.animationTime * 3 + i) * 5;

      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(angle - 0.15) * innerR, cy + Math.sin(angle - 0.15) * innerR);
      ctx.lineTo(cx + Math.cos(angle) * outerR, cy + Math.sin(angle) * outerR);
      ctx.lineTo(cx + Math.cos(angle + 0.15) * innerR, cy + Math.sin(angle + 0.15) * innerR);
      ctx.closePath();
      ctx.fill();
    }
  }

  private renderPhoenixBoss(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number, h: number): void {
    // Body
    ctx.beginPath();
    ctx.ellipse(cx, cy, w * 0.35, h * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Wings
    ctx.fillStyle = this.config.secondaryColor;
    const wingFlap = Math.sin(this.animationTime * 6) * 10;

    // Left wing
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.2, cy);
    ctx.quadraticCurveTo(cx - w * 0.6, cy - h * 0.3 + wingFlap, cx - w * 0.5, cy + h * 0.2);
    ctx.quadraticCurveTo(cx - w * 0.3, cy + h * 0.1, cx - w * 0.2, cy);
    ctx.fill();

    // Right wing
    ctx.beginPath();
    ctx.moveTo(cx + w * 0.2, cy);
    ctx.quadraticCurveTo(cx + w * 0.6, cy - h * 0.3 + wingFlap, cx + w * 0.5, cy + h * 0.2);
    ctx.quadraticCurveTo(cx + w * 0.3, cy + h * 0.1, cx + w * 0.2, cy);
    ctx.fill();

    // Flame tail
    ctx.fillStyle = this.config.glowColor;
    for (let i = 0; i < 3; i++) {
      const flameOffset = Math.sin(this.animationTime * 8 + i) * 5;
      ctx.beginPath();
      ctx.moveTo(cx - 5 + i * 5, cy + h * 0.3);
      ctx.lineTo(cx - 8 + i * 5 + flameOffset, cy + h * 0.5 + i * 5);
      ctx.lineTo(cx + i * 5, cy + h * 0.3);
      ctx.fill();
    }
  }

  private renderShadowBoss(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number, h: number): void {
    // Shadowy body with wavy edges
    ctx.beginPath();
    for (let i = 0; i <= 32; i++) {
      const angle = (i / 32) * Math.PI * 2;
      const waveOffset = Math.sin(angle * 6 + this.animationTime * 3) * 5;
      const r = w * 0.4 + waveOffset;
      const px = cx + Math.cos(angle) * r;
      const py = cy + Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();

    // Dark tendrils
    ctx.strokeStyle = this.config.secondaryColor;
    ctx.lineWidth = 3;
    for (let i = 0; i < 4; i++) {
      const baseAngle = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const wavePhase = this.animationTime * 2 + i;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(baseAngle) * w * 0.3, cy + Math.sin(baseAngle) * h * 0.3);
      ctx.quadraticCurveTo(
        cx + Math.cos(baseAngle + 0.3) * w * 0.5 + Math.sin(wavePhase) * 10,
        cy + Math.sin(baseAngle + 0.3) * h * 0.5,
        cx + Math.cos(baseAngle) * w * 0.6,
        cy + Math.sin(baseAngle) * h * 0.6
      );
      ctx.stroke();
    }
  }

  private renderSandwormBoss(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number, h: number): void {
    // Segmented worm body
    const segments = 5;
    for (let i = segments - 1; i >= 0; i--) {
      const segOffset = Math.sin(this.animationTime * 3 + i * 0.5) * 8;
      const segY = cy + i * 8 - 16;
      const segR = w * (0.4 - i * 0.04);

      ctx.fillStyle = i === 0 ? this.config.primaryColor : this.config.secondaryColor;
      ctx.beginPath();
      ctx.ellipse(cx + segOffset, segY, segR, segR * 0.8, 0, 0, Math.PI * 2);
      ctx.fill();

      // Segment lines
      if (i > 0) {
        ctx.strokeStyle = this.adjustColor(this.config.secondaryColor, -20);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx + segOffset, segY - segR * 0.3, segR * 0.8, 0.2, Math.PI - 0.2);
        ctx.stroke();
      }
    }

    // Mandibles
    ctx.fillStyle = this.adjustColor(this.config.secondaryColor, -40);
    const mandibleAngle = Math.sin(this.animationTime * 4) * 0.2;
    ctx.save();
    ctx.translate(cx - 15, cy - 15);
    ctx.rotate(-0.5 - mandibleAngle);
    ctx.fillRect(0, 0, 20, 6);
    ctx.restore();
    ctx.save();
    ctx.translate(cx + 15, cy - 15);
    ctx.rotate(0.5 + mandibleAngle);
    ctx.fillRect(-20, 0, 20, 6);
    ctx.restore();
  }

  private renderTreantBoss(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number, h: number): void {
    // Tree trunk body
    ctx.fillStyle = '#5D4037';
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.3, cy + h * 0.4);
    ctx.lineTo(cx - w * 0.25, cy - h * 0.3);
    ctx.lineTo(cx + w * 0.25, cy - h * 0.3);
    ctx.lineTo(cx + w * 0.3, cy + h * 0.4);
    ctx.closePath();
    ctx.fill();

    // Bark texture
    ctx.strokeStyle = '#3E2723';
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      const barkY = cy - h * 0.2 + i * 15;
      ctx.beginPath();
      ctx.moveTo(cx - w * 0.2, barkY);
      ctx.lineTo(cx + w * 0.1, barkY + 5);
      ctx.stroke();
    }

    // Foliage crown
    ctx.fillStyle = this.config.primaryColor;
    const leafWave = Math.sin(this.animationTime * 2);
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI - Math.PI / 2;
      const leafX = cx + Math.cos(angle) * w * 0.35;
      const leafY = cy - h * 0.25 + Math.sin(angle) * h * 0.15;
      const leafSize = 15 + Math.sin(this.animationTime * 3 + i) * 3;

      ctx.beginPath();
      ctx.arc(leafX + leafWave * 2, leafY, leafSize, 0, Math.PI * 2);
      ctx.fill();
    }

    // Top foliage
    ctx.beginPath();
    ctx.arc(cx, cy - h * 0.35, w * 0.25, 0, Math.PI * 2);
    ctx.fill();

    // Branch arms
    ctx.strokeStyle = '#5D4037';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.2, cy);
    ctx.lineTo(cx - w * 0.5, cy - h * 0.1 + Math.sin(this.animationTime * 2) * 5);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + w * 0.2, cy);
    ctx.lineTo(cx + w * 0.5, cy - h * 0.1 + Math.sin(this.animationTime * 2 + 1) * 5);
    ctx.stroke();
  }

  private renderEyes(ctx: CanvasRenderingContext2D, x: number, y: number, w: number): void {
    const eyeGlow = Math.sin(this.animationTime * 4) * 0.3 + 0.7;
    const eyeY = y + this.size.y * 0.35;
    const eyeSpacing = w * 0.35;

    ctx.fillStyle = this.config.eyeColor;
    ctx.shadowColor = this.config.eyeColor;
    ctx.shadowBlur = 15;

    // Left eye
    ctx.beginPath();
    ctx.arc(x + w / 2 - eyeSpacing / 2, eyeY, 6, 0, Math.PI * 2);
    ctx.fill();

    // Right eye
    ctx.beginPath();
    ctx.arc(x + w / 2 + eyeSpacing / 2, eyeY, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;

    // Angry eyebrow effect in rage mode
    if (this.phase === 'rage') {
      ctx.strokeStyle = this.config.secondaryColor;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x + w / 2 - eyeSpacing / 2 - 8, eyeY - 10);
      ctx.lineTo(x + w / 2 - eyeSpacing / 2 + 8, eyeY - 6);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x + w / 2 + eyeSpacing / 2 + 8, eyeY - 10);
      ctx.lineTo(x + w / 2 + eyeSpacing / 2 - 8, eyeY - 6);
      ctx.stroke();
    }
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
    ctx.fillStyle = this.config.glowColor;
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 4;
    ctx.font = `bold ${24 * this.introTextScale}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const text = this.config.name.toUpperCase() + ' AWAKENS!';
    const textY = this.position.y - 50;

    ctx.strokeText(text, this.position.x + this.size.x / 2, textY);
    ctx.fillText(text, this.position.x + this.size.x / 2, textY);
    ctx.restore();
  }

  private renderWindupIndicator(ctx: CanvasRenderingContext2D): void {
    if (!this.pendingAttack) return;

    const progress = this.attackStateTimer / (this.pendingAttack.windupTime * this.config.attackSpeed);
    const cx = this.position.x + this.size.x / 2;
    const cy = this.position.y + this.size.y / 2;

    // Charging circle
    ctx.strokeStyle = '#EF4444';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(cx, cy, this.size.x * 0.6, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
    ctx.stroke();

    // Attack type icon
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    let icon = '!';
    switch (this.pendingAttack.type) {
      case 'volley': icon = '!!!'; break;
      case 'groundPound': icon = '▼'; break;
      case 'charge': icon = '→'; break;
      case 'summon': icon = '+'; break;
    }
    ctx.fillText(icon, cx, cy - this.size.y * 0.5);
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

  isDefeated(): boolean {
    return this.phase === 'defeat';
  }

  isOffScreen(): boolean {
    return this.phase === 'defeat' && this.defeatTimer > 2;
  }

  isInIntro(): boolean {
    return this.phase === 'intro';
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

  getAttackPosition(): Vector2 {
    return new Vector2(
      this.position.x,
      this.position.y + this.size.y / 2
    );
  }

  getConfig(): BossConfig {
    return this.config;
  }
}
