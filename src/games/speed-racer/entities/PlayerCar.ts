import { PLAYER, ROAD } from '../data/constants';

export interface DirectionalInput {
  isLeftPressed(): boolean;
  isRightPressed(): boolean;
  isUpPressed(): boolean;
  isDownPressed(): boolean;
}

export type PlayerVisual = 'car' | 'boat';

export class PlayerCar {
  x: number;
  y: number;
  vx = 0;
  speed: number = PLAYER.BASE_SPEED;
  // Handling multipliers — sections with water/ice terrain reduce traction.
  private steerMul = 1;
  private decelMul = 1;
  // Transient slip override (ice patches). Multiplies decelMul toward zero so
  // steering damping nearly vanishes. Reset to false each frame by the game.
  private slipping = false;
  private visual: PlayerVisual = 'car';
  private wakeT = 0; // accumulator for boat wake animation
  // Cosmetic damage tier — 0 pristine, 1 scorched, 2 critical. Driven by
  // SpeedRacerGame's hp each frame; doesn't affect hitbox or handling.
  private damageLevel: 0 | 1 | 2 = 0;
  private damageT = 0; // accumulator for damage smoke / headlight flicker

  readonly width = PLAYER.WIDTH;
  readonly height = PLAYER.HEIGHT;

  constructor() {
    this.x = ROAD.CENTER;
    this.y = PLAYER.Y;
  }

  reset(): void {
    this.x = ROAD.CENTER;
    this.vx = 0;
    this.speed = PLAYER.BASE_SPEED;
    this.steerMul = 1;
    this.decelMul = 1;
    this.slipping = false;
    this.visual = 'car';
    this.wakeT = 0;
    this.damageLevel = 0;
    this.damageT = 0;
  }

  setHandling(steerMul: number, decelMul: number): void {
    this.steerMul = steerMul;
    this.decelMul = decelMul;
  }

  setSlipping(slipping: boolean): void {
    this.slipping = slipping;
  }

  setVisual(visual: PlayerVisual): void {
    this.visual = visual;
  }

  setDamageLevel(level: 0 | 1 | 2): void {
    this.damageLevel = level;
  }

  getBounds(): { x: number; y: number; w: number; h: number } {
    return {
      x: this.x - this.width / 2,
      y: this.y - this.height / 2,
      w: this.width,
      h: this.height,
    };
  }

  update(dt: number, input: DirectionalInput): void {
    const left = input.isLeftPressed();
    const right = input.isRightPressed();

    const steer = PLAYER.STEER_ACCEL * this.steerMul * dt;
    if (left && !right) {
      this.vx -= steer;
    } else if (right && !left) {
      this.vx += steer;
    } else {
      const slipFactor = this.slipping ? 0.08 : 1;
      const decel = PLAYER.STEER_DECEL * this.decelMul * slipFactor * dt;
      if (this.vx > 0) this.vx = Math.max(0, this.vx - decel);
      else if (this.vx < 0) this.vx = Math.min(0, this.vx + decel);
    }

    if (this.vx > PLAYER.STEER_MAX_SPEED) this.vx = PLAYER.STEER_MAX_SPEED;
    else if (this.vx < -PLAYER.STEER_MAX_SPEED) this.vx = -PLAYER.STEER_MAX_SPEED;

    this.x += this.vx * dt;

    const halfW = this.width / 2;
    if (this.x - halfW < ROAD.X_MIN) {
      this.x = ROAD.X_MIN + halfW;
      this.vx = 0;
    } else if (this.x + halfW > ROAD.X_MAX) {
      this.x = ROAD.X_MAX - halfW;
      this.vx = 0;
    }

    let targetSpeed: number = PLAYER.BASE_SPEED;
    const accel = input.isUpPressed();
    const brake = input.isDownPressed();
    if (accel && !brake) targetSpeed = PLAYER.BOOST_SPEED;
    else if (brake && !accel) targetSpeed = PLAYER.BRAKE_SPEED;

    if (this.speed < targetSpeed) {
      this.speed = Math.min(targetSpeed, this.speed + PLAYER.SPEED_ACCEL * dt);
    } else if (this.speed > targetSpeed) {
      this.speed = Math.max(targetSpeed, this.speed - PLAYER.SPEED_DECEL * dt);
    }

    this.wakeT += dt * (1 + this.speed / PLAYER.BOOST_SPEED);
    if (this.damageLevel > 0) this.damageT += dt;
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (this.visual === 'boat') {
      this.renderBoat(ctx);
      return;
    }
    this.renderCar(ctx);
  }

