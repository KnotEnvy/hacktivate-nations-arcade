import { ROAD } from '../data/constants';

export type EnemyType = 'ram' | 'shooter' | 'armored';
export type EnemyVisual = 'car' | 'jetboat';

export interface EnemyConfig {
  type: EnemyType;
  forwardSpeed: number;   // world-frame forward speed (px/sec)
  width: number;
  height: number;
  hp: number;
  scoreValue: number;
  coinDrop: number;
  bulletproof: boolean;
  color: string;
  accentColor: string;
}

export const ENEMY_CONFIGS: Record<EnemyType, EnemyConfig> = {
  ram: {
    type: 'ram',
    forwardSpeed: 200,
    width: 42,
    height: 70,
    hp: 1,
    scoreValue: 100,
    coinDrop: 1,
    bulletproof: false,
    color: '#E53935',
    accentColor: '#1a1a2e',
  },
  shooter: {
    type: 'shooter',
    forwardSpeed: 290,
    width: 44,
    height: 74,
    hp: 2,
    scoreValue: 250,
    coinDrop: 2,
    bulletproof: false,
    color: '#FB8C00',
    accentColor: '#1a1a2e',
  },
  armored: {
    type: 'armored',
    forwardSpeed: 160,
    width: 58,
    height: 100,
    hp: Infinity,
    scoreValue: 500,
    coinDrop: 4,
    bulletproof: true,
    color: '#2a2a2a',
    accentColor: '#888888',
  },
};

export class EnemyCar {
  x: number;
  y: number;
  vy = 0;
  alive = true;
  hp: number;
  config: EnemyConfig;
  visual: EnemyVisual;
  // Shooter-specific
  fireCooldown = 1.2;
  // Wake animation accumulator (jetboat only)
  private wakeT = Math.random() * 1.7;

  constructor(type: EnemyType, x: number, y: number, visual: EnemyVisual = 'car') {
    this.config = ENEMY_CONFIGS[type];
    this.x = x;
    this.y = y;
    this.hp = this.config.hp;
    this.visual = visual;
  }

  update(dt: number, playerSpeed: number, playerX: number, playerY: number): void {
    this.vy = playerSpeed - this.config.forwardSpeed;
    this.y += this.vy * dt;
    this.wakeT += dt * 1.4;

    if (this.y > 720) this.alive = false;

    if (this.config.type === 'ram') {
      this.updateRamAI(dt, playerX, playerY);
    } else if (this.config.type === 'armored') {
      this.updateArmoredAI(dt, playerX);
    }
    // Shooter AI handled by EnemySpawner (needs projectile spawning)

    const halfW = this.config.width / 2;
    if (this.x - halfW < ROAD.X_MIN) this.x = ROAD.X_MIN + halfW;
    else if (this.x + halfW > ROAD.X_MAX) this.x = ROAD.X_MAX - halfW;
  }

  private updateRamAI(dt: number, playerX: number, playerY: number): void {
    const distY = playerY - this.y;
    if (distY > 0 && distY < 260) {
      const dx = playerX - this.x;
      const maxLateral = 230 * dt;
      this.x += Math.max(-maxLateral, Math.min(maxLateral, dx));
    }
  }

  private updateArmoredAI(dt: number, playerX: number): void {
    // Armored drifts slowly toward player to block them
    const dx = playerX - this.x;
    const maxLateral = 70 * dt;
    this.x += Math.max(-maxLateral, Math.min(maxLateral, dx));
  }

  takeHit(damage: number): boolean {
    if (this.config.bulletproof) return false;
    this.hp -= damage;
    if (this.hp <= 0) {
      this.alive = false;
      return true;
    }
    return false;
  }

  pushOffRoad(): void {
    // Used by ram-into-armored to score the bypass
    this.alive = false;
  }

  getBounds(): { x: number; y: number; w: number; h: number } {
    return {
      x: this.x - this.config.width / 2,
      y: this.y - this.config.height / 2,
      w: this.config.width,
      h: this.config.height,
    };
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (this.visual === 'jetboat') {
      this.renderJetboat(ctx);
      return;
    }
    this.renderCar(ctx);
  }

