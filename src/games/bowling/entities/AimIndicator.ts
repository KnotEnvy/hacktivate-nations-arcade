// ===== src/games/bowling/entities/AimIndicator.ts =====
// Arcade-style bowling input indicator with oscillating arrow and power meter

export type InputPhase = 'positioning' | 'aiming' | 'power' | 'spin' | 'ready';

export type SpinType = 'left' | 'straight' | 'right';

export interface ThrowParameters {
  position: number;     // Ball X position
  angle: number;        // Launch angle in radians (relative to straight up)
  power: number;        // 0-1 normalized power
  spin: SpinType;       // Hook direction
}

export class AimIndicator {
  // Current input phase
  phase: InputPhase = 'positioning';

  // Ball position state
  private ballX: number = 0;
  private ballY: number = 0;
  private laneLeft: number = 0;
  private laneRight: number = 0;
  private laneCenter: number = 0;

  // Position selection (0-4 representing 5 positions)
  private positionIndex: number = 2; // Start at center
  private readonly POSITION_COUNT = 5;

  // Aim state
  private aimAngle: number = 0;           // Current oscillating angle
  private aimDirection: number = 1;        // 1 = moving right, -1 = moving left
  private lockedAngle: number = 0;         // Locked angle after first click
  private readonly AIM_SPEED = 2.0;        // Radians per second
  private readonly MAX_AIM_ANGLE = Math.PI / 4; // 45 degrees max each way

  // Power state
  private powerValue: number = 0;          // Current oscillating power
  private powerDirection: number = 1;       // 1 = increasing, -1 = decreasing
  private lockedPower: number = 0;         // Locked power after second click
  private readonly POWER_SPEED = 1.5;      // Full cycle speed multiplier

  // Spin state
  private spinValue: number = 0;           // -1 (left) to 1 (right)
  private spinDirection: number = 1;
  private lockedSpin: SpinType = 'straight';
  private spinTimer: number = 0;
  private readonly SPIN_DURATION = 1.5;    // Seconds before auto-select
  private readonly SPIN_SPEED = 3.0;

  // Visual properties
  private pulsePhase: number = 0;
  private flashTimer: number = 0;

  // Lane reference
  private laneWidth: number = 180;
  private positionSpacing: number = 0;

  constructor() {
    this.reset();
  }

  // Initialize with lane dimensions
  initialize(laneX: number, laneWidth: number, laneHeight: number): void {
    this.laneLeft = laneX + 35; // Inside gutters
    this.laneRight = laneX + laneWidth - 35;
    this.laneCenter = laneX + laneWidth / 2;
    this.laneWidth = laneWidth;

    // Calculate position spacing
    const usableWidth = this.laneRight - this.laneLeft;
    this.positionSpacing = usableWidth / (this.POSITION_COUNT - 1);

    // Set initial ball position
    this.positionIndex = 2; // Center
    this.updateBallPosition();
  }

  // Set ball Y position (called from game)
  setBallY(y: number): void {
    this.ballY = y;
  }

  private updateBallPosition(): void {
    this.ballX = this.laneLeft + this.positionIndex * this.positionSpacing;
  }

  // Move ball left
  moveLeft(): boolean {
    if (this.phase !== 'positioning') return false;
    if (this.positionIndex > 0) {
      this.positionIndex--;
      this.updateBallPosition();
      return true;
    }
    return false;
  }

  // Move ball right
  moveRight(): boolean {
    if (this.phase !== 'positioning') return false;
    if (this.positionIndex < this.POSITION_COUNT - 1) {
      this.positionIndex++;
      this.updateBallPosition();
      return true;
    }
    return false;
  }

  // Handle click/tap input - advances through phases
  handleClick(): boolean {
    switch (this.phase) {
      case 'positioning':
        // Start aiming phase
        this.phase = 'aiming';
        this.aimAngle = 0;
        this.aimDirection = 1;
        return true;

      case 'aiming':
        // Lock the angle, move to power phase
        this.lockedAngle = this.aimAngle;
        this.phase = 'power';
        this.powerValue = 0;
        this.powerDirection = 1;
        this.flashTimer = 0.2;
        return true;

      case 'power':
        // Lock the power, move to spin phase
        this.lockedPower = this.powerValue;
        this.phase = 'spin';
        this.spinValue = 0;
        this.spinDirection = 1;
        this.spinTimer = 0;
        this.flashTimer = 0.2;
        return true;

      case 'spin':
        // Lock spin and signal ready to throw
        this.lockSpin();
        this.phase = 'ready';
        this.flashTimer = 0.2;
        return true;

      default:
        return false;
    }
  }

