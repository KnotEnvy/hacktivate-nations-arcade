// ===== src/games/bubble/systems/BubbleGrid.ts =====

import { Bubble, BubbleColor, PowerUpType, BUBBLE_COLORS } from '../entities/Bubble';

export interface GridConfig {
  cols: number;
  rows: number;
  bubbleSize: number;
  offsetX: number;
  offsetY: number;
}

export interface MatchResult {
  matches: Bubble[];
  orphans: Bubble[];
  powerUpTriggered: PowerUpType | null;
}

export class BubbleGrid {
  private grid: (Bubble | null)[][];
  private config: GridConfig;
  private fallingBubbles: Bubble[] = [];

  // Stats
  public totalPopped: number = 0;
  public maxChain: number = 0;
  private currentChain: number = 0;

  // Available colors (can be reduced as rows clear)
  private availableColors: BubbleColor[] = ['red', 'blue', 'green', 'yellow', 'purple', 'orange'];

  // Ceiling descent
  public ceilingOffset: number = 0;

  constructor(config: GridConfig) {
    this.config = config;
    this.grid = [];
    this.initializeGrid();
  }

  private initializeGrid(): void {
    this.grid = [];
    for (let row = 0; row < this.config.rows; row++) {
      this.grid[row] = [];
      for (let col = 0; col < this.getColsForRow(row); col++) {
        this.grid[row][col] = null;
      }
    }
  }

  private getColsForRow(row: number): number {
    // Odd rows have one fewer column in hexagonal grid
    return row % 2 === 0 ? this.config.cols : this.config.cols - 1;
  }

