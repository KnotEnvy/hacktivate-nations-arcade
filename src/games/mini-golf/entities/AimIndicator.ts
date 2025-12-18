// ===== src/games/minigolf/entities/AimIndicator.ts =====

export class AimIndicator {
  private x: number = 0;
  private y: number = 0;
  private angle: number = 0;
  private power: number = 0; // 0 to 1
  
  // Animation
  private pulsePhase: number = 0;
  
  update(x: number, y: number, angle: number, power: number): void {
    this.x = x;
    this.y = y;
    this.angle = angle;
    this.power = Math.min(1, Math.max(0, power));
    this.pulsePhase += 0.1;
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (this.power < 0.05) return;
    
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    
    // Calculate length based on power
    const maxLength = 150;
    const length = this.power * maxLength;
    
    // Direction arrow (now in front, showing where ball will go)
    const arrowLength = 40;
    const pulse = 1 + Math.sin(this.pulsePhase) * 0.1;
    
    // Arrow shaft
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-5, 0);
    ctx.lineTo(-arrowLength * pulse, 0);
    ctx.stroke();
    
    // Arrow head
    const headSize = 12;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(-arrowLength * pulse - headSize, 0);
    ctx.lineTo(-arrowLength * pulse + 5, -headSize / 2);
    ctx.lineTo(-arrowLength * pulse + 5, headSize / 2);
    ctx.closePath();
    ctx.fill();
    
    // Dotted trajectory line extending further
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(-arrowLength * pulse - headSize, 0);
    ctx.lineTo(-arrowLength * pulse - 50 - length * 0.5, 0);
    ctx.stroke();
    ctx.setLineDash([]);
    
    // Power meter (behind the ball)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(15, -8, maxLength + 10, 16);
    
    // Power meter fill
    const powerGradient = ctx.createLinearGradient(15, 0, 15 + length, 0);
    if (this.power < 0.3) {
      powerGradient.addColorStop(0, '#4CAF50');
      powerGradient.addColorStop(1, '#8BC34A');
    } else if (this.power < 0.7) {
      powerGradient.addColorStop(0, '#FFC107');
      powerGradient.addColorStop(1, '#FF9800');
    } else {
      powerGradient.addColorStop(0, '#FF5722');
      powerGradient.addColorStop(1, '#F44336');
    }
    
    ctx.fillStyle = powerGradient;
    ctx.fillRect(18, -5, length, 10);
    
    // Power meter border
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.strokeRect(15, -8, maxLength + 10, 16);
    
    // Tick marks
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      const tickX = 15 + (maxLength + 10) * (i / 4);
      ctx.beginPath();
      ctx.moveTo(tickX, -8);
      ctx.lineTo(tickX, -4);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(tickX, 4);
      ctx.lineTo(tickX, 8);
      ctx.stroke();
    }
    
    ctx.restore();
    
    // Power percentage text (positioned toward the drag point)
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(
      `${Math.round(this.power * 100)}%`,
      this.x + Math.cos(this.angle + Math.PI) * (maxLength * 0.5 + 40),
      this.y + Math.sin(this.angle + Math.PI) * (maxLength * 0.5 + 40) + 5
    );
    ctx.restore();
  }
}