  private renderCar(ctx: CanvasRenderingContext2D): void {
    const x = this.x - this.width / 2;
    const y = this.y - this.height / 2;
    const w = this.width;
    const h = this.height;

    ctx.save();

    // Damage smoke trail (under the car so it drifts out the back)
    if (this.damageLevel >= 2) this.renderSmokeTrail(ctx, x + w * 0.3, y + h);

    // Drop shadow
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    this.roundRectPath(ctx, x + 4, y + 6, w, h, 8);
    ctx.fill();

    // Body gradient (chrome white; darkens when critical for a sooty look)
    const bodyGrad = ctx.createLinearGradient(x, y, x, y + h);
    if (this.damageLevel >= 2) {
      bodyGrad.addColorStop(0, '#C8BEB0');
      bodyGrad.addColorStop(0.5, '#9F8B7C');
      bodyGrad.addColorStop(1, '#5A4A42');
    } else {
      bodyGrad.addColorStop(0, '#FFFFFF');
      bodyGrad.addColorStop(0.5, '#E0E0E0');
      bodyGrad.addColorStop(1, '#888888');
    }
    ctx.fillStyle = bodyGrad;
    this.roundRectPath(ctx, x, y, w, h, 8);
    ctx.fill();

    // Cockpit window — spiderweb crack at critical damage
    ctx.fillStyle = '#0a0a14';
    this.roundRectPath(ctx, x + 6, y + 14, w - 12, 26, 4);
    ctx.fill();

    // Cyan window highlight (dimmed at critical)
    ctx.fillStyle = this.damageLevel >= 2 ? 'rgba(0,255,255,0.08)' : 'rgba(0,255,255,0.25)';
    this.roundRectPath(ctx, x + 8, y + 16, w - 16, 8, 3);
    ctx.fill();

    if (this.damageLevel >= 2) {
      // Spiderweb cracks across windshield
      ctx.strokeStyle = 'rgba(180,200,220,0.55)';
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(x + 10, y + 16);
      ctx.lineTo(x + w * 0.55, y + 28);
      ctx.lineTo(x + w - 8, y + 18);
      ctx.moveTo(x + w * 0.5, y + 14);
      ctx.lineTo(x + w * 0.5, y + 38);
      ctx.moveTo(x + 8, y + 36);
      ctx.lineTo(x + w * 0.55, y + 28);
      ctx.lineTo(x + w - 10, y + 34);
      ctx.stroke();
    }

    // Hot pink racing stripes
    ctx.fillStyle = '#FF1493';
    ctx.fillRect(x + 12, y + 2, 3, h - 4);
    ctx.fillRect(x + w - 15, y + 2, 3, h - 4);

    // Front bumper accent
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(x + 4, y + h - 8, w - 8, 4);

    // Headlights — flicker at scorched, right side fully dead at critical
    const flicker = this.damageLevel >= 1 && Math.sin(this.damageT * 28) < -0.4;
    const leftLit = !flicker;
    const rightLit = this.damageLevel < 2 && !flicker;
    ctx.fillStyle = leftLit ? '#FFFF99' : '#3a2a14';
    ctx.fillRect(x + 4, y + 2, 8, 5);
    ctx.fillStyle = rightLit ? '#FFFF99' : '#3a1a1a';
    ctx.fillRect(x + w - 12, y + 2, 8, 5);

    // Machine gun barrels (extend forward from front)
    ctx.fillStyle = '#3a3a3a';
    ctx.fillRect(x + 10, y - 8, 5, 12);
    ctx.fillRect(x + w - 15, y - 8, 5, 12);

    // Tail lights (back = bottom)
    ctx.fillStyle = '#FF3030';
    ctx.fillRect(x + 6, y + h - 4, 6, 2);
    ctx.fillRect(x + w - 12, y + h - 4, 6, 2);

    // Damage overlays — scorch streaks at HP2, ripped fender at HP1
    if (this.damageLevel >= 1) {
      // Black scorch blotch on hood
      ctx.fillStyle = 'rgba(20,8,2,0.8)';
      ctx.beginPath();
      ctx.moveTo(x + 10, y + 10);
      ctx.lineTo(x + 20, y + 6);
      ctx.lineTo(x + 26, y + 16);
      ctx.lineTo(x + 22, y + 24);
      ctx.lineTo(x + 12, y + 22);
      ctx.closePath();
      ctx.fill();
      // Jagged crack across the door
      ctx.strokeStyle = 'rgba(0,0,0,0.7)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(x + 3, y + h * 0.5);
      ctx.lineTo(x + w * 0.35, y + h * 0.58);
      ctx.lineTo(x + w * 0.55, y + h * 0.44);
      ctx.lineTo(x + w * 0.85, y + h * 0.56);
      ctx.lineTo(x + w - 3, y + h * 0.5);
      ctx.stroke();
    }
    if (this.damageLevel >= 2) {
      // Torn fender — exposed rust-colored patch on the right flank
      ctx.fillStyle = '#4a2a18';
      ctx.beginPath();
      ctx.moveTo(x + w - 16, y + h * 0.22);
      ctx.lineTo(x + w - 2, y + h * 0.28);
      ctx.lineTo(x + w - 4, y + h * 0.58);
      ctx.lineTo(x + w - 20, y + h * 0.48);
      ctx.closePath();
      ctx.fill();
      // Darker jagged edge
      ctx.strokeStyle = 'rgba(0,0,0,0.8)';
      ctx.lineWidth = 1;
      ctx.stroke();
      // Inner oranges — exposed torn metal / embers
      ctx.fillStyle = '#FF6020';
      ctx.fillRect(x + w - 10, y + h * 0.32, 3, 2);
      ctx.fillRect(x + w - 12, y + h * 0.42, 2, 2);
    }

    // Steering tilt visual cue
    if (Math.abs(this.vx) > 50) {
      const intensity = Math.min(0.5, Math.abs(this.vx) / PLAYER.STEER_MAX_SPEED * 0.5);
      ctx.fillStyle = `rgba(0,255,255,${intensity})`;
      const tiltX = this.vx > 0 ? x : x + w - 4;
      ctx.fillRect(tiltX, y + 8, 4, h - 16);
    }

    ctx.restore();
  }

