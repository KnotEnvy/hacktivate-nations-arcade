// Additional boss units used by BossSpawner alongside BombChopper:
//   - Tank: heavy armored blocker. Missile-kills only. Fires shells.
//   - TankShell: projectile fired by Tank.
//   - Drone: fast low-HP unit that hovers, then swoops. Bullets or missiles kill.
//
// All share lightweight "alive / update / render / getBounds / takeHit" shapes
// so SpeedRacerGame can resolve collisions uniformly.

import type { RoadProfile } from '../systems/RoadProfile';

export const TANK_SCORE_REWARD = 2500;
export const TANK_COIN_REWARD = 55;
export const DRONE_SCORE_REWARD = 200;
export const DRONE_COIN_REWARD = 4;

const TANK_WIDTH = 88;
const TANK_HEIGHT = 120;
const TANK_HP = 3;
const TANK_CRUISE_SPEED = 240;            // while far ahead of player
const TANK_MATCH_DELTA = 70;              // stays slightly ahead of player
const TANK_FORWARD_ACCEL = 240;
const TANK_STEER_SPEED = 55;              // slow lateral drift to block player
const TANK_FIRE_INTERVAL_MIN = 2.6;
const TANK_FIRE_INTERVAL_MAX = 4.0;
const TANK_APPROACH_RANGE = 320;

const SHELL_SPEED = 560;                  // downward world-frame (toward player)
const SHELL_WIDTH = 10;
const SHELL_HEIGHT = 18;

const DRONE_SIZE = 22;
const DRONE_HOVER_Y_MIN = 90;
const DRONE_HOVER_Y_MAX = 170;
const DRONE_HOVER_SPEED = 160;
const DRONE_SWOOP_SPEED = 520;
const DRONE_RETREAT_SPEED = 260;
// Lateral lead cap on swoop targeting. Player STEER_MAX_SPEED is 380 and a
// typical swoop traverses ~0.6–0.8s, so an unclamped lead can exceed half the
// road width — feels unfair. 120px lets the drone meaningfully track a
// committed sideways dodge while still letting a mid-swoop reversal escape
// (target is locked at swoop start, not re-aimed).
const DRONE_MAX_LEAD = 120;

const TANK_RECOIL_DURATION = 0.2; // seconds — hull kick + muzzle puff decay

export class Tank {
  x: number;
  y: number;
  alive = true;
  hp = TANK_HP;
  forwardSpeed = TANK_CRUISE_SPEED;
  vy = 0;
  private fireTimer = 1.8;
  private trackT = 0;
  // Counts down after each shell fires. Drives hull lurch + muzzle puff.
  private recoilT = 0;
  private roadProfile: RoadProfile;

  constructor(x: number, y: number, roadProfile: RoadProfile) {
    this.x = x;
    this.y = y;
    this.roadProfile = roadProfile;
  }

