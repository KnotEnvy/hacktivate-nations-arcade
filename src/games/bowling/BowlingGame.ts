// ===== src/games/bowling/BowlingGame.ts =====
// Retro Strike Bowling - A Tier 2 physics-based bowling game
//
// 7 Key Features:
// 1. Arcade-Style Input - position, aim, power, spin click sequence
// 2. Multi-Body Pin Physics - pins knock each other down
// 3. Lane Physics - oil patterns affect ball behavior
// 4. 10-Frame Scoring - classic bowling rules
// 5. Visual Polish - reflections, shadows, camera shake
// 6. Particle Effects - impacts, celebrations
// 7. Combo Rewards - Turkey, Clean Game tracking

import { BaseGame } from '@/games/shared/BaseGame';
import { GameManifest, GameScore } from '@/lib/types';

import { BowlingBall } from './entities/Ball';
import { Pin } from './entities/Pin';
import { Lane } from './entities/Lane';
import { AimIndicator, InputPhase } from './entities/AimIndicator';

import { PhysicsSystem, CollisionEvent } from './systems/PhysicsSystem';
import { ScoreSystem, ScoreResult } from './systems/ScoreSystem';
import { ParticleSystem } from './systems/ParticleSystem';

type GamePhase = 'setup' | 'aiming' | 'rolling' | 'settling' | 'scoring' | 'pinReset' | 'nextFrame' | 'stats' | 'complete';

export class BowlingGame extends BaseGame {
  manifest: GameManifest = {
    id: 'bowling',
    title: 'Retro Strike',
    thumbnail: '/games/bowling/bowling-thumb.svg',
    inputSchema: ['keyboard', 'touch'],
    assetBudgetKB: 100,
    tier: 2,
    description: 'Master the lanes with physics-based bowling! Features realistic pin action, oil patterns, and classic 10-frame scoring.'
  };

  // Game objects
  private ball!: BowlingBall;
  private pins: Pin[] = [];
  private lane!: Lane;
  private aimIndicator!: AimIndicator;

  // Systems
  private physics!: PhysicsSystem;
  private scoreSystem!: ScoreSystem;
  private particles!: ParticleSystem;

  // Game state
  private phase: GamePhase = 'setup';
  private settleTimer: number = 0;
  private phaseTimer: number = 0;

  // Input tracking - new arcade style
  private keysPressed: Set<string> = new Set();
  private keyRepeatTimer: number = 0;
  private readonly KEY_REPEAT_DELAY = 0.15; // seconds between key repeats

  // Visual effects
  private screenShake: { x: number; y: number; intensity: number; angle: number } = { x: 0, y: 0, intensity: 0, angle: 0 };
  private messageText: string = '';
  private messageTimer: number = 0;
  private celebrationTimer: number = 0;

  // NEW: Slow-motion effect for dramatic moments
  private slowMotionTimer: number = 0;
  private slowMotionScale: number = 1; // 1 = normal speed, 0.3 = slow

  // NEW: Track pins knocked during current roll for real-time feedback
  private pinsKnockedThisRoll: number = 0;
  private firstPinHitThisRoll: boolean = false;

  // NEW: Pin setter animation state
  private pinSetterY: number = -100; // Y position of pin setter mechanism
  private pinSetterPhase: 'descending' | 'sweeping' | 'ascending' | 'done' = 'done';
  private pinSetterTimer: number = 0;
  private fallenPinPositions: { x: number; y: number; rotation: number }[] = []; // Store fallen pin positions for sweep
  private standingPinNumbers: number[] = []; // Which pins to reset after sweep

  // Game stats
  private totalStrikes: number = 0;
  private totalSpares: number = 0;
  private gutterBalls: number = 0;
  private maxConsecutiveStrikes: number = 0;

  // Constants - TUNED for better pin physics
  private readonly MAX_BALL_SPEED = 180; // Reduced from 600 for realistic feel
  private readonly SETTLE_TIMEOUT = 3; // Max seconds to wait for settling

  protected renderBaseHud: boolean = false;

  protected onInit(): void {
    // Initialize lane
    this.lane = new Lane(this.canvas.width, this.canvas.height);

    // Initialize systems
    this.physics = new PhysicsSystem(this.lane);
    this.scoreSystem = new ScoreSystem();
    this.particles = new ParticleSystem();

    // Initialize aim indicator with lane dimensions
    this.aimIndicator = new AimIndicator();
    this.aimIndicator.initialize(this.lane.x, this.lane.width, this.lane.height);

    // Setup first frame
    this.setupFrame();

    // Bind input handlers
    this.setupInputHandlers();

    // Show intro message
    this.showMessage('Frame 1 - Good Luck!', 2);
  }

  private setupInputHandlers(): void {
    // Mouse/click events
    this.canvas.addEventListener('mousedown', this.handleClick.bind(this));
    this.canvas.addEventListener('touchstart', this.handleTouchStart.bind(this));

    // Keyboard events
    window.addEventListener('keydown', this.handleKeyDown.bind(this));
    window.addEventListener('keyup', this.handleKeyUp.bind(this));
  }

  private handleClick(e: MouseEvent): void {
    e.preventDefault();

    // Handle stats screen click
    if (this.phase === 'stats') {
      this.phase = 'complete';
      this.endGame();
      return;
    }

    if (this.phase !== 'aiming') return;

    // Get click position for touch-based position movement
    const rect = this.canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (this.canvas.width / rect.width);

    // During positioning phase, check if clicking left/right sides
    if (this.aimIndicator.getPhase() === 'positioning') {
      const ballX = this.aimIndicator.getBallX();
      if (x < ballX - 30) {
        this.aimIndicator.moveLeft();
        this.services?.audio?.playSound?.('bounce');
        return;
      } else if (x > ballX + 30) {
        this.aimIndicator.moveRight();
        this.services?.audio?.playSound?.('bounce');
        return;
      }
    }

    // Advance through input phases
    this.advanceInputPhase();
  }

