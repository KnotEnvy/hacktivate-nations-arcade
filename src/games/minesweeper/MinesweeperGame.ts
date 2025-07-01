import { BaseGame } from '@/games/shared/BaseGame';
import { GameManifest } from '@/lib/types';

interface Cell {
  mine: boolean;
  revealed: boolean;
  flagged: boolean;
  neighbors: number;
}

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

  private cols = 10;
  private rows = 10;
  private mines = 10;
  private cellSize = 32;

  private board: Cell[][] = [];
  private gameState: 'playing' | 'won' | 'lost' = 'playing';

  private prevLeft = false;
  private prevRight = false;

  private get offsetX() {
    return (this.canvas.width - this.cols * this.cellSize) / 2;
  }

  private get offsetY() {
    return (this.canvas.height - this.rows * this.cellSize) / 2;
  }

  protected onInit(): void {
    this.generateBoard();
  }

  protected onRestart(): void {
    this.generateBoard();
    this.score = 0;
    this.gameState = 'playing';
  }

  protected onUpdate(_dt: number): void {
    // dt currently unused but included for future animations
    void _dt;
    if (this.gameState !== 'playing') return;
    this.handleInput();
  }

  private handleInput(): void {
    const input = this.services.input;
    const touches = input.getTouches();
    const mousePos = input.getMousePosition();
    const pointer = touches[0] ?? mousePos;

    const left = input.isMousePressed(0) || touches.length > 0;
    const right = input.isMousePressed(2) || input.isKeyPressed('KeyF');

    if (left && !this.prevLeft) {
      this.revealAt(pointer.x, pointer.y);
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

    if (cell.mine) {
      cell.revealed = true;
      this.gameState = 'lost';
      this.endGame();
      return;
    }

    this.floodReveal(row, col);

    if (this.checkWin()) {
      this.gameState = 'won';
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
            ctx.fillStyle = '#ffffff';
            ctx.font = `${this.cellSize * 0.6}px Arial`;
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
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '16px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`Mines: ${remaining}`, 20, 40);

    if (this.gameState === 'won') {
      ctx.fillText('You cleared the field!', 20, 65);
    } else if (this.gameState === 'lost') {
      ctx.fillText('Boom! Game over.', 20, 65);
    }
  }

  private generateBoard(): void {
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

    let placed = 0;
    while (placed < this.mines) {
      const r = Math.floor(Math.random() * this.rows);
      const c = Math.floor(Math.random() * this.cols);
      if (!this.board[r][c].mine) {
        this.board[r][c].mine = true;
        placed++;
      }
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
}
