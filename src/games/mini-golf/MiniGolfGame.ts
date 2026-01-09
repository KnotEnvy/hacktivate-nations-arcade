// ===== src/games/minigolf/MiniGolfGame.ts =====
import { BaseGame } from '@/games/shared/BaseGame';
import { GameManifest, GameScore } from '@/lib/types';

// Entities
import { Ball } from './entities/Ball';
import { Hole } from './entities/Hole';
import { Obstacle, ObstacleType } from './entities/Obstacle';
import { AimIndicator } from './entities/AimIndicator';

// Systems
import { PhysicsSystem } from './systems/PhysicsSystem';
import { ParticleSystem } from './systems/ParticleSystem';
import { WindSystem } from './systems/WindSystem';
import { CourseRenderer } from './systems/CourseRenderer';

// Data
import { COURSES, CourseData } from './data/courses';

type GamePhase = 'aiming' | 'rolling' | 'sinking' | 'nextHole' | 'stats' | 'complete';

export class MiniGolfGame extends BaseGame {
  manifest: GameManifest = {
    id: 'mini-golf',
    title: 'Mini Golf',
    thumbnail: '/games/mini-golf/mini-golf-thumb.svg',
    inputSchema: ['keyboard', 'touch'],
    assetBudgetKB: 90,
    tier: 1,
    description: 'Master 9 holes of challenging mini golf! Avoid hazards, beat par, and sink that hole-in-one!'
  };

  // Game state
  private currentHole: number = 0;
  private strokes: number = 0;
  private totalStrokes: number = 0;
  private strokesPerHole: number[] = [];
  private phase: GamePhase = 'aiming';
  
  // Entities
  private ball!: Ball;
  private hole!: Hole;
  private obstacles: Obstacle[] = [];
  private aimIndicator!: AimIndicator;
  
  // Systems
  private physics!: PhysicsSystem;
  private particles!: ParticleSystem;
  private wind!: WindSystem;
  private courseRenderer!: CourseRenderer;
  
  // Input tracking
  private isDragging: boolean = false;
  private dragStart: { x: number; y: number } | null = null;
  private dragCurrent: { x: number; y: number } | null = null;
  
  // Effects
  private screenShake: { x: number; y: number; intensity: number } = { x: 0, y: 0, intensity: 0 };
  private celebrationTimer: number = 0;
  private messageText: string = '';
  private messageTimer: number = 0;
  
  // Coins collected (bonus for under par, hole-in-ones)
  private coinsThisRound: number = 0;
  
  protected renderBaseHud: boolean = false;

  protected onInit(): void {
    // Initialize systems
    this.physics = new PhysicsSystem(this.canvas.width, this.canvas.height);
    this.particles = new ParticleSystem();
    this.wind = new WindSystem();
    this.courseRenderer = new CourseRenderer(this.canvas.width, this.canvas.height);
    
    // Initialize aim indicator
    this.aimIndicator = new AimIndicator();
    
    // Setup first hole
    this.setupHole(0);
    
    // Bind input handlers
    this.setupInputHandlers();
  }

  private setupInputHandlers(): void {
    // Mouse events
    this.canvas.addEventListener('mousedown', this.handlePointerDown.bind(this));
    this.canvas.addEventListener('mousemove', this.handlePointerMove.bind(this));
    this.canvas.addEventListener('mouseup', this.handlePointerUp.bind(this));
    this.canvas.addEventListener('mouseleave', this.handlePointerUp.bind(this));
    
    // Touch events
    this.canvas.addEventListener('touchstart', this.handleTouchStart.bind(this));
    this.canvas.addEventListener('touchmove', this.handleTouchMove.bind(this));
    this.canvas.addEventListener('touchend', this.handleTouchEnd.bind(this));
  }

