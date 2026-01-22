// ===== src/games/bowling/entities/Lane.ts =====
// Bowling lane with proper orientation: ball starts at BOTTOM, pins at TOP
// Pin triangle points DOWN (head pin at top, row of 4 at bottom)

export interface OilPattern {
  name: string;
  // Oil zone starts from pin deck and extends down to this Y position
  oilEndY: number;
  // Friction in oil zone (higher = more slide)
  oilFriction: number;
  // Friction in dry zone (lower = more hook)
  dryFriction: number;
  // Hook strength multiplier in dry zone
  hookStrength: number;
}

export const OIL_PATTERNS: { [key: string]: OilPattern } = {
  standard: {
    name: 'House Shot',
    oilEndY: 320,      // Oil covers upper 2/3 of lane
    oilFriction: 0.995,
    dryFriction: 0.975,
    hookStrength: 15
  },
  short: {
    name: 'Short Pattern',
    oilEndY: 260,
    oilFriction: 0.993,
    dryFriction: 0.97,
    hookStrength: 20
  },
  long: {
    name: 'Long Pattern',
    oilEndY: 380,
    oilFriction: 0.997,
    dryFriction: 0.98,
    hookStrength: 10
  }
};

export class Lane {
  // Lane dimensions - centered on 800x600 canvas
  x: number;           // Left edge of full lane area (including gutters)
  y: number;           // Top edge (where pins are)
  width: number;       // Total width including gutters
  height: number;      // Lane length

  // Lane surface (between gutters)
  laneLeft: number;
  laneRight: number;
  laneWidth: number;

  // Gutter dimensions
  gutterWidth: number = 30;

  // Pin deck area (at TOP of screen)
  pinDeckY: number;
  pinDeckHeight: number = 120;

  // Approach area (at BOTTOM of screen)
  approachY: number;
  approachHeight: number = 80;

  // Foul line position
  foulLineY: number;

  // Oil pattern
  pattern: OilPattern;

  // Arrow markers positions (for aiming reference) - pointing UP toward pins
  arrows: { x: number; y: number }[] = [];

  // Approach dot markers (at bottom for positioning)
  approachDots: { x: number; y: number }[] = [];

  constructor(canvasWidth: number = 800, canvasHeight: number = 600) {
    // Full lane width with gutters - centered on canvas
    this.width = 200;
    this.height = canvasHeight - 100; // Leave room for UI at bottom
    this.x = (canvasWidth - this.width) / 2; // Centered horizontally
    this.y = 60; // More room at top for pins to be fully visible

    // Lane surface boundaries (inside gutters)
    this.laneLeft = this.x + this.gutterWidth;
    this.laneRight = this.x + this.width - this.gutterWidth;
    this.laneWidth = this.width - (this.gutterWidth * 2);

    // Pin deck at TOP of lane (with offset from top edge)
    this.pinDeckY = this.y + 15;

    // Approach area at BOTTOM (larger for better visibility)
    this.approachHeight = 100;
    this.approachY = this.y + this.height - this.approachHeight;

    // Foul line separates approach from lane
    this.foulLineY = this.approachY;

    // Default pattern
    this.pattern = OIL_PATTERNS.standard;

    // Setup aiming markers
    this.setupMarkers();
  }

  private setupMarkers(): void {
    const centerX = this.x + this.width / 2;

    // Arrow markers (7 arrows) - positioned in mid section
    // These arrows point UP toward the pins
    const arrowY = this.y + 180; // Mid portion of lane
    const arrowSpacing = 16;
    for (let i = -3; i <= 3; i++) {
      this.arrows.push({
        x: centerX + i * arrowSpacing,
        y: arrowY
      });
    }

    // Approach dots - two rows at the bottom for positioning
    const dotY1 = this.approachY + 30;
    const dotY2 = this.approachY + 65;
    const dotSpacing = 14;

    // 5 dots per row
    for (let i = -2; i <= 2; i++) {
      this.approachDots.push({ x: centerX + i * dotSpacing, y: dotY1 });
      this.approachDots.push({ x: centerX + i * dotSpacing, y: dotY2 });
    }

    // Additional outer dots
    this.approachDots.push({ x: centerX - dotSpacing * 4, y: dotY1 });
    this.approachDots.push({ x: centerX + dotSpacing * 4, y: dotY1 });
  }

