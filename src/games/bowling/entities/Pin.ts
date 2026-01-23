// ===== src/games/bowling/entities/Pin.ts =====
// Bowling pin with realistic physics - proper mass, inertia, and settling

export interface PinState {
  standing: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;      // Visual rotation when falling
  rotationVel: number;   // Angular velocity
  fallDirection: number; // Direction pin is falling (radians)
}

export class Pin {
  // Position (center of pin base)
  x: number;
  y: number;

  // Velocity
  vx: number = 0;
  vy: number = 0;

  // Pin dimensions (top-down view approximation)
  width: number = 12;
  height: number = 20;
  radius: number = 10; // Collision radius - taller to prevent flying over

  // Physics - realistic bowling pin mass (~3.5 pounds)
  mass: number = 3.5;

  // Moment of inertia for rotation (approximated)
  inertia: number = 2.5;

  // State
  standing: boolean = true;
  knocked: boolean = false;

  // Visual rotation when falling - ENHANCED for Wii-style tumbling
  rotation: number = 0;
  rotationVel: number = 0;
  fallProgress: number = 0; // 0 = standing, 1 = fully fallen
  fallDirection: number = 0; // Direction pin falls (radians)

  // NEW: Wii-style wobble before falling
  wobbleAmount: number = 0;  // 0-1 intensity of wobble
  wobblePhase: number = 0;   // Current phase of wobble animation
  isWobbling: boolean = false;
  wobbleTimer: number = 0;

  // NEW: Air-time simulation - pins "pop up" briefly
  airTime: number = 0;       // Time in air
  airHeight: number = 0;     // Visual height off ground
  peakAirHeight: number = 0; // Maximum air height reached

  // NEW: Velocity-based visual effects
  impactIntensity: number = 0; // For flash/stretch effects

  // Original position for reset
  originalX: number;
  originalY: number;

  // Pin number (1-10)
  pinNumber: number;

  // Hit flash effect
  hitFlash: number = 0;

  // Settling timer - pins settle after impact
  private settleTimer: number = 0;
  private readonly SETTLE_TIME: number = 2.0; // Seconds before fully settled

  // Pin deck boundaries (set by physics system)
  private deckMinX: number = 0;
  private deckMaxX: number = 500;
  private deckMinY: number = 0;
  private deckMaxY: number = 200;

  // Friction coefficients - tuned for REALISTIC challenging physics
  private readonly SLIDE_FRICTION = 0.91;  // Higher friction - pins slow down faster
  private readonly ANGULAR_DAMPING = 0.88; // More damping - pins settle fast

  constructor(x: number, y: number, pinNumber: number) {
    this.x = x;
    this.y = y;
    this.originalX = x;
    this.originalY = y;
    this.pinNumber = pinNumber;
  }

  // Set pin deck boundaries (pins should mostly stay in this area)
  setDeckBounds(minX: number, maxX: number, minY: number, maxY: number): void {
    this.deckMinX = minX;
    this.deckMaxX = maxX;
    this.deckMinY = minY;
    this.deckMaxY = maxY;
  }