  private handlePointerDown(e: MouseEvent): void {
    // Handle stats screen click to continue
    if (this.phase === 'stats') {
      this.phase = 'complete';
      this.endGame();
      return;
    }
    
    if (this.phase !== 'aiming') return;
    
    const rect = this.canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (this.canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (this.canvas.height / rect.height);
    
    // Check if clicking near the ball
    const dx = x - this.ball.x;
    const dy = y - this.ball.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    if (dist < 60) {
      this.isDragging = true;
      this.dragStart = { x: this.ball.x, y: this.ball.y };
      this.dragCurrent = { x, y };
    }
  }

  private handlePointerMove(e: MouseEvent): void {
    if (!this.isDragging || this.phase !== 'aiming') return;
    
    const rect = this.canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (this.canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (this.canvas.height / rect.height);
    
    this.dragCurrent = { x, y };
  }

  private handlePointerUp(e: MouseEvent): void {
    if (!this.isDragging || this.phase !== 'aiming') return;
    this.executeShot();
  }

  private handleTouchStart(e: TouchEvent): void {
    e.preventDefault();
    
    // Handle stats screen tap to continue
    if (this.phase === 'stats') {
      this.phase = 'complete';
      this.endGame();
      return;
    }
    
    if (this.phase !== 'aiming' || e.touches.length === 0) return;
    
    const touch = e.touches[0];
    const rect = this.canvas.getBoundingClientRect();
    const x = (touch.clientX - rect.left) * (this.canvas.width / rect.width);
    const y = (touch.clientY - rect.top) * (this.canvas.height / rect.height);
    
    const dx = x - this.ball.x;
    const dy = y - this.ball.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    if (dist < 80) {
      this.isDragging = true;
      this.dragStart = { x: this.ball.x, y: this.ball.y };
      this.dragCurrent = { x, y };
    }
  }

  private handleTouchMove(e: TouchEvent): void {
    e.preventDefault();
    if (!this.isDragging || this.phase !== 'aiming' || e.touches.length === 0) return;
    
    const touch = e.touches[0];
    const rect = this.canvas.getBoundingClientRect();
    const x = (touch.clientX - rect.left) * (this.canvas.width / rect.width);
    const y = (touch.clientY - rect.top) * (this.canvas.height / rect.height);
    
    this.dragCurrent = { x, y };
  }

  private handleTouchEnd(e: TouchEvent): void {
    e.preventDefault();
    if (!this.isDragging || this.phase !== 'aiming') return;
    this.executeShot();
  }

  private executeShot(): void {
    if (!this.dragStart || !this.dragCurrent) {
      this.isDragging = false;
      return;
    }
    
    const dx = this.dragStart.x - this.dragCurrent.x;
    const dy = this.dragStart.y - this.dragCurrent.y;
    const power = Math.min(Math.sqrt(dx * dx + dy * dy), 200);
    
    if (power < 10) {
      this.isDragging = false;
      this.dragStart = null;
      this.dragCurrent = null;
      return;
    }
    
    // Normalize and apply power - FLIP direction so ball goes toward arrow
    const dist = Math.sqrt(dx * dx + dy * dy);
    const vx = -(dx / dist) * power * 3;
    const vy = -(dy / dist) * power * 3;
    
    this.ball.vx = vx;
    this.ball.vy = vy;
    
    this.strokes++;
    this.phase = 'rolling';
    
    // Play hit sound
    this.services?.audio?.playSound?.('hit');
    
    // Add particles at ball
    this.particles.emit(this.ball.x, this.ball.y, 10, '#ffffff', 'burst');
    
    this.isDragging = false;
    this.dragStart = null;
    this.dragCurrent = null;
  }

  private setupHole(holeIndex: number): void {
    const course = COURSES[holeIndex];
    if (!course) return;
    
    // Create ball at start position
    this.ball = new Ball(course.startX, course.startY);
    
    // Create hole
    this.hole = new Hole(course.holeX, course.holeY);
    
    // Create obstacles
    this.obstacles = course.obstacles.map(obs => new Obstacle(obs));
    
    // Reset physics with course bounds
    this.physics.setCourseBounds(course.bounds);
    this.physics.setObstacles(this.obstacles);
    
    // Set wind for this hole
    if (course.hasWind) {
      this.wind.randomize();
    } else {
      this.wind.setCalm();
    }
    
    // Reset state
    this.strokes = 0;
    this.phase = 'aiming';
    
    // Show hole intro message
    this.showMessage(`Hole ${holeIndex + 1} - Par ${course.par}`, 2);
  }

  private showMessage(text: string, duration: number): void {
    this.messageText = text;
    this.messageTimer = duration;
  }

  protected onUpdate(dt: number): void {
    // Update timers
    if (this.messageTimer > 0) {
      this.messageTimer -= dt;
    }
    
    if (this.celebrationTimer > 0) {
      this.celebrationTimer -= dt;
    }
    
    // Update screen shake
    if (this.screenShake.intensity > 0) {
      this.screenShake.x = (Math.random() - 0.5) * this.screenShake.intensity * 10;
      this.screenShake.y = (Math.random() - 0.5) * this.screenShake.intensity * 10;
      this.screenShake.intensity *= 0.9;
      if (this.screenShake.intensity < 0.01) {
        this.screenShake.intensity = 0;
        this.screenShake.x = 0;
        this.screenShake.y = 0;
      }
    }
    
    // Update particles
    this.particles.update(dt);
    
    // Update wind
    this.wind.update(dt);
    
    // Phase-specific updates
    switch (this.phase) {
      case 'aiming':
        this.updateAiming(dt);
        break;
      case 'rolling':
        this.updateRolling(dt);
        break;
      case 'sinking':
        this.updateSinking(dt);
        break;
      case 'nextHole':
        this.updateNextHole(dt);
        break;
      case 'stats':
        this.updateStats(dt);
        break;
      case 'complete':
        this.updateComplete(dt);
        break;
    }
  }

  private updateAiming(dt: number): void {
    // Update aim indicator if dragging
    if (this.isDragging && this.dragStart && this.dragCurrent) {
      const dx = this.dragStart.x - this.dragCurrent.x;
      const dy = this.dragStart.y - this.dragCurrent.y;
      const power = Math.min(Math.sqrt(dx * dx + dy * dy), 200);
      const angle = Math.atan2(dy, dx);
      
      this.aimIndicator.update(this.ball.x, this.ball.y, angle, power / 200);
    }
  }

  private updateRolling(dt: number): void {
    // Safety check - if ball has invalid position, reset it
    if (isNaN(this.ball.x) || isNaN(this.ball.y) || 
        isNaN(this.ball.vx) || isNaN(this.ball.vy)) {
      const course = COURSES[this.currentHole];
      this.ball.x = course.startX;
      this.ball.y = course.startY;
      this.ball.vx = 0;
      this.ball.vy = 0;
      this.phase = 'aiming';
      return;
    }
    
    // Check if ball is already stopped BEFORE applying any forces
    if (this.ball.isStopped()) {
      // Ball has come to rest - lock it in place and switch to aiming
      this.ball.vx = 0;
      this.ball.vy = 0;
      this.phase = 'aiming';
      this.particles.emit(this.ball.x, this.ball.y, 3, '#ffffff', 'dust');
      return;
    }
    
    // Only apply wind when ball is moving fast enough
    const speed = this.ball.getSpeed();
    if (speed > 3) {
      const windForce = this.wind.getForce();
      // Scale wind effect based on speed - less effect when nearly stopped
      const windScale = Math.min(1, speed / 100);
      this.ball.vx += windForce.x * dt * windScale;
      this.ball.vy += windForce.y * dt * windScale;
    }
    
    // Update physics
    const collision = this.physics.updateBall(this.ball, dt, this.obstacles);
    
    if (collision.hitWall) {
      this.services?.audio?.playSound?.('bounce');
      if (collision.hitX !== undefined && collision.hitY !== undefined) {
        this.particles.emit(collision.hitX, collision.hitY, 5, '#8B4513', 'burst');
      }
    }
    
    if (collision.hitObstacle && collision.obstacle) {
      const obs = collision.obstacle;
      switch (obs.type) {
        case 'water':
          this.handleWaterHazard();
          return;
        case 'sand':
          // Sand slows ball significantly (extra friction applied in physics)
          this.particles.emit(this.ball.x, this.ball.y, 3, '#F4D03F', 'dust');
          break;
        case 'bumper':
          this.screenShake.intensity = 0.3;
          this.services?.audio?.playSound?.('bounce');
          this.particles.emit(this.ball.x, this.ball.y, 8, '#FF6B6B', 'burst');
          this.pickups += 5; // Bonus coins for bumper hits
          break;
      }
    }
    
    // Check if ball is in hole
    const holeResult = this.hole.checkBall(this.ball);
    if (holeResult.sinking) {
      this.phase = 'sinking';
      this.services?.audio?.playSound?.('hole');
      return;
    } else if (holeResult.nearMiss) {
      // Ball was close but too fast
      this.particles.emit(this.hole.x, this.hole.y, 3, '#FFD700', 'sparkle');
    }
  }

  private handleWaterHazard(): void {
    this.services?.audio?.playSound?.('splash');
    this.particles.emit(this.ball.x, this.ball.y, 20, '#4A90D9', 'splash');
    this.screenShake.intensity = 0.5;
    
    // Penalty stroke
    this.strokes++;
    
    // Reset ball to start position
    const course = COURSES[this.currentHole];
    this.ball.x = course.startX;
    this.ball.y = course.startY;
    this.ball.vx = 0;
    this.ball.vy = 0;
    this.ball.sinkProgress = 0;
    
    this.showMessage('Water Hazard! +1 Stroke', 1.5);
    
    // Small delay before allowing next shot
    setTimeout(() => {
      this.phase = 'aiming';
    }, 500);
  }

  private updateSinking(dt: number): void {
    // Animate ball sinking into hole
    this.ball.sinkProgress += dt * 2;
    
    if (this.ball.sinkProgress >= 1) {
      this.completeHole();
    }
  }

  private completeHole(): void {
    const course = COURSES[this.currentHole];
    const par = course.par;
    const score = this.strokes - par;
    
    // Calculate bonus coins
    let bonusCoins = 0;
    let message = '';
    
    if (this.strokes === 1) {
      message = '🎉 HOLE IN ONE! 🎉';
      bonusCoins = 100;
      this.celebrationTimer = 3;
      this.screenShake.intensity = 1;
      this.particles.emit(this.hole.x, this.hole.y, 50, '#FFD700', 'celebration');
      this.services?.audio?.playSound?.('win');
    } else if (score <= -2) {
      message = '🦅 EAGLE!';
      bonusCoins = 50;
      this.celebrationTimer = 2;
      this.particles.emit(this.hole.x, this.hole.y, 30, '#C0C0C0', 'celebration');
    } else if (score === -1) {
      message = '🐦 Birdie!';
      bonusCoins = 25;
      this.particles.emit(this.hole.x, this.hole.y, 20, '#90EE90', 'celebration');
    } else if (score === 0) {
      message = 'Par';
      bonusCoins = 10;
    } else if (score === 1) {
      message = 'Bogey';
      bonusCoins = 5;
    } else if (score === 2) {
      message = 'Double Bogey';
      bonusCoins = 2;
    } else {
      message = `+${score}`;
      bonusCoins = 1;
    }
    
    this.coinsThisRound += bonusCoins;
    this.pickups += bonusCoins;
    this.totalStrokes += this.strokes;
    this.strokesPerHole.push(this.strokes);
    
    this.showMessage(`${message} (${this.strokes} strokes)`, 2);
    this.phase = 'nextHole';
  }

  private nextHoleTimer: number = 0;
  
  private updateNextHole(dt: number): void {
    this.nextHoleTimer += dt;
    
    if (this.nextHoleTimer >= 2.5) {
      this.nextHoleTimer = 0;
      this.currentHole++;
      
      if (this.currentHole >= COURSES.length) {
        // Game complete - go to stats screen first
        this.finishGame();
      } else {
        this.setupHole(this.currentHole);
      }
    }
  }

  private updateComplete(dt: number): void {
    // Game is over, just show final score
  }

  private finishGame(): void {
    // Calculate total score vs par
    const totalPar = COURSES.reduce((sum, c) => sum + c.par, 0);
    const scoreVsPar = this.totalStrokes - totalPar;
    
    // Calculate bonus coins
    if (scoreVsPar < 0) {
      this.coinsThisRound += Math.abs(scoreVsPar) * 20;
    }
    
    // Award coins
    this.score = Math.max(0, (totalPar * 100) - (this.totalStrokes * 10) + this.coinsThisRound);
    this.pickups = this.coinsThisRound;
    
    // Extended game data for achievements
    this.extendedGameData = {
      holesCompleted: this.currentHole,
      totalStrokes: this.totalStrokes,
      scoreVsPar,
      strokesPerHole: this.strokesPerHole,
      holeInOnes: this.strokesPerHole.filter(s => s === 1).length,
    };
    
    // Show stats screen first (user must click to continue to game over)
    this.phase = 'stats';
  }

  private updateStats(dt: number): void {
    // Check for click/tap to continue
    const input = this.services?.input;
    if (input) {
      if (input.isKeyPressed('Space') || input.isKeyPressed('Enter') || 
          input.isMousePressed?.() || input.isTouchActive?.()) {
        this.phase = 'complete';
        this.endGame();
      }
    }
  }

  protected onRender(ctx: CanvasRenderingContext2D): void {
    // For stats and complete phases, render a clean background instead of the course
    if (this.phase === 'stats' || this.phase === 'complete') {
      // Draw a nice gradient background
      const gradient = ctx.createLinearGradient(0, 0, 0, this.canvas.height);
      gradient.addColorStop(0, '#1a472a');
      gradient.addColorStop(0.5, '#0d2818');
      gradient.addColorStop(1, '#061a0f');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      
      // Render UI (stats screen or complete screen)
      this.renderGameUI(ctx);
      return;
    }
    
    // Apply screen shake
    ctx.save();
    ctx.translate(this.screenShake.x, this.screenShake.y);
    
    // Render course background
    const course = COURSES[this.currentHole];
    if (course) {
      this.courseRenderer.render(ctx, course);
    }
    
    // Render obstacles
    for (const obstacle of this.obstacles) {
      obstacle.render(ctx);
    }
    
    // Render hole
    if (this.hole) {
      this.hole.render(ctx);
    }
    
    // Render ball (unless sinking complete)
    if (this.ball && this.ball.sinkProgress < 1) {
      this.ball.render(ctx);
    }
    
    // Render aim indicator
    if (this.phase === 'aiming' && this.isDragging) {
      this.aimIndicator.render(ctx);
    }
    
    // Render particles
    this.particles.render(ctx);
    
    // Render wind indicator
    this.wind.render(ctx, 50, 80);
    
    ctx.restore();
    
    // Render UI (not affected by shake)
    this.renderGameUI(ctx);
  }

  private renderGameUI(ctx: CanvasRenderingContext2D): void {
    // Handle stats and complete phases separately - they don't need course data
    if (this.phase === 'stats') {
      this.renderStatsScreen(ctx);
      return;
    }
    
    if (this.phase === 'complete') {
      this.renderCompleteScreen(ctx);
      return;
    }
    
    const course = COURSES[this.currentHole];
    if (!course) return;
    
    // Top bar background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, this.canvas.width, 50);
    
    // Hole number
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`Hole ${this.currentHole + 1}/9`, 15, 32);
    
    // Par
    ctx.fillStyle = '#90EE90';
    ctx.font = '16px Arial';
    ctx.fillText(`Par ${course.par}`, 120, 32);
    
    // Strokes
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`Strokes: ${this.strokes}`, this.canvas.width / 2, 32);
    
    // Total score
    ctx.fillStyle = '#87CEEB';
    ctx.font = '16px Arial';
    ctx.textAlign = 'right';
    const totalPar = COURSES.slice(0, this.currentHole).reduce((s, c) => s + c.par, 0);
    const diff = this.totalStrokes - totalPar;
    const diffStr = diff === 0 ? 'E' : (diff > 0 ? `+${diff}` : `${diff}`);
    ctx.fillText(`Total: ${this.totalStrokes} (${diffStr})`, this.canvas.width - 15, 32);
    
    // Coins earned this round
    ctx.fillStyle = '#FFD700';
    ctx.font = '14px Arial';
    ctx.fillText(`💰 ${this.coinsThisRound}`, this.canvas.width - 15, 48);
    
    // ===== SCORECARD ON RIGHT SIDE =====
    this.renderScorecard(ctx);
    
    // Message overlay
    if (this.messageTimer > 0) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
      ctx.fillRect(this.canvas.width / 2 - 150, this.canvas.height / 2 - 40, 300, 80);
      
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 24px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(this.messageText, this.canvas.width / 2, this.canvas.height / 2 + 8);
    }
    
