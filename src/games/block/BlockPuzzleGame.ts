// src/games/puzzle/BlockPuzzleGame.ts
import { BaseGame } from '@/games/shared/BaseGame';
import { GameManifest } from '@/lib/types'
import { Vector2 } from '@/games/shared/utils/Vector2';
import { EnvironmentSystem, EnvironmentTheme } from './systems/EnvironmentSystem';
import { ComboSystem } from './systems/ComboSystem';
import { ParticleSystem } from './systems/ParticleSystem';
import { ScreenShake } from './systems/ScreenShake';

type BlockColor = 'red' | 'blue' | 'green' | 'yellow' | 'purple' | 'orange' | 'cyan';
type GameState = 'playing' | 'paused' | 'gameOver' | 'lineClearing' | 'dying';

interface Block {
  color: BlockColor;
  locked: boolean;
}

interface FallingPiece {
  shapeName: keyof typeof PIECE_SHAPES; // <-- ADD THIS LINE
  shape: boolean[][];
  color: BlockColor;
  position: Vector2;
  rotation: number;
}

// Tetris-like piece shapes
const PIECE_SHAPES = {
  I: [[true, true, true, true]],
  O: [[true, true], [true, true]],
  T: [[false, true, false], [true, true, true]],
  S: [[false, true, true], [true, true, false]],
  Z: [[true, true, false], [false, true, true]],
  J: [[true, false, false], [true, true, true]],
  L: [[false, false, true], [true, true, true]]
};

const COLORS: BlockColor[] = ['red', 'blue', 'green', 'yellow', 'purple', 'orange', 'cyan'];

export class BlockPuzzleGame extends BaseGame {
  manifest: GameManifest = {
    id: 'puzzle',
    title: 'Block Puzzle',
    thumbnail: '/games/puzzle/puzzle-thumb.svg',
    inputSchema: ['keyboard', 'touch'],
    assetBudgetKB: 75,
    tier: 1, // Unlocked at 2000 coins
    description: 'Drop and arrange falling blocks to clear lines!'
  };

  // Game board
  private boardWidth: number = 10;
  private boardHeight: number = 20;
  private board: (Block | null)[][] = [];
  private blockSize: number = 27; // scaled down so board fits default canvas
  
  // Game state
  private currentPiece: FallingPiece | null = null;
  private nextPiece: FallingPiece | null = null;
  private gameState: GameState = 'playing';
  private level: number = 1;
  private linesCleared: number = 0;
  private dropTimer: number = 0;
  private dropInterval: number = 1000; // ms
  private lastDropTime: number = 0;

  // Timed mode
  private timeLimit: number = 120; // seconds
  private timeRemaining: number = 120;

  private environmentSystem: EnvironmentSystem = new EnvironmentSystem();
  private comboSystem: ComboSystem = new ComboSystem();
  private particleSystem: ParticleSystem = new ParticleSystem();
  private screenShake: ScreenShake = new ScreenShake();
  private maxCombo: number = 0;
  private tetrisCount: number = 0;
  private themesEncountered: Set<EnvironmentTheme> = new Set();

  // Death animation
  private deathTimer: number = 0;
  private readonly deathDuration: number = 2.0;

  // Board position (used for particles)
  private readonly boardX: number = 80;
  private readonly boardY: number = 50;
  
  // Input handling
  private inputCooldown: { [key: string]: number } = {};
  private inputDelay: number = 150; // ms
  private readonly SOFT_DROP_DELAY = 50;
  private holdPiece: FallingPiece | null = null;
  private hasSwappedThisTurn: boolean = false;

  
  // Visual effects
  private clearingLines: number[] = [];
  private clearAnimationTime: number = 0;
  private clearAnimationDuration: number = 500; // ms
  
  // Scoring
  private scoreMultipliers = {
    single: 100,
    double: 300,
    triple: 500,
    tetris: 800
  };
    private readonly WALL_KICK_TESTS: Vector2[] = [
    new Vector2(0, 0),   // No kick (initial test)
    new Vector2(-1, 0),  // Kick left 1
    new Vector2(1, 0),   // Kick right 1
    new Vector2(0, 1),   // Kick down 1 (useful for floor kicks)
    new Vector2(-1, 1),  //
    new Vector2(1, 1),   //
    ];