  private handleTouchStart(e: TouchEvent): void {
    e.preventDefault();

    // Handle stats screen tap
    if (this.phase === 'stats') {
      this.phase = 'complete';
      this.endGame();
      return;
    }

    if (this.phase !== 'aiming' || e.touches.length === 0) return;

    const touch = e.touches[0];
    const rect = this.canvas.getBoundingClientRect();
    const x = (touch.clientX - rect.left) * (this.canvas.width / rect.width);

    // During positioning phase, check if tapping left/right sides
    if (this.aimIndicator.getPhase() === 'positioning') {
      const ballX = this.aimIndicator.getBallX();
      if (x < ballX - 30) {
        this.aimIndicator.moveLeft();
        this.services?.audio?.playSound?.('bounce');
        return;
      } else if (x > ballX + 30) {
        this.aimIndicator.moveRight();
        this.services?.audio?.playSound?.('bounce');
        return;
      }
    }

    // Advance through input phases
    this.advanceInputPhase();
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if (this.phase !== 'aiming') return;

    const key = e.key.toLowerCase();

    // Track key press for repeating
    if (!this.keysPressed.has(key)) {
      this.keysPressed.add(key);
      this.keyRepeatTimer = 0;

      // Immediate action on first press
      this.processKeyInput(key, true);
    }
  }

  private handleKeyUp(e: KeyboardEvent): void {
    const key = e.key.toLowerCase();
    this.keysPressed.delete(key);
  }

  private processKeyInput(key: string, isFirstPress: boolean): void {
    // Position movement (only during positioning phase)
    if (this.aimIndicator.getPhase() === 'positioning') {
      if (key === 'arrowleft' || key === 'a') {
        if (this.aimIndicator.moveLeft()) {
          this.services?.audio?.playSound?.('bounce');
        }
        return;
      }
      if (key === 'arrowright' || key === 'd') {
        if (this.aimIndicator.moveRight()) {
          this.services?.audio?.playSound?.('bounce');
        }
        return;
      }
    }

    // Confirm/advance input (space or enter) - only on first press
    if (isFirstPress && (key === ' ' || key === 'enter')) {
      this.advanceInputPhase();
    }
  }

  private advanceInputPhase(): void {
    const handled = this.aimIndicator.handleClick();

    if (handled) {
      this.services?.audio?.playSound?.('bounce');
    }

    // Check if ready to throw
    if (this.aimIndicator.isReadyToThrow()) {
      this.executeThrow();
    }
  }

  private executeThrow(): void {
    // Get velocity from aim indicator
    const { vx, vy, spin } = this.aimIndicator.getVelocity(this.MAX_BALL_SPEED);
    const params = this.aimIndicator.getThrowParameters();

    // Minimum power threshold
    if (params.power < 0.1) {
      this.showMessage('Too weak! Try again.', 1.5);
      this.aimIndicator.reset();
      return;
    }

    // Update ball position to selected position
    this.ball.x = params.position;

    // Apply velocity to ball
    this.ball.vx = vx;
    this.ball.vy = vy;
    this.ball.spin = spin;

    // Transition to rolling phase
    this.phase = 'rolling';

    // Play throw sound
    this.services?.audio?.playSound?.('hit');

    // Add particles at ball
    this.particles.emit(this.ball.x, this.ball.y, 8, '#ffffff', 'spark');

    // Reset aim indicator for next throw
    this.aimIndicator.reset();
  }

  private setupFrame(): void {
    // Get start position from lane
    const startPos = this.lane.getBallStartPosition();

    // Initialize or reset ball
    if (!this.ball) {
      this.ball = new BowlingBall(startPos.x, startPos.y);
    } else {
      this.ball.reset(startPos.x, startPos.y);
    }

    // Initialize aim indicator with ball Y position
    this.aimIndicator.initialize(this.lane.x, this.lane.width, this.lane.height);
    this.aimIndicator.setBallY(startPos.y);

    // Setup pins based on current roll
    const standingPins = this.scoreSystem.getStandingPins();

    // Only reset pins on first roll of frame
    if (this.scoreSystem.getCurrentRoll() === 0) {
      this.pins = [];
      const pinPositions = this.lane.getPinPositions();
      for (const pos of pinPositions) {
        this.pins.push(new Pin(pos.x, pos.y, pos.pinNumber));
      }
    } else {
      // Second roll - only reset pins that were standing
      for (const pin of this.pins) {
        if (standingPins[pin.pinNumber - 1]) {
          pin.reset();
        }
      }
      // Reset ball position
      this.ball.reset(startPos.x, startPos.y);
    }

    this.phase = 'aiming';
    this.settleTimer = 0;

    // Reset per-roll tracking
    this.pinsKnockedThisRoll = 0;
    this.firstPinHitThisRoll = false;
    this.slowMotionTimer = 0;
    this.slowMotionScale = 1;
  }

  private showMessage(text: string, duration: number): void {
    this.messageText = text;
    this.messageTimer = duration;
  }

