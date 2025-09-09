import { BaseGame } from '@/games/shared/BaseGame';
import { GameManifest } from '@/lib/types';
// Icon set used for card faces (ASCII-safe)
const ICON_SET = ['★','♥','◆','♣','♠','☀','☂','♫','✿','☯','✦','☾','♘','⚑','✈','⚙'];

interface Card {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  value: number;
  flipped: boolean;
  matched: boolean;
  anim: number; // 0..1 flip animation progress (0=back, 1=front)
}

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
  private compareLock = false;
  private moves = 0;
  private grid = { rows: 4, cols: 4 };
  private margin = 16;
  private gap = 10;
  private mode: 'classic' | 'timed' = 'classic';
  private timeLimitSec = 90;
  private elapsedSec = 0;
  // Juice state (guarded so it's always defined)
  private shakeTime = 0;
  private particles: Array<{ x: number; y: number; vx: number; vy: number; life: number; color: string; size: number }> = [];
  
  // Achievement tracking
  private levelStartTime = 0;
  private matchesMadeThisGame = 0;
  private levelsCompletedThisGame = 0;
  private perfectLevelsThisGame = 0;

  protected onInit(): void {
    this.levelStartTime = Date.now();
    this.matchesMadeThisGame = 0;
    this.levelsCompletedThisGame = 0;
    this.perfectLevelsThisGame = 0;
    this.setupBoard();
  }

  protected onRestart(): void {
    this.score = 0;
    this.pickups = 0;
    this.moves = 0;
    this.firstPick = null;
    this.secondPick = null;
    this.flipCooldown = 0;
    this.levelStartTime = Date.now();
    this.matchesMadeThisGame = 0;
    this.levelsCompletedThisGame = 0;
    this.perfectLevelsThisGame = 0;
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

    // layout via computed sizing
    const { tileW: w, tileH: h } = this.computeLayout(rows, cols);
    this.cards = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        this.cards.push({ id: idx, x: this.margin + c * (w + this.gap), y: this.margin + r * (h + this.gap), w, h, value: values[idx], flipped: false, matched: false, anim: 0 });
      }
    }
  }

  private computeLayout(rows: number, cols: number): { tileW: number; tileH: number } {
    const availableW = this.canvas.width - this.margin * 2 - (cols - 1) * this.gap;
    const availableH = this.canvas.height - this.margin * 2 - (rows - 1) * this.gap;
    const tileW = Math.floor(availableW / cols);
    const tileH = Math.floor(availableH / rows);
    return { tileW, tileH };
  }

  protected onUpdate(dt: number): void {
    // Timer update
    this.elapsedSec += dt;
    if (this.mode === 'timed') {
      const remaining = this.timeLimitSec - this.elapsedSec;
      if (remaining <= 0 && this.cards.some(c => !c.matched)) {
        this.services.audio.playSound('game_over');
        this.endGame();
        return;
      }
    }
    if (this.flipCooldown > 0) {
      this.flipCooldown -= dt;
      if (this.flipCooldown <= 0 && this.firstPick && this.secondPick) {
        // Evaluate match
        if (this.firstPick.value === this.secondPick.value) {
          this.firstPick.matched = true;
          this.secondPick.matched = true;
          // Scoring with streak bonus
          this.streak += 1;
          if (this.streak > this.maxStreak) this.maxStreak = this.streak;
          this.score += 100 + this.streak * 20;
          this.pickups += 1;
          this.matchesMadeThisGame += 1;
          this.services.audio.playSound('success');
        } else {
          this.firstPick.flipped = false;
          this.secondPick.flipped = false;
          this.streak = 0;
          this.services.audio.playSound('collision');
        }
        this.firstPick = this.secondPick = null;
        this.compareLock = false;
      }
    }

    // End condition
    if (this.cards.length > 0 && this.cards.every(c => c.matched)) {
      // Award small bonus based on efficiency
      const efficiency = Math.max(0.2, (this.grid.rows * this.grid.cols) / (this.moves * 2));
      this.score += Math.floor(200 * efficiency);
      
      // Track achievements
      this.levelsCompletedThisGame += 1;
      const levelTime = (Date.now() - this.levelStartTime) / 1000; // seconds
      const perfectMoves = (this.grid.rows * this.grid.cols) / 2; // minimum possible moves
      const isPerfect = this.moves === perfectMoves;
      if (isPerfect) {
        this.perfectLevelsThisGame += 1;
      }
      
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

    // Keyboard power-ups (Phase 2)
    if (this.services.input.isKeyPressed?.('KeyH')) this.useHint();
    if (this.services.input.isKeyPressed?.('KeyS')) this.shuffleUnmatched();
    if (this.services.input.isKeyPressed?.('KeyV')) this.revealThree();
    // cooldowns decay
    this.hintCooldown = Math.max(0, this.hintCooldown - dt);
    this.shuffleCooldown = Math.max(0, this.shuffleCooldown - dt);
    this.revealCooldown = Math.max(0, this.revealCooldown - dt);
    // particles update
    for (const p of this.particles) { p.x += p.vx*dt; p.y += p.vy*dt; p.life -= dt; p.vy += 200*dt; }
    this.particles = this.particles.filter(p => p.life > 0).slice(-200);
    if (this.shakeTime > 0) this.shakeTime = Math.max(0, this.shakeTime - dt);

    // Keyboard shortcuts for presets/mode
    if (this.services.input.isKeyPressed?.('Digit1')) { this.setPreset(2, 2); }
    if (this.services.input.isKeyPressed?.('Digit2')) { this.setPreset(4, 4); }
    if (this.services.input.isKeyPressed?.('Digit3')) { this.setPreset(6, 6); }
    if (this.services.input.isKeyPressed?.('KeyM')) { this.toggleMode(); }
  }

  private handleTap(x: number, y: number): void {
    if (this.flipCooldown > 0 || this.compareLock) return;
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
      this.compareLock = true;
      this.flipCooldown = 0.6; // show for a short moment
    }
  }

  protected onRender(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#111827';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Animate flips towards target state
    const speed = 6; // higher is faster
    for (const c of this.cards) {
      const target = c.flipped || c.matched ? 1 : 0;
      c.anim += Math.sign(target - c.anim) * Math.min(Math.abs(target - c.anim), speed * (1 / 60));
    }

    const ICONS = ICON_SET;
    for (const c of this.cards) {
      const t = c.anim;
      // back to front flip via horizontal scale
      const cx = c.x + c.w / 2;
      const cy = c.y + c.h / 2;
      ctx.save();
      ctx.translate(cx, cy);
      const scaleX = Math.cos(Math.PI * (1 - t));
      ctx.scale(scaleX, 1);
      // Card face/back color
      const face = c.matched ? '#10B981' : '#2563EB';
      const back = '#374151';
      ctx.fillStyle = t > 0.5 ? face : back;
      ctx.fillRect(-c.w / 2, -c.h / 2, c.w, c.h);
      ctx.strokeStyle = '#1F2937';
      ctx.strokeRect(-c.w / 2, -c.h / 2, c.w, c.h);
      if (t > 0.5) {
        ctx.fillStyle = '#FFFFFF';
        ctx.font = `${Math.floor(c.h * 0.5)}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const icon = ICON_SET[c.value % ICON_SET.length];
        ctx.fillText(icon, 0, 0);
      }
      ctx.restore();
    }
  }

  protected onRenderUI(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'left';
    // BaseGame renders Score and Coins; show game-specific info below
    let y = this.getHudStartY();
    ctx.fillText(`Grid: ${this.grid.rows}x${this.grid.cols}  Mode: ${this.mode}`, 16, y); y += 20;
    ctx.fillText(`Moves: ${this.moves}`, 16, y); y += 20;
    const timeLabel = this.mode === 'timed' ? `Time Left: ${Math.max(0, this.timeLimitSec - this.elapsedSec).toFixed(1)}s` : `Time: ${this.elapsedSec.toFixed(1)}s`;
    ctx.fillText(timeLabel, 16, y); y += 20;
    if (this.maxStreak > 0) { ctx.fillText(`Streak: ${this.streak} (Max ${this.maxStreak})`, 16, y); y += 20; }
    const best = this.getBests();
    if (best) {
      if (best.leastMoves !== null) { ctx.fillText(`Best Moves: ${best.leastMoves}`, 16, y); y += 20; }
      if (best.bestTime !== null) { ctx.fillText(`Best Time: ${best.bestTime.toFixed(1)}s`, 16, y); y += 20; }
    }
  }

  protected onGameEnd(finalScore: any): void {
    const totalLevelTime = (Date.now() - this.levelStartTime) / 1000; // seconds
    const perfectMoves = (this.grid.rows * this.grid.cols) / 2; // minimum possible moves
    const isPerfect = this.moves === perfectMoves;
    const fastCompletion = totalLevelTime <= 30 ? totalLevelTime : 0; // Track if under 30 seconds

    this.extendedGameData = {
      matches_made: this.matchesMadeThisGame,
      levels_completed: this.levelsCompletedThisGame,
      perfect_levels: this.perfectLevelsThisGame + (isPerfect ? 1 : 0), // Include current level if perfect
      fast_completion: fastCompletion,
      total_moves: this.moves,
      completion_time: totalLevelTime
    };

    this.services?.analytics?.trackGameSpecificStat?.('memory', 'matches_made', this.matchesMadeThisGame);
    this.services?.analytics?.trackGameSpecificStat?.('memory', 'levels_completed', this.levelsCompletedThisGame + 1);
    this.services?.analytics?.trackGameSpecificStat?.('memory', 'perfect_levels', this.perfectLevelsThisGame + (isPerfect ? 1 : 0));
    if (fastCompletion > 0) {
      this.services?.analytics?.trackGameSpecificStat?.('memory', 'fast_completion', fastCompletion);
    }

    // Save bests
    this.saveBests(this.moves, totalLevelTime);
    super.onGameEnd?.(finalScore);
  }

  // Helpers: presets/mode
  private setPreset(rows: number, cols: number): void {
    if (rows * cols % 2 !== 0) return; // require even count
    this.grid = { rows, cols };
    this.moves = 0; this.elapsedSec = 0; this.firstPick = null; this.secondPick = null; this.flipCooldown = 0; this.streak = 0; this.maxStreak = 0;
    this.setupBoard();
  }
  private toggleMode(): void {
    this.mode = this.mode === 'classic' ? 'timed' : 'classic';
    this.elapsedSec = 0;
  }

  // Bests
  private bestKey(): string { return `memory_bests_${this.grid.rows}x${this.grid.cols}_${this.mode}`; }
  private getBests(): { leastMoves: number | null; bestTime: number | null } {
    try { const raw = localStorage.getItem(this.bestKey()); return raw ? JSON.parse(raw) : { leastMoves: null, bestTime: null }; } catch { return { leastMoves: null, bestTime: null }; }
  }
  private saveBests(moves: number, timeSec: number): void {
    const current = this.getBests();
    const leastMoves = current.leastMoves === null ? moves : Math.min(current.leastMoves, moves);
    const bestTime = current.bestTime === null ? timeSec : Math.min(current.bestTime, timeSec);
    try { localStorage.setItem(this.bestKey(), JSON.stringify({ leastMoves, bestTime })); } catch {}
  }

  protected onResize(width: number, height: number): void {
    const { rows, cols } = this.grid;
    if (!this.cards || this.cards.length !== rows * cols) return;
    const { tileW: w, tileH: h } = this.computeLayout(rows, cols);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        const card = this.cards[idx];
        if (!card) continue;
        card.x = this.margin + c * (w + this.gap);
        card.y = this.margin + r * (h + this.gap);
        card.w = w; card.h = h;
      }
    }
  }

  // Streak state
  private streak = 0;
  private maxStreak = 0;
  // Power-up cooldowns (guarded defaults)
  private hintCooldown = 0;
  private shuffleCooldown = 0;
  private revealCooldown = 0;

  // Power-up helpers (safe no-ops if not used)
  private useHint(): void {
    if (this.hintCooldown > 0 || this.compareLock) return;
    const unmatchedHidden = this.cards.filter(c => !c.matched && !c.flipped);
    const groups: Record<number, Card[]> = {};
    unmatchedHidden.forEach(c => { (groups[c.value] ||= []).push(c); });
    const pair = Object.values(groups).find(g => g.length >= 2);
    if (!pair) return;
    pair[0].flipped = true; pair[1].flipped = true;
    this.services.audio.playSound('powerup');
    setTimeout(() => { pair[0].flipped = false; pair[1].flipped = false; }, 600);
    this.hintCooldown = 6;
    this.score = Math.max(0, this.score - 10);
  }

  private shuffleUnmatched(): void {
    if (this.shuffleCooldown > 0 || this.compareLock) return;
    const unmatched = this.cards.filter(c => !c.matched);
    const positions = unmatched.map(c => ({ x: c.x, y: c.y }));
    for (let i = positions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [positions[i], positions[j]] = [positions[j], positions[i]];
    }
    unmatched.forEach((c, i) => { c.x = positions[i].x; c.y = positions[i].y; });
    this.services.audio.playSound('powerup');
    this.shuffleCooldown = 10;
    this.score = Math.max(0, this.score - 15);
  }

  private revealThree(): void {
    if (this.revealCooldown > 0 || this.compareLock) return;
    const hidden = this.cards.filter(c => !c.matched && !c.flipped);
    if (hidden.length === 0) return;
    const picks = [...hidden].sort(() => Math.random() - 0.5).slice(0, Math.min(3, hidden.length));
    picks.forEach(c => c.flipped = true);
    this.services.audio.playSound('powerup');
    setTimeout(() => { picks.forEach(c => c.flipped = false); }, 700);
    this.revealCooldown = 12;
    this.score = Math.max(0, this.score - 20);
  }
}
