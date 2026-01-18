// ===== src/games/bowling/entities/Ball.ts =====
// Bowling ball with spin and hook mechanics - realistic physics

export class BowlingBall {
  x: number;
  y: number;
  vx: number = 0;
  vy: number = 0;

  // Spin affects hook in dry zone (-1 = left hook, +1 = right hook)
  spin: number = 0;

  // Ball properties - realistic bowling ball
  radius: number = 14;
  mass: number = 15; // ~15 pounds (regulation bowling ball)

  // Visual rotation for rendering
  rotation: number = 0;
  rotationSpeed: number = 0;

  // Trail effect
  private trail: { x: number; y: number; alpha: number }[] = [];
  private readonly maxTrailLength = 15;

  // State
  inGutter: boolean = false;
  reachedPins: boolean = false;
  private stopped: boolean = false;

  // Initial throw velocity (stored to calculate minimum speed)
  private initialSpeed: number = 0;

  // Lane reference Y for determining when ball has passed pins
  private targetY: number = 0;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  // Set the target Y (pin deck area) - ball should always reach this
  setTargetY(y: number): void {
    this.targetY = y;
  }

  // Start the ball rolling with initial velocity
  launch(vx: number, vy: number, spin: number): void {
    this.vx = vx;
    this.vy = vy; // Should be negative (moving up/toward pins)
    this.spin = spin;
    this.stopped = false;
    this.initialSpeed = this.getSpeed();
  }

  update(dt: number): void {
    if (this.stopped) return;

    // Update visual rotation based on velocity
    // Ball rotates based on forward movement
    const speed = this.getSpeed();

    // Calculate rotation from velocity direction and speed
    // Negative vy means moving up, rotation should reflect forward roll
    const rollAngle = Math.atan2(this.vx, -this.vy);
    this.rotationSpeed = speed * 0.015;
    this.rotation += this.rotationSpeed * dt * 60;

    // Add side-spin visual rotation based on spin value
    this.rotation += this.spin * dt * 2;

    // Add current position to trail when moving
    if (speed > 10) {
      this.trail.push({ x: this.x, y: this.y, alpha: 1 });
      if (this.trail.length > this.maxTrailLength) {
        this.trail.shift();
      }
    }

    // Fade trail
    for (const point of this.trail) {
      point.alpha *= 0.85;
    }

    // Remove faded trail points
    this.trail = this.trail.filter(p => p.alpha > 0.05);
  }

  getSpeed(): number {
    return Math.sqrt(this.vx * this.vx + this.vy * this.vy);
  }

  // Get minimum allowed speed - ball should coast to pins
  // Returns a very low minimum once ball is past certain point
  getMinSpeed(): number {
    // If ball hasn't reached pins area yet, maintain minimum momentum
    if (this.y > this.targetY + 50) {
      // Gradually reduce minimum speed as ball approaches pins
      const distanceToTarget = this.y - this.targetY;
      // Start with 15% of initial speed, reduce to near zero
      return Math.max(5, this.initialSpeed * 0.05 * Math.min(1, distanceToTarget / 400));
    }
    // Once near/past pins, can slow to a crawl
    return 2;
  }

  isStopped(): boolean {
    return this.stopped || this.getSpeed() < 2;
  }

  stop(): void {
    this.vx = 0;
    this.vy = 0;
    this.stopped = true;
  }

  // Apply friction force (called by physics system)
  applyFriction(frictionCoeff: number, dt: number): void {
    if (this.stopped) return;

    const speed = this.getSpeed();
    if (speed < 1) return;

    // Friction is a decelerating force proportional to velocity
    // Using realistic friction model: F = -mu * v
    // But we want the ball to always reach the pins, so we use
    // a friction that reduces speed but maintains minimum momentum

    // Calculate friction deceleration
    const frictionDecel = (1 - frictionCoeff) * 500; // Convert to deceleration rate

    // Apply friction in direction opposite to velocity
    const nx = this.vx / speed;
    const ny = this.vy / speed;

    let newSpeed = speed - frictionDecel * dt;

    // Ensure ball maintains minimum speed until it reaches target
    const minSpeed = this.getMinSpeed();
    if (newSpeed < minSpeed && !this.reachedPins) {
      newSpeed = minSpeed;
    }

    // Apply new speed while maintaining direction
    if (newSpeed > 0) {
      this.vx = nx * newSpeed;
      this.vy = ny * newSpeed;
    }
  }