  update(dt: number): void {
    // Update impact intensity fade
    if (this.impactIntensity > 0) {
      this.impactIntensity -= dt * 3;
    }

    // Handle wobble animation for standing pins that got bumped
    if (this.isWobbling && this.standing) {
      this.wobbleTimer += dt;
      this.wobblePhase += dt * 25; // Fast wobble frequency
      this.wobbleAmount *= 0.92; // Decay wobble

      // Stop wobbling when it's minimal
      if (this.wobbleAmount < 0.01) {
        this.isWobbling = false;
        this.wobbleAmount = 0;
      }
    }

    if (!this.standing) {
      // Update air-time simulation - pins "pop up" before falling
      if (this.airTime > 0) {
        this.airTime -= dt;
        // Parabolic arc for air height
        const airProgress = 1 - (this.airTime / 0.4); // 0.4s total air time
        if (airProgress < 0.5) {
          // Rising
          this.airHeight = this.peakAirHeight * (airProgress * 2);
        } else {
          // Falling
          this.airHeight = this.peakAirHeight * (1 - (airProgress - 0.5) * 2);
        }
        this.airHeight = Math.max(0, this.airHeight);
      } else {
        this.airHeight = 0;
      }

      // Update falling animation - SLOWER for more dramatic tumbling
      this.fallProgress = Math.min(1, this.fallProgress + dt * 2.0);

      // Update rotation - allow MORE rotation for Wii-style tumbling
      this.rotation += this.rotationVel * dt;

      // Dampen rotation (but less aggressively for visible tumbling)
      this.rotationVel *= Math.pow(this.ANGULAR_DAMPING, dt * 60);

      // Higher rotation cap - pins can tumble visibly
      if (Math.abs(this.rotationVel) > 12) {
        this.rotationVel = Math.sign(this.rotationVel) * 12;
      }

      // Move pin while falling/sliding
      this.x += this.vx * dt;
      this.y += this.vy * dt;

      // Apply friction (reduced for more rolling/sliding)
      const frictionMultiplier = Math.pow(this.SLIDE_FRICTION, dt * 60);
      this.vx *= frictionMultiplier;
      this.vy *= frictionMultiplier;

      // ROLLING PHYSICS: Pin rotation should be driven by velocity
      // This makes pins look like they're rolling rather than sliding
      const speed = this.getSpeed();
      if (speed > 3 && this.fallProgress > 0.5) {
        // Calculate rolling rotation based on velocity direction and speed
        // The faster the pin moves, the faster it should rotate
        const targetRotVel = speed * 0.08 * Math.sign(this.vx + 0.01); // Roll direction based on movement
        // Blend current rotation towards rolling rotation
        this.rotationVel = this.rotationVel * 0.9 + targetRotVel * 0.1;
      }

      // Constrain pins to deck area
      this.constrainToDeck();

      // Track settling - use the recalculated speed
      const currentSpeed = this.getSpeed();
      if (currentSpeed < 6 && Math.abs(this.rotationVel) < 0.8) {
        this.settleTimer += dt;
      } else {
        this.settleTimer = Math.max(0, this.settleTimer - dt * 0.3);
      }

      // Stop when VERY slow - lower thresholds for more rolling
      if (currentSpeed < 2 && Math.abs(this.rotationVel) < 0.2 && this.fallProgress >= 0.9 && this.airTime <= 0) {
        this.vx = 0;
        this.vy = 0;
        this.rotationVel = 0;
        this.fallProgress = 1;
      }
    }

    // Fade hit flash
    if (this.hitFlash > 0) {
      this.hitFlash -= dt * 5;
    }
  }

  // Constrain pins to deck area - pins bounce off walls!
  private constrainToDeck(): void {
    const padding = this.radius;
    const bounceRestitution = 0.50; // Reduced wall bounce - less ricochet chaos

    // Left boundary - bounce back
    if (this.x < this.deckMinX + padding) {
      this.x = this.deckMinX + padding;
      if (this.vx < 0) {
        this.vx = -this.vx * bounceRestitution;
        // Add slight random deflection for natural feel
        this.vy += (Math.random() - 0.5) * Math.abs(this.vx) * 0.2;
      }
    }
    // Right boundary - bounce back
    if (this.x > this.deckMaxX - padding) {
      this.x = this.deckMaxX - padding;
      if (this.vx > 0) {
        this.vx = -this.vx * bounceRestitution;
        this.vy += (Math.random() - 0.5) * Math.abs(this.vx) * 0.2;
      }
    }
    // Top boundary (back wall) - bounce back
    if (this.y < this.deckMinY + padding) {
      this.y = this.deckMinY + padding;
      if (this.vy < 0) {
        this.vy = -this.vy * bounceRestitution;
        this.vx += (Math.random() - 0.5) * Math.abs(this.vy) * 0.2;
      }
    }
    // Bottom boundary (toward foul line) - softer bounce
    if (this.y > this.deckMaxY - padding) {
      this.y = this.deckMaxY - padding;
      if (this.vy > 0) {
        this.vy = -this.vy * bounceRestitution * 0.5; // Softer bounce toward player
      }
    }
  }

  // Check if pin has been displaced enough to fall OR start wobbling
  checkFall(): void {
    if (!this.standing) return;

    const dx = this.x - this.originalX;
    const dy = this.y - this.originalY;
    const displacement = Math.sqrt(dx * dx + dy * dy);

    // Pin falls if displaced more than 85% of its radius (very stable)
    if (displacement > this.radius * 0.85) {
      this.knockDown(dx, dy);
    }
    // Pin wobbles if displaced 25-85% of radius (wide wobble zone)
    else if (displacement > this.radius * 0.25 && !this.isWobbling) {
      this.startWobble(displacement / this.radius);
    }
  }

  // NEW: Start wobble animation (pin was bumped but didn't fall)
  startWobble(intensity: number): void {
    this.isWobbling = true;
    this.wobbleAmount = Math.min(1, intensity * 2);
    this.wobblePhase = 0;
    this.wobbleTimer = 0;
  }

