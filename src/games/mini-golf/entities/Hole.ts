// ===== src/games/minigolf/entities/Hole.ts =====

import { Ball } from './Ball';

export class Hole {
  x: number;
  y: number;
  radius: number = 14;
  
  // Visual pulsing for attraction
  private pulsePhase: number = 0;
  
  // Flag animation
  private flagWave: number = 0;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  update(dt: number): void {
    this.pulsePhase += dt * 3;
    this.flagWave += dt * 5;
  }

  checkBall(ball: Ball): { sinking: boolean; nearMiss: boolean } {
    const dx = ball.x - this.x;
    const dy = ball.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    // Ball speed
    const speed = ball.getSpeed();
    
    // If ball is close and slow enough, it sinks
    if (dist < this.radius - ball.radius * 0.5) {
      // Speed threshold - ball must be slow enough to sink
      if (speed < 150) {
        return { sinking: true, nearMiss: false };
      } else {
        // Ball was too fast - it jumps over
        return { sinking: false, nearMiss: true };
      }
    }
    
    // Apply attraction when ball is near and slow
    if (dist < this.radius * 2 && speed < 50) {
      const attraction = 0.3 * (1 - dist / (this.radius * 2));
      const nx = dx / dist;
      const ny = dy / dist;
      ball.vx -= nx * attraction * 60;
      ball.vy -= ny * attraction * 60;
    }
    
    return { sinking: false, nearMiss: false };
  }

  render(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    
    // Pulsing effect
    const pulse = 1 + Math.sin(this.pulsePhase) * 0.05;
    
    // Hole shadow (dark)
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius * pulse + 3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fill();
    
    // Hole edge (dark brown)
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius * pulse + 2, 0, Math.PI * 2);
    ctx.fillStyle = '#3d2914';
    ctx.fill();
    
    // Hole interior (black)
    const gradient = ctx.createRadialGradient(
      this.x, this.y, 0,
      this.x, this.y, this.radius * pulse
    );
    gradient.addColorStop(0, '#000000');
    gradient.addColorStop(0.7, '#1a1a1a');
    gradient.addColorStop(1, '#2a2a2a');
    
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius * pulse, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();
    
    // Inner highlight ring
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius * pulse, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Flag pole
    const poleX = this.x + 3;
    const poleBottom = this.y - 5;
    const poleTop = this.y - 60;
    
    ctx.beginPath();
    ctx.moveTo(poleX, poleBottom);
    ctx.lineTo(poleX, poleTop);
    ctx.strokeStyle = '#555555';
    ctx.lineWidth = 3;
    ctx.stroke();
    
    ctx.strokeStyle = '#888888';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Flag (waving)
    const waveAmount = Math.sin(this.flagWave) * 5;
    const flagWidth = 25;
    const flagHeight = 18;
    
    ctx.beginPath();
    ctx.moveTo(poleX, poleTop);
    ctx.quadraticCurveTo(
      poleX + flagWidth * 0.5 + waveAmount,
      poleTop + flagHeight * 0.3,
      poleX + flagWidth + waveAmount * 0.5,
      poleTop + flagHeight * 0.5
    );
    ctx.quadraticCurveTo(
      poleX + flagWidth * 0.5 + waveAmount * 0.7,
      poleTop + flagHeight * 0.7,
      poleX,
      poleTop + flagHeight
    );
    ctx.closePath();
    
    // Flag gradient
    const flagGradient = ctx.createLinearGradient(
      poleX, poleTop, poleX + flagWidth, poleTop + flagHeight
    );
    flagGradient.addColorStop(0, '#FF4444');
    flagGradient.addColorStop(1, '#CC0000');
    
    ctx.fillStyle = flagGradient;
    ctx.fill();
    
    ctx.strokeStyle = '#990000';
    ctx.lineWidth = 1;
    ctx.stroke();
    
    // Flag number
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 10px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // ctx.fillText('⛳', poleX + flagWidth * 0.4 + waveAmount * 0.3, poleTop + flagHeight * 0.5);
    
    ctx.restore();
  }
}
