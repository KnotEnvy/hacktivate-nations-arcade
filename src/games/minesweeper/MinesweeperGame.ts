import { BaseGame } from '@/games/shared/BaseGame';
import { GameManifest } from '@/lib/types';

interface Cell {
  mine: boolean;
  revealed: boolean;
  flagged: boolean;
  neighbors: number;
}

type MinesweeperDifficulty = 'easy' | 'medium' | 'hard';

const DIFFICULTY_CONFIG: Record<
  MinesweeperDifficulty,
  { cols: number; rows: number; mines: number }
> = {
  easy: { cols: 8, rows: 8, mines: 10 },
  medium: { cols: 12, rows: 12, mines: 22 },
  hard: { cols: 16, rows: 16, mines: 40 },
};

export class MinesweeperGame extends BaseGame {
  manifest: GameManifest = {
    id: 'minesweeper',
    title: 'Minesweeper',
    thumbnail: '/games/minesweeper/minesweeper-thumb.svg',
    inputSchema: ['keyboard', 'touch'],
    assetBudgetKB: 60,
    tier: 0,
    description: 'Clear the board without hitting mines!',
  };

  protected renderBaseHud = false;

  private difficulty: MinesweeperDifficulty = 'easy';
  private cols = 8;
  private rows = 8;
  private mines = 10;
  private cellSize = 32;
  private margin = 16;

  private board: Cell[][] = [];
  private gameState: 'playing' | 'won' | 'lost' = 'playing';
  private minesPlaced = false;
  private isStarted = false;
  private elapsedSec = 0;
  private bestTimeSec: number | null = null;
  private cellsCleared = 0;

  private prevLeft = false;
  private prevRight = false;
  private prevEasyKey = false;
  private prevMediumKey = false;
  private prevHardKey = false;

  private get offsetX() {
    return (this.canvas.width - this.cols * this.cellSize) / 2;
  }

  private get offsetY() {
    return (this.canvas.height - this.rows * this.cellSize) / 2;
  }

  protected onInit(): void {
    this.loadDifficulty();
    this.generateBoard();
  }

  protected onRestart(): void {
    this.generateBoard();
  }

  protected onUpdate(dt: number): void {
    if (this.gameState !== 'playing') return;

    if (this.isStarted) {
      this.elapsedSec += dt;
    }

    this.handleInput();

    const easyKey = this.services.input.isKeyPressed('Digit1');
    const mediumKey = this.services.input.isKeyPressed('Digit2');
    const hardKey = this.services.input.isKeyPressed('Digit3');

    if (easyKey && !this.prevEasyKey) this.setDifficulty('easy');
    if (mediumKey && !this.prevMediumKey) this.setDifficulty('medium');
    if (hardKey && !this.prevHardKey) this.setDifficulty('hard');

    this.prevEasyKey = easyKey;
    this.prevMediumKey = mediumKey;
    this.prevHardKey = hardKey;
  }

  private handleInput(): void {
    const input = this.services.input;
    const touches = input.getTouches();
    const mousePos = input.getMousePosition();
    const pointer = touches[0] ?? mousePos;

    const left = input.isMousePressed(0) || touches.length > 0;
    const right = input.isMousePressed(2) || input.isKeyPressed('KeyF');

    if (left && !this.prevLeft) {
      if (!this.handleDifficultyTap(pointer.x, pointer.y)) {
        this.revealAt(pointer.x, pointer.y);
      }
    } else if (right && !this.prevRight) {
      this.toggleFlagAt(pointer.x, pointer.y);
    }

    this.prevLeft = left;
    this.prevRight = right;
  }

