// ===== src/games/minigolf/systems/PhysicsSystem.ts =====

import { Ball } from '../entities/Ball';
import { Obstacle } from '../entities/Obstacle';

export interface CourseBounds {
  points: { x: number; y: number }[];
}

export interface CollisionResult {
  hitWall: boolean;
  hitObstacle: boolean;
  hitX?: number;
  hitY?: number;
  obstacle?: Obstacle;
}

export class PhysicsSystem {
  private canvasWidth: number;
  private canvasHeight: number;
  private bounds: CourseBounds | null = null;
  private obstacles: Obstacle[] = [];
  
  // Physics constants
  private readonly FRICTION = 0.985;
  private readonly SAND_FRICTION = 0.92;
  private readonly BOUNCE_DAMPING = 0.7;
  private readonly MIN_SPEED = 5; // Match ball's isStopped threshold
  private readonly BUMPER_BOOST = 1.3;

  constructor(width: number, height: number) {
    this.canvasWidth = width;
    this.canvasHeight = height;
  }

  setCourseBounds(bounds: CourseBounds): void {
    this.bounds = bounds;
  }

  setObstacles(obstacles: Obstacle[]): void {
    this.obstacles = obstacles;
  }

  updateBall(ball: Ball, dt: number, obstacles: Obstacle[]): CollisionResult {
    const result: CollisionResult = {
      hitWall: false,
      hitObstacle: false,
    };
    
    // Store previous position
    const prevX = ball.x;
    const prevY = ball.y;
    
    // Apply velocity (with substeps for high speeds to prevent tunneling)
    const speed = ball.getSpeed();
    const substeps = speed > 300 ? 3 : (speed > 150 ? 2 : 1);
    const subDt = dt / substeps;
    
    for (let step = 0; step < substeps; step++) {
      ball.x += ball.vx * subDt;
      ball.y += ball.vy * subDt;
      
      // Check bounds each substep
      if (this.bounds) {
        const boundsResult = this.checkBoundsCollision(ball, prevX, prevY);
        if (boundsResult.hit) {
          result.hitWall = true;
          result.hitX = ball.x;
          result.hitY = ball.y;
        }
      }
    }
    
    // Update ball (for trail)
    ball.update(dt);
    
    // Check obstacle collisions
    for (const obstacle of obstacles) {
      obstacle.update(dt);
      
      if (obstacle.containsPoint(ball.x, ball.y)) {
        result.hitObstacle = true;
        result.obstacle = obstacle;
        result.hitX = ball.x;
        result.hitY = ball.y;
        
        switch (obstacle.type) {
          case 'wall':
            this.handleWallBounce(ball, obstacle, prevX, prevY);
            result.hitWall = true;
            break;
          case 'bumper':
            this.handleBumperBounce(ball, obstacle);
            break;
          case 'water':
            // Water handled by game logic - just flag it
            break;
          case 'sand':
            // Apply extra friction (handled below)
            break;
          case 'ramp':
            this.handleRamp(ball, obstacle);
            break;
          case 'windmill':
            this.handleWindmillCollision(ball, obstacle, prevX, prevY);
            result.hitWall = true;
            break;
        }
      }
    }
    
    // Final bounds check (fallback rectangular bounds)
    if (!this.bounds) {
      this.checkRectBounds(ball);
    }
    
    // Safety check - ensure ball is always within canvas
    this.ensureBallInBounds(ball);
    
    // Apply friction
    let friction = this.FRICTION;
    
    // Check if in sand
    for (const obstacle of obstacles) {
      if (obstacle.type === 'sand' && obstacle.containsPoint(ball.x, ball.y)) {
        friction = this.SAND_FRICTION;
        break;
      }
    }
    
    ball.vx *= friction;
    ball.vy *= friction;
    
    // Stop completely if very slow - this prevents wind drift
    if (ball.getSpeed() < this.MIN_SPEED) {
      ball.vx = 0;
      ball.vy = 0;
    }
    
    return result;
  }

  private ensureBallInBounds(ball: Ball): void {
    // Hard limits to prevent ball from ever going off-screen
    const padding = 65; // Account for UI at top
    const margin = ball.radius + 5;
    
    if (ball.x < margin) {
      ball.x = margin;
      ball.vx = Math.abs(ball.vx) * 0.5;
    }
    if (ball.x > this.canvasWidth - margin) {
      ball.x = this.canvasWidth - margin;
      ball.vx = -Math.abs(ball.vx) * 0.5;
    }
    if (ball.y < padding + margin) {
      ball.y = padding + margin;
      ball.vy = Math.abs(ball.vy) * 0.5;
    }
    if (ball.y > this.canvasHeight - margin) {
      ball.y = this.canvasHeight - margin;
      ball.vy = -Math.abs(ball.vy) * 0.5;
    }
  }

  private handleWallBounce(ball: Ball, wall: Obstacle, prevX: number, prevY: number): void {
    const normal = wall.getCollisionNormal(ball);
    if (!normal) return;
    
    // Reflect velocity
    const dot = ball.vx * normal.nx + ball.vy * normal.ny;
    ball.vx = (ball.vx - 2 * dot * normal.nx) * this.BOUNCE_DAMPING;
    ball.vy = (ball.vy - 2 * dot * normal.ny) * this.BOUNCE_DAMPING;
    
    // Push ball out of wall
    ball.x = prevX + ball.vx * 0.02;
    ball.y = prevY + ball.vy * 0.02;
  }

