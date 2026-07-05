// ===== src/games/dungeon-crawl/DungeonCrawlGame.ts =====
// The Ember Depths — Tier 3 action dungeon crawler. Orchestrates the seeded
// floor generator, real-time combat, relic draft, boss kits, biome hazards,
// the merchant shop, and the arcade service contract (scoring, achievements
// metrics, recap→endGame). Screen-space chrome lives in rendering/HudRenderer.

import { BaseGame } from '@/games/shared/BaseGame';
import { GameManifest } from '@/lib/types';
import {
  BiomePalette,
  biomeForFloor,
  COMBAT,
  EXPLOSIONS,
  FLOOR_NAMES,
  HAZARDS,
  OVERLAY,
  PALETTE,
  PICKUPS,
  PLAYER,
  PotionBuff,
  SHOCKWAVE,
  SHOP,
  TILE,
  VIEW,
} from './data/constants';
import { BOSS } from './data/enemies';
import { ALL_RELIC_IDS, RELIC_TUNING, RELICS, RelicId } from './data/relics';
import {
  FloorPlan,
  generateFloor,
  Room,
  ShopItemPlan,
} from './dungeon/DungeonGenerator';
import { Rng } from './dungeon/rng';
import { Tile, TileMap } from './dungeon/TileMap';
import { Boss } from './entities/Boss';
import { Enemy, EnemyUpdateContext } from './entities/Enemy';
import { Hazard } from './entities/Hazard';
import { Pickup } from './entities/Pickup';
import { Projectile } from './entities/Projectile';
import { Player } from './entities/Player';
import { Urn } from './entities/Urn';
import { Lighting, LightSource } from './systems/Lighting';
import { Minimap } from './systems/Minimap';
import { ParticleSystem } from './systems/ParticleSystem';
import { ScreenShake } from './systems/ScreenShake';
import { HudRenderer } from './rendering/HudRenderer';
import { TileRenderer } from './rendering/TileRenderer';

type GameState = 'playing' | 'relic' | 'recap';

type DeathCause =
  | 'slime'
  | 'skeleton'
  | 'bat'
  | 'sorcerer_bolt'
  | 'knight'
  | 'mimic'
  | 'bomber'
  | 'wraith'
  | 'hazard'
  | 'explosion'
  | 'shockwave'
  | 'boss_touch'
  | 'boss_charge'
  | 'boss_bolt';

const CAUSE_LABELS: Record<DeathCause, string> = {
  slime: 'DISSOLVED BY A SLIME',
  skeleton: 'CUT DOWN BY A SKELETON',
  bat: 'SWARMED BY BATS',
  sorcerer_bolt: 'STRUCK BY SORCERY',
  knight: 'CRUSHED BY A KNIGHT',
  mimic: 'EATEN BY A MIMIC',
  bomber: 'MUGGED BY A BOMBER',
  wraith: 'CHILLED BY A WRAITH',
  hazard: 'CAUGHT BY A TRAP',
  explosion: 'CAUGHT IN THE BLAST',
  shockwave: 'FLATTENED BY THE SLAM',
  boss_touch: 'BURNED BY THE GUARDIAN',
  boss_charge: 'TRAMPLED BY THE GUARDIAN',
  boss_bolt: 'SCORCHED BY GUARDIAN FIRE',
};

const CAUSE_HINTS: Record<DeathCause, string> = {
  slime: 'Slimes split when they die — finish the minis fast.',
  skeleton: 'Skeletons chase in straight lines. Kite them around corners.',
  bat: 'Bats weave — wait for the lunge, then swing.',
  sorcerer_bolt: 'Sorcerer bolts telegraph. Sidestep on the flash.',
  knight: 'Knights block frontal swings. Flank them — or daggers pierce.',
  mimic: 'Not every chest is a friend. Watch for the ones that breathe.',
  bomber: 'Bombers lob where you WILL be. Change direction on the throw.',
  wraith: 'Wraiths walk through walls. Open ground is your friend.',
  hazard: 'Traps telegraph before they strike. Watch the floor.',
  explosion: 'The blast ring shows the radius. Dash out — Shift is faster than feet.',
  shockwave: 'Shockwave rings have gaps in time, not space. Dash through the ring.',
  boss_touch: 'Keep moving — the Guardian punishes standing still.',
  boss_charge: 'The charge telegraphs with a glowing ring. Break line with a pillar.',
  boss_bolt: 'The bolt ring has gaps. Walk, don’t panic-run.',
};

interface RecapStats {
  cause: DeathCause;
  depth: number;
  kills: number;
  gold: number;
  bosses: number;
  relics: number;
  maxCombo: number;
  timeMs: number;
}

// v2 — staged explosion (bomber payloads + volatile elite deaths).
interface StagedExplosion {
  x: number;
  y: number;
  fuse: number;
  radius: number;
}

// v2 — bomb arcing toward its landing spot (pure visual until it lands).
interface BombInFlight {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  t: number; // 0..1 flight progress
}

// v2 — Bone Colossus shockwave ring.
interface Shockwave {
  x: number;
  y: number;
  radius: number;
  delay: number;
  hitPlayer: boolean;
}

// v2 — live shop item (plan + sold state).
interface LiveShopItem extends ShopItemPlan {
  sold: boolean;
}

export class DungeonCrawlGame extends BaseGame {
  manifest: GameManifest = {
    id: 'dungeon-crawl',
    title: 'Dungeon Crawl',
    thumbnail: '/games/dungeon-crawl/dungeon-crawl-thumb.svg',
    inputSchema: ['keyboard'],
    assetBudgetKB: 160,
    tier: 3,
    description:
      'Descend the Ember Depths! Torchlit procedural dungeons, sword-and-dagger combat, relic drafts, and the Ember Guardian waiting below.',
  };

  // World.
  private runSeed = 1;
  private rng!: Rng; // gameplay-time randomness (drops, AI wander)
  private plan!: FloorPlan;
  private map!: TileMap;
  private biome!: BiomePalette;
  private player = new Player();
  private enemies: Enemy[] = [];
  private boss: Boss | null = null;
  private projectiles: Projectile[] = [];
  private pickupItems: Pickup[] = [];
  private hazards: Hazard[] = [];
  private urns: Urn[] = [];
  private shopItems: LiveShopItem[] = [];
  private merchant: { x: number; y: number } | null = null;
  private explosions: StagedExplosion[] = [];
  private bombs: BombInFlight[] = [];
  private shockwaves: Shockwave[] = [];
  private stairsLocked = false;

  // Systems.
  private particles = new ParticleSystem();
  private shake = new ScreenShake();
  private lighting = new Lighting();
  private minimap = new Minimap();
  private tiles = new TileRenderer();
  private hud = new HudRenderer();
  private camX = 0;
  private camY = 0;

  // Run stats (extendedGameData / achievements).
  private floor = 1;
  private enemiesSlain = 0;
  private goldCollected = 0;
  private bossesSlain = 0;
  private relicsCollected = 0;
  private roomsExplored = 0;
  private daggersThrown = 0;
  private mimicsFound = 0;
  private perfectFloors = 0;
  private keysUsed = 0;
  private potionsUsed = 0;
  private maxCombo = 1;
  // v2 stats
  private elitesSlain = 0;
  private itemsBought = 0;
  private goldSpent = 0;
  private dashesUsed = 0;
  private uniqueBossKits = new Set<string>();
  private goldBalance = 0; // spendable; `pickups` stays cumulative for the arcade

