// ===== src/games/color-drop/ColorDropGame.ts =====
// Color Drop - A Bejeweled-style Match-3 Gem Game

import { BaseGame } from '@/games/shared/BaseGame';
import { GameManifest } from '@/lib/types';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

type GemType = 'red' | 'blue' | 'green' | 'yellow' | 'purple' | 'orange' | 'white';
type SpecialType = 'normal' | 'bomb' | 'horizontal' | 'vertical' | 'rainbow';
type GameState = 'playing' | 'swapping' | 'matching' | 'cascading' | 'gameOver' | 'paused' | 'levelComplete';

interface Gem {
  type: GemType;
  special: SpecialType;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  scale: number;
  alpha: number;
  sparklePhase: number;
  isMatched: boolean;
  isNew: boolean;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  life: number;
  maxLife: number;
  type: 'sparkle' | 'explosion' | 'trail' | 'star';
}

interface MatchResult {
  gems: { row: number; col: number }[];
  isHorizontal: boolean;
  length: number;
}

interface SwapAnimation {
  gem1: { row: number; col: number };
  gem2: { row: number; col: number };
  progress: number;
  isReversing: boolean;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const GRID_SIZE = 8;
const GEM_SIZE = 50;
const GEM_SPACING = 4;
const CELL_SIZE = GEM_SIZE + GEM_SPACING;
const GRID_OFFSET_X = 80;
const GRID_OFFSET_Y = 90;

const GEM_COLORS: Record<GemType, { primary: string; secondary: string; highlight: string; shadow: string }> = {
  red: { primary: '#FF4444', secondary: '#CC0000', highlight: '#FF8888', shadow: '#880000' },
  blue: { primary: '#4488FF', secondary: '#0044CC', highlight: '#88BBFF', shadow: '#002288' },
  green: { primary: '#44FF44', secondary: '#00CC00', highlight: '#88FF88', shadow: '#008800' },
  yellow: { primary: '#FFDD44', secondary: '#CCAA00', highlight: '#FFEE88', shadow: '#886600' },
  purple: { primary: '#AA44FF', secondary: '#7700CC', highlight: '#CC88FF', shadow: '#440088' },
  orange: { primary: '#FF8844', secondary: '#CC5500', highlight: '#FFAA88', shadow: '#883300' },
  white: { primary: '#FFFFFF', secondary: '#CCCCCC', highlight: '#FFFFFF', shadow: '#888888' },
};

const GEM_TYPES: GemType[] = ['red', 'blue', 'green', 'yellow', 'purple', 'orange'];

const SWAP_DURATION = 0.2;
const MATCH_DELAY = 0.15;
const CASCADE_SPEED = 600; // pixels per second
const HINT_DELAY = 5; // seconds before showing hint
const LEVEL_UP_DISPLAY_TIME = 2;

// Scoring
const SCORE_PER_GEM = 10;
const COMBO_MULTIPLIER_BASE = 1.5;
const SPECIAL_GEM_BONUS = 50;
const LEVEL_TARGET_BASE = 1000;
const LEVEL_TARGET_INCREMENT = 500;

// ============================================================================
// MAIN GAME CLASS
// ============================================================================

export class ColorDropGame extends BaseGame {
  manifest: GameManifest = {
    id: 'color-drop',
    title: 'Color Drop',
    thumbnail: '/games/color-drop/color-drop-thumb.svg',
    inputSchema: ['keyboard', 'touch'],
    assetBudgetKB: 80,
    tier: 1,
    description: 'Match colorful gems in this addictive puzzle game!'
  };

  // Grid state
  private grid: (Gem | null)[][] = [];
  private gameState: GameState = 'playing';
  
  // Selection & swapping
  private selectedGem: { row: number; col: number } | null = null;
  private swapAnimation: SwapAnimation | null = null;
  private hoverGem: { row: number; col: number } | null = null;
  
  // Combo system
  private currentCombo: number = 0;
  private comboTimer: number = 0;
  private maxCombo: number = 0;
  private cascadeCount: number = 0;
  
  // Level progression
  private level: number = 1;
  private levelScore: number = 0;
  private levelTarget: number = LEVEL_TARGET_BASE;
  private movesThisLevel: number = 0;
  private levelUpTimer: number = 0;
  
  // Hint system
  private hintTimer: number = 0;
  private hintGems: { row: number; col: number }[] = [];
  private showingHint: boolean = false;
  
  // Visual effects
  private particles: Particle[] = [];
  private screenShake: number = 0;
  private backgroundStars: { x: number; y: number; size: number; speed: number; alpha: number }[] = [];
  
  // Statistics
  private totalMatches: number = 0;
  private specialGemsCreated: number = 0;
  private totalCascades: number = 0;
  private gemsCleared: number = 0;

  // Input tracking
  private isDragging: boolean = false;
  private dragStart: { x: number; y: number } | null = null;
  private lastClickTime: number = 0;

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  protected onInit(): void {
    this.initializeBackground();
    this.initializeGrid();
    this.ensureNoInitialMatches();
    this.gameState = 'playing';
    this.resetLevelStats();
  }

  private initializeBackground(): void {
    this.backgroundStars = [];
    for (let i = 0; i < 50; i++) {
      this.backgroundStars.push({
        x: Math.random() * this.canvas.width,
        y: Math.random() * this.canvas.height,
        size: Math.random() * 2 + 0.5,
        speed: Math.random() * 20 + 10,
        alpha: Math.random() * 0.5 + 0.3,
      });
    }
  }

  private initializeGrid(): void {
    this.grid = [];
    for (let row = 0; row < GRID_SIZE; row++) {
      this.grid[row] = [];
      for (let col = 0; col < GRID_SIZE; col++) {
        this.grid[row][col] = this.createRandomGem(row, col);
      }
    }
  }