  private renderCar(ctx: CanvasRenderingContext2D): void {
    const c = this.config;
    const w = c.width;
    const h = c.height;
    const x = this.x - w / 2;
    const y = this.y - h / 2;
    ctx.save();

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    this.roundRect(ctx, x + 4, y + 5, w, h, 6);
    ctx.fill();

    // Body
    ctx.fillStyle = c.color;
    this.roundRect(ctx, x, y, w, h, 6);
    ctx.fill();

    // Cockpit
    ctx.fillStyle = '#0a0a14';
    this.roundRect(ctx, x + 6, y + 14, w - 12, h - 32, 3);
    ctx.fill();

    // Headlights (front = top, since they drive same direction as us)
    ctx.fillStyle = '#FFFF99';
    ctx.fillRect(x + 4, y + 2, 6, 4);
    ctx.fillRect(x + w - 10, y + 2, 6, 4);

    // Tail lights (back = bottom)
    ctx.fillStyle = '#FF3030';
    ctx.fillRect(x + 6, y + h - 4, 6, 2);
    ctx.fillRect(x + w - 12, y + h - 4, 6, 2);

    // Type-specific accents
    if (c.type === 'ram') {
      // Side spikes
      ctx.fillStyle = c.accentColor;
      ctx.beginPath();
      ctx.moveTo(x, y + h / 2 - 8);
      ctx.lineTo(x - 7, y + h / 2);
      ctx.lineTo(x, y + h / 2 + 8);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x + w, y + h / 2 - 8);
      ctx.lineTo(x + w + 7, y + h / 2);
      ctx.lineTo(x + w, y + h / 2 + 8);
      ctx.fill();
    } else if (c.type === 'armored') {
      // Chrome trim along sides
      ctx.fillStyle = c.accentColor;
      ctx.fillRect(x + 2, y + 6, 3, h - 12);
      ctx.fillRect(x + w - 5, y + 6, 3, h - 12);
      // HP/armor pips
      ctx.fillStyle = '#444';
      ctx.fillRect(x + w / 2 - 10, y + 4, 20, 4);
    } else if (c.type === 'shooter') {
      // Roof-mounted gun
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(x + w / 2 - 3, y + h - 14, 6, 14);
      ctx.fillStyle = '#444';
      ctx.fillRect(x + w / 2 - 2, y + h, 4, 8);
    }

    ctx.restore();
  }

  private renderJetboat(ctx: CanvasRenderingContext2D): void {
    const c = this.config;
    const w = c.width;
    const h = c.height;
    const x = this.x - w / 2;
    const y = this.y - h / 2;

    ctx.save();

    // Trailing wake — short foam burst behind the stern
    ctx.fillStyle = '#FFFFFFCC';
    for (let i = 0; i < 3; i++) {
      const t = (this.wakeT + i * 0.25) % 1;
      const yy = y + h + 4 + t * 28;
      const spread = 3 + t * 10;
      ctx.globalAlpha = 0.55 * (1 - t);
      ctx.fillRect(this.x - spread - 1, yy, 2, 2);
      ctx.fillRect(this.x + spread - 1, yy, 2, 2);
    }
    ctx.globalAlpha = 1;

    // Hull shadow
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    this.jetboatHullPath(ctx, x + 3, y + 5, w, h);
    ctx.fill();

    // Hull body
    ctx.fillStyle = c.color;
    this.jetboatHullPath(ctx, x, y, w, h);
    ctx.fill();

    // Cockpit (smaller and inset, like a speedboat windshield)
    ctx.fillStyle = '#0a0a14';
    ctx.beginPath();
    ctx.ellipse(this.x, y + h * 0.5, w * 0.32, h * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,255,255,0.30)';
    ctx.beginPath();
    ctx.ellipse(this.x, y + h * 0.45, w * 0.26, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Type-specific accents (echo car versions so silhouette telegraphs threat)
    if (c.type === 'ram') {
      // Bow-mounted ram prongs
      ctx.fillStyle = c.accentColor;
      ctx.beginPath();
      ctx.moveTo(x + 4, y + 12);
      ctx.lineTo(x - 4, y + 24);
      ctx.lineTo(x + 8, y + 24);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x + w - 4, y + 12);
      ctx.lineTo(x + w + 4, y + 24);
      ctx.lineTo(x + w - 8, y + 24);
      ctx.fill();
    } else if (c.type === 'armored') {
      // Heavier armored hull plating along sides
      ctx.fillStyle = c.accentColor;
      ctx.fillRect(x + 2, y + 18, 3, h - 28);
      ctx.fillRect(x + w - 5, y + 18, 3, h - 28);
      // Turret mound
      ctx.fillStyle = '#444';
      ctx.beginPath();
      ctx.arc(this.x, y + h * 0.62, 6, 0, Math.PI * 2);
      ctx.fill();
    } else if (c.type === 'shooter') {
      // Stern-mounted gun
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(this.x - 3, y + h - 16, 6, 14);
      ctx.fillStyle = '#444';
      ctx.fillRect(this.x - 2, y + h, 4, 8);
    }

    // Stern outboard motor
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(x + 6, y + h - 5, w - 12, 5);

    ctx.restore();
  }

  private jetboatHullPath(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
  ): void {
    // Pointed bow at top, squared stern at bottom
    const bowDepth = 16;
    ctx.beginPath();
    ctx.moveTo(x + w / 2, y);
    ctx.lineTo(x + w, y + bowDepth);
    ctx.lineTo(x + w, y + h - 3);
    ctx.arcTo(x + w, y + h, x + w - 3, y + h, 3);
    ctx.lineTo(x + 3, y + h);
    ctx.arcTo(x, y + h, x, y + h - 3, 3);
    ctx.lineTo(x, y + bowDepth);
    ctx.closePath();
  }

  private roundRect(
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
}
