// ===== src/games/dungeon-crawl/DungeonCrawlGame.ts =====
// The Ember Depths — Tier 3 action dungeon crawler. Orchestrates the seeded
// floor generator, real-time combat, relic draft, boss kits, biome hazards,
// the merchant shop, and the arcade service contract (scoring, achievements
// metrics, recap→endGame). Screen-space chrome lives in rendering/HudRenderer.

import { BaseGame } from '@/games/shared/BaseGame';
import { GameManifest } from '@/lib/types';
import {
  BIOMES,
  BiomePalette,
  biomeForFloor,
  COMBAT,
  FLOOR_NAMES,
  HAZARDS,
  OVERLAY,
  PALETTE,
  PICKUPS,
  PLAYER,
  PotionBuff,
  SHOP,
  TILE,
  VIEW,
} from './data/constants';
import { BOON_TUNING, BOONS, BoonId } from './data/boons';
import { ALL_CLASS_IDS, CLASSES, ClassId } from './data/classes';
import { BOSS } from './data/enemies';
import { PROVISION_TUNING } from './data/gear';
import { PROGRESSION } from './data/progression';
import { bossKitById } from './data/bosses';
import { QuestDef } from './data/quests';
import { ALL_RELIC_IDS, RELIC_TUNING, RELICS, RelicId } from './data/relics';
import { ALL_SCROLL_IDS, SCROLLS, ScrollId } from './data/scrolls';
import { ProgressionController } from './progression/ProgressionController';
import { TOWN_PALETTE, TownController } from './town/TownController';
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
import { causeForEnemy, Combat, DeathCause } from './systems/Combat';
import { Lighting, LightSource } from './systems/Lighting';
import { Minimap } from './systems/Minimap';
import { ParticleSystem } from './systems/ParticleSystem';
import { ScreenShake } from './systems/ScreenShake';
import { SecretRooms } from './systems/SecretRooms';
import { HudRenderer, RecapStats, VictoryLedger } from './rendering/HudRenderer';
import { TileRenderer } from './rendering/TileRenderer';