  private createRandomGem(row: number, col: number, isNew: boolean = false): Gem {
    const type = GEM_TYPES[Math.floor(Math.random() * GEM_TYPES.length)];
    const pixelX = GRID_OFFSET_X + col * CELL_SIZE + CELL_SIZE / 2;
    const pixelY = isNew 
      ? GRID_OFFSET_Y - CELL_SIZE * 2 // Start above the grid for new gems
      : GRID_OFFSET_Y + row * CELL_SIZE + CELL_SIZE / 2;
    
    return {
      type,
      special: 'normal',
      x: pixelX,
      y: pixelY,
      targetX: GRID_OFFSET_X + col * CELL_SIZE + CELL_SIZE / 2,
      targetY: GRID_OFFSET_Y + row * CELL_SIZE + CELL_SIZE / 2,
      scale: isNew ? 0 : 1,
      alpha: 1,
      sparklePhase: Math.random() * Math.PI * 2,
      isMatched: false,
      isNew,
    };
  }

  private ensureNoInitialMatches(): void {
    let hasMatches = true;
    let iterations = 0;
    const maxIterations = 100;
    
    while (hasMatches && iterations < maxIterations) {
      hasMatches = false;
      iterations++;
      
      for (let row = 0; row < GRID_SIZE; row++) {
        for (let col = 0; col < GRID_SIZE; col++) {
          // Check horizontal match
          if (col >= 2) {
            const gem = this.grid[row][col];
            const left1 = this.grid[row][col - 1];
            const left2 = this.grid[row][col - 2];
            if (gem && left1 && left2 && gem.type === left1.type && gem.type === left2.type) {
              gem.type = this.getDifferentType(gem.type);
              hasMatches = true;
            }
          }
          
          // Check vertical match
          if (row >= 2) {
            const gem = this.grid[row][col];
            const up1 = this.grid[row - 1][col];
            const up2 = this.grid[row - 2][col];
            if (gem && up1 && up2 && gem.type === up1.type && gem.type === up2.type) {
              gem.type = this.getDifferentType(gem.type);
              hasMatches = true;
            }
          }
        }
      }
    }
  }

  private getDifferentType(currentType: GemType): GemType {
    const types = GEM_TYPES.filter(t => t !== currentType);
    return types[Math.floor(Math.random() * types.length)];
  }

  private resetLevelStats(): void {
    this.levelScore = 0;
    this.movesThisLevel = 0;
    this.currentCombo = 0;
    this.cascadeCount = 0;
    this.hintTimer = 0;
    this.showingHint = false;
    this.hintGems = [];
  }

  // ============================================================================
  // GAME UPDATE LOOP
  // ============================================================================

  protected onUpdate(dt: number): void {
    if (this.gameState === 'gameOver') return;
    
    // Update screen shake
    if (this.screenShake > 0) {
      this.screenShake *= 0.9;
      if (this.screenShake < 0.5) this.screenShake = 0;
    }
    
    // Update background stars
    this.updateBackgroundStars(dt);
    
    // Update particles
    this.updateParticles(dt);
    
    // Update gem animations
    this.updateGemAnimations(dt);
    
    // Update combo timer
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.currentCombo = 0;
      }
    }
    
    // Level up display timer
    if (this.levelUpTimer > 0) {
      this.levelUpTimer -= dt;
    }
    