  public fillInitialBubbles(rows: number): void {
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < this.getColsForRow(row); col++) {
        const color = this.getRandomColor();
        const bubble = new Bubble({
          gridX: col,
          gridY: row,
          color: color,
        });
        bubble.updateScreenPosition(
          this.config.offsetX,
          this.config.offsetY + this.ceilingOffset,
          this.config.bubbleSize
        );
        this.grid[row][col] = bubble;
      }
    }

    // Reduce initial colors for easier matching
    this.updateAvailableColors();
  }

  private getRandomColor(): BubbleColor {
    return this.availableColors[Math.floor(Math.random() * this.availableColors.length)];
  }

  public getRandomAvailableColor(): BubbleColor {
    // Get colors that actually exist in the grid
    const colorsInGrid = new Set<BubbleColor>();
    for (let row = 0; row < this.grid.length; row++) {
      for (let col = 0; col < this.getColsForRow(row); col++) {
        const bubble = this.grid[row]?.[col];
        if (bubble?.color) {
          colorsInGrid.add(bubble.color);
        }
      }
    }

    const available = Array.from(colorsInGrid);
    if (available.length === 0) {
      return this.getRandomColor();
    }

    // 70% chance to pick a color from grid, 30% random
    if (Math.random() < 0.7) {
      return available[Math.floor(Math.random() * available.length)];
    }
    return this.getRandomColor();
  }

  private updateAvailableColors(): void {
    // Update available colors based on what's in the grid
    const colorsInGrid = new Set<BubbleColor>();
    for (let row = 0; row < this.grid.length; row++) {
      for (let col = 0; col < this.getColsForRow(row); col++) {
        const bubble = this.grid[row]?.[col];
        if (bubble?.color) {
          colorsInGrid.add(bubble.color);
        }
      }
    }

    if (colorsInGrid.size > 0) {
      this.availableColors = Array.from(colorsInGrid);
    }
  }

  public update(dt: number): void {
    // Update all bubbles in grid
    for (let row = 0; row < this.grid.length; row++) {
      for (let col = 0; col < this.getColsForRow(row); col++) {
        const bubble = this.grid[row]?.[col];
        if (bubble) {
          bubble.updateScreenPosition(
            this.config.offsetX,
            this.config.offsetY + this.ceilingOffset,
            this.config.bubbleSize
          );
          bubble.update(dt);
        }
      }
    }

    // Update falling bubbles
    for (const bubble of this.fallingBubbles) {
      bubble.update(dt);
    }

    // Remove off-screen falling bubbles
    this.fallingBubbles = this.fallingBubbles.filter(
      b => !b.isOffScreen(600)
    );
  }

  public render(ctx: CanvasRenderingContext2D): void {
    // Render grid bubbles
    for (let row = 0; row < this.grid.length; row++) {
      for (let col = 0; col < this.getColsForRow(row); col++) {
        const bubble = this.grid[row]?.[col];
        if (bubble && !bubble.isPopping) {
          bubble.render(ctx);
        }
      }
    }

    // Render popping bubbles (on top)
    for (let row = 0; row < this.grid.length; row++) {
      for (let col = 0; col < this.getColsForRow(row); col++) {
        const bubble = this.grid[row]?.[col];
        if (bubble?.isPopping) {
          bubble.render(ctx);
        }
      }
    }

    // Render falling bubbles
    for (const bubble of this.fallingBubbles) {
      bubble.render(ctx);
    }
  }

  public findSnapPosition(x: number, y: number): { gridX: number; gridY: number } | null {
    // Find the closest valid grid position
    let bestDist = Infinity;
    let bestPos: { gridX: number; gridY: number } | null = null;

    for (let row = 0; row < this.config.rows; row++) {
      for (let col = 0; col < this.getColsForRow(row); col++) {
        if (this.grid[row]?.[col] !== null) continue;

        // Check if this position has an adjacent bubble
        if (!this.hasAdjacentBubble(col, row) && row > 0) continue;

        const pos = this.getScreenPosition(col, row);
        const dist = Math.sqrt((x - pos.x) ** 2 + (y - pos.y) ** 2);

        if (dist < bestDist && dist < this.config.bubbleSize * 1.5) {
          bestDist = dist;
          bestPos = { gridX: col, gridY: row };
        }
      }
    }

    return bestPos;
  }

  private hasAdjacentBubble(col: number, row: number): boolean {
    const neighbors = this.getNeighborPositions(col, row);
    for (const neighbor of neighbors) {
      if (this.grid[neighbor.row]?.[neighbor.col] !== null) {
        return true;
      }
    }
    return false;
  }

  private getNeighborPositions(col: number, row: number): { col: number; row: number }[] {
    const neighbors: { col: number; row: number }[] = [];
    const isOddRow = row % 2 === 1;

    // Hexagonal neighbors
    // Same row: left and right
    neighbors.push({ col: col - 1, row });
    neighbors.push({ col: col + 1, row });

    // Row above
    if (isOddRow) {
      neighbors.push({ col: col, row: row - 1 });
      neighbors.push({ col: col + 1, row: row - 1 });
    } else {
      neighbors.push({ col: col - 1, row: row - 1 });
      neighbors.push({ col: col, row: row - 1 });
    }

    // Row below
    if (isOddRow) {
      neighbors.push({ col: col, row: row + 1 });
      neighbors.push({ col: col + 1, row: row + 1 });
    } else {
      neighbors.push({ col: col - 1, row: row + 1 });
      neighbors.push({ col: col, row: row + 1 });
    }

    // Filter valid positions
    return neighbors.filter(n =>
      n.row >= 0 &&
      n.row < this.config.rows &&
      n.col >= 0 &&
      n.col < this.getColsForRow(n.row)
    );
  }

  public addBubble(bubble: Bubble): MatchResult {
    const { gridX, gridY } = bubble;

    // Place bubble in grid
    if (!this.grid[gridY]) {
      this.grid[gridY] = [];
    }
    this.grid[gridY][gridX] = bubble;
    bubble.updateScreenPosition(
      this.config.offsetX,
      this.config.offsetY + this.ceilingOffset,
      this.config.bubbleSize
    );

    // Check for matches
    return this.checkMatches(gridX, gridY, bubble);
  }

  private checkMatches(col: number, row: number, bubble: Bubble): MatchResult {
    const result: MatchResult = {
      matches: [],
      orphans: [],
      powerUpTriggered: null,
    };

    // Handle power-ups
    if (bubble.powerUp) {
      result.powerUpTriggered = bubble.powerUp;
      const affected = this.handlePowerUp(bubble);
      result.matches = affected;
    } else if (bubble.color) {
      // Find matching bubbles
      const matches = this.findMatches(col, row, bubble.color);

      if (matches.length >= 3) {
        result.matches = matches;
        this.currentChain++;
        if (this.currentChain > this.maxChain) {
          this.maxChain = this.currentChain;
        }
      }
    }

    // Pop matches
    for (const match of result.matches) {
      match.startPop();
      this.totalPopped++;
    }

    // Find orphans after removing matches
    if (result.matches.length > 0) {
      // Wait a frame then find orphans
      setTimeout(() => {
        this.removePopppedBubbles();
        result.orphans = this.findOrphans();
        for (const orphan of result.orphans) {
          orphan.startFall();
          this.fallingBubbles.push(orphan);
          this.totalPopped++;
        }
        this.removeOrphans(result.orphans);
        this.updateAvailableColors();
      }, 200);
    } else {
      this.currentChain = 0;
    }

    return result;
  }

  private findMatches(col: number, row: number, color: BubbleColor): Bubble[] {
    const matches: Bubble[] = [];
    const visited = new Set<string>();

    const flood = (c: number, r: number) => {
      const key = `${c},${r}`;
      if (visited.has(key)) return;
      visited.add(key);

      const bubble = this.grid[r]?.[c];
      if (!bubble || bubble.color !== color) return;

      matches.push(bubble);

      // Check neighbors
      const neighbors = this.getNeighborPositions(c, r);
      for (const neighbor of neighbors) {
        flood(neighbor.col, neighbor.row);
      }
    };

    flood(col, row);
    return matches;
  }

  private handlePowerUp(bubble: Bubble): Bubble[] {
    const affected: Bubble[] = [];
    const { gridX, gridY, powerUp } = bubble;

    switch (powerUp) {
      case 'bomb': {
        // Destroy all bubbles in 2-tile radius
        for (let row = 0; row < this.grid.length; row++) {
          for (let col = 0; col < this.getColsForRow(row); col++) {
            const b = this.grid[row]?.[col];
            if (!b) continue;

            const dx = Math.abs(col - gridX);
            const dy = Math.abs(row - gridY);
            if (dx <= 2 && dy <= 2) {
              affected.push(b);
            }
          }
        }
        break;
      }

      case 'rainbow': {
        // Destroy all bubbles of the most common color
        const colorCounts = new Map<BubbleColor, number>();
        for (let row = 0; row < this.grid.length; row++) {
          for (let col = 0; col < this.getColsForRow(row); col++) {
            const b = this.grid[row]?.[col];
            if (b?.color) {
              colorCounts.set(b.color, (colorCounts.get(b.color) || 0) + 1);
            }
          }
        }

        let maxColor: BubbleColor | null = null;
        let maxCount = 0;
        for (const [color, count] of colorCounts) {
          if (count > maxCount) {
            maxCount = count;
            maxColor = color;
          }
        }

        if (maxColor) {
          for (let row = 0; row < this.grid.length; row++) {
            for (let col = 0; col < this.getColsForRow(row); col++) {
              const b = this.grid[row]?.[col];
              if (b?.color === maxColor) {
                affected.push(b);
              }
            }
          }
        }
        break;
      }

      case 'lightning': {
        // Destroy entire row
        for (let col = 0; col < this.getColsForRow(gridY); col++) {
          const b = this.grid[gridY]?.[col];
          if (b) {
            affected.push(b);
          }
        }
        break;
      }

      case 'freeze': {
        // Freeze slows ceiling descent (handled in main game)
        // Also matches adjacent bubbles
        const neighbors = this.getNeighborPositions(gridX, gridY);
        for (const n of neighbors) {
          const b = this.grid[n.row]?.[n.col];
          if (b) {
            affected.push(b);
          }
        }
        break;
      }

      case 'star': {
        // Destroy random scattered bubbles
        const allBubbles: Bubble[] = [];
        for (let row = 0; row < this.grid.length; row++) {
          for (let col = 0; col < this.getColsForRow(row); col++) {
            const b = this.grid[row]?.[col];
            if (b && b !== bubble) {
              allBubbles.push(b);
            }
          }
        }
        // Pick random 8-12 bubbles
        const count = Math.min(allBubbles.length, 8 + Math.floor(Math.random() * 5));
        for (let i = 0; i < count; i++) {
          const idx = Math.floor(Math.random() * allBubbles.length);
          affected.push(allBubbles.splice(idx, 1)[0]);
        }
        break;
      }
    }

    // Include the power-up bubble itself
    affected.push(bubble);
    return affected;
  }

  private findOrphans(): Bubble[] {
    // Bubbles not connected to top row are orphans
    const connected = new Set<string>();

    // Start from top row
    for (let col = 0; col < this.getColsForRow(0); col++) {
      if (this.grid[0]?.[col]) {
        this.floodConnected(col, 0, connected);
      }
    }

    // Find all bubbles not in connected set
    const orphans: Bubble[] = [];
    for (let row = 1; row < this.grid.length; row++) {
      for (let col = 0; col < this.getColsForRow(row); col++) {
        const bubble = this.grid[row]?.[col];
        if (bubble && !connected.has(`${col},${row}`)) {
          orphans.push(bubble);
        }
      }
    }

    return orphans;
  }

  private floodConnected(col: number, row: number, connected: Set<string>): void {
    const key = `${col},${row}`;
    if (connected.has(key)) return;

    const bubble = this.grid[row]?.[col];
    if (!bubble || bubble.isPopping) return;

    connected.add(key);

    const neighbors = this.getNeighborPositions(col, row);
    for (const n of neighbors) {
      this.floodConnected(n.col, n.row, connected);
    }
  }

  private removePopppedBubbles(): void {
    for (let row = 0; row < this.grid.length; row++) {
      for (let col = 0; col < this.getColsForRow(row); col++) {
        if (this.grid[row]?.[col]?.isPopComplete()) {
          this.grid[row][col] = null;
        }
      }
    }
  }

  private removeOrphans(orphans: Bubble[]): void {
    for (const orphan of orphans) {
      const { gridX, gridY } = orphan;
      if (this.grid[gridY]?.[gridX] === orphan) {
        this.grid[gridY][gridX] = null;
      }
    }
  }

  public getScreenPosition(col: number, row: number): { x: number; y: number } {
    const rowOffset = row % 2 === 1 ? this.config.bubbleSize / 2 : 0;
    const x = this.config.offsetX + col * this.config.bubbleSize + rowOffset + this.config.bubbleSize / 2;
    const y = this.config.offsetY + this.ceilingOffset + row * (this.config.bubbleSize * 0.866) + this.config.bubbleSize / 2;
    return { x, y };
  }

  public addRow(): void {
    // Shift all rows down
    this.ceilingOffset += this.config.bubbleSize * 0.866;

    // Add new row at top
    const newRow: (Bubble | null)[] = [];
    for (let col = 0; col < this.config.cols; col++) {
      const color = this.getRandomColor();
      const bubble = new Bubble({
        gridX: col,
        gridY: 0,
        color: color,
      });
      newRow.push(bubble);
    }

    // Shift grid indices
    for (let row = 0; row < this.grid.length; row++) {
      for (let col = 0; col < this.getColsForRow(row); col++) {
        if (this.grid[row]?.[col]) {
          this.grid[row][col]!.gridY++;
        }
      }
    }

    // Insert new row
    this.grid.unshift(newRow);
    if (this.grid.length > this.config.rows) {
      this.grid.pop();
    }
  }

  public getLowestBubbleY(): number {
    for (let row = this.grid.length - 1; row >= 0; row--) {
      for (let col = 0; col < this.getColsForRow(row); col++) {
        if (this.grid[row]?.[col]) {
          return this.config.offsetY + this.ceilingOffset + row * (this.config.bubbleSize * 0.866) + this.config.bubbleSize;
        }
      }
    }
    return this.config.offsetY;
  }

  public isEmpty(): boolean {
    for (let row = 0; row < this.grid.length; row++) {
      for (let col = 0; col < this.getColsForRow(row); col++) {
        if (this.grid[row]?.[col]) {
          return false;
        }
      }
    }
    return true;
  }

  public getBubbleCount(): number {
    let count = 0;
    for (let row = 0; row < this.grid.length; row++) {
      for (let col = 0; col < this.getColsForRow(row); col++) {
        if (this.grid[row]?.[col]) {
          count++;
        }
      }
    }
    return count;
  }

  public reset(): void {
    this.initializeGrid();
    this.fallingBubbles = [];
    this.totalPopped = 0;
    this.maxChain = 0;
    this.currentChain = 0;
    this.ceilingOffset = 0;
    this.availableColors = ['red', 'blue', 'green', 'yellow', 'purple', 'orange'];
  }

  public getConfig(): GridConfig {
    return this.config;
  }

  public getCurrentChain(): number {
    return this.currentChain;
  }

  /**
   * Check if a moving bubble collides with any bubble in the grid
   * Returns the collided bubble and the best snap position
   */
  public checkCollision(x: number, y: number, radius: number): {
    collided: boolean;
    snapPosition: { gridX: number; gridY: number } | null;
    collidedBubble: Bubble | null;
  } {
    const collisionRadius = radius + this.config.bubbleSize / 2;
    let closestDist = Infinity;
    let collidedBubble: Bubble | null = null;

    // Check collision with all bubbles in grid
    for (let row = 0; row < this.grid.length; row++) {
      for (let col = 0; col < this.getColsForRow(row); col++) {
        const bubble = this.grid[row]?.[col];
        if (!bubble) continue;

        const pos = this.getScreenPosition(col, row);
        const dist = Math.sqrt((x - pos.x) ** 2 + (y - pos.y) ** 2);

        if (dist < collisionRadius && dist < closestDist) {
          closestDist = dist;
          collidedBubble = bubble;
        }
      }
    }

    if (!collidedBubble) {
      return { collided: false, snapPosition: null, collidedBubble: null };
    }

    // Find best snap position adjacent to the collided bubble
    const snapPosition = this.findBestSnapPosition(x, y, collidedBubble.gridX, collidedBubble.gridY);

    return {
      collided: true,
      snapPosition,
      collidedBubble
    };
  }

  /**
   * Find the best snap position near a collided bubble
   */
  private findBestSnapPosition(
    x: number,
    y: number,
    collidedCol: number,
    collidedRow: number
  ): { gridX: number; gridY: number } | null {
    // Get all neighbor positions of the collided bubble
    const neighbors = this.getNeighborPositions(collidedCol, collidedRow);

    let bestDist = Infinity;
    let bestPos: { gridX: number; gridY: number } | null = null;

    // Also check if we can snap to row 0 (ceiling)
    if (collidedRow === 0) {
      for (let col = 0; col < this.getColsForRow(0); col++) {
        if (this.grid[0]?.[col] === null) {
          const pos = this.getScreenPosition(col, 0);
          const dist = Math.sqrt((x - pos.x) ** 2 + (y - pos.y) ** 2);
          if (dist < bestDist) {
            bestDist = dist;
            bestPos = { gridX: col, gridY: 0 };
          }
        }
      }
    }

    // Check each neighbor position
    for (const neighbor of neighbors) {
      const { col, row } = neighbor;

      // Skip if position is occupied
      if (this.grid[row]?.[col] !== null) continue;

      // Skip if row doesn't exist
      if (row < 0 || row >= this.config.rows) continue;

      const pos = this.getScreenPosition(col, row);
      const dist = Math.sqrt((x - pos.x) ** 2 + (y - pos.y) ** 2);

      if (dist < bestDist) {
        bestDist = dist;
        bestPos = { gridX: col, gridY: row };
      }
    }

    return bestPos;
  }

  /**
   * Check if the bubble has reached the ceiling area
   */
  public isAtCeiling(y: number, radius: number): boolean {
    return y - radius <= this.config.offsetY + this.ceilingOffset;
  }

  /**
   * Find snap position at ceiling for a given x position
   */
  public findCeilingSnapPosition(x: number): { gridX: number; gridY: number } | null {
    let bestDist = Infinity;
    let bestPos: { gridX: number; gridY: number } | null = null;

    for (let col = 0; col < this.getColsForRow(0); col++) {
      if (this.grid[0]?.[col] !== null) continue;

      const pos = this.getScreenPosition(col, 0);
      const dist = Math.abs(x - pos.x);

      if (dist < bestDist) {
        bestDist = dist;
        bestPos = { gridX: col, gridY: 0 };
      }
    }

    return bestPos;
  }
}
