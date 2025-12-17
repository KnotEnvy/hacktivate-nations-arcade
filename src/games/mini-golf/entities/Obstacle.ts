// ===== src/games/minigolf/entities/Obstacle.ts =====

import { Ball } from './Ball';

export type ObstacleType = 'wall' | 'water' | 'sand' | 'bumper' | 'windmill' | 'ramp';

export interface ObstacleConfig {
  type: ObstacleType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number; // degrees
  speed?: number; // for moving obstacles
}

export class Obstacle {
  type: ObstacleType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number; // radians
  speed: number;
  
  // For animated obstacles
  private animPhase: number = 0;
  
  // For water ripple effect
  private ripplePhase: number = 0;

  constructor(config: ObstacleConfig) {
    this.type = config.type;
    this.x = config.x;
    this.y = config.y;
    this.width = config.width;
    this.height = config.height;
    this.rotation = (config.rotation || 0) * Math.PI / 180;
    this.speed = config.speed || 0;
  }

  update(dt: number): void {
    this.animPhase += dt * this.speed;
    this.ripplePhase += dt * 2;
  }

  // Get corners for collision detection (axis-aligned bounding box for simplicity)
  getBounds(): { left: number; right: number; top: number; bottom: number } {
    // For rotated rectangles, we use the rotated bounds
    if (this.rotation === 0) {
      return {
        left: this.x,
        right: this.x + this.width,
        top: this.y,
        bottom: this.y + this.height,
      };
    }
    
    // Calculate rotated corners
    const cx = this.x + this.width / 2;
    const cy = this.y + this.height / 2;
    const corners = this.getRotatedCorners();
    
    return {
      left: Math.min(...corners.map(c => c.x)),
      right: Math.max(...corners.map(c => c.x)),
      top: Math.min(...corners.map(c => c.y)),
      bottom: Math.max(...corners.map(c => c.y)),
    };
  }

  getRotatedCorners(): { x: number; y: number }[] {
    const cx = this.x + this.width / 2;
    const cy = this.y + this.height / 2;
    const hw = this.width / 2;
    const hh = this.height / 2;
    
    const cos = Math.cos(this.rotation);
    const sin = Math.sin(this.rotation);
    
    return [
      { x: cx + (-hw * cos - -hh * sin), y: cy + (-hw * sin + -hh * cos) },
      { x: cx + (hw * cos - -hh * sin), y: cy + (hw * sin + -hh * cos) },
      { x: cx + (hw * cos - hh * sin), y: cy + (hw * sin + hh * cos) },
      { x: cx + (-hw * cos - hh * sin), y: cy + (-hw * sin + hh * cos) },
    ];
  }

  // Check if point is inside obstacle (for collision)
  containsPoint(px: number, py: number): boolean {
    if (this.type === 'bumper') {
      // Bumper is circular
      const cx = this.x + this.width / 2;
      const cy = this.y + this.height / 2;
      const r = this.width / 2;
      const dx = px - cx;
      const dy = py - cy;
      return dx * dx + dy * dy < r * r;
    }
    
    // Transform point to obstacle's local space
    const cx = this.x + this.width / 2;
    const cy = this.y + this.height / 2;
    
    const cos = Math.cos(-this.rotation);
    const sin = Math.sin(-this.rotation);
    
    const localX = cos * (px - cx) - sin * (py - cy);
    const localY = sin * (px - cx) + cos * (py - cy);
    
    return Math.abs(localX) < this.width / 2 && Math.abs(localY) < this.height / 2;
  }

  // Get collision normal for ball bounce
  getCollisionNormal(ball: Ball): { nx: number; ny: number } | null {
    if (!this.containsPoint(ball.x, ball.y)) {
      return null;
    }
    
    if (this.type === 'bumper') {
      const cx = this.x + this.width / 2;
      const cy = this.y + this.height / 2;
      const dx = ball.x - cx;
      const dy = ball.y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      return { nx: dx / dist, ny: dy / dist };
    }
    
    // For rectangles, find nearest edge
    const cx = this.x + this.width / 2;
    const cy = this.y + this.height / 2;
    
    // Transform to local space
    const cos = Math.cos(-this.rotation);
    const sin = Math.sin(-this.rotation);
    
    const localX = cos * (ball.x - cx) - sin * (ball.y - cy);
    const localY = sin * (ball.x - cx) + cos * (ball.y - cy);
    
    const hw = this.width / 2;
    const hh = this.height / 2;
    
    // Find nearest edge
    const dx = Math.abs(localX) - hw;
    const dy = Math.abs(localY) - hh;
    
    let localNx = 0, localNy = 0;
    
    if (dx > dy) {
      localNx = localX > 0 ? 1 : -1;
    } else {
      localNy = localY > 0 ? 1 : -1;
    }
    
    // Transform normal back to world space
    const worldCos = Math.cos(this.rotation);
    const worldSin = Math.sin(this.rotation);
    
    return {
      nx: worldCos * localNx - worldSin * localNy,
      ny: worldSin * localNx + worldCos * localNy,
    };
  }