  private handleBumperBounce(ball: Ball, bumper: Obstacle): void {
    const cx = bumper.x + bumper.width / 2;
    const cy = bumper.y + bumper.height / 2;
    
    // Calculate normal from bumper center to ball
    const dx = ball.x - cx;
    const dy = ball.y - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    const nx = dx / dist;
    const ny = dy / dist;
    
    // Get current speed and boost it
    const speed = ball.getSpeed() * this.BUMPER_BOOST;
    
    // Set velocity in reflected direction with boost
    ball.vx = nx * speed;
    ball.vy = ny * speed;
    
    // Push ball outside bumper
    const radius = bumper.width / 2;
    ball.x = cx + nx * (radius + ball.radius + 2);
    ball.y = cy + ny * (radius + ball.radius + 2);
  }

  private handleRamp(ball: Ball, ramp: Obstacle): void {
    // Ramps accelerate the ball in their rotation direction
    const cos = Math.cos(ramp.rotation);
    const sin = Math.sin(ramp.rotation);
    
    const boost = 50;
    ball.vx += cos * boost;
    ball.vy += sin * boost;
  }

  private handleWindmillCollision(ball: Ball, windmill: Obstacle, prevX: number, prevY: number): void {
    // Simple bounce off windmill
    const cx = windmill.x + windmill.width / 2;
    const cy = windmill.y + windmill.height / 2;
    
    const dx = ball.x - cx;
    const dy = ball.y - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    if (dist > 0) {
      const nx = dx / dist;
      const ny = dy / dist;
      
      // Reflect velocity
      const dot = ball.vx * nx + ball.vy * ny;
      ball.vx = (ball.vx - 2 * dot * nx) * this.BOUNCE_DAMPING;
      ball.vy = (ball.vy - 2 * dot * ny) * this.BOUNCE_DAMPING;
      
      // Push out
      ball.x = prevX;
      ball.y = prevY;
    }
  }

  private checkBoundsCollision(ball: Ball, prevX: number, prevY: number): { hit: boolean } {
    if (!this.bounds) return { hit: false };
    
    const points = this.bounds.points;
    const n = points.length;
    
    // Check each edge of the polygon
    for (let i = 0; i < n; i++) {
      const p1 = points[i];
      const p2 = points[(i + 1) % n];
      
      // Calculate edge vector
      const edgeX = p2.x - p1.x;
      const edgeY = p2.y - p1.y;
      const edgeLen = Math.sqrt(edgeX * edgeX + edgeY * edgeY);
      
      if (edgeLen === 0) continue;
      
      // Normal pointing INWARD (for clockwise polygon in screen coords, use left-hand normal)
      // Left-hand normal = (-edgeY, edgeX) normalized
      const nx = -edgeY / edgeLen;
      const ny = edgeX / edgeLen;
      
      // Distance from ball center to the edge line (positive = inside, negative = outside)
      const dist = (ball.x - p1.x) * nx + (ball.y - p1.y) * ny;
      
      // If ball is too close to or past the edge (outside or touching)
      if (dist < ball.radius) {
        // Check if ball is within the edge segment bounds (not past the corners)
        const t = ((ball.x - p1.x) * edgeX + (ball.y - p1.y) * edgeY) / (edgeLen * edgeLen);
        
        if (t >= -0.1 && t <= 1.1) { // Slightly expanded range for corner cases
          // Reflect velocity off this edge
          const dot = ball.vx * nx + ball.vy * ny;
          
          // Only reflect if moving toward the wall
          if (dot < 0) {
            ball.vx = (ball.vx - 2 * dot * nx) * this.BOUNCE_DAMPING;
            ball.vy = (ball.vy - 2 * dot * ny) * this.BOUNCE_DAMPING;
          }
          
          // Push ball inside (away from edge)
          const pushDist = ball.radius - dist + 2;
          ball.x += nx * pushDist;
          ball.y += ny * pushDist;
          
          return { hit: true };
        }
      }
    }
    
    return { hit: false };
  }

  private checkRectBounds(ball: Ball): void {
    const padding = 60; // UI area at top
    
    // Left wall
    if (ball.x - ball.radius < 0) {
      ball.x = ball.radius;
      ball.vx = Math.abs(ball.vx) * this.BOUNCE_DAMPING;
    }
    
    // Right wall
    if (ball.x + ball.radius > this.canvasWidth) {
      ball.x = this.canvasWidth - ball.radius;
      ball.vx = -Math.abs(ball.vx) * this.BOUNCE_DAMPING;
    }
    
    // Top wall
    if (ball.y - ball.radius < padding) {
      ball.y = padding + ball.radius;
      ball.vy = Math.abs(ball.vy) * this.BOUNCE_DAMPING;
    }
    
    // Bottom wall
    if (ball.y + ball.radius > this.canvasHeight) {
      ball.y = this.canvasHeight - ball.radius;
      ball.vy = -Math.abs(ball.vy) * this.BOUNCE_DAMPING;
    }
  }
}