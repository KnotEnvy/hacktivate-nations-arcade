// Bomb Chopper — high-altitude helicopter that crosses the screen and drops bombs.
// Killable with missiles (1 HP). Bullets pass under it. Worth big points.
//
// Bomb falls from chopper to a fixed target XY (set when dropped — does NOT track
// the player after release). Explodes on impact; if player is within radius they die.

import { CANVAS } from '../data/constants';

const CHOPPER_Y = 72;
const CHOPPER_SPEED = 230;
const CHOPPER_W = 60;
const CHOPPER_H = 26;
const ROTOR_BLUR_W = 76;

const BOMB_FALL_TIME = 1.45;
const BOMB_EXPLOSION_RADIUS = 64;
const BOMB_EXPLOSION_LIFETIME = 0.45;

export const CHOPPER_SCORE_REWARD = 1500;
export const CHOPPER_COIN_REWARD = 35;
export const BOMB_RADIUS = BOMB_EXPLOSION_RADIUS;

export type ChopperDirection = 'left-to-right' | 'right-to-left';

export class BombChopper {
  x: number;
  y = CHOPPER_Y;
  vx: number;
  alive = true;
  hp = 1;
  private dropTimer: number;
  private bombsRemaining = 4;
  private rotorAngle = 0;

  constructor(direction: ChopperDirection) {
    if (direction === 'left-to-right') {
      this.x = -CHOPPER_W;
      this.vx = CHOPPER_SPEED;
    } else {
      this.x = CANVAS.WIDTH + CHOPPER_W;
      this.vx = -CHOPPER_SPEED;
    }
    this.dropTimer = 0.6;
  }

