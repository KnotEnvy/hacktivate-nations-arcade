// ===== src/games/tapdodge/entities/Obstacle.ts =====
//
// Five hazards, five silhouettes that never change between zones, so a rule
// learned on the Cloud Deck still holds in the Stormwall:
//
//   crate    a square, X-braced box                     blocks its lane
//   spike    a triangle hazard bolted to a plate        blocks its lane
//   wall     a barrier segment, hazard stripes, lit top blocks its lane
//   drifter  a rounded drone with a scanning eye; it    blocks its lane
//            patrols INSIDE its lane and never leaves it
//   laser    a beam across the whole road, tagged HIGH  duck under / jump
//            or LOW, with chevrons saying which way     over
//
// Hazards are dark bodies with one hot-pink signal colour. The game's
// collision pass reads and writes the bookkeeping fields below.

import { roundRectPath, sansFont } from '@/games/shared/hud/canvasUi';
import { chevronPair, platePath } from '../systems/icons';
import { HAZARD } from '../systems/palette';
import { HAZARD_SIZE, HazardKind, LaserBand } from '../systems/PatternSpawner';
import { LANE_W, ROAD_W, ROAD_X, Rect, laneCenter } from '../systems/layout';

/** A pass this close (hitbox edge to hitbox edge) is a near miss. */
export const NEAR_MISS_PX = 14;

export class Obstacle {
  readonly kind: HazardKind;
  readonly lane: number;
  readonly rowId: number;
  readonly band: LaserBand | null;
  readonly w: number;
  readonly h: number;
  x: number;
  y: number;

  // Collision bookkeeping, owned by the game's pass.
  /** Nearest hitbox gap to the ship seen so far, px. */
  closest = Infinity;
  /** Overlapped the ship at any point (hit, absorbed, or ghosted). */
  touched = false;
  /** Its back edge has gone below the ship. */
  passed = false;
  /** Already paid as a near miss: a pass pays once. */
  nearMissed = false;
  /** Laser only: the ship held the right dodge while the beam crossed. */
  dodged = false;
  destroyed = false;
  /** Near-miss edge flash, seconds left. */
  flash = 0;
  flashSide: 'left' | 'right' | 'top' | 'bottom' = 'bottom';

  private readonly baseX: number;
  private readonly amp: number;
  private patrol: number;
  private scan: number;

  constructor(
    kind: HazardKind,
    lane: number,
    rowId: number,
    bottomY: number,
    band: LaserBand | null = null,
    phase = 0
  ) {
    const size = HAZARD_SIZE[kind];
    this.kind = kind;
    this.lane = lane;
    this.rowId = rowId;
    this.band = kind === 'laser' ? (band ?? 'high') : null;
    this.w = size.w;
    this.h = size.h;
    this.x = kind === 'laser' ? ROAD_X : laneCenter(lane) - size.w / 2;
    this.y = bottomY - size.h;
    this.baseX = this.x;
    // A drifter's whole patrol fits inside its lane with 6px to spare.
    this.amp = kind === 'drifter' ? (LANE_W - size.w) / 2 - 6 : 0;
    this.patrol = phase;
    this.scan = phase * 1.7;
    if (kind === 'drifter') this.x = this.baseX + Math.sin(phase) * this.amp;
  }