  protected onInit(): void {
    // Initialize empty board
    this.board = Array(this.boardHeight).fill(null).map(() =>
      Array(this.boardWidth).fill(null)
    );
    
    // Create first pieces
    this.currentPiece = this.generateRandomPiece();
    this.nextPiece = this.generateRandomPiece();
    
    // Position current piece at top center
    if (this.currentPiece) {
      this.currentPiece.position = new Vector2(
        Math.floor(this.boardWidth / 2) - 1,
        0
      );
    }
    
    this.lastDropTime = Date.now();
    this.timeRemaining = this.timeLimit;
    this.comboSystem.reset();
    this.environmentSystem.updateTheme(this.level);
    this.tetrisCount = 0;
    this.themesEncountered = new Set([this.environmentSystem.getCurrentTheme()]);
  }

  protected onUpdate(dt: number): void {
    // Update visual systems always
    this.particleSystem.update(dt);
    this.screenShake.update(dt);

    if (this.gameState === 'gameOver') return;

    // Handle dying state
    if (this.gameState === 'dying') {
      this.deathTimer += dt;
      if (this.deathTimer >= this.deathDuration) {
        this.gameState = 'gameOver';
        this.endGame();
      }
      return;
    }

    const currentTime = Date.now();

    // Update timer for challenge mode
    this.timeRemaining -= dt;
    if (this.timeRemaining <= 0) {
      this.triggerGameOver();
      return;
    }

    // Update combo timer
    this.comboSystem.update(dt);
    
    // Handle line clearing animation
    if (this.gameState === 'lineClearing') {
      this.clearAnimationTime += dt * 1000;
      if (this.clearAnimationTime >= this.clearAnimationDuration) {
        this.completeLineClear();
      }
      return;
    }
    
    // Handle input with cooldowns
    this.handleInput(currentTime);
    
    // Handle automatic piece dropping
    if (currentTime - this.lastDropTime > this.dropInterval) {
      this.dropPiece();
      this.lastDropTime = currentTime;
    }
  }

    private handleInput(currentTime: number): void {
    if (!this.currentPiece) return;
    
    const input = this.services.input;

    
    // Hard drop (space) - HIGHEST PRIORITY
    if (input.isKeyPressed('Space')) {
        if (!this.inputCooldown['hardDrop'] || currentTime - this.inputCooldown['hardDrop'] > this.inputDelay) {
        this.hardDrop(); 
        this.inputCooldown['hardDrop'] = currentTime;
        }
    } 
    // Rotate
    else if (input.isKeyPressed('ArrowUp') || input.isKeyPressed('KeyW') || input.isActionPressed()) {
        if (!this.inputCooldown['rotate'] || currentTime - this.inputCooldown['rotate'] > this.inputDelay) {
        this.rotatePiece();
        this.inputCooldown['rotate'] = currentTime;
        }
    }
    else if (input.isKeyPressed('KeyC') || input.isKeyPressed('ShiftLeft')) {
        if (!this.inputCooldown['hold'] || currentTime - this.inputCooldown['hold'] > this.inputDelay) {
            this.swapWithHoldPiece();
            this.inputCooldown['hold'] = currentTime;
        }
    }

    // Move left
    else if (input.isKeyPressed('ArrowLeft') || input.isKeyPressed('KeyA')) {
        if (!this.inputCooldown['left'] || currentTime - this.inputCooldown['left'] > this.inputDelay) {
        this.movePiece(-1, 0);
        this.inputCooldown['left'] = currentTime;
        }
    }
    // Move right
    else if (input.isKeyPressed('ArrowRight') || input.isKeyPressed('KeyD')) {
        if (!this.inputCooldown['right'] || currentTime - this.inputCooldown['right'] > this.inputDelay) {
        this.movePiece(1, 0);
        this.inputCooldown['right'] = currentTime;
        }
    }
    // Fast drop (soft drop)
    else if (input.isKeyPressed('ArrowDown') || input.isKeyPressed('KeyS')) {
        if (!this.inputCooldown['drop'] || currentTime - this.inputCooldown['drop'] > this.SOFT_DROP_DELAY) {
        this.dropPiece();
        this.inputCooldown['drop'] = currentTime;
        }
    }
    }