  protected onUpdate(dt: number): void {
    // Update timers
    if (this.messageTimer > 0) this.messageTimer -= dt;
    if (this.celebrationTimer > 0) this.celebrationTimer -= dt;
    this.phaseTimer += dt;

    // Update screen shake - enhanced with directional component
    if (this.screenShake.intensity > 0) {
      const shakeAngle = this.screenShake.angle + (Math.random() - 0.5) * 0.5;
      this.screenShake.x = Math.cos(shakeAngle) * this.screenShake.intensity * 12;
      this.screenShake.y = Math.sin(shakeAngle) * this.screenShake.intensity * 12;
      this.screenShake.intensity *= 0.88;
      if (this.screenShake.intensity < 0.01) {
        this.screenShake = { x: 0, y: 0, intensity: 0, angle: 0 };
      }
    }

    // Update slow-motion effect
    if (this.slowMotionTimer > 0) {
      this.slowMotionTimer -= dt;
      // Ease in and out of slow motion
      if (this.slowMotionTimer > 0.3) {
        this.slowMotionScale = 0.25; // Full slow-mo
      } else {
        this.slowMotionScale = 0.25 + (0.3 - this.slowMotionTimer) / 0.3 * 0.75; // Ease out
      }
    } else {
      this.slowMotionScale = 1;
    }

    // Update particles
    this.particles.update(dt);

    // Update aim indicator
    this.aimIndicator.update(dt);

    // Handle key repeat for positioning
    if (this.phase === 'aiming' && this.aimIndicator.getPhase() === 'positioning') {
      this.updateKeyRepeat(dt);
    }

    // Phase-specific updates
    switch (this.phase) {
      case 'aiming':
        this.updateAiming(dt);
        break;
      case 'rolling':
        this.updateRolling(dt);
        break;
      case 'settling':
        this.updateSettling(dt);
        break;
      case 'scoring':
        this.updateScoring(dt);
        break;
      case 'pinReset':
        this.updatePinReset(dt);
        break;
      case 'nextFrame':
        this.updateNextFrame(dt);
        break;
      case 'stats':
        // Wait for click
        break;
    }
  }

  private updateKeyRepeat(dt: number): void {
    if (this.keysPressed.size === 0) return;

    this.keyRepeatTimer += dt;
    if (this.keyRepeatTimer >= this.KEY_REPEAT_DELAY) {
      this.keyRepeatTimer = 0;

      // Process held keys
      for (const key of this.keysPressed) {
        if (key === 'arrowleft' || key === 'a' || key === 'arrowright' || key === 'd') {
          this.processKeyInput(key, false);
        }
      }
    }
  }

  private updateAiming(dt: number): void {
    // Update ball position to match aim indicator during positioning
    if (this.aimIndicator.getPhase() === 'positioning' ||
      this.aimIndicator.getPhase() === 'aiming' ||
      this.aimIndicator.getPhase() === 'power' ||
      this.aimIndicator.getPhase() === 'spin') {
      this.ball.x = this.aimIndicator.getBallX();
    }
  }

  private updateRolling(dt: number): void {
    // Apply slow-motion scaling to delta time
    const effectiveDt = dt * this.slowMotionScale;

    // Run physics
    const events = this.physics.update(this.ball, this.pins, effectiveDt);

    // Process collision events
    for (const event of events) {
      this.handleCollisionEvent(event);
    }

    // Check if ball reached pins or went to gutter
    if (this.ball.reachedPins || this.ball.inGutter) {
      // Continue rolling until ball passes pins
      if (this.ball.y < this.lane.pinDeckY - 50 || this.ball.isStopped()) {
        this.phase = 'settling';
        this.settleTimer = 0;
      }
    }

    // Gutter message
    if (this.ball.inGutter && !this.ball.reachedPins) {
      this.particles.emitGutter(this.ball.x, this.ball.y);
    }
  }

  private updateSettling(dt: number): void {
    // Apply slow-motion scaling
    const effectiveDt = dt * this.slowMotionScale;

    // Continue physics while pins settle
    const events = this.physics.update(this.ball, this.pins, effectiveDt);

    for (const event of events) {
      this.handleCollisionEvent(event);
    }

    this.settleTimer += dt; // Use real dt for timeout

    // Check if settled or timeout
    if (this.physics.isSettled(this.ball, this.pins) || this.settleTimer > this.SETTLE_TIMEOUT) {
      this.phase = 'scoring';
      this.phaseTimer = 0;
    }
  }

  private updateScoring(dt: number): void {
    // Small delay before showing score
    if (this.phaseTimer < 0.5) return;

    // Determine which pins were knocked - indexed by PIN NUMBER (1-10 -> 0-9)
    // IMPORTANT: Must use pinNumber as index, not array position
    const knockedPins = new Array(10).fill(false);
    for (const pin of this.pins) {
      knockedPins[pin.pinNumber - 1] = !pin.standing;
    }

    // Record the roll
    const result = this.scoreSystem.recordRoll(knockedPins);

    // Handle result
    this.handleScoreResult(result);

    // Move to next phase
    if (result.gameComplete) {
      this.finishGame();
    } else if (result.frameComplete) {
      this.phase = 'nextFrame';
      this.phaseTimer = 0;
    } else {
      // Second roll - start pin setter animation
      this.startPinResetAnimation();
    }
  }

  // Start the pin setter animation for second ball
  private startPinResetAnimation(): void {
    // Get standing pins from SCORE SYSTEM (important for 10th frame)
    // After a strike/spare in 10th frame, ScoreSystem resets standingPins to all true
    const scoreSystemStandingPins = this.scoreSystem.getStandingPins();

    // Store positions of fallen pins for sweep animation
    this.fallenPinPositions = [];
    this.standingPinNumbers = [];

    for (const pin of this.pins) {
      // A pin should be reset if the ScoreSystem says it's standing
      if (scoreSystemStandingPins[pin.pinNumber - 1]) {
        this.standingPinNumbers.push(pin.pinNumber);
      } else {
        // This pin was knocked and stays knocked
        this.fallenPinPositions.push({ x: pin.x, y: pin.y, rotation: pin.rotation });
      }
    }

    // Start animation
    this.pinSetterY = -100;
    this.pinSetterPhase = 'descending';
    this.pinSetterTimer = 0;
    this.phase = 'pinReset';
    this.phaseTimer = 0;

    // Play mechanical sound
    this.services?.audio?.playSound?.('pin_scatter');
  }

