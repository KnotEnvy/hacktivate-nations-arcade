import { BaseGame } from '@/games/shared/BaseGame';
import { GameManifest } from '@/lib/types';
import { Vector2 } from '@/games/shared/utils/Vector2';

interface Spawnable {
  position: Vector2;
}

export class SnakeGame extends BaseGame {
  manifest: GameManifest = {
    id: 'snake',
    title: 'Snake',
    thumbnail: '/games/snake/snake-thumb.svg',
    inputSchema: ['keyboard', 'touch'],
    assetBudgetKB: 60,
    tier: 0,
    description: 'Classic snake action. Eat food and coins to grow!',
  };

  // Scale up the game board so the action fills more of the canvas
  private gridSize = 26;
  private gridWidth = 30;
  private gridHeight = 22;

  // Calculated offsets so the board is centered
  private get offsetX(): number {
    return (this.canvas.width - this.gridWidth * this.gridSize) / 2;
  }

  private get offsetY(): number {
    return (this.canvas.height - this.gridHeight * this.gridSize) / 2;
  }

  private snake: Vector2[] = [];
  private direction: Vector2 = new Vector2(1, 0);
  private nextDirection: Vector2 = new Vector2(1, 0);

  private food: Spawnable = { position: new Vector2() };
  private coin: Spawnable | null = null;
  private coinTimer = 0;
  private coinInterval = 5; // seconds

  private moveTimer = 0;
  private speed = 8; // cells per second

  protected onInit(): void {
    this.reset();
  }

  protected onUpdate(dt: number): void {
    this.handleInput();

    this.moveTimer += dt;
    if (this.moveTimer >= 1 / this.speed) {
      this.moveTimer = 0;
      this.step();
    }

    this.coinTimer += dt;
    if (this.coinTimer >= this.coinInterval) {
      this.coinTimer = 0;
      if (!this.coin) {
        this.spawnCoin();
      }
    }
  }

  protected onRender(ctx: CanvasRenderingContext2D): void {
    const tile = this.gridSize;
    const boardW = this.gridWidth * tile;
    const boardH = this.gridHeight * tile;
    const x0 = this.offsetX;
    const y0 = this.offsetY;

    // background similar to RunnerGame
    const gradient = ctx.createLinearGradient(0, y0, 0, y0 + boardH);
    gradient.addColorStop(0, '#083344');
    gradient.addColorStop(1, '#065f46');
    ctx.fillStyle = gradient;
    ctx.fillRect(x0, y0, boardW, boardH);

    // light grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    for (let gx = 0; gx <= this.gridWidth; gx++) {
      const gxPos = x0 + gx * tile;
      ctx.beginPath();
      ctx.moveTo(gxPos, y0);
      ctx.lineTo(gxPos, y0 + boardH);
      ctx.stroke();
    }
    for (let gy = 0; gy <= this.gridHeight; gy++) {
      const gyPos = y0 + gy * tile;
      ctx.beginPath();
      ctx.moveTo(x0, gyPos);
      ctx.lineTo(x0 + boardW, gyPos);
      ctx.stroke();
    }

    // draw food
    ctx.fillStyle = '#e11d48';
    ctx.beginPath();
    ctx.arc(
      x0 + this.food.position.x * tile + tile / 2,
      y0 + this.food.position.y * tile + tile / 2,
      tile / 2 - 3,
      0,
      Math.PI * 2
    );
    ctx.fill();

    // draw coin
    if (this.coin) {
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(
        x0 + this.coin.position.x * tile + tile / 2,
        y0 + this.coin.position.y * tile + tile / 2,
        tile / 2 - 3,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }

    const time = Date.now() * 0.002;
    this.snake.forEach((seg, i) => {
      const drawX = x0 + seg.x * tile;
      const drawY = y0 + seg.y * tile;
      if (i === 0) {
        // head with eyes
        ctx.fillStyle = '#4ade80';
        ctx.fillRect(drawX + 1, drawY + 1, tile - 2, tile - 2);
        ctx.fillStyle = '#ffffff';
        const eye = tile / 6;
        ctx.fillRect(drawX + tile * 0.25 - eye / 2, drawY + tile * 0.3, eye, eye);
        ctx.fillRect(drawX + tile * 0.75 - eye / 2 - eye, drawY + tile * 0.3, eye, eye);
      } else if (i === this.snake.length - 1) {
        ctx.fillStyle = '#059669';
        ctx.fillRect(drawX + 1, drawY + 1, tile - 2, tile - 2);
      } else {
        const hue = (time * 40 + i * 10) % 360;
        ctx.fillStyle = `hsl(${hue}, 80%, 50%)`;
        ctx.fillRect(drawX + 1, drawY + 1, tile - 2, tile - 2);
      }
    });
  }

  protected onRestart(): void {
    this.reset();
  }

  isGameOver(): boolean {
    return !this.isRunning;
  }

  private reset(): void {
    const center = new Vector2(
      Math.floor(this.gridWidth / 2),
      Math.floor(this.gridHeight / 2)
    );
    // Start with a head, body and tail so the snake feels alive from the start
    this.snake = [
      center.clone(),
      center.clone().add(new Vector2(-1, 0)),
      center.clone().add(new Vector2(-2, 0)),
    ];
    this.direction = new Vector2(1, 0);
    this.nextDirection = this.direction;
    this.spawnFood();
    this.coin = null;
    this.coinTimer = 0;
    this.speed = 8;
    this.score = 0;
    this.pickups = 0;
  }

  private step(): void {
    const newHead = this.snake[0].clone().add(this.nextDirection);

    // check collisions
    if (this.hitWall(newHead) || this.snake.some(s => s.x === newHead.x && s.y === newHead.y)) {
      this.endGame();
      return;
    }

    this.snake.unshift(newHead);

    if (newHead.x === this.food.position.x && newHead.y === this.food.position.y) {
      this.score += 10;
      this.spawnFood();
      this.speed += 0.05;
      this.services.audio.playSound('success');
    } else if (this.coin && newHead.x === this.coin.position.x && newHead.y === this.coin.position.y) {
      this.score += 20;
      this.pickups += 1;
      this.coin = null;
      this.services.audio.playSound('coin');
    } else {
      this.snake.pop();
    }

    this.direction = this.nextDirection;
  }

  private hitWall(pos: Vector2): boolean {
    return pos.x < 0 || pos.x >= this.gridWidth || pos.y < 0 || pos.y >= this.gridHeight;
  }

  private spawnFood(): void {
    this.food.position = this.randomEmptyCell();
  }

  private spawnCoin(): void {
    this.coin = { position: this.randomEmptyCell() };
  }

  private randomEmptyCell(): Vector2 {
    let pos: Vector2;
    do {
      pos = new Vector2(
        Math.floor(Math.random() * this.gridWidth),
        Math.floor(Math.random() * this.gridHeight)
      );
    } while (this.snake.some(s => s.x === pos.x && s.y === pos.y) || (this.food && pos.x === this.food.position.x && pos.y === this.food.position.y));
    return pos;
  }

  private handleInput(): void {
    if (this.services.input.isLeftPressed() && this.direction.x !== 1) {
      this.nextDirection = new Vector2(-1, 0);
    } else if (this.services.input.isRightPressed() && this.direction.x !== -1) {
      this.nextDirection = new Vector2(1, 0);
    } else if (this.services.input.isUpPressed() && this.direction.y !== 1) {
      this.nextDirection = new Vector2(0, -1);
    } else if (this.services.input.isDownPressed() && this.direction.y !== -1) {
      this.nextDirection = new Vector2(0, 1);
    }
  }
}