  update(
    dt: number,
    playerSpeed: number,
    playerX: number,
    playerY: number,
    onFireShell: (x: number, y: number) => void,
  ): void {
    if (!this.alive) return;
    this.trackT += dt;
    if (this.recoilT > 0) this.recoilT = Math.max(0, this.recoilT - dt);

    // Match-speed approach (same feel as EnemyCar)
    const distAhead = playerY - this.y;
    let targetForward: number;
    if (distAhead > TANK_APPROACH_RANGE) {
      targetForward = TANK_CRUISE_SPEED;
    } else {
      const matchTarget = Math.max(TANK_CRUISE_SPEED, playerSpeed - TANK_MATCH_DELTA);
      const t = Math.max(0, Math.min(1, 1 - distAhead / TANK_APPROACH_RANGE));
      targetForward = TANK_CRUISE_SPEED + (matchTarget - TANK_CRUISE_SPEED) * t;
    }
    const maxAccel = TANK_FORWARD_ACCEL * dt;
    if (this.forwardSpeed < targetForward) {
      this.forwardSpeed = Math.min(targetForward, this.forwardSpeed + maxAccel);
    } else {
      this.forwardSpeed = Math.max(targetForward, this.forwardSpeed - maxAccel);
    }
    this.vy = playerSpeed - this.forwardSpeed;
    this.y += this.vy * dt;

    // Lateral drift toward player to block lanes
    const dx = playerX - this.x;
    const maxLat = TANK_STEER_SPEED * dt;
    this.x += Math.max(-maxLat, Math.min(maxLat, dx));

    const halfW = TANK_WIDTH / 2;
    const shape = this.roadProfile.shapeAtScreen(this.y);
    if (this.x - halfW < shape.xMin) this.x = shape.xMin + halfW;
    else if (this.x + halfW > shape.xMax) this.x = shape.xMax - halfW;

    // Fire shells when on-screen
    if (this.y > 40) {
      this.fireTimer -= dt;
      if (this.fireTimer <= 0) {
        onFireShell(this.x, this.y + TANK_HEIGHT / 2);
        this.recoilT = TANK_RECOIL_DURATION;
        this.fireTimer =
          TANK_FIRE_INTERVAL_MIN + Math.random() * (TANK_FIRE_INTERVAL_MAX - TANK_FIRE_INTERVAL_MIN);
      }
    }

    // Despawn if it falls off the bottom (player outran it somehow)
    if (this.y > 780) this.alive = false;
  }

  takeHit(missile: boolean): boolean {
    if (!this.alive) return false;
    // Armored: bullets bounce, only missiles do damage
    if (!missile) return false;
    this.hp -= 1;
    if (this.hp <= 0) {
      this.alive = false;
      return true;
    }
    return false;
  }

  isBulletproof(): boolean {
    return true;
  }

  getBounds(): { x: number; y: number; w: number; h: number } {
    return {
      x: this.x - TANK_WIDTH / 2,
      y: this.y - TANK_HEIGHT / 2,
      w: TANK_WIDTH,
      h: TANK_HEIGHT,
    };
  }

