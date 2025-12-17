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

type GamePhase = 'aiming' | 'rolling' | 'sinking' | 'nextHole' | 'complete';

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
    
    // Normalize and apply power
    const dist = Math.sqrt(dx * dx + dy * dy);
    const vx = (dx / dist) * power * 3;
    const vy = (dy / dist) * power * 3;
    
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
    
    // Apply wind
    const windForce = this.wind.getForce();
    this.ball.vx += windForce.x * dt;
    this.ball.vy += windForce.y * dt;
    
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
    
    // Check if ball stopped
    if (this.ball.isStopped()) {
      this.phase = 'aiming';
      this.particles.emit(this.ball.x, this.ball.y, 3, '#ffffff', 'dust');
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
        this.phase = 'complete';
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
    
    let scoreMessage: string;
    if (scoreVsPar < 0) {
      scoreMessage = `${Math.abs(scoreVsPar)} Under Par! 🏆`;
      this.coinsThisRound += Math.abs(scoreVsPar) * 20;
    } else if (scoreVsPar === 0) {
      scoreMessage = 'Even Par!';
    } else {
      scoreMessage = `${scoreVsPar} Over Par`;
    }
    
    this.showMessage(`Final: ${this.totalStrokes} - ${scoreMessage}`, 5);
    
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
    
    // End the game
    this.endGame();
  }

  protected onRender(ctx: CanvasRenderingContext2D): void {
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
    this.hole.render(ctx);
    
    // Render ball (unless sinking complete)
    if (this.ball.sinkProgress < 1) {
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
    ctx.fillText(`🪙 ${this.coinsThisRound}`, this.canvas.width - 15, 48);
    
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
    
    // Game complete screen
    if (this.phase === 'complete') {
      this.renderCompleteScreen(ctx);
    }
  }

  private renderCompleteScreen(ctx: CanvasRenderingContext2D): void {
    // Overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Title
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 36px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('🏌️ Round Complete! 🏌️', this.canvas.width / 2, 100);
    
    // Scorecard
    const totalPar = COURSES.reduce((sum, c) => sum + c.par, 0);
    const scoreVsPar = this.totalStrokes - totalPar;
    
    ctx.fillStyle = '#ffffff';
    ctx.font = '24px Arial';
    ctx.fillText(`Total Strokes: ${this.totalStrokes}`, this.canvas.width / 2, 160);
    
    ctx.fillStyle = scoreVsPar <= 0 ? '#90EE90' : '#FF6B6B';
    ctx.font = 'bold 28px Arial';
    const scoreText = scoreVsPar === 0 ? 'Even Par!' : 
                      (scoreVsPar < 0 ? `${Math.abs(scoreVsPar)} Under Par!` : `${scoreVsPar} Over Par`);
    ctx.fillText(scoreText, this.canvas.width / 2, 200);
    
    // Per-hole breakdown
    ctx.fillStyle = '#87CEEB';
    ctx.font = '14px Arial';
    let y = 250;
    for (let i = 0; i < this.strokesPerHole.length; i++) {
      const par = COURSES[i].par;
      const strokes = this.strokesPerHole[i];
      const diff = strokes - par;
      const diffStr = diff === 0 ? 'E' : (diff > 0 ? `+${diff}` : `${diff}`);
      ctx.fillText(`Hole ${i + 1}: ${strokes} (Par ${par}) ${diffStr}`, this.canvas.width / 2, y);
      y += 22;
    }
    
    // Coins earned
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 24px Arial';
    ctx.fillText(`🪙 ${this.coinsThisRound} Coins Earned!`, this.canvas.width / 2, y + 30);
    
    // Hole in ones
    const holeInOnes = this.strokesPerHole.filter(s => s === 1).length;
    if (holeInOnes > 0) {
      ctx.fillStyle = '#FF69B4';
      ctx.font = '20px Arial';
      ctx.fillText(`🎉 ${holeInOnes} Hole-in-One${holeInOnes > 1 ? 's' : ''}!`, this.canvas.width / 2, y + 60);
    }
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