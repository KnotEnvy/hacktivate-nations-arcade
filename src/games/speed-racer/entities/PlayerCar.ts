import { InputManager } from '@/services/InputManager';
import { PLAYER, ROAD } from '../data/constants';

export class PlayerCar {
  x: number;
  y: number;
  vx = 0;
  speed: number = PLAYER.BASE_SPEED;

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
  }

  getBounds(): { x: number; y: number; w: number; h: number } {
    return {
      x: this.x - this.width / 2,
      y: this.y - this.height / 2,
      w: this.width,
      h: this.height,
    };
  }

  update(dt: number, input: InputManager): void {
    const left = input.isLeftPressed();
    const right = input.isRightPressed();

    if (left && !right) {
      this.vx -= PLAYER.STEER_ACCEL * dt;
    } else if (right && !left) {
      this.vx += PLAYER.STEER_ACCEL * dt;
    } else {
      const decel = PLAYER.STEER_DECEL * dt;
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
  }

  render(ctx: CanvasRenderingContext2D): void {
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