  private generateRandomPiece(): FallingPiece {
    const shapeKeys = Object.keys(PIECE_SHAPES) as (keyof typeof PIECE_SHAPES)[];
  const randomShapeName = shapeKeys[Math.floor(Math.random() * shapeKeys.length)]; 
    const color = COLORS[Math.floor(Math.random() * COLORS.length)];
    
    return {
      shapeName: randomShapeName,

      shape: PIECE_SHAPES[randomShapeName],
      color,
      position: new Vector2(0, 0),
      rotation: 0
    };
  }

  private movePiece(dx: number, dy: number): boolean {
    if (!this.currentPiece) return false;
    
    const newPosition = new Vector2(
      this.currentPiece.position.x + dx,
      this.currentPiece.position.y + dy
    );
    
    if (this.isValidPosition(this.currentPiece.shape, newPosition)) {
      this.currentPiece.position = newPosition;
      this.services.audio.playSound('click');
      return true;
    }
    
    return false;
  }

private rotatePiece(): boolean {
  if (!this.currentPiece) return false;

  const rotatedShape = this.rotateShape(this.currentPiece.shape);

  for (const kick of this.WALL_KICK_TESTS) {
    const newPosition = new Vector2(
      this.currentPiece.position.x + kick.x,
      this.currentPiece.position.y + kick.y
    );

    if (this.isValidPosition(rotatedShape, newPosition)) {
      this.currentPiece.shape = rotatedShape;
      this.currentPiece.position = newPosition; 
      this.currentPiece.rotation = (this.currentPiece.rotation + 1) % 4;
      this.services.audio.playSound('click');
      return true; 
    }
  }
  return false;
}

