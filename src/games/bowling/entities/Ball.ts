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
    const speed = this.getSpeed();

    // Render neon glow trail when moving
    if (this.trail.length > 2 && speed > 20) {
      ctx.save();

      // Outer glow trail
      for (let i = 0; i < this.trail.length - 1; i++) {
        const point = this.trail[i];
        const progress = i / this.trail.length;
        const size = this.radius * 0.8 * progress;

        // Neon magenta glow
        ctx.shadowColor = '#ff0066';
        ctx.shadowBlur = 8 * point.alpha;
        ctx.beginPath();
        ctx.arc(point.x, point.y, size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 50, 100, ${point.alpha * 0.4})`;
        ctx.fill();
      }

      // Inner trail core
      ctx.shadowBlur = 0;
      for (let i = 0; i < this.trail.length - 1; i++) {
        const point = this.trail[i];
        const progress = i / this.trail.length;
        const size = this.radius * 0.4 * progress;

        ctx.beginPath();
        ctx.arc(point.x, point.y, size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(120, 20, 40, ${point.alpha * 0.5})`;
        ctx.fill();
      }
      ctx.restore();
    }

    // Enhanced shadow with glow when fast
    ctx.save();
    if (speed > 80) {
      ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
      ctx.shadowBlur = 6;
    }
    ctx.beginPath();
    ctx.arc(this.x + 3, this.y + 4, this.radius * 0.95, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.fill();
    ctx.restore();

    // Main ball
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);

    // Ball base gradient (deep maroon with richer colors)
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);

    const gradient = ctx.createRadialGradient(
      -this.radius * 0.35,
      -this.radius * 0.35,
      0,
      0,
      0,
      this.radius
    );
    gradient.addColorStop(0, '#a01020');
    gradient.addColorStop(0.3, '#801010');
    gradient.addColorStop(0.6, '#580808');
    gradient.addColorStop(1, '#280404');

    ctx.fillStyle = gradient;
    ctx.fill();

    // Swirl/marble pattern overlay
    ctx.save();
    ctx.globalCompositeOperation = 'overlay';

    // Swirl band 1
    ctx.beginPath();
    ctx.arc(0, 0, this.radius * 0.7, -0.5, 1.2);
    ctx.strokeStyle = 'rgba(180, 40, 60, 0.4)';
    ctx.lineWidth = 4;
    ctx.stroke();

    // Swirl band 2
    ctx.beginPath();
    ctx.arc(0, 0, this.radius * 0.5, 1.8, 3.5);
    ctx.strokeStyle = 'rgba(200, 60, 80, 0.35)';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.restore();

    // Glossy rim highlight
    ctx.beginPath();
    ctx.arc(0, 0, this.radius - 1, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 100, 100, 0.25)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Finger holes (3 holes in triangle pattern) - deeper look
    const holeRadius = this.radius * 0.14;
    const holeOffset = this.radius * 0.35;

    // Hole shadow/depth
    ctx.fillStyle = '#0a0000';

    // Top hole
    ctx.beginPath();
    ctx.arc(0, -holeOffset, holeRadius + 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, -holeOffset, holeRadius, 0, Math.PI * 2);
    const holeGrad = ctx.createRadialGradient(0, -holeOffset, 0, 0, -holeOffset, holeRadius);
    holeGrad.addColorStop(0, '#000000');
    holeGrad.addColorStop(1, '#1a0505');
    ctx.fillStyle = holeGrad;
    ctx.fill();

    // Bottom left hole
    ctx.beginPath();
    ctx.arc(-holeOffset * 0.7, holeOffset * 0.5, holeRadius + 1, 0, Math.PI * 2);
    ctx.fillStyle = '#0a0000';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(-holeOffset * 0.7, holeOffset * 0.5, holeRadius, 0, Math.PI * 2);
    ctx.fillStyle = holeGrad;
    ctx.fill();

    // Bottom right hole
    ctx.beginPath();
    ctx.arc(holeOffset * 0.7, holeOffset * 0.5, holeRadius + 1, 0, Math.PI * 2);
    ctx.fillStyle = '#0a0000';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(holeOffset * 0.7, holeOffset * 0.5, holeRadius, 0, Math.PI * 2);
    ctx.fillStyle = holeGrad;
    ctx.fill();

    // Primary specular highlight
    ctx.beginPath();
    ctx.ellipse(-this.radius * 0.32, -this.radius * 0.32, this.radius * 0.28, this.radius * 0.2, -0.4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.fill();

    // Secondary highlight
    ctx.beginPath();
    ctx.ellipse(-this.radius * 0.15, -this.radius * 0.2, this.radius * 0.1, this.radius * 0.08, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.fill();

    ctx.restore();

    // Spin indicator (small arrow showing hook direction) - with glow
    if (Math.abs(this.spin) > 0.1 && speed > 50) {
      ctx.save();
      ctx.translate(this.x, this.y - this.radius - 10);

      const arrowDir = this.spin > 0 ? 1 : -1;
      const arrowColor = this.spin > 0 ? '#FF6B6B' : '#6B9FFF';

      ctx.shadowColor = arrowColor;
      ctx.shadowBlur = 6;
      ctx.fillStyle = arrowColor;

      ctx.beginPath();
      ctx.moveTo(arrowDir * 10, 0);
      ctx.lineTo(0, -5);
      ctx.lineTo(0, 5);
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