  private updatePinReset(dt: number): void {
    this.pinSetterTimer += dt;
    const targetY = this.lane.pinDeckY + 50; // Where pin setter stops

    switch (this.pinSetterPhase) {
      case 'descending':
        // Pin setter comes down
        this.pinSetterY += 400 * dt; // Speed of descent
        if (this.pinSetterY >= targetY) {
          this.pinSetterY = targetY;
          this.pinSetterPhase = 'sweeping';
          this.pinSetterTimer = 0;
          // Clear fallen pins from display
          for (const pin of this.pins) {
            if (!pin.standing) {
              // Move fallen pins off-screen (swept away)
              pin.x = -100;
              pin.y = -100;
            }
          }
          this.services?.audio?.playSound?.('bounce');
        }
        break;

      case 'sweeping':
        // Brief pause while pins are "swept"
        if (this.pinSetterTimer > 0.4) {
          this.pinSetterPhase = 'ascending';
          this.pinSetterTimer = 0;
          // Reset pins that should be standing (based on ScoreSystem)
          // This properly handles 10th frame strikes/spares where ALL pins reset
          for (const pin of this.pins) {
            if (this.standingPinNumbers.includes(pin.pinNumber)) {
              // Use pin.reset() to fully restore standing state
              pin.reset();
            } else {
              // Move knocked pins off-screen
              pin.x = -100;
              pin.y = -100;
            }
          }
        }
        break;

      case 'ascending':
        // Pin setter goes back up
        this.pinSetterY -= 400 * dt;
        if (this.pinSetterY <= -100) {
          this.pinSetterY = -100;
          this.pinSetterPhase = 'done';
          // Now actually setup for second ball
          this.setupFrameAfterPinReset();
        }
        break;
    }
  }

  // Setup frame after pin reset animation completes
  private setupFrameAfterPinReset(): void {
    // Get start position from lane
    const startPos = this.lane.getBallStartPosition();
    this.ball.reset(startPos.x, startPos.y);

    // Reset aim indicator
    this.aimIndicator.initialize(this.lane.x, this.lane.width, this.lane.height);
    this.aimIndicator.setBallY(startPos.y);

    this.phase = 'aiming';
    this.settleTimer = 0;

    // Reset per-roll tracking
    this.pinsKnockedThisRoll = 0;
    this.firstPinHitThisRoll = false;
    this.slowMotionTimer = 0;
    this.slowMotionScale = 1;

    // Show correct ball number (handles 10th frame 2nd/3rd balls)
    const rollNum = this.scoreSystem.getCurrentRoll() + 1;
    const suffix = rollNum === 2 ? '2nd' : '3rd';
    this.showMessage(`${suffix} Ball`, 1);
  }

  private updateNextFrame(dt: number): void {
    if (this.phaseTimer > 2) {
      this.setupFrame();
      this.showMessage(`Frame ${this.scoreSystem.getCurrentFrame() + 1}`, 1.5);
    }
  }

  private handleCollisionEvent(event: CollisionEvent): void {
    switch (event.type) {
      case 'ball-pin':
        // Enhanced impact effects
        this.particles.emitPinImpact(event.position.x, event.position.y, event.intensity);

        // Add shockwave on big impacts
        if (event.intensity > 0.6) {
          this.particles.emitShockwave(event.position.x, event.position.y, event.intensity);
        }

        // Directional screen shake based on collision
        this.screenShake.angle = Math.atan2(this.ball.vy, this.ball.vx);
        this.screenShake.intensity = Math.max(this.screenShake.intensity, event.intensity * 0.6);

        // Track pins hit for slow-mo trigger
        this.pinsKnockedThisRoll++;

        // Trigger slow-motion on first big impact (potential strike)
        if (!this.firstPinHitThisRoll && event.intensity > 0.6) {
          this.firstPinHitThisRoll = true;
          // Only trigger slow-mo on first ball (potential strike)
          if (this.scoreSystem.getCurrentRoll() === 0) {
            this.slowMotionTimer = 0.5; // Half second of slow-mo
          }
        }

        // Use pin_hit for satisfying crack/clatter sound
        this.services?.audio?.playSound?.('pin_hit');
        // If high intensity collision, also play pin scatter for dramatic effect
        if (event.intensity > 0.7) {
          this.services?.audio?.playSound?.('pin_scatter');
        }
        break;
      case 'pin-pin':
        if (event.intensity > 0.3) {
          // Use splinter particles for pin-pin collisions too
          this.particles.emit(event.position.x, event.position.y, 4, '#D4A574', 'splinter');
          // Use bounce for lighter pin-pin collisions
          this.services?.audio?.playSound?.('bounce');
        }
        break;
      case 'gutter':
        this.gutterBalls++;
        // Play gutter sound for disappointed thud
        this.services?.audio?.playSound?.('gutter');
        break;
    }
  }

  private handleScoreResult(result: ScoreResult): void {
    const pinCenterX = this.lane.x + this.lane.width / 2;
    const pinCenterY = this.lane.pinDeckY + 60;

    // STRIKE - happens on first ball when all 10 pins knocked
    if (result.isStrike) {
      this.totalStrikes++;
      this.maxConsecutiveStrikes = Math.max(this.maxConsecutiveStrikes, this.scoreSystem.getConsecutiveStrikes());
      this.showMessage('STRIKE!', 2);
      this.particles.emitStrike(pinCenterX, pinCenterY);
      this.screenShake.intensity = 1;
      this.celebrationTimer = 2;
      this.services?.audio?.playSound?.('win');
      this.pickups += 10;

      if (result.bonusMessage === 'TURKEY!') {
        this.particles.emitTurkey(pinCenterX, pinCenterY);
        this.showMessage('TURKEY!!!', 2.5);
        this.pickups += 25;
      } else if (result.bonusMessage) {
        this.showMessage(result.bonusMessage, 2);
        this.pickups += 15;
      }
    }
    // SPARE - only happens on second ball when remaining pins knocked
    else if (result.isSpare) {
      this.totalSpares++;
      this.showMessage('SPARE!', 1.5);
      this.particles.emitSpare(pinCenterX, pinCenterY);
      this.screenShake.intensity = 0.5;
      this.services?.audio?.playSound?.('powerup');
      this.pickups += 5;
    }
    // GUTTER - only on first ball (gutter on second ball is just a miss)
    else if (result.isGutter) {
      this.showMessage('Gutter Ball!', 1.5);
    }
    // SPLIT - detected after first ball, but only show message if significant
    // (Don't overwhelm player with "Split!" on easy leaves)
    else if (result.isSplit && result.pinsKnocked >= 5) {
      this.showMessage('Split!', 1.5);
    }
    // Show pins knocked for normal throws (second ball, not spare)
    else if (result.frameComplete && !result.isStrike && !result.isSpare && result.pinsKnocked > 0) {
      // Frame ended without spare - open frame
      this.showMessage(`${result.pinsKnocked} pins`, 1);
    }
  }

