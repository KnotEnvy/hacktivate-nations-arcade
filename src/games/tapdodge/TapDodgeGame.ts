import { BaseGame } from '@/games/shared/BaseGame';
import { GameManifest } from '@/lib/types';

interface Obstacle { x: number; y: number; w: number; h: number; speed: number; nm?: boolean; solo?: boolean }
interface Coin { x: number; y: number; r: number; vy: number }
interface Trail { x: number; y: number; alpha: number }
interface Particle { x: number; y: number; vx: number; vy: number; life: number; color: string; size: number }
type PowerType = 'shield' | 'slow' | 'magnet' | 'drone';
interface PowerUp { x: number; y: number; w: number; h: number; vy: number; type: PowerType }
interface Popup { x: number; y: number; text: string; life: number }
interface Bullet { x: number; y: number; vy: number; r: number }

export class TapDodgeGame extends BaseGame {
  manifest: GameManifest = {
    id: 'tapdodge',
    title: 'Tap Dodge',
    thumbnail: '/games/tapdodge/tapdodge-thumb.svg',
    inputSchema: ['touch'],
    assetBudgetKB: 60,
    tier: 0,
    description: 'Tap left/right to dodge falling blocks.'
  };

  private player = { x: 0, y: 0, w: 36, h: 36, speed: 420 };
  private obstacles: Obstacle[] = [];
  private coins: Coin[] = [];
  private trail: Trail[] = [];
  private spawnTimer = 0;
  private spawnInterval = 1.0;
  private started = false;
  private combo = 0;
  private comboTimer = 0;
  private particles: Particle[] = [];
  private powerups: PowerUp[] = [];
  private shakeTime = 0; private shakeMag = 0;
  private readyTimer = 1.0;
  private invulnTime = 0;
  private magnetTimer = 0;
  private slowTimer = 0; // global speed scale timer
  private speedScale = 1;
  private nearTimer = 0; // brief slow-mo on near miss
  private hitFreeze = 0; // short freeze after being hit
  private finishingTimer = 0; // final burst before game over
  private bannerText: string | null = null; private bannerTimer = 0;
  private pauseLatch = false;
  private highScore = 0;
  private popups: Popup[] = [];
  private lives = 3;

  // Tuning knobs
  private readonly NEAR_MISS_RADIUS = 32; // pixels to count as near miss
  private readonly NEAR_MISS_BONUS = 15;
  private nearChain = 0; private nearChainTimer = 0;
  private droneTimer = 0; private droneFire = 0; private bullets: Bullet[] = [];
  
  // Achievement tracking
  private gameStartTime = 0;

  protected onInit(): void {
    this.reset();
    try { const s = localStorage.getItem('tapdodge_best'); this.highScore = s ? parseInt(s, 10) || 0 : 0; } catch {}
    this.showBanner('Tap Dodge');
  }

  protected onRestart(): void {
    this.score = 0;
    this.pickups = 0;
    this.spawnInterval = 1.0;
    this.started = false;
    this.reset();
    this.readyTimer = 1.0;
    this.invulnTime = 0.8;
    this.speedScale = 1; this.slowTimer = 0; this.magnetTimer = 0; this.nearTimer = 0; this.combo = 0; this.comboTimer = 0;
    this.hitFreeze = 0; this.finishingTimer = 0; this.lives = 3;
    this.showBanner('Ready');
  }

  private reset(): void {
    this.player.x = this.canvas.width / 2 - this.player.w / 2;
    this.player.y = this.canvas.height - 60;
    this.obstacles = [];
    this.coins = [];
    this.trail = [];
    this.spawnTimer = 0;
    this.particles = [];
    this.powerups = [];
  }