  // Get friction at a given Y position
  getFrictionAt(y: number): number {
    // Oil is in upper portion (near pins), dry zone is lower (near bowler)
    if (y < this.pattern.oilEndY) {
      return this.pattern.oilFriction;
    }
    return this.pattern.dryFriction;
  }

  // Get hook strength at a given Y position
  getHookStrengthAt(y: number): number {
    // No hook in oiled zone (upper portion)
    if (y < this.pattern.oilEndY) {
      return 0;
    }
    return this.pattern.hookStrength;
  }

  // Check if position is in gutter
  isInGutter(x: number): boolean {
    return x < this.laneLeft || x > this.laneRight;
  }

  // Check if position is in lane bounds (entire area)
  isInBounds(x: number, y: number): boolean {
    return x >= this.x &&
      x <= this.x + this.width &&
      y >= this.y &&
      y <= this.y + this.height;
  }

  // Check if position is on playable lane surface
  isOnLaneSurface(x: number, y: number): boolean {
    return x >= this.laneLeft &&
      x <= this.laneRight &&
      y >= this.y &&
      y <= this.y + this.height;
  }

  // Get ball start position (BOTTOM of screen, in approach area)
  getBallStartPosition(): { x: number; y: number } {
    return {
      x: this.x + this.width / 2,
      y: this.approachY + this.approachHeight - 30
    };
  }

  // Get pin positions - CORRECT BOWLING ORIENTATION:
  // Ball approaches from BOTTOM of screen, so:
  // - Head pin (1) is at BOTTOM of triangle (closest to ball, highest Y)
  // - Row of 4 (pins 7,8,9,10) is at TOP of triangle (furthest from ball, lowest Y)
  getPinPositions(): { x: number; y: number; pinNumber: number }[] {
    const centerX = this.x + this.width / 2;
    const backRowY = this.pinDeckY + 20; // Back row (furthest from ball)
    const rowSpacing = 24;
    const pinSpacing = 20;

    const pins: { x: number; y: number; pinNumber: number }[] = [];

    // Row 4 (TOP/BACK - furthest from ball) - Pins 7, 8, 9, 10
    pins.push({ x: centerX - pinSpacing * 1.5, y: backRowY, pinNumber: 7 });
    pins.push({ x: centerX - pinSpacing / 2, y: backRowY, pinNumber: 8 });
    pins.push({ x: centerX + pinSpacing / 2, y: backRowY, pinNumber: 9 });
    pins.push({ x: centerX + pinSpacing * 1.5, y: backRowY, pinNumber: 10 });

    // Row 3 - Pins 4, 5, 6
    pins.push({ x: centerX - pinSpacing, y: backRowY + rowSpacing, pinNumber: 4 });
    pins.push({ x: centerX, y: backRowY + rowSpacing, pinNumber: 5 });
    pins.push({ x: centerX + pinSpacing, y: backRowY + rowSpacing, pinNumber: 6 });

    // Row 2 - Pins 2, 3
    pins.push({ x: centerX - pinSpacing / 2, y: backRowY + rowSpacing * 2, pinNumber: 2 });
    pins.push({ x: centerX + pinSpacing / 2, y: backRowY + rowSpacing * 2, pinNumber: 3 });

    // Row 1 (BOTTOM/FRONT - closest to ball, head pin)
    pins.push({ x: centerX, y: backRowY + rowSpacing * 3, pinNumber: 1 });

    return pins;
  }