  // Dark smoke puffs rising behind a damaged chassis. Drawn at low alpha so
  // it reads as atmospheric rather than particle-fx heavy.
  private renderSmokeTrail(ctx: CanvasRenderingContext2D, originX: number, originY: number): void {
    for (let i = 0; i < 5; i++) {
      const t = ((this.damageT * 1.3) + i * 0.22) % 1;
      const puffY = originY + t * 44;
      const puffX = originX + Math.sin(this.damageT * 2.5 + i * 1.7) * 6;
      const r = 3 + t * 7;
      const alpha = (1 - t) * 0.5;
      ctx.globalAlpha = alpha;
      // Gradient-ish: darker core, lighter edges via two discs
      ctx.fillStyle = '#2a2218';
      ctx.beginPath();
      ctx.arc(puffX, puffY, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#6a5848';
      ctx.beginPath();
      ctx.arc(puffX - r * 0.25, puffY - r * 0.25, r * 0.55, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  private renderBoat(ctx: CanvasRenderingContext2D): void {
    const x = this.x - this.width / 2;
    const y = this.y - this.height / 2;
    const w = this.width;
    const h = this.height;

    ctx.save();

    // Trailing wake — foam streaks behind the hull. When critical, tint the
    // wake with scorched ember specks so the trail reads as "on fire on water".
    const wakeAlpha = 0.45;
    for (let i = 0; i < 5; i++) {
      const t = (this.wakeT * 1.6 + i * 0.18) % 1;
      const yy = y + h + 6 + t * 50;
      const spread = 4 + t * 18;
      ctx.globalAlpha = wakeAlpha * (1 - t);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(this.x - spread - 2, yy, 3, 2);
      ctx.fillRect(this.x + spread - 1, yy, 3, 2);
    }
    ctx.globalAlpha = 1;

    // Damage smoke — rises from the stern, drifts back down the screen
    if (this.damageLevel >= 2) this.renderSmokeTrail(ctx, this.x, y + h + 2);

    // Hull shadow
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    this.boatHullPath(ctx, x + 4, y + 6, w, h);
    ctx.fill();

    // Hull body — chrome white, darkens when critical (soot/scorch)
    const bodyGrad = ctx.createLinearGradient(x, y, x, y + h);
    if (this.damageLevel >= 2) {
      bodyGrad.addColorStop(0, '#BEB4A6');
      bodyGrad.addColorStop(0.5, '#8E7E70');
      bodyGrad.addColorStop(1, '#4A3E36');
    } else {
      bodyGrad.addColorStop(0, '#FFFFFF');
      bodyGrad.addColorStop(0.5, '#D8D8E8');
      bodyGrad.addColorStop(1, '#7a7a90');
    }
    ctx.fillStyle = bodyGrad;
    this.boatHullPath(ctx, x, y, w, h);
    ctx.fill();

    // Bow waterline accent (cyan glow) — dimmed when damaged
    ctx.strokeStyle = this.damageLevel >= 1 ? 'rgba(0,255,255,0.4)' : '#00FFFF';
    ctx.lineWidth = 1.5;
    ctx.shadowColor = '#00FFFF';
    ctx.shadowBlur = this.damageLevel >= 1 ? 2 : 6;
    ctx.beginPath();
    ctx.moveTo(x + 6, y + 22);
    ctx.lineTo(this.x, y + 4);
    ctx.lineTo(x + w - 6, y + 22);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Cockpit / windshield
    ctx.fillStyle = '#0a0a14';
    this.roundRectPath(ctx, x + 8, y + 22, w - 16, 22, 4);
    ctx.fill();
    ctx.fillStyle =
      this.damageLevel >= 2 ? 'rgba(0,255,255,0.1)' : 'rgba(0,255,255,0.30)';
    this.roundRectPath(ctx, x + 10, y + 24, w - 20, 7, 3);
    ctx.fill();

    if (this.damageLevel >= 2) {
      // Cracked windshield
      ctx.strokeStyle = 'rgba(180,200,220,0.55)';
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(x + 10, y + 24);
      ctx.lineTo(x + w * 0.55, y + 34);
      ctx.lineTo(x + w - 10, y + 26);
      ctx.moveTo(x + w * 0.5, y + 22);
      ctx.lineTo(x + w * 0.5, y + 42);
      ctx.stroke();
    }

    // Hot pink racing stripe down the centerline
    ctx.fillStyle = '#FF1493';
    ctx.fillRect(this.x - 1.5, y + 6, 3, h - 18);

    // Twin-mounted machine guns flanking the bow
    ctx.fillStyle = '#3a3a3a';
    ctx.fillRect(x + 10, y - 6, 5, 12);
    ctx.fillRect(x + w - 15, y - 6, 5, 12);

    // Stern outboard motor block — glowing red crack when critical
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(x + 10, y + h - 6, w - 20, 6);
    if (this.damageLevel >= 2) {
      ctx.fillStyle = '#FF6020';
      ctx.fillRect(x + w * 0.3, y + h - 5, 3, 3);
      ctx.fillRect(x + w * 0.55, y + h - 4, 2, 2);
    }

    // Damage overlays on the hull
    if (this.damageLevel >= 1) {
      // Scorch smear along port side
      ctx.fillStyle = 'rgba(20,8,2,0.75)';
      ctx.beginPath();
      ctx.moveTo(x + 4, y + h * 0.4);
      ctx.lineTo(x + w * 0.3, y + h * 0.35);
      ctx.lineTo(x + w * 0.28, y + h * 0.58);
      ctx.lineTo(x + 6, y + h * 0.62);
      ctx.closePath();
      ctx.fill();
    }
    if (this.damageLevel >= 2) {
      // Broken spray rail — missing section with jagged edge
      ctx.fillStyle = '#4a2a18';
      ctx.beginPath();
      ctx.moveTo(x + w - 6, y + h * 0.5);
      ctx.lineTo(x + w - 2, y + h * 0.55);
      ctx.lineTo(x + w - 4, y + h * 0.72);
      ctx.lineTo(x + w - 12, y + h * 0.68);
      ctx.lineTo(x + w - 10, y + h * 0.54);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.7)';
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }

    // Steering tilt cue (mirrors the car version)
    if (Math.abs(this.vx) > 50) {
      const intensity = Math.min(0.5, Math.abs(this.vx) / PLAYER.STEER_MAX_SPEED * 0.5);
      ctx.fillStyle = `rgba(0,255,255,${intensity})`;
      const tiltX = this.vx > 0 ? x : x + w - 4;
      ctx.fillRect(tiltX, y + 14, 4, h - 28);
    }

    ctx.restore();
  }

  private boatHullPath(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
  ): void {
    // Pointed bow (top), squared stern (bottom)
    const bowDepth = 18;
    ctx.beginPath();
    ctx.moveTo(x + w / 2, y);             // bow tip
    ctx.lineTo(x + w, y + bowDepth);      // right shoulder
    ctx.lineTo(x + w, y + h - 4);
    ctx.arcTo(x + w, y + h, x + w - 4, y + h, 4); // stern corner
    ctx.lineTo(x + 4, y + h);
    ctx.arcTo(x, y + h, x, y + h - 4, 4);
    ctx.lineTo(x, y + bowDepth);
    ctx.closePath();
  }

  private roundRectPath(
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
