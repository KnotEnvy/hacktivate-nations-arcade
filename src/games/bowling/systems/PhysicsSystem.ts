// ===== src/games/bowling/systems/PhysicsSystem.ts =====
// Physics system for bowling ball and pin collisions - realistic bowling physics

import { BowlingBall } from '../entities/Ball';
import { Pin } from '../entities/Pin';
import { Lane } from '../entities/Lane';

export interface CollisionEvent {
  type: 'ball-pin' | 'pin-pin' | 'gutter' | 'wall';
  pinNumber?: number;
  position: { x: number; y: number };
  intensity: number;
}

export class PhysicsSystem {
  private lane: Lane;

  // Physics constants - ARCADE bowling physics (satisfying pin action)
  // Ball dominates pins but loses some energy
  private readonly BALL_PIN_RESTITUTION = 0.85;  // Good bounce for pins
  private readonly PIN_PIN_RESTITUTION = 0.85;   // Pins bounce off each other well (billiard-like)
  private readonly MIN_COLLISION_SPEED = 2;       // Minimum speed to register collision

  // Momentum transfer - tuned for satisfying feel
  private readonly BALL_VELOCITY_RETENTION = 0.88; // Ball loses ~12% velocity per pin hit
  private readonly PIN_IMPULSE_MULTIPLIER = 2.0;   // Pins scatter nicely but not too far

  // Substep configuration for accurate collision detection
  private readonly MAX_SUBSTEPS = 8;
  private readonly MIN_SUBSTEPS = 2;

  // Pin deck bounds (calculated from lane)
  private deckMinX: number = 0;
  private deckMaxX: number = 0;
  private deckMinY: number = 0;
  private deckMaxY: number = 0;

  // Track if gutter event was already fired
  private gutterEventFired: boolean = false;

  constructor(lane: Lane) {
    this.lane = lane;
    this.calculateDeckBounds();
  }

  // Calculate pin deck boundaries from lane
  private calculateDeckBounds(): void {
    this.deckMinX = this.lane.x + this.lane.gutterWidth + 8;
    this.deckMaxX = this.lane.x + this.lane.width - this.lane.gutterWidth - 8;
    this.deckMinY = this.lane.pinDeckY;
    this.deckMaxY = this.lane.pinDeckY + 130;
  }

  // Initialize pins with deck bounds
  initializePins(pins: Pin[]): void {
    for (const pin of pins) {
      pin.setDeckBounds(this.deckMinX, this.deckMaxX, this.deckMinY, this.deckMaxY);
    }
  }

  // Reset for new throw
  reset(): void {
    this.gutterEventFired = false;
  }

  update(ball: BowlingBall, pins: Pin[], dt: number): CollisionEvent[] {
    const events: CollisionEvent[] = [];

    // Determine substeps based on ball speed - more substeps for faster ball
    const speed = ball.getSpeed();
    let substeps = this.MIN_SUBSTEPS;
    if (speed > 500) substeps = this.MAX_SUBSTEPS;
    else if (speed > 300) substeps = 6;
    else if (speed > 150) substeps = 4;

    const subDt = dt / substeps;

    for (let step = 0; step < substeps; step++) {
      // Update ball position and physics
      if (!ball.isStopped()) {
        this.updateBall(ball, subDt, events);
      }

      // Check ball-pin collisions (only if ball is not in gutter)
      if (!ball.inGutter && !ball.isStopped()) {
        this.checkBallPinCollisions(ball, pins, events);
      }

      // Check pin-pin collisions
      this.checkPinPinCollisions(pins, events);

      // Update pins
      for (const pin of pins) {
        pin.update(subDt);
        pin.checkFall();
      }
    }

    // Update ball visuals (trail, rotation) once per frame
    ball.update(dt);

    return events;
  }