  update(dy: number, dt: number): void {
    this.y += dy;
    if (this.kind === 'drifter') {
      this.patrol += dt * 2.4;
      this.x = this.baseX + Math.sin(this.patrol) * this.amp;
    }
    this.scan += dt * 3.2;
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt);
  }

  isDestructible(): boolean {
    return (
      this.kind === 'crate' || this.kind === 'spike' || this.kind === 'drifter'
    );
  }

  hitbox(): Rect {
    switch (this.kind) {
      case 'crate':
        return { x: this.x + 4, y: this.y + 4, w: this.w - 8, h: this.h - 8 };
      case 'spike':
        return { x: this.x + 8, y: this.y + 4, w: this.w - 16, h: this.h - 8 };
      case 'wall':
        return { x: this.x, y: this.y + 2, w: this.w, h: this.h - 4 };
      case 'drifter':
        return { x: this.x + 4, y: this.y + 4, w: this.w - 8, h: this.h - 8 };
      case 'laser':
        return { x: ROAD_X, y: this.y + 2, w: ROAD_W, h: this.h - 4 };
    }
  }

  // ------------------------------------------------------------ render

  render(ctx: CanvasRenderingContext2D): void {
    if (this.destroyed) return;
    ctx.save();
    switch (this.kind) {
      case 'crate':
        this.renderCrate(ctx);
        break;
      case 'spike':
        this.renderSpike(ctx);
        break;
      case 'wall':
        this.renderWall(ctx);
        break;
      case 'drifter':
        this.renderDrifter(ctx);
        break;
      case 'laser':
        this.renderLaser(ctx);
        break;
    }
    ctx.restore();
    if (this.flash > 0) this.renderFlash(ctx);
  }

  private renderCrate(ctx: CanvasRenderingContext2D): void {
    const { x, y, w, h } = this;
    ctx.fillStyle = HAZARD.body;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = HAZARD.signal;
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
    const i = 8;
    ctx.globalAlpha = 0.9;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x + i, y + i);
    ctx.lineTo(x + w - i, y + h - i);
    ctx.moveTo(x + w - i, y + i);
    ctx.lineTo(x + i, y + h - i);
    ctx.stroke();
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + i, y + i, w - i * 2, h - i * 2);
    ctx.globalAlpha = 1;
    ctx.fillStyle = HAZARD.signalSoft;
    for (const [bx, by] of [
      [x + 4, y + 4],
      [x + w - 7, y + 4],
      [x + 4, y + h - 7],
      [x + w - 7, y + h - 7],
    ]) {
      ctx.fillRect(bx, by, 3, 3);
    }
  }

  private renderSpike(ctx: CanvasRenderingContext2D): void {
    const { x, y, w, h } = this;
    roundRectPath(ctx, x + 2, y + 2, w - 4, h - 4, 7);
    ctx.fillStyle = HAZARD.steel;
    ctx.fill();
    ctx.strokeStyle = HAZARD.steelLight;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // The point faces the ship: whatever comes down the road comes at you.
    ctx.beginPath();
    ctx.moveTo(x + 9, y + 10);
    ctx.lineTo(x + w - 9, y + 10);
    ctx.lineTo(x + w / 2, y + h - 6);
    ctx.closePath();
    ctx.fillStyle = HAZARD.signal;
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + 19, y + 16);
    ctx.lineTo(x + w - 19, y + 16);
    ctx.lineTo(x + w / 2, y + h - 18);
    ctx.closePath();
    ctx.fillStyle = HAZARD.body;
    ctx.globalAlpha = 0.55;
    ctx.fill();
  }

  private renderWall(ctx: CanvasRenderingContext2D): void {
    const { x, y, w, h } = this;
    ctx.fillStyle = HAZARD.body;
    ctx.fillRect(x, y, w, h);
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y + 3, w, h - 5);
    ctx.clip();
    ctx.fillStyle = HAZARD.signal;
    ctx.globalAlpha = 0.85;
    for (let sx = x - h; sx < x + w; sx += 18) {
      ctx.beginPath();
      ctx.moveTo(sx, y + h);
      ctx.lineTo(sx + 9, y + h);
      ctx.lineTo(sx + 9 + h, y);
      ctx.lineTo(sx + h, y);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    // Lit top edge and a hard base shadow.
    ctx.fillStyle = '#ffe3f1';
    ctx.fillRect(x, y, w, 2.5);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.fillRect(x, y + h - 2, w, 2);
  }

  private renderDrifter(ctx: CanvasRenderingContext2D): void {
    const cx = this.x + this.w / 2;
    const cy = this.y + this.h / 2;
    // Rotors: four discs with a blade that turns.
    ctx.strokeStyle = HAZARD.steelLight;
    ctx.lineWidth = 1.5;
    for (const [rx, ry] of [
      [-20, -13],
      [20, -13],
      [-20, 13],
      [20, 13],
    ]) {
      ctx.beginPath();
      ctx.arc(cx + rx, cy + ry, 6, 0, Math.PI * 2);
      ctx.stroke();
      const a = this.scan * 5 + rx;
      ctx.beginPath();
      ctx.moveTo(cx + rx - Math.cos(a) * 5, cy + ry - Math.sin(a) * 5);
      ctx.lineTo(cx + rx + Math.cos(a) * 5, cy + ry + Math.sin(a) * 5);
      ctx.stroke();
    }
    roundRectPath(ctx, cx - 19, cy - 12, 38, 24, 11);
    ctx.fillStyle = HAZARD.steel;
    ctx.fill();
    ctx.strokeStyle = HAZARD.signal;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // The eye slot, and the eye sweeping across it.
    roundRectPath(ctx, cx - 13, cy - 3.5, 26, 7, 3.5);
    ctx.fillStyle = '#07060c';
    ctx.fill();
    const ex = cx + Math.sin(this.scan) * 9;
    ctx.fillStyle = HAZARD.signal;
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.arc(ex, cy, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(ex, cy, 2.6, 0, Math.PI * 2);
    ctx.fill();
  }

  private renderLaser(ctx: CanvasRenderingContext2D): void {
    const high = this.band === 'high';
    const cy = this.y + this.h / 2;
    const x0 = ROAD_X;
    const x1 = ROAD_X + ROAD_W;

    if (high) {
      // A beam above the road casts a shadow onto it.
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(x0, cy + 13);
      ctx.lineTo(x1, cy + 13);
      ctx.stroke();
    } else {
      ctx.strokeStyle = HAZARD.signal;
      ctx.globalAlpha = 0.3;
      ctx.lineWidth = 1;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(x0, cy + 6);
      ctx.lineTo(x1, cy + 6);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }

    ctx.strokeStyle = HAZARD.signal;
    ctx.globalAlpha = 0.25;
    ctx.lineWidth = high ? 16 : 12;
    ctx.beginPath();
    ctx.moveTo(x0, cy);
    ctx.lineTo(x1, cy);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.lineWidth = high ? 6 : 4;
    ctx.stroke();
    ctx.strokeStyle = '#ffe3f1';
    ctx.lineWidth = high ? 2 : 1.5;
    ctx.stroke();

    // Emitter posts on the rails: tall for HIGH, squat for LOW.
    const postH = high ? 24 : 12;
    ctx.fillStyle = HAZARD.steel;
    ctx.fillRect(x0 - 7, cy - postH / 2, 14, postH);
    ctx.fillRect(x1 - 7, cy - postH / 2, 14, postH);
    ctx.fillStyle = HAZARD.signal;
    ctx.fillRect(x0 - 7, cy - postH / 2, 14, 3);
    ctx.fillRect(x1 - 7, cy - postH / 2, 14, 3);

    // The tell: a chevron pair in every lane, pointing the way to go.
    ctx.strokeStyle = HAZARD.signal;
    const dir = high ? 'down' : 'up';
    const ty = high ? cy + 24 : cy - 20;
    for (let lane = 0; lane < 5; lane++) {
      chevronPair(ctx, laneCenter(lane), ty, 14, dir, 2.5);
    }

    // The band marker, on both shoulders.
    const label = high ? 'HIGH' : 'LOW';
    for (const tx of [x0 - 58, x1 + 12]) {
      platePath(ctx, tx, cy - 10, 46, 20, 5);
      ctx.fillStyle = HAZARD.body;
      ctx.fill();
      ctx.strokeStyle = HAZARD.signal;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = HAZARD.signal;
      ctx.font = sansFont(10, 800);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, tx + 23, cy + 0.5);
    }
  }

  private renderFlash(ctx: CanvasRenderingContext2D): void {
    const k = Math.min(1, this.flash / 0.25);
    const b = this.hitbox();
    ctx.save();
    ctx.strokeStyle = `rgba(255, 255, 255, ${k.toFixed(3)})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    if (this.flashSide === 'left') {
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x, b.y + b.h);
    } else if (this.flashSide === 'right') {
      ctx.moveTo(b.x + b.w, b.y);
      ctx.lineTo(b.x + b.w, b.y + b.h);
    } else if (this.flashSide === 'top') {
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x + b.w, b.y);
    } else {
      ctx.moveTo(b.x, b.y + b.h);
      ctx.lineTo(b.x + b.w, b.y + b.h);
    }
    ctx.stroke();
    ctx.restore();
  }
}