  knockDown(dx: number, dy: number): void {
    if (!this.standing) return;

    this.standing = false;
    this.knocked = true;
    this.isWobbling = false;
    this.wobbleAmount = 0;

    // Calculate fall direction from displacement/velocity
    if (Math.abs(this.vx) > 1 || Math.abs(this.vy) > 1) {
      // Fall in the direction the pin is moving
      this.fallDirection = Math.atan2(this.vy, this.vx);
    } else if (dx !== 0 || dy !== 0) {
      this.fallDirection = Math.atan2(dy, dx);
    } else {
      this.fallDirection = Math.random() * Math.PI * 2;
    }

    // ENHANCED: More dramatic rotation for Wii-style tumbling
    const impactSpeed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
    // Higher base rotation + speed-based bonus
    this.rotationVel = (2 + impactSpeed * 0.04) * (Math.random() > 0.5 ? 1 : -1);
    // Add some randomness for natural feel
    this.rotationVel += (Math.random() - 0.5) * 2;

    // NEW: Calculate air-time based on impact speed (pins "pop up")
    if (impactSpeed > 30) {
      this.airTime = Math.min(0.4, impactSpeed * 0.002); // Up to 0.4 seconds air time
      this.peakAirHeight = Math.min(20, impactSpeed * 0.08); // Up to 20 pixel lift
    }

    // Set impact intensity for visual effects
    this.impactIntensity = Math.min(1, impactSpeed / 150);

    this.hitFlash = 1;
    this.settleTimer = 0;
  }

  // Apply impulse from collision - billiard-style momentum transfer
  applyImpulse(ix: number, iy: number): void {
    // Apply linear impulse (momentum = impulse / mass)
    this.vx += ix / this.mass;
    this.vy += iy / this.mass;

    // Cap velocity for good pin action (not too far, not too slow)
    const maxVel = 220; // Balanced speed
    const speed = this.getSpeed();
    if (speed > maxVel) {
      const scale = maxVel / speed;
      this.vx *= scale;
      this.vy *= scale;
    }

    // Add rotation based on impact - makes pins tumble realistically
    const impactMagnitude = Math.sqrt(ix * ix + iy * iy);
    if (impactMagnitude > 15) {
      // Rotation based on impact direction and magnitude
      const rotationImpulse = (impactMagnitude * 0.006) / this.inertia;
      // Cross product gives rotation direction
      this.rotationVel += rotationImpulse * Math.sign(ix * this.vy - iy * this.vx + 0.1);
    }
  }

  // Apply angular impulse (for spin transfer from ball)
  applyAngularImpulse(angularImpulse: number): void {
    this.rotationVel += angularImpulse / this.inertia;
  }

  getSpeed(): number {
    return Math.sqrt(this.vx * this.vx + this.vy * this.vy);
  }

  isStopped(): boolean {
    const speed = this.getSpeed();
    const angularSpeed = Math.abs(this.rotationVel);

    if (this.standing) {
      return speed < 1;
    }

    // Fallen pin is stopped when slow and has settled
    return speed < 2 && angularSpeed < 0.2 && this.fallProgress >= 0.95;
  }

  // Check if pin is fully settled (for longer wait times)
  isFullySettled(): boolean {
    return this.isStopped() && (this.standing || this.settleTimer > this.SETTLE_TIME * 0.5);
  }

  render(ctx: CanvasRenderingContext2D): void {
    ctx.save();

    // Apply air height offset for fallen pins that are "in the air"
    const airOffset = this.airHeight;
    ctx.translate(this.x, this.y - airOffset);

    if (this.standing) {
      // Apply wobble rotation for standing pins
      if (this.isWobbling && this.wobbleAmount > 0) {
        const wobbleAngle = Math.sin(this.wobblePhase) * this.wobbleAmount * 0.15;
        ctx.rotate(wobbleAngle);
      }
      // Standing pin - top-down view
      this.renderStandingPin(ctx);
    } else {
      // Falling/fallen pin
      this.renderFallenPin(ctx);
    }

    ctx.restore();
  }