  render(ctx: CanvasRenderingContext2D): void {
    ctx.save();

    // ===== OUTER FRAME / BUMPERS =====
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(this.x - 5, this.y - 5, this.width + 10, this.height + 10);

    // ===== LEFT GUTTER =====
    this.renderGutter(ctx, this.x, this.y, this.gutterWidth, this.height, 'left');

    // ===== RIGHT GUTTER =====
    this.renderGutter(ctx, this.laneRight, this.y, this.gutterWidth, this.height, 'right');

    // ===== MAIN LANE SURFACE =====
    this.renderLaneSurface(ctx);

    // ===== PIN DECK AREA =====
    this.renderPinDeck(ctx);

    // ===== OIL ZONE VISUALIZATION =====
    this.renderOilZone(ctx);

    // ===== ARROWS (pointing UP toward pins) =====
    this.renderArrows(ctx);

    // ===== FOUL LINE =====
    this.renderFoulLine(ctx);

    // ===== APPROACH AREA =====
    this.renderApproachArea(ctx);

    // ===== APPROACH DOTS =====
    this.renderApproachDots(ctx);

    // ===== LANE BORDERS =====
    ctx.strokeStyle = '#5c3d2e';
    ctx.lineWidth = 2;
    ctx.strokeRect(this.x, this.y, this.width, this.height);

    ctx.restore();
  }

  private renderGutter(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, side: 'left' | 'right'): void {
    // Deep gutter channel with metallic gradient
    const gutterGradient = ctx.createLinearGradient(x, 0, x + width, 0);

    if (side === 'left') {
      gutterGradient.addColorStop(0, '#080808');
      gutterGradient.addColorStop(0.2, '#151520');
      gutterGradient.addColorStop(0.5, '#1a1a25');
      gutterGradient.addColorStop(0.8, '#151520');
      gutterGradient.addColorStop(1, '#101015');
    } else {
      gutterGradient.addColorStop(0, '#101015');
      gutterGradient.addColorStop(0.2, '#151520');
      gutterGradient.addColorStop(0.5, '#1a1a25');
      gutterGradient.addColorStop(0.8, '#151520');
      gutterGradient.addColorStop(1, '#080808');
    }

    ctx.fillStyle = gutterGradient;
    ctx.fillRect(x, y, width, height);

    // Gutter depth shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    if (side === 'left') {
      ctx.fillRect(x + width - 5, y, 5, height);
    } else {
      ctx.fillRect(x, y, 5, height);
    }

    // LED edge lighting effect (cyan glow)
    const edgeX = side === 'left' ? x + width - 2 : x + 1;

    // Outer glow
    ctx.save();
    ctx.shadowColor = '#00ffff';
    ctx.shadowBlur = 8;
    ctx.fillStyle = 'rgba(0, 255, 255, 0.3)';
    ctx.fillRect(edgeX, y, 2, height);
    ctx.restore();

    // Core LED line
    const ledGradient = ctx.createLinearGradient(0, y, 0, y + height);
    ledGradient.addColorStop(0, 'rgba(0, 200, 255, 0.6)');
    ledGradient.addColorStop(0.5, 'rgba(0, 255, 255, 0.8)');
    ledGradient.addColorStop(1, 'rgba(0, 200, 255, 0.6)');
    ctx.fillStyle = ledGradient;
    ctx.fillRect(edgeX, y, 2, height);

