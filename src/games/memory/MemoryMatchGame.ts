import { BaseGame } from '@/games/shared/BaseGame';
import { GameManifest } from '@/lib/types';

interface Card { id: number; x: number; y: number; w: number; h: number; value: number; flipped: boolean; matched: boolean; }

export class MemoryMatchGame extends BaseGame {
  manifest: GameManifest = {
    id: 'memory',
    title: 'Memory Match',
    thumbnail: '/games/memory/memory-thumb.svg',
    inputSchema: ['touch'],
    assetBudgetKB: 60,
    tier: 0,
    description: 'Flip cards to find matching pairs.'
  };

  private cards: Card[] = [];
  private firstPick: Card | null = null;
  private secondPick: Card | null = null;
  private flipCooldown = 0; // time to wait before flipping back
  private moves = 0;
  private grid = { rows: 4, cols: 4 };

  protected onInit(): void {
    this.setupBoard();
  }

  protected onRestart(): void {
    this.score = 0;
    this.pickups = 0;
    this.moves = 0;
    this.firstPick = null;
    this.secondPick = null;
    this.flipCooldown = 0;
    this.setupBoard();
  }

  private setupBoard(): void {
    const { rows, cols } = this.grid;
    const values: number[] = [];
    const total = rows * cols;
    for (let i = 0; i < total / 2; i++) values.push(i, i);
    // shuffle
    for (let i = values.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [values[i], values[j]] = [values[j], values[i]];
    }

    // layout
    const margin = 16;
    const w = (this.canvas.width - margin * 2 - (cols - 1) * 10) / cols;
    const h = (this.canvas.height - margin * 2 - (rows - 1) * 10) / rows;
    this.cards = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        this.cards.push({ id: idx, x: margin + c * (w + 10), y: margin + r * (h + 10), w, h, value: values[idx], flipped: false, matched: false });
      }
    }
  }

  protected onUpdate(dt: number): void {
    if (this.flipCooldown > 0) {
      this.flipCooldown -= dt;
      if (this.flipCooldown <= 0 && this.firstPick && this.secondPick) {
        // Evaluate match
        if (this.firstPick.value === this.secondPick.value) {
          this.firstPick.matched = true;
          this.secondPick.matched = true;
          this.score += 100;
          this.pickups += 1;
          this.services.audio.playSound('success');
        } else {
          this.firstPick.flipped = false;
          this.secondPick.flipped = false;
          this.services.audio.playSound('collision');
        }
        this.firstPick = this.secondPick = null;
      }
    }

    // End condition
    if (this.cards.length > 0 && this.cards.every(c => c.matched)) {
      // Award small bonus based on efficiency
      const efficiency = Math.max(0.2, (this.grid.rows * this.grid.cols) / (this.moves * 2));
      this.score += Math.floor(200 * efficiency);
      this.endGame();
    }

    // Handle input
    const touches = this.services.input.getTouches?.() || [];
    if (touches.length > 0) {
      this.handleTap(touches[0].x, touches[0].y);
    }
    // Also allow mouse click as action
    if (this.services.input.isMousePressed?.(0)) {
      const { x, y } = this.services.input.getMousePosition?.() || { x: 0, y: 0 };
      this.handleTap(x, y);
    }
  }

  private handleTap(x: number, y: number): void {
    if (this.flipCooldown > 0) return;
    // Find card
    const c = this.cards.find(card => !card.matched && !card.flipped && x >= card.x && x <= card.x + card.w && y >= card.y && y <= card.y + card.h);
    if (!c) return;
    c.flipped = true;
    this.services.audio.playSound('click');
    if (!this.firstPick) {
      this.firstPick = c;
    } else if (!this.secondPick && c !== this.firstPick) {
      this.secondPick = c;
      this.moves += 1;
      this.flipCooldown = 0.6; // show for a short moment
    }
  }

  protected onRender(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#111827';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    for (const c of this.cards) {
      // Card background
      ctx.fillStyle = c.matched ? '#10B981' : c.flipped ? '#2563EB' : '#374151';
      ctx.fillRect(c.x, c.y, c.w, c.h);
      // Border
      ctx.strokeStyle = '#1F2937';
      ctx.strokeRect(c.x, c.y, c.w, c.h);
      // Value
      if (c.flipped || c.matched) {
        ctx.fillStyle = '#FFFFFF';
        ctx.font = `${Math.floor(c.h * 0.5)}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String.fromCharCode(65 + c.value), c.x + c.w / 2, c.y + c.h / 2);
      }
    }
  }

  protected onRenderUI(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`Score: ${this.score}`, 16, 24);
    ctx.fillText(`Moves: ${this.moves}`, 16, 44);
  }
}