  render(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    
    // Translate to center, rotate, translate back
    const cx = this.x + this.width / 2;
    const cy = this.y + this.height / 2;
    
    ctx.translate(cx, cy);
    ctx.rotate(this.rotation);
    
    switch (this.type) {
      case 'wall':
        this.renderWall(ctx);
        break;
      case 'water':
        this.renderWater(ctx);
        break;
      case 'sand':
        this.renderSand(ctx);
        break;
      case 'bumper':
        this.renderBumper(ctx);
        break;
      case 'windmill':
        this.renderWindmill(ctx);
        break;
      case 'ramp':
        this.renderRamp(ctx);
        break;
    }
    
    ctx.restore();
  }

  private renderWall(ctx: CanvasRenderingContext2D): void {
    const hw = this.width / 2;
    const hh = this.height / 2;
    
    // Wall shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(-hw + 3, -hh + 3, this.width, this.height);
    
    // Main wall body (brick pattern)
    const gradient = ctx.createLinearGradient(-hw, -hh, hw, hh);
    gradient.addColorStop(0, '#8B4513');
    gradient.addColorStop(0.5, '#A0522D');
    gradient.addColorStop(1, '#8B4513');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(-hw, -hh, this.width, this.height);
    
    // Brick pattern
    ctx.strokeStyle = '#6B3210';
    ctx.lineWidth = 1;
    
    const brickH = 8;
    const brickW = 15;
    let row = 0;
    
    for (let y = -hh; y < hh; y += brickH) {
      const offset = (row % 2) * brickW / 2;
      for (let x = -hw + offset; x < hw; x += brickW) {
        ctx.strokeRect(
          Math.max(-hw, x),
          y,
          Math.min(brickW, hw - x + hw),
          brickH
        );
      }
      row++;
    }
    
    // Top highlight
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.fillRect(-hw, -hh, this.width, 3);
    
    // Border
    ctx.strokeStyle = '#5D3A1A';
    ctx.lineWidth = 2;
    ctx.strokeRect(-hw, -hh, this.width, this.height);
  }

  private renderWater(ctx: CanvasRenderingContext2D): void {
    const hw = this.width / 2;
    const hh = this.height / 2;
    
    // Water base
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.max(hw, hh));
    gradient.addColorStop(0, '#2E86AB');
    gradient.addColorStop(1, '#1B4965');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(-hw, -hh, this.width, this.height);
    
    // Animated ripples
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1;
    