  private lockSpin(): void {
    // Convert continuous spin value to discrete spin type
    if (this.spinValue < -0.33) {
      this.lockedSpin = 'left';
    } else if (this.spinValue > 0.33) {
      this.lockedSpin = 'right';
    } else {
      this.lockedSpin = 'straight';
    }
  }

  // Update oscillating values
  update(dt: number): void {
    this.pulsePhase += dt * 5;

    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
    }

    switch (this.phase) {
      case 'aiming':
        // Oscillate aim angle
        this.aimAngle += this.aimDirection * this.AIM_SPEED * dt;
        if (this.aimAngle >= this.MAX_AIM_ANGLE) {
          this.aimAngle = this.MAX_AIM_ANGLE;
          this.aimDirection = -1;
        } else if (this.aimAngle <= -this.MAX_AIM_ANGLE) {
          this.aimAngle = -this.MAX_AIM_ANGLE;
          this.aimDirection = 1;
        }
        break;

      case 'power':
        // Oscillate power
        this.powerValue += this.powerDirection * this.POWER_SPEED * dt;
        if (this.powerValue >= 1) {
          this.powerValue = 1;
          this.powerDirection = -1;
        } else if (this.powerValue <= 0) {
          this.powerValue = 0;
          this.powerDirection = 1;
        }
        break;

      case 'spin':
        // Oscillate spin
        this.spinValue += this.spinDirection * this.SPIN_SPEED * dt;
        if (this.spinValue >= 1) {
          this.spinValue = 1;
          this.spinDirection = -1;
        } else if (this.spinValue <= -1) {
          this.spinValue = -1;
          this.spinDirection = 1;
        }

        // Auto-select after timeout
        this.spinTimer += dt;
        if (this.spinTimer >= this.SPIN_DURATION) {
          this.lockSpin();
          this.phase = 'ready';
        }
        break;
    }
  }

  // Get current ball X position
  getBallX(): number {
    return this.ballX;
  }

  // Check if ready to throw
  isReadyToThrow(): boolean {
    return this.phase === 'ready';
  }

  // Get throw parameters when ready
  getThrowParameters(): ThrowParameters {
    return {
      position: this.ballX,
      angle: this.lockedAngle,
      power: this.lockedPower,
      spin: this.lockedSpin
    };
  }

  // Get velocity for ball launch
  getVelocity(maxSpeed: number): { vx: number; vy: number; spin: number } {
    const params = this.getThrowParameters();
    // Ensure minimum power for satisfying throws
    const effectivePower = 0.4 + params.power * 0.6; // 40% to 100%
    const speed = effectivePower * maxSpeed;

    // Angle is relative to straight up (-PI/2)
    const launchAngle = -Math.PI / 2 + params.angle;

    // Convert spin type to spin value - stronger spin for noticeable hook
    let spinValue = 0;
    switch (params.spin) {
      case 'left': spinValue = -1.2; break;  // Stronger hook
      case 'right': spinValue = 1.2; break;
      case 'straight': spinValue = 0; break;
    }

    return {
      vx: Math.cos(launchAngle) * speed,
      vy: Math.sin(launchAngle) * speed,
      spin: spinValue
    };
  }

  // Main render method
  render(ctx: CanvasRenderingContext2D, laneWidthParam: number): void {
    ctx.save();

    const pulse = 0.8 + Math.sin(this.pulsePhase) * 0.2;
    const flash = this.flashTimer > 0 ? 1.5 : 1;

    // Always render position indicators
    this.renderPositionIndicators(ctx);

    // Render phase-specific elements
    switch (this.phase) {
      case 'positioning':
        this.renderPositioningUI(ctx, pulse);
        break;

      case 'aiming':
        this.renderAimArrow(ctx, this.aimAngle, pulse, false);
        this.renderPhaseLabel(ctx, 'AIMING', '#FFD700');
        break;

      case 'power':
        this.renderAimArrow(ctx, this.lockedAngle, 1, true);
        this.renderPowerMeter(ctx, this.powerValue, pulse * flash);
        this.renderPhaseLabel(ctx, 'POWER', '#FF6B6B');
        break;

      case 'spin':
        this.renderAimArrow(ctx, this.lockedAngle, 1, true);
        this.renderPowerMeter(ctx, this.lockedPower, 1);
        this.renderSpinSelector(ctx, this.spinValue, pulse * flash);
        this.renderPhaseLabel(ctx, 'SPIN', '#6B9FFF');
        break;

      case 'ready':
        this.renderAimArrow(ctx, this.lockedAngle, 1, true);
        this.renderPowerMeter(ctx, this.lockedPower, 1);
        this.renderSpinIndicator(ctx, this.lockedSpin);
        this.renderPhaseLabel(ctx, 'THROW!', '#4CAF50');
        break;
    }

    ctx.restore();
  }

  private renderPositionIndicators(ctx: CanvasRenderingContext2D): void {
    // Draw position dots/markers BELOW the ball in the approach area
    for (let i = 0; i < this.POSITION_COUNT; i++) {
      const x = this.laneLeft + i * this.positionSpacing;
      const isSelected = i === this.positionIndex;
      const dotY = this.ballY + 30; // Below the ball

      ctx.beginPath();
      ctx.arc(x, dotY, isSelected ? 7 : 4, 0, Math.PI * 2);
      ctx.fillStyle = isSelected ? '#FFD700' : 'rgba(255, 255, 255, 0.3)';
      ctx.fill();

      if (isSelected) {
        ctx.strokeStyle = '#FFF';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Draw highlight line up to ball
        ctx.beginPath();
        ctx.moveTo(x, dotY - 7);
        ctx.lineTo(x, this.ballY + 12);
        ctx.strokeStyle = 'rgba(255, 215, 0, 0.4)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }
  }

  private renderPositioningUI(ctx: CanvasRenderingContext2D, pulse: number): void {
    // Draw left/right arrows beside the ball
    const arrowY = this.ballY - 10;
    const arrowOffset = 45;

    // Left arrow
    if (this.positionIndex > 0) {
      this.drawArrowButton(ctx, this.ballX - arrowOffset, arrowY, 'left', pulse);
    }

    // Right arrow
    if (this.positionIndex < this.POSITION_COUNT - 1) {
      this.drawArrowButton(ctx, this.ballX + arrowOffset, arrowY, 'right', pulse);
    }

    // Instructions panel on the LEFT side
    const panelX = this.laneCenter - this.laneWidth / 2 - 120;
    const panelY = 300;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(panelX - 10, panelY - 10, 100, 80, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('POSITION', panelX + 40, panelY + 10);

    ctx.fillStyle = '#aaaaaa';
    ctx.font = '11px Arial';
    ctx.fillText('A/D or', panelX + 40, panelY + 32);
    ctx.fillText('LEFT/RIGHT', panelX + 40, panelY + 46);

    ctx.fillStyle = '#4CAF50';
    ctx.font = 'bold 11px Arial';
    ctx.fillText('CLICK to aim', panelX + 40, panelY + 64);
  }

  private drawArrowButton(ctx: CanvasRenderingContext2D, x: number, y: number, direction: 'left' | 'right', pulse: number): void {
    ctx.save();
    ctx.translate(x, y);

    const size = 20 * pulse;
    const dir = direction === 'left' ? -1 : 1;

    ctx.beginPath();
    ctx.moveTo(dir * size, 0);
    ctx.lineTo(-dir * size * 0.3, -size * 0.6);
    ctx.lineTo(-dir * size * 0.3, size * 0.6);
    ctx.closePath();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.fill();

    ctx.restore();
  }

  private renderAimArrow(ctx: CanvasRenderingContext2D, angle: number, pulse: number, locked: boolean): void {
    ctx.save();
    ctx.translate(this.ballX, this.ballY - 15); // Start above the ball
    ctx.rotate(angle);

    const arrowLength = 80; // Shorter arrow
    const arrowWidth = locked ? 5 : 7 * pulse;

    // Arrow shaft
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -arrowLength);

    const color = locked ? '#4CAF50' : '#FFD700';
    ctx.strokeStyle = color;
    ctx.lineWidth = arrowWidth;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Arrow head
    ctx.beginPath();
    ctx.moveTo(0, -arrowLength - 12);
    ctx.lineTo(-10, -arrowLength + 5);
    ctx.lineTo(10, -arrowLength + 5);
    ctx.closePath();

    ctx.fillStyle = color;
    ctx.fill();

    // Glow effect when aiming
    if (!locked) {
      ctx.shadowColor = '#FFD700';
      ctx.shadowBlur = 12;
      ctx.fill();
    }

    ctx.restore();

    // Draw angle indicator arc (smaller)
    if (!locked) {
      this.renderAngleArc(ctx, angle);
    }
  }

  private renderAngleArc(ctx: CanvasRenderingContext2D, currentAngle: number): void {
    ctx.save();
    ctx.translate(this.ballX, this.ballY - 15);

    const radius = 50; // Smaller arc

    // Background arc showing full range
    ctx.beginPath();
    ctx.arc(0, 0, radius, -Math.PI / 2 - this.MAX_AIM_ANGLE, -Math.PI / 2 + this.MAX_AIM_ANGLE);
    ctx.strokeStyle = 'rgba(255, 215, 0, 0.3)';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Current angle marker
    const markerAngle = -Math.PI / 2 + currentAngle;
    const markerX = Math.cos(markerAngle) * radius;
    const markerY = Math.sin(markerAngle) * radius;

    ctx.beginPath();
    ctx.arc(markerX, markerY, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#FFD700';
    ctx.shadowColor = '#FFD700';
    ctx.shadowBlur = 8;
    ctx.fill();

    ctx.restore();
  }

  private renderPowerMeter(ctx: CanvasRenderingContext2D, power: number, pulse: number): void {
    // Power meter on the LEFT side of the lane (away from scorecard)
    const meterX = this.laneCenter - this.laneWidth / 2 - 55;
    const meterY = 120; // Fixed position near top
    const meterHeight = 180;
    const meterWidth = 30;

    ctx.save();

    // Background panel
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(meterX - 10, meterY - 35, meterWidth + 20, meterHeight + 60, 8);
    ctx.fill();
    ctx.stroke();

    // Title
    ctx.fillStyle = '#FF6B6B';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('POWER', meterX + meterWidth / 2, meterY - 15);

    // Meter track background
    ctx.fillStyle = '#222';
    ctx.fillRect(meterX, meterY, meterWidth, meterHeight);

    // Power zones (from bottom to top: green, yellow, orange, red)
    const zoneHeight = meterHeight / 4;
    const colors = ['#2E7D32', '#F9A825', '#EF6C00', '#C62828'];
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = colors[3 - i] + '40';
      ctx.fillRect(meterX, meterY + i * zoneHeight, meterWidth, zoneHeight);
    }

    // Power fill
    const fillHeight = power * meterHeight;
    let powerColor: string;
    if (power < 0.25) powerColor = '#4CAF50';
    else if (power < 0.5) powerColor = '#FFEB3B';
    else if (power < 0.75) powerColor = '#FF9800';
    else powerColor = '#F44336';

    // Glowing fill
    ctx.shadowColor = powerColor;
    ctx.shadowBlur = 10;
    ctx.fillStyle = powerColor;
    ctx.fillRect(meterX + 2, meterY + meterHeight - fillHeight, meterWidth - 4, fillHeight);
    ctx.shadowBlur = 0;

    // Border
    ctx.strokeStyle = '#888';
    ctx.lineWidth = 2;
    ctx.strokeRect(meterX, meterY, meterWidth, meterHeight);

    // Power indicator arrow (oscillating marker)
    if (this.phase === 'power') {
      const indicatorY = meterY + meterHeight - fillHeight;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(meterX - 8, indicatorY);
      ctx.lineTo(meterX - 2, indicatorY - 6);
      ctx.lineTo(meterX - 2, indicatorY + 6);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(meterX + meterWidth + 8, indicatorY);
      ctx.lineTo(meterX + meterWidth + 2, indicatorY - 6);
      ctx.lineTo(meterX + meterWidth + 2, indicatorY + 6);
      ctx.closePath();
      ctx.fill();
    }

    // Percentage display
    ctx.fillStyle = powerColor;
    ctx.font = 'bold 18px Arial';
    ctx.fillText(`${Math.round(power * 100)}%`, meterX + meterWidth / 2, meterY + meterHeight + 25);

    ctx.restore();
  }

  private renderSpinSelector(ctx: CanvasRenderingContext2D, spin: number, pulse: number): void {
    // Spin selector on the LEFT side panel
    const panelX = this.laneCenter - this.laneWidth / 2 - 70;
    const panelY = 320;

    ctx.save();

    // Background panel
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(panelX - 55, panelY - 30, 110, 110, 8);
    ctx.fill();
    ctx.stroke();

    // Title
    ctx.fillStyle = '#6B9FFF';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('SPIN', panelX, panelY - 10);

    // Three options vertically stacked
    const options = [
      { y: panelY + 15, label: 'LEFT', value: -1, color: '#FF6B6B' },
      { y: panelY + 40, label: 'STRAIGHT', value: 0, color: '#FFD700' },
      { y: panelY + 65, label: 'RIGHT', value: 1, color: '#6BFFB8' }
    ];

    for (const opt of options) {
      let isActive = false;
      if (opt.value === -1 && spin < -0.33) isActive = true;
      else if (opt.value === 0 && spin >= -0.33 && spin <= 0.33) isActive = true;
      else if (opt.value === 1 && spin > 0.33) isActive = true;

      // Option background
      ctx.fillStyle = isActive ? opt.color + '40' : 'rgba(50, 50, 50, 0.5)';
      ctx.beginPath();
      ctx.roundRect(panelX - 45, opt.y - 10, 90, 22, 4);
      ctx.fill();

      if (isActive) {
        ctx.strokeStyle = opt.color;
        ctx.lineWidth = 2 * pulse;
        ctx.stroke();
      }

      // Label
      ctx.fillStyle = isActive ? opt.color : '#666';
      ctx.font = isActive ? 'bold 12px Arial' : '12px Arial';
      ctx.fillText(opt.label, panelX, opt.y + 5);
    }

    // Timer bar at bottom
    const timerWidth = (1 - this.spinTimer / this.SPIN_DURATION) * 90;
    ctx.fillStyle = 'rgba(107, 159, 255, 0.7)';
    ctx.fillRect(panelX - 45, panelY + 78, timerWidth, 4);

    ctx.restore();
  }

  private renderSpinIndicator(ctx: CanvasRenderingContext2D, spin: SpinType): void {
    // Show spin indicator on the LEFT panel
    const panelX = this.laneCenter - this.laneWidth / 2 - 70;
    const panelY = 340;

    ctx.save();

    let label: string;
    let color: string;

    switch (spin) {
      case 'left':
        label = 'HOOK LEFT';
        color = '#FF6B6B';
        break;
      case 'right':
        label = 'HOOK RIGHT';
        color = '#6BFFB8';
        break;
      default:
        label = 'STRAIGHT';
        color = '#FFD700';
    }

    // Background panel
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(panelX - 55, panelY - 15, 110, 40, 8);
    ctx.fill();
    ctx.stroke();

    // Label
    ctx.fillStyle = '#888';
    ctx.font = '11px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('SPIN:', panelX, panelY + 2);

    ctx.fillStyle = color;
    ctx.font = 'bold 13px Arial';
    ctx.fillText(label, panelX, panelY + 18);

    ctx.restore();
  }

  private renderPhaseLabel(ctx: CanvasRenderingContext2D, label: string, color: string): void {
    ctx.save();

    // Position at TOP LEFT panel area
    const labelX = this.laneCenter - this.laneWidth / 2 - 70;
    const labelY = 85;

    // Background panel
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(labelX - 55, labelY - 20, 110, 45, 8);
    ctx.fill();
    ctx.stroke();

    // Label with glow
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;
    ctx.fillStyle = color;
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(label, labelX, labelY + 10);

    ctx.restore();
  }

  // Reset to initial state
  reset(): void {
    this.phase = 'positioning';
    this.positionIndex = 2;
    this.aimAngle = 0;
    this.aimDirection = 1;
    this.lockedAngle = 0;
    this.powerValue = 0;
    this.powerDirection = 1;
    this.lockedPower = 0;
    this.spinValue = 0;
    this.spinDirection = 1;
    this.lockedSpin = 'straight';
    this.spinTimer = 0;
    this.flashTimer = 0;
    this.updateBallPosition();
  }

  // Get current phase for external queries
  getPhase(): InputPhase {
    return this.phase;
  }

  // Get position index for UI display
  getPositionIndex(): number {
    return this.positionIndex;
  }

  // Legacy compatibility - return power value
  get power(): number {
    return this.phase === 'ready' ? this.lockedPower : this.powerValue;
  }

  // Legacy compatibility - return angle
  get angle(): number {
    return this.phase === 'ready' ? this.lockedAngle : this.aimAngle;
  }

  // Legacy compatibility - return spin
  get spin(): number {
    if (this.phase === 'ready') {
      switch (this.lockedSpin) {
        case 'left': return -0.8;
        case 'right': return 0.8;
        default: return 0;
      }
    }
    return this.spinValue;
  }
}