  protected onUpdate(dt: number): void {
    this.handleInput(dt);
    // Final burst flow
    if (this.finishingTimer > 0) {
      this.finishingTimer -= dt;
      // Visual updates only during final burst
      const pcx0 = this.player.x + this.player.w / 2; const pcy0 = this.player.y + this.player.h / 2;
      this.trail.push({ x: pcx0, y: pcy0, alpha: 0.6 });
      if (this.trail.length > 40) this.trail.shift();
      for (const t of this.trail) t.alpha = Math.max(0, t.alpha - dt * 1.5);
      for (const pt of this.particles) { pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.life -= dt; pt.vy += 300 * dt; }
      this.particles = this.particles.filter(pt => pt.life > 0).slice(-200);
      for (const p of this.popups) { p.y -= 25 * dt; p.life -= dt; }
      this.popups = this.popups.filter(p => p.life > 0).slice(-30);
      if (this.finishingTimer <= 0) this.endGame();
      return;
    }
    // Countdown auto-start if not started
    if (!this.started) {
      if (this.readyTimer > 0) this.readyTimer -= dt;
      if (this.readyTimer <= 0) { 
        this.started = true; 
        this.invulnTime = 0.8; 
        this.gameStartTime = Date.now();
      }
      // Trail persist
      const pcx0 = this.player.x + this.player.w / 2; const pcy0 = this.player.y + this.player.h / 2;
      this.trail.push({ x: pcx0, y: pcy0, alpha: 0.6 });
      if (this.trail.length > 40) this.trail.shift();
      for (const t of this.trail) t.alpha = Math.max(0, t.alpha - dt * 1.5);
      return;
    }

    // Short freeze after hit
    if (this.hitFreeze > 0) {
      this.hitFreeze -= dt;
      const pcx0 = this.player.x + this.player.w / 2; const pcy0 = this.player.y + this.player.h / 2;
      this.trail.push({ x: pcx0, y: pcy0, alpha: 0.6 });
      if (this.trail.length > 40) this.trail.shift();
      for (const t of this.trail) t.alpha = Math.max(0, t.alpha - dt * 1.5);
      for (const pt of this.particles) { pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.life -= dt; pt.vy += 300 * dt; }
      this.particles = this.particles.filter(pt => pt.life > 0).slice(-200);
      for (const p of this.popups) { p.y -= 25 * dt; p.life -= dt; }
      this.popups = this.popups.filter(p => p.life > 0).slice(-30);
      return;
    }

    // Increase score by survival time
    this.score += Math.floor(dt * 100);

    // Spawn obstacles
    this.spawnTimer += dt;
    if (this.spawnTimer >= this.spawnInterval) {
      this.spawnTimer = 0;
      this.spawnInterval = Math.max(0.5, this.spawnInterval * 0.98);
      // Occasionally spawn a row with a safe gap and a coin in the gap
      if (Math.random() < 0.4) this.spawnRowWithGap(); else this.spawnObstacle();
      // Rare power-up
      if (Math.random() < 0.06) this.spawnPowerUp();
    }

    // Move obstacles
    const scale = this.speedScale;
    for (const o of this.obstacles) { o.y += o.speed * dt * scale; }
    this.obstacles = this.obstacles.filter(o => o.y < this.canvas.height + o.h);
    // Coins move
    for (const c of this.coins) c.y += c.vy * dt * scale;
    this.coins = this.coins.filter(c => c.y < this.canvas.height + c.r);
    // Power-ups move
    for (const p of this.powerups) p.y += p.vy * dt * scale;
    this.powerups = this.powerups.filter(p => p.y < this.canvas.height + p.h);

    // Collisions
    for (const o of this.obstacles) {
      if (this.intersects(this.player, o)) {
        if (this.invulnTime > 0 || this.shieldActive()) {
          // absorb
          this.invulnTime = Math.max(this.invulnTime, 0.5);
          this.addShake(0.4, 7);
          continue;
        }
        this.spawnExplosion(this.player.x + this.player.w / 2, this.player.y + this.player.h / 2, '#EF4444');
        if (this.lives > 1) {
          this.lives -= 1;
          this.hitFreeze = 0.5;
          this.invulnTime = Math.max(this.invulnTime, 1.0);
          this.addShake(0.6, 10);
          continue;
        } else {
          this.lives = 0;
          // Final multi-burst
          for (let i = 0; i < 6; i++) {
            const ex = (i + 0.5) * (this.canvas.width / 6);
            const ey = this.player.y - 40 + Math.random() * 80;
            this.spawnExplosion(ex, ey, '#EF4444');
          }
          this.finishingTimer = 0.9;
          this.addShake(0.8, 12);
          this.services.analytics.trackFeatureUsage('tapdodge_game_over', { score: this.score, combo: this.combo });
          return;
        }
      }
      // Near miss detection: close but not intersect
      const px = this.player.x + this.player.w / 2; const py = this.player.y + this.player.h / 2;
      const dx = Math.max(o.x - px, 0, px - (o.x + o.w));
      const dy = Math.max(o.y - py, 0, py - (o.y + o.h));
      const dist = Math.hypot(dx, dy);
      if (!o.nm && dist < this.NEAR_MISS_RADIUS && !this.intersects(this.player, o)) {
        o.nm = true;
        this.nearTimer = 0.6; // longer slow-mo
        this.speedScale = Math.min(this.speedScale, 0.65);
        this.nearChainTimer = 1.5; this.nearChain = Math.min(5, this.nearChain + 1);
        const nBonus = Math.floor(this.NEAR_MISS_BONUS * (1 + 0.25 * (this.nearChain - 1)));
        this.score += nBonus;
        this.popups.push({ x: px, y: py - 12, text: `Near +${nBonus}`, life: 0.8 });
        this.spawnSpark(px, py, '#93C5FD');
        this.services.audio.playSound('success');
        this.services.analytics.trackFeatureUsage('tapdodge_near_miss');
      }
    }
    // Collect coins
    const pcx = this.player.x + this.player.w / 2;
    const pcy = this.player.y + this.player.h / 2;
    for (const c of this.coins) {
      // Magnet attraction
      if (this.magnetTimer > 0) {
        const dirx = pcx - c.x; const diry = pcy - c.y;
        const d = Math.hypot(dirx, diry);
        const r = 140;
        if (d < r && d > 0.001) { c.x += (dirx / d) * 220 * dt; c.y += (diry / d) * 220 * dt; }
      }
      const dx = c.x - pcx, dy = c.y - pcy;
      if (dx*dx + dy*dy < (c.r + Math.min(this.player.w, this.player.h)/2)**2) {
        c.y = this.canvas.height + 100;
        this.pickups += 1;
        this.combo = Math.min(10, this.combo + 1);
        this.comboTimer = 2.0;
        const bonus = 100 * (1 + this.combo * 0.2);
        this.score += Math.floor(bonus);
        this.services.audio.playSound('coin');
        this.services.analytics.trackFeatureUsage('tapdodge_coin');
        this.spawnSpark(c.x, c.y, '#FBBF24');
        this.popups.push({ x: c.x, y: c.y - 10, text: `+${Math.floor(bonus)}`, life: 0.7 });
      }
    }
    this.coins = this.coins.filter(c => c.y < this.canvas.height + c.r);

    // Collect power-ups
    for (const p of this.powerups) {
      if (this.intersects(this.player, p)) {
        if (p.type === 'shield') { this.invulnTime = Math.max(this.invulnTime, 1.5); }
        if (p.type === 'slow') { this.slowTimer = 4; this.speedScale = 0.7; }
        if (p.type === 'magnet') { this.magnetTimer = 6; }
        this.services.audio.playSound('powerup');
        this.services.analytics.trackFeatureUsage('tapdodge_power', { type: p.type });
        p.y = this.canvas.height + 100;
      }
    }
    this.powerups = this.powerups.filter(p => p.y < this.canvas.height + p.h);

    // Combo timer decay
    if (this.comboTimer > 0) { this.comboTimer -= dt; if (this.comboTimer <= 0) this.combo = 0; }
    // Invulnerability decay
    if (this.invulnTime > 0) this.invulnTime = Math.max(0, this.invulnTime - dt);
    // Slow effect decay
    if (this.slowTimer > 0) { this.slowTimer -= dt; if (this.slowTimer <= 0) this.speedScale = 1; }
    // Near miss decay
    if (this.nearTimer > 0) { this.nearTimer -= dt; if (this.nearTimer <= 0 && this.slowTimer <= 0) this.speedScale = 1; }
    // Magnet decay
    if (this.magnetTimer > 0) this.magnetTimer -= dt;
    if (this.nearChainTimer > 0) { this.nearChainTimer -= dt; if (this.nearChainTimer <= 0) this.nearChain = 0; }
    // Drone update
    if (this.droneTimer > 0) {
      this.droneTimer -= dt;
      this.droneFire -= dt;
      if (this.droneFire <= 0) {
        this.droneFire = 0.28;
        const cx = this.player.x + this.player.w / 2;
        this.bullets.push({ x: cx, y: this.player.y, vy: -360, r: 3 });
        this.services.audio.playSound('click');
      }
    }
    for (const b of this.bullets) { b.y += b.vy * dt * this.speedScale; }
    // Bullet collisions: destroy solo obstacles only
    for (const b of this.bullets) {
      for (const o of this.obstacles) {
        if (o.solo && b.x > o.x && b.x < o.x + o.w && b.y - b.r < o.y + o.h && b.y + b.r > o.y) {
          o.y = this.canvas.height + o.h + 100; // remove
          b.y = -100;
          this.score += 80;
          this.popups.push({ x: o.x + o.w / 2, y: o.y, text: '+80', life: 0.7 });
          this.spawnSpark(o.x + o.w / 2, o.y, '#F59E0B');
          this.addShake(0.25, 5);
          this.services.analytics.trackFeatureUsage('tapdodge_drone_kill');
          break;
        }
      }
    }
    this.bullets = this.bullets.filter(b => b.y + b.r > -20);

    // Trail update
    this.trail.push({ x: pcx, y: pcy, alpha: 0.8 });
    if (this.trail.length > 40) this.trail.shift();
    for (const t of this.trail) t.alpha = Math.max(0, t.alpha - dt * 1.5);

    // Particles update
    for (const pt of this.particles) { pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.life -= dt; pt.vy += 300 * dt; }
    this.particles = this.particles.filter(pt => pt.life > 0).slice(-200);

    // Popups update
    for (const p of this.popups) { p.y -= 25 * dt; p.life -= dt; }
    this.popups = this.popups.filter(p => p.life > 0).slice(-30);

    // Track best in memory; persist on game end only
    if (this.score > this.highScore) { this.highScore = this.score; }
  }