  private renderStandingPin(ctx: CanvasRenderingContext2D): void {
    // Enhanced shadow with soft edge
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;
    ctx.beginPath();
    ctx.ellipse(2, 2, this.width * 0.45, this.height * 0.28, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.fill();
    ctx.restore();

    // Pin body (top-down oval shape) - glossy white
    ctx.beginPath();
    ctx.ellipse(0, 0, this.width * 0.5, this.height * 0.4, 0, 0, Math.PI * 2);

    // Premium 3D gradient for glossy effect
    const gradient = ctx.createRadialGradient(
      -this.width * 0.2,
      -this.height * 0.15,
      0,
      0,
      0,
      this.width * 0.6
    );
    gradient.addColorStop(0, '#ffffff');
    gradient.addColorStop(0.25, '#fefefe');
    gradient.addColorStop(0.5, '#f8f8f8');
    gradient.addColorStop(0.75, '#e8e8e8');
    gradient.addColorStop(1, '#c8c8c8');

    ctx.fillStyle = gradient;
    ctx.fill();

    // Glossy outer ring
    ctx.beginPath();
    ctx.ellipse(0, 0, this.width * 0.5, this.height * 0.4, 0, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(180, 180, 190, 0.8)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Red stripes (neck area) - brighter and more visible
    ctx.strokeStyle = '#DD1111';
    ctx.lineWidth = 2.5;

    // Two red stripes with glow
    ctx.save();
    ctx.shadowColor = '#ff3333';
    ctx.shadowBlur = 3;

    ctx.beginPath();
    ctx.ellipse(0, -this.height * 0.15, this.width * 0.35, this.height * 0.08, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.ellipse(0, -this.height * 0.05, this.width * 0.38, this.height * 0.08, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // Primary specular highlight
    ctx.beginPath();
    ctx.ellipse(-this.width * 0.18, -this.height * 0.12, this.width * 0.14, this.height * 0.1, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.fill();

    // Secondary smaller highlight
    ctx.beginPath();
    ctx.ellipse(-this.width * 0.08, -this.height * 0.06, this.width * 0.06, this.height * 0.04, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.fill();

    // Hit flash overlay - enhanced with glow
    if (this.hitFlash > 0) {
      ctx.save();
      ctx.shadowColor = '#ffff00';
      ctx.shadowBlur = 10 * this.hitFlash;
      ctx.beginPath();
      ctx.ellipse(0, 0, this.width * 0.5, this.height * 0.4, 0, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 100, ${this.hitFlash * 0.6})`;
      ctx.fill();

      // White hot center
      ctx.beginPath();
      ctx.ellipse(0, 0, this.width * 0.3, this.height * 0.24, 0, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${this.hitFlash * 0.4})`;
      ctx.fill();
      ctx.restore();
    }
  }

  private renderFallenPin(ctx: CanvasRenderingContext2D): void {
    // Add visual rotation based on tumbling
    ctx.rotate(this.fallDirection + this.rotation * 0.3);

    // Simple fallen pin - elongated shape lying on its side
    const pinLength = this.height * 0.9;
    const pinWidth = this.width * 0.4;

    // Velocity-based stretch effect for fast-moving pins
    const speed = this.getSpeed();
    const stretchFactor = 1 + Math.min(0.3, speed * 0.001);

    // Shadow - offset more when pin is in the air
    const shadowOffset = 4 + this.airHeight * 0.5;
    ctx.beginPath();
    ctx.ellipse(pinLength * 0.3, shadowOffset, pinLength * 0.5, pinWidth * 0.6, 0, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(0, 0, 0, ${0.25 - this.airHeight * 0.01})`;
    ctx.fill();

    // Pin body - simple capsule/rounded rectangle shape
    ctx.beginPath();
    // Draw rounded rectangle for pin lying on side
    const x = -pinWidth * 0.5;
    const y = -pinWidth;
    const w = pinLength;
    const h = pinWidth * 2;
    const r = pinWidth * 0.8;

    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();

    // Fill with gradient
    const gradient = ctx.createLinearGradient(x, y, x, y + h);
    gradient.addColorStop(0, '#e8e8e8');
    gradient.addColorStop(0.3, '#ffffff');
    gradient.addColorStop(0.7, '#f0f0f0');
    gradient.addColorStop(1, '#c0c0c0');

    ctx.fillStyle = gradient;
    ctx.fill();

    // Red stripe in middle
    ctx.fillStyle = '#CC0000';
    ctx.fillRect(pinLength * 0.3, -pinWidth * 0.15, pinLength * 0.15, pinWidth * 0.3);

    // Outline
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    ctx.strokeStyle = '#999999';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  reset(): void {
    this.x = this.originalX;
    this.y = this.originalY;
    this.vx = 0;
    this.vy = 0;
    this.standing = true;
    this.knocked = false;
    this.rotation = 0;
    this.rotationVel = 0;
    this.fallProgress = 0;
    this.fallDirection = 0;
    this.hitFlash = 0;
    this.settleTimer = 0;
    // Reset new Wii-style properties
    this.wobbleAmount = 0;
    this.wobblePhase = 0;
    this.isWobbling = false;
    this.wobbleTimer = 0;
    this.airTime = 0;
    this.airHeight = 0;
    this.peakAirHeight = 0;
    this.impactIntensity = 0;
  }

  getState(): PinState {
    return {
      standing: this.standing,
      x: this.x,
      y: this.y,
      vx: this.vx,
      vy: this.vy,
      rotation: this.rotation,
      rotationVel: this.rotationVel,
      fallDirection: this.fallDirection
    };
  }
}
