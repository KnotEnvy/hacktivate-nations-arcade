import { ROAD } from '../data/constants';

export type EnemyType = 'ram' | 'shooter' | 'armored' | 'patrol';
export type EnemyVisual = 'car' | 'jetboat';

export interface EnemyConfig {
  type: EnemyType;
  forwardSpeed: number;   // cruise forward speed while far ahead of player (px/sec)
  // How much slower than the player this enemy wants to move when adjacent.
  // Smaller delta = hovers closer to the player (more aggressive blocking).
  matchSpeedDelta: number;
  width: number;
  height: number;
  hp: number;
  scoreValue: number;
  coinDrop: number;
  bulletproof: boolean;
  color: string;
  accentColor: string;
  // Shooter-only: projectile speed in px/sec. Omitted for non-firing types.
  bulletSpeed?: number;
}

export const ENEMY_CONFIGS: Record<EnemyType, EnemyConfig> = {
  ram: {
    type: 'ram',
    forwardSpeed: 260,
    matchSpeedDelta: 20,
    width: 42,
    height: 70,
    hp: 1,
    scoreValue: 100,
    coinDrop: 1,
    bulletproof: false,
    color: '#E53935',
    accentColor: '#1a1a2e',
  },
  shooter: {
    type: 'shooter',
    forwardSpeed: 300,
    matchSpeedDelta: 60,
    width: 44,
    height: 74,
    hp: 2,
    scoreValue: 250,
    coinDrop: 2,
    bulletproof: false,
    color: '#FB8C00',
    accentColor: '#1a1a2e',
    bulletSpeed: 520,
  },
  armored: {
    type: 'armored',
    forwardSpeed: 220,
    // Tighter delta than v3 (was 90) so armored hovers closer to the player
    // and enforces its blocking role. Tank still matches tighter at 70.
    matchSpeedDelta: 60,
    width: 58,
    height: 100,
    hp: Infinity,
    scoreValue: 500,
    coinDrop: 4,
    bulletproof: true,
    color: '#2a2a2a',
    accentColor: '#888888',
  },
  // Aquatic weaving patroller — meant for water sections. Sine-path AI,
  // 1 HP, faster than a ram. Fits the jet-boat sprite.
  patrol: {
    type: 'patrol',
    forwardSpeed: 300,
    matchSpeedDelta: 30,
    width: 40,
    height: 68,
    hp: 1,
    scoreValue: 180,
    coinDrop: 2,
    bulletproof: false,
    color: '#00B0C8',
    accentColor: '#FFFFFF',
  },
};

const APPROACH_RANGE = 280; // px of distAhead below which enemies ramp to match
const FORWARD_SPEED_ACCEL = 280; // px/sec^2 — how fast enemy changes its forward speed

// Ram AI — telegraph + commit
const RAM_LOCK_TRIGGER = 300; // distY at which a cruising ram enters lock phase
const RAM_LOCK_DURATION = 0.4; // seconds of telegraph before charge commits
const RAM_CHARGE_LATERAL = 320; // px/sec lateral once committed — faster than the old linear tracker

type RamState = 'cruise' | 'lock' | 'charge';

export class EnemyCar {
  x: number;
  y: number;
  vy = 0;
  alive = true;
  hp: number;
  config: EnemyConfig;
  visual: EnemyVisual;
  // Live forward speed — ramps from cruise toward player-match as the enemy closes in.
  forwardSpeed: number;
  // Shooter-specific
  fireCooldown = 1.2;
  // How many shots per burst. 1 = classic single-shot; 3 = burst variant.
  burstCount = 1;
  // Shots fired so far in the current burst (resets when burst completes).
  shotsInBurst = 0;
  // Wake animation accumulator (jetboat only)
  private wakeT = Math.random() * 1.7;
  // Patrol AI — sine-weave accumulators
  private weaveT = Math.random() * Math.PI * 2;
  private weaveCenterX: number;
  // Ram AI — state machine
  ramState: RamState = 'cruise';
  ramLockTimer = 0;
  ramTargetX = 0;

