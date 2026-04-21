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

    // Drop shadow
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    this.roundRectPath(ctx, x + 4, y + 6, w, h, 8);
    ctx.fill();

    // Body gradient (chrome white)
    const bodyGrad = ctx.createLinearGradient(x, y, x, y + h);
    bodyGrad.addColorStop(0, '#FFFFFF');
    bodyGrad.addColorStop(0.5, '#E0E0E0');
    bodyGrad.addColorStop(1, '#888888');
    ctx.fillStyle = bodyGrad;
    this.roundRectPath(ctx, x, y, w, h, 8);
    ctx.fill();

    // Cockpit window
    ctx.fillStyle = '#0a0a14';
    this.roundRectPath(ctx, x + 6, y + 14, w - 12, 26, 4);
    ctx.fill();

    // Cyan window highlight
    ctx.fillStyle = 'rgba(0,255,255,0.25)';
    this.roundRectPath(ctx, x + 8, y + 16, w - 16, 8, 3);
    ctx.fill();

    // Hot pink racing stripes
    ctx.fillStyle = '#FF1493';
    ctx.fillRect(x + 12, y + 2, 3, h - 4);
    ctx.fillRect(x + w - 15, y + 2, 3, h - 4);

    // Front bumper accent
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(x + 4, y + h - 8, w - 8, 4);

    // Headlights (front = top)
    ctx.fillStyle = '#FFFF99';
    ctx.fillRect(x + 4, y + 2, 8, 5);
    ctx.fillRect(x + w - 12, y + 2, 8, 5);

    // Machine gun barrels (extend forward from front)
    ctx.fillStyle = '#3a3a3a';
    ctx.fillRect(x + 10, y - 8, 5, 12);
    ctx.fillRect(x + w - 15, y - 8, 5, 12);

    // Tail lights (back = bottom)
    ctx.fillStyle = '#FF3030';
    ctx.fillRect(x + 6, y + h - 4, 6, 2);
    ctx.fillRect(x + w - 12, y + h - 4, 6, 2);

    // Steering tilt visual cue
    if (Math.abs(this.vx) > 50) {
      const intensity = Math.min(0.5, Math.abs(this.vx) / PLAYER.STEER_MAX_SPEED * 0.5);
      ctx.fillStyle = `rgba(0,255,255,${intensity})`;
      const tiltX = this.vx > 0 ? x : x + w - 4;
      ctx.fillRect(tiltX, y + 8, 4, h - 16);
    }

    ctx.restore();
  }

  private renderBoat(ctx: CanvasRenderingContext2D): void {
    const x = this.x - this.width / 2;
    const y = this.y - this.height / 2;
    const w = this.width;
    const h = this.height;

    ctx.save();

    // Trailing wake — two foam streaks behind the hull, animated
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

    // Hull shadow
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    this.boatHullPath(ctx, x + 4, y + 6, w, h);
    ctx.fill();

    // Hull body — chrome white tapering to a pointed bow
    const bodyGrad = ctx.createLinearGradient(x, y, x, y + h);
    bodyGrad.addColorStop(0, '#FFFFFF');
    bodyGrad.addColorStop(0.5, '#D8D8E8');
    bodyGrad.addColorStop(1, '#7a7a90');
    ctx.fillStyle = bodyGrad;
    this.boatHullPath(ctx, x, y, w, h);
    ctx.fill();

    // Bow waterline accent (cyan glow)
    ctx.strokeStyle = '#00FFFF';
    ctx.lineWidth = 1.5;
    ctx.shadowColor = '#00FFFF';
    ctx.shadowBlur = 6;
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
    ctx.fillStyle = 'rgba(0,255,255,0.30)';
    this.roundRectPath(ctx, x + 10, y + 24, w - 20, 7, 3);
    ctx.fill();

    // Hot pink racing stripe down the centerline
    ctx.fillStyle = '#FF1493';
    ctx.fillRect(this.x - 1.5, y + 6, 3, h - 18);

    // Twin-mounted machine guns flanking the bow
    ctx.fillStyle = '#3a3a3a';
    ctx.fillRect(x + 10, y - 6, 5, 12);
    ctx.fillRect(x + w - 15, y - 6, 5, 12);

    // Stern outboard motor block
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(x + 10, y + h - 6, w - 20, 6);

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
