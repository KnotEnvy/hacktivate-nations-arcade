import { BaseGame } from '@/games/shared/BaseGame';
import { GameManifest } from '@/lib/types';
import { PlayerCar } from './entities/PlayerCar';
import { RoadRenderer } from './systems/RoadRenderer';
import { WeaponSystem } from './systems/WeaponSystem';
import { EnemySpawner } from './systems/EnemySpawner';
import { SecondaryWeaponSystem } from './systems/SecondaryWeaponSystem';
import { ParticleSystem } from './systems/Particles';
import { CameraShake } from './systems/CameraShake';
import { SECONDARY_CONFIGS } from './data/secondaryWeapons';
import { PLAYER } from './data/constants';

interface AABB {
  x: number;
  y: number;
  w: number;
  h: number;
}

function aabb(a: AABB, b: AABB): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

const COMBO_DECAY_TIME = 4.0;
const MAX_COMBO_MULTIPLIER = 5;
const CIVILIANS_LOST_GAME_OVER = 3;
const SMOKE_SLOW_FACTOR = 0.4;
const SMOKE_SLOW_DURATION = 1.5;
const RECAP_INPUT_LOCKOUT = 1.2; // seconds before player can dismiss recap
const RECAP_AUTO_DISMISS = 12; // seconds before recap auto-finalizes

type DeathCause = 'enemy_ram' | 'enemy_bullet' | 'civilian_spree' | 'self_end';

interface RecapStats {
  cause: DeathCause;
  distance: number;
  score: number;
  kills: number;
  civilians: number;
  combo: number;
  vanPickups: number;
  secondaryUsed: number;
  topSpeed: number;
  timeMs: number;
}

export class SpeedRacerGame extends BaseGame {
  manifest: GameManifest = {
    id: 'speed-racer',
    title: 'Speed Racer',
    thumbnail: '/games/speed-racer/speed-racer-thumb.svg',
    inputSchema: ['keyboard'],
    assetBudgetKB: 130,
    tier: 2,
    description:
      'Spy-Hunter style vehicular combat racer. Dodge enemies, collect weapons, survive the highway.',
  };

  private player!: PlayerCar;
  private road!: RoadRenderer;
  private weapon!: WeaponSystem;
  private spawner!: EnemySpawner;
  private secondary!: SecondaryWeaponSystem;
  private particles!: ParticleSystem;
  private shake!: CameraShake;
  private muzzleTimer = 0;

  private distance = 0;
  private maxSpeed = 0;
  private enemiesDestroyed = 0;
  private civiliansLost = 0;
  private combo = 1;
  private maxCombo = 1;
  private comboTimer = 0;
  private vanPickups = 0;
  private secondaryFireWasDown = false;
  private endHandler?: (e: KeyboardEvent) => void;
  private slowedEnemies = new WeakMap<object, number>(); // enemy -> time remaining slowed

  // Death recap state
  private recapMode = false;
  private recapTimer = 0;
  private recapStats: RecapStats | null = null;
  private recapDismissArmed = false;