  private updateBall(ball: BowlingBall, dt: number, events: CollisionEvent[]): void {
    // Apply velocity to position
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    // Get lane boundaries
    const laneLeft = this.lane.x + this.lane.gutterWidth;
    const laneRight = this.lane.x + this.lane.width - this.lane.gutterWidth;
    const leftGutterCenter = this.lane.x + this.lane.gutterWidth / 2;
    const rightGutterCenter = this.lane.x + this.lane.width - this.lane.gutterWidth / 2;

    // Check for gutter entry
    if (!ball.inGutter) {
      if (ball.x - ball.radius < laneLeft) {
        // Entered left gutter
        ball.inGutter = true;
        ball.spin = 0;
        ball.x = leftGutterCenter;
        ball.vx = 0; // Ball rolls straight in gutter

        if (!this.gutterEventFired) {
          this.gutterEventFired = true;
          events.push({
            type: 'gutter',
            position: { x: ball.x, y: ball.y },
            intensity: 0.5
          });
        }
      } else if (ball.x + ball.radius > laneRight) {
        // Entered right gutter
        ball.inGutter = true;
        ball.spin = 0;
        ball.x = rightGutterCenter;
        ball.vx = 0; // Ball rolls straight in gutter

        if (!this.gutterEventFired) {
          this.gutterEventFired = true;
          events.push({
            type: 'gutter',
            position: { x: ball.x, y: ball.y },
            intensity: 0.5
          });
        }
      }
    }

    // If in gutter, keep ball in gutter center and rolling forward
    if (ball.inGutter) {
      // Determine which gutter
      const laneCenterX = this.lane.x + this.lane.width / 2;
      if (ball.x < laneCenterX) {
        ball.x = leftGutterCenter;
      } else {
        ball.x = rightGutterCenter;
      }
      ball.vx = 0;

      // Apply gutter friction (slightly more than lane)
      const gutterFriction = 0.992;
      ball.applyFriction(gutterFriction, dt);
    } else {
      // Normal lane physics

      // Get friction at current position
      const friction = this.lane.getFrictionAt(ball.y);
      ball.applyFriction(friction, dt);

      // Get hook strength and apply hook
      const hookStrength = this.lane.getHookStrengthAt(ball.y);
      if (hookStrength > 0) {
        ball.applyHook(hookStrength * dt);
      }

      // Keep ball in lane bounds (wall collisions)
      const effectiveLaneLeft = laneLeft + ball.radius;
      const effectiveLaneRight = laneRight - ball.radius;

      if (ball.x < effectiveLaneLeft) {
        ball.x = effectiveLaneLeft;
        ball.vx = Math.abs(ball.vx) * 0.3; // Bounce weakly off wall
        events.push({
          type: 'wall',
          position: { x: ball.x, y: ball.y },
          intensity: 0.3
        });
      } else if (ball.x > effectiveLaneRight) {
        ball.x = effectiveLaneRight;
        ball.vx = -Math.abs(ball.vx) * 0.3;
        events.push({
          type: 'wall',
          position: { x: ball.x, y: ball.y },
          intensity: 0.3
        });
      }
    }

    // Check if ball reached pins area (moving upward, so y decreases)
    if (ball.y < this.lane.pinDeckY + 120) {
      ball.reachedPins = true;
    }

    // Stop ball if it goes past the pin deck (top of lane)
    if (ball.y < this.lane.y - 20) {
      ball.stop();
    }
  }

  private checkBallPinCollisions(ball: BowlingBall, pins: Pin[], events: CollisionEvent[]): void {
    for (const pin of pins) {
      if (!pin.standing) continue;

      const dx = pin.x - ball.x;
      const dy = pin.y - ball.y;
      const distSq = dx * dx + dy * dy;
      const minDist = ball.radius + pin.radius;
      const minDistSq = minDist * minDist;

      if (distSq < minDistSq && distSq > 0) {
        const dist = Math.sqrt(distSq);
        const overlap = minDist - dist;

        // Normal vector from ball to pin (pin is in this direction from ball)
        const nx = dx / dist;
        const ny = dy / dist;

        // IMPORTANT: Ball plows through - barely moves, pin gets pushed away
        // Separate objects - push pin away in direction of normal
        ball.x -= nx * overlap * 0.05;  // Ball barely moves
        ball.y -= ny * overlap * 0.05;
        pin.x += nx * overlap * 1.0;    // Pin gets fully pushed away
        pin.y += ny * overlap * 1.0;

        // Get ball's velocity for impact calculation
        const ballSpeed = ball.getSpeed();

        // Ball loses some energy with each pin hit (but still plows through)
        ball.vx *= this.BALL_VELOCITY_RETENTION;
        ball.vy *= this.BALL_VELOCITY_RETENTION;

        // PIN gets pushed AWAY from ball (in direction of normal vector)
        // Scale based on ball speed for satisfying impact
        const impactForce = ballSpeed * this.PIN_IMPULSE_MULTIPLIER;

        // Pin velocity = momentum transfer + some of ball's direction
        // This creates natural pin scatter in the direction the ball was going
        pin.vx = nx * impactForce * 0.6 + ball.vx * 0.4;
        pin.vy = ny * impactForce * 0.6 + ball.vy * 0.4;

        // Transfer ball spin to pin - creates angled deflection
        if (Math.abs(ball.spin) > 0.1) {
          // Perpendicular to normal (sideways deflection from spin)
          const perpX = -ny;
          const perpY = nx;
          const spinTransfer = ball.spin * ballSpeed * 0.2;
          pin.vx += perpX * spinTransfer;
          pin.vy += perpY * spinTransfer;
          pin.applyAngularImpulse(ball.spin * 4);
        }

        // Immediately knock down the pin on direct hit
        pin.knockDown(nx, ny);

        // Record collision event
        events.push({
          type: 'ball-pin',
          pinNumber: pin.pinNumber,
          position: { x: pin.x, y: pin.y },
          intensity: Math.min(1, ballSpeed / 200)
        });
      }
    }
  }

