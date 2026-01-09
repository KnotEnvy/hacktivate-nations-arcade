// ===== src/games/minesweeper/MinesweeperGame.ts =====
import { BaseGame } from '@/games/shared/BaseGame';
import { GameManifest } from '@/lib/types';
import { ParticleSystem } from './systems/ParticleSystem';
import { ScreenShake } from './systems/ScreenShake';

// ============================================
// TYPES & INTERFACES
// ============================================

interface Cell {
  mine: boolean;
  revealed: boolean;
  flagged: boolean;
  neighbors: number;
  // Animation state
  revealProgress: number;
  flagProgress: number;
  isHovered: boolean;
  exploded: boolean;
}

type MinesweeperDifficulty = 'easy' | 'medium' | 'hard';
type GameState = 'playing' | 'won' | 'lost' | 'dying';
type SmileyState = 'happy' | 'surprised' | 'cool' | 'dead';

const DIFFICULTY_CONFIG: Record<
  MinesweeperDifficulty,
  { cols: number; rows: number; mines: number }
> = {
  easy: { cols: 9, rows: 9, mines: 10 },
  medium: { cols: 16, rows: 16, mines: 40 },
  hard: { cols: 20, rows: 14, mines: 60 },
};

// ============================================
// COLORS - Retro Minesweeper Theme
// ============================================

const COLORS = {
  // Background
  bgDark: '#1a1a2e',
  bgLight: '#16213e',

  // Cell colors (classic 3D bevel)
  cellUnrevealed: '#047857',
  cellHighlight: '#10b981',
  cellShadow: '#065f46',
  cellRevealed: '#1f2937',
  cellRevealedLight: '#374151',
  cellHover: '#059669',

  // Border
  borderLight: '#C0C0C0',
  borderDark: '#808080',

  // Numbers (classic colors)
  num1: '#3B82F6',
  num2: '#22C55E',
  num3: '#EF4444',
  num4: '#1D4ED8',
  num5: '#991B1B',
  num6: '#0891B2',
  num7: '#1F2937',
  num8: '#6B7280',

  // Other
  mine: '#1F2937',
  mineExploded: '#DC2626',
  flag: '#FACC15',
  flagPole: '#78350F',

  // LED display
  ledBg: '#1F0000',
  ledOn: '#FF0000',
  ledOff: '#3D0000',

  // Smiley
  smileyYellow: '#FBBF24',
  smileyBorder: '#92400E',
};

// ============================================
// MINESWEEPER GAME CLASS
// ============================================

export class MinesweeperGame extends BaseGame {
  manifest: GameManifest = {
    id: 'minesweeper',
    title: 'Minesweeper',
    thumbnail: '/games/minesweeper/minesweeper-thumb.svg',
    inputSchema: ['keyboard', 'touch'],
    assetBudgetKB: 80,
    tier: 0,
    description: 'Classic mine-clearing puzzle with retro arcade style!',
  };

  protected renderBaseHud = false;

  // Grid configuration
  private difficulty: MinesweeperDifficulty = 'easy';
  private cols = 9;
  private rows = 9;
  private mines = 10;
  private cellSize = 28;
  private margin = 16;

  // Board state
  private board: Cell[][] = [];
  private gameState: GameState = 'playing';
  private smileyState: SmileyState = 'happy';
  private minesPlaced = false;
  private isStarted = false;
  private elapsedSec = 0;
  private bestTimeSec: number | null = null;
  private cellsCleared = 0;

  // Hover state
  private hoveredCell: { row: number; col: number } | null = null;
  private isMouseDown = false;

  // Input tracking
  private prevLeft = false;
  private prevRight = false;
  private prevEasyKey = false;
  private prevMediumKey = false;
  private prevHardKey = false;

  // Reveal animation queue
  private revealQueue: Array<{ row: number; col: number; delay: number }> = [];
  private revealTimer = 0;