  constructor(type: EnemyType, x: number, y: number, visual: EnemyVisual = 'car') {
    this.config = ENEMY_CONFIGS[type];
    this.x = x;
    this.y = y;
    this.hp = this.config.hp;
    this.visual = visual;
    this.forwardSpeed = this.config.forwardSpeed;
    this.weaveCenterX = x;
  }

  update(dt: number, playerSpeed: number, playerX: number, playerY: number): void {
    // Spy-Hunter approach: fall in fast while far ahead, then match the player's
    // speed when adjacent so the enemy hovers alongside and tries to block.
    const distAhead = playerY - this.y;
    let targetForward: number;
    if (distAhead > APPROACH_RANGE) {
      targetForward = this.config.forwardSpeed;
    } else {
      const matchTarget = Math.max(
        this.config.forwardSpeed,
        playerSpeed - this.config.matchSpeedDelta,
      );
      const t = Math.max(0, Math.min(1, 1 - distAhead / APPROACH_RANGE));
      targetForward = this.config.forwardSpeed + (matchTarget - this.config.forwardSpeed) * t;
    }
    const maxAccel = FORWARD_SPEED_ACCEL * dt;
    if (this.forwardSpeed < targetForward) {
      this.forwardSpeed = Math.min(targetForward, this.forwardSpeed + maxAccel);
    } else if (this.forwardSpeed > targetForward) {
      this.forwardSpeed = Math.max(targetForward, this.forwardSpeed - maxAccel);
    }

    this.vy = playerSpeed - this.forwardSpeed;
    this.y += this.vy * dt;
    this.wakeT += dt * 1.4;

    if (this.y > 720) this.alive = false;

    if (this.config.type === 'ram') {
      this.updateRamAI(dt, playerX, playerY);
    } else if (this.config.type === 'armored') {
      this.updateArmoredAI(dt, playerX, playerY);
    } else if (this.config.type === 'patrol') {
      this.updatePatrolAI(dt, playerX);
    }
    // Shooter AI handled by EnemySpawner (needs projectile spawning)

    const halfW = this.config.width / 2;
    if (this.x - halfW < ROAD.X_MIN) this.x = ROAD.X_MIN + halfW;
    else if (this.x + halfW > ROAD.X_MAX) this.x = ROAD.X_MAX - halfW;
  }

  private updateRamAI(dt: number, playerX: number, playerY: number): void {
    const distY = playerY - this.y;
    switch (this.ramState) {
      case 'cruise':
        if (distY > 0 && distY < RAM_LOCK_TRIGGER) {
          this.ramState = 'lock';
          this.ramLockTimer = RAM_LOCK_DURATION;
          this.ramTargetX = playerX;
        }
        break;
      case 'lock':
        this.ramLockTimer -= dt;
        if (this.ramLockTimer <= 0) this.ramState = 'charge';
        break;
      case 'charge': {
        const dx = this.ramTargetX - this.x;
        const maxLateral = RAM_CHARGE_LATERAL * dt;
        if (Math.abs(dx) <= maxLateral) this.x = this.ramTargetX;
        else this.x += Math.sign(dx) * maxLateral;
        break;
      }
    }
  }

  private updateArmoredAI(dt: number, playerX: number, playerY: number): void {
    // Armored is a lane-blocker. Lock onto the player's current lane center
    // (not raw X) and sit in it. Only engages once close enough in Y — far-ahead
    // armored stays in its spawn lane so the player can see what to dodge.
    const distY = playerY - this.y;
    if (distY > 420) return;

    const laneWidth = ROAD.WIDTH / ROAD.LANE_COUNT;
    const playerLane = Math.floor((playerX - ROAD.X_MIN) / laneWidth);
    const lane = Math.max(0, Math.min(ROAD.LANE_COUNT - 1, playerLane));
    const targetX = ROAD.X_MIN + laneWidth * (lane + 0.5);

    const dx = targetX - this.x;
    if (Math.abs(dx) < 4) return; // deadband — avoid jitter when parked in lane
    const maxLateral = 110 * dt;
    this.x += Math.max(-maxLateral, Math.min(maxLateral, dx));
  }