  // Apply hook force based on spin and zone friction
  applyHook(hookStrength: number): void {
    if (this.stopped || this.inGutter) return;

    const speed = this.getSpeed();
    if (speed < 15) return;

    // Hook force is perpendicular to velocity direction
    // Positive spin = hook right, negative spin = hook left
    const nx = this.vx / speed;
    const ny = this.vy / speed;

    // Perpendicular vector (90 degrees to velocity)
    // For a ball moving up (-vy), positive spin should curve right (+vx)
    const px = -ny; // Perpendicular X
    const py = nx;  // Perpendicular Y

    // Apply hook force based on spin
    // Hook effect is stronger and more noticeable
    // Scales with speed but has a minimum effect
    const speedFactor = Math.max(0.5, speed / 200);
    const hookForce = this.spin * hookStrength * speedFactor * 1.5;

    this.vx += px * hookForce;
    this.vy += py * hookForce;

    // Gradually reduce spin as hook is applied (spin transfers to motion)
    this.spin *= 0.998;
  }

  // Handle collision with pins - ball plows through with minimal slowdown
  handlePinCollision(impulseX: number, impulseY: number): void {
    // Ball is 4x heavier than pins - it DOMINATES
    // Barely any deflection at all - pins fly, ball keeps going
    this.vx -= impulseX * 0.01;
    this.vy -= impulseY * 0.01;
  }

  render(ctx: CanvasRenderingContext2D): void {
    // Render trail
    if (this.trail.length > 2) {
      ctx.save();
      for (let i = 0; i < this.trail.length - 1; i++) {
        const point = this.trail[i];
        const size = this.radius * 0.6 * (i / this.trail.length);

        ctx.beginPath();
        ctx.arc(point.x, point.y, size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(40, 40, 40, ${point.alpha * 0.3})`;
        ctx.fill();
      }
      ctx.restore();
    }

    // Shadow
    ctx.save();
    ctx.beginPath();
    ctx.arc(this.x + 3, this.y + 3, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fill();
    ctx.restore();

    // Main ball
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);

    // Ball gradient (deep red/maroon bowling ball)
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);

    const gradient = ctx.createRadialGradient(
      -this.radius * 0.3,
      -this.radius * 0.3,
      0,
      0,
      0,
      this.radius
    );
    gradient.addColorStop(0, '#8B0000');
    gradient.addColorStop(0.5, '#600000');
    gradient.addColorStop(1, '#300000');

    ctx.fillStyle = gradient;
    ctx.fill();

    // Finger holes (3 holes in triangle pattern)
    ctx.fillStyle = '#1a0000';
    const holeRadius = this.radius * 0.15;
    const holeOffset = this.radius * 0.35;

    // Top hole
    ctx.beginPath();
    ctx.arc(0, -holeOffset, holeRadius, 0, Math.PI * 2);
    ctx.fill();

    // Bottom left hole
    ctx.beginPath();
    ctx.arc(-holeOffset * 0.7, holeOffset * 0.5, holeRadius, 0, Math.PI * 2);
    ctx.fill();

    // Bottom right hole
    ctx.beginPath();
    ctx.arc(holeOffset * 0.7, holeOffset * 0.5, holeRadius, 0, Math.PI * 2);
    ctx.fill();

    // Highlight shine
    ctx.beginPath();
    ctx.arc(-this.radius * 0.3, -this.radius * 0.3, this.radius * 0.25, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.fill();

    ctx.restore();

    // Spin indicator (small arrow showing hook direction)
    if (Math.abs(this.spin) > 0.1 && this.getSpeed() > 50) {
      ctx.save();
      ctx.translate(this.x, this.y - this.radius - 8);

      const arrowDir = this.spin > 0 ? 1 : -1;
      ctx.fillStyle = this.spin > 0 ? '#FF6B6B' : '#6B9FFF';

      ctx.beginPath();
      ctx.moveTo(arrowDir * 8, 0);
      ctx.lineTo(0, -4);
      ctx.lineTo(0, 4);
      ctx.closePath();
      ctx.fill();

      ctx.restore();
    }
  }

  reset(x: number, y: number): void {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.spin = 0;
    this.rotation = 0;
    this.rotationSpeed = 0;
    this.trail = [];
    this.inGutter = false;
    this.reachedPins = false;
    this.stopped = false;
    this.initialSpeed = 0;
  }
}