    // Metallic highlight strip
    ctx.fillStyle = 'rgba(80, 80, 100, 0.25)';
    if (side === 'left') {
      ctx.fillRect(x + 6, y, 2, height);
    } else {
      ctx.fillRect(x + width - 8, y, 2, height);
    }
  }

  private renderLaneSurface(ctx: CanvasRenderingContext2D): void {
    // Base lane wood color with enhanced gradient for depth
    const laneGradient = ctx.createLinearGradient(this.laneLeft, 0, this.laneRight, 0);
    laneGradient.addColorStop(0, '#B8864E');
    laneGradient.addColorStop(0.1, '#C89860');
    laneGradient.addColorStop(0.25, '#D8A870');
    laneGradient.addColorStop(0.4, '#E8BC85');
    laneGradient.addColorStop(0.5, '#F0C890');
    laneGradient.addColorStop(0.6, '#E8BC85');
    laneGradient.addColorStop(0.75, '#D8A870');
    laneGradient.addColorStop(0.9, '#C89860');
    laneGradient.addColorStop(1, '#B8864E');

    ctx.fillStyle = laneGradient;
    ctx.fillRect(this.laneLeft, this.y, this.laneWidth, this.height);

    // Wood grain lines (vertical boards) - enhanced contrast
    ctx.strokeStyle = 'rgba(120, 70, 30, 0.18)';
    ctx.lineWidth = 1;
    const boardWidth = 8;
    for (let gx = this.laneLeft + boardWidth; gx < this.laneRight; gx += boardWidth) {
      ctx.beginPath();
      ctx.moveTo(gx, this.y);
      ctx.lineTo(gx, this.y + this.height);
      ctx.stroke();
    }

    // Subtle wood knots (decorative) - more visible
    ctx.fillStyle = 'rgba(120, 70, 30, 0.12)';
    const knotPositions = [
      { x: this.laneLeft + 30, y: this.y + 150 },
      { x: this.laneRight - 40, y: this.y + 280 },
      { x: this.laneLeft + 60, y: this.y + 400 },
      { x: this.laneRight - 25, y: this.y + 480 },
    ];
    for (const knot of knotPositions) {
      ctx.beginPath();
      ctx.ellipse(knot.x, knot.y, 4, 6, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Center lane highlight strip (glossy effect)
    const centerX = this.laneLeft + this.laneWidth / 2;
    const highlightGradient = ctx.createLinearGradient(centerX - 15, 0, centerX + 15, 0);
    highlightGradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
    highlightGradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.12)');
    highlightGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = highlightGradient;
    ctx.fillRect(centerX - 15, this.y, 30, this.height);

    // Glossy top reflection overlay
    const glossGradient = ctx.createLinearGradient(0, this.y, 0, this.y + 80);
    glossGradient.addColorStop(0, 'rgba(255, 255, 255, 0.15)');
    glossGradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.05)');
    glossGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = glossGradient;
    ctx.fillRect(this.laneLeft, this.y, this.laneWidth, 80);
  }

  private renderPinDeck(ctx: CanvasRenderingContext2D): void {
    // Pin deck has slightly different coloring
    const deckGradient = ctx.createLinearGradient(0, this.pinDeckY, 0, this.pinDeckY + this.pinDeckHeight);
    deckGradient.addColorStop(0, 'rgba(200, 180, 140, 0.25)');
    deckGradient.addColorStop(0.5, 'rgba(180, 160, 120, 0.15)');
    deckGradient.addColorStop(1, 'rgba(180, 160, 120, 0)');

    ctx.fillStyle = deckGradient;
    ctx.fillRect(this.laneLeft, this.pinDeckY, this.laneWidth, this.pinDeckHeight);

    // Pin deck back wall indication
    ctx.fillStyle = 'rgba(60, 40, 30, 0.3)';
    ctx.fillRect(this.laneLeft, this.pinDeckY, this.laneWidth, 8);
  }

  private renderOilZone(ctx: CanvasRenderingContext2D): void {
    // Oil zone: from pin deck down to oilEndY
    // Creates an iridescent sheen where oil is applied
    const oilTop = this.pinDeckY + this.pinDeckHeight;
    const oilHeight = this.pattern.oilEndY - oilTop;

    if (oilHeight > 0) {
      // Main oil gradient with enhanced colors
      const oilGradient = ctx.createLinearGradient(0, oilTop, 0, this.pattern.oilEndY);
      oilGradient.addColorStop(0, 'rgba(160, 200, 240, 0.15)');
      oilGradient.addColorStop(0.3, 'rgba(180, 210, 255, 0.12)');
      oilGradient.addColorStop(0.6, 'rgba(170, 220, 250, 0.08)');
      oilGradient.addColorStop(0.85, 'rgba(180, 200, 230, 0.04)');
      oilGradient.addColorStop(1, 'rgba(180, 200, 230, 0)');

      ctx.fillStyle = oilGradient;
      ctx.fillRect(this.laneLeft, oilTop, this.laneWidth, oilHeight);

      // Iridescent shimmer streaks
      ctx.save();
      const streakCount = 5;
      for (let i = 0; i < streakCount; i++) {
        const streakX = this.laneLeft + (this.laneWidth / (streakCount + 1)) * (i + 1);
        const shimmerGrad = ctx.createLinearGradient(0, oilTop, 0, this.pattern.oilEndY);
        shimmerGrad.addColorStop(0, 'rgba(200, 220, 255, 0.08)');
        shimmerGrad.addColorStop(0.5, 'rgba(180, 240, 255, 0.12)');
        shimmerGrad.addColorStop(1, 'rgba(200, 220, 255, 0)');
        ctx.fillStyle = shimmerGrad;
        ctx.fillRect(streakX - 3, oilTop, 6, oilHeight);
      }
      ctx.restore();

      // Oil zone edge indicator (subtle glowing line where oil ends)
      ctx.save();
      ctx.shadowColor = 'rgba(100, 180, 255, 0.5)';
      ctx.shadowBlur = 4;
      ctx.strokeStyle = 'rgba(100, 160, 200, 0.25)';
      ctx.lineWidth = 1;
      ctx.setLineDash([8, 4]);
      ctx.beginPath();
      ctx.moveTo(this.laneLeft + 10, this.pattern.oilEndY);
      ctx.lineTo(this.laneRight - 10, this.pattern.oilEndY);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }
  }

  private renderArrows(ctx: CanvasRenderingContext2D): void {
    // Neon arrows point UP toward the pins for aiming reference
    const neonColor = '#ff00aa'; // Hot pink/magenta
    const glowColor = 'rgba(255, 0, 170, 0.6)';

    for (let i = 0; i < this.arrows.length; i++) {
      const arrow = this.arrows[i];
      const isCenter = i === 3; // Middle arrow is larger

      ctx.save();
      ctx.translate(arrow.x, arrow.y);

      // Arrow pointing UP (toward top of screen / pins)
      const size = isCenter ? 1.4 : 1;

      // Define arrow path
      const drawArrow = () => {
        ctx.beginPath();
        ctx.moveTo(0, -10 * size);           // Top point (toward pins)
        ctx.lineTo(-6 * size, 4 * size);     // Bottom left
        ctx.lineTo(-2 * size, 2 * size);     // Inner left
        ctx.lineTo(-2 * size, 10 * size);    // Tail bottom left
        ctx.lineTo(2 * size, 10 * size);     // Tail bottom right
        ctx.lineTo(2 * size, 2 * size);      // Inner right
        ctx.lineTo(6 * size, 4 * size);      // Bottom right
        ctx.closePath();
      };

      // Outer glow effect
      ctx.shadowColor = neonColor;
      ctx.shadowBlur = isCenter ? 12 : 8;
      drawArrow();
      ctx.fillStyle = glowColor;
      ctx.fill();

      // Core neon fill
      ctx.shadowBlur = 4;
      drawArrow();
      ctx.fillStyle = neonColor;
      ctx.fill();

      // Inner highlight for 3D effect
      ctx.shadowBlur = 0;
      drawArrow();
      const innerGrad = ctx.createLinearGradient(0, -10 * size, 0, 10 * size);
      innerGrad.addColorStop(0, 'rgba(255, 150, 220, 0.8)');
      innerGrad.addColorStop(0.5, 'rgba(255, 100, 200, 0.4)');
      innerGrad.addColorStop(1, 'rgba(255, 50, 150, 0.6)');
      ctx.fillStyle = innerGrad;
      ctx.fill();

      ctx.restore();
    }

    // Neon range finder dots between arrows
    ctx.save();
    ctx.shadowColor = neonColor;
    ctx.shadowBlur = 6;
    ctx.fillStyle = 'rgba(255, 0, 170, 0.8)';
    const arrowY = this.arrows[0].y;
    for (let i = 0; i < this.arrows.length - 1; i++) {
      const midX = (this.arrows[i].x + this.arrows[i + 1].x) / 2;
      ctx.beginPath();
      ctx.arc(midX, arrowY, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private renderFoulLine(ctx: CanvasRenderingContext2D): void {
    // Solid foul line base
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(this.laneLeft - 2, this.foulLineY - 4, this.laneWidth + 4, 8);

    // Metallic edge highlights
    ctx.fillStyle = 'rgba(80, 80, 90, 0.6)';
    ctx.fillRect(this.laneLeft - 2, this.foulLineY - 4, this.laneWidth + 4, 1);
    ctx.fillStyle = 'rgba(30, 30, 35, 0.8)';
    ctx.fillRect(this.laneLeft - 2, this.foulLineY + 3, this.laneWidth + 4, 1);

    // Active red LED indicator lights on foul line
    const lightSpacing = 22;
    const centerX = this.x + this.width / 2;

    ctx.save();
    for (let i = -3; i <= 3; i++) {
      const lightX = centerX + i * lightSpacing;

      // LED glow
      ctx.shadowColor = '#ff2200';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(lightX, this.foulLineY, 4, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 50, 0, 0.6)';
      ctx.fill();

      // LED core
      ctx.shadowBlur = 3;
      ctx.beginPath();
      ctx.arc(lightX, this.foulLineY, 3, 0, Math.PI * 2);
      const ledGrad = ctx.createRadialGradient(lightX - 1, this.foulLineY - 1, 0, lightX, this.foulLineY, 3);
      ledGrad.addColorStop(0, '#ff6644');
      ledGrad.addColorStop(0.5, '#ff3311');
      ledGrad.addColorStop(1, '#cc0000');
      ctx.fillStyle = ledGrad;
      ctx.fill();

      // LED highlight
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.arc(lightX - 1, this.foulLineY - 1, 1, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 200, 150, 0.8)';
      ctx.fill();
    }
    ctx.restore();
  }

  private renderApproachArea(ctx: CanvasRenderingContext2D): void {
    // Approach area - darker wood tone
    const approachGradient = ctx.createLinearGradient(this.laneLeft, 0, this.laneRight, 0);
    approachGradient.addColorStop(0, '#A08060');
    approachGradient.addColorStop(0.5, '#B09070');
    approachGradient.addColorStop(1, '#A08060');

    ctx.fillStyle = approachGradient;
    ctx.fillRect(this.laneLeft, this.approachY, this.laneWidth, this.approachHeight);

    // Approach wood grain
    ctx.strokeStyle = 'rgba(80, 50, 30, 0.15)';
    ctx.lineWidth = 1;
    const boardWidth = 10;
    for (let gx = this.laneLeft + boardWidth; gx < this.laneRight; gx += boardWidth) {
      ctx.beginPath();
      ctx.moveTo(gx, this.approachY);
      ctx.lineTo(gx, this.approachY + this.approachHeight);
      ctx.stroke();
    }
  }

  private renderApproachDots(ctx: CanvasRenderingContext2D): void {
    // Approach dots for positioning with subtle glow
    ctx.save();

    for (const dot of this.approachDots) {
      // Outer glow
      ctx.shadowColor = '#ff00aa';
      ctx.shadowBlur = 4;
      ctx.beginPath();
      ctx.arc(dot.x, dot.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(60, 30, 50, 0.9)';
      ctx.fill();

      // Inner dot
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.arc(dot.x, dot.y, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 100, 180, 0.4)';
      ctx.fill();
    }

    // Center dot is larger and more prominent
    const centerX = this.x + this.width / 2;
    const centerDots = this.approachDots.filter(d => Math.abs(d.x - centerX) < 2);

    for (const dot of centerDots) {
      // Larger glow for center
      ctx.shadowColor = '#ff00aa';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(dot.x, dot.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(80, 20, 60, 0.95)';
      ctx.fill();

      // Bright inner core
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.arc(dot.x, dot.y, 3, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 80, 160, 0.6)';
      ctx.fill();
    }

    ctx.restore();
  }

  // Render reflection layer (called after ball/pins for reflection effect)
  renderReflections(ctx: CanvasRenderingContext2D, ballX: number, ballY: number, ballRadius: number): void {
    // Only show reflection in oiled area (upper portion of lane)
    if (ballY > this.pattern.oilEndY || ballY < this.pinDeckY + this.pinDeckHeight) return;

    ctx.save();
    ctx.globalAlpha = 0.12;

    // Ball reflection (subtle shadow/reflection below ball)
    const reflectY = ballY + ballRadius * 1.5;

    ctx.beginPath();
    ctx.ellipse(ballX, reflectY, ballRadius * 0.8, ballRadius * 0.3, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fill();

    ctx.restore();
  }

  // Get the lane center X coordinate
  getCenterX(): number {
    return this.x + this.width / 2;
  }

  // Get the playable lane boundaries (excluding gutters)
  getLaneBounds(): { left: number; right: number; top: number; bottom: number } {
    return {
      left: this.laneLeft,
      right: this.laneRight,
      top: this.y,
      bottom: this.y + this.height
    };
  }
}
