import { BaseGame } from '@/games/shared/BaseGame';
import { GameManifest } from '@/lib/types';

interface Obstacle { x: number; y: number; w: number; h: number; speed: number }

export class TapDodgeGame extends BaseGame {
  manifest: GameManifest = {
    id: 'tapdodge',
    title: 'Tap Dodge',
    thumbnail: '/games/tapdodge/tapdodge-thumb.svg',
    inputSchema: ['touch'],
    assetBudgetKB: 60,
    tier: 0,
    description: 'Tap left/right to dodge falling blocks.'
  };

  private player = { x: 0, y: 0, w: 36, h: 36, speed: 420 };
  private obstacles: Obstacle[] = [];
  private spawnTimer = 0;
  private spawnInterval = 1.0;
  private started = false;

  protected onInit(): void {
    this.reset();
  }

  protected onRestart(): void {
    this.score = 0;
    this.pickups = 0;
    this.spawnInterval = 1.0;
    this.started = false;
    this.reset();
  }

  private reset(): void {
    this.player.x = this.canvas.width / 2 - this.player.w / 2;
    this.player.y = this.canvas.height - 60;
    this.obstacles = [];
    this.spawnTimer = 0;
  }

  protected onUpdate(dt: number): void {
    this.handleInput(dt);
    if (!this.started) return;

    // Increase score by survival time
    this.score += Math.floor(dt * 100);

    // Spawn obstacles
    this.spawnTimer += dt;
    if (this.spawnTimer >= this.spawnInterval) {
      this.spawnTimer = 0;
      this.spawnInterval = Math.max(0.5, this.spawnInterval * 0.98);
      this.spawnObstacle();
    }

    // Move obstacles
    for (const o of this.obstacles) {
      o.y += o.speed * dt;
    }
    this.obstacles = this.obstacles.filter(o => o.y < this.canvas.height + o.h);

    // Collisions
    for (const o of this.obstacles) {
      if (this.intersects(this.player, o)) {
        this.endGame();
        return;
      }
    }
  }

  private spawnObstacle(): void {
    const lanes = 5;
    const laneW = this.canvas.width / lanes;
    const lane = Math.floor(Math.random() * lanes);
    const w = laneW * (0.6 + Math.random() * 0.3);
    const x = lane * laneW + (laneW - w) / 2;
    const h = 20 + Math.random() * 30;
    const speed = 140 + Math.random() * 120 + Math.min(160, (1 - this.spawnInterval) * 200);
    this.obstacles.push({ x, y: -h, w, h, speed });
  }

  private handleInput(dt: number): void {
    // Touch: left/right half to move; touch to start
    const touches = this.services.input.getTouches?.() || [];
    if (touches.length > 0) {
      const t = touches[0];
      const targetX = t.x - this.player.w / 2;
      const lerp = 1 - Math.pow(0.001, dt);
      this.player.x = this.player.x + (targetX - this.player.x) * lerp;
      if (!this.started) { this.started = true; this.services.audio.playSound('click'); }
    }
    // Also allow keyboard arrows as fallback
    const move = this.player.speed * dt;
    if (this.services.input.isLeftPressed()) { this.player.x -= move; this.started = true; }
    if (this.services.input.isRightPressed()) { this.player.x += move; this.started = true; }

    // Clamp
    this.player.x = Math.max(0, Math.min(this.canvas.width - this.player.w, this.player.x));
  }

  private intersects(a: {x:number;y:number;w:number;h:number}, b: {x:number;y:number;w:number;h:number}): boolean {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  protected onRender(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#0B1020';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Player
    ctx.fillStyle = '#22D3EE';
    ctx.fillRect(this.player.x, this.player.y, this.player.w, this.player.h);

    // Obstacles
    ctx.fillStyle = '#EF4444';
    for (const o of this.obstacles) {
      ctx.fillRect(o.x, o.y, o.w, o.h);
    }
  }

  protected onRenderUI(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`Score: ${this.score}`, 16, 24);
    if (!this.started) {
      ctx.textAlign = 'center';
      ctx.fillText('Tap to start; drag to move', this.canvas.width / 2, this.canvas.height / 2 + 20);
    }
  }
}