  protected onInit(): void {
    this.player = new PlayerCar();
    this.road = new RoadRenderer();
    this.weapon = new WeaponSystem();
    this.spawner = new EnemySpawner();
    this.secondary = new SecondaryWeaponSystem();
    this.particles = new ParticleSystem();
    this.shake = new CameraShake();
    this.muzzleTimer = 0;
    this.spawner.configure({
      spawnInterval: 1.4,
      enemyTypes: ['ram', 'shooter', 'armored'],
      enemyTypeWeights: [6, 3, 1],
      civilianChance: 0.7,
      civilianSpawnInterval: 2.4,
      vanIntervalMin: 18,
      vanIntervalMax: 28,
    });
    this.distance = 0;
    this.maxSpeed = 0;
    this.enemiesDestroyed = 0;
    this.civiliansLost = 0;
    this.combo = 1;
    this.maxCombo = 1;
    this.comboTimer = 0;
    this.vanPickups = 0;
    this.secondaryFireWasDown = false;
    this.slowedEnemies = new WeakMap();
    this.recapMode = false;
    this.recapTimer = 0;
    this.recapStats = null;
    this.recapDismissArmed = false;

    this.endHandler = (e) => {
      if (!this.isRunning || this.isPaused) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        if (!this.recapMode) {
          this.triggerDeath('self_end');
        }
      }
    };
    window.addEventListener('keydown', this.endHandler);
  }

  protected onUpdate(dt: number): void {
    if (this.recapMode) {
      this.updateRecap(dt);
      return;
    }
    const input = this.services.input;
    this.player.update(dt, input);
    this.road.update(this.player.speed, dt);

    const firing = input.isKeyPressed('Space');
    const bulletsBefore = this.weapon.getProjectiles().filter((b) => b.alive).length;
    this.weapon.update(dt, firing, this.player.x, this.player.y);
    const bulletsAfter = this.weapon.getProjectiles().filter((b) => b.alive).length;
    if (firing) {
      this.muzzleTimer -= dt;
      if (this.muzzleTimer <= 0 && bulletsAfter > bulletsBefore) {
        this.particles.burstMuzzle(this.player.x - 10, this.player.y - this.player.height / 2 - 4);
        this.particles.burstMuzzle(this.player.x + 10, this.player.y - this.player.height / 2 - 4);
        this.services?.audio?.playSound?.('shoot', { volume: 0.25 });
        this.muzzleTimer = 0.08;
      }
    } else {
      this.muzzleTimer = 0;
    }

    // Edge-detect Q for secondary weapon
    const secondaryDown = input.isKeyPressed('KeyQ');
    if (secondaryDown && !this.secondaryFireWasDown) {
      const result = this.secondary.fire(this.player.x, this.player.y, this.player.height);
      if (result.fired) {
        this.services?.audio?.playSound?.(result.missile ? 'laser' : 'whoosh', { volume: 0.4 });
        if (result.missile) this.shake.add(0.15);
      }
    }
    this.secondaryFireWasDown = secondaryDown;
    this.secondary.update(dt, this.player.speed);

    this.spawner.update(dt, this.player.speed, this.player.x, this.player.y);

    this.particles.update(dt);
    this.shake.update(dt);

    if (this.combo > 1) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.combo = 1;
      }
    }

    this.resolveCollisions(dt);

    this.distance += this.player.speed * dt;
    if (this.player.speed > this.maxSpeed) this.maxSpeed = this.player.speed;
    this.score = Math.floor(this.distance / 10) + this.enemiesDestroyed * 100;

    this.extendedGameData = {
      distance: Math.floor(this.distance),
      speed: Math.floor(this.maxSpeed),
      combo: this.maxCombo,
      powerups_used: this.secondary.totalUsed,
      enemies_destroyed: this.enemiesDestroyed,
      civilians_lost: this.civiliansLost,
      van_pickups: this.vanPickups,
      sections_cleared: 0,
    };
  }

  private triggerDeath(cause: DeathCause): void {
    if (this.recapMode || !this.isRunning) return;
    this.recapMode = true;
    this.recapTimer = 0;
    this.recapDismissArmed = false;
    this.recapStats = {
      cause,
      distance: Math.floor(this.distance),
      score: this.score,
      kills: this.enemiesDestroyed,
      civilians: this.civiliansLost,
      combo: this.maxCombo,
      vanPickups: this.vanPickups,
      secondaryUsed: this.secondary.totalUsed,
      topSpeed: Math.floor(this.maxSpeed),
      timeMs: Date.now() - this.startTime,
    };
    // Make sure final extendedGameData reflects the run for the official end-of-game flow
    this.extendedGameData = {
      distance: this.recapStats.distance,
      speed: this.recapStats.topSpeed,
      combo: this.recapStats.combo,
      powerups_used: this.recapStats.secondaryUsed,
      enemies_destroyed: this.recapStats.kills,
      civilians_lost: this.recapStats.civilians,
      van_pickups: this.recapStats.vanPickups,
      sections_cleared: 0,
    };
  }

  private updateRecap(dt: number): void {
    this.recapTimer += dt;
    // Keep the canvas alive: still tick particles + shake so the screen looks dynamic
    this.particles.update(dt);
    this.shake.update(dt);

    const input = this.services.input;
    // Wait for any-key release before arming dismissal to prevent the same Space
    // press that killed the player from immediately closing the recap.
    const anyDown =
      input.isKeyPressed('Space') ||
      input.isKeyPressed('Enter') ||
      input.isKeyPressed('KeyR') ||
      input.isKeyPressed('Escape');
    if (!this.recapDismissArmed) {
      if (this.recapTimer >= RECAP_INPUT_LOCKOUT && !anyDown) {
        this.recapDismissArmed = true;
      }
    } else if (anyDown || this.recapTimer >= RECAP_AUTO_DISMISS) {
      this.finalizeRecap();
    }
  }

  private finalizeRecap(): void {
    // Leave recapMode true so render() keeps showing recap until the
    // outer ThemedGameCanvas overlay takes over (no blank-screen gap).
    this.endGame();
  }

  private bumpCombo(): void {
    if (this.combo < MAX_COMBO_MULTIPLIER) this.combo += 1;
    if (this.combo > this.maxCombo) this.maxCombo = this.combo;
    this.comboTimer = COMBO_DECAY_TIME;
  }

  private dropCombo(): void {
    this.combo = 1;
    this.comboTimer = 0;
  }

  private killEnemy(enemy: ReturnType<EnemySpawner['getEnemies']>[number], force = false): void {
    if (!enemy.alive) return;
    if (enemy.config.bulletproof && !force) return;
    enemy.alive = false;
    this.enemiesDestroyed += 1;
    const reward = enemy.config.scoreValue * this.combo;
    this.score += reward;
    this.pickups += enemy.config.coinDrop;
    this.bumpCombo();
    const scale = enemy.config.bulletproof ? 1.6 : 1;
    this.particles.burstExplosion(enemy.x, enemy.y, scale);
    this.shake.add(enemy.config.bulletproof ? 0.45 : 0.18);
    this.services?.audio?.playSound?.('explosion', { volume: enemy.config.bulletproof ? 0.55 : 0.4 });
  }

  private resolveCollisions(dt: number): void {
    const pb = this.player.getBounds();

    // Player bullets vs civilians/enemies
    for (const bullet of this.weapon.getProjectiles()) {
      if (!bullet.alive) continue;
      const bb = bullet.getBounds();

      let hitCiv = false;
      for (const civ of this.spawner.getCivilians()) {
        if (!civ.alive) continue;
        if (aabb(bb, civ.getBounds())) {
          bullet.alive = false;
          civ.alive = false;
          this.civiliansLost += 1;
          this.dropCombo();
          this.particles.burstExplosion(civ.x, civ.y, 0.8);
          this.shake.add(0.25);
          this.services?.audio?.playSound?.('hit', { volume: 0.4 });
          if (this.civiliansLost >= CIVILIANS_LOST_GAME_OVER) {
            this.triggerDeath('civilian_spree');
            return;
          }
          hitCiv = true;
          break;
        }
      }
      if (hitCiv) continue;

      for (const enemy of this.spawner.getEnemies()) {
        if (!enemy.alive) continue;
        if (aabb(bb, enemy.getBounds())) {
          bullet.alive = false;
          if (enemy.config.bulletproof) {
            this.particles.burstHit(bullet.x, bullet.y);
            this.services?.audio?.playSound?.('hit', { volume: 0.2 });
            break;
          }
          const killed = enemy.takeHit(bullet.damage);
          if (killed) {
            this.enemiesDestroyed += 1;
            const reward = enemy.config.scoreValue * this.combo;
            this.score += reward;
            this.pickups += enemy.config.coinDrop;
            this.bumpCombo();
            this.particles.burstExplosion(enemy.x, enemy.y, 1);
            this.shake.add(0.18);
            this.services?.audio?.playSound?.('explosion', { volume: 0.4 });
          } else {
            this.particles.burstHit(bullet.x, bullet.y);
            this.services?.audio?.playSound?.('hit', { volume: 0.2 });
          }
          break;
        }
      }
    }

    // Missiles vs enemies (one-shot armored)
    for (const missile of this.secondary.getMissiles()) {
      if (!missile.alive) continue;
      const mb = missile.getBounds();
      for (const enemy of this.spawner.getEnemies()) {
        if (!enemy.alive) continue;
        if (aabb(mb, enemy.getBounds())) {
          missile.alive = false;
          this.killEnemy(enemy, true);
          break;
        }
      }
    }

    // Hazards (oil/smoke) vs enemies
    for (const hz of this.secondary.getHazards()) {
      if (!hz.alive) continue;
      const hb = hz.getBounds();
      for (const enemy of this.spawner.getEnemies()) {
        if (!enemy.alive) continue;
        if (!aabb(hb, enemy.getBounds())) continue;
        if (hz.type === 'oil') {
          // Oil destroys non-armored, spins out armored (unaffected)
          if (!enemy.config.bulletproof) {
            this.killEnemy(enemy);
          }
        } else if (hz.type === 'smoke') {
          // Smoke slows enemy temporarily
          this.slowedEnemies.set(enemy, SMOKE_SLOW_DURATION);
        }
      }
    }

    // Apply slow effect
    for (const enemy of this.spawner.getEnemies()) {
      const remaining = this.slowedEnemies.get(enemy) ?? 0;
      if (remaining > 0) {
        // Roll back enemy y movement to simulate slow
        enemy.y -= enemy.vy * dt * (1 - SMOKE_SLOW_FACTOR);
        const next = remaining - dt;
        if (next > 0) this.slowedEnemies.set(enemy, next);
        else this.slowedEnemies.delete(enemy);
      }
    }

    // Player vs enemy collision = game over
    for (const enemy of this.spawner.getEnemies()) {
      if (!enemy.alive) continue;
      if (aabb(pb, enemy.getBounds())) {
        this.particles.burstExplosion(this.player.x, this.player.y, 1.8);
        this.shake.add(0.9);
        this.services?.audio?.playSound?.('collision', { volume: 0.6 });
        this.triggerDeath('enemy_ram');
        return;
      }
    }

    // Player vs civilian — collateral
    for (const civ of this.spawner.getCivilians()) {
      if (!civ.alive) continue;
      if (aabb(pb, civ.getBounds())) {
        civ.alive = false;
        this.civiliansLost += 1;
        this.dropCombo();
        this.particles.burstExplosion(civ.x, civ.y, 0.9);
        this.shake.add(0.35);
        this.services?.audio?.playSound?.('collision', { volume: 0.45 });
        if (this.civiliansLost >= CIVILIANS_LOST_GAME_OVER) {
          this.triggerDeath('civilian_spree');
          return;
        }
      }
    }

    // Player vs Weapon Van — dock pickup
    for (const van of this.spawner.getVans()) {
      if (!van.alive || van.docked) continue;
      if (aabb(pb, van.getDockBounds())) {
        van.docked = true;
        van.alive = false;
        this.secondary.equip(van.payload);
        this.vanPickups += 1;
        const cfg = SECONDARY_CONFIGS[van.payload];
        this.particles.burstPickup(this.player.x, this.player.y, cfg.hudColor);
        this.services?.audio?.playSound?.('powerUp', { volume: 0.5 });
      }
    }

    // Enemy bullets vs player = game over
    for (const proj of this.spawner.getProjectiles()) {
      if (!proj.alive) continue;
      if (aabb(proj.getBounds(), pb)) {
        proj.alive = false;
        this.particles.burstExplosion(this.player.x, this.player.y, 1.6);
        this.shake.add(0.85);
        this.services?.audio?.playSound?.('explosion', { volume: 0.6 });
        this.triggerDeath('enemy_bullet');
        return;
      }
    }
  }

  protected onRender(ctx: CanvasRenderingContext2D): void {
    const w = this.canvas.width;
    const h = this.canvas.height;
    ctx.save();
    this.shake.apply(ctx);
    this.road.render(ctx, w, h);
    this.renderMotionLines(ctx, w, h);
    this.secondary.render(ctx);
    this.spawner.render(ctx);
    if (!this.recapMode) this.player.render(ctx);
    this.weapon.render(ctx);
    this.particles.render(ctx);
    ctx.restore();

    if (this.recapMode) this.renderRecap(ctx, w, h);
  }

  private renderRecap(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const stats = this.recapStats;
    if (!stats) return;

    // Dim the scene
    ctx.save();
    ctx.fillStyle = 'rgba(13,0,26,0.78)';
    ctx.fillRect(0, 0, w, h);

    // Animated entry — slide/scale from 0 to 1 over 0.5s
    const t = Math.min(1, this.recapTimer / 0.45);
    const eased = 1 - Math.pow(1 - t, 3);
    const scale = 0.85 + 0.15 * eased;
    const alpha = eased;
    ctx.globalAlpha = alpha;
    ctx.translate(w / 2, h / 2);
    ctx.scale(scale, scale);
    ctx.translate(-w / 2, -h / 2);

    // Panel
    const panelW = 460;
    const panelH = 380;
    const px = (w - panelW) / 2;
    const py = (h - panelH) / 2;

    // Glow border
    ctx.shadowColor = '#FF0080';
    ctx.shadowBlur = 24;
    ctx.fillStyle = '#1A0033';
    this.drawRoundRect(ctx, px, py, panelW, panelH, 14);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.strokeStyle = '#FF0080';
    ctx.lineWidth = 2;
    this.drawRoundRect(ctx, px, py, panelW, panelH, 14);
    ctx.stroke();

    // Header
    const causeLabel: Record<DeathCause, string> = {
      enemy_ram: 'WRECKED BY ENEMY',
      enemy_bullet: 'GUNNED DOWN',
      civilian_spree: 'TOO MANY CIVILIANS',
      self_end: 'RUN ABANDONED',
    };
    ctx.textAlign = 'center';
    ctx.fillStyle = '#FF0080';
    ctx.font = 'bold 32px Arial';
    ctx.fillText('RUN COMPLETE', w / 2, py + 50);
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 14px Arial';
    ctx.fillText(causeLabel[stats.cause], w / 2, py + 72);

    // Score row
    ctx.fillStyle = '#00FFFF';
    ctx.font = 'bold 14px Arial';
    ctx.fillText('SCORE', w / 2, py + 110);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 42px Arial';
    ctx.fillText(stats.score.toLocaleString(), w / 2, py + 150);

    // Stats grid
    const rows: { label: string; value: string; color: string }[] = [
      { label: 'DISTANCE', value: `${stats.distance} m`, color: '#00FFFF' },
      { label: 'TOP SPEED', value: `${stats.topSpeed}`, color: '#00FFFF' },
      { label: 'ENEMIES', value: `${stats.kills}`, color: '#FF6347' },
      { label: 'BEST COMBO', value: `x${stats.combo}`, color: '#FF0080' },
      { label: 'VAN PICKUPS', value: `${stats.vanPickups}`, color: '#FFD700' },
      { label: 'CIVILIANS', value: `${stats.civilians}/${CIVILIANS_LOST_GAME_OVER}`, color: '#FF6347' },
    ];
    const colW = panelW / 3;
    for (let i = 0; i < rows.length; i++) {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const cx = px + colW * col + colW / 2;
      const cy = py + 190 + row * 56;
      ctx.fillStyle = '#A0A0C0';
      ctx.font = 'bold 11px Arial';
      ctx.fillText(rows[i].label, cx, cy);
      ctx.fillStyle = rows[i].color;
      ctx.font = 'bold 22px Arial';
      ctx.fillText(rows[i].value, cx, cy + 24);
    }

    // Hint / call-to-improve
    ctx.fillStyle = '#FFFFFFAA';
    ctx.font = 'italic 12px Arial';
    ctx.fillText(this.improvementHint(stats), w / 2, py + panelH - 56);

    // Dismiss prompt — pulse once armed
    const armed = this.recapDismissArmed;
    if (armed) {
      const pulse = 0.7 + 0.3 * Math.sin(this.recapTimer * 5);
      ctx.globalAlpha = alpha * pulse;
      ctx.fillStyle = '#FFD700';
      ctx.font = 'bold 14px Arial';
      ctx.fillText('PRESS SPACE / ENTER TO CONTINUE', w / 2, py + panelH - 24);
    } else {
      ctx.globalAlpha = alpha * 0.5;
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '12px Arial';
      ctx.fillText('...', w / 2, py + panelH - 24);
    }

    ctx.restore();
  }

  private improvementHint(s: RecapStats): string {
    if (s.civilians >= CIVILIANS_LOST_GAME_OVER) return 'Aim before you fire — civilians end runs fast.';
    if (s.vanPickups === 0) return 'Find weapon vans for missiles, oil, and smoke.';
    if (s.combo < 3) return 'Chain kills without civilian hits to multiply your score.';
    if (s.kills < 5) return 'Hold SPACE to autofire — clear the road.';
    if (s.topSpeed < 600) return 'Hold W to push your top speed and rack distance.';
    return 'Solid run! Push for a bigger combo next time.';
  }

  private drawRoundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
  ): void {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  private renderMotionLines(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // Speed lines along sides — intensity scales with player speed above base
    const intensity = Math.max(0, (this.player.speed - PLAYER.BASE_SPEED) / (PLAYER.BOOST_SPEED - PLAYER.BASE_SPEED));
    if (intensity <= 0.05) return;
    ctx.save();
    ctx.fillStyle = `rgba(0,255,255,${0.35 * intensity})`;
    const lineCount = 6;
    const t = this.gameTime * 6;
    for (let i = 0; i < lineCount; i++) {
      const yOff = ((i / lineCount) * h + ((t * 220) % h)) % h;
      const len = 30 + intensity * 60;
      // Left side
      ctx.fillRect(20 + Math.random() * 30, yOff, 2, len);
      // Right side
      ctx.fillRect(w - 22 - Math.random() * 30, (yOff + 80) % h, 2, len);
    }
    ctx.restore();
  }

  protected onRenderUI(ctx: CanvasRenderingContext2D): void {
    if (this.recapMode) return; // recap panel takes over the screen
    ctx.save();
    ctx.fillStyle = '#00FFFF';
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'right';
    ctx.fillText(`SPEED ${Math.round(this.player.speed)}`, this.canvas.width - 20, 40);
    ctx.fillText(`DIST ${Math.round(this.distance)}m`, this.canvas.width - 20, 65);
    ctx.fillText(`KILLS ${this.enemiesDestroyed}`, this.canvas.width - 20, 90);

    // Combo meter
    ctx.textAlign = 'left';
    if (this.combo > 1) {
      ctx.fillStyle = '#FF1493';
      ctx.font = 'bold 22px Arial';
      ctx.fillText(`x${this.combo}`, 20, 40);
      ctx.fillStyle = '#FFFFFF88';
      ctx.font = '11px Arial';
      const barW = 60;
      const filled = Math.max(0, this.comboTimer / COMBO_DECAY_TIME) * barW;
      ctx.fillRect(20, 46, barW, 3);
      ctx.fillStyle = '#FF1493';
      ctx.fillRect(20, 46, filled, 3);
    }

    // Civilian danger
    ctx.fillStyle = this.civiliansLost > 0 ? '#FF6347' : '#FFFFFF88';
    ctx.font = 'bold 14px Arial';
    ctx.fillText(`CIVS ${this.civiliansLost}/${CIVILIANS_LOST_GAME_OVER}`, 20, 70);

    // Secondary weapon
    if (this.secondary.active) {
      const cfg = SECONDARY_CONFIGS[this.secondary.active];
      ctx.fillStyle = cfg.hudColor;
      ctx.font = 'bold 14px Arial';
      ctx.fillText(`[Q] ${cfg.label} ×${this.secondary.ammo}`, 20, 92);
    } else {
      ctx.fillStyle = '#FFFFFF44';
      ctx.font = '12px Arial';
      ctx.fillText('NO SECONDARY — find a weapon van', 20, 92);
    }

    ctx.textAlign = 'center';
    ctx.fillStyle = '#FFFFFFAA';
    ctx.font = '12px Arial';
    ctx.fillText(
      'A/D steer · W accel · S brake · SPACE fire · Q secondary · ESC end',
      this.canvas.width / 2,
      this.canvas.height - 12,
    );
    ctx.restore();
  }

  protected onDestroy(): void {
    if (this.endHandler) {
      window.removeEventListener('keydown', this.endHandler);
      this.endHandler = undefined;
    }
  }

  protected onRestart(): void {
    this.player.reset();
    this.road.reset();
    this.weapon.reset();
    this.spawner.reset();
    this.secondary.reset();
    this.particles.reset();
    this.shake.reset();
    this.muzzleTimer = 0;
    this.distance = 0;
    this.maxSpeed = 0;
    this.enemiesDestroyed = 0;
    this.civiliansLost = 0;
    this.combo = 1;
    this.maxCombo = 1;
    this.comboTimer = 0;
    this.vanPickups = 0;
    this.secondaryFireWasDown = false;
    this.slowedEnemies = new WeakMap();
    this.recapMode = false;
    this.recapTimer = 0;
    this.recapStats = null;
    this.recapDismissArmed = false;
  }
}