  // Systems
  private particles!: ParticleSystem;
  private screenShake!: ScreenShake;
  private cameraOffset = { x: 0, y: 0 };

  // Victory/Death state
  private victoryConfettiSpawned = false;
  private deathTimer = 0;
  private readonly deathAnimationDuration = 2.0; // seconds to show death animation

  // Computed layout
  private get offsetX(): number {
    return (this.canvas.width - this.cols * this.cellSize) / 2;
  }

  private get offsetY(): number {
    return (this.canvas.height - this.rows * this.cellSize) / 2 + 30;
  }

  // ==========================================
  // LIFECYCLE METHODS
  // ==========================================

  protected onInit(): void {
    this.particles = new ParticleSystem();
    this.screenShake = new ScreenShake();
    this.loadDifficulty();
    this.generateBoard();

    // Prevent browser context menu on right-click
    this.handleContextMenu = (e: Event) => e.preventDefault();
    this.canvas.addEventListener('contextmenu', this.handleContextMenu);
  }

  protected onDestroy(): void {
    // Clean up event listener
    if (this.handleContextMenu) {
      this.canvas.removeEventListener('contextmenu', this.handleContextMenu);
    }
  }

  private handleContextMenu?: (e: Event) => void;

  protected onRestart(): void {
    this.generateBoard();
  }