  private spawnObstacle(): void {
    const lanes = 5;
    const laneW = this.canvas.width / lanes;
    const lane = Math.floor(Math.random() * lanes);
    const w = laneW * (0.6 + Math.random() * 0.3);
    const x = lane * laneW + (laneW - w) / 2;
    const h = 20 + Math.random() * 30;
    const speed = 140 + Math.random() * 120 + Math.min(160, (1 - this.spawnInterval) * 200);
    this.obstacles.push({ x, y: -h, w, h, speed, solo: true });
  }

  private spawnRowWithGap(): void {
    const lanes = 5;
    const laneW = this.canvas.width / lanes;
    const gapLane = Math.floor(Math.random() * lanes);
    const y = -30;
    const h = 24;
    const speed = 160 + Math.min(180, (1 - this.spawnInterval) * 220);
    for (let lane = 0; lane < lanes; lane++) {
      if (lane === gapLane) continue;
      const w = laneW * 0.8;
      const x = lane * laneW + (laneW - w) / 2;
      this.obstacles.push({ x, y, w, h, speed, solo: false });
    }
    // Coin in the safe gap
    const cx = gapLane * laneW + laneW / 2;
    this.coins.push({ x: cx, y: y - 20, r: 8, vy: speed });
  }

  private handleInput(dt: number): void {
    // Touch: left/right half to move; touch to start
    const touches = this.services.input.getTouches?.() || [];
    if (touches.length > 0) {
      const t = touches[0];
      const targetX = t.x - this.player.w / 2;
      const lerp = 1 - Math.pow(0.001, dt);
      this.player.x = this.player.x + (targetX - this.player.x) * lerp;
      if (!this.started) { 
        this.started = true; 
        this.invulnTime = 0.8; 
        this.gameStartTime = Date.now();
        this.services.audio.playSound('click'); 
      }
    }
    // Also allow keyboard arrows as fallback
    const move = this.player.speed * dt;
    if (this.services.input.isLeftPressed()) { 
      this.player.x -= move; 
      if (!this.started) {
        this.started = true;
        this.gameStartTime = Date.now();
      }
    }
    if (this.services.input.isRightPressed()) { 
      this.player.x += move; 
      if (!this.started) {
        this.started = true;
        this.gameStartTime = Date.now();
      }
    }

    // Clamp
    this.player.x = Math.max(0, Math.min(this.canvas.width - this.player.w, this.player.x));

    // Pause toggle
    const pausePressed = this.services.input.isKeyPressed?.('Escape') || this.services.input.isKeyPressed?.('KeyP');
    if (pausePressed && !this.pauseLatch) { this.pauseLatch = true; if (this.isPaused) this.resume(); else this.pause(); }
    else if (!pausePressed) this.pauseLatch = false;
  }

