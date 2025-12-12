import { BaseGame } from '@/games/shared/BaseGame';
import { GameManifest } from '@/lib/types';
import { Vector2 } from '@/games/shared/utils/Vector2';

interface Spawnable {
  position: Vector2;
}

type SnakePowerUpType = 'wrap' | 'slow' | 'double';

interface ActivePowerUp {
  type: SnakePowerUpType;
  duration: number;
  maxDuration: number;
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

  private lastTouch: { x: number; y: number } | null = null;
  private readonly touchThreshold = 14;

  private food: Spawnable = { position: new Vector2() };
  private coin: Spawnable | null = null;
  private coinTimer = 0;
  private coinInterval = 5; // seconds
  private coinAge = 0;
  private coinLifetime = 6; // seconds before disappearing
  private coinBlinkTime = 1; // blink for the last second

  private powerUp: (Spawnable & { type: SnakePowerUpType }) | null = null;
  private powerUpTimer = 0;
  private powerUpInterval = 12; // seconds
  private powerUpAge = 0;
  private powerUpLifetime = 8; // seconds
  private powerUpBlinkTime = 1.2; // blink near expiry
  private activePowerUps: ActivePowerUp[] = [];
  private pendingGrowth = 0;

  private colorTimer = 0;
  private readonly colorDuration = 1.25; // seconds

  private moveTimer = 0;
  private baseSpeed = 8; // cells per second

  private foodEaten = 0;
  private maxLength = 0;
  private powerupsUsed = 0;
  private powerupTypesUsed: Set<SnakePowerUpType> = new Set();
  private highScore = 0;

  protected onInit(): void {
    this.reset();
    try {
      const saved = localStorage.getItem('snake_best');
      this.highScore = saved ? parseInt(saved, 10) || 0 : 0;
    } catch {
      this.highScore = 0;
    }
  }