    // State machine
    switch (this.gameState) {
      case 'playing':
        this.handleInput();
        this.updateHintSystem(dt);
        break;
        
      case 'swapping':
        this.updateSwapAnimation(dt);
        break;
        
      case 'matching':
        // Brief pause before cascading
        break;
        
      case 'cascading':
        this.updateCascade(dt);
        break;
        
      case 'levelComplete':
        // Handle level transition
        if (this.levelUpTimer <= 0) {
          this.advanceLevel();
        }
        break;
    }
  }

  private updateBackgroundStars(dt: number): void {
    for (const star of this.backgroundStars) {
      star.y += star.speed * dt;
      if (star.y > this.canvas.height) {
        star.y = 0;
        star.x = Math.random() * this.canvas.width;
      }
      star.alpha = 0.3 + Math.sin(this.gameTime * 2 + star.x) * 0.2;
    }
  }

  private updateParticles(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 200 * dt; // gravity
      p.life -= dt;
      
      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  private updateGemAnimations(dt: number): void {
    for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {
        const gem = this.grid[row][col];
        if (!gem) continue;
        
        // Update sparkle animation
        gem.sparklePhase += dt * 3;
        
        // Animate position towards target
        const dx = gem.targetX - gem.x;
        const dy = gem.targetY - gem.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist > 1) {
          const speed = CASCADE_SPEED * dt;
          if (dist < speed) {
            gem.x = gem.targetX;
            gem.y = gem.targetY;
          } else {
            gem.x += (dx / dist) * speed;
            gem.y += (dy / dist) * speed;
          }
        }
        
        // Animate scale for new gems
        if (gem.isNew && gem.scale < 1) {
          gem.scale = Math.min(1, gem.scale + dt * 5);
          if (gem.scale >= 1) {
            gem.isNew = false;
          }
        }
        
        // Animate matched gems disappearing
        if (gem.isMatched) {
          gem.alpha -= dt * 4;
          gem.scale -= dt * 3;
        }
      }
    }
  }

  // ============================================================================
  // INPUT HANDLING
  // ============================================================================

  private handleInput(): void {
    const input = this.services.input;
    const mousePos = input.getMousePosition();
    
    // Update hover state
    this.hoverGem = this.getGemAtPixel(mousePos.x, mousePos.y);
    
    // Handle mouse/touch click
    if (input.isActionPressed()) {
      const clickedGem = this.getGemAtPixel(mousePos.x, mousePos.y);
      
      if (clickedGem) {
        // Reset hint on any interaction
        this.hintTimer = 0;
        this.showingHint = false;
        
        if (this.selectedGem) {
          // Check if clicked gem is adjacent to selected
          if (this.areAdjacent(this.selectedGem, clickedGem)) {
            this.startSwap(this.selectedGem, clickedGem);
            this.selectedGem = null;
          } else if (clickedGem.row === this.selectedGem.row && clickedGem.col === this.selectedGem.col) {
            // Clicked same gem, deselect
            this.selectedGem = null;
          } else {
            // Clicked different non-adjacent gem, select it instead
            this.selectedGem = clickedGem;
            this.services.audio.playSound('click');
          }
        } else {
          // No gem selected, select this one
          this.selectedGem = clickedGem;
          this.services.audio.playSound('click');
        }
      }
    }
    
    // Keyboard controls for hint (H key)
    if (input.isKeyPressed('KeyH')) {
      this.showHint();
    }
  }

  private getGemAtPixel(x: number, y: number): { row: number; col: number } | null {
    // Apply screen shake offset
    x -= (Math.random() - 0.5) * this.screenShake;
    y -= (Math.random() - 0.5) * this.screenShake;
    
    const col = Math.floor((x - GRID_OFFSET_X) / CELL_SIZE);
    const row = Math.floor((y - GRID_OFFSET_Y) / CELL_SIZE);
    
    if (row >= 0 && row < GRID_SIZE && col >= 0 && col < GRID_SIZE) {
      return { row, col };
    }
    return null;
  }

  private areAdjacent(gem1: { row: number; col: number }, gem2: { row: number; col: number }): boolean {
    const rowDiff = Math.abs(gem1.row - gem2.row);
    const colDiff = Math.abs(gem1.col - gem2.col);
    return (rowDiff === 1 && colDiff === 0) || (rowDiff === 0 && colDiff === 1);
  }

  // ============================================================================
  // FEATURE 1 & 2: SWAPPING & MATCH DETECTION
  // ============================================================================

  private startSwap(gem1: { row: number; col: number }, gem2: { row: number; col: number }): void {
    this.gameState = 'swapping';
    this.swapAnimation = {
      gem1,
      gem2,
      progress: 0,
      isReversing: false,
    };
    this.services.audio.playSound('click');
  }

  private updateSwapAnimation(dt: number): void {
    if (!this.swapAnimation) return;
    
    this.swapAnimation.progress += dt / SWAP_DURATION;
    
    if (this.swapAnimation.progress >= 1) {
      this.swapAnimation.progress = 1;
      this.completeSwap();
      return; // Must return here - completeSwap() may have set swapAnimation to null
    }
    
    // Update gem positions during swap (only runs during animation, not after completion)
    const { gem1, gem2, progress, isReversing } = this.swapAnimation;
    const g1 = this.grid[gem1.row][gem1.col];
    const g2 = this.grid[gem2.row][gem2.col];
    
    if (g1 && g2) {
      const t = isReversing ? 1 - progress : progress;
      const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; // ease in-out quad
      
      const target1X = GRID_OFFSET_X + gem2.col * CELL_SIZE + CELL_SIZE / 2;
      const target1Y = GRID_OFFSET_Y + gem2.row * CELL_SIZE + CELL_SIZE / 2;
      const start1X = GRID_OFFSET_X + gem1.col * CELL_SIZE + CELL_SIZE / 2;
      const start1Y = GRID_OFFSET_Y + gem1.row * CELL_SIZE + CELL_SIZE / 2;
      
      g1.x = start1X + (target1X - start1X) * ease;
      g1.y = start1Y + (target1Y - start1Y) * ease;
      
      g2.x = target1X + (start1X - target1X) * ease;
      g2.y = target1Y + (start1Y - target1Y) * ease;
    }
  }

  private completeSwap(): void {
    if (!this.swapAnimation) return;
    
    const { gem1, gem2, isReversing } = this.swapAnimation;
    
    // Actually swap gems in grid
    const temp = this.grid[gem1.row][gem1.col];
    this.grid[gem1.row][gem1.col] = this.grid[gem2.row][gem2.col];
    this.grid[gem2.row][gem2.col] = temp;
    
    // Update gem targets
    if (this.grid[gem1.row][gem1.col]) {
      this.grid[gem1.row][gem1.col]!.targetX = GRID_OFFSET_X + gem1.col * CELL_SIZE + CELL_SIZE / 2;
      this.grid[gem1.row][gem1.col]!.targetY = GRID_OFFSET_Y + gem1.row * CELL_SIZE + CELL_SIZE / 2;
    }
    if (this.grid[gem2.row][gem2.col]) {
      this.grid[gem2.row][gem2.col]!.targetX = GRID_OFFSET_X + gem2.col * CELL_SIZE + CELL_SIZE / 2;
      this.grid[gem2.row][gem2.col]!.targetY = GRID_OFFSET_Y + gem2.row * CELL_SIZE + CELL_SIZE / 2;
    }
    
    if (isReversing) {
      // Swap was invalid, return to playing
      this.swapAnimation = null;
      this.gameState = 'playing';
      this.services.audio.playSound('collision');
      return;
    }
    
    // Check for matches
    const matches = this.findAllMatches();
    
    if (matches.length > 0) {
      this.movesThisLevel++;
      this.swapAnimation = null;
      this.processMatches(matches);
    } else {
      // No matches, reverse the swap
      this.swapAnimation.progress = 0;
      this.swapAnimation.isReversing = true;
    }
  }

  private findAllMatches(): MatchResult[] {
    const matches: MatchResult[] = [];
    const matchedCells = new Set<string>();
    
    // Find horizontal matches
    for (let row = 0; row < GRID_SIZE; row++) {
      let col = 0;
      while (col < GRID_SIZE) {
        const gem = this.grid[row][col];
        if (!gem) {
          col++;
          continue;
        }
        
        let matchLength = 1;
        while (col + matchLength < GRID_SIZE) {
          const nextGem = this.grid[row][col + matchLength];
          if (nextGem && (nextGem.type === gem.type || gem.special === 'rainbow' || nextGem.special === 'rainbow')) {
            matchLength++;
          } else {
            break;
          }
        }
        
        if (matchLength >= 3) {
          const matchGems = [];
          for (let i = 0; i < matchLength; i++) {
            matchGems.push({ row, col: col + i });
            matchedCells.add(`${row},${col + i}`);
          }
          matches.push({ gems: matchGems, isHorizontal: true, length: matchLength });
        }
        
        col += Math.max(1, matchLength);
      }
    }
    
    // Find vertical matches
    for (let col = 0; col < GRID_SIZE; col++) {
      let row = 0;
      while (row < GRID_SIZE) {
        const gem = this.grid[row][col];
        if (!gem) {
          row++;
          continue;
        }
        
        let matchLength = 1;
        while (row + matchLength < GRID_SIZE) {
          const nextGem = this.grid[row + matchLength][col];
          if (nextGem && (nextGem.type === gem.type || gem.special === 'rainbow' || nextGem.special === 'rainbow')) {
            matchLength++;
          } else {
            break;
          }
        }
        
        if (matchLength >= 3) {
          const matchGems = [];
          for (let i = 0; i < matchLength; i++) {
            matchGems.push({ row: row + i, col });
            matchedCells.add(`${row + i},${col}`);
          }
          matches.push({ gems: matchGems, isHorizontal: false, length: matchLength });
        }
        
        row += Math.max(1, matchLength);
      }
    }
    
    return matches;
  }

  // ============================================================================
  // FEATURE 3: COMBO SYSTEM
  // ============================================================================

  private processMatches(matches: MatchResult[]): void {
    this.cascadeCount++;
    this.totalCascades = Math.max(this.totalCascades, this.cascadeCount);
    
    // Increment combo
    this.currentCombo++;
    this.maxCombo = Math.max(this.maxCombo, this.currentCombo);
    this.comboTimer = 2; // 2 seconds to keep combo alive
    
    // Calculate score with combo multiplier
    const comboMultiplier = 1 + (this.currentCombo - 1) * (COMBO_MULTIPLIER_BASE - 1);
    
    let scoreGained = 0;
    const gemsToRemove: { row: number; col: number }[] = [];
    
    for (const match of matches) {
      // FEATURE 4: Create special gems for 4+ matches
      let specialGemPos: { row: number; col: number } | null = null;
      let specialType: SpecialType = 'normal';
      
      if (match.length === 4) {
        // Create line clear gem
        specialType = match.isHorizontal ? 'horizontal' : 'vertical';
        specialGemPos = match.gems[1]; // Middle-ish gem
        this.specialGemsCreated++;
      } else if (match.length >= 5) {
        // Create bomb gem
        specialType = 'bomb';
        specialGemPos = match.gems[Math.floor(match.length / 2)];
        this.specialGemsCreated++;
      }
      
      for (const pos of match.gems) {
        const gem = this.grid[pos.row][pos.col];
        if (gem && !gem.isMatched) {
          gem.isMatched = true;
          gemsToRemove.push(pos);
          
          // Trigger special gem effects
          if (gem.special !== 'normal') {
            this.triggerSpecialGem(gem, pos);
          }
          
          // Create explosion particles
          this.createMatchParticles(pos.row, pos.col, gem.type);
          
          scoreGained += SCORE_PER_GEM;
          this.gemsCleared++;
        }
      }
      
      // Create the special gem (will be spawned after cascade)
      if (specialGemPos && specialType !== 'normal') {
        // Store special gem creation for after removal
        this.pendingSpecialGem = { pos: specialGemPos, type: specialType, gemType: this.grid[match.gems[0].row][match.gems[0].col]?.type || 'red' };
        scoreGained += SPECIAL_GEM_BONUS;
      }
      
      this.totalMatches++;
    }
    
    // Apply combo multiplier to score
    const finalScore = Math.floor(scoreGained * comboMultiplier);
    this.score += finalScore;
    this.levelScore += finalScore;
    this.pickups += Math.floor(finalScore / 50); // Bonus pickups for score
    
    // Play match sound (higher pitch for combos)
    this.services.audio.playSound(this.currentCombo > 1 ? 'powerup' : 'coin');
    
    // Screen shake for big combos
    if (this.currentCombo >= 3) {
      this.screenShake = Math.min(this.currentCombo * 3, 15);
    }
    
    this.gameState = 'matching';
    
    // Brief delay then start cascading
    setTimeout(() => {
      this.removeMatchedGems();
      this.gameState = 'cascading';
    }, MATCH_DELAY * 1000);
  }

  private pendingSpecialGem: { pos: { row: number; col: number }; type: SpecialType; gemType: GemType } | null = null;

  // ============================================================================
  // FEATURE 4: SPECIAL GEMS
  // ============================================================================

  private triggerSpecialGem(gem: Gem, pos: { row: number; col: number }): void {
    switch (gem.special) {
      case 'horizontal':
        // Clear entire row
        for (let col = 0; col < GRID_SIZE; col++) {
          const target = this.grid[pos.row][col];
          if (target && !target.isMatched) {
            target.isMatched = true;
            this.createMatchParticles(pos.row, col, target.type);
            this.score += SCORE_PER_GEM;
            this.gemsCleared++;
          }
        }
        this.screenShake = 10;
        this.services.audio.playSound('explosion');
        break;
        
      case 'vertical':
        // Clear entire column
        for (let row = 0; row < GRID_SIZE; row++) {
          const target = this.grid[row][pos.col];
          if (target && !target.isMatched) {
            target.isMatched = true;
            this.createMatchParticles(row, pos.col, target.type);
            this.score += SCORE_PER_GEM;
            this.gemsCleared++;
          }
        }
        this.screenShake = 10;
        this.services.audio.playSound('explosion');
        break;
        
      case 'bomb':
        // Clear 3x3 area
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            const r = pos.row + dr;
            const c = pos.col + dc;
            if (r >= 0 && r < GRID_SIZE && c >= 0 && c < GRID_SIZE) {
              const target = this.grid[r][c];
              if (target && !target.isMatched) {
                target.isMatched = true;
                this.createMatchParticles(r, c, target.type);
                this.score += SCORE_PER_GEM;
                this.gemsCleared++;
              }
            }
          }
        }
        this.screenShake = 15;
        this.services.audio.playSound('explosion');
        break;
        
      case 'rainbow':
        // Clear all gems of a random type
        const typeToRemove = GEM_TYPES[Math.floor(Math.random() * GEM_TYPES.length)];
        for (let row = 0; row < GRID_SIZE; row++) {
          for (let col = 0; col < GRID_SIZE; col++) {
            const target = this.grid[row][col];
            if (target && target.type === typeToRemove && !target.isMatched) {
              target.isMatched = true;
              this.createMatchParticles(row, col, target.type);
              this.score += SCORE_PER_GEM;
              this.gemsCleared++;
            }
          }
        }
        this.screenShake = 20;
        this.services.audio.playSound('unlock');
        break;
    }
  }

  private removeMatchedGems(): void {
    for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {
        const gem = this.grid[row][col];
        if (gem && gem.isMatched) {
          this.grid[row][col] = null;
        }
      }
    }
  }

  // ============================================================================
  // CASCADE SYSTEM
  // ============================================================================

  private updateCascade(dt: number): void {
    let stillFalling = false;
    
    // Move gems down to fill gaps
    for (let col = 0; col < GRID_SIZE; col++) {
      for (let row = GRID_SIZE - 1; row >= 0; row--) {
        if (!this.grid[row][col]) {
          // Find gem above to drop
          for (let above = row - 1; above >= 0; above--) {
            if (this.grid[above][col]) {
              this.grid[row][col] = this.grid[above][col];
              this.grid[above][col] = null;
              
              // Update target position
              this.grid[row][col]!.targetY = GRID_OFFSET_Y + row * CELL_SIZE + CELL_SIZE / 2;
              stillFalling = true;
              break;
            }
          }
        }
      }
    }
    
    // Spawn new gems at top
    for (let col = 0; col < GRID_SIZE; col++) {
      for (let row = 0; row < GRID_SIZE; row++) {
        if (!this.grid[row][col]) {
          const newGem = this.createRandomGem(row, col, true);
          
          // Check if we should create a special gem here
          if (this.pendingSpecialGem && 
              this.pendingSpecialGem.pos.row === row && 
              this.pendingSpecialGem.pos.col === col) {
            newGem.special = this.pendingSpecialGem.type;
            newGem.type = this.pendingSpecialGem.gemType;
            this.pendingSpecialGem = null;
          }
          
          this.grid[row][col] = newGem;
          stillFalling = true;
        }
      }
    }
    
    // Check if all gems have settled
    let allSettled = true;
    for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {
        const gem = this.grid[row][col];
        if (gem) {
          const dx = Math.abs(gem.x - gem.targetX);
          const dy = Math.abs(gem.y - gem.targetY);
          if (dx > 2 || dy > 2 || gem.scale < 0.9) {
            allSettled = false;
          }
        }
      }
    }
    
    if (allSettled && !stillFalling) {
      // Check for new matches (cascading)
      const newMatches = this.findAllMatches();
      if (newMatches.length > 0) {
        this.processMatches(newMatches);
      } else {
        // Cascade complete
        this.cascadeCount = 0;
        
        // FEATURE 5: Check for level completion
        if (this.levelScore >= this.levelTarget) {
          this.gameState = 'levelComplete';
          this.levelUpTimer = LEVEL_UP_DISPLAY_TIME;
          this.services.audio.playSound('success');
          this.createLevelUpParticles();
        } else {
          // Check if any valid moves remain
          if (!this.hasValidMoves()) {
            this.shuffleBoard();
          }
          this.gameState = 'playing';
        }
      }
    }
  }

  // ============================================================================
  // FEATURE 5: LEVEL PROGRESSION
  // ============================================================================

  private advanceLevel(): void {
    this.level++;
    this.levelTarget = LEVEL_TARGET_BASE + (this.level - 1) * LEVEL_TARGET_INCREMENT;
    this.resetLevelStats();
    this.gameState = 'playing';
    
    // Maybe create a rainbow gem as level reward
    if (this.level % 3 === 0) {
      const row = Math.floor(Math.random() * GRID_SIZE);
      const col = Math.floor(Math.random() * GRID_SIZE);
      if (this.grid[row][col]) {
        this.grid[row][col]!.special = 'rainbow';
        this.grid[row][col]!.type = 'white';
      }
    }
  }

  // ============================================================================
  // FEATURE 6: VISUAL EFFECTS
  // ============================================================================

  private createMatchParticles(row: number, col: number, type: GemType): void {
    const centerX = GRID_OFFSET_X + col * CELL_SIZE + CELL_SIZE / 2;
    const centerY = GRID_OFFSET_Y + row * CELL_SIZE + CELL_SIZE / 2;
    const colors = GEM_COLORS[type];
    
    // Explosion particles
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const speed = 100 + Math.random() * 150;
      this.particles.push({
        x: centerX,
        y: centerY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: Math.random() > 0.5 ? colors.primary : colors.highlight,
        size: 3 + Math.random() * 4,
        life: 0.5 + Math.random() * 0.3,
        maxLife: 0.8,
        type: 'explosion',
      });
    }
    
    // Sparkle particles
    for (let i = 0; i < 4; i++) {
      this.particles.push({
        x: centerX + (Math.random() - 0.5) * GEM_SIZE,
        y: centerY + (Math.random() - 0.5) * GEM_SIZE,
        vx: (Math.random() - 0.5) * 50,
        vy: -50 - Math.random() * 100,
        color: '#FFFFFF',
        size: 2 + Math.random() * 2,
        life: 0.3 + Math.random() * 0.2,
        maxLife: 0.5,
        type: 'star',
      });
    }
  }

  private createLevelUpParticles(): void {
    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;
    
    for (let i = 0; i < 50; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 100 + Math.random() * 200;
      const colors = ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FF69B4'];
      
      this.particles.push({
        x: centerX,
        y: centerY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 100,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 4 + Math.random() * 6,
        life: 1 + Math.random() * 0.5,
        maxLife: 1.5,
        type: 'star',
      });
    }
  }

  // ============================================================================
  // FEATURE 7: HINT SYSTEM & BOARD MANAGEMENT
  // ============================================================================

  private updateHintSystem(dt: number): void {
    this.hintTimer += dt;
    
    if (this.hintTimer >= HINT_DELAY && !this.showingHint) {
      this.showHint();
    }
  }

  private showHint(): void {
    const move = this.findValidMove();
    if (move) {
      this.hintGems = [move.from, move.to];
      this.showingHint = true;
    }
  }

  private findValidMove(): { from: { row: number; col: number }; to: { row: number; col: number } } | null {
    // Try all possible swaps and find one that creates a match
    for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {
        // Try swapping right
        if (col < GRID_SIZE - 1) {
          if (this.wouldCreateMatch({ row, col }, { row, col: col + 1 })) {
            return { from: { row, col }, to: { row, col: col + 1 } };
          }
        }
        // Try swapping down
        if (row < GRID_SIZE - 1) {
          if (this.wouldCreateMatch({ row, col }, { row: row + 1, col })) {
            return { from: { row, col }, to: { row: row + 1, col } };
          }
        }
      }
    }
    return null;
  }

  private wouldCreateMatch(pos1: { row: number; col: number }, pos2: { row: number; col: number }): boolean {
    // Temporarily swap
    const temp = this.grid[pos1.row][pos1.col];
    this.grid[pos1.row][pos1.col] = this.grid[pos2.row][pos2.col];
    this.grid[pos2.row][pos2.col] = temp;
    
    // Check for matches
    const hasMatch = this.checkForMatchAt(pos1.row, pos1.col) || this.checkForMatchAt(pos2.row, pos2.col);
    
    // Swap back
    const temp2 = this.grid[pos1.row][pos1.col];
    this.grid[pos1.row][pos1.col] = this.grid[pos2.row][pos2.col];
    this.grid[pos2.row][pos2.col] = temp2;
    
    return hasMatch;
  }

  private checkForMatchAt(row: number, col: number): boolean {
    const gem = this.grid[row][col];
    if (!gem) return false;
    
    // Check horizontal
    let hCount = 1;
    for (let c = col - 1; c >= 0 && this.grid[row][c]?.type === gem.type; c--) hCount++;
    for (let c = col + 1; c < GRID_SIZE && this.grid[row][c]?.type === gem.type; c++) hCount++;
    if (hCount >= 3) return true;
    
    // Check vertical
    let vCount = 1;
    for (let r = row - 1; r >= 0 && this.grid[r][col]?.type === gem.type; r--) vCount++;
    for (let r = row + 1; r < GRID_SIZE && this.grid[r][col]?.type === gem.type; r++) vCount++;
    if (vCount >= 3) return true;
    
    return false;
  }

  private hasValidMoves(): boolean {
    return this.findValidMove() !== null;
  }

  private shuffleBoard(): void {
    // Collect all gems
    const gems: Gem[] = [];
    for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {
        if (this.grid[row][col]) {
          gems.push(this.grid[row][col]!);
        }
      }
    }
    
    // Fisher-Yates shuffle
    for (let i = gems.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [gems[i], gems[j]] = [gems[j], gems[i]];
    }
    
    // Redistribute
    let idx = 0;
    for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {
        this.grid[row][col] = gems[idx++];
        this.grid[row][col]!.targetX = GRID_OFFSET_X + col * CELL_SIZE + CELL_SIZE / 2;
        this.grid[row][col]!.targetY = GRID_OFFSET_Y + row * CELL_SIZE + CELL_SIZE / 2;
      }
    }
    
    // Ensure no initial matches and valid moves exist
    this.ensureNoInitialMatches();
    if (!this.hasValidMoves()) {
      this.shuffleBoard(); // Recursive until valid
    }
    
    this.services.audio.playSound('powerup');
  }

  // ============================================================================
  // RENDERING
  // ============================================================================

  protected onRender(ctx: CanvasRenderingContext2D): void {
    // Apply screen shake
    ctx.save();
    if (this.screenShake > 0) {
      ctx.translate(
        (Math.random() - 0.5) * this.screenShake,
        (Math.random() - 0.5) * this.screenShake
      );
    }
    
    this.renderBackground(ctx);
    this.renderGrid(ctx);
    this.renderGems(ctx);
    this.renderParticles(ctx);
    this.renderSelection(ctx);
    this.renderHint(ctx);
    
    ctx.restore();
    
    this.renderHUD(ctx);
    
    if (this.gameState === 'levelComplete') {
      this.renderLevelComplete(ctx);
    }
    
    if (this.gameState === 'gameOver') {
      this.renderGameOver(ctx);
    }
  }

  private renderBackground(ctx: CanvasRenderingContext2D): void {
    // Gradient background
    const gradient = ctx.createLinearGradient(0, 0, 0, this.canvas.height);
    gradient.addColorStop(0, '#1a0a2e');
    gradient.addColorStop(0.5, '#16213e');
    gradient.addColorStop(1, '#0f0f23');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Animated stars
    for (const star of this.backgroundStars) {
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${star.alpha})`;
      ctx.fill();
    }
  }

  private renderGrid(ctx: CanvasRenderingContext2D): void {
    // Grid background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    
    const gridWidth = GRID_SIZE * CELL_SIZE;
    const gridHeight = GRID_SIZE * CELL_SIZE;
    
    // Rounded rectangle background
    const x = GRID_OFFSET_X - 5;
    const y = GRID_OFFSET_Y - 5;
    const w = gridWidth + 10;
    const h = gridHeight + 10;
    const r = 10;
    
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    
    // Grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    for (let i = 1; i < GRID_SIZE; i++) {
      ctx.beginPath();
      ctx.moveTo(GRID_OFFSET_X + i * CELL_SIZE, GRID_OFFSET_Y);
      ctx.lineTo(GRID_OFFSET_X + i * CELL_SIZE, GRID_OFFSET_Y + gridHeight);
      ctx.stroke();
      
      ctx.beginPath();
      ctx.moveTo(GRID_OFFSET_X, GRID_OFFSET_Y + i * CELL_SIZE);
      ctx.lineTo(GRID_OFFSET_X + gridWidth, GRID_OFFSET_Y + i * CELL_SIZE);
      ctx.stroke();
    }
  }

  private renderGems(ctx: CanvasRenderingContext2D): void {
    for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {
        const gem = this.grid[row][col];
        if (gem && gem.alpha > 0) {
          this.renderGem(ctx, gem);
        }
      }
    }
  }

  private renderGem(ctx: CanvasRenderingContext2D, gem: Gem): void {
    const colors = GEM_COLORS[gem.type];
    const size = GEM_SIZE * gem.scale * 0.45;
    
    ctx.save();
    ctx.translate(gem.x, gem.y);
    ctx.globalAlpha = gem.alpha;
    
    // Gem body - hexagonal shape for visual interest
    const sides = 6;
    ctx.beginPath();
    for (let i = 0; i < sides; i++) {
      const angle = (i / sides) * Math.PI * 2 - Math.PI / 2;
      const x = Math.cos(angle) * size;
      const y = Math.sin(angle) * size;
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.closePath();
    
    // Gradient fill
    const gradient = ctx.createRadialGradient(-size * 0.3, -size * 0.3, 0, 0, 0, size);
    gradient.addColorStop(0, colors.highlight);
    gradient.addColorStop(0.5, colors.primary);
    gradient.addColorStop(1, colors.secondary);
    ctx.fillStyle = gradient;
    ctx.fill();
    
    // Border
    ctx.strokeStyle = colors.shadow;
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Highlight sparkle
    const sparkle = Math.sin(gem.sparklePhase) * 0.5 + 0.5;
    ctx.beginPath();
    ctx.arc(-size * 0.3, -size * 0.3, size * 0.2, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 255, 255, ${0.3 + sparkle * 0.4})`;
    ctx.fill();
    
    // Special gem indicators
    if (gem.special !== 'normal') {
      this.renderSpecialIndicator(ctx, gem.special, size);
    }
    
    ctx.restore();
  }

  private renderSpecialIndicator(ctx: CanvasRenderingContext2D, special: SpecialType, size: number): void {
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#FFFFFF';
    ctx.shadowBlur = 10;
    
    switch (special) {
      case 'horizontal':
        // Arrow left-right
        ctx.beginPath();
        ctx.moveTo(-size * 0.6, 0);
        ctx.lineTo(size * 0.6, 0);
        ctx.stroke();
        // Arrowheads
        ctx.beginPath();
        ctx.moveTo(-size * 0.4, -size * 0.2);
        ctx.lineTo(-size * 0.6, 0);
        ctx.lineTo(-size * 0.4, size * 0.2);
        ctx.moveTo(size * 0.4, -size * 0.2);
        ctx.lineTo(size * 0.6, 0);
        ctx.lineTo(size * 0.4, size * 0.2);
        ctx.stroke();
        break;
        
      case 'vertical':
        // Arrow up-down
        ctx.beginPath();
        ctx.moveTo(0, -size * 0.6);
        ctx.lineTo(0, size * 0.6);
        ctx.stroke();
        // Arrowheads
        ctx.beginPath();
        ctx.moveTo(-size * 0.2, -size * 0.4);
        ctx.lineTo(0, -size * 0.6);
        ctx.lineTo(size * 0.2, -size * 0.4);
        ctx.moveTo(-size * 0.2, size * 0.4);
        ctx.lineTo(0, size * 0.6);
        ctx.lineTo(size * 0.2, size * 0.4);
        ctx.stroke();
        break;
        
      case 'bomb':
        // Circle/star pattern
        for (let i = 0; i < 8; i++) {
          const angle = (i / 8) * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(Math.cos(angle) * size * 0.5, Math.sin(angle) * size * 0.5);
          ctx.stroke();
        }
        break;
        
      case 'rainbow':
        // Rainbow swirl
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.5, 0, Math.PI * 1.5);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.3, Math.PI * 0.5, Math.PI * 2);
        ctx.stroke();
        break;
    }
    
    ctx.shadowBlur = 0;
  }

  private renderParticles(ctx: CanvasRenderingContext2D): void {
    for (const p of this.particles) {
      const alpha = p.life / p.maxLife;
      ctx.globalAlpha = alpha;
      
      if (p.type === 'star') {
        // Star shape
        ctx.fillStyle = p.color;
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
          const angle = (i / 5) * Math.PI * 2 - Math.PI / 2;
          const r = i % 2 === 0 ? p.size : p.size * 0.5;
          ctx.lineTo(p.x + Math.cos(angle) * r, p.y + Math.sin(angle) * r);
        }
        ctx.closePath();
        ctx.fill();
      } else {
        // Circle
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  private renderSelection(ctx: CanvasRenderingContext2D): void {
    if (this.selectedGem && this.gameState === 'playing') {
      const x = GRID_OFFSET_X + this.selectedGem.col * CELL_SIZE;
      const y = GRID_OFFSET_Y + this.selectedGem.row * CELL_SIZE;
      
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#FFFFFF';
      ctx.shadowBlur = 10;
      
      // Animated selection ring
      const pulse = Math.sin(this.gameTime * 5) * 0.1 + 1;
      ctx.strokeRect(x + 2, y + 2, CELL_SIZE - 4, CELL_SIZE - 4);
      
      ctx.shadowBlur = 0;
    }
    
    // Hover highlight
    if (this.hoverGem && this.gameState === 'playing' && 
        (!this.selectedGem || this.hoverGem.row !== this.selectedGem.row || this.hoverGem.col !== this.selectedGem.col)) {
      const x = GRID_OFFSET_X + this.hoverGem.col * CELL_SIZE;
      const y = GRID_OFFSET_Y + this.hoverGem.row * CELL_SIZE;
      
      ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);
    }
  }

  private renderHint(ctx: CanvasRenderingContext2D): void {
    if (!this.showingHint || this.hintGems.length < 2) return;
    
    const pulse = Math.sin(this.gameTime * 6) * 0.3 + 0.7;
    
    for (const pos of this.hintGems) {
      const x = GRID_OFFSET_X + pos.col * CELL_SIZE + CELL_SIZE / 2;
      const y = GRID_OFFSET_Y + pos.row * CELL_SIZE + CELL_SIZE / 2;
      
      ctx.strokeStyle = `rgba(255, 215, 0, ${pulse})`;
      ctx.lineWidth = 3;
      ctx.shadowColor = '#FFD700';
      ctx.shadowBlur = 15;
      
      ctx.beginPath();
      ctx.arc(x, y, CELL_SIZE / 2 - 5, 0, Math.PI * 2);
      ctx.stroke();
    }
    
    ctx.shadowBlur = 0;
  }

  private renderHUD(ctx: CanvasRenderingContext2D): void {
    // Score display
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`Score: ${this.score.toLocaleString()}`, 20, 35);
    
    // Level display
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 20px Arial';
    ctx.fillText(`Level ${this.level}`, 20, 60);
    
    // Level progress bar
    const barWidth = 150;
    const barHeight = 12;
    const barX = 20;
    const barY = 68;
    const progress = Math.min(1, this.levelScore / this.levelTarget);
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(barX, barY, barWidth, barHeight);
    
    const progressGradient = ctx.createLinearGradient(barX, barY, barX + barWidth, barY);
    progressGradient.addColorStop(0, '#4ECDC4');
    progressGradient.addColorStop(1, '#44CF6E');
    ctx.fillStyle = progressGradient;
    ctx.fillRect(barX, barY, barWidth * progress, barHeight);
    
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barWidth, barHeight);
    
    ctx.fillStyle = '#AAAAAA';
    ctx.font = '12px Arial';
    ctx.fillText(`${this.levelScore}/${this.levelTarget}`, barX + barWidth + 8, barY + 10);
    
    // Combo display
    if (this.currentCombo > 1) {
      ctx.fillStyle = '#FF6B6B';
      ctx.font = 'bold 28px Arial';
      ctx.textAlign = 'right';
      const comboText = `${this.currentCombo}x COMBO!`;
      ctx.fillText(comboText, this.canvas.width - 20, 35);
      
      // Combo timer bar
      const comboBarWidth = 100;
      const comboProgress = this.comboTimer / 2;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(this.canvas.width - 20 - comboBarWidth, 42, comboBarWidth, 6);
      ctx.fillStyle = '#FF6B6B';
      ctx.fillRect(this.canvas.width - 20 - comboBarWidth, 42, comboBarWidth * comboProgress, 6);
    }
    
    // Instructions (bottom)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Click gems to swap • Match 3+ to score • Press H for hint', this.canvas.width / 2, this.canvas.height - 15);
  }

  private renderLevelComplete(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`LEVEL ${this.level} COMPLETE!`, this.canvas.width / 2, this.canvas.height / 2 - 30);
    
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '24px Arial';
    ctx.fillText(`Score: ${this.levelScore.toLocaleString()}`, this.canvas.width / 2, this.canvas.height / 2 + 20);
    ctx.fillText(`Max Combo: ${this.maxCombo}x`, this.canvas.width / 2, this.canvas.height / 2 + 50);
  }

  private renderGameOver(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    ctx.fillStyle = '#FF6B6B';
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('GAME OVER', this.canvas.width / 2, this.canvas.height / 2 - 60);
    
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '28px Arial';
    ctx.fillText(`Final Score: ${this.score.toLocaleString()}`, this.canvas.width / 2, this.canvas.height / 2);
    ctx.fillText(`Level Reached: ${this.level}`, this.canvas.width / 2, this.canvas.height / 2 + 35);
    ctx.fillText(`Max Combo: ${this.maxCombo}x`, this.canvas.width / 2, this.canvas.height / 2 + 70);
    
    ctx.fillStyle = '#AAAAAA';
    ctx.font = '20px Arial';
    ctx.fillText('Press SPACE to continue', this.canvas.width / 2, this.canvas.height / 2 + 120);
  }

  // ============================================================================
  // GAME LIFECYCLE
  // ============================================================================

  protected onPause(): void {
    this.gameState = 'paused';
  }

  protected onResume(): void {
    if (this.gameState === 'paused') {
      this.gameState = 'playing';
    }
  }

  protected onRestart(): void {
    this.score = 0;
    this.pickups = 0;
    this.level = 1;
    this.levelTarget = LEVEL_TARGET_BASE;
    this.currentCombo = 0;
    this.maxCombo = 0;
    this.totalMatches = 0;
    this.specialGemsCreated = 0;
    this.totalCascades = 0;
    this.gemsCleared = 0;
    this.particles = [];
    this.selectedGem = null;
    this.swapAnimation = null;
    this.screenShake = 0;
    
    this.initializeGrid();
    this.ensureNoInitialMatches();
    this.resetLevelStats();
    this.gameState = 'playing';
  }

  isGameOver(): boolean {
    return this.gameState === 'gameOver';
  }

  getScore() {
    return {
      ...super.getScore(),
      level: this.level,
      maxCombo: this.maxCombo,
      totalMatches: this.totalMatches,
      specialGemsCreated: this.specialGemsCreated,
      gemsCleared: this.gemsCleared,
    };
  }

  protected onGameEnd(finalScore: any): void {
    this.extendedGameData = {
      level_reached: this.level,
      max_combo: this.maxCombo,
      total_matches: this.totalMatches,
      special_gems: this.specialGemsCreated,
      gems_cleared: this.gemsCleared,
      total_cascades: this.totalCascades,
    };

    this.services?.analytics?.trackGameSpecificStat?.('color-drop', 'level_reached', this.level);
    this.services?.analytics?.trackGameSpecificStat?.('color-drop', 'max_combo', this.maxCombo);
    this.services?.analytics?.trackGameSpecificStat?.('color-drop', 'total_matches', this.totalMatches);
    this.services?.analytics?.trackGameSpecificStat?.('color-drop', 'special_gems', this.specialGemsCreated);
    this.services?.analytics?.trackGameSpecificStat?.('color-drop', 'gems_cleared', this.gemsCleared);

    super.onGameEnd?.(finalScore);
  }
}