// ===== src/games/minigolf/systems/WindSystem.ts =====

export class WindSystem {
  private windX: number = 0;
  private windY: number = 0;
  private targetWindX: number = 0;
  private targetWindY: number = 0;
  private maxWind: number = 30;
  
  // Visual animation
  private animPhase: number = 0;
  private gustTimer: number = 0;
  private gustIntensity: number = 0;

  randomize(): void {
    const angle = Math.random() * Math.PI * 2;
    const strength = Math.random() * this.maxWind;
    
    this.targetWindX = Math.cos(angle) * strength;
    this.targetWindY = Math.sin(angle) * strength;
  }

  setCalm(): void {
    this.targetWindX = 0;
    this.targetWindY = 0;
    this.windX = 0;
    this.windY = 0;
  }

  setWind(x: number, y: number): void {
    this.targetWindX = x;
    this.targetWindY = y;
  }

  update(dt: number): void {
    // Smoothly interpolate to target wind
    const lerpSpeed = 0.5;
    this.windX += (this.targetWindX - this.windX) * lerpSpeed * dt;
    this.windY += (this.targetWindY - this.windY) * lerpSpeed * dt;
    
    // Animation
    this.animPhase += dt * 3;
    
    // Random gusts
    this.gustTimer -= dt;
    if (this.gustTimer <= 0) {
      this.gustTimer = 2 + Math.random() * 3;
      this.gustIntensity = 0.3 + Math.random() * 0.7;
    }
    
    // Decay gust
    this.gustIntensity *= 0.95;
  }

  getForce(): { x: number; y: number } {
    const gustMultiplier = 1 + this.gustIntensity * 0.5;
    return {
      x: this.windX * gustMultiplier,
      y: this.windY * gustMultiplier,
    };
  }

  getStrength(): number {
    return Math.sqrt(this.windX * this.windX + this.windY * this.windY);
  }

  getAngle(): number {
    return Math.atan2(this.windY, this.windX);
  }

  render(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    const strength = this.getStrength();
    
    // Don't render if no wind
    if (strength < 0.5) {
      ctx.save();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(x - 35, y - 15, 70, 30);
      
      ctx.fillStyle = '#888888';
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('No Wind', x, y + 4);
      ctx.restore();
      return;
    }
    
    ctx.save();
    
    // Background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.beginPath();
    ctx.arc(x, y, 35, 0, Math.PI * 2);
    ctx.fill();
    
    // Wind direction indicator
    ctx.translate(x, y);
    ctx.rotate(this.getAngle());
    
    // Arrow body
    const arrowLen = 15 + (strength / this.maxWind) * 10;
    
    // Animated wind lines
    ctx.strokeStyle = 'rgba(135, 206, 235, 0.6)';
    ctx.lineWidth = 1;
    
    for (let i = 0; i < 3; i++) {
      const offset = (this.animPhase + i * 0.7) % 2;
      const lineX = -10 + offset * 15;
      const lineLen = 8 + Math.sin(this.animPhase + i) * 3;
      
      ctx.beginPath();
      ctx.moveTo(lineX, -5 + i * 5);
      ctx.lineTo(lineX + lineLen, -5 + i * 5);
      ctx.stroke();
    }
    
    // Main arrow
    ctx.fillStyle = '#87CEEB';
    ctx.strokeStyle = '#5BA3C4';
    ctx.lineWidth = 2;
    
    // Arrow shaft
    ctx.beginPath();
    ctx.moveTo(-8, -3);
    ctx.lineTo(arrowLen - 8, -3);
    ctx.lineTo(arrowLen - 8, -7);
    ctx.lineTo(arrowLen + 5, 0);
    ctx.lineTo(arrowLen - 8, 7);
    ctx.lineTo(arrowLen - 8, 3);
    ctx.lineTo(-8, 3);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    
    ctx.restore();
    
    // Wind strength text
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.font = '10px Arial';
    ctx.textAlign = 'center';
    
    const strengthPercent = Math.round((strength / this.maxWind) * 100);
    const label = strengthPercent < 33 ? 'Light' : strengthPercent < 66 ? 'Moderate' : 'Strong';
    
    ctx.fillText(label, x, y + 28);
    ctx.restore();
  }
}