  protected onUpdate(dt: number): void {
    this.handleInput();

    const effectiveSpeed = this.hasPowerUp('slow') ? this.baseSpeed * 0.6 : this.baseSpeed;
    this.moveTimer += dt;
    if (this.moveTimer >= 1 / effectiveSpeed) {
      this.moveTimer = 0;
      this.step();
    }

    if (this.coin) {
      this.coinAge += dt;
      if (this.coinAge >= this.coinLifetime) {
        this.coin = null;
        this.coinAge = 0;
        this.coinTimer = 0;
      }
    }

    if (this.powerUp) {
      this.powerUpAge += dt;
      if (this.powerUpAge >= this.powerUpLifetime) {
        this.powerUp = null;
        this.powerUpAge = 0;
        this.powerUpTimer = 0;
      }
    }

    if (this.colorTimer > 0) {
      this.colorTimer = Math.max(0, this.colorTimer - dt);
    }

    this.coinTimer += dt;
    if (this.coinTimer >= this.coinInterval) {
      this.coinTimer = 0;
      if (!this.coin) {
        this.spawnCoin();
      }
    }

    this.powerUpTimer += dt;
    if (this.powerUpTimer >= this.powerUpInterval) {
      this.powerUpTimer = 0;
      if (!this.powerUp) {
        this.spawnPowerUp();
      }
    }

    for (const p of this.activePowerUps) {
      p.duration -= dt;
    }
    this.activePowerUps = this.activePowerUps.filter(p => p.duration > 0);
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
      const cx = x0 + this.coin.position.x * tile + tile / 2;
      const cy = y0 + this.coin.position.y * tile + tile / 2;
      const blinkStart = this.coinLifetime - this.coinBlinkTime;
      const showCoin =
        this.coinAge < blinkStart ||
        Math.floor((this.coinAge - blinkStart) * 8) % 2 === 0;

      if (showCoin) {
        ctx.fillStyle = '#FCD34D';
        ctx.beginPath();
        ctx.arc(cx, cy, tile / 2 - 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#92400E';
        ctx.font = `bold ${tile * 0.6}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('$', cx, cy + 1);
      }
    }

    if (this.powerUp) {
      const px = x0 + this.powerUp.position.x * tile + tile / 2;
      const py = y0 + this.powerUp.position.y * tile + tile / 2;
      const blinkStart = this.powerUpLifetime - this.powerUpBlinkTime;
      const showPowerUp =
        this.powerUpAge < blinkStart ||
        Math.floor((this.powerUpAge - blinkStart) * 8) % 2 === 0;

      if (showPowerUp) {
        ctx.fillStyle = this.getPowerUpColor(this.powerUp.type);
        ctx.beginPath();
        ctx.arc(px, py, tile / 2 - 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#0f172a';
        ctx.font = `bold ${tile * 0.5}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.getPowerUpIcon(this.powerUp.type), px, py + 1);
      }
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
        ctx.fillRect(
          drawX + tile * 0.25 - eye / 2,
          drawY + tile * 0.3,
          eye,
          eye
        );
        ctx.fillRect(
          drawX + tile * 0.75 - eye / 2 - eye,
          drawY + tile * 0.3,
          eye,
          eye
        );
      } else if (i === this.snake.length - 1) {
        ctx.fillStyle = '#059669';
        ctx.fillRect(drawX + 1, drawY + 1, tile - 2, tile - 2);
      } else {
        if (this.colorTimer > 0) {
          const hue = (time * 40 + i * 10) % 360;
          ctx.fillStyle = `hsl(${hue}, 80%, 50%)`;
        } else {
          ctx.fillStyle = '#10b981';
        }
        ctx.fillRect(drawX + 1, drawY + 1, tile - 2, tile - 2);
      }
    });
  }

  protected onRenderUI(ctx: CanvasRenderingContext2D): void {
    let y = this.getHudStartY();
    ctx.textAlign = 'left';
    ctx.font = '14px Arial';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(`Length: ${this.snake.length}`, 20, y);
    y += 18;
    ctx.fillStyle = '#94A3B8';
    ctx.fillText(`Best: ${this.highScore}`, 20, y);
    y += 18;

    for (const p of this.activePowerUps) {
      ctx.fillStyle = this.getPowerUpColor(p.type);
      ctx.fillText(
        `${this.getPowerUpLabel(p.type)} ${p.duration.toFixed(1)}s`,
        20,
        y
      );
      y += 18;
    }
  }

  protected onRestart(): void {
    this.reset();
  }

  isGameOver(): boolean {
    return !this.isRunning;
  }

  protected onGameEnd(finalScore: any): void {
    try {
      if (this.score > this.highScore) {
        this.highScore = this.score;
        localStorage.setItem('snake_best', String(this.highScore));
      }
    } catch {
      /* ignore */
    }

    this.extendedGameData = {
      snake_length: this.snake.length,
      final_speed: this.baseSpeed,
      food_eaten: this.foodEaten,
      max_length: this.maxLength,
      powerupsUsed: this.powerupsUsed,
      powerupTypesUsed: [...this.powerupTypesUsed],
    };

    this.services?.analytics?.trackGameSpecificStat?.('snake', 'snake_length', this.snake.length);
    this.services?.analytics?.trackGameSpecificStat?.('snake', 'final_speed', this.baseSpeed);
    this.services?.analytics?.trackGameSpecificStat?.('snake', 'food_eaten', this.foodEaten);
    this.services?.analytics?.trackGameSpecificStat?.('snake', 'powerups_used', this.powerupsUsed);

    super.onGameEnd?.(finalScore);
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
    this.powerUp = null;
    this.coinTimer = 0;
    this.coinAge = 0;
    this.powerUpTimer = 0;
    this.powerUpAge = 0;
    this.activePowerUps = [];
    this.pendingGrowth = 0;
    this.colorTimer = 0;
    this.baseSpeed = 8;
    this.score = 0;
    this.pickups = 0;
    this.foodEaten = 0;
    this.maxLength = this.snake.length;
    this.powerupsUsed = 0;
    this.powerupTypesUsed.clear();
  }

  private step(): void {
    const newHead = this.snake[0].clone().add(this.nextDirection);

    if (this.hasPowerUp('wrap')) {
      if (newHead.x < 0) newHead.x = this.gridWidth - 1;
      if (newHead.x >= this.gridWidth) newHead.x = 0;
      if (newHead.y < 0) newHead.y = this.gridHeight - 1;
      if (newHead.y >= this.gridHeight) newHead.y = 0;
    }

    // check collisions
    if (
      (!this.hasPowerUp('wrap') && this.hitWall(newHead)) ||
      this.snake.some(s => s.x === newHead.x && s.y === newHead.y)
    ) {
      this.services.audio.playSound('collision');
      this.endGame();
      return;
    }

    this.snake.unshift(newHead);

    const ateFood =
      newHead.x === this.food.position.x &&
      newHead.y === this.food.position.y;
    const ateCoin =
      this.coin &&
      newHead.x === this.coin.position.x &&
      newHead.y === this.coin.position.y;
    const atePowerUp =
      this.powerUp &&
      newHead.x === this.powerUp.position.x &&
      newHead.y === this.powerUp.position.y;

    if (ateFood) {
      this.score += 10;
      this.foodEaten++;
      this.spawnFood();
      this.baseSpeed += 0.05;
      if (this.hasPowerUp('double')) {
        this.pendingGrowth += 1;
      }
      this.services.audio.playSound('success');
    } else if (ateCoin) {
      this.score += 20;
      this.pickups += 1;
      this.coin = null;
      this.coinAge = 0;
      this.coinTimer = 0;
      this.colorTimer = this.colorDuration;
      this.services.audio.playSound('coin');
      this.consumePendingGrowthOrPop();
    } else if (atePowerUp) {
      const type = this.powerUp!.type;
      this.activatePowerUp(type);
      this.powerupsUsed++;
      this.powerupTypesUsed.add(type);
      this.score += 30;
      this.powerUp = null;
      this.powerUpAge = 0;
      this.powerUpTimer = 0;
      this.services.audio.playSound('powerup');
      this.consumePendingGrowthOrPop();
    } else {
      this.consumePendingGrowthOrPop();
    }

    this.direction = this.nextDirection;
    this.baseSpeed += 0.002; // gradual difficulty increase
    this.maxLength = Math.max(this.maxLength, this.snake.length);
  }

  private hitWall(pos: Vector2): boolean {
    return (
      pos.x < 0 ||
      pos.x >= this.gridWidth ||
      pos.y < 0 ||
      pos.y >= this.gridHeight
    );
  }

  private spawnFood(): void {
    this.food.position = this.randomEmptyCell();
  }

  private spawnCoin(): void {
    this.coin = { position: this.randomEmptyCell() };
    this.coinAge = 0;
  }

  private spawnPowerUp(): void {
    this.powerUp = {
      position: this.randomEmptyCell(),
      type: this.randomPowerUpType(),
    };
    this.powerUpAge = 0;
  }

  private randomEmptyCell(): Vector2 {
    let pos: Vector2;
    do {
      pos = new Vector2(
        Math.floor(Math.random() * this.gridWidth),
        Math.floor(Math.random() * this.gridHeight)
      );
    } while (
      this.snake.some(s => s.x === pos.x && s.y === pos.y) ||
      (this.food &&
        pos.x === this.food.position.x &&
        pos.y === this.food.position.y) ||
      (this.coin &&
        pos.x === this.coin.position.x &&
        pos.y === this.coin.position.y) ||
      (this.powerUp &&
        pos.x === this.powerUp.position.x &&
        pos.y === this.powerUp.position.y)
    );
    return pos;
  }

  private randomPowerUpType(): SnakePowerUpType {
    const r = Math.random();
    if (r < 0.45) return 'double';
    if (r < 0.75) return 'slow';
    return 'wrap';
  }

  private activatePowerUp(type: SnakePowerUpType): void {
    const duration = this.getPowerUpDuration(type);
    const existing = this.activePowerUps.find(p => p.type === type);
    if (existing) {
      existing.duration += duration;
      existing.maxDuration += duration;
    } else {
      this.activePowerUps.push({ type, duration, maxDuration: duration });
    }
  }

  private hasPowerUp(type: SnakePowerUpType): boolean {
    return this.activePowerUps.some(p => p.type === type);
  }

  private getPowerUpDuration(type: SnakePowerUpType): number {
    switch (type) {
      case 'wrap': return 8;
      case 'slow': return 6;
      case 'double': return 7;
      default: return 6;
    }
  }

  private getPowerUpColor(type: SnakePowerUpType): string {
    switch (type) {
      case 'wrap': return '#A855F7';
      case 'slow': return '#38BDF8';
      case 'double': return '#FBBF24';
      default: return '#FFFFFF';
    }
  }

  private getPowerUpIcon(type: SnakePowerUpType): string {
    switch (type) {
      case 'wrap': return 'W';
      case 'slow': return 'S';
      case 'double': return 'G';
      default: return '?';
    }
  }

  private getPowerUpLabel(type: SnakePowerUpType): string {
    switch (type) {
      case 'wrap': return 'Wrap Walls';
      case 'slow': return 'Slow Time';
      case 'double': return 'Double Growth';
      default: return 'Power-Up';
    }
  }

  private consumePendingGrowthOrPop(): void {
    if (this.pendingGrowth > 0) {
      this.pendingGrowth -= 1;
    } else {
      this.snake.pop();
    }
  }

  private handleInput(): void {
    const touches = this.services.input.getTouches?.() || [];
    if (touches.length > 0) {
      const t = touches[0];
      if (!this.lastTouch) {
        this.lastTouch = { x: t.x, y: t.y };
      } else {
        const dx = t.x - this.lastTouch.x;
        const dy = t.y - this.lastTouch.y;
        const absDx = Math.abs(dx);
        const absDy = Math.abs(dy);

        if (Math.max(absDx, absDy) >= this.touchThreshold) {
          if (absDx > absDy) {
            if (dx > 0 && this.direction.x !== -1) {
              this.nextDirection = new Vector2(1, 0);
            } else if (dx < 0 && this.direction.x !== 1) {
              this.nextDirection = new Vector2(-1, 0);
            }
          } else {
            if (dy > 0 && this.direction.y !== -1) {
              this.nextDirection = new Vector2(0, 1);
            } else if (dy < 0 && this.direction.y !== 1) {
              this.nextDirection = new Vector2(0, -1);
            }
          }
          this.lastTouch = { x: t.x, y: t.y };
        }
      }
    } else {
      this.lastTouch = null;
    }

    if (this.services.input.isLeftPressed() && this.direction.x !== 1) {
      this.nextDirection = new Vector2(-1, 0);
    } else if (
      this.services.input.isRightPressed() &&
      this.direction.x !== -1
    ) {
      this.nextDirection = new Vector2(1, 0);
    } else if (this.services.input.isUpPressed() && this.direction.y !== 1) {
      this.nextDirection = new Vector2(0, -1);
    } else if (this.services.input.isDownPressed() && this.direction.y !== -1) {
      this.nextDirection = new Vector2(0, 1);
    }
  }
}