  update(dt: number, onDropBomb: (x: number, y: number) => void): void {
    if (!this.alive) return;
    this.x += this.vx * dt;
    this.rotorAngle += dt * 28;

    // Despawn when fully off-screen
    if (this.vx > 0 && this.x > CANVAS.WIDTH + CHOPPER_W) {
      this.alive = false;
      return;
    }
    if (this.vx < 0 && this.x < -CHOPPER_W) {
      this.alive = false;
      return;
    }

    // Drop bombs while on the visible road area
    const onScreen = this.x > 80 && this.x < CANVAS.WIDTH - 80;
    if (onScreen && this.bombsRemaining > 0) {
      this.dropTimer -= dt;
      if (this.dropTimer <= 0) {
        onDropBomb(this.x, this.y + CHOPPER_H / 2);
        this.bombsRemaining -= 1;
        this.dropTimer = 0.7 + Math.random() * 0.45;
      }
    }
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

  getBounds(): { x: number; y: number; w: number; h: number } {
    return {
      x: this.x - CHOPPER_W / 2,
      y: this.y - CHOPPER_H / 2,
      w: CHOPPER_W,
      h: CHOPPER_H,
    };
  }

  render(ctx: CanvasRenderingContext2D): void {
    const { x, y } = this;
    const facingRight = this.vx > 0;

    // Tail boom (extends opposite the facing direction)
    ctx.fillStyle = '#2a1a3a';
    if (facingRight) {
      ctx.fillRect(x - CHOPPER_W / 2 - 18, y - 2, 18, 4);
      // Tail rotor
      ctx.fillStyle = '#FFFFFF88';
      ctx.fillRect(x - CHOPPER_W / 2 - 20, y - 5, 2, 10);
    } else {
      ctx.fillRect(x + CHOPPER_W / 2, y - 2, 18, 4);
      ctx.fillStyle = '#FFFFFF88';
      ctx.fillRect(x + CHOPPER_W / 2 + 18, y - 5, 2, 10);
    }

    // Body
    ctx.save();
    ctx.shadowColor = '#FF003C';
    ctx.shadowBlur = 10;
    ctx.fillStyle = '#3a1a4a';
    ctx.fillRect(x - CHOPPER_W / 2, y - CHOPPER_H / 2, CHOPPER_W, CHOPPER_H);

    // Cockpit window (front-facing)
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#88E5FF';
    if (facingRight) {
      ctx.fillRect(x + 6, y - CHOPPER_H / 2 + 4, CHOPPER_W / 2 - 10, 7);
    } else {
      ctx.fillRect(x - CHOPPER_W / 2 + 4, y - CHOPPER_H / 2 + 4, CHOPPER_W / 2 - 10, 7);
    }

    // Warning stripe
    ctx.fillStyle = '#FFD700';
    ctx.fillRect(x - CHOPPER_W / 2, y + 2, CHOPPER_W, 2);

    // Skids
    ctx.fillStyle = '#1a1a2a';
    ctx.fillRect(x - CHOPPER_W / 2 + 4, y + CHOPPER_H / 2, CHOPPER_W - 8, 2);
    ctx.restore();

    // Rotor — wide stretched ellipse for blur effect
    const blurStretch = (Math.cos(this.rotorAngle) * 0.18 + 1) * ROTOR_BLUR_W;
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.ellipse(x, y - CHOPPER_H / 2 - 3, blurStretch / 2, 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

export class Bomb {
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  life: number;
  totalLife: number;
  exploded = false;
  explosionTimer = BOMB_EXPLOSION_LIFETIME;
  // Set true on the first frame the bomb explodes — used by the game to do
  // a single damage check, then it stays false until the bomb is removed.
  justExploded = false;

  constructor(startX: number, startY: number, targetX: number, targetY: number) {
    this.startX = startX;
    this.startY = startY;
    this.targetX = targetX;
    this.targetY = targetY;
    this.life = BOMB_FALL_TIME;
    this.totalLife = BOMB_FALL_TIME;
  }

  update(dt: number): void {
    if (this.exploded) {
      this.explosionTimer -= dt;
      this.justExploded = false;
      return;
    }
    this.life -= dt;
    if (this.life <= 0) {
      this.exploded = true;
      this.justExploded = true;
    }
  }

  isAlive(): boolean {
    return this.exploded ? this.explosionTimer > 0 : true;
  }

  getExplosionCenter(): { x: number; y: number; r: number } {
    return { x: this.targetX, y: this.targetY, r: BOMB_EXPLOSION_RADIUS };
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (this.exploded) {
      const t = 1 - this.explosionTimer / BOMB_EXPLOSION_LIFETIME; // 0 → 1
      const r = BOMB_EXPLOSION_RADIUS * (0.45 + 0.55 * t);
      ctx.save();
      ctx.globalAlpha = 1 - t;
      const grad = ctx.createRadialGradient(
        this.targetX,
        this.targetY,
        0,
        this.targetX,
        this.targetY,
        r,
      );
      grad.addColorStop(0, 'rgba(255,220,120,0.95)');
      grad.addColorStop(0.55, 'rgba(255,80,40,0.65)');
      grad.addColorStop(1, 'rgba(120,0,0,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(this.targetX, this.targetY, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }

    const t = 1 - Math.max(0, this.life) / this.totalLife; // 0 → 1
    const x = this.startX + (this.targetX - this.startX) * t;
    const y = this.startY + (this.targetY - this.startY) * t;

    // Ground reticle (grows as bomb approaches)
    const reticleR = 8 + t * 22;
    ctx.save();
    const reticleAlpha = 0.4 + 0.55 * t;
    ctx.strokeStyle = `rgba(255,80,80,${reticleAlpha})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(this.targetX, this.targetY, reticleR, 0, Math.PI * 2);
    ctx.stroke();
    // Crosshair tick marks
    ctx.beginPath();
    ctx.moveTo(this.targetX - reticleR - 4, this.targetY);
    ctx.lineTo(this.targetX - reticleR + 2, this.targetY);
    ctx.moveTo(this.targetX + reticleR - 2, this.targetY);
    ctx.lineTo(this.targetX + reticleR + 4, this.targetY);
    ctx.moveTo(this.targetX, this.targetY - reticleR - 4);
    ctx.lineTo(this.targetX, this.targetY - reticleR + 2);
    ctx.moveTo(this.targetX, this.targetY + reticleR - 2);
    ctx.lineTo(this.targetX, this.targetY + reticleR + 4);
    ctx.stroke();
    ctx.restore();

    // Bomb sprite — shrinks with perspective as it falls
    const scale = 1.2 - t * 0.6;
    const r = 7 * scale;
    ctx.save();
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    // Fin
    ctx.fillStyle = '#FF6347';
    ctx.fillRect(x - r * 0.4, y - r - 3, r * 0.8, 3);
    ctx.restore();
  }
}