  private updatePatrolAI(dt: number, playerX: number): void {
    // Patrol weaves in a sine pattern around a center that drifts toward the player.
    this.weaveT += dt * 2.2;
    const centerDrift = (playerX - this.weaveCenterX) * 0.9 * dt;
    this.weaveCenterX += centerDrift;
    const halfW = this.config.width / 2;
    if (this.weaveCenterX - halfW < ROAD.X_MIN + 40) this.weaveCenterX = ROAD.X_MIN + 40 + halfW;
    else if (this.weaveCenterX + halfW > ROAD.X_MAX - 40) {
      this.weaveCenterX = ROAD.X_MAX - 40 - halfW;
    }
    this.x = this.weaveCenterX + Math.sin(this.weaveT) * 70;
  }

  takeHit(damage: number): boolean {
    if (this.config.bulletproof) return false;
    this.hp -= damage;
    if (this.hp <= 0) {
      this.alive = false;
      return true;
    }
    return false;
  }

  pushOffRoad(): void {
    // Used by ram-into-armored to score the bypass
    this.alive = false;
  }

  getBounds(): { x: number; y: number; w: number; h: number } {
    return {
      x: this.x - this.config.width / 2,
      y: this.y - this.config.height / 2,
      w: this.config.width,
      h: this.config.height,
    };
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (this.visual === 'jetboat') {
      this.renderJetboat(ctx);
      return;
    }
    this.renderCar(ctx);
  }

  private renderCar(ctx: CanvasRenderingContext2D): void {
    const c = this.config;
    const w = c.width;
    const h = c.height;
    const x = this.x - w / 2;
    const y = this.y - h / 2;
    const isRamLocking = c.type === 'ram' && this.ramState === 'lock';
    const lockFlash = isRamLocking && Math.sin(this.ramLockTimer * 40) > 0;
    ctx.save();

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    this.roundRect(ctx, x + 4, y + 5, w, h, 6);
    ctx.fill();

    // Body — flash bright yellow during ram lock telegraph
    ctx.fillStyle = lockFlash ? '#FFEA00' : c.color;
    this.roundRect(ctx, x, y, w, h, 6);
    ctx.fill();

    // Cockpit
    ctx.fillStyle = '#0a0a14';
    this.roundRect(ctx, x + 6, y + 14, w - 12, h - 32, 3);
    ctx.fill();

    // Headlights (front = top, since they drive same direction as us)
    ctx.fillStyle = '#FFFF99';
    ctx.fillRect(x + 4, y + 2, 6, 4);
    ctx.fillRect(x + w - 10, y + 2, 6, 4);

    // Tail lights (back = bottom)
    ctx.fillStyle = '#FF3030';
    ctx.fillRect(x + 6, y + h - 4, 6, 2);
    ctx.fillRect(x + w - 12, y + h - 4, 6, 2);

    // Type-specific accents
    if (c.type === 'ram') {
      // Side spikes
      ctx.fillStyle = c.accentColor;
      ctx.beginPath();
      ctx.moveTo(x, y + h / 2 - 8);
      ctx.lineTo(x - 7, y + h / 2);
      ctx.lineTo(x, y + h / 2 + 8);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x + w, y + h / 2 - 8);
      ctx.lineTo(x + w + 7, y + h / 2);
      ctx.lineTo(x + w, y + h / 2 + 8);
      ctx.fill();
    } else if (c.type === 'armored') {
      // Chrome trim along sides
      ctx.fillStyle = c.accentColor;
      ctx.fillRect(x + 2, y + 6, 3, h - 12);
      ctx.fillRect(x + w - 5, y + 6, 3, h - 12);
      // HP/armor pips
      ctx.fillStyle = '#444';
      ctx.fillRect(x + w / 2 - 10, y + 4, 20, 4);
    } else if (c.type === 'shooter') {
      // Roof-mounted gun
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(x + w / 2 - 3, y + h - 14, 6, 14);
      ctx.fillStyle = '#444';
      ctx.fillRect(x + w / 2 - 2, y + h, 4, 8);
    }

