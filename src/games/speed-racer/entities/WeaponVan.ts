import type { RoadProfile } from '../systems/RoadProfile';
import { SecondaryWeaponType } from '../data/secondaryWeapons';

export class WeaponVan {
  x: number;
  y: number;
  vy = 0;
  alive = true;
  docked = false;
  readonly width = 80;
  readonly height = 130;
  readonly forwardSpeed = 320; // World-frame, near player base speed
  readonly payload: SecondaryWeaponType;
  private pulseT = 0; // drives roof warning beacon rotation
  private roadProfile: RoadProfile;

  constructor(x: number, y: number, payload: SecondaryWeaponType, roadProfile: RoadProfile) {
    this.x = x;
    this.y = y;
    this.payload = payload;
    this.roadProfile = roadProfile;
  }

  update(dt: number, playerSpeed: number): void {
    this.vy = playerSpeed - this.forwardSpeed;
    this.y += this.vy * dt;
    this.pulseT += dt;
    if (this.y > 720) this.alive = false;

    const halfW = this.width / 2;
    const shape = this.roadProfile.shapeAtScreen(this.y);
    if (this.x - halfW < shape.xMin) this.x = shape.xMin + halfW;
    else if (this.x + halfW > shape.xMax) this.x = shape.xMax - halfW;
  }

  // The dock zone is the rear (bottom) of the van — slightly inset
  getDockBounds(): { x: number; y: number; w: number; h: number } {
    return {
      x: this.x - this.width / 2 + 12,
      y: this.y + this.height / 2 - 22,
      w: this.width - 24,
      h: 26,
    };
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
    const w = this.width;
    const h = this.height;
    const x = this.x - w / 2;
    const y = this.y - h / 2;
    const cx = this.x;
    ctx.save();

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    this.roundRect(ctx, x + 5, y + 6, w, h, 6);
    ctx.fill();

    // Cab (top) — rounded, lighter color. Sits narrower than cargo.
    const cabH = 40;
    const cabGrad = ctx.createLinearGradient(x, y, x, y + cabH);
    cabGrad.addColorStop(0, '#E8E8EC');
    cabGrad.addColorStop(1, '#9A9AA2');
    ctx.fillStyle = cabGrad;
    this.roundRect(ctx, x + 4, y, w - 8, cabH, 6);
    ctx.fill();

    // Cargo box — boxier, darker gunmetal, separate from cab
    ctx.fillStyle = '#4a4a58';
    this.roundRect(ctx, x, y + cabH - 4, w, h - cabH + 4, 3);
    ctx.fill();
    // Cargo top highlight
    ctx.fillStyle = '#5a5a6a';
    ctx.fillRect(x + 2, y + cabH - 2, w - 4, 3);

    // Cab windshield
    ctx.fillStyle = '#0a0a14';
    this.roundRect(ctx, x + 10, y + 6, w - 20, 20, 3);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,255,255,0.3)';
    this.roundRect(ctx, x + 12, y + 8, w - 24, 5, 2);
    ctx.fill();

    // Cab driver silhouette
    ctx.fillStyle = '#2a1a1a';
    ctx.beginPath();
    ctx.arc(cx, y + 17, 3.5, 0, Math.PI * 2);
    ctx.fill();