  private intersects(a: {x:number;y:number;w:number;h:number}, b: {x:number;y:number;w:number;h:number}): boolean {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  protected onRender(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#0B1020';
    if (this.shakeTime > 0) {
      this.shakeTime = Math.max(0, this.shakeTime - 1 / 60);
      const m = this.shakeMag * this.shakeTime; ctx.save();
      ctx.translate((Math.random() - 0.5) * 2 * m, (Math.random() - 0.5) * 2 * m);
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      this.renderScene(ctx);
      ctx.restore();
    } else {
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      this.renderScene(ctx);
    }
  
    // Banner
    if (this.bannerText && this.bannerTimer > 0) {
      const alpha = Math.min(1, this.bannerTimer); ctx.save(); ctx.globalAlpha = alpha;
      ctx.fillStyle = 'rgba(0,0,0,0.4)'; const w = this.canvas.width * 0.6; const h = 50;
      ctx.fillRect((this.canvas.width - w) / 2, 70, w, h);
      ctx.fillStyle = '#FFFFFF'; ctx.textAlign = 'center'; ctx.font = 'bold 22px Arial';
      ctx.fillText(this.bannerText, this.canvas.width / 2, 102);
      ctx.restore(); this.bannerTimer -= 1 / 60; if (this.bannerTimer <= 0) this.bannerText = null;
    }

    // Paused overlay
    if (this.isPaused) {
      ctx.save(); ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      ctx.fillStyle = '#FFF'; ctx.textAlign = 'center'; ctx.font = 'bold 24px Arial'; ctx.fillText('Paused', this.canvas.width / 2, this.canvas.height / 2);
      ctx.restore();
    }
  }

  private renderScene(ctx: CanvasRenderingContext2D): void {
    // Trail
    for (const t of this.trail) { ctx.globalAlpha = t.alpha * 0.5; ctx.fillStyle = '#22D3EE'; ctx.beginPath(); ctx.arc(t.x, t.y, 10, 0, Math.PI * 2); ctx.fill(); }
    ctx.globalAlpha = 1;
    // Player (with shield blink)
    const alpha = this.invulnTime > 0 ? (Math.sin((this.gameTime || 0) * 20) > 0 ? 0.5 : 0.9) : 1;
    ctx.globalAlpha = alpha; ctx.fillStyle = '#22D3EE'; ctx.fillRect(this.player.x, this.player.y, this.player.w, this.player.h); ctx.globalAlpha = 1;
    if (this.shieldActive()) { ctx.strokeStyle = 'rgba(34,211,238,0.5)'; ctx.lineWidth = 3; const cx = this.player.x + this.player.w/2; const cy = this.player.y + this.player.h/2; ctx.beginPath(); ctx.arc(cx, cy, 28, 0, Math.PI*2); ctx.stroke(); }
    // Obstacles
    ctx.fillStyle = '#EF4444'; for (const o of this.obstacles) { ctx.fillRect(o.x, o.y, o.w, o.h); }
    // Coins
    ctx.fillStyle = '#FBBF24'; for (const c of this.coins) { ctx.beginPath(); ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2); ctx.fill(); }
    // Power-ups
    for (const p of this.powerups) { ctx.fillStyle = p.type==='shield'?'#22D3EE':p.type==='slow'?'#8B5CF6':p.type==='magnet'?'#F59E0B':'#93C5FD'; ctx.fillRect(p.x, p.y, p.w, p.h); }
    // Bullets
    ctx.fillStyle = '#93C5FD'; for (const b of this.bullets) { ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI*2); ctx.fill(); }
    // Particles
    for (const pt of this.particles) { ctx.globalAlpha = Math.max(0, Math.min(1, pt.life)); ctx.fillStyle = pt.color; ctx.fillRect(pt.x, pt.y, pt.size, pt.size); }
    ctx.globalAlpha = 1;
    // Popups
    ctx.fillStyle = '#FFFFFF'; ctx.font = 'bold 14px Arial'; ctx.textAlign = 'center';
    for (const p of this.popups) { ctx.globalAlpha = Math.max(0, Math.min(1, p.life)); ctx.fillText(p.text, p.x, p.y); }
    ctx.globalAlpha = 1;
    // Near-miss vignette
    if (this.nearTimer > 0) { ctx.save(); ctx.fillStyle = 'rgba(147,197,253,0.15)'; ctx.fillRect(0,0,this.canvas.width,this.canvas.height); ctx.restore(); }
  }

  protected onRenderUI(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'left';
    // BaseGame renders Score and Coins; render game-specific HUD below
    let y = this.getHudStartY();
    if (this.combo > 0) { ctx.fillText(`Combo: x${(1 + this.combo * 0.2).toFixed(1)}`, 16, y); y += 20; }
    ctx.fillText(`Best: ${this.highScore}`, 16, y); y += 20;
    if (this.magnetTimer > 0) { ctx.fillText(`Magnet: ${this.magnetTimer.toFixed(1)}s`, 16, y); y += 20; }
    const slowLeft = Math.max(this.slowTimer, this.nearTimer);
    if (slowLeft > 0) { ctx.fillText(`Slow: ${slowLeft.toFixed(1)}s`, 16, y); y += 20; }
    if (this.droneTimer > 0) { ctx.fillText(`Drone: ${this.droneTimer.toFixed(1)}s`, 16, y); y += 20; }
    if (!this.started) {
      ctx.textAlign = 'center';
      if (this.readyTimer > 0) ctx.fillText(`Get Ready: ${Math.ceil(this.readyTimer)}`, this.canvas.width / 2, this.canvas.height / 2);
      else ctx.fillText('Tap to start; drag to move', this.canvas.width / 2, this.canvas.height / 2 + 20);
    }
  }

  protected onGameEnd(finalScore: import('@/lib/types').GameScore): void {
    try {
      const prev = parseInt(localStorage.getItem('tapdodge_best') || '0', 10) || 0;
      if (finalScore.score > prev) localStorage.setItem('tapdodge_best', String(finalScore.score));
    } catch {}

    const survivalTime = this.gameStartTime > 0 ? (Date.now() - this.gameStartTime) / 1000 : 0; // seconds

    this.extendedGameData = {
      survival_time: survivalTime,
      near_misses: this.nearChain, // track near miss chains
      coins_collected: this.pickups,
      max_combo: this.combo
    };

    this.services?.analytics?.trackGameSpecificStat?.('tapdodge', 'survival_time', survivalTime);
    this.services?.analytics?.trackGameSpecificStat?.('tapdodge', 'near_misses', this.nearChain);
    this.services?.analytics?.trackGameSpecificStat?.('tapdodge', 'coins_collected', this.pickups);
    this.services?.analytics?.trackGameSpecificStat?.('tapdodge', 'max_combo', this.combo);

    super.onGameEnd?.(finalScore);
  }

  private spawnPowerUp(): void {
    const types: PowerType[] = ['shield','slow','magnet','drone'];
    const type = types[Math.floor(Math.random() * types.length)];
    const size = 18; const x = Math.random() * (this.canvas.width - size);
    const vy = 120 + Math.random() * 80;
    this.powerups.push({ x, y: -size, w: size, h: size, vy, type });
  }

  private addShake(time: number, mag: number): void { this.shakeTime = Math.max(this.shakeTime, time); this.shakeMag = Math.max(this.shakeMag, mag); }
  private spawnSpark(x: number, y: number, color: string): void { for (let i=0;i<12;i++){ const a=Math.random()*Math.PI*2; const s=60+Math.random()*120; this.particles.push({ x, y, vx:Math.cos(a)*s, vy:Math.sin(a)*s, life:0.4+Math.random()*0.3, color, size:2+Math.random()*2 }); } }
  private spawnExplosion(x: number, y: number, color: string): void { for (let i=0;i<24;i++){ const a=Math.random()*Math.PI*2; const s=80+Math.random()*160; this.particles.push({ x, y, vx:Math.cos(a)*s, vy:Math.sin(a)*s, life:0.6+Math.random()*0.4, color, size:2+Math.random()*3 }); } this.addShake(0.6,10); }
  private showBanner(text: string): void { this.bannerText = text; this.bannerTimer = 2.0; }
  private shieldActive(): boolean { return this.invulnTime > 0; }
}