    for (let i = 0; i < 3; i++) {
      const rippleSize = (this.ripplePhase + i * 2) % 6;
      const alpha = 1 - rippleSize / 6;
      ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.3})`;
      ctx.beginPath();
      ctx.arc(0, 0, 10 + rippleSize * 10, 0, Math.PI * 2);
      ctx.stroke();
    }
    
    // Wave pattern
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 2;
    for (let x = -hw; x < hw; x += 20) {
      ctx.beginPath();
      for (let y = -hh; y < hh; y += 5) {
        const waveX = x + Math.sin(y * 0.1 + this.ripplePhase) * 5;
        if (y === -hh) {
          ctx.moveTo(waveX, y);
        } else {
          ctx.lineTo(waveX, y);
        }
      }
      ctx.stroke();
    }
    
    // Border
    ctx.strokeStyle = '#1a3a4a';
    ctx.lineWidth = 3;
    ctx.strokeRect(-hw, -hh, this.width, this.height);
  }

  private renderSand(ctx: CanvasRenderingContext2D): void {
    const hw = this.width / 2;
    const hh = this.height / 2;
    
    // Sand base
    ctx.fillStyle = '#F4D03F';
    ctx.fillRect(-hw, -hh, this.width, this.height);
    
    // Sand texture (random dots)
    ctx.fillStyle = '#E6B800';
    const seed = this.x * 1000 + this.y;
    for (let i = 0; i < 50; i++) {
      const px = (Math.sin(seed + i * 47) * 0.5 + 0.5) * this.width - hw;
      const py = (Math.cos(seed + i * 31) * 0.5 + 0.5) * this.height - hh;
      ctx.beginPath();
      ctx.arc(px, py, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // Darker grains
    ctx.fillStyle = '#C4A000';
    for (let i = 0; i < 30; i++) {
      const px = (Math.sin(seed + i * 73) * 0.5 + 0.5) * this.width - hw;
      const py = (Math.cos(seed + i * 59) * 0.5 + 0.5) * this.height - hh;
      ctx.beginPath();
      ctx.arc(px, py, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // Border (bunker edge)
    ctx.strokeStyle = '#8B7355';
    ctx.lineWidth = 4;
    ctx.strokeRect(-hw, -hh, this.width, this.height);
    
    ctx.strokeStyle = '#A08060';
    ctx.lineWidth = 2;
    ctx.strokeRect(-hw + 2, -hh + 2, this.width - 4, this.height - 4);
  }

  private renderBumper(ctx: CanvasRenderingContext2D): void {
    const r = this.width / 2;
    
    // Outer glow
    ctx.beginPath();
    ctx.arc(0, 0, r + 5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 100, 100, 0.3)';
    ctx.fill();
    
    // Main bumper
    const gradient = ctx.createRadialGradient(-r * 0.3, -r * 0.3, 0, 0, 0, r);
    gradient.addColorStop(0, '#FF8888');
    gradient.addColorStop(0.5, '#FF4444');
    gradient.addColorStop(1, '#CC0000');
    
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();
    
    // Chrome ring
    ctx.strokeStyle = '#CCCCCC';
    ctx.lineWidth = 3;
    ctx.stroke();
    
    // Highlight
    ctx.beginPath();
    ctx.arc(-r * 0.3, -r * 0.3, r * 0.25, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.fill();
    
    // Inner circle
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.4, 0, Math.PI * 2);
    ctx.fillStyle = '#880000';
    ctx.fill();
    ctx.strokeStyle = '#666666';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  private renderWindmill(ctx: CanvasRenderingContext2D): void {
    const hw = this.width / 2;
    const hh = this.height / 2;
    
    // Base
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(-hw, -hh, this.width, this.height);
    
    // Opening
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(-hw + 5, -10, this.width - 10, 20);
    
    // Rotating blade (uses animPhase)
    ctx.save();
    ctx.rotate(this.animPhase);
    
    ctx.fillStyle = '#DDD';
    ctx.strokeStyle = '#888';
    ctx.lineWidth = 2;
    
    for (let i = 0; i < 4; i++) {
      ctx.save();
      ctx.rotate(i * Math.PI / 2);
      
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-8, -35);
      ctx.lineTo(8, -35);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      
      ctx.restore();
    }
    
    // Center hub
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI * 2);
    ctx.fillStyle = '#666';
    ctx.fill();
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    ctx.restore();
  }

  private renderRamp(ctx: CanvasRenderingContext2D): void {
    const hw = this.width / 2;
    const hh = this.height / 2;
    
    // Ramp gradient (shows direction)
    const gradient = ctx.createLinearGradient(-hw, 0, hw, 0);
    gradient.addColorStop(0, '#4a6741');
    gradient.addColorStop(1, '#2d4228');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(-hw, -hh, this.width, this.height);
    
    // Arrow indicating direction
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.beginPath();
    ctx.moveTo(hw - 10, 0);
    ctx.lineTo(hw - 25, -8);
    ctx.lineTo(hw - 25, 8);
    ctx.closePath();
    ctx.fill();
    
    // Stripes
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 2;
    for (let x = -hw + 10; x < hw - 10; x += 15) {
      ctx.beginPath();
      ctx.moveTo(x, -hh);
      ctx.lineTo(x + 10, hh);
      ctx.stroke();
    }
    
    // Border
    ctx.strokeStyle = '#1a2a18';
    ctx.lineWidth = 2;
    ctx.strokeRect(-hw, -hh, this.width, this.height);
  }
}