  private finishGame(): void {
    const totalScore = this.scoreSystem.getTotalScore();
    this.score = totalScore;

    // Bonus coins for performance
    if (totalScore >= 300) {
      this.pickups += 100; // Perfect game!
    } else if (totalScore >= 250) {
      this.pickups += 50;
    } else if (totalScore >= 200) {
      this.pickups += 25;
    } else if (totalScore >= 150) {
      this.pickups += 10;
    }

    // Extended game data for achievements
    this.extendedGameData = {
      totalScore,
      strikes: this.totalStrikes,
      spares: this.totalSpares,
      gutterBalls: this.gutterBalls,
      maxConsecutiveStrikes: this.maxConsecutiveStrikes,
      cleanFrames: this.scoreSystem.getCleanFrames(),
      isPerfectGame: totalScore === 300
    };

    this.phase = 'stats';
    this.phaseTimer = 0;
  }

  protected onRender(ctx: CanvasRenderingContext2D): void {
    // Stats screen
    if (this.phase === 'stats' || this.phase === 'complete') {
      this.renderStatsScreen(ctx);
      return;
    }

    // Apply screen shake
    ctx.save();
    ctx.translate(this.screenShake.x, this.screenShake.y);

    // Render lane
    this.lane.render(ctx);

    // Render ball reflection (when in oil zone)
    this.lane.renderReflections(ctx, this.ball.x, this.ball.y, this.ball.radius);

    // Render pins
    for (const pin of this.pins) {
      pin.render(ctx);
    }

    // Render ball
    this.ball.render(ctx);

    // Render aim indicator (when aiming)
    if (this.phase === 'aiming') {
      this.aimIndicator.render(ctx, this.lane.width);
    }

    // Render particles
    this.particles.render(ctx);

    // Render pin setter mechanism (during pinReset phase)
    if (this.phase === 'pinReset' && this.pinSetterPhase !== 'done') {
      this.renderPinSetter(ctx);
    }

    ctx.restore();

    // Render UI (not affected by shake)
    this.renderGameUI(ctx);
  }

  private renderPinSetter(ctx: CanvasRenderingContext2D): void {
    const laneCenter = this.lane.x + this.lane.width / 2;
    const setterWidth = this.lane.width - 20;
    const setterHeight = 80;

    ctx.save();

    // Draw cables/supports going up from setter
    ctx.strokeStyle = '#444444';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(laneCenter - setterWidth / 2 + 10, this.pinSetterY);
    ctx.lineTo(laneCenter - setterWidth / 2 + 10, this.lane.y - 20);
    ctx.moveTo(laneCenter + setterWidth / 2 - 10, this.pinSetterY);
    ctx.lineTo(laneCenter + setterWidth / 2 - 10, this.lane.y - 20);
    ctx.stroke();

    // Main setter body - metallic gradient
    const gradient = ctx.createLinearGradient(0, this.pinSetterY, 0, this.pinSetterY + setterHeight);
    gradient.addColorStop(0, '#666666');
    gradient.addColorStop(0.3, '#888888');
    gradient.addColorStop(0.5, '#aaaaaa');
    gradient.addColorStop(0.7, '#888888');
    gradient.addColorStop(1, '#555555');

    ctx.fillStyle = gradient;
    ctx.fillRect(laneCenter - setterWidth / 2, this.pinSetterY, setterWidth, setterHeight);

    // Edge highlights
    ctx.strokeStyle = '#cccccc';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(laneCenter - setterWidth / 2, this.pinSetterY);
    ctx.lineTo(laneCenter + setterWidth / 2, this.pinSetterY);
    ctx.stroke();

    // Darker bottom edge
    ctx.strokeStyle = '#333333';
    ctx.beginPath();
    ctx.moveTo(laneCenter - setterWidth / 2, this.pinSetterY + setterHeight);
    ctx.lineTo(laneCenter + setterWidth / 2, this.pinSetterY + setterHeight);
    ctx.stroke();

    // Pin holder slots (the circular holes that hold pins)
    ctx.fillStyle = '#222222';
    const slotRadius = 8;
    const slotY = this.pinSetterY + setterHeight - 15;

    // Draw slots in triangle formation matching pin positions
    const slotSpacing = 18;
    // Back row (4)
    for (let i = -1.5; i <= 1.5; i++) {
      ctx.beginPath();
      ctx.arc(laneCenter + i * slotSpacing, slotY - 45, slotRadius, 0, Math.PI * 2);
      ctx.fill();
    }
    // Row 3 (3)
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.arc(laneCenter + i * slotSpacing, slotY - 27, slotRadius, 0, Math.PI * 2);
      ctx.fill();
    }
    // Row 2 (2)
    for (let i = -0.5; i <= 0.5; i++) {
      ctx.beginPath();
      ctx.arc(laneCenter + i * slotSpacing, slotY - 9, slotRadius, 0, Math.PI * 2);
      ctx.fill();
    }
    // Front row (1 - head pin)
    ctx.beginPath();
    ctx.arc(laneCenter, slotY + 9, slotRadius, 0, Math.PI * 2);
    ctx.fill();

    // Add warning stripes
    ctx.fillStyle = '#FFD700';
    ctx.globalAlpha = 0.3;
    const stripeWidth = 6;
    for (let x = laneCenter - setterWidth / 2; x < laneCenter + setterWidth / 2; x += stripeWidth * 2) {
      ctx.fillRect(x, this.pinSetterY + 2, stripeWidth, 8);
    }
    ctx.globalAlpha = 1;

