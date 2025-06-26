// ===== src/games/shared/BaseGame.ts =====
import { GameModule, GameManifest, Services, GameScore } from '@/lib/types';
import { GAME_CONFIG } from '@/lib/constants';

export abstract class BaseGame implements GameModule {
  protected canvas!: HTMLCanvasElement;
  protected ctx!: CanvasRenderingContext2D;
  protected services!: Services;
  
  protected isRunning: boolean = false;
  protected isPaused: boolean = false;
  protected gameTime: number = 0;
  
  protected score: number = 0;
  protected pickups: number = 0;
  protected startTime: number = 0;

  abstract manifest: GameManifest;

  init(canvas: HTMLCanvasElement, services: Services): void {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.services = services;
    
    // Set canvas size
    this.resize(GAME_CONFIG.CANVAS_WIDTH, GAME_CONFIG.CANVAS_HEIGHT);
    
    // Track game start
    this.services.analytics.trackGameStart(this.manifest.id);
    this.startTime = Date.now();
    this.isRunning = true;
    
    // Initialize game-specific logic
    this.onInit();
  }

  update(dt: number): void {
    if (!this.isRunning || this.isPaused) return;
    
    this.gameTime += dt;
    this.onUpdate(dt);
  }

  render(ctx: CanvasRenderingContext2D): void {
    // Clear canvas
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    if (!this.isRunning) return;
    
    this.onRender(ctx);
    
    // Render UI overlay
    this.renderUI(ctx);
  }

  pause(): void {
    this.isPaused = true;
    this.onPause?.();
  }

  resume(): void {
    this.isPaused = false;
    this.onResume?.();
  }

  resize(width: number, height: number): void {
    this.canvas.width = width;
    this.canvas.height = height;
    this.onResize?.(width, height);
  }

  destroy(): void {
    if (this.isRunning) {
      this.endGame();
    }
    this.onDestroy?.();
  }

  isGameOver(): boolean {
    return !this.isRunning;
  }

  getScore(): GameScore {
    const timePlayedMs = this.isRunning ? Date.now() - this.startTime : this.gameTime;
    const multiplier = this.services.currency.getBonusMultiplier?.() ?? 1;
    const coinsEarned = this.services.currency.calculateGameReward(
      this.score,
      this.pickups,
      multiplier
    );

    return {
      score: this.score,
      pickups: this.pickups,
      timePlayedMs,
      coinsEarned,
    };
  }

  restart(): void {
    this.score = 0;
    this.pickups = 0;
    this.gameTime = 0;
    this.startTime = Date.now();
    this.isRunning = true;
    this.isPaused = false;
    
    this.services.analytics.trackGameStart(this.manifest.id);
    this.onRestart?.();
  }

  protected endGame(): void {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    this.gameTime = Date.now() - this.startTime; 
    const finalScore = this.getScore();
    
    //play game over sound
    this.services.audio.playSound('game_over');

    // Award coins
    this.services.currency.addCoins(
      finalScore.coinsEarned, 
      `game_${this.manifest.id}`
    );
        
    // Track analytics
    this.services.analytics.trackGameEnd(
      this.manifest.id,
      finalScore.score,
      finalScore.coinsEarned,
      'died'
    );

    this.services.analytics.trackCurrencyTransaction(
      finalScore.coinsEarned,
      `game_${this.manifest.id}`,
      this.services.currency.getCurrentCoins()
    );

    this.onGameEnd?.(finalScore);
  }

  protected renderUI(ctx: CanvasRenderingContext2D): void {
    // Score display
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`Score: ${this.score}`, 20, 40);
    
    // Pickups display
    ctx.fillText(`Coins: ${this.pickups}`, 20, 70);
    
    // Game-specific UI
    this.onRenderUI?.(ctx);
  }

  // Abstract methods for subclasses
  protected abstract onInit(): void;
  protected abstract onUpdate(dt: number): void;
  protected abstract onRender(ctx: CanvasRenderingContext2D): void;

  // Optional lifecycle hooks
  protected onPause?(): void;
  protected onResume?(): void;
  protected onResize?(width: number, height: number): void;
  protected onDestroy?(): void;
  protected onRestart?(): void;
  protected onGameEnd?(finalScore: GameScore): void;
  protected onRenderUI?(ctx: CanvasRenderingContext2D): void;
}