  private revealAt(x: number, y: number): void {
    const { row, col } = this.pointToCell(x, y);
    if (row < 0 || col < 0) return;
    const cell = this.board[row][col];
    if (cell.revealed || cell.flagged) return;

    if (!this.minesPlaced) {
      this.placeMines(row, col);
      this.minesPlaced = true;
      this.isStarted = true;
      this.elapsedSec = 0;
    }

    if (cell.mine) {
      cell.revealed = true;
      this.gameState = 'lost';
      this.services.audio.playSound('collision');
      this.endGame();
      return;
    }

    this.floodReveal(row, col);

    if (this.checkWin()) {
      this.gameState = 'won';
      this.services.audio.playSound('success');
      this.endGame();
    }
  }

  private toggleFlagAt(x: number, y: number): void {
    const { row, col } = this.pointToCell(x, y);
    if (row < 0 || col < 0) return;
    const cell = this.board[row][col];
    if (cell.revealed) return;
    cell.flagged = !cell.flagged;
  }

  private floodReveal(r: number, c: number): void {
    const cell = this.board[r][c];
    if (cell.revealed || cell.flagged) return;
    cell.revealed = true;
    if (!cell.mine) {
      this.score += 10;
      this.cellsCleared += 1;
    }
    if (cell.neighbors === 0) {
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nr = r + dr;
          const nc = c + dc;
          if (nr >= 0 && nr < this.rows && nc >= 0 && nc < this.cols) {
            this.floodReveal(nr, nc);
          }
        }
      }
    }
  }

  private pointToCell(x: number, y: number): { row: number; col: number } {
    const col = Math.floor((x - this.offsetX) / this.cellSize);
    const row = Math.floor((y - this.offsetY) / this.cellSize);
    if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) {
      return { row: -1, col: -1 };
    }
    return { row, col };
  }

  private checkWin(): boolean {
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const cell = this.board[r][c];
        if (!cell.mine && !cell.revealed) return false;
      }
    }
    return true;
  }

  protected onRender(ctx: CanvasRenderingContext2D): void {
    const boardW = this.cols * this.cellSize;
    const boardH = this.rows * this.cellSize;
    ctx.fillStyle = '#0B1020';
    ctx.fillRect(this.offsetX - 2, this.offsetY - 2, boardW + 4, boardH + 4);

    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const cell = this.board[r][c];
        const x = this.offsetX + c * this.cellSize;
        const y = this.offsetY + r * this.cellSize;

        ctx.strokeStyle = '#374151';
        ctx.strokeRect(x, y, this.cellSize, this.cellSize);

        if (cell.revealed) {
          ctx.fillStyle = '#1f2937';
          ctx.fillRect(x, y, this.cellSize, this.cellSize);
          if (cell.mine) {
            ctx.fillStyle = '#dc2626';
            ctx.beginPath();
            ctx.arc(
              x + this.cellSize / 2,
              y + this.cellSize / 2,
              this.cellSize * 0.3,
              0,
              Math.PI * 2
            );
            ctx.fill();
          } else if (cell.neighbors > 0) {
            ctx.fillStyle = this.getNeighborColor(cell.neighbors);
            ctx.font = `bold ${this.cellSize * 0.6}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(
              `${cell.neighbors}`,
              x + this.cellSize / 2,
              y + this.cellSize / 2
            );
          }
        } else {
          ctx.fillStyle = '#047857';
          ctx.fillRect(x, y, this.cellSize, this.cellSize);
          if (cell.flagged) {
            ctx.fillStyle = '#facc15';
            ctx.beginPath();
            ctx.moveTo(x + this.cellSize * 0.2, y + this.cellSize * 0.8);
            ctx.lineTo(x + this.cellSize * 0.8, y + this.cellSize * 0.5);
            ctx.lineTo(x + this.cellSize * 0.2, y + this.cellSize * 0.2);
            ctx.closePath();
            ctx.fill();
          }
        }
      }
    }
  }

  protected onRenderUI(ctx: CanvasRenderingContext2D): void {
    const flagsUsed = this.board.flat().filter(c => c.flagged).length;
    const remaining = this.mines - flagsUsed;

    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 16px Arial';
    ctx.fillText(`Score: ${this.score}`, 16, 28);
    ctx.fillText(`Mines: ${remaining}`, 16, 50);
    const timeLabel = this.isStarted ? `${this.elapsedSec.toFixed(1)}s` : '--';
    ctx.fillText(`Time: ${timeLabel}`, 16, 72);

    ctx.fillStyle = '#94A3B8';
    ctx.font = '14px Arial';
    const bestLabel = this.bestTimeSec !== null ? `${this.bestTimeSec.toFixed(1)}s` : '--';
    ctx.fillText(`Best (${this.difficulty}): ${bestLabel}`, 16, 94);

    const buttons = this.getDifficultyButtons();
    for (const b of buttons) {
      const selected = b.id === this.difficulty;
      const disabled = this.isStarted && this.gameState === 'playing';
      ctx.save();
      ctx.globalAlpha = disabled ? 0.6 : 1;
      ctx.fillStyle = selected ? '#1D4ED8' : '#0F172A';
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.strokeStyle = selected ? '#93C5FD' : '#334155';
      ctx.lineWidth = 2;
      ctx.strokeRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 12px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2);
      ctx.restore();
    }

    ctx.textAlign = 'center';
    ctx.fillStyle = '#FFFFFF';
    if (!this.isStarted && this.gameState === 'playing') {
      ctx.font = '14px Arial';
      ctx.fillText('First click is safe. Tap to reveal, F/right-click to flag.', this.canvas.width / 2, this.canvas.height - 16);
    }

    if (this.gameState === 'won') {
      ctx.font = 'bold 22px Arial';
      ctx.fillText('Field Cleared!', this.canvas.width / 2, 34);
    } else if (this.gameState === 'lost') {
      ctx.font = 'bold 22px Arial';
      ctx.fillText('Boom!', this.canvas.width / 2, 34);
    }
  }

  protected onGameEnd(finalScore: any): void {
    const won = this.gameState === 'won';
    const flagsUsed = this.board.flat().filter(c => c.flagged).length;

    if (won) {
      this.saveBestTime(this.elapsedSec);
    }

    const fastWinStat = won && this.elapsedSec <= 60 ? 60 : 0;

    this.extendedGameData = {
      cells_cleared: this.cellsCleared,
      games_won: won ? 1 : 0,
      fast_win: fastWinStat,
      flags_used: flagsUsed,
      difficulty: this.difficulty,
    };

    this.services?.analytics?.trackGameSpecificStat?.('minesweeper', 'cells_cleared', this.cellsCleared);
    if (won) {
      this.services?.analytics?.trackGameSpecificStat?.('minesweeper', 'games_won', 1);
      this.services?.analytics?.trackGameSpecificStat?.('minesweeper', 'fast_win', this.elapsedSec);
    }

    super.onGameEnd?.(finalScore);
  }

  private generateBoard(): void {
    this.applyDifficulty(this.difficulty);
    this.updateLayout();
    this.loadBestTime();

    this.board = [];
    for (let r = 0; r < this.rows; r++) {
      const row: Cell[] = [];
      for (let c = 0; c < this.cols; c++) {
        row.push({
          mine: false,
          revealed: false,
          flagged: false,
          neighbors: 0,
        });
      }
      this.board.push(row);
    }

    this.gameState = 'playing';
    this.minesPlaced = false;
    this.isStarted = false;
    this.elapsedSec = 0;
    this.cellsCleared = 0;
    this.score = 0;
    this.extendedGameData = null;
    this.prevLeft = false;
    this.prevRight = false;
  }

  protected onResize(_width: number, _height: number): void {
    void _width;
    void _height;
    this.updateLayout();
  }

  private applyDifficulty(difficulty: MinesweeperDifficulty): void {
    const config = DIFFICULTY_CONFIG[difficulty];
    this.cols = config.cols;
    this.rows = config.rows;
    this.mines = config.mines;
  }

  private setDifficulty(difficulty: MinesweeperDifficulty): void {
    this.difficulty = difficulty;
    try {
      localStorage.setItem('minesweeper_difficulty', difficulty);
    } catch {
      /* ignore */
    }
    this.generateBoard();
  }

  private loadDifficulty(): void {
    try {
      const saved = localStorage.getItem('minesweeper_difficulty') as MinesweeperDifficulty | null;
      if (saved && DIFFICULTY_CONFIG[saved]) {
        this.difficulty = saved;
      }
    } catch {
      /* ignore */
    }
  }

  private bestTimeKey(): string {
    return `minesweeper_best_${this.difficulty}`;
  }

  private loadBestTime(): void {
    try {
      const saved = localStorage.getItem(this.bestTimeKey());
      this.bestTimeSec = saved ? parseFloat(saved) : null;
      if (Number.isNaN(this.bestTimeSec)) this.bestTimeSec = null;
    } catch {
      this.bestTimeSec = null;
    }
  }

  private saveBestTime(timeSec: number): void {
    if (this.bestTimeSec === null || timeSec < this.bestTimeSec) {
      this.bestTimeSec = timeSec;
      try {
        localStorage.setItem(this.bestTimeKey(), String(timeSec));
      } catch {
        /* ignore */
      }
    }
  }

  private updateLayout(): void {
    const maxW = this.canvas.width - this.margin * 2;
    const maxH = this.canvas.height - this.margin * 2;
    const size = Math.floor(Math.min(maxW / this.cols, maxH / this.rows));
    this.cellSize = Math.max(20, Math.min(40, size));
  }

  private placeMines(safeRow: number, safeCol: number): void {
    const safe = new Set<string>();
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const r = safeRow + dr;
        const c = safeCol + dc;
        if (r >= 0 && r < this.rows && c >= 0 && c < this.cols) {
          safe.add(`${r},${c}`);
        }
      }
    }

    let placed = 0;
    while (placed < this.mines) {
      const r = Math.floor(Math.random() * this.rows);
      const c = Math.floor(Math.random() * this.cols);
      if (safe.has(`${r},${c}`) || this.board[r][c].mine) continue;
      this.board[r][c].mine = true;
      placed++;
    }

    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        let count = 0;
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            const nr = r + dr;
            const nc = c + dc;
            if (nr >= 0 && nr < this.rows && nc >= 0 && nc < this.cols) {
              if (this.board[nr][nc].mine) count++;
            }
          }
        }
        this.board[r][c].neighbors = count;
      }
    }
  }

  private getDifficultyButtons(): Array<{
    id: MinesweeperDifficulty;
    label: string;
    x: number;
    y: number;
    w: number;
    h: number;
  }> {
    const w = 88;
    const h = 28;
    const gap = 8;
    const y = 12;
    const totalW = w * 3 + gap * 2;
    const startX = this.canvas.width - totalW - 16;

    return [
      { id: 'easy', label: 'Easy (1)', x: startX, y, w, h },
      { id: 'medium', label: 'Med (2)', x: startX + w + gap, y, w, h },
      { id: 'hard', label: 'Hard (3)', x: startX + (w + gap) * 2, y, w, h },
    ];
  }

  private handleDifficultyTap(x: number, y: number): boolean {
    if (this.isStarted && this.gameState === 'playing') return false;
    const button = this.getDifficultyButtons().find(
      b => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h
    );
    if (!button) return false;
    this.setDifficulty(button.id);
    return true;
  }

  private getNeighborColor(n: number): string {
    switch (n) {
      case 1: return '#60A5FA';
      case 2: return '#34D399';
      case 3: return '#F87171';
      case 4: return '#A78BFA';
      case 5: return '#FBBF24';
      case 6: return '#22D3EE';
      case 7: return '#E879F9';
      case 8: return '#F472B6';
      default: return '#FFFFFF';
    }
  }
}