    // Glow effect when sweeping
    if (this.pinSetterPhase === 'sweeping') {
      ctx.fillStyle = 'rgba(255, 200, 100, 0.3)';
      ctx.fillRect(laneCenter - setterWidth / 2 - 5, this.pinSetterY + setterHeight - 5, setterWidth + 10, 15);
    }

    ctx.restore();
  }

  private renderGameUI(ctx: CanvasRenderingContext2D): void {
    // Top bar
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(0, 0, this.canvas.width, 60);

    // Frame indicator
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`Frame ${this.scoreSystem.getCurrentFrame() + 1}/10`, 15, 35);

    // Roll indicator
    ctx.fillStyle = '#87CEEB';
    ctx.font = '14px Arial';
    const rollText = this.scoreSystem.getCurrentRoll() === 0 ? '1st Ball' : '2nd Ball';
    ctx.fillText(rollText, 15, 52);

    // Current score
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`Score: ${this.scoreSystem.getTotalScore()}`, this.canvas.width / 2 - 60, 40);

    // Coins
    ctx.fillStyle = '#FFD700';
    ctx.font = '16px Arial';
    ctx.textAlign = 'right';
    ctx.fillText(`Coins: ${this.pickups}`, this.canvas.width - 20, 35);

    // Render scorecard on right side
    this.renderScorecard(ctx);

    // Current input phase indicator (during aiming)
    if (this.phase === 'aiming') {
      this.renderInputPhaseIndicator(ctx);
    }

    // Message overlay
    if (this.messageTimer > 0) {
      const alpha = Math.min(1, this.messageTimer);
      ctx.fillStyle = `rgba(0, 0, 0, ${alpha * 0.8})`;
      ctx.fillRect(this.canvas.width / 2 - 150 - 60, this.canvas.height / 2 - 40, 300, 80);

      ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.font = 'bold 28px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(this.messageText, this.canvas.width / 2 - 60, this.canvas.height / 2 + 10);
    }

    // Celebration overlay
    if (this.celebrationTimer > 0) {
      ctx.fillStyle = `rgba(255, 215, 0, ${this.celebrationTimer * 0.1})`;
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  private renderInputPhaseIndicator(ctx: CanvasRenderingContext2D): void {
    const phase = this.aimIndicator.getPhase();
    const phases: InputPhase[] = ['positioning', 'aiming', 'power', 'spin'];
    const phaseLabels = ['POSITION', 'AIM', 'POWER', 'SPIN'];

    const indicatorY = this.canvas.height - 32;
    const indicatorWidth = 85;
    const indicatorHeight = 28;
    const totalWidth = phases.length * indicatorWidth + (phases.length - 1) * 12;
    const startX = (this.canvas.width - totalWidth) / 2 - 60;
    const cornerRadius = 6;

    for (let i = 0; i < phases.length; i++) {
      const x = startX + i * (indicatorWidth + 12);
      const isActive = phases[i] === phase;
      const isComplete = phases.indexOf(phase) > i || phase === 'ready';

      ctx.save();

      // Arcade button shadow/depth
      ctx.beginPath();
      ctx.roundRect(x + 2, indicatorY - indicatorHeight / 2 + 2, indicatorWidth, indicatorHeight, cornerRadius);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fill();

      // Button base with gradient
      ctx.beginPath();
      ctx.roundRect(x, indicatorY - indicatorHeight / 2, indicatorWidth, indicatorHeight, cornerRadius);

      if (isActive) {
        // Active phase - golden glow
        ctx.shadowColor = '#FFD700';
        ctx.shadowBlur = 12;
        const activeGrad = ctx.createLinearGradient(0, indicatorY - indicatorHeight / 2, 0, indicatorY + indicatorHeight / 2);
        activeGrad.addColorStop(0, '#FFE55C');
        activeGrad.addColorStop(0.3, '#FFD700');
        activeGrad.addColorStop(0.7, '#CCAA00');
        activeGrad.addColorStop(1, '#997700');
        ctx.fillStyle = activeGrad;
      } else if (isComplete) {
        // Complete phase - green LED style
        const completeGrad = ctx.createLinearGradient(0, indicatorY - indicatorHeight / 2, 0, indicatorY + indicatorHeight / 2);
        completeGrad.addColorStop(0, '#5CAF50');
        completeGrad.addColorStop(0.5, '#4CAF50');
        completeGrad.addColorStop(1, '#388E3C');
        ctx.fillStyle = completeGrad;
      } else {
        // Inactive phase - dark metallic
        const inactiveGrad = ctx.createLinearGradient(0, indicatorY - indicatorHeight / 2, 0, indicatorY + indicatorHeight / 2);
        inactiveGrad.addColorStop(0, '#555555');
        inactiveGrad.addColorStop(0.5, '#444444');
        inactiveGrad.addColorStop(1, '#333333');
        ctx.fillStyle = inactiveGrad;
      }
      ctx.fill();

      // 3D beveled edge
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.roundRect(x, indicatorY - indicatorHeight / 2, indicatorWidth, indicatorHeight, cornerRadius);
      ctx.strokeStyle = isActive ? 'rgba(255, 255, 200, 0.6)' : (isComplete ? 'rgba(150, 255, 150, 0.4)' : 'rgba(100, 100, 100, 0.5)');
      ctx.lineWidth = 1;
      ctx.stroke();

      // Top highlight bevel
      ctx.beginPath();
      ctx.roundRect(x + 2, indicatorY - indicatorHeight / 2 + 2, indicatorWidth - 4, indicatorHeight / 2 - 2, [cornerRadius - 1, cornerRadius - 1, 0, 0]);
      ctx.fillStyle = isActive ? 'rgba(255, 255, 255, 0.25)' : 'rgba(255, 255, 255, 0.1)';
      ctx.fill();

      // Label
      ctx.fillStyle = isActive ? '#1a1a00' : '#ffffff';
      ctx.font = isActive ? 'bold 11px Arial' : '10px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(phaseLabels[i], x + indicatorWidth / 2, indicatorY);

      // LED indicator dot for completed phases
      if (isComplete && !isActive) {
        ctx.beginPath();
        ctx.arc(x + indicatorWidth - 10, indicatorY - indicatorHeight / 2 + 8, 4, 0, Math.PI * 2);
        ctx.shadowColor = '#00ff00';
        ctx.shadowBlur = 6;
        ctx.fillStyle = '#00ff00';
        ctx.fill();

        // LED highlight
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.arc(x + indicatorWidth - 11, indicatorY - indicatorHeight / 2 + 7, 1.5, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.fill();
      }

      ctx.restore();
    }
  }

  private renderScorecard(ctx: CanvasRenderingContext2D): void {
    const frames = this.scoreSystem.getFrames();
    const currentFrame = this.scoreSystem.getCurrentFrame();

    // Scorecard position (right side)
    const cardX = 505;
    const cardY = 70;
    const frameWidth = 52;
    const frameHeight = 70;
    const cardWidth = 260;
    const cardHeight = 480;

    // CRT-style retro green background
    const bgGrad = ctx.createLinearGradient(cardX, cardY, cardX, cardY + cardHeight);
    bgGrad.addColorStop(0, 'rgba(15, 35, 15, 0.98)');
    bgGrad.addColorStop(0.5, 'rgba(20, 45, 20, 0.98)');
    bgGrad.addColorStop(1, 'rgba(12, 30, 12, 0.98)');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(cardX, cardY, cardWidth, cardHeight);

    // Neon gold border with glow
    ctx.save();
    ctx.shadowColor = '#FFD700';
    ctx.shadowBlur = 8;
    ctx.strokeStyle = '#D4AF37';
    ctx.lineWidth = 2;
    ctx.strokeRect(cardX, cardY, cardWidth, cardHeight);
    ctx.restore();

    // Inner border accent
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(cardX + 3, cardY + 3, cardWidth - 6, cardHeight - 6);

    // Title with LED glow
    ctx.save();
    ctx.shadowColor = '#FFD700';
    ctx.shadowBlur = 6;
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 15px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('SCORECARD', cardX + cardWidth / 2, cardY + 25);
    ctx.restore();

    // Frame boxes
    const startX = cardX + 10;
    const startY = cardY + 40;

    for (let i = 0; i < 10; i++) {
      const frame = frames[i];
      const row = Math.floor(i / 2);
      const col = i % 2;
      const fx = startX + col * (frameWidth + 10) + (col === 1 ? 5 : 0);
      const fy = startY + row * (frameHeight + 10);
      const isCurrentFrame = i === currentFrame;
      const is10th = i === 9;

      // Frame background
      ctx.fillStyle = isCurrentFrame ? 'rgba(255, 215, 0, 0.2)' : 'rgba(0, 0, 0, 0.3)';
      ctx.fillRect(fx, fy, is10th ? frameWidth + 20 : frameWidth, frameHeight);

      // Frame border
      ctx.strokeStyle = isCurrentFrame ? '#FFD700' : '#555555';
      ctx.lineWidth = isCurrentFrame ? 2 : 1;
      ctx.strokeRect(fx, fy, is10th ? frameWidth + 20 : frameWidth, frameHeight);

      // Frame number
      ctx.fillStyle = '#888888';
      ctx.font = '10px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(`${i + 1}`, fx + (is10th ? 36 : 26), fy + 12);

      // Roll boxes
      const rollBoxSize = 18;
      const rollY = fy + 18;

      if (is10th) {
        // 10th frame has 3 roll boxes
        for (let r = 0; r < 3; r++) {
          const rx = fx + 5 + r * 22;
          ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
          ctx.fillRect(rx, rollY, rollBoxSize, rollBoxSize);
          ctx.strokeStyle = '#666666';
          ctx.strokeRect(rx, rollY, rollBoxSize, rollBoxSize);

          const roll = r === 0 ? frame.roll1 : (r === 1 ? frame.roll2 : frame.roll3);
          if (roll !== null) {
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 12px Arial';
            if (roll === 10) {
              ctx.fillStyle = '#FFD700';
              ctx.fillText('X', rx + rollBoxSize / 2, rollY + 14);
            } else if (r === 1 && !frame.isStrike && (frame.roll1 || 0) + roll === 10) {
              ctx.fillStyle = '#87CEEB';
              ctx.fillText('/', rx + rollBoxSize / 2, rollY + 14);
            } else if (r === 2 && frame.isStrike && (frame.roll2 || 0) + roll === 10 && roll !== 10) {
              ctx.fillStyle = '#87CEEB';
              ctx.fillText('/', rx + rollBoxSize / 2, rollY + 14);
            } else if (roll === 0) {
              ctx.fillStyle = '#666666';
              ctx.fillText('-', rx + rollBoxSize / 2, rollY + 14);
            } else {
              ctx.fillText(`${roll}`, rx + rollBoxSize / 2, rollY + 14);
            }
          }
        }
      } else {
        // Regular frame has 2 roll boxes
        for (let r = 0; r < 2; r++) {
          const rx = fx + 8 + r * 22;
          ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
          ctx.fillRect(rx, rollY, rollBoxSize, rollBoxSize);
          ctx.strokeStyle = '#666666';
          ctx.strokeRect(rx, rollY, rollBoxSize, rollBoxSize);

          const roll = r === 0 ? frame.roll1 : frame.roll2;
          if (roll !== null) {
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 12px Arial';
            if (frame.isStrike && r === 1) {
              // Strike shown in second box
              ctx.fillStyle = '#FFD700';
              ctx.fillText('X', rx + rollBoxSize / 2, rollY + 14);
            } else if (frame.isSpare && r === 1) {
              ctx.fillStyle = '#87CEEB';
              ctx.fillText('/', rx + rollBoxSize / 2, rollY + 14);
            } else if (roll === 0) {
              ctx.fillStyle = '#666666';
              ctx.fillText('-', rx + rollBoxSize / 2, rollY + 14);
            } else if (frame.isStrike && r === 0) {
              // Don't show first roll for strike
            } else {
              ctx.fillText(`${roll}`, rx + rollBoxSize / 2, rollY + 14);
            }
          }
        }

        // Strike indicator
        if (frame.isStrike) {
          ctx.fillStyle = '#FFD700';
          ctx.font = 'bold 12px Arial';
          ctx.fillText('X', fx + 8 + 22 + rollBoxSize / 2, rollY + 14);
        }
      }

      // Cumulative score
      if (frame.cumulativeScore !== null) {
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 16px Arial';
        ctx.fillText(`${frame.cumulativeScore}`, fx + (is10th ? 36 : 26), fy + 58);
      }
    }

    // Total score at bottom
    ctx.fillStyle = '#D4AF37';
    ctx.font = 'bold 18px Arial';
    ctx.fillText(`TOTAL: ${this.scoreSystem.getTotalScore()}`, cardX + cardWidth / 2, cardY + cardHeight - 20);

    // Stats
    ctx.fillStyle = '#888888';
    ctx.font = '11px Arial';
    ctx.fillText(`Strikes: ${this.totalStrikes}  Spares: ${this.totalSpares}`, cardX + cardWidth / 2, cardY + cardHeight - 45);
  }

  private renderStatsScreen(ctx: CanvasRenderingContext2D): void {
    // Background
    const gradient = ctx.createLinearGradient(0, 0, 0, this.canvas.height);
    gradient.addColorStop(0, '#1a2a1a');
    gradient.addColorStop(1, '#0a150a');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    const centerX = this.canvas.width / 2;

    // Title
    ctx.fillStyle = '#D4AF37';
    ctx.font = 'bold 32px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('GAME COMPLETE', centerX, 60);

    // Final score
    const totalScore = this.scoreSystem.getTotalScore();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 72px Arial';
    ctx.fillText(`${totalScore}`, centerX, 150);

    ctx.fillStyle = '#888888';
    ctx.font = '18px Arial';
    ctx.fillText('FINAL SCORE', centerX, 180);

    // Performance rating
    let rating = '';
    let ratingColor = '#ffffff';
    if (totalScore === 300) {
      rating = 'PERFECT GAME!!!';
      ratingColor = '#FFD700';
    } else if (totalScore >= 250) {
      rating = 'EXCELLENT!';
      ratingColor = '#4CAF50';
    } else if (totalScore >= 200) {
      rating = 'GREAT!';
      ratingColor = '#8BC34A';
    } else if (totalScore >= 150) {
      rating = 'GOOD';
      ratingColor = '#87CEEB';
    } else if (totalScore >= 100) {
      rating = 'NICE TRY';
      ratingColor = '#FFC107';
    } else {
      rating = 'KEEP PRACTICING';
      ratingColor = '#FF9800';
    }

    ctx.fillStyle = ratingColor;
    ctx.font = 'bold 28px Arial';
    ctx.fillText(rating, centerX, 230);

    // Stats grid
    const statsY = 280;
    const statSpacing = 60;

    const stats = [
      { label: 'Strikes', value: this.totalStrikes, color: '#FFD700' },
      { label: 'Spares', value: this.totalSpares, color: '#87CEEB' },
      { label: 'Gutter Balls', value: this.gutterBalls, color: '#FF6B6B' },
      { label: 'Max Strike Streak', value: this.maxConsecutiveStrikes, color: '#FF9800' },
    ];

    const col1X = centerX - 100;
    const col2X = centerX + 100;

    for (let i = 0; i < stats.length; i++) {
      const stat = stats[i];
      const x = i % 2 === 0 ? col1X : col2X;
      const y = statsY + Math.floor(i / 2) * statSpacing;

      ctx.fillStyle = stat.color;
      ctx.font = 'bold 36px Arial';
      ctx.fillText(`${stat.value}`, x, y);

      ctx.fillStyle = '#888888';
      ctx.font = '14px Arial';
      ctx.fillText(stat.label, x, y + 20);
    }

    // Coins earned
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 24px Arial';
    ctx.fillText(`${this.pickups} Coins Earned!`, centerX, statsY + statSpacing * 2 + 30);

    // Continue prompt
    ctx.fillStyle = '#ffffff';
    ctx.font = '18px Arial';
    const pulse = 0.5 + Math.sin(Date.now() / 300) * 0.5;
    ctx.globalAlpha = pulse;
    ctx.fillText('TAP TO CONTINUE', centerX, this.canvas.height - 40);
    ctx.globalAlpha = 1;
  }

  restart(): void {
    // IMPORTANT: Call parent restart to reset isRunning flag
    super.restart();

    this.scoreSystem.reset();
    this.totalStrikes = 0;
    this.totalSpares = 0;
    this.gutterBalls = 0;
    this.maxConsecutiveStrikes = 0;
    this.score = 0;
    this.pickups = 0;
    this.phase = 'setup';
    this.messageTimer = 0;
    this.celebrationTimer = 0;
    this.particles.clear();
    this.keysPressed.clear();

    // Reset slow-motion state
    this.slowMotionTimer = 0;
    this.slowMotionScale = 1;
    this.pinsKnockedThisRoll = 0;
    this.firstPinHitThisRoll = false;

    // Reset visual effects
    this.screenShake = { x: 0, y: 0, intensity: 0, angle: 0 };
    this.phaseTimer = 0;

    this.setupFrame();
    this.showMessage('Frame 1 - Good Luck!', 2);
  }

  protected onDestroy(): void {
    this.canvas.removeEventListener('mousedown', this.handleClick.bind(this));
    this.canvas.removeEventListener('touchstart', this.handleTouchStart.bind(this));
    window.removeEventListener('keydown', this.handleKeyDown.bind(this));
    window.removeEventListener('keyup', this.handleKeyUp.bind(this));
  }
}
