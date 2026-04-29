import type { RoadProfile } from '../systems/RoadProfile';

export type EnemyType = 'ram' | 'shooter' | 'enforcer' | 'armored' | 'patrol';
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
  // How hard this vehicle is to shove laterally. Higher = more resistant to
  // bumps. Side-swipe impulse is divided by this number, so a SWAT truck at
  // 6.0 moves a fraction as much as a soft ram at 1.0 from the same hit.
  // The bump-off-the-road kill loop relies on these scaling cleanly:
  //   ram/shooter/patrol  ~1.0  (1-2 bumps off-road)
  //   enforcer            ~2.5  (commit needed — 3-5 bumps with throttle)
  //   armored (SWAT)      ~6.0  (effectively missile-only — many bumps)
  bumpResistance: number;
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
    bumpResistance: 1.0,
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
    bumpResistance: 1.0,
    color: '#FB8C00',
    accentColor: '#1a1a2e',
    bulletSpeed: 520,
  },
  // Mercedes-style armored sedan — Spy-Hunter "Enforcer." Smaller and faster
  // than the SWAT truck, bulletproof to small arms. Bumpable but takes real
  // commitment (resistance 2.5 ≈ 3-5 throttled bumps off the road).
  enforcer: {
    type: 'enforcer',
    forwardSpeed: 250,
    matchSpeedDelta: 50,
    width: 46,
    height: 80,
    hp: Infinity,
    scoreValue: 350,
    coinDrop: 3,
    bulletproof: true,
    bumpResistance: 2.5,
    color: '#1a1a1a',     // gloss black sedan
    accentColor: '#c0c0c0', // chrome trim
  },
  // SWAT truck — heavy near-immovable blocker. Resistance 6.0 means even
  // sustained boost-bumping barely budges it; missiles remain the practical
  // answer. Slowed in v5 so it sits further back than the enforcer.
  armored: {
    type: 'armored',
    forwardSpeed: 180,
    matchSpeedDelta: 80,
    width: 58,
    height: 100,
    hp: Infinity,
    scoreValue: 500,
    coinDrop: 4,
    bulletproof: true,
    bumpResistance: 6.0,
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
    bumpResistance: 1.0,
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

// Bump physics — Spy-Hunter knockoff loop. bumpVx is a transient lateral
// velocity injected by side-swipes that decays via friction. While it's
// non-trivial, AI lateral motion suspends and the road clamp releases so
// the enemy can actually slide off the road.
const BUMP_FRICTION = 240;        // px/sec^2 lateral deceleration
const BUMP_AI_SUPPRESS = 30;      // |bumpVx| threshold above which AI lateral suspends
const BUMP_COOLDOWN = 0.12;       // s between successive bumps to the same enemy

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
  // Bump physics — see BUMP_FRICTION / BUMP_COOLDOWN above
  bumpVx = 0;
  private bumpCooldown = 0;
  private roadProfile: RoadProfile;

  constructor(
    type: EnemyType,
    x: number,
    y: number,
    roadProfile: RoadProfile,
    visual: EnemyVisual = 'car',
  ) {
    this.config = ENEMY_CONFIGS[type];
    this.x = x;
    this.y = y;
    this.hp = this.config.hp;
    this.visual = visual;
    this.forwardSpeed = this.config.forwardSpeed;
    this.weaveCenterX = x;
    this.roadProfile = roadProfile;
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

    // AI lateral motion — suspended while a fresh bump is sliding the enemy.
    // (Otherwise armored types would fight back against every shove via their
    // lane-lock and the bump-off-road loop becomes impossibly slow.)
    if (Math.abs(this.bumpVx) < BUMP_AI_SUPPRESS) {
      if (this.config.type === 'ram') {
        this.updateRamAI(dt, playerX, playerY);
      } else if (this.config.type === 'armored' || this.config.type === 'enforcer') {
        // Both share the lane-blocker behavior — enforcer is just smaller/faster cruise.
        this.updateArmoredAI(dt, playerX, playerY);
      } else if (this.config.type === 'patrol') {
        this.updatePatrolAI(dt, playerX);
      }
      // Shooter AI handled by EnemySpawner (needs projectile spawning)
    }

    // Apply bump impulse and decay it linearly toward zero
    this.x += this.bumpVx * dt;
    if (this.bumpVx > 0) {
      this.bumpVx = Math.max(0, this.bumpVx - BUMP_FRICTION * dt);
    } else if (this.bumpVx < 0) {
      this.bumpVx = Math.min(0, this.bumpVx + BUMP_FRICTION * dt);
    }
    if (this.bumpCooldown > 0) {
      this.bumpCooldown = Math.max(0, this.bumpCooldown - dt);
    }

    // Road clamp — only when the enemy isn't actively being shoved. Releasing
    // the clamp during a bump is what lets a hard side-swipe carry the enemy
    // fully off the road instead of wedging them at the edge. The off-road
    // kill check itself happens up in SpeedRacerGame after spawner.update.
    const halfW = this.config.width / 2;
    if (Math.abs(this.bumpVx) < BUMP_AI_SUPPRESS) {
      const shape = this.roadProfile.shapeAtScreen(this.y);
      if (this.x - halfW < shape.xMin) this.x = shape.xMin + halfW;
      else if (this.x + halfW > shape.xMax) this.x = shape.xMax - halfW;
    }
  }

  // Side-swipe impulse from SpeedRacerGame. Applied force is divided by the
  // type's bumpResistance, so a soft ram skids a lot from the same hit that
  // barely nudges a SWAT truck. Cooldown prevents stacking from successive
  // overlap frames before the slide separates the bodies.
  applyBump(forceVx: number): void {
    if (this.bumpCooldown > 0) return;
    this.bumpVx += forceVx / this.config.bumpResistance;
    this.bumpCooldown = BUMP_COOLDOWN;
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

    // Lane geometry is queried at the player's row so the blocker matches the
    // road the player is currently driving on (relevant once dynamic-width
    // sections land — the player's lane count may differ from the enemy's).
    const playerShape = this.roadProfile.shapeAtPlayer();
    const laneCount = this.roadProfile.laneCountAtScreen(playerY);
    const laneWidth = (playerShape.xMax - playerShape.xMin) / laneCount;
    const playerLane = Math.floor((playerX - playerShape.xMin) / laneWidth);
    const lane = Math.max(0, Math.min(laneCount - 1, playerLane));
    const targetX = this.roadProfile.laneCenterAtScreen(playerY, lane);

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
    const shape = this.roadProfile.shapeAtScreen(this.y);
    // Inset 40px from each edge so the weave doesn't slap the player against the wall.
    const innerMin = shape.xMin + 40;
    const innerMax = shape.xMax - 40;
    if (this.weaveCenterX - halfW < innerMin) this.weaveCenterX = innerMin + halfW;
    else if (this.weaveCenterX + halfW > innerMax) {
      this.weaveCenterX = innerMax - halfW;
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

    // Shadow (shared — a soft blob under the chassis)
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    this.roundRect(ctx, x + 4, y + 5, w, h, 6);
    ctx.fill();

    if (c.type === 'ram') this.drawRamCar(ctx, x, y, w, h, lockFlash);
    else if (c.type === 'shooter') this.drawShooterCar(ctx, x, y, w, h);
    else if (c.type === 'enforcer') this.drawEnforcerCar(ctx, x, y, w, h);
    else if (c.type === 'armored') this.drawArmoredCar(ctx, x, y, w, h);
    else {
      // Patrol falls back to the old rounded-rect — only spawns on water anyway
      ctx.fillStyle = c.color;
      this.roundRect(ctx, x, y, w, h, 6);
      ctx.fill();
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

  // --- Muscle-car ram. Wedge hood, hood scoop, protruding bull bar, side spikes,
  // exposed exhausts, angry slanted headlights. Body flashes yellow during lock.
  private drawRamCar(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    lockFlash: boolean,
  ): void {
    const c = this.config;
    const bodyColor = lockFlash ? '#FFEA00' : c.color;
    const cx = x + w / 2;

    // Bull bar — thin horizontal bar protruding above the bow with two vertical grips.
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(x + 4, y - 5, w - 8, 4);
    ctx.fillRect(x + 10, y - 10, 3, 8);
    ctx.fillRect(x + w - 13, y - 10, 3, 8);

    // Side spikes — aggressive forward-angled triangles
    ctx.fillStyle = c.accentColor;
    ctx.beginPath();
    ctx.moveTo(x, y + h * 0.35);
    ctx.lineTo(x - 8, y + h * 0.5);
    ctx.lineTo(x, y + h * 0.65);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + w, y + h * 0.35);
    ctx.lineTo(x + w + 8, y + h * 0.5);
    ctx.lineTo(x + w, y + h * 0.65);
    ctx.closePath();
    ctx.fill();

    // Body — wedge silhouette: narrower at the bow, wider from cabin back.
    ctx.fillStyle = bodyColor;
    ctx.beginPath();
    ctx.moveTo(x + 6, y + 2);            // bow-left shoulder
    ctx.lineTo(x + w - 6, y + 2);        // bow-right shoulder
    ctx.lineTo(x + w - 2, y + 18);       // right fender kick
    ctx.lineTo(x + w, y + 22);
    ctx.lineTo(x + w, y + h - 4);
    ctx.arcTo(x + w, y + h, x + w - 4, y + h, 4);
    ctx.lineTo(x + 4, y + h);
    ctx.arcTo(x, y + h, x, y + h - 4, 4);
    ctx.lineTo(x, y + 22);
    ctx.lineTo(x + 2, y + 18);           // left fender kick
    ctx.closePath();
    ctx.fill();

    // Hood scoop — raised rectangle with a dark intake slot
    ctx.fillStyle = '#3a0808';
    ctx.fillRect(cx - 7, y + 6, 14, 10);
    ctx.fillStyle = '#0a0000';
    ctx.fillRect(cx - 5, y + 9, 10, 4);

    // Black racing stripes down the hood
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(cx - 9, y + 2, 2, h - 18);
    ctx.fillRect(cx + 7, y + 2, 2, h - 18);

    // Angular slanted headlights — two narrow trapezoids
    ctx.fillStyle = lockFlash ? '#FFFFFF' : '#FFE060';
    ctx.beginPath();
    ctx.moveTo(x + 4, y + 2);
    ctx.lineTo(x + 12, y + 2);
    ctx.lineTo(x + 11, y + 8);
    ctx.lineTo(x + 5, y + 7);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + w - 12, y + 2);
    ctx.lineTo(x + w - 4, y + 2);
    ctx.lineTo(x + w - 5, y + 7);
    ctx.lineTo(x + w - 11, y + 8);
    ctx.closePath();
    ctx.fill();

    // Cockpit (short, aggressive rake)
    ctx.fillStyle = '#0a0a14';
    this.roundRect(ctx, x + 6, y + 22, w - 12, h - 42, 3);
    ctx.fill();
    // Windshield highlight
    ctx.fillStyle = 'rgba(255,100,100,0.22)';
    ctx.fillRect(x + 9, y + 24, w - 18, 4);

    // Exposed twin exhausts at the stern flanks
    ctx.fillStyle = '#3a3a3a';
    ctx.fillRect(x + 4, y + h - 3, 6, 5);
    ctx.fillRect(x + w - 10, y + h - 3, 6, 5);
    ctx.fillStyle = '#1a0a0a';
    ctx.fillRect(x + 5, y + h - 2, 4, 3);
    ctx.fillRect(x + w - 9, y + h - 2, 4, 3);

    // Tail lights above the bumper
    ctx.fillStyle = '#FF3030';
    ctx.fillRect(x + 10, y + h - 8, 8, 3);
    ctx.fillRect(x + w - 18, y + h - 8, 8, 3);
  }

  // --- Sniper shooter. Boxy utility body, roof turret + radar, armored grille,
  // hazard stripes on the fenders.
  private drawShooterCar(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
  ): void {
    const c = this.config;
    const cx = x + w / 2;

    // Body — flat-fronted SUV silhouette
    ctx.fillStyle = c.color;
    this.roundRect(ctx, x, y, w, h, 4);
    ctx.fill();

    // Front armored grille — black horizontal bars
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(x + 4, y, w - 8, 10);
    ctx.fillStyle = '#FB8C00';
    for (let i = 0; i < 3; i++) {
      ctx.fillRect(x + 6, y + 2 + i * 3, w - 12, 1);
    }

    // Hazard stripes — black diagonals along lower flanks
    ctx.fillStyle = '#1a1a1a';
    ctx.save();
    ctx.beginPath();
    ctx.rect(x + 2, y + h - 12, w - 4, 8);
    ctx.clip();
    for (let i = -2; i < w / 4 + 1; i++) {
      const bx = x + i * 8;
      ctx.beginPath();
      ctx.moveTo(bx, y + h - 4);
      ctx.lineTo(bx + 4, y + h - 12);
      ctx.lineTo(bx + 8, y + h - 12);
      ctx.lineTo(bx + 4, y + h - 4);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // Headlights — small rectangular LEDs
    ctx.fillStyle = '#FFFFAA';
    ctx.fillRect(x + 4, y + 1, 5, 3);
    ctx.fillRect(x + w - 9, y + 1, 5, 3);

    // Narrow cockpit window — smaller relative to body
    ctx.fillStyle = '#0a0a14';
    this.roundRect(ctx, x + 8, y + 18, w - 16, 18, 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,200,120,0.22)';
    ctx.fillRect(x + 10, y + 20, w - 20, 4);

    // Roof turret base — cylinder viewed from above (ellipse)
    ctx.fillStyle = '#2a2a2a';
    ctx.beginPath();
    ctx.ellipse(cx, y + h * 0.65, 10, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    // Turret ring highlight
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(cx, y + h * 0.65, 10, 7, 0, 0, Math.PI * 2);
    ctx.stroke();
    // Barrel protrudes forward
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(cx - 2, y + h * 0.65 - 14, 4, 14);
    ctx.fillStyle = '#444';
    ctx.fillRect(cx - 1.5, y + h * 0.65 - 16, 3, 3);

    // Side radar antenna — triangle on the right flank
    ctx.fillStyle = '#888';
    ctx.beginPath();
    ctx.moveTo(x + w - 3, y + h * 0.35);
    ctx.lineTo(x + w + 4, y + h * 0.4);
    ctx.lineTo(x + w - 3, y + h * 0.45);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + w - 3, y + h * 0.4);
    ctx.lineTo(x + w + 4, y + h * 0.4);
    ctx.stroke();

    // Tail lights
    ctx.fillStyle = '#FF3030';
    ctx.fillRect(x + 4, y + h - 3, 6, 2);
    ctx.fillRect(x + w - 10, y + h - 3, 6, 2);
  }

  // --- SWAT / armored truck. Boxy vertical sides, brush guard at bow, roof
  // strobe bar, rivets, small windshield. Visual weight matches bulletproof HP.
  private drawArmoredCar(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
  ): void {
    const c = this.config;
    const cx = x + w / 2;

    // Brush guard — 3 horizontal bars protruding past the bow
    ctx.fillStyle = '#888';
    for (let i = 0; i < 3; i++) {
      ctx.fillRect(x + 6, y - 6 + i * 2, w - 12, 1.5);
    }
    // Guard verticals
    ctx.fillStyle = '#aaa';
    ctx.fillRect(x + 8, y - 8, 2, 10);
    ctx.fillRect(cx - 1, y - 8, 2, 10);
    ctx.fillRect(x + w - 10, y - 8, 2, 10);

    // Body — boxy, flat sides
    ctx.fillStyle = c.color;
    this.roundRect(ctx, x, y, w, h, 3);
    ctx.fill();

    // Armor panel seam up the center
    ctx.strokeStyle = '#0a0a0a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx, y + 8);
    ctx.lineTo(cx, y + h - 8);
    ctx.stroke();

    // Rivet studs — two columns down each side
    ctx.fillStyle = '#999';
    for (let i = 0; i < 5; i++) {
      const ry = y + 14 + i * ((h - 28) / 4);
      ctx.beginPath();
      ctx.arc(x + 6, ry, 1.5, 0, Math.PI * 2);
      ctx.arc(x + w - 6, ry, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Hood — angled armor plates (two trapezoids)
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.moveTo(x + 4, y + 2);
    ctx.lineTo(cx - 1, y + 2);
    ctx.lineTo(cx - 1, y + 14);
    ctx.lineTo(x + 8, y + 14);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx + 1, y + 2);
    ctx.lineTo(x + w - 4, y + 2);
    ctx.lineTo(x + w - 8, y + 14);
    ctx.lineTo(cx + 1, y + 14);
    ctx.closePath();
    ctx.fill();

    // Tiny armored windshield — shallow slit
    ctx.fillStyle = '#050510';
    ctx.fillRect(x + 10, y + h * 0.4, w - 20, 10);
    ctx.fillStyle = 'rgba(100,180,255,0.25)';
    ctx.fillRect(x + 12, y + h * 0.4 + 1, w - 24, 3);

    // Roof strobe bar — red + blue segmented
    const barY = y + h * 0.68;
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(cx - 14, barY, 28, 6);
    ctx.fillStyle = '#FF1030';
    ctx.fillRect(cx - 13, barY + 1, 12, 4);
    ctx.fillStyle = '#1060FF';
    ctx.fillRect(cx + 1, barY + 1, 12, 4);

    // Rear cargo doors — horizontal seam
    ctx.strokeStyle = '#0a0a0a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + 6, y + h - 14);
    ctx.lineTo(x + w - 6, y + h - 14);
    ctx.stroke();

    // Tail lights
    ctx.fillStyle = '#FF3030';
    ctx.fillRect(x + 6, y + h - 4, 8, 2);
    ctx.fillRect(x + w - 14, y + h - 4, 8, 2);
  }

  // --- Enforcer sedan. Sleek black armored Mercedes-style coupe: long hood,
  // raked windshield, chrome trim, tinted glass, low stance. Bulletproof but
  // bumpable with momentum (handled in SpeedRacerGame collision).
  private drawEnforcerCar(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
  ): void {
    const c = this.config;
    const cx = x + w / 2;

    // Body — sedan silhouette, slight bow taper, rounded corners
    ctx.fillStyle = c.color;
    ctx.beginPath();
    ctx.moveTo(x + 4, y + 4);
    ctx.lineTo(x + w - 4, y + 4);
    ctx.arcTo(x + w, y + 4, x + w, y + 12, 4);
    ctx.lineTo(x + w, y + h - 4);
    ctx.arcTo(x + w, y + h, x + w - 4, y + h, 4);
    ctx.lineTo(x + 4, y + h);
    ctx.arcTo(x, y + h, x, y + h - 4, 4);
    ctx.lineTo(x, y + 12);
    ctx.arcTo(x, y + 4, x + 4, y + 4, 4);
    ctx.closePath();
    ctx.fill();

    // Long hood — slightly raised charcoal panel up front
    ctx.fillStyle = '#0a0a0a';
    this.roundRect(ctx, x + 6, y + 4, w - 12, h * 0.32, 3);
    ctx.fill();
    // Hood centerline crease
    ctx.strokeStyle = '#3a3a3a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx, y + 6);
    ctx.lineTo(cx, y + h * 0.34);
    ctx.stroke();

    // Chrome grille — narrow horizontal slat at the bow
    ctx.fillStyle = c.accentColor;
    ctx.fillRect(x + 10, y + 7, w - 20, 2);
    // Chrome emblem dot in the center of the grille
    ctx.beginPath();
    ctx.arc(cx, y + 12, 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Headlights — narrow rectangular slits (LED-style)
    ctx.fillStyle = '#FFE066';
    ctx.fillRect(x + 5, y + 5, 8, 2);
    ctx.fillRect(x + w - 13, y + 5, 8, 2);

    // Raked windshield — dark tinted glass with cyan reflection band
    ctx.fillStyle = '#050510';
    ctx.beginPath();
    ctx.moveTo(x + 8, y + h * 0.36);
    ctx.lineTo(x + w - 8, y + h * 0.36);
    ctx.lineTo(x + w - 10, y + h * 0.5);
    ctx.lineTo(x + 10, y + h * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(120,200,255,0.22)';
    ctx.fillRect(x + 10, y + h * 0.38, w - 20, 3);

    // Roof — slightly inset darker panel
    ctx.fillStyle = '#0d0d0d';
    this.roundRect(ctx, x + 8, y + h * 0.5, w - 16, h * 0.18, 3);
    ctx.fill();

    // Rear window — mirror the windshield, smaller
    ctx.fillStyle = '#050510';
    ctx.beginPath();
    ctx.moveTo(x + 10, y + h * 0.68);
    ctx.lineTo(x + w - 10, y + h * 0.68);
    ctx.lineTo(x + w - 8, y + h * 0.78);
    ctx.lineTo(x + 8, y + h * 0.78);
    ctx.closePath();
    ctx.fill();

    // Chrome side trim — thin strips along each flank
    ctx.fillStyle = c.accentColor;
    ctx.fillRect(x + 1, y + h * 0.5, 2, h * 0.28);
    ctx.fillRect(x + w - 3, y + h * 0.5, 2, h * 0.28);

    // Door seam — vertical line at mid-body
    ctx.strokeStyle = '#3a3a3a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + 4, y + h * 0.55);
    ctx.lineTo(x + 4, y + h * 0.78);
    ctx.moveTo(x + w - 4, y + h * 0.55);
    ctx.lineTo(x + w - 4, y + h * 0.78);
    ctx.stroke();

    // Trunk — short panel at the rear with a subtle seam
    ctx.strokeStyle = '#3a3a3a';
    ctx.beginPath();
    ctx.moveTo(x + 6, y + h - 14);
    ctx.lineTo(x + w - 6, y + h - 14);
    ctx.stroke();

    // Tail lights — sleek red strips
    ctx.fillStyle = '#FF1530';
    ctx.fillRect(x + 4, y + h - 5, w * 0.35, 2);
    ctx.fillRect(x + w - 4 - w * 0.35, y + h - 5, w * 0.35, 2);
  }

  private renderJetboat(ctx: CanvasRenderingContext2D): void {
    const c = this.config;
    const w = c.width;
    const h = c.height;
    const x = this.x - w / 2;
    const y = this.y - h / 2;
    const isRamLocking = c.type === 'ram' && this.ramState === 'lock';
    const lockFlash = isRamLocking && Math.sin(this.ramLockTimer * 40) > 0;

    ctx.save();

    // Trailing wake (shared — foam burst from stern)
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

    if (c.type === 'ram') this.drawRamBoat(ctx, x, y, w, h, lockFlash);
    else if (c.type === 'shooter') this.drawShooterBoat(ctx, x, y, w, h);
    else if (c.type === 'enforcer') this.drawEnforcerBoat(ctx, x, y, w, h);
    else if (c.type === 'armored') this.drawArmoredBoat(ctx, x, y, w, h);
    else if (c.type === 'patrol') this.drawPatrolBoat(ctx, x, y, w, h);

    // Ram lock tracer — mirror the car version so water-section rams telegraph too
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

  // --- Ram jet-ski. Narrow aggressive PWC with bow prongs, visible handlebars,
  // red hull. Flashes yellow during lock phase like the road ram.
  private drawRamBoat(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    lockFlash: boolean,
  ): void {
    const c = this.config;
    const cx = x + w / 2;

    // Bow prongs — splayed wider than car version, more menacing
    ctx.fillStyle = c.accentColor;
    ctx.beginPath();
    ctx.moveTo(cx - 4, y + 4);
    ctx.lineTo(x - 6, y + 26);
    ctx.lineTo(x + 8, y + 22);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx + 4, y + 4);
    ctx.lineTo(x + w + 6, y + 26);
    ctx.lineTo(x + w - 8, y + 22);
    ctx.closePath();
    ctx.fill();

    // Hull — pointed PWC shape
    ctx.fillStyle = lockFlash ? '#FFEA00' : c.color;
    this.jetboatHullPath(ctx, x, y, w, h);
    ctx.fill();

    // Dark stripe down the centerline
    ctx.fillStyle = '#3a0808';
    ctx.fillRect(cx - 2, y + 18, 4, h - 28);

    // Handlebars — two short black grips ahead of the seat
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(cx - 12, y + h * 0.42, 8, 3);
    ctx.fillRect(cx + 4, y + h * 0.42, 8, 3);

    // Seat — elongated oval for the rider position
    ctx.fillStyle = '#0a0a14';
    ctx.beginPath();
    ctx.ellipse(cx, y + h * 0.58, w * 0.22, h * 0.16, 0, 0, Math.PI * 2);
    ctx.fill();
    // Red chrome accent on the seat
    ctx.fillStyle = 'rgba(255,50,50,0.4)';
    ctx.beginPath();
    ctx.ellipse(cx, y + h * 0.55, w * 0.18, 2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Jet nozzle at the stern — chrome ring
    ctx.fillStyle = '#888';
    ctx.beginPath();
    ctx.arc(cx, y + h - 4, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0a0a14';
    ctx.beginPath();
    ctx.arc(cx, y + h - 4, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // --- Shooter patrol boat. Longer superstructure, radar mast, stern gun on
  // a swivel, orange hull with a black stripe.
  private drawShooterBoat(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
  ): void {
    const c = this.config;
    const cx = x + w / 2;

    // Hull
    ctx.fillStyle = c.color;
    this.jetboatHullPath(ctx, x, y, w, h);
    ctx.fill();

    // Hazard stripe (black) wrapping the bow
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.moveTo(cx, y + 4);
    ctx.lineTo(x + w - 4, y + 16);
    ctx.lineTo(x + w - 4, y + 22);
    ctx.lineTo(cx, y + 10);
    ctx.lineTo(x + 4, y + 22);
    ctx.lineTo(x + 4, y + 16);
    ctx.closePath();
    ctx.fill();

    // Pilothouse — squared cabin in the middle of the hull
    ctx.fillStyle = '#1a1a2e';
    this.roundRect(ctx, x + 8, y + h * 0.36, w - 16, h * 0.3, 2);
    ctx.fill();
    // Pilothouse window band
    ctx.fillStyle = 'rgba(255,200,120,0.35)';
    ctx.fillRect(x + 10, y + h * 0.4, w - 20, 4);

    // Radar mast — thin vertical pole with a crossbar up top
    ctx.fillStyle = '#888';
    ctx.fillRect(cx - 0.5, y + h * 0.2, 1, 18);
    ctx.fillRect(cx - 6, y + h * 0.22, 12, 1.5);
    // Radar dish at the top
    ctx.beginPath();
    ctx.arc(cx, y + h * 0.2, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#444';
    ctx.beginPath();
    ctx.arc(cx, y + h * 0.2, 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Stern-mounted machine gun on a swivel post
    ctx.fillStyle = '#2a2a2a';
    ctx.beginPath();
    ctx.arc(cx, y + h * 0.82, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(cx - 1.5, y + h * 0.82 - 10, 3, 10);
    // Barrel tip
    ctx.fillStyle = '#3a3a3a';
    ctx.fillRect(cx - 1, y + h * 0.82 - 12, 2, 3);

    // Stern outboard motor
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(x + 6, y + h - 5, w - 12, 5);
  }

  // --- Armored gunship boat. Beefy hull, armored superstructure, foredeck
  // turret dome, chunky cleats, dark palette with chrome studs.
  private drawArmoredBoat(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
  ): void {
    const c = this.config;
    const cx = x + w / 2;

    // Hull
    ctx.fillStyle = c.color;
    this.jetboatHullPath(ctx, x, y, w, h);
    ctx.fill();

    // Armored side plating running full length
    ctx.fillStyle = c.accentColor;
    ctx.fillRect(x + 2, y + 16, 3, h - 24);
    ctx.fillRect(x + w - 5, y + 16, 3, h - 24);

    // Chrome rivet studs along the plating
    ctx.fillStyle = '#bbb';
    for (let i = 0; i < 4; i++) {
      const ry = y + 22 + i * ((h - 36) / 3);
      ctx.beginPath();
      ctx.arc(x + 3.5, ry, 1.2, 0, Math.PI * 2);
      ctx.arc(x + w - 3.5, ry, 1.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Foredeck turret dome — big hemispherical cap at the bow
    ctx.fillStyle = '#3a3a3a';
    ctx.beginPath();
    ctx.ellipse(cx, y + h * 0.3, 10, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    // Barrel pointing forward
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(cx - 2, y + h * 0.3 - 14, 4, 14);
    // Cap on the barrel
    ctx.fillStyle = '#555';
    ctx.fillRect(cx - 2.5, y + h * 0.3 - 16, 5, 3);

    // Superstructure — blocky cabin aft of the turret
    ctx.fillStyle = '#0a0a14';
    this.roundRect(ctx, x + 8, y + h * 0.5, w - 16, h * 0.24, 2);
    ctx.fill();
    // Cabin viewport — narrow slit
    ctx.fillStyle = 'rgba(120,180,255,0.28)';
    ctx.fillRect(x + 10, y + h * 0.54, w - 20, 3);

    // Cleat bollards at the stern
    ctx.fillStyle = '#bbb';
    ctx.fillRect(x + 8, y + h - 12, 4, 6);
    ctx.fillRect(x + w - 12, y + h - 12, 4, 6);

    // Stern plate
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(x + 6, y + h - 5, w - 12, 5);
  }

  // --- Enforcer-class patrol cruiser. Sleek black armored boat with chrome
  // trim mirroring the road sedan. Bulletproof but bumpable with momentum.
  private drawEnforcerBoat(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
  ): void {
    const c = this.config;
    const cx = x + w / 2;

    // Hull — black, pointed bow
    ctx.fillStyle = c.color;
    this.jetboatHullPath(ctx, x, y, w, h);
    ctx.fill();

    // Chrome rub-rail running the length of each gunwale
    ctx.fillStyle = c.accentColor;
    ctx.fillRect(x + 1, y + 18, 2, h - 26);
    ctx.fillRect(x + w - 3, y + 18, 2, h - 26);

    // Foredeck — slightly lighter charcoal panel
    ctx.fillStyle = '#0a0a0a';
    ctx.beginPath();
    ctx.moveTo(cx, y + 4);
    ctx.lineTo(x + w - 6, y + h * 0.28);
    ctx.lineTo(x + 6, y + h * 0.28);
    ctx.closePath();
    ctx.fill();

    // Chrome bow accent
    ctx.fillStyle = c.accentColor;
    ctx.fillRect(cx - 1, y + 6, 2, 8);

    // Pilothouse — low-profile dark cabin with raked tinted windshield
    ctx.fillStyle = '#050510';
    this.roundRect(ctx, x + 8, y + h * 0.36, w - 16, h * 0.32, 3);
    ctx.fill();
    // Cyan reflection band on the windshield
    ctx.fillStyle = 'rgba(120,200,255,0.3)';
    ctx.fillRect(x + 10, y + h * 0.4, w - 20, 3);
    // Chrome window frame
    ctx.strokeStyle = c.accentColor;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 8, y + h * 0.36, w - 16, h * 0.32);

    // Aft deck — thin chrome rail
    ctx.fillStyle = c.accentColor;
    ctx.fillRect(x + 10, y + h * 0.74, w - 20, 1.5);

    // Stern light strip — red
    ctx.fillStyle = '#FF1530';
    ctx.fillRect(x + 8, y + h - 4, w - 16, 1.5);

    // Stern plate
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(x + 6, y + h - 3, w - 12, 3);
  }

  // --- Patrol hydrofoil. Sleek, minimalist, twin-hulled look. The sine-weave
  // AI personality — fast and aquatic.
  private drawPatrolBoat(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
  ): void {
    const c = this.config;
    const cx = x + w / 2;

    // Twin hulls — two narrow elongated ellipses flanking a center gap
    ctx.fillStyle = c.color;
    ctx.beginPath();
    ctx.ellipse(cx - w * 0.18, y + h * 0.5, w * 0.16, h * 0.44, 0, 0, Math.PI * 2);
    ctx.ellipse(cx + w * 0.18, y + h * 0.5, w * 0.16, h * 0.44, 0, 0, Math.PI * 2);
    ctx.fill();

    // Foil connecting strut — narrow bar linking the hulls near the bow
    ctx.fillStyle = '#0a3a48';
    ctx.fillRect(x + 4, y + h * 0.25, w - 8, 3);

    // Cockpit pod — oval in the center gap
    ctx.fillStyle = '#0a0a14';
    ctx.beginPath();
    ctx.ellipse(cx, y + h * 0.52, w * 0.15, h * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(100,220,255,0.4)';
    ctx.beginPath();
    ctx.ellipse(cx, y + h * 0.46, w * 0.12, 2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Accent trim on each hull
    ctx.fillStyle = c.accentColor;
    ctx.fillRect(cx - w * 0.25, y + h * 0.35, 2, h * 0.3);
    ctx.fillRect(cx + w * 0.23, y + h * 0.35, 2, h * 0.3);

    // Twin jet plumes — small foam puffs between the hulls (extra wake)
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    for (let i = 0; i < 2; i++) {
      const t = (this.wakeT * 1.2 + i * 0.4) % 1;
      const py = y + h + t * 20;
      ctx.globalAlpha = 0.5 * (1 - t);
      ctx.fillRect(cx - 4, py, 2, 2);
      ctx.fillRect(cx + 2, py, 2, 2);
    }
    ctx.globalAlpha = 1;
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