  // Combo chain.
  private combo = 1;
  private killChain = 0;
  private comboTimer = 0;

  // Per-floor state.
  private visitedRooms = new Set<Room>();
  private damageTakenThisFloor = false;

  // State machine + overlays.
  private state: GameState = 'playing';
  private bannerText = '';
  private bannerSub = '';
  private bannerTimer = 0;
  private relicChoices: RelicId[] = [];
  private relicIndex = 0;
  private recapStats: RecapStats | null = null;
  private recapTimer = 0;
  private shopDeniedFlash = 0;
  private activeShopItem: LiveShopItem | null = null;

  // Input edges.
  private attackWas = false;
  private daggerWas = false;
  private dashWas = false;
  private interactWas = false;
  private confirmWas = false;
  private navLeftWas = false;
  private navRightWas = false;

  // Audio bookkeeping.
  private musicIntensity = -1;

  // ------------------------------------------------------------ lifecycle

  protected onInit(): void {
    this.renderBaseHud = false;
    this.startRun();
  }

  protected onRestart(): void {
    this.startRun();
  }

  protected onDestroy(): void {
    this.services?.audio?.setMusicIntensity?.(0.5);
  }

  private startRun(): void {
    this.runSeed = (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0;
    this.rng = new Rng(this.runSeed ^ 0x51ed270b);
    this.floor = 1;
    this.enemiesSlain = 0;
    this.goldCollected = 0;
    this.bossesSlain = 0;
    this.relicsCollected = 0;
    this.roomsExplored = 0;
    this.daggersThrown = 0;
    this.mimicsFound = 0;
    this.perfectFloors = 0;
    this.keysUsed = 0;
    this.potionsUsed = 0;
    this.maxCombo = 1;
    this.elitesSlain = 0;
    this.itemsBought = 0;
    this.goldSpent = 0;
    this.dashesUsed = 0;
    this.uniqueBossKits.clear();
    this.goldBalance = 0;
    this.combo = 1;
    this.killChain = 0;
    this.comboTimer = 0;
    this.state = 'playing';
    this.recapStats = null;
    this.player.reset(0, 0);
    this.shake.reset();
    this.particles.clear();
    this.musicIntensity = -1;
    this.loadFloor();
    this.syncExtendedData();
  }

  private loadFloor(): void {
    this.plan = generateFloor(this.runSeed, this.floor);
    this.map = this.plan.map;
    this.biome = biomeForFloor(this.floor);
    this.enemies = this.plan.enemies.map(s => new Enemy(s.type, s.x, s.y, s.elite));
    this.pickupItems = this.plan.pickups.map(p => new Pickup(p.kind, p.x, p.y));
    this.hazards = this.plan.hazards.map(
      (h, i) => new Hazard(h.tx, h.ty, h.style, (i * 0.37) % 1),
    );
    this.urns = this.plan.urns.map(u => new Urn(u.x, u.y, u.variant));
    this.shopItems = this.plan.shop ? this.plan.shop.items.map(i => ({ ...i, sold: false })) : [];
    this.merchant = this.plan.shop?.merchant ?? null;
    this.projectiles = [];
    this.explosions = [];
    this.bombs = [];
    this.shockwaves = [];
    this.activeShopItem = null;
    this.boss = this.plan.isBossFloor && this.plan.bossSpawn
      ? new Boss(
          this.plan.bossSpawn.x,
          this.plan.bossSpawn.y,
          Math.max(1, Math.floor(this.floor / 3)),
        )
      : null;
    this.stairsLocked = this.plan.isBossFloor;
    this.player.placeAt(this.plan.playerStart.x, this.plan.playerStart.y);
    this.minimap.resetFor(this.map);
    this.visitedRooms.clear();
    this.damageTakenThisFloor = false;
    this.particles.clear();

    if (this.boss) {
      this.showBanner(`FLOOR ${this.floor}`, `${this.boss.kit.name} AWAITS`);
    } else {
      this.showBanner(`FLOOR ${this.floor}`, FLOOR_NAMES[(this.floor - 1) % FLOOR_NAMES.length]);
    }
  }

  private showBanner(text: string, sub: string): void {
    this.bannerText = text;
    this.bannerSub = sub;
    this.bannerTimer = OVERLAY.BANNER_FADE_IN + OVERLAY.BANNER_HOLD + OVERLAY.BANNER_FADE_OUT;
  }

  // ------------------------------------------------------------ update

  protected onUpdate(dt: number): void {
    this.shake.update(dt);
    this.particles.update(dt);
    this.lighting.update(dt);
    if (this.bannerTimer > 0) this.bannerTimer = Math.max(0, this.bannerTimer - dt);
    if (this.shopDeniedFlash > 0) this.shopDeniedFlash = Math.max(0, this.shopDeniedFlash - dt);

    switch (this.state) {
      case 'playing':
        this.updatePlaying(dt);
        break;
      case 'relic':
        this.updateRelicChoice();
        break;
      case 'recap':
        this.updateRecap(dt);
        break;
    }

    this.updateInputEdges();
    this.syncExtendedData();
  }

  private updateInputEdges(): void {
    const input = this.services?.input;
    if (!input) return;
    this.attackWas = input.isKeyPressed('Space') || input.isKeyPressed('KeyJ');
    this.daggerWas = input.isKeyPressed('KeyX') || input.isKeyPressed('KeyK');
    this.dashWas =
      input.isKeyPressed('ShiftLeft') || input.isKeyPressed('ShiftRight') || input.isKeyPressed('KeyC');
    this.interactWas = input.isKeyPressed('KeyE');
    this.confirmWas =
      input.isKeyPressed('Space') || input.isKeyPressed('Enter') || input.isKeyPressed('KeyJ');
    this.navLeftWas = input.isLeftPressed();
    this.navRightWas = input.isRightPressed();
  }

  private updatePlaying(dt: number): void {
    const input = this.services?.input;

    // --- Player movement + combat inputs.
    let moveX = 0;
    let moveY = 0;
    if (input) {
      if (input.isLeftPressed()) moveX -= 1;
      if (input.isRightPressed()) moveX += 1;
      if (input.isUpPressed()) moveY -= 1;
      if (input.isDownPressed()) moveY += 1;
    }
    this.player.update(dt, moveX, moveY, this.map);

    const attackDown = input
      ? input.isKeyPressed('Space') || input.isKeyPressed('KeyJ')
      : false;
    if (attackDown && !this.attackWas && this.player.trySwing()) {
      this.services?.audio?.playSound?.('sword_swing', { volume: 0.4 });
    }

    const daggerDown = input ? input.isKeyPressed('KeyX') || input.isKeyPressed('KeyK') : false;
    if (daggerDown && !this.daggerWas) {
      const thrown = this.player.tryThrowDagger();
      if (thrown) {
        this.daggersThrown++;
        this.projectiles.push(
          new Projectile(
            'dagger',
            this.player.x,
            this.player.y,
            thrown.dirX * PLAYER.DAGGER_SPEED,
            thrown.dirY * PLAYER.DAGGER_SPEED,
            this.player.daggerDamage(),
            this.player.daggersPierce(),
          ),
        );
        this.services?.audio?.playSound?.('whoosh', { volume: 0.35 });
      }
    }

    // v2 — dodge dash.
    const dashDown = input
      ? input.isKeyPressed('ShiftLeft') || input.isKeyPressed('ShiftRight') || input.isKeyPressed('KeyC')
      : false;
    if (dashDown && !this.dashWas && this.player.tryDash(moveX, moveY)) {
      this.dashesUsed++;
      this.services?.audio?.playSound?.('whoosh', { volume: 0.45 });
      this.particles.spray(this.player.x, this.player.y, -this.player.faceX, -this.player.faceY, '#9a7bff', 8);
      this.trackStat('dashes_used', this.dashesUsed);
    }

    // --- Sword swing resolution (enemies, boss, urns).
    if (this.player.swing) {
      for (const enemy of this.enemies) {
        if (!enemy.alive || this.player.swing.hitIds.has(enemy.id)) continue;
        if (!this.player.swingHits(enemy.x, enemy.y, enemy.radius)) continue;
        this.player.swing.hitIds.add(enemy.id);
        this.hitEnemy(enemy, this.player.swordDamage(), 'sword');
      }
      if (this.boss?.alive && !this.player.swing.hitIds.has(-1)) {
        if (this.player.swingHits(this.boss.x, this.boss.y, this.boss.radius)) {
          this.player.swing.hitIds.add(-1);
          this.hitBoss(this.player.swordDamage());
        }
      }
      for (const urn of this.urns) {
        if (urn.alive && this.player.swingHits(urn.x, urn.y, urn.radius)) this.breakUrn(urn);
      }
    }

    // --- Enemies.
    const enemyCtx: EnemyUpdateContext = {
      playerX: this.player.x,
      playerY: this.player.y,
      map: this.map,
      rng: this.rng,
      fireBolt: (x, y, dirX, dirY, speed) => {
        this.projectiles.push(new Projectile('bolt', x, y, dirX * speed, dirY * speed, 1));
      },
      throwBomb: (x, y, targetX, targetY) => {
        this.bombs.push({ fromX: x, fromY: y, toX: targetX, toY: targetY, t: 0 });
        this.services?.audio?.playSound?.('whoosh', { volume: 0.25 });
      },
      onMimicWake: enemy => this.onMimicWake(enemy),
    };
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      enemy.update(dt, enemyCtx);
      // Touch damage.
      const reach = enemy.radius + this.player.size / 2;
      if (!enemy.dormant && Math.hypot(enemy.x - this.player.x, enemy.y - this.player.y) < reach) {
        this.damagePlayer(enemy.config.touchDamage, this.causeForEnemy(enemy));
      }
    }
    this.enemies = this.enemies.filter(e => e.alive);

    // --- Boss.
    if (this.boss?.alive) {
      this.updateBoss(dt);
    }

    // --- Projectiles.
    for (const proj of this.projectiles) {
      proj.update(dt, this.map, this.player.x, this.player.y);
      if (!proj.alive) continue;
      if (proj.kind === 'bolt') {
        const reach = proj.radius + this.player.size / 2;
        if (Math.hypot(proj.x - this.player.x, proj.y - this.player.y) < reach) {
          proj.alive = false;
          this.damagePlayer(proj.damage, this.boss?.alive ? 'boss_bolt' : 'sorcerer_bolt');
        }
      } else {
        // Player dagger vs monsters, urns and boss. Daggers ignore knight armor.
        for (const enemy of this.enemies) {
          if (!enemy.alive || proj.hitIds.has(enemy.id)) continue;
          if (Math.hypot(proj.x - enemy.x, proj.y - enemy.y) < proj.radius + enemy.radius) {
            proj.hitIds.add(enemy.id);
            this.hitEnemy(enemy, proj.damage, 'dagger');
            if (!proj.pierce) {
              proj.alive = false;
              break;
            }
          }
        }
        if (proj.alive) {
          for (const urn of this.urns) {
            if (!urn.alive) continue;
            if (Math.hypot(proj.x - urn.x, proj.y - urn.y) < proj.radius + urn.radius) {
              this.breakUrn(urn);
              if (!proj.pierce) {
                proj.alive = false;
                break;
              }
            }
          }
        }
        if (proj.alive && this.boss?.alive && !proj.hitIds.has(-1)) {
          if (Math.hypot(proj.x - this.boss.x, proj.y - this.boss.y) < proj.radius + this.boss.radius) {
            proj.hitIds.add(-1);
            this.hitBoss(proj.damage);
            if (!proj.pierce) proj.alive = false;
          }
        }
      }
    }
    this.projectiles = this.projectiles.filter(p => p.alive);

    // --- v2: bombs in flight -> staged explosions -> booms; shockwaves; hazards.
    this.updateBombsAndExplosions(dt);
    this.updateShockwaves(dt);
    this.updateHazards(dt);

    // --- Pickups.
    for (const pickup of this.pickupItems) {
      pickup.update(dt, this.player.x, this.player.y, this.player.hasCoinMagnet());
      const reach = pickup.collectRadius + this.player.size / 2;
      if (Math.hypot(pickup.x - this.player.x, pickup.y - this.player.y) < reach) {
        this.collectPickup(pickup);
      }
    }
    this.pickupItems = this.pickupItems.filter(p => p.alive);

    // --- v2: shop interaction.
    this.updateShop(input ? input.isKeyPressed('KeyE') : false);

    // --- Combo decay.
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.killChain = 0;
        this.combo = 1;
      }
    }

    // --- World interactions: locked doors, room discovery, stairs.
    this.tryOpenDoors();
    this.trackRoomDiscovery();
    this.checkStairs();

    // --- Camera, fog reveal, ambience.
    this.updateCamera();
    this.minimap.reveal(
      this.map,
      this.player.x,
      this.player.y,
      Lighting.playerTorchRadius(this.player.torchBonus()),
    );
    this.emitTorchEmbers();
    this.updateMusicIntensity();
  }

  private updateBoss(dt: number): void {
    if (!this.boss) return;
    this.boss.update(dt, {
      playerX: this.player.x,
      playerY: this.player.y,
      map: this.map,
      rng: this.rng,
      fireBolt: (x, y, dirX, dirY, speed) => {
        this.projectiles.push(new Projectile('bolt', x, y, dirX * speed, dirY * speed, 1));
      },
      fireHomingBolt: (x, y, dirX, dirY, speed) => {
        this.projectiles.push(new Projectile('bolt', x, y, dirX * speed, dirY * speed, 1, false, 2.2));
      },
      spawnShockwave: (x, y, delay) => {
        this.shockwaves.push({ x, y, radius: 0, delay, hitPlayer: false });
        if (delay === 0) {
          this.shake.add(0.45);
          this.services?.audio?.playSound?.('explosion', { volume: 0.45 });
        }
      },
      requestTeleportSpot: () => this.pickTeleportSpot(),
      summonMinion: (x, y, type) => {
        const spawn = this.findOpenSpotNear(x, y);
        const minion = new Enemy(type, spawn.x, spawn.y);
        minion.aggro = true;
        this.enemies.push(minion);
        this.particles.burst(spawn.x, spawn.y, PALETTE.ember, 8, 90, 0.4);
      },
      minionCount: () => this.enemies.filter(e => e.alive).length,
      onChargeSlam: (x, y) => {
        this.shake.add(0.5);
        this.particles.burst(x, y, PALETTE.emberBright, 16, 180, 0.6, 200);
        this.services?.audio?.playSound?.('explosion', { volume: 0.4 });
      },
      onTeleport: (fromX, fromY, toX, toY) => {
        this.particles.burst(fromX, fromY, this.boss!.kit.crackColor, 14, 120, 0.5);
        this.particles.burst(toX, toY, this.boss!.kit.crackColor, 14, 120, 0.5);
        this.services?.audio?.playSound?.('whoosh', { volume: 0.5 });
      },
    });
    const touchReach = this.boss.radius + this.player.size / 2;
    if (Math.hypot(this.boss.x - this.player.x, this.boss.y - this.player.y) < touchReach) {
      this.damagePlayer(
        this.boss.isCharging ? BOSS.CHARGE_DAMAGE : BOSS.TOUCH_DAMAGE,
        this.boss.isCharging ? 'boss_charge' : 'boss_touch',
      );
    }
  }

  /** Random open tile 3-6 tiles away from the player (Hollow King teleport). */
  private pickTeleportSpot(): { x: number; y: number } {
    for (let attempt = 0; attempt < 14; attempt++) {
      const angle = this.rng.range(0, Math.PI * 2);
      const dist = this.rng.range(TILE * 3, TILE * 6);
      const x = this.player.x + Math.cos(angle) * dist;
      const y = this.player.y + Math.sin(angle) * dist;
      const { tx, ty } = this.map.tileAtWorld(x, y);
      if (!this.map.isSolidAt(tx, ty)) return this.map.tileCenter(tx, ty);
    }
    return { x: this.boss?.x ?? this.player.x, y: this.boss?.y ?? this.player.y };
  }

  private updateBombsAndExplosions(dt: number): void {
    // Bombs arc toward their landing spot, then become a fused explosion.
    for (let i = this.bombs.length - 1; i >= 0; i--) {
      const bomb = this.bombs[i];
      bomb.t += dt / EXPLOSIONS.BOMB_FLIGHT;
      if (bomb.t >= 1) {
        this.bombs.splice(i, 1);
        this.explosions.push({
          x: bomb.toX,
          y: bomb.toY,
          fuse: EXPLOSIONS.BOMB_FUSE,
          radius: EXPLOSIONS.BOMB_RADIUS,
        });
      }
    }

    for (let i = this.explosions.length - 1; i >= 0; i--) {
      const explosion = this.explosions[i];
      explosion.fuse -= dt;
      if (explosion.fuse > 0) continue;
      this.explosions.splice(i, 1);
      // Boom: player + urns inside the radius.
      const reach = explosion.radius + this.player.size / 2;
      if (Math.hypot(explosion.x - this.player.x, explosion.y - this.player.y) < reach) {
        this.damagePlayer(EXPLOSIONS.DAMAGE, 'explosion');
      }
      for (const urn of this.urns) {
        if (urn.alive && Math.hypot(explosion.x - urn.x, explosion.y - urn.y) < explosion.radius + urn.radius) {
          this.breakUrn(urn);
        }
      }
      this.shake.add(0.35);
      this.particles.burst(explosion.x, explosion.y, PALETTE.ember, 22, 190, 0.6, 140);
      this.particles.burst(explosion.x, explosion.y, PALETTE.emberBright, 10, 120, 0.4);
      this.services?.audio?.playSound?.('explosion', { volume: 0.4 });
    }
  }

  private updateShockwaves(dt: number): void {
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const wave = this.shockwaves[i];
      if (wave.delay > 0) {
        wave.delay -= dt;
        if (wave.delay <= 0) {
          this.shake.add(0.3);
          this.services?.audio?.playSound?.('explosion', { volume: 0.3 });
        }
        continue;
      }
      wave.radius += SHOCKWAVE.SPEED * dt;
      if (!wave.hitPlayer) {
        const dist = Math.hypot(wave.x - this.player.x, wave.y - this.player.y);
        if (Math.abs(dist - wave.radius) < SHOCKWAVE.THICKNESS + this.player.size / 2) {
          wave.hitPlayer = true;
          this.damagePlayer(SHOCKWAVE.DAMAGE, 'shockwave');
        }
      }
      if (wave.radius > SHOCKWAVE.MAX_RADIUS) this.shockwaves.splice(i, 1);
    }
  }

  private updateHazards(dt: number): void {
    for (const hazard of this.hazards) {
      hazard.update(dt);
      if (!hazard.dangerous) continue;
      const reach = HAZARDS.RADIUS + this.player.size / 2;
      if (Math.hypot(hazard.x - this.player.x, hazard.y - this.player.y) < reach) {
        this.damagePlayer(HAZARDS.DAMAGE, 'hazard');
      }
    }
  }

  private updateShop(interactDown: boolean): void {
    this.activeShopItem = null;
    if (this.shopItems.length === 0) return;
    let best: LiveShopItem | null = null;
    let bestDist = SHOP.INTERACT_RADIUS + this.player.size / 2;
    for (const item of this.shopItems) {
      if (item.sold) continue;
      const dist = Math.hypot(item.x - this.player.x, item.y - this.player.y);
      if (dist < bestDist) {
        bestDist = dist;
        best = item;
      }
    }
    this.activeShopItem = best;
    if (!best || !interactDown || this.interactWas) return;

    if (this.goldBalance < best.price) {
      this.shopDeniedFlash = 0.8;
      this.services?.audio?.playSound?.('error', { volume: 0.4 });
      return;
    }

    // Purchase.
    this.goldBalance -= best.price;
    this.goldSpent += best.price;
    this.itemsBought++;
    best.sold = true;
    switch (best.product) {
      case 'heart':
        this.player.heal(PICKUPS.HEART_HEAL);
        break;
      case 'daggers':
        this.player.daggers = Math.min(this.player.daggerCap(), this.player.daggers + PICKUPS.DAGGER_BUNDLE + 2);
        break;
      case 'potion': {
        const buffs: PotionBuff[] = ['haste', 'strength', 'stoneskin'];
        this.player.addBuff(this.rng.pick(buffs));
        this.potionsUsed++;
        break;
      }
      case 'relic':
        this.grantRelic(this.rng.pick(ALL_RELIC_IDS));
        break;
    }
    this.services?.audio?.playSound?.('success', { volume: 0.5 });
    this.particles.burst(best.x, best.y, PALETTE.gold, 12, 100, 0.6);
    this.trackStat('items_bought', this.itemsBought);
    this.trackStat('gold_spent', this.goldSpent);
  }

  private causeForEnemy(enemy: Enemy): DeathCause {
    switch (enemy.config.id) {
      case 'slime':
      case 'slime-mini':
        return 'slime';
      case 'skeleton':
        return 'skeleton';
      case 'bat':
        return 'bat';
      case 'sorcerer':
        return 'sorcerer_bolt';
      case 'knight':
        return 'knight';
      case 'mimic':
        return 'mimic';
      case 'bomber':
        return 'bomber';
      case 'wraith':
        return 'wraith';
    }
  }

  private findOpenSpotNear(x: number, y: number): { x: number; y: number } {
    const { tx, ty } = this.map.tileAtWorld(x, y);
    for (let radius = 0; radius < 4; radius++) {
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (!this.map.isSolidAt(tx + dx, ty + dy)) {
            return this.map.tileCenter(tx + dx, ty + dy);
          }
        }
      }
    }
    return { x: this.player.x, y: this.player.y };
  }

  // ------------------------------------------------------------ combat

  private onMimicWake(enemy: Enemy): void {
    this.mimicsFound++;
    this.shake.add(0.25);
    this.services?.audio?.playSound?.('sword_draw', { volume: 0.5 });
    this.particles.burst(enemy.x, enemy.y, PALETTE.gold, 10, 100, 0.5);
    this.trackStat('mimics_found', this.mimicsFound);
  }

  private hitEnemy(enemy: Enemy, damage: number, source: 'sword' | 'dagger'): void {
    if (enemy.dormant) {
      enemy.wake({
        playerX: this.player.x,
        playerY: this.player.y,
        map: this.map,
        rng: this.rng,
        fireBolt: () => {},
        throwBomb: () => {},
        onMimicWake: e => this.onMimicWake(e),
      });
    }

    const dx = enemy.x - this.player.x;
    const dy = enemy.y - this.player.y;
    const dist = Math.hypot(dx, dy) || 1;
    const dirX = dx / dist;
    const dirY = dy / dist;

    // Knight armor blocks frontal sword hits — daggers punch through.
    if (source === 'sword' && enemy.blocksFrontalHit(dirX, dirY)) {
      this.services?.audio?.playSound?.('sword_clash', { volume: 0.5 });
      this.particles.spray(enemy.x - dirX * enemy.radius, enemy.y - dirY * enemy.radius, -dirX, -dirY, '#cfd6e0', 5);
      enemy.applyKnockback(dirX, dirY, PLAYER.SWORD_KNOCKBACK * 0.4);
      return;
    }

    enemy.hp -= damage;
    enemy.flash = 0.15;
    enemy.aggro = true;
    enemy.applyKnockback(dirX, dirY, PLAYER.SWORD_KNOCKBACK);
    this.services?.audio?.playSound?.('hit', { volume: 0.35 });
    this.particles.spray(enemy.x, enemy.y, dirX, dirY, enemy.config.color, 6);

    if (enemy.hp <= 0) this.killEnemy(enemy);
  }

  /** Direct wound with no knockback/sound spam — Thorn Mail retaliation. */
  private woundEnemy(enemy: Enemy, damage: number): void {
    if (!enemy.alive || enemy.dormant) return;
    enemy.hp -= damage;
    enemy.flash = 0.15;
    enemy.aggro = true;
    if (enemy.hp <= 0) this.killEnemy(enemy);
  }

  private killEnemy(enemy: Enemy): void {
    enemy.alive = false;
    this.enemiesSlain++;
    this.registerKill(enemy.config.score * (enemy.elite?.scoreMult ?? 1));
    this.particles.burst(enemy.x, enemy.y, enemy.config.color, 14, 130, 0.6);
    this.services?.audio?.playSound?.('explosion', { volume: 0.2 });

    // v2 — elite bookkeeping + volatile death fuse.
    if (enemy.elite) {
      this.elitesSlain++;
      this.trackStat('elites_slain', this.elitesSlain);
      if (enemy.elite.trait === 'volatile') {
        this.explosions.push({
          x: enemy.x,
          y: enemy.y,
          fuse: EXPLOSIONS.VOLATILE_FUSE,
          radius: EXPLOSIONS.VOLATILE_RADIUS,
        });
      }
    }

    // Gold drops (elite gold multiplier + Lucky Charm bonus).
    const [min, max] = enemy.config.goldDrop;
    const lucky = this.player.relicCount('lucky-charm');
    const drops =
      this.rng.int(min, max) * (enemy.elite?.goldMult ?? 1) + lucky * RELIC_TUNING.LUCKY_GOLD_BONUS;
    for (let i = 0; i < drops; i++) {
      const angle = this.rng.range(0, Math.PI * 2);
      const spot = this.findOpenSpotNear(
        enemy.x + Math.cos(angle) * 14,
        enemy.y + Math.sin(angle) * 14,
      );
      this.pickupItems.push(new Pickup('gold', spot.x, spot.y));
    }
    if (lucky > 0 && this.rng.chance(lucky * RELIC_TUNING.LUCKY_HEART_CHANCE)) {
      const spot = this.findOpenSpotNear(enemy.x, enemy.y);
      this.pickupItems.push(new Pickup('heart', spot.x, spot.y));
    }

    // Slimes split.
    if (enemy.config.id === 'slime') {
      for (const offset of [-10, 10]) {
        const spot = this.findOpenSpotNear(enemy.x + offset, enemy.y + offset / 2);
        const mini = new Enemy('slime-mini', spot.x, spot.y);
        mini.aggro = true;
        this.enemies.push(mini);
      }
    }

    this.trackStat('enemies_slain', this.enemiesSlain);
  }

  private breakUrn(urn: Urn): void {
    if (!urn.alive) return;
    urn.alive = false;
    this.services?.audio?.playSound?.('collision', { volume: 0.25 });
    this.particles.burst(urn.x, urn.y, '#8a6244', 10, 110, 0.5, 220);

    // Loot roll — modest, but urns are everywhere.
    const lucky = this.player.relicCount('lucky-charm');
    const roll = this.rng.next();
    if (roll < 0.12 + lucky * RELIC_TUNING.LUCKY_HEART_CHANCE) {
      this.pickupItems.push(new Pickup('heart', urn.x, urn.y));
    } else if (roll < 0.24) {
      this.pickupItems.push(new Pickup('dagger', urn.x, urn.y));
    } else if (roll < 0.8) {
      const count = this.rng.int(1, 2 + lucky);
      for (let i = 0; i < count; i++) {
        const spot = this.findOpenSpotNear(urn.x + this.rng.range(-10, 10), urn.y + this.rng.range(-10, 10));
        this.pickupItems.push(new Pickup('gold', spot.x, spot.y));
      }
    }
  }

  private hitBoss(damage: number): void {
    if (!this.boss?.alive) return;
    this.boss.hp -= damage;
    this.boss.flash = 0.15;
    this.services?.audio?.playSound?.('hit', { volume: 0.4 });
    this.particles.burst(this.boss.x, this.boss.y, this.boss.kit.crackColor, 8, 120, 0.4);
    if (this.boss.hp <= 0) this.killBoss();
  }

  private killBoss(): void {
    if (!this.boss) return;
    this.boss.alive = false;
    this.bossesSlain++;
    this.enemiesSlain++;
    this.uniqueBossKits.add(this.boss.kit.id);
    this.registerKill(BOSS.SCORE);
    this.score += COMBAT.BOSS_BONUS;
    this.shake.add(0.8);
    this.particles.burst(this.boss.x, this.boss.y, PALETTE.emberBright, 40, 220, 1.0, 120);
    this.particles.burst(this.boss.x, this.boss.y, this.boss.kit.crackColor, 24, 160, 0.8);
    this.services?.audio?.playSound?.('death_cry', { volume: 0.7 });
    this.services?.audio?.triggerMusicStinger?.('success');

    // Gold shower + a heart for the road.
    for (let i = 0; i < BOSS.GOLD_SHOWER; i++) {
      const angle = this.rng.range(0, Math.PI * 2);
      const radius = this.rng.range(20, 70);
      const spot = this.findOpenSpotNear(
        this.boss.x + Math.cos(angle) * radius,
        this.boss.y + Math.sin(angle) * radius,
      );
      this.pickupItems.push(new Pickup('gold', spot.x, spot.y));
    }
    const heartSpot = this.findOpenSpotNear(this.boss.x, this.boss.y + 40);
    this.pickupItems.push(new Pickup('heart', heartSpot.x, heartSpot.y));

    // Unlock the way down.
    this.stairsLocked = false;
    this.services?.audio?.playSound?.('gate_open', { volume: 0.6 });
    this.showBanner(`${this.boss.kit.name} FELLED`, 'THE STAIRS ARE OPEN');
    this.trackStat('bosses_slain', this.bossesSlain);
    this.trackStat('unique_bosses', this.uniqueBossKits.size);
  }

  /** Combo/depth-scaled score credit for a kill + vampire fang bookkeeping. */
  private registerKill(baseScore: number): void {
    this.killChain++;
    this.comboTimer = COMBAT.COMBO_WINDOW;
    this.combo = Math.min(
      COMBAT.MAX_COMBO,
      1 + Math.floor(this.killChain / COMBAT.COMBO_KILLS_PER_STEP),
    );
    if (this.combo > this.maxCombo) {
      this.maxCombo = this.combo;
      this.trackStat('combo', this.maxCombo);
    }
    const depthMult = 1 + COMBAT.DEPTH_MULT_PER_FLOOR * (this.floor - 1);
    this.score += Math.round(baseScore * this.combo * depthMult);

    if (this.player.onKill()) {
      this.particles.burst(this.player.x, this.player.y, PALETTE.heart, 8, 80, 0.5);
      this.services?.audio?.playSound?.('powerup', { volume: 0.3 });
    }
  }

  /** Single damage funnel for the player. */
  private damagePlayer(amount: number, cause: DeathCause): void {
    if (this.state !== 'playing') return;
    const applied = this.player.takeDamage(amount);
    if (!applied) return;
    this.damageTakenThisFloor = true;
    this.killChain = 0;
    this.combo = 1;
    this.comboTimer = 0;
    this.shake.add(0.4);
    this.services?.audio?.playSound?.('hurt_grunt', { volume: 0.5 });
    this.particles.burst(this.player.x, this.player.y, PALETTE.blood, 10, 120, 0.5, 200);

    // v2 — Thorn Mail: retaliate against everything close.
    const thorns = this.player.relicCount('thorn-mail');
    if (thorns > 0) {
      for (const enemy of this.enemies) {
        if (!enemy.alive || enemy.dormant) continue;
        if (Math.hypot(enemy.x - this.player.x, enemy.y - this.player.y) < RELIC_TUNING.THORN_MAIL_RADIUS) {
          this.woundEnemy(enemy, thorns * RELIC_TUNING.THORN_MAIL_DAMAGE);
        }
      }
      this.particles.burst(this.player.x, this.player.y, '#7fae3f', 12, 140, 0.4);
    }

    if (this.player.hp <= 2) this.services?.audio?.triggerMusicStinger?.('danger');
    if (this.player.hp <= 0) {
      // v2 — Phoenix Feather cheats death once per stack.
      if (this.player.tryConsumePhoenix()) {
        this.shake.add(0.6);
        this.services?.audio?.playSound?.('extraLife', { volume: 0.7 });
        this.particles.burst(this.player.x, this.player.y, '#ff9a3d', 30, 200, 0.9);
        this.showBanner('THE FEATHER BURNS', 'DEATH REFUSED');
        return;
      }
      this.openRecap(cause);
    }
  }

  // ------------------------------------------------------------ pickups + world

  private collectPickup(pickup: Pickup): void {
    pickup.alive = false;
    switch (pickup.kind) {
      case 'gold': {
        this.goldCollected++;
        this.goldBalance++;
        this.pickups += PICKUPS.GOLD_VALUE;
        this.score += PICKUPS.GOLD_SCORE;
        this.services?.audio?.playSound?.('coin', { volume: 0.25 });
        this.particles.burst(pickup.x, pickup.y, PALETTE.gold, 5, 70, 0.35);
        this.trackStat('gold_collected', this.goldCollected);
        break;
      }
      case 'heart': {
        this.player.heal(PICKUPS.HEART_HEAL);
        this.services?.audio?.playSound?.('extraLife', { volume: 0.4 });
        this.particles.burst(pickup.x, pickup.y, PALETTE.heart, 8, 80, 0.5);
        break;
      }
      case 'dagger': {
        this.player.daggers = Math.min(this.player.daggerCap(), this.player.daggers + PICKUPS.DAGGER_BUNDLE);
        this.services?.audio?.playSound?.('click', { volume: 0.4 });
        break;
      }
      case 'potion': {
        const buffs: PotionBuff[] = ['haste', 'strength', 'stoneskin'];
        this.player.addBuff(this.rng.pick(buffs));
        this.potionsUsed++;
        this.services?.audio?.playSound?.('powerup', { volume: 0.45 });
        this.particles.burst(pickup.x, pickup.y, PALETTE.potion, 10, 90, 0.5);
        break;
      }
      case 'key': {
        this.player.keys++;
        this.services?.audio?.playSound?.('unlock', { volume: 0.5 });
        this.particles.burst(pickup.x, pickup.y, PALETTE.keyGold, 8, 80, 0.5);
        break;
      }
      case 'relic-shrine': {
        const relic = this.rng.pick(ALL_RELIC_IDS);
        this.grantRelic(relic);
        break;
      }
    }
  }

  private grantRelic(id: RelicId): void {
    this.player.addRelic(id);
    this.relicsCollected++;
    this.services?.audio?.playSound?.('unlock', { volume: 0.6 });
    this.particles.burst(this.player.x, this.player.y, RELICS[id].color, 16, 120, 0.8);
    this.showBanner(RELICS[id].name, RELICS[id].blurb);
    this.trackStat('relics_collected', this.relicsCollected);
  }

  /** Locked doors open on contact when the player holds a key. */
  private tryOpenDoors(): void {
    if (this.player.keys <= 0) return;
    const { tx, ty } = this.map.tileAtWorld(this.player.x, this.player.y);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (this.map.get(tx + dx, ty + dy) !== Tile.LockedDoor) continue;
        const center = this.map.tileCenter(tx + dx, ty + dy);
        if (Math.hypot(center.x - this.player.x, center.y - this.player.y) > TILE * 1.2) continue;
        // One key opens every door of the treasure room ring (they're one lock).
        this.openConnectedLockedDoors(tx + dx, ty + dy);
        this.player.keys--;
        this.keysUsed++;
        this.services?.audio?.playSound?.('gate_open', { volume: 0.6 });
        this.shake.add(0.15);
        return;
      }
    }
  }

  private openConnectedLockedDoors(tx: number, ty: number): void {
    // Flood over the contiguous locked-door ring so one key = one room.
    const queue = [{ tx, ty }];
    while (queue.length > 0) {
      const pos = queue.pop()!;
      if (this.map.get(pos.tx, pos.ty) !== Tile.LockedDoor) continue;
      this.map.set(pos.tx, pos.ty, Tile.Door);
      const center = this.map.tileCenter(pos.tx, pos.ty);
      this.particles.burst(center.x, center.y, PALETTE.keyGold, 6, 60, 0.4);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]] as const) {
        queue.push({ tx: pos.tx + dx, ty: pos.ty + dy });
      }
    }
  }

  private trackRoomDiscovery(): void {
    const ptx = this.player.x / TILE;
    const pty = this.player.y / TILE;
    for (const room of this.plan.rooms) {
      if (this.visitedRooms.has(room)) continue;
      if (ptx >= room.tx && ptx < room.tx + room.w && pty >= room.ty && pty < room.ty + room.h) {
        this.visitedRooms.add(room);
        this.roomsExplored++;
        this.score += 10;
        this.trackStat('rooms_explored', this.roomsExplored);
      }
    }
  }

  private checkStairs(): void {
    if (this.stairsLocked) return;
    const { tx, ty } = this.map.tileAtWorld(this.player.x, this.player.y);
    if (tx === this.plan.stairsTile.tx && ty === this.plan.stairsTile.ty) {
      this.openRelicDraft();
    }
  }

  // ------------------------------------------------------------ relic draft + descent

  private openRelicDraft(): void {
    const draftRng = new Rng((this.runSeed ^ (this.floor * 0x85ebca6b)) >>> 0);
    this.relicChoices = draftRng.shuffle(ALL_RELIC_IDS).slice(0, 3);
    this.relicIndex = 0;
    this.state = 'relic';
    this.services?.audio?.playSound?.('success', { volume: 0.5 });
  }

  private updateRelicChoice(): void {
    const input = this.services?.input;
    if (!input) return;

    const left = input.isLeftPressed();
    const right = input.isRightPressed();
    if (left && !this.navLeftWas) {
      this.relicIndex = (this.relicIndex + 2) % 3;
      this.services?.audio?.playSound?.('click', { volume: 0.3 });
    }
    if (right && !this.navRightWas) {
      this.relicIndex = (this.relicIndex + 1) % 3;
      this.services?.audio?.playSound?.('click', { volume: 0.3 });
    }
    for (let i = 0; i < 3; i++) {
      if (input.isKeyPressed(`Digit${i + 1}`)) this.relicIndex = i;
    }

    const confirm =
      input.isKeyPressed('Space') || input.isKeyPressed('Enter') || input.isKeyPressed('KeyJ');
    const directPick = [0, 1, 2].some(i => input.isKeyPressed(`Digit${i + 1}`));
    if ((confirm && !this.confirmWas) || directPick) {
      this.grantRelic(this.relicChoices[this.relicIndex]);
      this.descend();
    }
  }

  private descend(): void {
    // Floor-clear bookkeeping happens for the floor being left.
    if (!this.damageTakenThisFloor) {
      this.perfectFloors++;
      this.trackStat('perfect_floors', this.perfectFloors);
    }
    this.score += COMBAT.FLOOR_CLEAR_BONUS_BASE + COMBAT.FLOOR_CLEAR_BONUS_PER_FLOOR * this.floor;
    this.floor++;
    this.trackStat('depth', this.floor);
    this.services?.audio?.playSound?.('gate_open', { volume: 0.5 });
    this.services?.audio?.triggerMusicStinger?.('transition');
    this.state = 'playing';
    this.loadFloor();
  }

  // ------------------------------------------------------------ death + recap

  private openRecap(cause: DeathCause): void {
    this.state = 'recap';
    this.recapTimer = 0;
    this.recapStats = {
      cause,
      depth: this.floor,
      kills: this.enemiesSlain,
      gold: this.goldCollected,
      bosses: this.bossesSlain,
      relics: this.relicsCollected,
      maxCombo: this.maxCombo,
      timeMs: Date.now() - this.startTime,
    };
    this.shake.add(0.6);
    this.syncExtendedData();
  }

  private updateRecap(dt: number): void {
    this.recapTimer += dt;
    const input = this.services?.input;
    const confirm = input
      ? input.isKeyPressed('Space') || input.isKeyPressed('Enter')
      : false;
    const canDismiss = this.recapTimer > OVERLAY.RECAP_INPUT_LOCKOUT;
    if ((canDismiss && confirm && !this.confirmWas) || this.recapTimer > OVERLAY.RECAP_AUTO_DISMISS) {
      this.endGame();
    }
  }

  // ------------------------------------------------------------ camera / ambience / metrics

  private updateCamera(): void {
    const worldW = this.map.cols * TILE;
    const worldH = this.map.rows * TILE;
    this.camX = Math.max(0, Math.min(worldW - VIEW.WIDTH, this.player.x - VIEW.WIDTH / 2));
    this.camY = Math.max(0, Math.min(worldH - VIEW.HEIGHT, this.player.y - VIEW.HEIGHT / 2));
    if (worldW <= VIEW.WIDTH) this.camX = (worldW - VIEW.WIDTH) / 2;
    if (worldH <= VIEW.HEIGHT) this.camY = (worldH - VIEW.HEIGHT) / 2;
  }

  private emitTorchEmbers(): void {
    for (const torch of this.plan.torches) {
      const x = torch.tx * TILE + TILE / 2;
      const y = torch.ty * TILE + TILE / 2;
      if (Math.abs(x - this.player.x) > VIEW.WIDTH / 2 + TILE) continue;
      if (Math.abs(y - this.player.y) > VIEW.HEIGHT / 2 + TILE) continue;
      if (Math.random() < 0.02) {
        this.particles.ember(x, y - 6, Math.random() < 0.5 ? this.biome.flameOuter : this.biome.flameInner);
      }
    }
  }

  private updateMusicIntensity(): void {
    let target = 0.5;
    if (this.boss?.alive) {
      target = this.boss.enraged ? 0.95 : 0.85;
    } else {
      const inCombat = this.enemies.some(
        e =>
          e.alive &&
          e.aggro &&
          !e.dormant &&
          Math.hypot(e.x - this.player.x, e.y - this.player.y) < 320,
      );
      target = inCombat ? 0.7 : 0.5;
    }
    if (Math.abs(target - this.musicIntensity) > 0.05) {
      this.musicIntensity = target;
      this.services?.audio?.setMusicIntensity?.(target);
    }
  }

  private trackStat(type: string, value: number): void {
    this.services?.achievements?.trackGameSpecificStat?.(this.manifest.id, type, value);
  }

  private syncExtendedData(): void {
    this.extendedGameData = {
      depth: this.floor,
      enemies_slain: this.enemiesSlain,
      gold_collected: this.goldCollected,
      bosses_slain: this.bossesSlain,
      relics_collected: this.relicsCollected,
      rooms_explored: this.roomsExplored,
      combo: this.maxCombo,
      daggers_thrown: this.daggersThrown,
      mimics_found: this.mimicsFound,
      perfect_floors: this.perfectFloors,
      keys_used: this.keysUsed,
      potions_used: this.potionsUsed,
      elites_slain: this.elitesSlain,
      items_bought: this.itemsBought,
      gold_spent: this.goldSpent,
      unique_bosses: this.uniqueBossKits.size,
      dashes_used: this.dashesUsed,
    };
  }

  // ------------------------------------------------------------ render

  protected onRender(ctx: CanvasRenderingContext2D): void {
    const offset = this.shake.getOffset();
    ctx.save();
    ctx.translate(Math.round(-this.camX + offset.x), Math.round(-this.camY + offset.y));

    this.tiles.renderTiles(
      ctx,
      this.map,
      this.camX,
      this.camY,
      VIEW.WIDTH,
      VIEW.HEIGHT,
      this.gameTime,
      this.stairsLocked,
      this.biome,
    );

    for (const hazard of this.hazards) this.tiles.drawHazard(ctx, hazard, this.gameTime);
    for (const urn of this.urns) {
      if (urn.alive) this.tiles.drawUrn(ctx, urn);
    }
    if (this.merchant) this.tiles.drawMerchant(ctx, this.merchant.x, this.merchant.y, this.gameTime);
    for (const item of this.shopItems) this.tiles.drawShopItem(ctx, item, item.sold, this.gameTime);
    for (const pickup of this.pickupItems) this.tiles.drawPickup(ctx, pickup, this.gameTime);
    for (const enemy of this.enemies) this.tiles.drawEnemy(ctx, enemy, this.gameTime);
    if (this.boss?.alive) this.tiles.drawBoss(ctx, this.boss, this.gameTime);

    this.renderCombatEffects(ctx);

    if (this.state !== 'recap') this.tiles.drawPlayer(ctx, this.player, this.gameTime);
    this.particles.render(ctx);
    ctx.restore();

    // Darkness + torchlight (screen space).
    const lights: LightSource[] = [
      {
        x: this.player.x,
        y: this.player.y,
        radius: Lighting.playerTorchRadius(this.player.torchBonus()),
        flicker: 0.6,
      },
    ];
    for (const torch of this.plan.torches) lights.push(Lighting.wallTorchLight(torch.tx, torch.ty));
    if (!this.stairsLocked) {
      const stairs = this.map.tileCenter(this.plan.stairsTile.tx, this.plan.stairsTile.ty);
      lights.push({ x: stairs.x, y: stairs.y, radius: 80, flicker: 0.4 });
    }
    if (this.merchant) {
      lights.push({ x: this.merchant.x, y: this.merchant.y, radius: 110, flicker: 0.5 });
    }
    if (this.boss?.alive) {
      lights.push({ x: this.boss.x, y: this.boss.y, radius: 130, flicker: 1 });
    }
    this.lighting.render(ctx, VIEW.WIDTH, VIEW.HEIGHT, this.camX - offset.x, this.camY - offset.y, this.floor, lights);
  }

  /** World-space combat FX: projectiles, bombs, explosion fuses, shockwaves. */
  private renderCombatEffects(ctx: CanvasRenderingContext2D): void {
    for (const proj of this.projectiles) {
      if (proj.kind === 'bolt') {
        ctx.fillStyle = proj.homing > 0 ? '#c99aff' : '#78beff';
        ctx.fillRect(Math.round(proj.x) - 3, Math.round(proj.y) - 3, 6, 6);
        ctx.fillStyle = '#d8ecff';
        ctx.fillRect(Math.round(proj.x) - 1, Math.round(proj.y) - 1, 2, 2);
      } else {
        ctx.fillStyle = PALETTE.dagger;
        ctx.fillRect(Math.round(proj.x) - 2, Math.round(proj.y) - 2, 4, 4);
      }
    }

    // Bombs arc with a fake-height hop; landing spot marked from launch.
    for (const bomb of this.bombs) {
      const t = Math.min(1, bomb.t);
      const x = bomb.fromX + (bomb.toX - bomb.fromX) * t;
      const y = bomb.fromY + (bomb.toY - bomb.fromY) * t - Math.sin(t * Math.PI) * 46;
      ctx.strokeStyle = 'rgba(255, 122, 26, 0.5)';
      ctx.beginPath();
      ctx.arc(bomb.toX, bomb.toY, EXPLOSIONS.BOMB_RADIUS * 0.5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#22242b';
      ctx.fillRect(Math.round(x) - 4, Math.round(y) - 4, 8, 8);
      const spark = Math.floor(this.gameTime * 18) % 2 === 0;
      ctx.fillStyle = spark ? '#ffd24a' : '#ff7a1a';
      ctx.fillRect(Math.round(x) + 2, Math.round(y) - 7, 3, 3);
    }

    // Fused explosions: blinking danger circle that tightens as the fuse burns.
    for (const explosion of this.explosions) {
      const urgency = Math.max(
        0,
        Math.min(1, 1 - explosion.fuse / Math.max(EXPLOSIONS.BOMB_FUSE, EXPLOSIONS.VOLATILE_FUSE)),
      );
      const blink = Math.floor(this.gameTime * (8 + urgency * 16)) % 2 === 0;
      ctx.strokeStyle = blink ? 'rgba(255, 80, 40, 0.9)' : 'rgba(255, 160, 60, 0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(explosion.x, explosion.y, explosion.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = 1;
    }

    // Shockwave rings.
    for (const wave of this.shockwaves) {
      if (wave.delay > 0 || wave.radius <= 0) continue;
      const fade = 1 - wave.radius / SHOCKWAVE.MAX_RADIUS;
      ctx.strokeStyle = `rgba(232, 220, 188, ${0.35 + 0.55 * fade})`;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(wave.x, wave.y, wave.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = 1;
    }
  }

  protected onRenderUI(ctx: CanvasRenderingContext2D): void {
    this.hud.renderHud(ctx, {
      score: this.score,
      goldBalance: this.goldBalance,
      floor: this.floor,
      hp: this.player.hp,
      maxHp: this.player.maxHp,
      daggers: this.player.daggers,
      keys: this.player.keys,
      combo: this.combo,
      comboTimer: this.comboTimer,
      dashFrac: this.player.dashCooldownFrac(),
      buffs: this.player.buffs,
      relics: this.player.relics,
    });
    this.minimap.render(
      ctx,
      this.map,
      VIEW.WIDTH,
      this.player.x,
      this.player.y,
      this.boss?.alive ? { x: this.boss.x, y: this.boss.y } : null,
    );
    if (this.boss?.alive) {
      this.hud.renderBossBar(ctx, this.boss.kit.name, this.boss.hp, this.boss.maxHp, this.boss.enraged);
    }
    if (this.activeShopItem && this.state === 'playing') {
      const item = this.activeShopItem;
      const names: Record<string, string> = {
        heart: 'HEART',
        daggers: 'DAGGER BUNDLE',
        potion: 'MYSTERY POTION',
        relic: 'MYSTERY RELIC',
      };
      this.hud.renderShopPrompt(
        ctx,
        `${names[item.product]} — ${item.price}g · press E`,
        this.goldBalance >= item.price,
        this.shopDeniedFlash,
      );
    }
    if (this.bannerTimer > 0) this.hud.renderBanner(ctx, this.bannerText, this.bannerSub, this.bannerTimer);
    if (this.state === 'relic') {
      this.hud.renderRelicDraft(ctx, this.relicChoices, this.relicIndex, id => this.player.relicCount(id));
    }
    if (this.state === 'recap' && this.recapStats) {
      const stats = this.recapStats;
      this.hud.renderRecap(ctx, {
        causeLabel: CAUSE_LABELS[stats.cause],
        causeHint: CAUSE_HINTS[stats.cause],
        rows: [
          ['DEPTH REACHED', `FLOOR ${stats.depth}`],
          ['MONSTERS SLAIN', `${stats.kills}`],
          ['GOLD PLUNDERED', `${stats.gold}`],
          ['GUARDIANS FELLED', `${stats.bosses}`],
          ['RELICS CLAIMED', `${stats.relics}`],
          ['BEST COMBO', `x${stats.maxCombo}`],
          ['FINAL SCORE', `${this.score}`],
        ],
        timer: this.recapTimer,
      });
    }
  }
}