    // Rooftop warning beacon — rotating red/amber on a pedestal
    const beaconY = y + cabH - 4;
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(cx - 6, beaconY - 6, 12, 4);
    const beaconHot = Math.sin(this.pulseT * 8) > 0;
    ctx.shadowColor = beaconHot ? '#FF3030' : '#FFB030';
    ctx.shadowBlur = 10;
    ctx.fillStyle = beaconHot ? '#FF3030' : '#FFB030';
    ctx.beginPath();
    ctx.arc(cx, beaconY - 8, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Roof antenna — thin pole on the cab with a dot at the top
    ctx.fillStyle = '#888';
    ctx.fillRect(x + 14, y - 10, 1.5, 14);
    ctx.beginPath();
    ctx.arc(x + 14.75, y - 10, 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Cargo side panels — riveted with hazard stripes along the lower edge.
    // Rivet columns running down each long side.
    ctx.fillStyle = '#888';
    for (let i = 0; i < 6; i++) {
      const ry = y + cabH + 6 + i * ((h - cabH - 32) / 5);
      ctx.beginPath();
      ctx.arc(x + 5, ry, 1.2, 0, Math.PI * 2);
      ctx.arc(x + w - 5, ry, 1.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Hazard stripes — diagonal yellow/black band around the top of cargo
    ctx.save();
    ctx.beginPath();
    ctx.rect(x + 3, y + cabH + 2, w - 6, 8);
    ctx.clip();
    for (let i = -2; i < w / 4 + 2; i++) {
      const bx = x + i * 8;
      ctx.fillStyle = '#FFD700';
      ctx.beginPath();
      ctx.moveTo(bx, y + cabH + 10);
      ctx.lineTo(bx + 4, y + cabH + 2);
      ctx.lineTo(bx + 8, y + cabH + 2);
      ctx.lineTo(bx + 4, y + cabH + 10);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#1a1a1a';
      ctx.beginPath();
      ctx.moveTo(bx + 4, y + cabH + 10);
      ctx.lineTo(bx + 8, y + cabH + 2);
      ctx.lineTo(bx + 12, y + cabH + 2);
      ctx.lineTo(bx + 8, y + cabH + 10);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // Central "WEAPONS" stencil on the cargo side — stacked block letters
    // (drawn as solid yellow blocks for readability at this scale)
    ctx.fillStyle = '#FFE060';
    const stencilY = y + cabH + 16;
    const stencilText = 'WEAPONS';
    ctx.save();
    ctx.font = 'bold 11px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(stencilText, cx, stencilY + 6);
    ctx.restore();
    // Under-stencil accent bar
    ctx.fillStyle = '#FF1493';
    ctx.fillRect(x + 14, stencilY + 14, w - 28, 2);

    // Payload type glyph — small diamond beneath the stencil
    ctx.fillStyle = '#00FFFF';
    ctx.beginPath();
    ctx.moveTo(cx, stencilY + 22);
    ctx.lineTo(cx + 6, stencilY + 28);
    ctx.lineTo(cx, stencilY + 34);
    ctx.lineTo(cx - 6, stencilY + 28);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#003030';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Rear cargo doors — split down the middle with an inviting dock zone.
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(x + 12, y + h - 26, w - 24, 22);
    // Door seam (vertical split)
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx, y + h - 26);
    ctx.lineTo(cx, y + h - 4);
    ctx.stroke();
    // Door handles — two small horizontal chrome bars
    ctx.fillStyle = '#cccccc';
    ctx.fillRect(cx - 8, y + h - 15, 5, 2);
    ctx.fillRect(cx + 3, y + h - 15, 5, 2);
    // Dock-zone highlight — yellow border (matches the old "inviting ramp" look)
    ctx.fillStyle = '#FFFF00';
    ctx.fillRect(x + 12, y + h - 26, w - 24, 2);
    ctx.fillRect(x + 12, y + h - 6, w - 24, 2);

    // Headlights (top/front)
    ctx.fillStyle = '#FFFFC8';
    ctx.fillRect(x + 8, y + 2, 10, 5);
    ctx.fillRect(x + w - 18, y + 2, 10, 5);
    // Chrome front bumper
    ctx.fillStyle = '#bbbbbb';
    ctx.fillRect(x + 6, y + 8, w - 12, 2);

    // Tail lights
    ctx.fillStyle = '#FF3030';
    ctx.fillRect(x + 4, y + h - 4, 10, 2);
    ctx.fillRect(x + w - 14, y + h - 4, 10, 2);

    // Side mirrors poking out from the cab
    ctx.fillStyle = '#7a7a82';
    ctx.fillRect(x + 1, y + 14, 4, 6);
    ctx.fillRect(x + w - 5, y + 14, 4, 6);

    ctx.restore();
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