  protected onUpdate(dt: number): void {
    // Update systems
    this.particles.update(dt);
    this.screenShake.update(dt);
    this.cameraOffset = this.screenShake.getOffset();

    // Update timer
    if (this.gameState === 'playing' && this.isStarted) {
      this.elapsedSec += dt;
    }

    // Process reveal queue (cascade animation)
    if (this.revealQueue.length > 0) {
      this.revealTimer += dt;
      const revealSpeed = 0.02; // Time between each cell reveal

      while (this.revealQueue.length > 0 && this.revealTimer >= this.revealQueue[0].delay) {
        const next = this.revealQueue.shift()!;
        const cell = this.board[next.row]?.[next.col];
        if (cell && !cell.revealed && !cell.flagged) {
          this.revealCell(next.row, next.col, false);
        }
      }
    }

    // Update cell animations
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const cell = this.board[r][c];

        // Reveal animation
        if (cell.revealed && cell.revealProgress < 1) {
          cell.revealProgress = Math.min(1, cell.revealProgress + dt * 8);
        }

        // Flag animation
        if (cell.flagged && cell.flagProgress < 1) {
          cell.flagProgress = Math.min(1, cell.flagProgress + dt * 6);
        } else if (!cell.flagged && cell.flagProgress > 0) {
          cell.flagProgress = Math.max(0, cell.flagProgress - dt * 8);
        }
      }
    }

    // Handle input
    if (this.gameState === 'playing') {
      this.handleInput();
      this.handleKeyboardDifficulty();
    }

    // Victory confetti
    if (this.gameState === 'won' && !this.victoryConfettiSpawned) {
      this.particles.createConfetti(this.canvas.width);
      this.victoryConfettiSpawned = true;
    }

    // Death animation timer
    if (this.gameState === 'dying') {
      this.deathTimer += dt;
      if (this.deathTimer >= this.deathAnimationDuration) {
        this.gameState = 'lost';
        this.endGame();
      }
    }
  }

  protected onRender(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.translate(this.cameraOffset.x, this.cameraOffset.y);

    this.renderBackground(ctx);
    this.renderBoard(ctx);
    this.particles.render(ctx);

    ctx.restore();
  }

  protected onRenderUI(ctx: CanvasRenderingContext2D): void {
    this.renderHeader(ctx);
    this.renderDifficultyButtons(ctx);
    this.renderInstructions(ctx);
    this.renderGameStateOverlay(ctx);
  }

  protected onGameEnd(finalScore: import('@/lib/types').GameScore): void {
    const won = this.gameState === 'won';
    const flagsUsed = this.board.flat().filter(c => c.flagged).length;

    if (won) {
      this.saveBestTime(this.elapsedSec);
    }

    this.extendedGameData = {
      cells_cleared: this.cellsCleared,
      games_won: won ? 1 : 0,
      fast_win: won && this.elapsedSec <= 60 ? 60 : 0,
      flags_used: flagsUsed,
      difficulty: this.difficulty,
    };

    this.services?.analytics?.trackGameSpecificStat?.('minesweeper', 'cells_cleared', this.cellsCleared);
    if (won) {
      this.services?.analytics?.trackGameSpecificStat?.('minesweeper', 'games_won', 1);
    }

    super.onGameEnd?.(finalScore);
  }

  // ==========================================
  // INPUT HANDLING
  // ==========================================

  private handleInput(): void {
    const input = this.services.input;
    const touches = input.getTouches();
    const mousePos = input.getMousePosition();
    const pointer = touches[0] ?? mousePos;

    const left = input.isMousePressed(0) || touches.length > 0;
    const right = input.isMousePressed(2) || input.isKeyPressed('KeyF');

    // Update hover state
    const { row, col } = this.pointToCell(pointer.x, pointer.y);
    if (row >= 0 && col >= 0) {
      // Clear previous hover
      if (this.hoveredCell) {
        const prevCell = this.board[this.hoveredCell.row]?.[this.hoveredCell.col];
        if (prevCell) prevCell.isHovered = false;
      }

      this.hoveredCell = { row, col };
      const cell = this.board[row][col];
      if (cell && !cell.revealed) {
        cell.isHovered = true;
      }
    } else {
      if (this.hoveredCell) {
        const prevCell = this.board[this.hoveredCell.row]?.[this.hoveredCell.col];
        if (prevCell) prevCell.isHovered = false;
      }
      this.hoveredCell = null;
    }

    // Update smiley on mouse down
    this.isMouseDown = left;
    if (left && this.hoveredCell) {
      this.smileyState = 'surprised';
    } else if (this.gameState === 'playing') {
      this.smileyState = 'happy';
    }

    // Handle clicks
    if (left && !this.prevLeft) {
      // Check smiley click (restart)
      if (this.isSmileyClick(pointer.x, pointer.y)) {
        this.restart();
      } else if (!this.handleDifficultyTap(pointer.x, pointer.y)) {
        this.revealAt(pointer.x, pointer.y);
      }
    } else if (right && !this.prevRight) {
      this.toggleFlagAt(pointer.x, pointer.y);
    }

    this.prevLeft = left;
    this.prevRight = right;
  }

  private handleKeyboardDifficulty(): void {
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

  private isSmileyClick(x: number, y: number): boolean {
    const smileyX = this.canvas.width / 2;
    const smileyY = 35;
    const radius = 18;
    const dx = x - smileyX;
    const dy = y - smileyY;
    return dx * dx + dy * dy < radius * radius;
  }

  // ==========================================
  // GAME LOGIC
  // ==========================================

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
      // Hit a mine - start death animation
      cell.revealed = true;
      cell.exploded = true;
      cell.revealProgress = 1;
      this.gameState = 'dying';
      this.smileyState = 'dead';
      this.deathTimer = 0;

      // Explosion effects
      const cellX = this.offsetX + col * this.cellSize + this.cellSize / 2;
      const cellY = this.offsetY + row * this.cellSize + this.cellSize / 2;
      this.particles.createExplosion(cellX, cellY);
      this.screenShake.shake(15, 0.5);
      this.services.audio.playSound('collision');

      // Reveal all mines with staggered animation
      this.revealAllMinesAnimated();
      return;
    }

    // Start cascade reveal
    this.startCascadeReveal(row, col);

    if (this.checkWin()) {
      this.gameState = 'won';
      this.smileyState = 'cool';
      this.services.audio.playSound('success');
      this.endGame();
    }
  }

  private revealCell(row: number, col: number, checkWin: boolean = true): void {
    const cell = this.board[row][col];
    if (cell.revealed || cell.flagged) return;

    cell.revealed = true;
    cell.revealProgress = 0;

    if (!cell.mine) {
      this.score += 10;
      this.cellsCleared++;

      // Particle effect
      const cellX = this.offsetX + col * this.cellSize + this.cellSize / 2;
      const cellY = this.offsetY + row * this.cellSize + this.cellSize / 2;
      this.particles.createRevealDust(cellX, cellY, this.cellSize);
    }

    if (checkWin && this.checkWin()) {
      this.gameState = 'won';
      this.smileyState = 'cool';
      this.services.audio.playSound('success');
      this.endGame();
    }
  }

  private startCascadeReveal(startRow: number, startCol: number): void {
    this.revealQueue = [];
    this.revealTimer = 0;

    const visited = new Set<string>();
    const queue: Array<{ row: number; col: number; distance: number }> = [
      { row: startRow, col: startCol, distance: 0 }
    ];

    while (queue.length > 0) {
      const { row, col, distance } = queue.shift()!;
      const key = `${row},${col}`;
      if (visited.has(key)) continue;
      visited.add(key);

      const cell = this.board[row]?.[col];
      if (!cell || cell.revealed || cell.flagged) continue;

      // Add to reveal queue with delay based on distance
      this.revealQueue.push({ row, col, delay: distance * 0.03 });

      // If no neighbors, expand
      if (cell.neighbors === 0 && !cell.mine) {
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            const nr = row + dr;
            const nc = col + dc;
            if (nr >= 0 && nr < this.rows && nc >= 0 && nc < this.cols) {
              queue.push({ row: nr, col: nc, distance: distance + 1 });
            }
          }
        }
      }
    }

    // Play sound for cascade
    if (this.revealQueue.length > 3) {
      this.services.audio.playSound('powerup');
      this.particles.createCascadeWave(
        this.offsetX + startCol * this.cellSize + this.cellSize / 2,
        this.offsetY + startRow * this.cellSize + this.cellSize / 2
      );
    }
  }

  private toggleFlagAt(x: number, y: number): void {
    const { row, col } = this.pointToCell(x, y);
    if (row < 0 || col < 0) return;
    const cell = this.board[row][col];
    if (cell.revealed) return;

    cell.flagged = !cell.flagged;

    if (cell.flagged) {
      const cellX = this.offsetX + col * this.cellSize + this.cellSize / 2;
      const cellY = this.offsetY + row * this.cellSize + this.cellSize / 2;
      this.particles.createFlagSparkle(cellX, cellY);
      this.services.audio.playSound('coin');
    }
  }

  private revealAllMines(): void {
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const cell = this.board[r][c];
        if (cell.mine && !cell.revealed) {
          cell.revealed = true;
          cell.revealProgress = 1;
        }
      }
    }
  }

  private revealAllMinesAnimated(): void {
    // Collect all mines
    const mines: Array<{ row: number; col: number }> = [];
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const cell = this.board[r][c];
        if (cell.mine && !cell.revealed) {
          mines.push({ row: r, col: c });
        }
      }
    }

    // Reveal mines with staggered timing
    mines.forEach((mine, index) => {
      setTimeout(() => {
        const cell = this.board[mine.row]?.[mine.col];
        if (cell && !cell.revealed) {
          cell.revealed = true;
          cell.revealProgress = 0; // Animate the reveal

          // Small explosion for each mine
          const cellX = this.offsetX + mine.col * this.cellSize + this.cellSize / 2;
          const cellY = this.offsetY + mine.row * this.cellSize + this.cellSize / 2;
          this.particles.createRevealDust(cellX, cellY, this.cellSize);

          // Small shake for each mine
          if (index % 3 === 0) {
            this.screenShake.shake(3, 0.1);
          }
        }
      }, index * 80); // 80ms between each mine reveal
    });
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

  // ==========================================
  // BOARD GENERATION
  // ==========================================

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
          revealProgress: 0,
          flagProgress: 0,
          isHovered: false,
          exploded: false,
        });
      }
      this.board.push(row);
    }

    this.gameState = 'playing';
    this.smileyState = 'happy';
    this.minesPlaced = false;
    this.isStarted = false;
    this.elapsedSec = 0;
    this.cellsCleared = 0;
    this.score = 0;
    this.revealQueue = [];
    this.victoryConfettiSpawned = false;

    this.particles.clear();
    this.screenShake.stop();
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

    // Calculate neighbor counts
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

  // ==========================================
  // RENDERING
  // ==========================================

  private renderBackground(ctx: CanvasRenderingContext2D): void {
    // Dark gradient background
    const gradient = ctx.createLinearGradient(0, 0, 0, this.canvas.height);
    gradient.addColorStop(0, COLORS.bgDark);
    gradient.addColorStop(1, COLORS.bgLight);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Scanline effect
    ctx.fillStyle = 'rgba(0, 0, 0, 0.03)';
    for (let y = 0; y < this.canvas.height; y += 4) {
      ctx.fillRect(0, y, this.canvas.width, 2);
    }
  }

  private renderBoard(ctx: CanvasRenderingContext2D): void {
    const boardW = this.cols * this.cellSize;
    const boardH = this.rows * this.cellSize;

    // Board border (3D bevel)
    this.draw3DBorder(ctx, this.offsetX - 4, this.offsetY - 4, boardW + 8, boardH + 8, true);

    // Render cells
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        this.renderCell(ctx, r, c);
      }
    }
  }

  private renderCell(ctx: CanvasRenderingContext2D, row: number, col: number): void {
    const cell = this.board[row][col];
    const x = this.offsetX + col * this.cellSize;
    const y = this.offsetY + row * this.cellSize;
    const size = this.cellSize;

    if (cell.revealed) {
      // Revealed cell (sunken)
      const progress = cell.revealProgress;
      const scale = 0.8 + 0.2 * progress;

      ctx.save();
      ctx.translate(x + size / 2, y + size / 2);
      ctx.scale(scale, scale);
      ctx.translate(-(x + size / 2), -(y + size / 2));

      // Sunken background
      ctx.fillStyle = COLORS.cellRevealed;
      ctx.fillRect(x, y, size, size);

      // Inner shadow (sunken effect)
      ctx.strokeStyle = COLORS.borderDark;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, y + size);
      ctx.lineTo(x, y);
      ctx.lineTo(x + size, y);
      ctx.stroke();

      ctx.strokeStyle = COLORS.borderLight;
      ctx.beginPath();
      ctx.moveTo(x + size, y);
      ctx.lineTo(x + size, y + size);
      ctx.lineTo(x, y + size);
      ctx.stroke();

      // Content
      if (cell.mine) {
        this.renderMine(ctx, x, y, size, cell.exploded);
      } else if (cell.neighbors > 0) {
        this.renderNumber(ctx, x, y, size, cell.neighbors, progress);
      }

      ctx.restore();
    } else {
      // Unrevealed cell (raised 3D button)
      const isHovered = cell.isHovered && this.gameState === 'playing';
      const baseColor = isHovered ? COLORS.cellHover : COLORS.cellUnrevealed;

      // Main fill
      ctx.fillStyle = baseColor;
      ctx.fillRect(x, y, size, size);

      // 3D bevel effect
      this.draw3DBevel(ctx, x, y, size, size, false);

      // Flag
      if (cell.flagged || cell.flagProgress > 0) {
        this.renderFlag(ctx, x, y, size, cell.flagProgress);
      }
    }
  }

  private draw3DBevel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, sunken: boolean): void {
    const light = sunken ? COLORS.borderDark : COLORS.cellHighlight;
    const dark = sunken ? COLORS.cellHighlight : COLORS.cellShadow;

    ctx.strokeStyle = light;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y + h);
    ctx.lineTo(x, y);
    ctx.lineTo(x + w, y);
    ctx.stroke();

    ctx.strokeStyle = dark;
    ctx.beginPath();
    ctx.moveTo(x + w, y);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x, y + h);
    ctx.stroke();
  }

  private draw3DBorder(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, sunken: boolean): void {
    ctx.fillStyle = '#4B5563';
    ctx.fillRect(x, y, w, h);

    const light = sunken ? '#1F2937' : '#9CA3AF';
    const dark = sunken ? '#9CA3AF' : '#1F2937';

    ctx.strokeStyle = light;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y + h);
    ctx.lineTo(x, y);
    ctx.lineTo(x + w, y);
    ctx.stroke();

    ctx.strokeStyle = dark;
    ctx.beginPath();
    ctx.moveTo(x + w, y);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x, y + h);
    ctx.stroke();
  }

  private renderMine(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, exploded: boolean): void {
    const cx = x + size / 2;
    const cy = y + size / 2;
    const radius = size * 0.3;

    // Background for exploded mine
    if (exploded) {
      ctx.fillStyle = COLORS.mineExploded;
      ctx.fillRect(x, y, size, size);
    }

    // Mine body
    ctx.fillStyle = COLORS.mine;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();

    // Spikes
    ctx.strokeStyle = COLORS.mine;
    ctx.lineWidth = 2;
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 * i) / 8;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(angle) * radius * 0.6, cy + Math.sin(angle) * radius * 0.6);
      ctx.lineTo(cx + Math.cos(angle) * radius * 1.3, cy + Math.sin(angle) * radius * 1.3);
      ctx.stroke();
    }

    // Highlight
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(cx - radius * 0.3, cy - radius * 0.3, radius * 0.2, 0, Math.PI * 2);
    ctx.fill();
  }

  private renderNumber(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, num: number, alpha: number): void {
    const colors = [
      '', COLORS.num1, COLORS.num2, COLORS.num3,
      COLORS.num4, COLORS.num5, COLORS.num6, COLORS.num7, COLORS.num8
    ];

    ctx.save();
    ctx.globalAlpha = alpha;

    // Glow effect
    ctx.shadowColor = colors[num];
    ctx.shadowBlur = 8;

    ctx.fillStyle = colors[num];
    ctx.font = `bold ${size * 0.65}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${num}`, x + size / 2, y + size / 2 + 1);

    ctx.restore();
  }

  private renderFlag(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, progress: number): void {
    const cx = x + size / 2;
    const baseY = y + size * 0.85;

    // Animate flag rising
    const flagY = baseY - (size * 0.6) * progress;

    ctx.save();
    ctx.globalAlpha = progress;

    // Pole
    ctx.fillStyle = COLORS.flagPole;
    ctx.fillRect(cx - 1, flagY, 3, baseY - flagY);

    // Flag triangle
    ctx.fillStyle = COLORS.flag;
    ctx.beginPath();
    ctx.moveTo(cx + 2, flagY);
    ctx.lineTo(cx + size * 0.35, flagY + size * 0.15);
    ctx.lineTo(cx + 2, flagY + size * 0.3);
    ctx.closePath();
    ctx.fill();

    // Base
    ctx.fillStyle = COLORS.flagPole;
    ctx.fillRect(cx - size * 0.15, baseY - 3, size * 0.3, 4);

    ctx.restore();
  }

  private renderHeader(ctx: CanvasRenderingContext2D): void {
    const headerY = 10;
    const headerH = 50;

    // Header background
    ctx.fillStyle = '#374151';
    ctx.fillRect(this.offsetX - 4, headerY, this.cols * this.cellSize + 8, headerH);
    this.draw3DBorder(ctx, this.offsetX - 4, headerY, this.cols * this.cellSize + 8, headerH, true);

    // Mines counter (LED style) - left
    const minesRemaining = this.mines - this.board.flat().filter(c => c.flagged).length;
    this.renderLEDDisplay(ctx, this.offsetX + 8, headerY + 10, Math.max(0, minesRemaining));

    // Timer (LED style) - right
    const time = Math.min(999, Math.floor(this.elapsedSec));
    this.renderLEDDisplay(ctx, this.offsetX + this.cols * this.cellSize - 58, headerY + 10, time);

    // Smiley button - center
    this.renderSmiley(ctx, this.canvas.width / 2, headerY + headerH / 2 + 5);
  }

  private renderLEDDisplay(ctx: CanvasRenderingContext2D, x: number, y: number, value: number): void {
    const w = 50;
    const h = 28;

    // Background
    ctx.fillStyle = COLORS.ledBg;
    ctx.fillRect(x, y, w, h);

    // Border
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);

    // LED digits
    const str = String(value).padStart(3, '0');
    ctx.fillStyle = COLORS.ledOn;
    ctx.font = 'bold 20px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(str, x + w / 2, y + h / 2 + 1);
  }

  private renderSmiley(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    const radius = 16;

    // Button background
    ctx.fillStyle = '#C0C0C0';
    ctx.beginPath();
    ctx.arc(x, y, radius + 4, 0, Math.PI * 2);
    ctx.fill();

    // 3D bevel on button
    ctx.strokeStyle = this.isMouseDown && this.isSmileyClick(x, y) ? '#808080' : '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, radius + 3, Math.PI, Math.PI * 1.5);
    ctx.stroke();

    ctx.strokeStyle = this.isMouseDown ? '#FFFFFF' : '#808080';
    ctx.beginPath();
    ctx.arc(x, y, radius + 3, 0, Math.PI * 0.5);
    ctx.stroke();

    // Face
    ctx.fillStyle = COLORS.smileyYellow;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = COLORS.smileyBorder;
    ctx.lineWidth = 1;
    ctx.stroke();

    // Expression based on state
    ctx.fillStyle = '#000000';

    switch (this.smileyState) {
      case 'happy':
        // Eyes
        ctx.beginPath();
        ctx.arc(x - 5, y - 4, 2, 0, Math.PI * 2);
        ctx.arc(x + 5, y - 4, 2, 0, Math.PI * 2);
        ctx.fill();
        // Smile
        ctx.beginPath();
        ctx.arc(x, y + 2, 7, 0.2, Math.PI - 0.2);
        ctx.stroke();
        break;

      case 'surprised':
        // Wide eyes
        ctx.beginPath();
        ctx.arc(x - 5, y - 4, 3, 0, Math.PI * 2);
        ctx.arc(x + 5, y - 4, 3, 0, Math.PI * 2);
        ctx.fill();
        // O mouth
        ctx.beginPath();
        ctx.arc(x, y + 4, 4, 0, Math.PI * 2);
        ctx.stroke();
        break;

      case 'cool':
        // Sunglasses
        ctx.fillRect(x - 10, y - 6, 8, 5);
        ctx.fillRect(x + 2, y - 6, 8, 5);
        ctx.fillRect(x - 2, y - 5, 4, 2);
        // Smile
        ctx.beginPath();
        ctx.arc(x, y + 2, 7, 0.2, Math.PI - 0.2);
        ctx.stroke();
        break;

      case 'dead':
        // X eyes
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x - 7, y - 6);
        ctx.lineTo(x - 3, y - 2);
        ctx.moveTo(x - 3, y - 6);
        ctx.lineTo(x - 7, y - 2);
        ctx.moveTo(x + 3, y - 6);
        ctx.lineTo(x + 7, y - 2);
        ctx.moveTo(x + 7, y - 6);
        ctx.lineTo(x + 3, y - 2);
        ctx.stroke();
        // Frown
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(x, y + 8, 6, Math.PI + 0.3, -0.3);
        ctx.stroke();
        break;
    }
  }

  private renderDifficultyButtons(ctx: CanvasRenderingContext2D): void {
    const buttons = this.getDifficultyButtons();

    for (const b of buttons) {
      const selected = b.id === this.difficulty;
      const disabled = this.isStarted && this.gameState === 'playing';

      ctx.save();
      ctx.globalAlpha = disabled ? 0.5 : 1;

      // Button background
      ctx.fillStyle = selected ? '#1D4ED8' : '#374151';
      ctx.fillRect(b.x, b.y, b.w, b.h);

      // Border
      ctx.strokeStyle = selected ? '#93C5FD' : '#6B7280';
      ctx.lineWidth = 2;
      ctx.strokeRect(b.x, b.y, b.w, b.h);

      // Text
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 11px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2);

      ctx.restore();
    }
  }

  private renderInstructions(ctx: CanvasRenderingContext2D): void {
    if (!this.isStarted && this.gameState === 'playing') {
      ctx.textAlign = 'center';
      ctx.fillStyle = '#9CA3AF';
      ctx.font = '12px Arial';
      ctx.fillText(
        'Click to reveal • Right-click/F to flag • First click is safe',
        this.canvas.width / 2,
        this.canvas.height - 12
      );
    }

    // Best time
    ctx.textAlign = 'left';
    ctx.fillStyle = '#6B7280';
    ctx.font = '11px Arial';
    const bestLabel = this.bestTimeSec !== null ? `${this.bestTimeSec.toFixed(1)}s` : '--';
    ctx.fillText(`Best: ${bestLabel}`, 12, this.canvas.height - 12);
  }

  private renderGameStateOverlay(ctx: CanvasRenderingContext2D): void {
    if (this.gameState === 'won') {
      ctx.save();
      ctx.fillStyle = 'rgba(16, 185, 129, 0.2)';
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

      ctx.fillStyle = '#10B981';
      ctx.font = 'bold 28px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🎉 CLEARED! 🎉', this.canvas.width / 2, 80);

      ctx.font = '16px Arial';
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(`Time: ${this.elapsedSec.toFixed(1)}s`, this.canvas.width / 2, 110);
      ctx.restore();
    } else if (this.gameState === 'lost') {
      ctx.save();
      ctx.fillStyle = 'rgba(220, 38, 38, 0.15)';
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

      ctx.fillStyle = '#EF4444';
      ctx.font = 'bold 28px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('💥 BOOM! 💥', this.canvas.width / 2, 80);
      ctx.restore();
    }
  }

  // ==========================================
  // DIFFICULTY & STORAGE
  // ==========================================

  private getDifficultyButtons(): Array<{
    id: MinesweeperDifficulty;
    label: string;
    x: number;
    y: number;
    w: number;
    h: number;
  }> {
    const w = 70;
    const h = 24;
    const gap = 6;
    const y = this.canvas.height - 36;
    const totalW = w * 3 + gap * 2;
    const startX = this.canvas.width - totalW - 12;

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
    } catch { /* ignore */ }
    this.generateBoard();
  }

  private loadDifficulty(): void {
    try {
      const saved = localStorage.getItem('minesweeper_difficulty') as MinesweeperDifficulty | null;
      if (saved && DIFFICULTY_CONFIG[saved]) {
        this.difficulty = saved;
      }
    } catch { /* ignore */ }
  }

  private updateLayout(): void {
    const maxW = this.canvas.width - this.margin * 2;
    const maxH = this.canvas.height - this.margin * 2 - 80; // Account for header
    const size = Math.floor(Math.min(maxW / this.cols, maxH / this.rows));
    this.cellSize = Math.max(18, Math.min(36, size));
  }

  protected onResize(_width: number, _height: number): void {
    this.updateLayout();
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
      } catch { /* ignore */ }
    }
  }
}
