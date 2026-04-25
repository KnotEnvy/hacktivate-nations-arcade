import { PLAYER, ROAD } from '../data/constants';
import type { SecondaryWeaponType } from '../data/secondaryWeapons';

export interface DirectionalInput {
  isLeftPressed(): boolean;
  isRightPressed(): boolean;
  isUpPressed(): boolean;
  isDownPressed(): boolean;
}

export type PlayerVisual = 'car' | 'boat';

export interface SecondaryHint {
  type: SecondaryWeaponType | null;
  ammo: number;          // remaining shots
  maxAmmo: number;       // for pip count
  cooldownPct: number;   // 0..1 — 1 just-fired, 0 ready
}

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
  // Brief countdown after the primary guns fire — drives barrel recoil offset.
  // Pulsed from SpeedRacerGame whenever a new bullet leaves the muzzle.
  private gunRecoilT = 0;
  // Snapshot of secondary weapon state for the visible mount on the trunk.
  // Set every frame by SpeedRacerGame from SecondaryWeaponSystem.
  private secondary: SecondaryHint = { type: null, ammo: 0, maxAmmo: 0, cooldownPct: 0 };

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
    this.gunRecoilT = 0;
    this.secondary = { type: null, ammo: 0, maxAmmo: 0, cooldownPct: 0 };
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

  pulseGunRecoil(): void {
    this.gunRecoilT = 0.08;
  }

  setSecondary(hint: SecondaryHint): void {
    this.secondary = hint;
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
    if (this.gunRecoilT > 0) this.gunRecoilT = Math.max(0, this.gunRecoilT - dt);
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

    // Layer 0: hot-pink underglow ellipse — pulses with speed via wakeT.
    // Drawn first so it diffuses out from beneath the chassis.
    this.renderUnderglow(ctx, this.x, this.y + h * 0.45);

    // Damage smoke trail (under the car so it drifts out the back)
    if (this.damageLevel >= 2) this.renderSmokeTrail(ctx, x + w * 0.3, y + h);

    // Drop shadow
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    this.roundRectPath(ctx, x + 4, y + 6, w, h, 8);
    ctx.fill();

    // Layer 1: wheels — drawn before the body so the rims peek out at the
    // four corners (slightly outset for muscle-car proportion).
    this.renderWheels(ctx, x, y, w, h);

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

    // Driver — racing helmet with a visor strip seen through the windshield
    this.renderDriver(ctx, this.x, y + 28);

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

    // Hot pink racing stripes — pinched in slightly so the hood scoop sits between them
    ctx.fillStyle = '#FF1493';
    ctx.fillRect(x + 11, y + 2, 3, h - 4);
    ctx.fillRect(x + w - 14, y + 2, 3, h - 4);

    // Hood scoop — raised black intake with hot-pink trim. Tiny vibration at boost.
    this.renderHoodScoop(ctx, x, y, w);

    // Rear bumper accent (was the "front" — now lives where it belongs)
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(x + 4, y + h - 6, w - 8, 4);

    // Headlights — flicker at scorched, right side fully dead at critical
    const flicker = this.damageLevel >= 1 && Math.sin(this.damageT * 28) < -0.4;
    const leftLit = !flicker;
    const rightLit = this.damageLevel < 2 && !flicker;
    ctx.fillStyle = leftLit ? '#FFFF99' : '#3a2a14';
    ctx.fillRect(x + 4, y + 2, 8, 5);
    ctx.fillStyle = rightLit ? '#FFFF99' : '#3a1a1a';
    ctx.fillRect(x + w - 12, y + 2, 8, 5);

    // Machine gun barrels — chrome housing + recoil offset on fire
    this.renderGunBarrels(ctx, x, y, w);

    // Tail lights (back = bottom)
    ctx.fillStyle = '#FF3030';
    ctx.fillRect(x + 6, y + h - 4, 6, 2);
    ctx.fillRect(x + w - 12, y + h - 4, 6, 2);

    // Side livery — chrome trim along the lower flanks + "01" race number
    this.renderLivery(ctx, x, y, w, h);

    // Visible secondary weapon mount on the trunk — type-specific attachment.
    // Drawn after livery so it covers the "01" decal when equipped.
    this.renderSecondaryMount(ctx, x, y, w, h);

    // Twin exhaust flames — speed-scaled. Drawn here so damage smoke (above)
    // and the bumper line layer cleanly above them.
    this.renderExhaustFlames(ctx, x, y, w, h);

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

  // Hot-pink underglow ellipse beneath the chassis. Pulses with wakeT (which
  // accumulates faster as the player accelerates) so the racer feels alive.
  private renderUnderglow(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
    const speedT = (this.speed - PLAYER.BRAKE_SPEED) / (PLAYER.BOOST_SPEED - PLAYER.BRAKE_SPEED);
    const intensity = 0.35 + 0.25 * Math.max(0, Math.min(1, speedT));
    const pulse = 0.85 + 0.15 * Math.sin(this.wakeT * 4);
    const alpha = intensity * pulse;
    const radius = 26 + speedT * 6;
    const grad = ctx.createRadialGradient(cx, cy, 2, cx, cy, radius);
    grad.addColorStop(0, `rgba(255,40,160,${alpha.toFixed(3)})`);
    grad.addColorStop(0.5, `rgba(200,20,140,${(alpha * 0.45).toFixed(3)})`);
    grad.addColorStop(1, 'rgba(120,0,90,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(cx, cy, radius, radius * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Four corner wheels — front pair narrower, rear pair beefier (muscle-car
  // proportion). Spokes rotate with wakeT so they spin faster at boost.
  private renderWheels(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
    const angle = this.wakeT * 6;
    // Wheel positions: front (top), rear (bottom). Outset 2px past the body.
    const wheels: Array<{ wx: number; wy: number; ww: number; wh: number }> = [
      { wx: x - 3, wy: y + 12, ww: 6, wh: 14 },
      { wx: x + w - 3, wy: y + 12, ww: 6, wh: 14 },
      { wx: x - 4, wy: y + h - 26, ww: 8, wh: 18 }, // beefier rear
      { wx: x + w - 4, wy: y + h - 26, ww: 8, wh: 18 },
    ];
    for (const wheel of wheels) {
      // Tire (matte black)
      ctx.fillStyle = '#0a0a0a';
      this.roundRectPath(ctx, wheel.wx, wheel.wy, wheel.ww, wheel.wh, 2);
      ctx.fill();
      // Inner rim (chrome)
      const rcx = wheel.wx + wheel.ww / 2;
      const rcy = wheel.wy + wheel.wh / 2;
      const rimR = Math.min(wheel.ww, wheel.wh) * 0.32;
      ctx.fillStyle = '#cccccc';
      ctx.beginPath();
      ctx.arc(rcx, rcy, rimR + 0.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#3a3a3a';
      ctx.beginPath();
      ctx.arc(rcx, rcy, rimR, 0, Math.PI * 2);
      ctx.fill();
      // Spokes — 4 thin lines rotating with the wheel
      ctx.strokeStyle = '#dddddd';
      ctx.lineWidth = 0.8;
      for (let i = 0; i < 4; i++) {
        const a = angle + (i * Math.PI) / 2;
        ctx.beginPath();
        ctx.moveTo(rcx, rcy);
        ctx.lineTo(rcx + Math.cos(a) * rimR, rcy + Math.sin(a) * rimR);
        ctx.stroke();
      }
      // Hub cap dot
      ctx.fillStyle = '#FF1493';
      ctx.beginPath();
      ctx.arc(rcx, rcy, 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Raised hood scoop with hot-pink trim and a darker intake slot.
  // Tiny y-jitter at boost so it reads as a vibrating engine.
  private renderHoodScoop(ctx: CanvasRenderingContext2D, x: number, y: number, w: number): void {
    const cx = x + w / 2;
    const isBoosting = this.speed > PLAYER.BASE_SPEED + 40;
    const jitter = isBoosting ? Math.sin(this.wakeT * 50) * 0.6 : 0;
    const sy = y + 6 + jitter;
    // Outer scoop body (charcoal)
    ctx.fillStyle = '#1a1a22';
    this.roundRectPath(ctx, cx - 9, sy, 18, 14, 2);
    ctx.fill();
    // Hot-pink trim around the rim
    ctx.strokeStyle = '#FF1493';
    ctx.lineWidth = 1;
    this.roundRectPath(ctx, cx - 9, sy, 18, 14, 2);
    ctx.stroke();
    // Dark intake slot
    ctx.fillStyle = '#000000';
    this.roundRectPath(ctx, cx - 7, sy + 3, 14, 6, 1.5);
    ctx.fill();
    // Inner intake highlight (suggests depth)
    ctx.fillStyle = 'rgba(255,20,140,0.3)';
    ctx.fillRect(cx - 6, sy + 4, 12, 1);
  }

  // Front machine gun barrels — chrome housing, dark muzzle, recoil offset
  // when gunRecoilT > 0 (pulsed by SpeedRacerGame on each shot fired).
  private renderGunBarrels(ctx: CanvasRenderingContext2D, x: number, y: number, w: number): void {
    const recoilOffset = this.gunRecoilT * 25; // up to ~2px backward kick
    const drawBarrel = (bx: number): void => {
      // Mounting collar (sits on the hood, doesn't move)
      ctx.fillStyle = '#2a2a32';
      ctx.fillRect(bx, y - 2, 5, 6);
      ctx.fillStyle = '#5a5a62';
      ctx.fillRect(bx, y - 2, 5, 1);
      // Barrel itself (recoils backward)
      const by = y - 8 + recoilOffset;
      ctx.fillStyle = '#3a3a3a';
      ctx.fillRect(bx, by, 5, 12);
      // Chrome ring midway up the barrel
      ctx.fillStyle = '#cccccc';
      ctx.fillRect(bx - 0.5, by + 4, 6, 1.5);
      // Dark muzzle hole at the tip
      ctx.fillStyle = '#000000';
      ctx.fillRect(bx + 1, by, 3, 2);
    };
    drawBarrel(x + 10);
    drawBarrel(x + w - 15);
  }

  // Twin exhaust flame tongues at the rear. Length and brightness scale with
  // speed — invisible at brake, bright at boost. Per-frame jitter for liveliness.
  private renderExhaustFlames(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
    const speedT = (this.speed - PLAYER.BRAKE_SPEED) / (PLAYER.BOOST_SPEED - PLAYER.BRAKE_SPEED);
    if (speedT <= 0.05) return; // no flame at idle/brake
    const baseLen = 6 + speedT * 18;
    const flameTip = (px: number): void => {
      const jitter = (Math.sin(this.wakeT * 70 + px) * 0.5 + 0.5) * 4;
      const len = baseLen + jitter;
      // Outer orange flame
      ctx.fillStyle = `rgba(255,120,30,${(0.5 + 0.4 * speedT).toFixed(2)})`;
      ctx.beginPath();
      ctx.moveTo(px - 3, y + h - 2);
      ctx.lineTo(px + 3, y + h - 2);
      ctx.lineTo(px + 1.5, y + h + len);
      ctx.lineTo(px - 1.5, y + h + len);
      ctx.closePath();
      ctx.fill();
      // Inner yellow core
      ctx.fillStyle = `rgba(255,230,120,${(0.6 + 0.4 * speedT).toFixed(2)})`;
      ctx.beginPath();
      ctx.moveTo(px - 1.5, y + h - 2);
      ctx.lineTo(px + 1.5, y + h - 2);
      ctx.lineTo(px + 0.6, y + h + len * 0.7);
      ctx.lineTo(px - 0.6, y + h + len * 0.7);
      ctx.closePath();
      ctx.fill();
      // Cyan blue tip at boost (afterburner look)
      if (speedT > 0.6) {
        const blueA = (speedT - 0.6) / 0.4;
        ctx.fillStyle = `rgba(120,200,255,${(blueA * 0.7).toFixed(2)})`;
        ctx.beginPath();
        ctx.arc(px, y + h + len * 0.4, 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
    };
    flameTip(x + 9);
    flameTip(x + w - 9);
  }

  // Cyan waterline halo — the boat's analog of the car's underglow. Spreads
  // wider with speed and pulses gently with wakeT.
  private renderWaterlineGlow(ctx: CanvasRenderingContext2D, cx: number, cy: number, speedT: number): void {
    const intensity = 0.3 + 0.3 * Math.max(0, Math.min(1, speedT));
    const pulse = 0.85 + 0.15 * Math.sin(this.wakeT * 4);
    const alpha = intensity * pulse;
    const radius = 30 + speedT * 10;
    const grad = ctx.createRadialGradient(cx, cy, 2, cx, cy, radius);
    grad.addColorStop(0, `rgba(120,255,255,${alpha.toFixed(3)})`);
    grad.addColorStop(0.5, `rgba(0,180,220,${(alpha * 0.45).toFixed(3)})`);
    grad.addColorStop(1, 'rgba(0,80,120,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(cx, cy, radius, radius * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Type-specific secondary weapon mount on the trunk. Renders nothing when
  // nothing is equipped. Cooldown flash dims the active accent for ~0.3s after
  // each use so the player gets visible feedback that the shot was consumed.
  private renderSecondaryMount(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
    const { type, ammo, maxAmmo, cooldownPct } = this.secondary;
    if (!type) return;
    const cx = x + w / 2;
    const my = y + h - 24; // mount Y baseline (sits on the trunk)
    const armed = cooldownPct < 0.3;

    if (type === 'missile') {
      // Launcher pad
      ctx.fillStyle = '#1a1a22';
      this.roundRectPath(ctx, cx - 11, my - 4, 22, 12, 2);
      ctx.fill();
      ctx.strokeStyle = '#FF6347';
      ctx.lineWidth = 1;
      this.roundRectPath(ctx, cx - 11, my - 4, 22, 12, 2);
      ctx.stroke();
      // 3 missile tubes pointing forward, lit per remaining ammo
      const tubes = Math.max(maxAmmo, 3);
      const tubeW = 4;
      const gap = 1;
      const totalW = tubes * tubeW + (tubes - 1) * gap;
      const startX = cx - totalW / 2;
      for (let i = 0; i < tubes; i++) {
        const tx = startX + i * (tubeW + gap);
        // Tube body
        ctx.fillStyle = '#3a3a3a';
        ctx.fillRect(tx, my - 8, tubeW, 8);
        // Missile tip if loaded
        if (i < ammo) {
          ctx.fillStyle = armed ? '#FF6347' : '#7a3026';
          ctx.beginPath();
          ctx.moveTo(tx, my - 8);
          ctx.lineTo(tx + tubeW / 2, my - 11);
          ctx.lineTo(tx + tubeW, my - 8);
          ctx.closePath();
          ctx.fill();
        } else {
          // Empty tube — dark hole
          ctx.fillStyle = '#000000';
          ctx.fillRect(tx + 1, my - 8, tubeW - 2, 2);
        }
      }
    } else if (type === 'oil') {
      // Wide drum canister with a top valve
      ctx.fillStyle = '#1a1a22';
      this.roundRectPath(ctx, cx - 10, my - 6, 20, 14, 3);
      ctx.fill();
      // Purple band wrapping the drum
      ctx.fillStyle = armed ? '#9C27B0' : '#4a1a55';
      ctx.fillRect(cx - 10, my - 1, 20, 4);
      // Valve handle on top
      ctx.fillStyle = '#888';
      ctx.fillRect(cx - 1, my - 9, 2, 4);
      ctx.fillRect(cx - 4, my - 9, 8, 1.5);
      // Ammo dots along the side
      for (let i = 0; i < maxAmmo; i++) {
        const dotX = cx - 8 + i * 4;
        ctx.fillStyle = i < ammo ? '#E1BEE7' : '#3a1a4a';
        ctx.fillRect(dotX, my + 5, 2, 2);
      }
      // Faint drip below the drum (cosmetic only — actual oil hazard spawns separately)
      if (armed && ammo > 0) {
        ctx.fillStyle = 'rgba(40,15,60,0.55)';
        ctx.fillRect(cx - 1, my + 8, 2, 4);
      }
    } else if (type === 'smoke') {
      // Wide nozzle assembly with vertical vents
      ctx.fillStyle = '#1a1a22';
      this.roundRectPath(ctx, cx - 11, my - 5, 22, 12, 2);
      ctx.fill();
      // Vent slats
      ctx.fillStyle = armed ? '#90A4AE' : '#3a4248';
      for (let i = 0; i < 4; i++) {
        ctx.fillRect(cx - 9 + i * 5, my - 3, 3, 8);
      }
      // Side intake bands
      ctx.fillStyle = '#cccccc';
      ctx.fillRect(cx - 11, my - 5, 2, 12);
      ctx.fillRect(cx + 9, my - 5, 2, 12);
      // Ammo dots above
      for (let i = 0; i < maxAmmo; i++) {
        const dotX = cx - 8 + i * 4;
        ctx.fillStyle = i < ammo ? '#CFD8DC' : '#3a4248';
        ctx.fillRect(dotX, my - 9, 2, 2);
      }
      // A wisp of smoke trailing down when armed
      if (armed && ammo > 0) {
        ctx.fillStyle = 'rgba(180,190,200,0.4)';
        ctx.beginPath();
        ctx.arc(cx, my + 10, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // Side livery — chrome trim down the flanks + "01" race number on the trunk.
  // Skipped at critical damage so the torn-fender overlay reads cleanly.
  private renderLivery(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
    if (this.damageLevel >= 2) return;
    // Chrome trim — thin polished strip along each lower flank
    ctx.fillStyle = '#cfcfcf';
    ctx.fillRect(x + 1, y + h * 0.6, 2, h * 0.25);
    ctx.fillRect(x + w - 3, y + h * 0.6, 2, h * 0.25);
    // Pink under-trim accent
    ctx.fillStyle = '#FF1493';
    ctx.fillRect(x + 1, y + h * 0.6 + h * 0.27, 2, 1.5);
    ctx.fillRect(x + w - 3, y + h * 0.6 + h * 0.27, 2, 1.5);

    // "01" race number on the trunk (rear top, between the rear stripes).
    // Halo first, then black numeral on top.
    const cx = x + w / 2;
    const decalY = y + h - 18;
    ctx.save();
    ctx.fillStyle = 'rgba(255,20,140,0.35)';
    ctx.fillRect(cx - 9, decalY - 6, 18, 12);
    ctx.fillStyle = '#1a1a22';
    ctx.font = 'bold 11px "Arial Black", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('01', cx, decalY);
    ctx.restore();
  }

  // Driver silhouette — racing helmet with a colored visor strip + shoulder pads.
  // Drawn through the windshield so the cockpit reads as occupied.
  private renderDriver(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
    // Shoulder pads peeking below the helmet
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(cx - 7, cy + 4, 14, 4);
    // Helmet shell (charcoal)
    ctx.fillStyle = '#2a2a35';
    ctx.beginPath();
    ctx.ellipse(cx, cy, 5, 5.5, 0, 0, Math.PI * 2);
    ctx.fill();
    // Hot-pink helmet stripe (matches livery)
    ctx.fillStyle = '#FF1493';
    ctx.fillRect(cx - 5, cy - 0.5, 10, 1.5);
    // Visor — cyan band across the front, slight glow
    ctx.fillStyle = 'rgba(0,255,255,0.85)';
    ctx.beginPath();
    ctx.ellipse(cx, cy + 1.5, 4, 1.6, 0, 0, Math.PI * 2);
    ctx.fill();
    // Visor highlight
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillRect(cx - 2, cy + 1, 1.5, 0.8);
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
    const speedT = (this.speed - PLAYER.BRAKE_SPEED) / (PLAYER.BOOST_SPEED - PLAYER.BRAKE_SPEED);

    ctx.save();

    // Cyan waterline halo — boat equivalent of the car's underglow. Bigger
    // and brighter at boost so the player feels the speed.
    this.renderWaterlineGlow(ctx, this.x, y + h * 0.7, speedT);

    // Trailing wake — foam streaks behind the hull. Length + count + alpha
    // scale with speed so the wake reads as a propeller plume at boost.
    const wakeBase = 0.45 + 0.4 * Math.max(0, speedT);
    const wakeCount = 5 + Math.floor(speedT * 4);
    for (let i = 0; i < wakeCount; i++) {
      const t = (this.wakeT * 1.6 + i * 0.18) % 1;
      const yy = y + h + 6 + t * (50 + speedT * 30);
      const spread = 4 + t * (18 + speedT * 8);
      ctx.globalAlpha = wakeBase * (1 - t);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(this.x - spread - 2, yy, 3, 2);
      ctx.fillRect(this.x + spread - 1, yy, 3, 2);
    }
    // Inner cyan plume right behind the stern at high speed (jet exhaust feel)
    if (speedT > 0.4) {
      ctx.globalAlpha = (speedT - 0.4) * 0.8;
      ctx.fillStyle = '#88E5FF';
      for (let i = 0; i < 3; i++) {
        const t = (this.wakeT * 2.2 + i * 0.15) % 1;
        const py = y + h + 4 + t * 28;
        ctx.beginPath();
        ctx.arc(this.x, py, 2 + (1 - t) * 2, 0, Math.PI * 2);
        ctx.fill();
      }
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

    // Driver — same helmet as the car variant, slightly lower in the cockpit
    this.renderDriver(ctx, this.x, y + 36);

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

    // Twin-mounted machine guns flanking the bow — chrome housing + recoil
    this.renderGunBarrels(ctx, x, y, w);

    // Visible secondary weapon mount on the rear deck (boat-themed via
    // nautical accents). Renders nothing when nothing is equipped.
    this.renderSecondaryMount(ctx, x, y, w, h);

    // "01" race number on the deck above the motor (small, since boat deck is shorter)
    if (this.damageLevel < 2 && !this.secondary.type) {
      const cx = x + w / 2;
      const decalY = y + h - 18;
      ctx.save();
      ctx.fillStyle = 'rgba(255,20,140,0.35)';
      ctx.fillRect(cx - 9, decalY - 6, 18, 12);
      ctx.fillStyle = '#1a1a22';
      ctx.font = 'bold 11px "Arial Black", Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('01', cx, decalY);
      ctx.restore();
    }

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