    // Ram lock telegraph — dashed tracer from ram's back bumper toward the
    // committed lane, so the player can read and dodge the charge.
    if (isRamLocking) {
      ctx.strokeStyle = lockFlash ? '#FFEA00' : 'rgba(255,80,80,0.75)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(this.x, y + h);
      ctx.lineTo(this.ramTargetX, y + h + 150);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.restore();
  }

  private renderJetboat(ctx: CanvasRenderingContext2D): void {
    const c = this.config;
    const w = c.width;
    const h = c.height;
    const x = this.x - w / 2;
    const y = this.y - h / 2;

    ctx.save();

    // Trailing wake — short foam burst behind the stern
    ctx.fillStyle = '#FFFFFFCC';
    for (let i = 0; i < 3; i++) {
      const t = (this.wakeT + i * 0.25) % 1;
      const yy = y + h + 4 + t * 28;
      const spread = 3 + t * 10;
      ctx.globalAlpha = 0.55 * (1 - t);
      ctx.fillRect(this.x - spread - 1, yy, 2, 2);
      ctx.fillRect(this.x + spread - 1, yy, 2, 2);
    }
    ctx.globalAlpha = 1;

    // Hull shadow
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    this.jetboatHullPath(ctx, x + 3, y + 5, w, h);
    ctx.fill();

    // Hull body
    ctx.fillStyle = c.color;
    this.jetboatHullPath(ctx, x, y, w, h);
    ctx.fill();

    // Cockpit (smaller and inset, like a speedboat windshield)
    ctx.fillStyle = '#0a0a14';
    ctx.beginPath();
    ctx.ellipse(this.x, y + h * 0.5, w * 0.32, h * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,255,255,0.30)';
    ctx.beginPath();
    ctx.ellipse(this.x, y + h * 0.45, w * 0.26, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Type-specific accents (echo car versions so silhouette telegraphs threat)
    if (c.type === 'ram') {
      // Bow-mounted ram prongs
      ctx.fillStyle = c.accentColor;
      ctx.beginPath();
      ctx.moveTo(x + 4, y + 12);
      ctx.lineTo(x - 4, y + 24);
      ctx.lineTo(x + 8, y + 24);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x + w - 4, y + 12);
      ctx.lineTo(x + w + 4, y + 24);
      ctx.lineTo(x + w - 8, y + 24);
      ctx.fill();
    } else if (c.type === 'armored') {
      // Heavier armored hull plating along sides
      ctx.fillStyle = c.accentColor;
      ctx.fillRect(x + 2, y + 18, 3, h - 28);
      ctx.fillRect(x + w - 5, y + 18, 3, h - 28);
      // Turret mound
      ctx.fillStyle = '#444';
      ctx.beginPath();
      ctx.arc(this.x, y + h * 0.62, 6, 0, Math.PI * 2);
      ctx.fill();
    } else if (c.type === 'shooter') {
      // Stern-mounted gun
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(this.x - 3, y + h - 16, 6, 14);
      ctx.fillStyle = '#444';
      ctx.fillRect(this.x - 2, y + h, 4, 8);
    }

    // Stern outboard motor
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(x + 6, y + h - 5, w - 12, 5);

    ctx.restore();
  }

  private jetboatHullPath(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
  ): void {
    // Pointed bow at top, squared stern at bottom
    const bowDepth = 16;
    ctx.beginPath();
    ctx.moveTo(x + w / 2, y);
    ctx.lineTo(x + w, y + bowDepth);
    ctx.lineTo(x + w, y + h - 3);
    ctx.arcTo(x + w, y + h, x + w - 3, y + h, 3);
    ctx.lineTo(x + 3, y + h);
    ctx.arcTo(x, y + h, x, y + h - 3, 3);
    ctx.lineTo(x, y + bowDepth);
    ctx.closePath();
  }

  private roundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
  ): void {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
}