type GameState =
  | 'classSelect'
  | 'town'
  | 'playing'
  | 'relic'
  | 'levelUp'
  | 'victory'
  | 'interlude'
  | 'recap';

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

  // v3 — combat resolution system; the host closes over live run state so the
  // per-floor array/rng reassignments below stay visible to it.
  private combat = new Combat({
    player: () => this.player,
    rng: () => this.rng,
    map: () => this.map,
    enemies: () => this.enemies,
    urns: () => this.urns,
    boss: () => this.boss,
    particles: this.particles,
    shake: this.shake,
    addEnemy: enemy => this.enemies.push(enemy),
    addPickup: pickup => this.pickupItems.push(pickup),
    addProjectile: projectile => this.projectiles.push(projectile),
    findOpenSpotNear: (x, y) => this.findOpenSpotNear(x, y),
    levelPressure: () => this.progression.levelPressure(),
    revealMap: () => this.minimap.revealAll(this.map),
    crackWall: (tx, ty) => this.crackWall(tx, ty),
    playSound: (name, volume) => this.services?.audio?.playSound?.(name, { volume }),
    damagePlayer: (amount, cause) => this.damagePlayer(amount, cause),
    registerKill: baseScore => this.registerKill(baseScore),
    onEnemySlain: enemy => this.onEnemySlain(enemy),
    onBossSlain: boss => this.onBossSlain(boss),
    onMimicWake: enemy => this.onMimicWake(enemy),
  });

  // v4 Wave C — secret-room reveal/nest tracking behind its own narrow host.
  private secretRooms = new SecretRooms({
    spawnNest: spawns =>
      spawns.map(s => {
        const enemy = new Enemy(s.type, s.x, s.y, s.elite, this.progression.levelPressure());
        this.enemies.push(enemy);
        return enemy;
      }),
    showBanner: (text, sub) => this.showBanner(text, sub),
    playSound: (name, volume) => this.services?.audio?.playSound?.(name, { volume }),
    grantNestReward: gold => {
      this.goldBalance += gold; // run wallet only — arcade coins untouched
    },
    onSecretFound: () => {
      this.secretsFound++;
      this.trackStat('secrets_found', this.secretsFound);
    },
    onNestCleared: () => {
      this.nestsCleared++;
      this.trackStat('nests_cleared', this.nestsCleared);
    },
  });

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
  // v3 stats
  private abilitiesUsed = 0;
  private undeadSlain = 0;
  private uniqueSlainTypes = new Set<string>();
  private scrollsUsed = 0;
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
  // v3 — run-start class draft.
  private chosenClass: ClassId | null = null;
  private classIndex = 0;
  // v4 — the persistent hero + level-up draft + retire affordance.
  private progression = new ProgressionController();
  private boonChoices: BoonId[] = [];
  private boonIndex = 0;
  private boonReturnState: 'playing' | 'town' = 'playing';
  private retireHold = 0;
  private recapRetired = false;
  // v4 Wave B — Lastlight + quest expeditions.
  private town = new TownController();
  private activeQuest: QuestDef | null = null;
  private questsCompleted = 0;
  private goldBanked = 0;
  private sagasCompleted = 0;
  private secretsFound = 0;
  private nestsCleared = 0;
  private victoryTimer = 0;
  private victoryLedger: VictoryLedger | null = null;
  // v4 Wave C — saga interlude staged by openVictory, shown after the overlay.
  private pendingInterlude: { sagaName: string; title: string; text: string } | null = null;
  private interludeTimer = 0;
  private recapStats: RecapStats | null = null;
  private recapTimer = 0;
  private shopDeniedFlash = 0;
  private activeShopItem: LiveShopItem | null = null;

  // Input edges.
  private attackWas = false;
  private daggerWas = false;
  private dashWas = false;
  private abilityWas = false;
  private scrollWas = false;
  private interactWas = false;
  private confirmWas = false;
  private navLeftWas = false;
  private navRightWas = false;
  private navUpWas = false;
  private navDownWas = false;

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
    // v4 — a mid-floor quit still banks the hero's progress.
    this.progression.saveCheckpoint();
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
    this.abilitiesUsed = 0;
    this.undeadSlain = 0;
    this.uniqueSlainTypes.clear();
    this.scrollsUsed = 0;
    this.uniqueBossKits.clear();
    this.goldBalance = 0;
    this.combo = 1;
    this.killChain = 0;
    this.comboTimer = 0;
    this.chosenClass = null;
    this.classIndex = 0;
    this.recapStats = null;
    this.player.reset(0, 0);
    this.shake.reset();
    this.particles.clear();
    this.musicIntensity = -1;

    // v4.1 — the roster: every run opens on the hero select; each class keeps
    // its own persistent hero. LASTLIGHT renders behind the overlay.
    this.progression.load();
    this.progression.resetSessionCounters();
    this.retireHold = 0;
    this.recapRetired = false;
    this.activeQuest = null;
    this.questsCompleted = 0;
    this.goldBanked = 0;
    this.sagasCompleted = 0;
    this.secretsFound = 0;
    this.nestsCleared = 0;
    this.pendingInterlude = null;
    this.interludeTimer = 0;
    this.victoryTimer = 0;
    this.state = 'classSelect';

    this.enterTownWorld();
    this.syncExtendedData();
  }

  /** v4 Wave B — swap the live world for Lastlight (state set by callers). */
  private enterTownWorld(): void {
    this.town.reset();
    this.activeQuest = null;
    this.plan = this.town.plan;
    this.map = this.plan.map;
    this.biome = TOWN_PALETTE;
    this.enemies = [];
    this.pickupItems = [];
    this.hazards = [];
    this.urns = [];
    this.shopItems = [];
    this.merchant = null;
    this.projectiles = [];
    this.combat.reset();
    this.secretRooms.resetFor([]);
    this.boss = null;
    this.stairsLocked = false;
    this.player.placeAt(this.plan.playerStart.x, this.plan.playerStart.y);
    this.minimap.resetFor(this.map);
    this.visitedRooms.clear();
    this.damageTakenThisFloor = false;
    this.particles.clear();
    this.musicIntensity = 0.45;
    this.services?.audio?.setMusicIntensity?.(0.45);
  }

  /** Whether the live world is Lastlight (for draws + HUD gold source). */
  private inTownWorld(): boolean {
    return (
      this.state === 'town' ||
      this.state === 'victory' ||
      this.state === 'interlude' ||
      this.state === 'classSelect' ||
      (this.state === 'levelUp' && this.boonReturnState === 'town')
    );
  }

  private loadFloor(): void {
    // v4 Wave B — quest shape: fixed biome, boss ONLY on the final floor.
    const quest = this.activeQuest;
    const questFloors = quest && quest.floors > 0 ? quest.floors : 0;
    const isFinal = questFloors > 0 && this.floor === questFloors;
    this.plan = generateFloor(
      this.runSeed,
      this.floor,
      questFloors > 0 ? { forceBoss: isFinal, biomeId: quest!.biomeId ?? undefined } : undefined,
    );
    this.map = this.plan.map;
    this.biome =
      (quest?.biomeId && BIOMES.find(b => b.id === quest.biomeId)) || biomeForFloor(this.floor);
    // v4 — level pressure: the hero's legend hardens the opposition.
    const pressure = this.progression.levelPressure();
    this.enemies = this.plan.enemies.map(s => new Enemy(s.type, s.x, s.y, s.elite, pressure));
    this.pickupItems = this.plan.pickups.map(p => new Pickup(p.kind, p.x, p.y));
    this.hazards = this.plan.hazards.map(
      (h, i) => new Hazard(h.tx, h.ty, h.style, (i * 0.37) % 1),
    );
    this.urns = this.plan.urns.map(u => new Urn(u.x, u.y, u.variant));
    this.shopItems = this.plan.shop ? this.plan.shop.items.map(i => ({ ...i, sold: false })) : [];
    this.merchant = this.plan.shop?.merchant ?? null;
    this.projectiles = [];
    this.combat.reset();
    this.secretRooms.resetFor(this.plan.secrets);
    this.activeShopItem = null;
    this.boss = this.plan.isBossFloor && this.plan.bossSpawn
      ? new Boss(
          this.plan.bossSpawn.x,
          this.plan.bossSpawn.y,
          isFinal ? quest!.bossTier : Math.max(1, Math.floor(this.floor / 3)),
          isFinal && quest!.bossKitId ? bossKitById(quest!.bossKitId) : undefined,
        )
      : null;
    this.stairsLocked = this.plan.isBossFloor;
    this.player.placeAt(this.plan.playerStart.x, this.plan.playerStart.y);
    this.minimap.resetFor(this.map);
    this.visitedRooms.clear();
    this.damageTakenThisFloor = false;
    this.particles.clear();

    const floorLabel =
      questFloors > 0 ? `FLOOR ${this.floor} OF ${questFloors}` : `FLOOR ${this.floor}`;
    if (this.boss) {
      this.showBanner(floorLabel, `${this.boss.kit.name} AWAITS`);
    } else {
      this.showBanner(
        floorLabel,
        questFloors > 0 ? quest!.name : FLOOR_NAMES[(this.floor - 1) % FLOOR_NAMES.length],
      );
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
      case 'classSelect':
        this.updateClassSelect();
        break;
      case 'town':
        this.updateTown(dt);
        break;
      case 'playing':
        this.updatePlaying(dt);
        break;
      case 'relic':
        this.updateRelicChoice();
        break;
      case 'levelUp':
        this.updateBoonChoice();
        break;
      case 'victory':
        this.updateVictory(dt);
        break;
      case 'interlude':
        this.updateInterlude(dt);
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
    this.abilityWas = input.isKeyPressed('KeyQ') || input.isKeyPressed('KeyL');
    this.scrollWas = input.isKeyPressed('KeyF') || input.isKeyPressed('KeyO');
    this.interactWas = input.isKeyPressed('KeyE');
    this.confirmWas =
      input.isKeyPressed('Space') || input.isKeyPressed('Enter') || input.isKeyPressed('KeyJ');
    this.navLeftWas = input.isLeftPressed();
    this.navRightWas = input.isRightPressed();
    this.navUpWas = input.isUpPressed();
    this.navDownWas = input.isDownPressed();
  }

  /** Shared ←/→/digit navigation for every draft overlay (edge-detected). */
  private draftNav(index: number, count: number): number {
    const input = this.services?.input;
    if (!input || count === 0) return index;
    let next = index;
    if (input.isLeftPressed() && !this.navLeftWas) {
      next = (next + count - 1) % count;
      this.services?.audio?.playSound?.('click', { volume: 0.3 });
    }
    if (input.isRightPressed() && !this.navRightWas) {
      next = (next + 1) % count;
      this.services?.audio?.playSound?.('click', { volume: 0.3 });
    }
    for (let i = 0; i < count; i++) {
      if (input.isKeyPressed(`Digit${i + 1}`)) next = i;
    }
    return next;
  }

  /** v3 — run-start class draft. Mirrors the relic draft's input handling. */
  private updateClassSelect(): void {
    const input = this.services?.input;
    if (!input) return;

    this.classIndex = this.draftNav(this.classIndex, ALL_CLASS_IDS.length);

    const confirm =
      input.isKeyPressed('Space') || input.isKeyPressed('Enter') || input.isKeyPressed('KeyJ');
    const directPick = ALL_CLASS_IDS.some((_, i) => input.isKeyPressed(`Digit${i + 1}`));
    if ((confirm && !this.confirmWas) || directPick) {
      const def = CLASSES[ALL_CLASS_IDS[this.classIndex]];
      // v4.1 — resume this class's hero, or forge one for an empty slot.
      const existing = this.progression.heroFor(def.id);
      const hero = existing
        ? this.progression.selectHero(def.id)
        : this.progression.create(def.id, this.rng);
      this.player.applyKit(def);
      this.player.applyProgression(this.progression.gains(), hero.boons);
      this.chosenClass = def.id;
      this.trackStat(`${def.id}_depth`, this.floor);
      this.trackStat('character_level', hero.level);
      this.services?.audio?.playSound?.('powerup', { volume: 0.55 });
      this.showBanner(
        hero.name,
        existing
          ? `LEVEL ${hero.level} ${def.name} — WELCOME TO LASTLIGHT`
          : `${def.name} — THE QUEST BOARD AWAITS`,
      );
      this.state = 'town';
    }
  }

  // ------------------------------------------------------------ v4 the town

  private updateTown(dt: number): void {
    const input = this.services?.input;
    this.town.update({
      dt,
      input,
      edges: {
        interactWas: this.interactWas,
        confirmWas: this.confirmWas,
        navLeftWas: this.navLeftWas,
        navRightWas: this.navRightWas,
        navUpWas: this.navUpWas,
        navDownWas: this.navDownWas,
      },
      player: this.player,
      hero: this.progression.character(),
      save: () => this.progression.saveCheckpoint(),
      playSound: (name, volume) => this.services?.audio?.playSound?.(name, { volume }),
      showBanner: (text, sub) => this.showBanner(text, sub),
      depart: quest => this.departOnQuest(quest),
    });
    this.updateCamera();
    this.minimap.reveal(
      this.map,
      this.player.x,
      this.player.y,
      Lighting.playerTorchRadius(this.player.torchBonus()),
    );
    this.emitTorchEmbers();
  }

  /** Set out from the gate: fresh seed, quest shape, packed provisions. */
  private departOnQuest(quest: QuestDef): void {
    const hero = this.progression.character();
    this.activeQuest = quest;

    // Expedition-scoped resets (session metrics keep accumulating).
    this.floor = 1;
    this.combo = 1;
    this.killChain = 0;
    this.comboTimer = 0;
    this.goldBalance = 0;
    this.runSeed = (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0;
    this.rng = new Rng(this.runSeed ^ 0x51ed270b);

    // Re-arm the hero: kit + training + gear, then whatever was packed.
    if (hero) {
      this.player.reset(0, 0);
      this.player.applyKit(CLASSES[hero.classId]);
      this.player.applyProgression(this.progression.gains(), hero.boons, hero.gear);
      for (const provision of hero.provisions) {
        if (provision === 'field-scroll') {
          this.player.scroll = this.rng.pick(ALL_SCROLL_IDS);
        } else if (provision === 'bandolier') {
          this.player.daggers = Math.min(
            this.player.daggerCap(),
            this.player.daggers + PROVISION_TUNING.BANDOLIER_DAGGERS,
          );
        } else if (provision === 'blessed-candle') {
          this.player.provisionTorch = PROVISION_TUNING.CANDLE_TORCH_BONUS;
        }
      }
      hero.provisions = [];
      this.progression.saveCheckpoint();
    }

    this.state = 'playing';
    this.loadFloor();
    this.services?.audio?.triggerMusicStinger?.('transition');
  }

  /** The final boss fell and the stairs were taken: the quest is won. */
  private openVictory(): void {
    const quest = this.activeQuest!;
    const hero = this.progression.character();
    this.state = 'victory';
    this.victoryTimer = 0;

    const banked = this.goldBalance + quest.rewardGold;
    if (hero) {
      hero.gold += banked;
      hero.stats.victories++;
    }
    this.progression.grantXp(quest.rewardXp);
    this.trackStat('xp_earned', this.progression.sessionXp);
    this.progression.saveCheckpoint();
    this.questsCompleted++;
    this.goldBanked += banked;
    this.trackStat('quests_completed', this.questsCompleted);
    this.trackStat('gold_banked', this.goldBanked);

    // v4 Wave C — a current-chapter victory advances its saga and stages the
    // interlude (replays return null: no re-advance, no repeated story beat).
    const sagaHit = this.progression.advanceSaga(quest.id);
    if (sagaHit) {
      this.pendingInterlude = {
        sagaName: sagaHit.sagaName,
        title: sagaHit.completed ? 'THE SAGA IS TOLD' : 'THE TALE CONTINUES',
        text: sagaHit.interlude,
      };
      if (sagaHit.completed) {
        this.sagasCompleted++;
        this.trackStat('sagas_completed', this.sagasCompleted);
      }
    }

    this.victoryLedger = {
      carried: this.goldBalance,
      rewardGold: quest.rewardGold,
      rewardXp: quest.rewardXp,
      banked,
      treasury: hero?.gold ?? 0,
    };
    this.shake.add(0.3);
    this.services?.audio?.playSound?.('success', { volume: 0.7 });
    this.services?.audio?.triggerMusicStinger?.('success');
  }

  private updateVictory(dt: number): void {
    this.victoryTimer += dt;
    const input = this.services?.input;
    const confirm = input
      ? input.isKeyPressed('Space') || input.isKeyPressed('Enter')
      : false;
    if (this.victoryTimer > 1.0 && confirm && !this.confirmWas) {
      this.enterTownWorld();
      if (this.pendingInterlude) {
        // v4 Wave C — the story beat plays before Lastlight takes over.
        this.state = 'interlude';
        this.interludeTimer = 0;
        this.services?.audio?.playSound?.('unlock', { volume: 0.4 });
        return;
      }
      this.arriveInLastlight();
    }
  }

  /** v4 Wave C — dismissing the interlude lands the hero back in town. */
  private updateInterlude(dt: number): void {
    this.interludeTimer += dt;
    const input = this.services?.input;
    const confirm = input
      ? input.isKeyPressed('Space') || input.isKeyPressed('Enter')
      : false;
    if (this.interludeTimer > OVERLAY.INTERLUDE_LOCKOUT && confirm && !this.confirmWas) {
      this.pendingInterlude = null;
      this.arriveInLastlight();
    }
  }

  /** Post-victory landing: banner + any level-up the reward XP earned. */
  private arriveInLastlight(): void {
    this.state = 'town';
    this.showBanner('LASTLIGHT', 'THE GATE CLOSES BEHIND YOU — WELL FOUGHT');
    // Reward XP can cross a threshold — level up right at the gate.
    if (this.progression.pendingLevelUp()) this.openBoonDraft('town');
  }

  // ------------------------------------------------------------ v4 level-ups

  /** Open the boon draft for a pending level (or auto-level when maxed out). */
  private openBoonDraft(returnTo: 'playing' | 'town' = 'playing'): void {
    this.boonReturnState = returnTo;
    this.boonChoices = this.progression.boonChoices(this.rng);
    this.boonIndex = 0;
    if (this.boonChoices.length === 0) {
      // Every training maxed — the level still lands.
      while (this.progression.pendingLevelUp()) {
        const { level, gain } = this.progression.confirmLevelUp(null);
        this.player.gainLevelBenefits(gain);
        this.showBanner(`LEVEL ${level}!`, 'YOUR LEGEND GROWS');
      }
      this.syncProgressionStats();
      return;
    }
    this.state = 'levelUp';
    this.services?.audio?.playSound?.('success', { volume: 0.5 });
  }

  /** Level-up draft input — mirrors the relic draft. */
  private updateBoonChoice(): void {
    const input = this.services?.input;
    if (!input) return;

    this.boonIndex = this.draftNav(this.boonIndex, this.boonChoices.length);

    const confirm =
      input.isKeyPressed('Space') || input.isKeyPressed('Enter') || input.isKeyPressed('KeyJ');
    const directPick = this.boonChoices.some((_, i) => input.isKeyPressed(`Digit${i + 1}`));
    if ((confirm && !this.confirmWas) || directPick) {
      const boon = this.boonChoices[this.boonIndex];
      const { level, gain } = this.progression.confirmLevelUp(boon);
      this.player.gainBoon(boon);
      this.player.gainLevelBenefits(gain);
      this.services?.audio?.playSound?.('powerup', { volume: 0.6 });
      this.particles.burst(this.player.x, this.player.y, BOONS[boon].color, 18, 130, 0.8);
      this.showBanner(`LEVEL ${level}!`, BOONS[boon].name);
      this.syncProgressionStats();
      // Boss XP can cross two thresholds — draft again if another level waits.
      if (this.progression.pendingLevelUp()) this.openBoonDraft(this.boonReturnState);
      else this.state = this.boonReturnState;
    }
  }

  private syncProgressionStats(): void {
    const hero = this.progression.character();
    if (hero) this.trackStat('character_level', hero.level);
    this.trackStat('levels_gained', this.progression.sessionLevels);
    this.trackStat('boons_chosen', this.progression.sessionBoons);
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
            this.player.kit.daggerHoming, // v3 — mage mana bolts seek
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

    // v3 — signature class ability (Q / L). Effects resolve in Combat; the
    // thief's hide is pure player state.
    const abilityDown = input ? input.isKeyPressed('KeyQ') || input.isKeyPressed('KeyL') : false;
    if (abilityDown && !this.abilityWas && this.chosenClass && this.player.tryAbility()) {
      this.abilitiesUsed++;
      this.trackStat('abilities_used', this.abilitiesUsed);
      switch (this.player.kit.abilityId) {
        case 'cleave':
          this.player.swingAnim = 0.22; // visual swing tail for the spin
          this.combat.cleave();
          break;
        case 'shadow-hide':
          this.player.startHide();
          this.services?.audio?.playSound?.('whoosh', { volume: 0.5 });
          this.particles.burst(this.player.x, this.player.y, '#9a7bff', 16, 120, 0.5);
          break;
        case 'turn-undead':
          this.combat.turnUndead();
          break;
        case 'fireball':
          this.combat.spawnFireball();
          break;
      }
    }

    // v3 wave 3 — read the held scroll (F / O).
    const scrollDown = input ? input.isKeyPressed('KeyF') || input.isKeyPressed('KeyO') : false;
    if (scrollDown && !this.scrollWas && this.player.scroll) {
      this.castScroll(this.player.scroll);
      this.player.scroll = null;
      this.scrollsUsed++;
      this.trackStat('scrolls_used', this.scrollsUsed);
    }

    // --- Sword swing resolution (enemies, boss, urns).
    if (this.player.swing) {
      for (const enemy of this.enemies) {
        if (!enemy.alive || this.player.swing.hitIds.has(enemy.id)) continue;
        if (!this.player.swingHits(enemy.x, enemy.y, enemy.radius)) continue;
        this.player.swing.hitIds.add(enemy.id);
        this.combat.hitEnemy(enemy, this.player.swordDamage(), 'sword');
      }
      if (this.boss?.alive && !this.player.swing.hitIds.has(-1)) {
        if (this.player.swingHits(this.boss.x, this.boss.y, this.boss.radius)) {
          this.player.swing.hitIds.add(-1);
          this.combat.hitBoss(this.player.swordDamage());
        }
      }
      for (const urn of this.urns) {
        if (urn.alive && this.player.swingHits(urn.x, urn.y, urn.radius)) this.combat.breakUrn(urn);
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
      throwBomb: (x, y, targetX, targetY) => this.combat.throwBomb(x, y, targetX, targetY),
      onMimicWake: enemy => this.onMimicWake(enemy),
      playerHidden: this.player.hiddenTimer > 0,
    };
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      enemy.update(dt, enemyCtx);
      // Touch damage (stunned monsters are safe to brush past).
      const reach = enemy.radius + this.player.size / 2;
      if (
        !enemy.dormant &&
        enemy.stunned <= 0 &&
        Math.hypot(enemy.x - this.player.x, enemy.y - this.player.y) < reach
      ) {
        this.damagePlayer(enemy.config.touchDamage, causeForEnemy(enemy));
      }
    }
    this.enemies = this.enemies.filter(e => e.alive);

    // --- Boss (kit AI + touch damage live in Combat).
    this.combat.updateBoss(dt);

    // --- Projectiles. Hostile bolts home on the player; mage mana bolts
    // home on the nearest living monster instead.
    for (const proj of this.projectiles) {
      if (proj.kind === 'dagger' && proj.homing > 0) {
        const target = this.nearestEnemyTo(proj.x, proj.y);
        proj.update(dt, this.map, target?.x, target?.y);
      } else {
        proj.update(dt, this.map, this.player.x, this.player.y);
      }
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
            this.combat.hitEnemy(enemy, proj.damage, 'dagger');
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
              this.combat.breakUrn(urn);
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
            this.combat.hitBoss(proj.damage);
            if (!proj.pierce) proj.alive = false;
          }
        }
      }
    }
    this.projectiles = this.projectiles.filter(p => p.alive);

    // --- v2: bombs in flight -> staged explosions -> booms; shockwaves; hazards.
    this.combat.update(dt);
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
    this.secretRooms.update(this.player.x, this.player.y);
    this.checkStairs();

    // v4 — banked XP crossing a threshold opens the level-up draft (never
    // mid-combat-resolution; stairs/relic state wins if it fired this frame).
    if (this.state === 'playing' && this.progression.pendingLevelUp()) {
      this.openBoonDraft();
    }

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

  /** v3 wave 3 — one-shot scroll effects. The satchel empties after the cast. */
  private castScroll(id: ScrollId): void {
    this.showBanner(SCROLLS[id].name, SCROLLS[id].blurb);
    this.combat.castScroll(id, this.scholarMult());
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

    const price = this.hagglerPrice(best.price);
    if (this.goldBalance < price) {
      this.shopDeniedFlash = 0.8;
      this.services?.audio?.playSound?.('error', { volume: 0.4 });
      return;
    }

    // Purchase.
    this.goldBalance -= price;
    this.goldSpent += price;
    this.itemsBought++;
    best.sold = true;
    switch (best.product) {
      case 'heart':
        this.player.heal(PICKUPS.HEART_HEAL + this.player.heartHealBonus());
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
      case 'scroll': {
        // v3 — you paid for it: a bought scroll replaces whatever was held.
        const id = this.rng.pick(ALL_SCROLL_IDS);
        this.player.scroll = id;
        this.showBanner(SCROLLS[id].name, `${SCROLLS[id].blurb} — press F`);
        break;
      }
    }
    this.services?.audio?.playSound?.('success', { volume: 0.5 });
    this.particles.burst(best.x, best.y, PALETTE.gold, 12, 100, 0.6);
    this.trackStat('items_bought', this.itemsBought);
    this.trackStat('gold_spent', this.goldSpent);
  }

  /** v4 — Haggler training talks merchants down (never below 1 gold). */
  private hagglerPrice(base: number): number {
    const haggler = this.player.boonCount('haggler');
    if (haggler === 0) return base;
    return Math.max(1, Math.round(base * (1 - haggler * BOON_TUNING.HAGGLER_DISCOUNT)));
  }

  /** v4 — Scholar training deepens scroll magic where it sensibly can. */
  private scholarMult(): number {
    return this.player.boonCount('scholar') > 0 ? BOON_TUNING.SCHOLAR_MULT : 1;
  }

  /** Closest living, non-dormant monster (boss as fallback) — mana bolt target. */
  private nearestEnemyTo(x: number, y: number): { x: number; y: number } | null {
    let best: { x: number; y: number } | null = null;
    let bestDist = Infinity;
    for (const enemy of this.enemies) {
      if (!enemy.alive || enemy.dormant) continue;
      const dist = Math.hypot(enemy.x - x, enemy.y - y);
      if (dist < bestDist) {
        bestDist = dist;
        best = { x: enemy.x, y: enemy.y };
      }
    }
    if (!best && this.boss?.alive) best = { x: this.boss.x, y: this.boss.y };
    return best;
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

  /** Post-kill stat bookkeeping — mechanics live in systems/Combat.ts. */
  private onEnemySlain(enemy: Enemy): void {
    this.enemiesSlain++;
    // v4 — the hero learns from every kill (elites teach triple).
    this.progression.grantXp(
      enemy.config.xp * (enemy.elite ? PROGRESSION.ELITE_XP_MULT : 1),
    );
    this.trackStat('xp_earned', this.progression.sessionXp);
    if (enemy.elite) {
      this.elitesSlain++;
      this.trackStat('elites_slain', this.elitesSlain);
    }
    // v3 — bestiary stats: the restless dead + the menagerie tally.
    if (enemy.config.undead) {
      this.undeadSlain++;
      this.trackStat('undead_slain', this.undeadSlain);
    }
    if (!this.uniqueSlainTypes.has(enemy.config.id)) {
      this.uniqueSlainTypes.add(enemy.config.id);
      this.trackStat('unique_slain', this.uniqueSlainTypes.size);
    }
    this.trackStat('enemies_slain', this.enemiesSlain);
  }

  /** Boss-kill bookkeeping: stats, score bonus, stairs unlock, fanfare. */
  private onBossSlain(boss: Boss): void {
    this.bossesSlain++;
    this.enemiesSlain++;
    // v4 — a felled Guardian is a chapter of the hero's legend.
    this.progression.grantXp(PROGRESSION.BOSS_XP);
    this.trackStat('xp_earned', this.progression.sessionXp);
    this.uniqueBossKits.add(boss.kit.id);
    this.registerKill(BOSS.SCORE);
    this.score += COMBAT.BOSS_BONUS;
    this.services?.audio?.triggerMusicStinger?.('success');

    // Unlock the way down.
    this.stairsLocked = false;
    this.services?.audio?.playSound?.('gate_open', { volume: 0.6 });
    this.showBanner(`${boss.kit.name} FELLED`, 'THE STAIRS ARE OPEN');
    this.trackStat('bosses_slain', this.bossesSlain);
    this.trackStat('unique_bosses', this.uniqueBossKits.size);
    this.trackStat('enemies_slain', this.enemiesSlain);
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
    // v3 — Blur Cloak: sometimes the blow finds only afterimage.
    const blur = this.player.relicCount('blur-cloak');
    if (blur > 0 && this.player.invuln <= 0) {
      const dodge = Math.min(
        RELIC_TUNING.BLUR_DODGE_CAP,
        blur * RELIC_TUNING.BLUR_DODGE_PER_STACK,
      );
      if (this.rng.chance(dodge)) {
        this.player.invuln = Math.max(this.player.invuln, RELIC_TUNING.BLUR_INVULN);
        this.services?.audio?.playSound?.('whoosh', { volume: 0.3 });
        this.particles.burst(this.player.x, this.player.y, '#8fd8ff', 8, 90, 0.4);
        return;
      }
    }
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
          this.combat.woundEnemy(enemy, thorns * RELIC_TUNING.THORN_MAIL_DAMAGE);
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
      // v4 — Survivor training: magic burns before grit, grit before the grave.
      if (this.player.tryConsumeSurvivor()) {
        this.shake.add(0.6);
        this.services?.audio?.playSound?.('extraLife', { volume: 0.7 });
        this.particles.burst(this.player.x, this.player.y, '#ffd24a', 26, 180, 0.8);
        this.showBanner('SHEER GRIT', 'DEATH REFUSED — ONCE');
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
        this.player.heal(PICKUPS.HEART_HEAL + this.player.heartHealBonus());
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
      case 'scroll': {
        // v3 — the satchel holds one; a full satchel leaves the find in place.
        if (this.player.scroll) {
          pickup.alive = true;
          return;
        }
        const id = this.rng.pick(ALL_SCROLL_IDS);
        this.player.scroll = id;
        this.services?.audio?.playSound?.('unlock', { volume: 0.5 });
        this.particles.burst(pickup.x, pickup.y, SCROLLS[id].color, 10, 90, 0.5);
        this.showBanner(SCROLLS[id].name, `${SCROLLS[id].blurb} — press F`);
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

  /** v4 Wave C — a player blast breaks a cracked wall open (Combat calls in). */
  private crackWall(tx: number, ty: number): void {
    if (this.map.get(tx, ty) !== Tile.CrackedWall) return;
    this.map.set(tx, ty, Tile.Floor);
    const center = this.map.tileCenter(tx, ty);
    this.particles.burst(center.x, center.y, this.biome.wallFace, 14, 120, 0.6);
    this.particles.burst(center.x, center.y, this.biome.floorCrack, 8, 80, 0.5);
    this.shake.add(0.2);
    this.services?.audio?.playSound?.('collision', { volume: 0.5 });
    this.secretRooms.onWallCracked(tx, ty);
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
      // v4 Wave B — the final floor's stairs lead home, not deeper.
      const quest = this.activeQuest;
      if (quest && quest.floors > 0 && this.floor === quest.floors) {
        this.openVictory();
      } else {
        this.openRelicDraft();
      }
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

    this.relicIndex = this.draftNav(this.relicIndex, 3);

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
    if (this.chosenClass) this.trackStat(`${this.chosenClass}_depth`, this.floor);
    this.progression.saveCheckpoint(); // v4 — bank the floor's XP
    this.services?.audio?.playSound?.('gate_open', { volume: 0.5 });
    this.services?.audio?.triggerMusicStinger?.('transition');
    this.state = 'playing';
    this.loadFloor();
  }

  // ------------------------------------------------------------ death + recap

  private openRecap(cause: DeathCause): void {
    this.state = 'recap';
    this.recapTimer = 0;
    // v4 — the hero endures: death banks XP/boons and counts the fall.
    this.progression.recordDeath();
    this.retireHold = 0;
    this.recapRetired = false;
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

    // v4 — hold R past the lockout to retire the hero (hold-gated on purpose).
    if (canDismiss && !this.recapRetired && this.progression.hasCharacter() && input?.isKeyPressed('KeyR')) {
      this.retireHold += dt;
      if (this.retireHold >= PROGRESSION.RETIRE_HOLD_SECONDS) {
        this.progression.retire();
        this.recapRetired = true;
        this.services?.audio?.playSound?.('gate_open', { volume: 0.5 });
      }
    } else {
      this.retireHold = 0;
    }

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
      // v3 — class keys: depth reached this run under that class, else 0.
      fighter_depth: this.chosenClass === 'fighter' ? this.floor : 0,
      thief_depth: this.chosenClass === 'thief' ? this.floor : 0,
      cleric_depth: this.chosenClass === 'cleric' ? this.floor : 0,
      mage_depth: this.chosenClass === 'mage' ? this.floor : 0,
      abilities_used: this.abilitiesUsed,
      undead_slain: this.undeadSlain,
      unique_slain: this.uniqueSlainTypes.size,
      scrolls_used: this.scrollsUsed,
      // v4 — the hero's ledger.
      character_level: this.progression.character()?.level ?? 1,
      xp_earned: this.progression.sessionXp,
      levels_gained: this.progression.sessionLevels,
      boons_chosen: this.progression.sessionBoons,
      quests_completed: this.questsCompleted,
      gold_banked: this.goldBanked,
      // v4 Wave C — sagas + secret rooms.
      sagas_completed: this.sagasCompleted,
      secrets_found: this.secretsFound,
      nests_cleared: this.nestsCleared,
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
    if (this.inTownWorld()) {
      // Lastlight's fixtures: smith (soot-brown), alchemist (violet), board.
      this.tiles.drawMerchant(ctx, this.town.spots.smith.x, this.town.spots.smith.y, this.gameTime, '#5a3a22', '#3a2414');
      this.tiles.drawMerchant(ctx, this.town.spots.alchemist.x, this.town.spots.alchemist.y, this.gameTime);
      this.tiles.drawQuestBoard(ctx, this.town.spots.quests.x, this.town.spots.quests.y, this.gameTime);
    }
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
    // v3 — fire beetles carry their own glow: glands bright enough to read by.
    for (const enemy of this.enemies) {
      if (enemy.alive && enemy.config.id === 'fire-beetle') {
        lights.push({ x: enemy.x, y: enemy.y, radius: 70, flicker: 0.6 });
      }
    }
    if (!this.stairsLocked) {
      const stairs = this.map.tileCenter(this.plan.stairsTile.tx, this.plan.stairsTile.ty);
      lights.push({ x: stairs.x, y: stairs.y, radius: 80, flicker: 0.4 });
    }
    if (this.merchant) {
      lights.push({ x: this.merchant.x, y: this.merchant.y, radius: 110, flicker: 0.5 });
    }
    if (this.inTownWorld()) {
      lights.push({ x: this.town.spots.smith.x, y: this.town.spots.smith.y, radius: 110, flicker: 0.5 });
      lights.push({ x: this.town.spots.alchemist.x, y: this.town.spots.alchemist.y, radius: 110, flicker: 0.5 });
      lights.push({ x: this.town.spots.quests.x, y: this.town.spots.quests.y, radius: 95, flicker: 0.4 });
    }
    if (this.boss?.alive) {
      lights.push({ x: this.boss.x, y: this.boss.y, radius: 130, flicker: 1 });
    }
    this.lighting.render(ctx, VIEW.WIDTH, VIEW.HEIGHT, this.camX - offset.x, this.camY - offset.y, this.floor, lights);
  }

  /** World-space combat FX: projectiles in TileRenderer, booms/waves in Combat. */
  private renderCombatEffects(ctx: CanvasRenderingContext2D): void {
    this.tiles.drawProjectiles(ctx, this.projectiles);
    this.combat.renderEffects(ctx, this.gameTime);
  }

  protected onRenderUI(ctx: CanvasRenderingContext2D): void {
    this.hud.renderHud(ctx, {
      score: this.score,
      // In Lastlight the ledger shows the hero's banked treasury.
      goldBalance: this.inTownWorld()
        ? this.progression.character()?.gold ?? 0
        : this.goldBalance,
      floor: this.floor,
      hp: this.player.hp,
      maxHp: this.player.maxHp,
      daggers: this.player.daggers,
      keys: this.player.keys,
      combo: this.combo,
      comboTimer: this.comboTimer,
      dashFrac: this.player.dashCooldownFrac(),
      classId: this.chosenClass,
      abilityFrac: this.player.abilityCooldownFrac(),
      scrollId: this.player.scroll,
      heroLevel: this.progression.character()?.level ?? null,
      heroXpFrac: this.progression.xpFrac(),
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
      const price = this.hagglerPrice(this.activeShopItem.price);
      this.hud.renderShopItemPrompt(
        ctx,
        this.activeShopItem.product,
        price,
        this.goldBalance >= price,
        this.shopDeniedFlash,
      );
    }
    // v4 Wave B — town prompts + overlays (the town routes its own overlay).
    if (this.state === 'town') {
      const prompt = this.town.promptText();
      if (prompt) this.hud.renderShopPrompt(ctx, prompt, true, 0);
      this.town.renderOverlay(ctx, this.hud, this.progression.character());
    }
    if (this.state === 'victory' && this.activeQuest && this.victoryLedger) {
      this.hud.renderVictory(ctx, this.activeQuest.name, this.victoryLedger, this.victoryTimer);
    }
    if (this.state === 'interlude' && this.pendingInterlude) {
      this.hud.renderInterlude(ctx, this.pendingInterlude, this.interludeTimer);
    }
    if (this.bannerTimer > 0) this.hud.renderBanner(ctx, this.bannerText, this.bannerSub, this.bannerTimer);
    if (this.state === 'classSelect') {
      this.hud.renderClassSelect(
        ctx,
        ALL_CLASS_IDS,
        this.classIndex,
        'CHOOSE YOUR HERO',
        'your heroes persist and grow · ← → · SPACE · 1-4',
        id => {
          const hero = this.progression.heroFor(id);
          return hero ? { name: hero.name, level: hero.level } : null;
        },
      );
    }
    if (this.state === 'relic') {
      this.hud.renderRelicDraft(ctx, this.relicChoices, this.relicIndex, id => this.player.relicCount(id));
    }
    if (this.state === 'levelUp') {
      this.hud.renderBoonDraft(
        ctx,
        this.boonChoices,
        this.boonIndex,
        id => this.player.boonCount(id),
        (this.progression.character()?.level ?? 1) + 1,
      );
    }
    if (this.state === 'recap' && this.recapStats) {
      this.hud.renderRecap(ctx, {
        stats: this.recapStats,
        sessionXp: this.progression.sessionXp,
        score: this.score,
        timer: this.recapTimer,
        retired: this.recapRetired,
        hasHero: this.progression.hasCharacter(),
        retireHold: this.retireHold,
      });
    }
  }
}