  render(ctx: CanvasRenderingContext2D): void {
    const w = TANK_WIDTH;
    const h = TANK_HEIGHT;
    const x = this.x - w / 2;
    const y = this.y - h / 2;
    // Hydraulic recoil: hull lurches back (up the screen, since tank fires
    // downward), then settles. Treads stay planted — only the chassis kicks.
    const recoilNorm = this.recoilT / TANK_RECOIL_DURATION;
    const recoilKick = recoilNorm > 0 ? -3 * Math.sin(recoilNorm * Math.PI) : 0;

    ctx.save();

    // Shadow (grounded — unaffected by recoil)
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(x + 5, y + 7, w, h);

    // Treads (grounded — unaffected by recoil)
    ctx.fillStyle = '#1a1a22';
    ctx.fillRect(x, y, 12, h);
    ctx.fillRect(x + w - 12, y, 12, h);
    // Tread segments animate down with y motion
    ctx.fillStyle = '#3a3a48';
    const treadT = (this.trackT * 4) % 1;
    for (let i = 0; i < 8; i++) {
      const ty = y + ((i + treadT) * (h / 8));
      ctx.fillRect(x + 2, ty, 8, 6);
      ctx.fillRect(x + w - 10, ty, 8, 6);
    }

    // Hull + turret + barrel all shift with recoilKick
    const hy = y + recoilKick;
    const ty = this.y + recoilKick;

    // Hull
    ctx.fillStyle = '#4a4a58';
    ctx.fillRect(x + 12, hy + 10, w - 24, h - 20);
    // Hull plating highlight
    ctx.fillStyle = '#5a5a68';
    ctx.fillRect(x + 14, hy + 12, w - 28, 6);

    // Turret base
    ctx.fillStyle = '#2a2a32';
    ctx.beginPath();
    ctx.arc(this.x, ty + 6, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#6a6a78';
    ctx.beginPath();
    ctx.arc(this.x, ty + 6, 18, 0, Math.PI * 2);
    ctx.fill();

    // Cannon barrel (points down toward player)
    ctx.fillStyle = '#1a1a22';
    ctx.fillRect(this.x - 5, ty + 6, 10, 36);
    ctx.fillStyle = '#3a3a48';
    ctx.fillRect(this.x - 7, ty + 40, 14, 6);

    // Muzzle puff — blooms at the barrel tip, fades with recoilT. Drawn last
    // so it layers on top of the barrel cap.
    if (this.recoilT > 0) {
      const muzzleY = ty + 46;
      const puffR = 6 + (1 - recoilNorm) * 10; // grows as it fades
      // Bright core
      ctx.globalAlpha = recoilNorm;
      ctx.fillStyle = '#FFE080';
      ctx.beginPath();
      ctx.arc(this.x, muzzleY, puffR * 0.5, 0, Math.PI * 2);
      ctx.fill();
      // Outer smoke ring
      ctx.globalAlpha = recoilNorm * 0.6;
      ctx.fillStyle = '#BBB2A0';
      ctx.beginPath();
      ctx.arc(this.x - puffR * 0.2, muzzleY + puffR * 0.2, puffR, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(this.x + puffR * 0.3, muzzleY - puffR * 0.1, puffR * 0.7, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // Warning chevrons (on hull, follow recoil)
    ctx.fillStyle = '#FFD700';
    for (let i = 0; i < 3; i++) {
      ctx.fillRect(x + 20 + i * 12, hy + h - 18, 8, 3);
    }

    // HP pips (small indicator above turret, follow recoil)
    for (let i = 0; i < TANK_HP; i++) {
      ctx.fillStyle = i < this.hp ? '#FF6347' : '#332228';
      ctx.fillRect(this.x - 10 + i * 8, hy + 4, 5, 3);
    }

    ctx.restore();
  }
}

export class TankShell {
  x: number;
  y: number;
  alive = true;
  readonly width = SHELL_WIDTH;
  readonly height = SHELL_HEIGHT;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  update(dt: number): void {
    // Fixed screen velocity — keeps the shell readable at any player speed.
    this.y += SHELL_SPEED * dt;
    if (this.y > 720) this.alive = false;
  }

  getBounds(): { x: number; y: number; w: number; h: number } {
    return {
      x: this.x - this.width / 2,
      y: this.y - this.height / 2,
      w: this.width,
      h: this.height,
    };
  }

  render(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    // Tracer trail
    ctx.fillStyle = 'rgba(255,200,80,0.5)';
    ctx.fillRect(this.x - 2, this.y - 18, 4, 14);
    // Shell body
    ctx.fillStyle = '#FFCC44';
    ctx.fillRect(this.x - this.width / 2, this.y - this.height / 2, this.width, this.height);
    ctx.fillStyle = '#FF6600';
    ctx.fillRect(this.x - this.width / 2, this.y + this.height / 2 - 4, this.width, 4);
    ctx.restore();
  }
}

type DroneState = 'enter' | 'hover' | 'swoop' | 'retreat';

export class Drone {
  x: number;
  y: number;
  alive = true;
  hp = 1;
  // One drone per swarm is flagged as the leader — larger crest antenna,
  // gold accents. Purely cosmetic; gameplay is identical.
  readonly leader: boolean;
  private hoverY: number;
  private hoverX: number;
  private state: DroneState = 'enter';
  private stateTimer: number;
  private swoopTargetX = 0;
  private swoopTargetY = 0;
  private pulse = 0;

  constructor(x: number, hoverY?: number, leader = false) {
    this.x = x;
    this.y = -40;
    this.leader = leader;
    this.hoverY = hoverY ?? DRONE_HOVER_Y_MIN + Math.random() * (DRONE_HOVER_Y_MAX - DRONE_HOVER_Y_MIN);
    this.hoverX = x;
    // Staggered pre-hover delay so swarm drones don't all swoop at once
    this.stateTimer = 0.6 + Math.random() * 1.8;
  }

  update(dt: number, playerX: number, playerY: number, playerVx: number): void {
    if (!this.alive) return;
    this.pulse += dt * 6;

    if (this.state === 'enter') {
      // Fly toward hover position
      const dy = this.hoverY - this.y;
      this.y += Math.sign(dy) * Math.min(Math.abs(dy), DRONE_HOVER_SPEED * dt);
      const dx = this.hoverX - this.x;
      this.x += Math.sign(dx) * Math.min(Math.abs(dx), DRONE_HOVER_SPEED * dt);
      if (Math.abs(dy) < 3 && Math.abs(dx) < 3) {
        this.state = 'hover';
      }
    } else if (this.state === 'hover') {
      // Bob and weave, slowly chase player x
      const bob = Math.sin(this.pulse) * 6;
      this.y = this.hoverY + bob;
      const dx = playerX - this.x;
      this.x += Math.sign(dx) * Math.min(Math.abs(dx), DRONE_HOVER_SPEED * 0.6 * dt);
      this.stateTimer -= dt;
      if (this.stateTimer <= 0) {
        // Lead the player's lateral velocity. The swoop traverses dy at
        // DRONE_SWOOP_SPEED, so predict where the player will be when the
        // drone arrives. Player Y is essentially fixed (sits at PLAYER.Y);
        // only X needs leading. Lead clamped to DRONE_MAX_LEAD so a player
        // at full sideways speed can still dodge by reversing direction.
        const dyToPlayer = Math.max(0, playerY - this.y);
        const timeToReach = dyToPlayer / DRONE_SWOOP_SPEED;
        const rawLead = playerVx * timeToReach;
        const lead = Math.max(-DRONE_MAX_LEAD, Math.min(DRONE_MAX_LEAD, rawLead));
        this.swoopTargetX = playerX + lead;
        this.swoopTargetY = playerY;
        this.state = 'swoop';
      }
    } else if (this.state === 'swoop') {
      const dx = this.swoopTargetX - this.x;
      const dy = this.swoopTargetY - this.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 4 || this.y > playerY + 20) {
        // Missed — retreat back to hover altitude
        this.state = 'retreat';
        this.stateTimer = 1.2 + Math.random() * 0.8;
      } else {
        this.x += (dx / dist) * DRONE_SWOOP_SPEED * dt;
        this.y += (dy / dist) * DRONE_SWOOP_SPEED * dt;
      }
    } else if (this.state === 'retreat') {
      const dy = this.hoverY - this.y;
      this.y += Math.sign(dy) * Math.min(Math.abs(dy), DRONE_RETREAT_SPEED * dt);
      if (Math.abs(dy) < 3) {
        this.state = 'hover';
        this.stateTimer = 2.0 + Math.random() * 1.4;
      }
    }

    // Despawn if driven off-screen
    if (this.y > 720) this.alive = false;
  }

  isSwooping(): boolean {
    return this.state === 'swoop';
  }

  takeHit(): boolean {
    if (!this.alive) return false;
    this.hp -= 1;
    if (this.hp <= 0) {
      this.alive = false;
      return true;
    }
    return false;
  }

  isBulletproof(): boolean {
    return false;
  }

  getBounds(): { x: number; y: number; w: number; h: number } {
    return {
      x: this.x - DRONE_SIZE / 2,
      y: this.y - DRONE_SIZE / 2,
      w: DRONE_SIZE,
      h: DRONE_SIZE,
    };
  }

  render(ctx: CanvasRenderingContext2D): void {
    const r = (this.leader ? DRONE_SIZE * 1.15 : DRONE_SIZE) / 2;
    ctx.save();

    // Swoop telegraph — red ring under target when about to attack
    if (this.state === 'hover' && this.stateTimer < 0.5) {
      ctx.globalAlpha = 0.4 + 0.6 * (1 - this.stateTimer / 0.5);
      ctx.strokeStyle = '#FF3366';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(this.x, this.y, r + 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // Rotor blades — spinning x shape. Leader gets a brighter blur + 6 blades.
    ctx.strokeStyle = this.leader ? 'rgba(255,220,120,0.55)' : 'rgba(200,200,255,0.4)';
    ctx.lineWidth = this.leader ? 1.8 : 1.5;
    const bladeAngle = this.pulse * 4;
    const bladeCount = this.leader ? 6 : 4;
    for (let i = 0; i < bladeCount; i++) {
      const a = bladeAngle + (i * Math.PI) / (bladeCount / 2);
      ctx.beginPath();
      ctx.moveTo(this.x, this.y);
      ctx.lineTo(this.x + Math.cos(a) * r, this.y + Math.sin(a) * r);
      ctx.stroke();
    }

    // Body
    ctx.shadowColor = this.state === 'swoop' ? '#FF0044' : this.leader ? '#FFD700' : '#00FFFF';
    ctx.shadowBlur = this.leader ? 12 : 8;
    ctx.fillStyle = this.leader ? '#3a2a1a' : '#2a1a3a';
    ctx.beginPath();
    ctx.arc(this.x, this.y, r * 0.55, 0, Math.PI * 2);
    ctx.fill();

    // Eye / sensor
    ctx.shadowBlur = 0;
    const swooping = this.state === 'swoop';
    ctx.fillStyle = swooping ? '#FF3366' : this.leader ? '#FFD700' : '#88E5FF';
    ctx.beginPath();
    ctx.arc(this.x, this.y, 3, 0, Math.PI * 2);
    ctx.fill();

    // Leader crest — three gold spike antennas around the top hemisphere
    if (this.leader) {
      ctx.fillStyle = swooping ? '#FFAA44' : '#FFD700';
      const crestAngles = [-Math.PI / 2, -Math.PI / 2 - 0.7, -Math.PI / 2 + 0.7];
      for (const a of crestAngles) {
        const baseX = this.x + Math.cos(a) * (r * 0.55);
        const baseY = this.y + Math.sin(a) * (r * 0.55);
        const tipX = this.x + Math.cos(a) * (r + 3);
        const tipY = this.y + Math.sin(a) * (r + 3);
        const perp = a + Math.PI / 2;
        const baseL = baseX + Math.cos(perp) * 1.2;
        const baseLY = baseY + Math.sin(perp) * 1.2;
        const baseR = baseX - Math.cos(perp) * 1.2;
        const baseRY = baseY - Math.sin(perp) * 1.2;
        ctx.beginPath();
        ctx.moveTo(baseL, baseLY);
        ctx.lineTo(tipX, tipY);
        ctx.lineTo(baseR, baseRY);
        ctx.closePath();
        ctx.fill();
      }
      // Faint gold ring around the body
      ctx.strokeStyle = 'rgba(255,215,0,0.45)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(this.x, this.y, r * 0.75, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  }
}

// Spawn helpers — used by BossSpawner

// Drones spawn at the top of the screen, so we query the road shape near the
// horizon. With dynamic-width sections, the swarm spreads across whatever the
// road looks like at that row — narrower roads naturally pack tighter.
const DRONE_SPAWN_SCREEN_Y = 0;
// Tanks spawn above the visible road; use the same horizon query for a
// consistent spread.
const TANK_SPAWN_SCREEN_Y = -TANK_HEIGHT / 2;

export function spawnDroneSwarm(roadProfile: RoadProfile): Drone[] {
  const count = 4;
  const drones: Drone[] = [];
  const shape = roadProfile.shapeAtScreen(DRONE_SPAWN_SCREEN_Y);
  const width = shape.xMax - shape.xMin;
  const laneWidth = width / count;
  // Randomize which swarm member is the leader so the formation reads
  // differently each spawn; purely cosmetic.
  const leaderIdx = Math.floor(Math.random() * count);
  for (let i = 0; i < count; i++) {
    const x = shape.xMin + laneWidth * (i + 0.5);
    const hoverY = DRONE_HOVER_Y_MIN + (i % 2) * 40;
    drones.push(new Drone(x, hoverY, i === leaderIdx));
  }
  return drones;
}

export function spawnTank(roadProfile: RoadProfile): Tank {
  // Spawn above the road, slightly offset from center so it drifts in
  const shape = roadProfile.shapeAtScreen(TANK_SPAWN_SCREEN_Y);
  const width = shape.xMax - shape.xMin;
  const startX = shape.xMin + width * (0.3 + Math.random() * 0.4);
  return new Tank(startX, TANK_SPAWN_SCREEN_Y, roadProfile);
}