    // Celebration effects
    if (this.celebrationTimer > 0) {
      // Add sparkle overlay
      ctx.fillStyle = `rgba(255, 215, 0, ${this.celebrationTimer * 0.1})`;
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
    
    // Instructions on first hole
    if (this.currentHole === 0 && this.phase === 'aiming' && this.strokes === 0) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(this.canvas.width / 2 - 120, this.canvas.height - 70, 240, 50);
      
      ctx.fillStyle = '#ffffff';
      ctx.font = '14px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('Drag from ball to aim', this.canvas.width / 2, this.canvas.height - 48);
      ctx.fillText('Release to shoot!', this.canvas.width / 2, this.canvas.height - 30);
    }
  }

  private renderScorecard(ctx: CanvasRenderingContext2D): void {
    // Scorecard position (right side of screen - much larger now)
    const cardX = 500;
    const cardY = 55;
    const cardWidth = 260;
    const cardHeight = 540;
    
    // Main card background with gradient effect
    const bgGradient = ctx.createLinearGradient(cardX, cardY, cardX, cardY + cardHeight);
    bgGradient.addColorStop(0, 'rgba(20, 40, 20, 0.95)');
    bgGradient.addColorStop(0.5, 'rgba(15, 35, 15, 0.95)');
    bgGradient.addColorStop(1, 'rgba(10, 30, 10, 0.95)');
    ctx.fillStyle = bgGradient;
    
    // Rounded rectangle for card
    this.roundRect(ctx, cardX, cardY, cardWidth, cardHeight, 12);
    ctx.fill();
    
    // Outer border (gold)
    ctx.strokeStyle = '#D4AF37';
    ctx.lineWidth = 3;
    this.roundRect(ctx, cardX, cardY, cardWidth, cardHeight, 12);
    ctx.stroke();
    
    // Inner border (darker gold)
    ctx.strokeStyle = '#8B7355';
    ctx.lineWidth = 1;
    this.roundRect(ctx, cardX + 4, cardY + 4, cardWidth - 8, cardHeight - 8, 10);
    ctx.stroke();
    
    // ===== HEADER SECTION =====
    const headerHeight = 70;
    const headerGradient = ctx.createLinearGradient(cardX, cardY, cardX, cardY + headerHeight);
    headerGradient.addColorStop(0, '#2D5A27');
    headerGradient.addColorStop(1, '#1E3D1A');
    ctx.fillStyle = headerGradient;
    this.roundRectTop(ctx, cardX + 3, cardY + 3, cardWidth - 6, headerHeight, 10);
    ctx.fill();
    
    // Header decorative line
    ctx.strokeStyle = '#D4AF37';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cardX + 15, cardY + headerHeight + 3);
    ctx.lineTo(cardX + cardWidth - 15, cardY + headerHeight + 3);
    ctx.stroke();
    
    // Golf ball icon in header
    ctx.beginPath();
    ctx.arc(cardX + cardWidth / 2, cardY + 25, 12, 0, Math.PI * 2);
    const ballGrad = ctx.createRadialGradient(cardX + cardWidth / 2 - 3, cardY + 22, 0, cardX + cardWidth / 2, cardY + 25, 12);
    ballGrad.addColorStop(0, '#ffffff');
    ballGrad.addColorStop(1, '#cccccc');
    ctx.fillStyle = ballGrad;
    ctx.fill();
    ctx.strokeStyle = '#999';
    ctx.lineWidth = 1;
    ctx.stroke();
    
    // Title text
    ctx.fillStyle = '#D4AF37';
    ctx.font = 'bold 11px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('HACKTIVATE NATIONS', cardX + cardWidth / 2, cardY + 50);
    
    ctx.fillStyle = '#90EE90';
    ctx.font = 'bold 14px Arial';
    ctx.fillText('⛳ SCORECARD ⛳', cardX + cardWidth / 2, cardY + 67);
    
    // ===== COLUMN HEADERS =====
    const tableTop = cardY + headerHeight + 15;
    const rowHeight = 38;
    const col1 = cardX + 25;  // HOLE
    const col2 = cardX + 70;  // PAR
    const col3 = cardX + 115; // SCORE
    const col4 = cardX + 165; // +/-
    
    // Column header background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fillRect(cardX + 8, tableTop - 5, cardWidth - 16, 25);
    
    ctx.fillStyle = '#D4AF37';
    ctx.font = 'bold 11px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('HOLE', col1, tableTop + 12);
    ctx.fillText('PAR', col2, tableTop + 12);
    ctx.fillText('SCORE', col3, tableTop + 12);
    ctx.fillText('+/-', col4, tableTop + 12);
    
    // ===== HOLE ROWS =====
    const rowsStartY = tableTop + 30;
    let runningTotal = 0;
    let runningPar = 0;
    
    for (let i = 0; i < 9; i++) {
      const rowY = rowsStartY + i * rowHeight;
      const holePar = COURSES[i].par;
      const holeStrokes = this.strokesPerHole[i];
      const isCurrentHole = i === this.currentHole;
      const isCompleted = i < this.strokesPerHole.length;
      
      // Alternating row backgrounds
      if (i % 2 === 0) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.fillRect(cardX + 8, rowY - 5, cardWidth - 16, rowHeight - 2);
      }
      
      // Highlight current hole with glowing effect
      if (isCurrentHole && this.phase !== 'complete' && this.phase !== 'stats') {
        // Outer glow
        ctx.fillStyle = 'rgba(255, 215, 0, 0.15)';
        ctx.fillRect(cardX + 6, rowY - 7, cardWidth - 12, rowHeight + 2);
        // Inner highlight
        ctx.fillStyle = 'rgba(255, 215, 0, 0.25)';
        ctx.fillRect(cardX + 8, rowY - 5, cardWidth - 16, rowHeight - 2);
        // Left accent bar
        ctx.fillStyle = '#FFD700';
        ctx.fillRect(cardX + 8, rowY - 5, 4, rowHeight - 2);
      }
      
      // Hole number (in circle for current hole)
      if (isCurrentHole && this.phase !== 'complete' && this.phase !== 'stats') {
        ctx.beginPath();
        ctx.arc(col1, rowY + 12, 14, 0, Math.PI * 2);
        ctx.fillStyle = '#FFD700';
        ctx.fill();
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 16px Arial';
        ctx.fillText(`${i + 1}`, col1, rowY + 17);
      } else {
        ctx.fillStyle = isCompleted ? '#ffffff' : '#666666';
        ctx.font = isCompleted ? 'bold 16px Arial' : '16px Arial';
        ctx.fillText(`${i + 1}`, col1, rowY + 17);
      }
      
      // Par value
      ctx.fillStyle = '#90EE90';
      ctx.font = '16px Arial';
      ctx.fillText(`${holePar}`, col2, rowY + 17);
      
      // Score and +/-
      if (isCompleted) {
        const diff = holeStrokes - holePar;
        runningTotal += holeStrokes;
        runningPar += holePar;
        
        // Score value with background indicator
        let scoreBg = '#555555';
        let scoreColor = '#ffffff';
        if (diff < -1) {
          scoreBg = '#FFD700'; // Gold for eagle+
          scoreColor = '#000000';
        } else if (diff === -1) {
          scoreBg = '#4CAF50'; // Green for birdie
          scoreColor = '#ffffff';
        } else if (diff === 0) {
          scoreBg = '#2196F3'; // Blue for par
          scoreColor = '#ffffff';
        } else if (diff === 1) {
          scoreBg = '#FF9800'; // Orange for bogey
          scoreColor = '#000000';
        } else {
          scoreBg = '#f44336'; // Red for double+
          scoreColor = '#ffffff';
        }
        
        // Score circle background
        ctx.beginPath();
        ctx.arc(col3, rowY + 12, 14, 0, Math.PI * 2);
        ctx.fillStyle = scoreBg;
        ctx.fill();
        
        ctx.fillStyle = scoreColor;
        ctx.font = 'bold 16px Arial';
        ctx.fillText(`${holeStrokes}`, col3, rowY + 17);
        
        // +/- indicator
        let diffStr: string;
        if (diff < 0) {
          ctx.fillStyle = '#4CAF50';
          diffStr = `${diff}`;
        } else if (diff === 0) {
          ctx.fillStyle = '#87CEEB';
          diffStr = 'E';
        } else {
          ctx.fillStyle = '#FF6B6B';
          diffStr = `+${diff}`;
        }
        ctx.font = 'bold 14px Arial';
        ctx.fillText(diffStr, col4, rowY + 17);
        
      } else if (isCurrentHole && this.strokes > 0) {
        // Current hole in progress
        ctx.beginPath();
        ctx.arc(col3, rowY + 12, 14, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 0, 0.3)';
        ctx.fill();
        ctx.strokeStyle = '#FFFF00';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        ctx.fillStyle = '#FFFF00';
        ctx.font = 'bold 16px Arial';
        ctx.fillText(`${this.strokes}`, col3, rowY + 17);
        
        ctx.fillStyle = '#666666';
        ctx.font = '14px Arial';
        ctx.fillText('...', col4, rowY + 17);
      } else {
        // Not yet played
        ctx.fillStyle = '#444444';
        ctx.font = '14px Arial';
        ctx.fillText('-', col3, rowY + 17);
        ctx.fillText('-', col4, rowY + 17);
      }
    }
    
    // ===== TOTALS SECTION =====
    const totalsY = rowsStartY + 9 * rowHeight + 5;
    
    // Divider line
    ctx.strokeStyle = '#D4AF37';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cardX + 15, totalsY - 10);
    ctx.lineTo(cardX + cardWidth - 15, totalsY - 10);
    ctx.stroke();
    
    // Totals background
    ctx.fillStyle = 'rgba(212, 175, 55, 0.15)';
    ctx.fillRect(cardX + 8, totalsY - 5, cardWidth - 16, 35);
    
    // TOTAL label
    ctx.fillStyle = '#D4AF37';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('TOTAL', col1 + 10, totalsY + 17);
    
    // Total par
    const totalPar = COURSES.reduce((s, c) => s + c.par, 0);
    ctx.fillStyle = '#90EE90';
    ctx.font = 'bold 16px Arial';
    ctx.fillText(`${totalPar}`, col2, totalsY + 17);
    
    // Total strokes
    if (this.strokesPerHole.length > 0) {
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 18px Arial';
      ctx.fillText(`${runningTotal}`, col3, totalsY + 18);
      
      // Total +/-
      const totalDiff = runningTotal - runningPar;
      if (totalDiff < 0) {
        ctx.fillStyle = '#4CAF50';
      } else if (totalDiff === 0) {
        ctx.fillStyle = '#87CEEB';
      } else {
        ctx.fillStyle = '#FF6B6B';
      }
      ctx.font = 'bold 16px Arial';
      const totalDiffStr = totalDiff === 0 ? 'E' : (totalDiff > 0 ? `+${totalDiff}` : `${totalDiff}`);
      ctx.fillText(totalDiffStr, col4, totalsY + 17);
    }
    
    // ===== FOOTER/LEGEND =====
    const legendY = totalsY + 45;
    
    ctx.fillStyle = '#888888';
    ctx.font = '9px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('🟡 Eagle  🟢 Birdie  🔵 Par  🟠 Bogey  🔴 Double+', cardX + cardWidth / 2, legendY);
    
    // Course name at bottom
    const course = COURSES[this.currentHole];
    if (course) {
      ctx.fillStyle = '#D4AF37';
      ctx.font = 'italic 11px Arial';
      ctx.fillText(`"${course.name}"`, cardX + cardWidth / 2, legendY + 18);
    }
  }

  // Helper method to draw rounded rectangles
  private roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  // Helper for rounded top corners only
  private roundRectTop(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x, y + h);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  private renderStatsScreen(ctx: CanvasRenderingContext2D): void {
    const centerX = this.canvas.width / 2;
    
    // Title with decorative elements
    ctx.fillStyle = '#D4AF37';
    ctx.font = 'bold 28px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('⛳ ROUND COMPLETE ⛳', centerX, 50);
    
    // Decorative line under title
    ctx.strokeStyle = '#D4AF37';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(centerX - 150, 60);
    ctx.lineTo(centerX + 150, 60);
    ctx.stroke();
    
    // Stats card background
    const cardX = 40;
    const cardY = 80;
    const cardWidth = this.canvas.width - 80;
    const cardHeight = 420;
    
    // Card with gradient
    const cardGrad = ctx.createLinearGradient(cardX, cardY, cardX, cardY + cardHeight);
    cardGrad.addColorStop(0, 'rgba(30, 50, 30, 0.98)');
    cardGrad.addColorStop(1, 'rgba(20, 35, 20, 0.98)');
    ctx.fillStyle = cardGrad;
    this.roundRect(ctx, cardX, cardY, cardWidth, cardHeight, 15);
    ctx.fill();
    
    // Card border
    ctx.strokeStyle = '#D4AF37';
    ctx.lineWidth = 3;
    this.roundRect(ctx, cardX, cardY, cardWidth, cardHeight, 15);
    ctx.stroke();
    
    // Calculate stats
    const totalPar = COURSES.reduce((s, c) => s + c.par, 0);
    const scoreVsPar = this.totalStrokes - totalPar;
    const holeInOnes = this.strokesPerHole.filter(s => s === 1).length;
    const eagles = this.strokesPerHole.filter((s, i) => s <= COURSES[i].par - 2).length;
    const birdies = this.strokesPerHole.filter((s, i) => s === COURSES[i].par - 1).length;
    const pars = this.strokesPerHole.filter((s, i) => s === COURSES[i].par).length;
    const bogeys = this.strokesPerHole.filter((s, i) => s === COURSES[i].par + 1).length;
    const doublePlus = this.strokesPerHole.filter((s, i) => s >= COURSES[i].par + 2).length;
    
    // Main score display - big and centered
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 64px Arial';
    ctx.fillText(`${this.totalStrokes}`, centerX, 160);
    
    ctx.font = '16px Arial';
    ctx.fillStyle = '#888888';
    ctx.fillText('TOTAL STROKES', centerX, 185);
    
    // Score vs Par - prominent display
    ctx.font = 'bold 32px Arial';
    if (scoreVsPar < 0) {
      ctx.fillStyle = '#4CAF50';
      ctx.fillText(`${scoreVsPar} UNDER PAR! 🏆`, centerX, 230);
    } else if (scoreVsPar === 0) {
      ctx.fillStyle = '#87CEEB';
      ctx.fillText('EVEN PAR!', centerX, 230);
    } else {
      ctx.fillStyle = '#FF6B6B';
      ctx.fillText(`+${scoreVsPar} OVER PAR`, centerX, 230);
    }
    
    // Divider
    ctx.strokeStyle = '#555555';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cardX + 30, 250);
    ctx.lineTo(cardX + cardWidth - 30, 250);
    ctx.stroke();
    
    // Stats grid - 2 columns, 3 rows
    const statStartY = 280;
    const col1X = centerX - 90;
    const col2X = centerX + 90;
    const rowSpacing = 55;
    
    // Helper function to draw stat
    const drawStat = (x: number, y: number, label: string, value: number, color: string) => {
      ctx.fillStyle = color;
      ctx.font = 'bold 36px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(`${value}`, x, y);
      
      ctx.fillStyle = '#888888';
      ctx.font = '12px Arial';
      ctx.fillText(label, x, y + 18);
    };
    
    // Row 1
    drawStat(col1X, statStartY, 'HOLE-IN-ONES', holeInOnes, holeInOnes > 0 ? '#FFD700' : '#666666');
    drawStat(col2X, statStartY, 'EAGLES', eagles, eagles > 0 ? '#FFD700' : '#666666');
    
    // Row 2
    drawStat(col1X, statStartY + rowSpacing, 'BIRDIES', birdies, '#4CAF50');
    drawStat(col2X, statStartY + rowSpacing, 'PARS', pars, '#2196F3');
    
    // Row 3
    drawStat(col1X, statStartY + rowSpacing * 2, 'BOGEYS', bogeys, '#FF9800');
    drawStat(col2X, statStartY + rowSpacing * 2, 'DOUBLE+', doublePlus, '#f44336');
    
    // Divider before coins
    ctx.strokeStyle = '#D4AF37';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cardX + 30, statStartY + rowSpacing * 2 + 40);
    ctx.lineTo(cardX + cardWidth - 30, statStartY + rowSpacing * 2 + 40);
    ctx.stroke();
    
    // Coins earned - big display
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 28px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`💰 ${this.coinsThisRound} COINS EARNED! 💰`, centerX, statStartY + rowSpacing * 2 + 80);
    
    // Continue prompt at bottom
    ctx.fillStyle = '#ffffff';
    ctx.font = '18px Arial';
    const pulse = 0.5 + Math.sin(Date.now() / 300) * 0.5;
    ctx.globalAlpha = pulse;
    ctx.fillText('TAP OR CLICK TO CONTINUE', centerX, this.canvas.height - 30);
    ctx.globalAlpha = 1;
    
    // Hacktivate Nations branding at bottom of card
    ctx.fillStyle = '#555555';
    ctx.font = 'italic 11px Arial';
    ctx.fillText('HACKTIVATE NATIONS RETRO ARCADE', centerX, cardY + cardHeight - 15);
  }

  private renderCompleteScreen(ctx: CanvasRenderingContext2D): void {
    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;
    
    // Big thank you message
    ctx.fillStyle = '#D4AF37';
    ctx.font = 'bold 36px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('🏌️ THANKS FOR PLAYING! 🏌️', centerX, centerY - 60);
    
    // Final score summary
    const totalPar = COURSES.reduce((sum, c) => sum + c.par, 0);
    const scoreVsPar = this.totalStrokes - totalPar;
    
    ctx.fillStyle = '#ffffff';
    ctx.font = '24px Arial';
    ctx.fillText(`Final Score: ${this.totalStrokes} strokes`, centerX, centerY);
    
    if (scoreVsPar < 0) {
      ctx.fillStyle = '#4CAF50';
    } else if (scoreVsPar === 0) {
      ctx.fillStyle = '#87CEEB';
    } else {
      ctx.fillStyle = '#FF6B6B';
    }
    ctx.font = 'bold 28px Arial';
    const scoreText = scoreVsPar === 0 ? 'EVEN PAR' : 
                      (scoreVsPar < 0 ? `${Math.abs(scoreVsPar)} UNDER PAR! 🏆` : `${scoreVsPar} OVER PAR`);
    ctx.fillText(scoreText, centerX, centerY + 40);
    
    // Coins earned
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 22px Arial';
    ctx.fillText(`💰 ${this.coinsThisRound} Coins`, centerX, centerY + 90);
    
    // Branding
    ctx.fillStyle = '#555555';
    ctx.font = 'italic 12px Arial';
    ctx.fillText('HACKTIVATE NATIONS RETRO ARCADE', centerX, this.canvas.height - 30);
  }

  restart(): void {
    this.currentHole = 0;
    this.totalStrokes = 0;
    this.strokesPerHole = [];
    this.coinsThisRound = 0;
    this.score = 0;
    this.pickups = 0;
    this.phase = 'aiming';
    this.celebrationTimer = 0;
    this.messageTimer = 0;
    this.nextHoleTimer = 0;
    this.isRunning = true;
    
    this.setupHole(0);
  }

  protected onDestroy(): void {
    // Remove event listeners
    this.canvas.removeEventListener('mousedown', this.handlePointerDown.bind(this));
    this.canvas.removeEventListener('mousemove', this.handlePointerMove.bind(this));
    this.canvas.removeEventListener('mouseup', this.handlePointerUp.bind(this));
    this.canvas.removeEventListener('mouseleave', this.handlePointerUp.bind(this));
    this.canvas.removeEventListener('touchstart', this.handleTouchStart.bind(this));
    this.canvas.removeEventListener('touchmove', this.handleTouchMove.bind(this));
    this.canvas.removeEventListener('touchend', this.handleTouchEnd.bind(this));
  }
}