  private rotateShape(shape: boolean[][]): boolean[][] {
    const rows = shape.length;
    const cols = shape[0].length;
    const rotated: boolean[][] = Array(cols).fill(null).map(() => Array(rows).fill(false));
    
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        rotated[c][rows - 1 - r] = shape[r][c];
      }
    }
    
    return rotated;
  }
  private swapWithHoldPiece(): void {
    if (this.hasSwappedThisTurn) {
        this.services.audio.playSound('error'); 
        return;
    }

    if (this.holdPiece === null) {
        // First time holding: store current piece and spawn the next one
        this.holdPiece = this.currentPiece;
        this.spawnNextPiece();
    } else {
        // Subsequent holds: swap the pieces
        const temp = this.currentPiece;
        this.currentPiece = this.holdPiece;
        this.holdPiece = temp;

        // Reset the newly swapped piece to the top
        if (this.currentPiece) {
        this.currentPiece.position = new Vector2(
            Math.floor(this.boardWidth / 2) - 1,
            0
        );
        // If the new piece spawns in an invalid spot (rare), it's game over
        if (!this.isValidPosition(this.currentPiece.shape, this.currentPiece.position)) {
            this.gameState = 'gameOver';
        }
        }
    }
  
  // Set the flag to prevent another swap until a piece is locked
  this.hasSwappedThisTurn = true;
  this.services.audio.playSound('powerup');
}


  private isValidPosition(shape: boolean[][], position: Vector2): boolean {
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (shape[r][c]) {
          const boardX = position.x + c;
          const boardY = position.y + r;
          
          // Check boundaries
          if (boardX < 0 || boardX >= this.boardWidth || 
              boardY < 0 || boardY >= this.boardHeight) {
            return false;
          }
          
          // Check collision with existing blocks
          if (this.board[boardY][boardX] !== null) {
            return false;
          }
        }
      }
    }
    
    return true;
   }

    private dropPiece(): boolean {
    if (!this.currentPiece) return false;
    
    const canDrop = this.movePiece(0, 1);
    if (!canDrop) {
        this.lockPiece();
    }
    return canDrop;
    }


    private hardDrop(): void {
    if (!this.currentPiece) return;

    const startY = this.currentPiece.position.y;
    let dropDistance = 0;
    while (this.dropPiece()) {
        dropDistance++;
    }

    this.score += dropDistance * 2;

    // Visual effects for hard drop
    if (dropDistance > 2 && this.currentPiece) {
      const colors = this.environmentSystem.getBlockColors();
      const color = colors[this.currentPiece.color];
      const x = this.boardX + (this.currentPiece.position.x + 1) * this.blockSize;
      const y = this.boardY + this.currentPiece.position.y * this.blockSize;
      this.particleSystem.createHardDropTrail(x, y, dropDistance * this.blockSize, color);
      this.screenShake.shake(3, 0.1);
    }

    this.services.audio.playSound('click');
    }

  private lockPiece(): void {
    if (!this.currentPiece) return;

    const colors = this.environmentSystem.getBlockColors();
    const pieceColor = colors[this.currentPiece.color];

    // Place piece on board
    for (let r = 0; r < this.currentPiece.shape.length; r++) {
      for (let c = 0; c < this.currentPiece.shape[r].length; c++) {
        if (this.currentPiece.shape[r][c]) {
          const bx = this.currentPiece.position.x + c;
          const by = this.currentPiece.position.y + r;

          if (by >= 0 && by < this.boardHeight &&
              bx >= 0 && bx < this.boardWidth) {
            this.board[by][bx] = {
              color: this.currentPiece.color,
              locked: true
            };

            // Lock burst effect for each block
            const x = this.boardX + bx * this.blockSize + this.blockSize / 2;
            const y = this.boardY + by * this.blockSize + this.blockSize / 2;
            this.particleSystem.createLockBurst(x, y, pieceColor);
          }
        }
      }
    }

    this.services.audio.playSound('click');
    
    // Check for completed lines
    const completedLines = this.findCompletedLines();
    if (completedLines.length > 0) {
      this.startLineClear(completedLines);
    } else {
      this.comboSystem.reset();
      this.spawnNextPiece();
    }
  }

  private findCompletedLines(): number[] {
    const completed: number[] = [];
    
    for (let row = 0; row < this.boardHeight; row++) {
      if (this.board[row].every(cell => cell !== null)) {
        completed.push(row);
      }
    }
    
    return completed;
  }

  private startLineClear(lines: number[]): void {
    this.clearingLines = lines;
    this.clearAnimationTime = 0;
    this.gameState = 'lineClearing';

    const colors = this.environmentSystem.getBlockColors();
    const colorValues = Object.values(colors);

    // Create line clear particles for each line
    for (const row of lines) {
      this.particleSystem.createLineClearExplosion(
        this.boardX,
        this.boardY,
        row,
        this.boardWidth,
        this.blockSize,
        colorValues
      );
    }

    // Screen shake based on lines cleared
    const shakeIntensity = lines.length === 4 ? 10 : lines.length * 2;
    this.screenShake.shake(shakeIntensity, 0.2 + lines.length * 0.05);

    // Play sound based on number of lines
    if (lines.length === 4) {
      this.services.audio.playSound('powerup'); // Tetris!
      this.particleSystem.createTetrisCelebration(this.canvas.width, this.canvas.height);
    } else {
      this.services.audio.playSound('coin');
    }
  }

  private completeLineClear(): void {
    const linesCount = this.clearingLines.length;
    if (linesCount === 0) return; // Safety check

    // Create a new board containing only the rows that were NOT cleared.
    const newBoard = this.board.filter((_, rowIndex) => {
        return !this.clearingLines.includes(rowIndex);
    });

    // Create the new empty rows that will be added to the top.
    const newEmptyRows: (Block | null)[][] = Array(linesCount).fill(null).map(() => 
        Array(this.boardWidth).fill(null)
    );

    // Combine the new empty rows with the remaining rows.
    this.board = [...newEmptyRows, ...newBoard];
    
    // Update score and stats
    this.linesCleared += linesCount;
    if (linesCount === 4) {
      this.tetrisCount++;
    }
    const scoreKey = linesCount === 1 ? 'single' :
                     linesCount === 2 ? 'double' :
                     linesCount === 3 ? 'triple' : 'tetris';
    const baseScore = this.scoreMultipliers[scoreKey] * this.level;
    const multiplier = this.comboSystem.addClear(linesCount);
    const lineScore = baseScore * multiplier;
    this.score += lineScore;
    if (this.comboSystem.getCombo() > this.maxCombo) {
      this.maxCombo = this.comboSystem.getCombo();
    }
    this.pickups += linesCount;

    // Score popup
    const popupX = this.boardX + (this.boardWidth * this.blockSize) / 2;
    const popupY = this.boardY + this.clearingLines[0] * this.blockSize;
    const popupText = linesCount === 4 ? `TETRIS! +${lineScore}` :
                      multiplier > 1 ? `${linesCount}x COMBO! +${lineScore}` :
                      `+${lineScore}`;
    const popupColor = linesCount === 4 ? '#FBBF24' :
                       linesCount >= 3 ? '#10B981' :
                       multiplier > 1 ? '#8B5CF6' : '#FFFFFF';

    if (linesCount === 4 || multiplier > 1) {
      this.particleSystem.addLargeScorePopup(popupX, popupY, popupText, popupColor);
    } else {
      this.particleSystem.addScorePopup(popupX, popupY, popupText, popupColor);
    }
    
    // Level up every 10 lines
    this.level = Math.floor(this.linesCleared / 10) + 1;
    this.dropInterval = Math.max(50, 1000 * Math.pow(0.95, this.level - 1));
    this.environmentSystem.updateTheme(this.level);
    this.themesEncountered.add(this.environmentSystem.getCurrentTheme());
    
    // Reset state
    this.clearingLines = [];
    this.gameState = 'playing';
    
    this.spawnNextPiece();
  }

  private spawnNextPiece(): void {
    this.hasSwappedThisTurn = false;
    this.currentPiece = this.nextPiece;
    this.nextPiece = this.generateRandomPiece();

    if (this.currentPiece) {
      this.currentPiece.position = new Vector2(
        Math.floor(this.boardWidth / 2) - 1,
        0
      );

      // Check game over
      if (!this.isValidPosition(this.currentPiece.shape, this.currentPiece.position)) {
        this.triggerGameOver();
      }
    }
  }

  private triggerGameOver(): void {
    this.gameState = 'dying';
    this.deathTimer = 0;
    this.services.audio.playSound('game_over');

    // Game over explosion effect
    this.particleSystem.createGameOverExplosion(
      this.boardX,
      this.boardY,
      this.boardWidth,
      this.boardHeight,
      this.blockSize
    );
    this.screenShake.shake(12, 0.5);
  }

  protected onRender(ctx: CanvasRenderingContext2D): void {
    const shake = this.screenShake.getOffset();

    ctx.save();
    ctx.translate(shake.x, shake.y);

    // Clear background with theme gradient
    this.environmentSystem.drawBackground(
      ctx,
      this.canvas.width,
      this.canvas.height
    );

    // Draw board background with subtle glow
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 20;
    ctx.fillStyle = this.environmentSystem.getBoardColor();
    ctx.fillRect(this.boardX, this.boardY, this.boardWidth * this.blockSize, this.boardHeight * this.blockSize);
    ctx.restore();

    ctx.strokeStyle = this.environmentSystem.getGridColor();
    ctx.lineWidth = 1;
    
    // Draw grid
    for (let x = 0; x <= this.boardWidth; x++) {
      ctx.beginPath();
      ctx.moveTo(this.boardX + x * this.blockSize, this.boardY);
      ctx.lineTo(this.boardX + x * this.blockSize, this.boardY + this.boardHeight * this.blockSize);
      ctx.stroke();
    }

    for (let y = 0; y <= this.boardHeight; y++) {
      ctx.beginPath();
      ctx.moveTo(this.boardX, this.boardY + y * this.blockSize);
      ctx.lineTo(this.boardX + this.boardWidth * this.blockSize, this.boardY + y * this.blockSize);
      ctx.stroke();
    }

    // Draw locked blocks
    for (let row = 0; row < this.boardHeight; row++) {
      for (let col = 0; col < this.boardWidth; col++) {
        const block = this.board[row][col];
        if (block) {
          const x = this.boardX + col * this.blockSize;
          const y = this.boardY + row * this.blockSize;

          // Flash effect for clearing lines
          let alpha = 1.0;
          if (this.clearingLines.includes(row)) {
            alpha = 0.5 + 0.5 * Math.sin(this.clearAnimationTime * 0.02);
          }

          this.drawBlock(ctx, x, y, block.color, alpha);
        }
      }
    }

    // Draw current falling piece
    if (this.currentPiece && this.gameState !== 'gameOver' && this.gameState !== 'dying') {
      this.drawPiece(ctx, this.currentPiece, this.boardX, this.boardY);
    }

    // Draw ghost piece (preview of where piece will land)
    if (this.currentPiece && this.gameState === 'playing') {
      this.drawGhostPiece(ctx, this.boardX, this.boardY);
    }

    // Draw next piece preview
    this.drawNextPiece(ctx);

    // Draw UI
    this.drawUI(ctx);

    // Render particles on top
    this.particleSystem.render(ctx);

    // Death overlay
    if (this.gameState === 'dying') {
      const alpha = Math.min(0.7, this.deathTimer / this.deathDuration);
      ctx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

      ctx.fillStyle = '#EF4444';
      ctx.font = 'bold 32px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('GAME OVER', this.canvas.width / 2, this.canvas.height / 2);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '18px Arial';
      ctx.fillText(`Final Score: ${this.score}`, this.canvas.width / 2, this.canvas.height / 2 + 35);
      ctx.fillText(`Lines: ${this.linesCleared} | Level: ${this.level}`, this.canvas.width / 2, this.canvas.height / 2 + 60);
    }

    ctx.restore();
  }

  private drawBlock(ctx: CanvasRenderingContext2D, x: number, y: number, color: BlockColor, alpha: number = 1.0): void {
    const colors = this.environmentSystem.getBlockColors();
    
    ctx.save();
    ctx.globalAlpha = alpha;
    
    // Main block
    ctx.fillStyle = colors[color];
    ctx.fillRect(x + 1, y + 1, this.blockSize - 2, this.blockSize - 2);
    
    // Highlight
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.fillRect(x + 1, y + 1, this.blockSize - 2, 8);
    
    // Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(x + 1, y + this.blockSize - 9, this.blockSize - 2, 8);
    
    ctx.restore();
  }

  private drawPiece(ctx: CanvasRenderingContext2D, piece: FallingPiece, boardX: number, boardY: number): void {
    for (let r = 0; r < piece.shape.length; r++) {
      for (let c = 0; c < piece.shape[r].length; c++) {
        if (piece.shape[r][c]) {
          const x = boardX + (piece.position.x + c) * this.blockSize;
          const y = boardY + (piece.position.y + r) * this.blockSize;
          this.drawBlock(ctx, x, y, piece.color);
        }
      }
    }
  }

    private drawGhostPiece(ctx: CanvasRenderingContext2D, boardX: number, boardY: number): void {
    if (!this.currentPiece) return;

    // Create a temporary clone of the piece to find its landing spot
    const ghostPiece = {
        ...this.currentPiece,
        position: new Vector2(this.currentPiece.position.x, this.currentPiece.position.y)
    };

    // Drop the ghost piece down until it hits something
    while (this.isValidPosition(ghostPiece.shape, new Vector2(ghostPiece.position.x, ghostPiece.position.y + 1))) {
        ghostPiece.position.y++;
    }

    const ghostY = ghostPiece.position.y; // This is the final Y position

    ctx.save();
    ctx.globalAlpha = 0.4;
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 10;
    for (let r = 0; r < this.currentPiece.shape.length; r++) {
      for (let c = 0; c < this.currentPiece.shape[r].length; c++) {
        if (this.currentPiece.shape[r][c]) {
          const x = boardX + (this.currentPiece.position.x + c) * this.blockSize;
          const y = boardY + (ghostY + r) * this.blockSize;
          this.drawBlock(ctx, x, y, this.currentPiece.color, 0.3);
        }
      }
    }
    ctx.restore();
  }

  private drawNextPiece(ctx: CanvasRenderingContext2D): void {
    if (!this.nextPiece) return;
    
    const previewX = 400;
    const previewY = 80;
    
    ctx.fillStyle = '#ffffff';
    ctx.font = '16px Arial';
    ctx.fillText('Next:', previewX, previewY - 10);
    
    for (let r = 0; r < this.nextPiece.shape.length; r++) {
      for (let c = 0; c < this.nextPiece.shape[r].length; c++) {
        if (this.nextPiece.shape[r][c]) {
          const x = previewX + c * 20;
          const y = previewY + r * 20;
          this.drawBlock(ctx, x, y, this.nextPiece.color);
        }
      }
    }
  }

  private drawUI(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#ffffff';
    ctx.font = '18px Arial';
    
    const uiX = 400;
    let uiY = 150;
    
    ctx.fillText(`Score: ${this.score}`, uiX, uiY);
    uiY += 25;
    ctx.fillText(`Level: ${this.level}`, uiX, uiY);
    uiY += 25;
    ctx.fillText(`Lines: ${this.linesCleared}`, uiX, uiY);
    uiY += 25;
    ctx.fillText(`Theme: ${this.environmentSystem.getCurrentTheme()}`, uiX, uiY);
    uiY += 25;
    ctx.fillText(`Time: ${Math.ceil(this.timeRemaining)}s`, uiX, uiY);
    uiY += 25;
    if (this.comboSystem.getCombo() > 1) {
      ctx.fillText(`Combo: ${this.comboSystem.getCombo()}x`, uiX, uiY);
    }
    
    // Controls
    ctx.font = '12px Arial';
    ctx.fillStyle = '#aaaaaa';
    uiY = 300;
    ctx.fillText('Controls:', uiX, uiY);
    uiY += 15;
    ctx.fillText('← → : Move', uiX, uiY);
    uiY += 15;
    ctx.fillText('↑ : Rotate', uiX, uiY);
    uiY += 15;
    ctx.fillText('↓ : Soft drop', uiX, uiY);
    uiY += 15;
    ctx.fillText('Space: Hard drop', uiX, uiY);
  }

  protected onPause(): void {
    this.gameState = 'paused';
  }

  protected onResume(): void {
    if (this.gameState === 'paused') {
      this.gameState = 'playing';
      this.lastDropTime = Date.now(); // Reset drop timer
    }
  }

  protected onRestart(): void {
    this.board = Array(this.boardHeight).fill(null).map(() =>
      Array(this.boardWidth).fill(null)
    );
    this.currentPiece = this.generateRandomPiece();
    this.nextPiece = this.generateRandomPiece();
    this.gameState = 'playing';
    this.level = 1;
    this.linesCleared = 0;
    this.dropInterval = 1000;
    this.clearingLines = [];
    this.clearAnimationTime = 0;
    this.lastDropTime = Date.now();
    this.timeRemaining = this.timeLimit;
    this.comboSystem.reset();
    this.maxCombo = 0;
    this.environmentSystem.updateTheme(this.level);
    this.tetrisCount = 0;
    this.themesEncountered = new Set([this.environmentSystem.getCurrentTheme()]);
    this.deathTimer = 0;
    this.particleSystem.clear();
    this.screenShake.stop();

    if (this.currentPiece) {
      this.currentPiece.position = new Vector2(
        Math.floor(this.boardWidth / 2) - 1,
        0
      );
    }
  }

  getScore() {
    return {
      ...super.getScore(),
      level: this.level,
      linesCleared: this.linesCleared,
      tetrisCount: this.tetrisCount,
      uniqueThemes: this.themesEncountered.size,
      gameState: this.gameState,
      maxCombo: this.maxCombo
    };
  }

  isGameOver(): boolean {
    return this.gameState === 'gameOver' || this.gameState === 'dying';
  }

  protected onGameEnd(finalScore: any): void {
    this.extendedGameData = {
      lines_cleared: this.linesCleared,
      puzzle_level: this.level,
      tetris_count: this.tetrisCount,
      unique_themes: this.themesEncountered.size,
      max_combo: this.maxCombo
    };

    this.services?.analytics?.trackGameSpecificStat?.('puzzle', 'lines_cleared', this.linesCleared);
    this.services?.analytics?.trackGameSpecificStat?.('puzzle', 'puzzle_level', this.level);
    this.services?.analytics?.trackGameSpecificStat?.('puzzle', 'tetris_count', this.tetrisCount);
    this.services?.analytics?.trackGameSpecificStat?.('puzzle', 'unique_themes', this.themesEncountered.size);
    this.services?.analytics?.trackGameSpecificStat?.('puzzle', 'max_combo', this.maxCombo);

    super.onGameEnd?.(finalScore);
  }
}