// ===== src/games/minigolf/entities/Ball.ts =====

export class Ball {
  x: number;
  y: number;
  vx: number = 0;
  vy: number = 0;
  radius: number = 8;
  
  // For sinking animation
  sinkProgress: number = 0;
  
  // Previous position for trail effect
  private trail: { x: number; y: number }[] = [];
  private readonly maxTrailLength = 10;
  
  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  update(dt: number): void {
    // Add current position to trail
    this.trail.push({ x: this.x, y: this.y });
    if (this.trail.length > this.maxTrailLength) {
      this.trail.shift();
    }
  }

  getSpeed(): number {
    return Math.sqrt(this.vx * this.vx + this.vy * this.vy);
  }

  isStopped(): boolean {
    // Use a slightly higher threshold to ensure ball truly stops
    // and doesn't hover at the edge of moving/stopped
    return this.getSpeed() < 5;
  }

  // Force the ball to stop completely
  stop(): void {
    this.vx = 0;
    this.vy = 0;
  }

  render(ctx: CanvasRenderingContext2D): void {
    // Render trail when moving fast
    const speed = this.getSpeed();
    if (speed > 20 && this.trail.length > 2) {
      ctx.save();
      for (let i = 0; i < this.trail.length - 1; i++) {
        const alpha = (i / this.trail.length) * 0.3;
        const size = this.radius * (i / this.trail.length) * 0.7;
        
        ctx.beginPath();
        ctx.arc(this.trail[i].x, this.trail[i].y, size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.fill();
      }
      ctx.restore();
    }
    
    // Calculate scale for sinking animation
    const scale = 1 - this.sinkProgress * 0.8;
    const displayRadius = this.radius * scale;
    
    // Ball shadow
    ctx.save();
    ctx.beginPath();
    ctx.arc(this.x + 2, this.y + 2, displayRadius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fill();
    ctx.restore();
    
    // Main ball (white golf ball)
    ctx.save();
    ctx.beginPath();
    ctx.arc(this.x, this.y, displayRadius, 0, Math.PI * 2);
    
    // Gradient for 3D effect
    const gradient = ctx.createRadialGradient(
      this.x - displayRadius * 0.3,
      this.y - displayRadius * 0.3,
      0,
      this.x,
      this.y,
      displayRadius
    );
    gradient.addColorStop(0, '#ffffff');
    gradient.addColorStop(0.7, '#f0f0f0');
    gradient.addColorStop(1, '#d0d0d0');
    
    ctx.fillStyle = gradient;
    ctx.fill();
    
    // Outline
    ctx.strokeStyle = '#999999';
    ctx.lineWidth = 1;
    ctx.stroke();
    
    // Dimples effect (simplified)
    if (displayRadius > 5) {
      ctx.fillStyle = 'rgba(150, 150, 150, 0.2)';
      const dimplePositions = [
        { x: -0.3, y: -0.2 },
        { x: 0.2, y: -0.3 },
        { x: 0.3, y: 0.2 },
        { x: -0.2, y: 0.3 },
        { x: 0, y: 0 },
      ];
      
      for (const pos of dimplePositions) {
        ctx.beginPath();
        ctx.arc(
          this.x + pos.x * displayRadius,
          this.y + pos.y * displayRadius,
          displayRadius * 0.15,
          0,
          Math.PI * 2
        );
        ctx.fill();
      }
    }
    
    // Shine highlight
    ctx.beginPath();
    ctx.arc(
      this.x - displayRadius * 0.3,
      this.y - displayRadius * 0.3,
      displayRadius * 0.2,
      0,
      Math.PI * 2
    );
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.fill();
    
    ctx.restore();
  }

  reset(x: number, y: number): void {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.sinkProgress = 0;
    this.trail = [];
  }
}