  private checkPinPinCollisions(pins: Pin[], events: CollisionEvent[]): void {
    for (let i = 0; i < pins.length; i++) {
      const pinA = pins[i];

      // Skip if pin A is completely stopped and standing
      if (pinA.isStopped() && pinA.standing) continue;

      for (let j = i + 1; j < pins.length; j++) {
        const pinB = pins[j];

        // Skip if both pins are stopped and standing
        if (pinA.isStopped() && pinA.standing && pinB.isStopped() && pinB.standing) continue;

        const dx = pinB.x - pinA.x;
        const dy = pinB.y - pinA.y;
        const distSq = dx * dx + dy * dy;
        const minDist = pinA.radius + pinB.radius;
        const minDistSq = minDist * minDist;

        if (distSq < minDistSq && distSq > 0.01) {
          const dist = Math.sqrt(distSq);
          const overlap = minDist - dist;

          // Normal vector from A to B
          const nx = dx / dist;
          const ny = dy / dist;

          // Separate pins - push apart completely
          pinA.x -= nx * overlap * 0.55;
          pinA.y -= ny * overlap * 0.55;
          pinB.x += nx * overlap * 0.55;
          pinB.y += ny * overlap * 0.55;

          // Get speeds for collision calculation
          const speedA = Math.sqrt(pinA.vx * pinA.vx + pinA.vy * pinA.vy);
          const speedB = Math.sqrt(pinB.vx * pinB.vx + pinB.vy * pinB.vy);
          const combinedSpeed = speedA + speedB;

          // Any movement triggers collision response
          if (combinedSpeed > 3) {
            // BILLIARD-STYLE collision - proper momentum exchange
            const impactSpeed = Math.max(speedA, speedB, combinedSpeed * 0.5);

            // Calculate collision impulse along normal
            const relVelNormal = (pinA.vx - pinB.vx) * nx + (pinA.vy - pinB.vy) * ny;

            // Only process if actually colliding (not separating)
            if (relVelNormal < 0 || overlap > 0.5) {
              // Momentum transfer with restitution
              const impulse = Math.abs(relVelNormal) * this.PIN_PIN_RESTITUTION;

              // Pin A gets pushed back, Pin B gets pushed forward
              pinA.vx -= nx * impulse * 0.5;
              pinA.vy -= ny * impulse * 0.5;
              pinB.vx += nx * impulse * 0.5;
              pinB.vy += ny * impulse * 0.5;

              // Additional push based on who's moving faster
              if (speedA > speedB * 1.5) {
                // A is much faster - transfer more to B
                const boost = impactSpeed * 0.4;
                pinB.vx += nx * boost;
                pinB.vy += ny * boost;
                pinA.vx *= 0.7;
                pinA.vy *= 0.7;
              } else if (speedB > speedA * 1.5) {
                // B is much faster - transfer more to A
                const boost = impactSpeed * 0.4;
                pinA.vx -= nx * boost;
                pinA.vy -= ny * boost;
                pinB.vx *= 0.7;
                pinB.vy *= 0.7;
              }
            }

            // Low threshold - pins knock each other down easily
            const knockdownThreshold = 6;

            // Fallen/moving pin knocks down standing pin
            if (pinB.standing && !pinA.standing && impactSpeed > knockdownThreshold) {
              pinB.knockDown(nx, ny);
              // Give knocked pin velocity in collision direction
              pinB.vx += nx * impactSpeed * 0.6;
              pinB.vy += ny * impactSpeed * 0.6;
            }
            if (pinA.standing && !pinB.standing && impactSpeed > knockdownThreshold) {
              pinA.knockDown(-nx, -ny);
              pinA.vx -= nx * impactSpeed * 0.6;
              pinA.vy -= ny * impactSpeed * 0.6;
            }

            // Even standing pins can knock each other if hit hard enough
            if (pinA.standing && pinB.standing && impactSpeed > 15) {
              // Both get knocked - rare but dramatic
              pinA.knockDown(-nx, -ny);
              pinB.knockDown(nx, ny);
            }

            // Record collision event
            if (impactSpeed > 5) {
              events.push({
                type: 'pin-pin',
                position: { x: (pinA.x + pinB.x) / 2, y: (pinA.y + pinB.y) / 2 },
                intensity: Math.min(1, impactSpeed / 60)
              });
            }
          }
        }
      }
    }
  }

  // Check if all physics have settled
  isSettled(ball: BowlingBall, pins: Pin[]): boolean {
    // Ball must be stopped or past the pins
    if (!ball.isStopped() && ball.y > this.lane.y + 20) {
      return false;
    }

    // All pins must be settled
    for (const pin of pins) {
      if (!pin.isStopped()) {
        return false;
      }
    }

    return true;
  }

  // Check if physics is mostly settled (for early detection)
  isMostlySettled(ball: BowlingBall, pins: Pin[]): boolean {
    // Ball must be stopped or very slow
    if (!ball.isStopped() && ball.getSpeed() > 10) {
      return false;
    }

    // Count moving pins
    let movingPins = 0;
    for (const pin of pins) {
      if (!pin.isStopped()) {
        movingPins++;
      }
    }

    // Mostly settled if only 1-2 pins still moving slowly
    return movingPins <= 2;
  }
}
