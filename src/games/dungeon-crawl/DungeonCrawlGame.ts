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
  JUICE,
  OVERLAY,
  PALETTE,
  PICKUPS,
  PLAYER,
  SHOP,
  TILE,
  VIEW,
} from './data/constants';
import { BOON_TUNING } from './data/boons';
import { ALL_CLASS_IDS, CLASSES, ClassId } from './data/classes';
import { ALL_LINEAGE_IDS, LINEAGES } from './data/lineages';
import { BOSS } from './data/enemies';
import { PROGRESSION } from './data/progression';
import { bossKitById } from './data/bosses';
import { QuestDef } from './data/quests';
import { ALL_RELIC_IDS, RELIC_TUNING, RelicId } from './data/relics';
import { SCROLLS, ScrollId } from './data/scrolls';
import { bossItemWeights, ITEM_TUNING, rollItemDrop } from './data/items';
import { SPELLS, SpellId } from './data/spells';
import { STAT_TUNING } from './data/stats';
import { DraftFlow } from './progression/DraftFlow';
import { ProgressionController } from './progression/ProgressionController';
import { QuestDirector } from './progression/QuestDirector';
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
import { Juice } from './systems/Juice';
import { Lighting } from './systems/Lighting';
import { Minimap } from './systems/Minimap';
import { Inventory } from './systems/Inventory';
import { ParticleSystem } from './systems/ParticleSystem';
import { PickupResolver } from './systems/PickupResolver';
import { ScreenShake } from './systems/ScreenShake';
import { SecretRooms } from './systems/SecretRooms';
import { HudRenderer, RecapStats } from './rendering/HudRenderer';
import { gatherLights } from './rendering/lights';
import { TileRenderer } from './rendering/TileRenderer';

type GameState =
  | 'title'
  | 'classSelect'
  | 'lineageSelect'
  | 'town'
  | 'playing'
  | 'relic'
  | 'levelUp'
  | 'victory'
  | 'interlude'
  | 'sheet'
  | 'inventory'
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
  private juice = new Juice();
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
    juice: this.juice,
    addEnemy: enemy => this.enemies.push(enemy),
    addPickup: pickup => this.pickupItems.push(pickup),
    addProjectile: projectile => this.projectiles.push(projectile),
    findOpenSpotNear: (x, y) =>
      this.map.findOpenSpotNear(x, y) ?? { x: this.player.x, y: this.player.y },
    hazards: () => this.hazards,
    showBanner: (text, sub) => this.showBanner(text, sub),
    grantRelic: id => this.pickupResolver.grantRelic(id),
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

  // v5 Wave F — floor-loot resolution (collect switch, relics, keyed doors);
  // mechanics live there, counters/metrics stay here in the callbacks.
  private pickupResolver = new PickupResolver({
    player: () => this.player,
    rng: () => this.rng,
    map: () => this.map,
    particles: this.particles,
    playSound: (name, volume) => this.services?.audio?.playSound?.(name, { volume }),
    showBanner: (text, sub) => this.showBanner(text, sub),
    shake: amount => this.shake.add(amount),
    collectScroll: pickup => this.combat.collectScroll(pickup),
    collectItem: pickup => {
      // Full satchel leaves the find lying (the scroll precedent).
      if (pickup.itemId && !this.inventory.tryCollect(pickup.itemId)) pickup.alive = true;
    },
    onGold: () => {
      this.goldCollected++;
      this.goldBalance++;
      this.pickups += PICKUPS.GOLD_VALUE;
      this.score += PICKUPS.GOLD_SCORE;
      this.trackStat('gold_collected', this.goldCollected);
    },
    onPotionUsed: () => {
      this.potionsUsed++;
    },
    onKeyUsed: () => {
      this.keysUsed++;
      // v5 Wave F — the vault sometimes hides a keepable find.
      if (this.rng.chance(ITEM_TUNING.TREASURE_DROP_CHANCE)) {
        const room = this.plan.rooms.find(r => r.kind === 'treasure');
        if (room) this.dropItemInRoom(room, ITEM_TUNING.TREASURE_WEIGHTS);
      }
    },
    onRelicCollected: () => {
      this.relicsCollected++;
      this.trackStat('relics_collected', this.relicsCollected);
    },
  });

  // v5 Wave F — the found-equipment satchel/worn set behind its own host.
  private inventory = new Inventory({
    hero: () => this.progression.character(),
    inTown: () => this.inTownWorld(),
    save: () => this.progression.saveCheckpoint(),
    playSound: (name, volume) => this.services?.audio?.playSound?.(name, { volume }),
    showBanner: (text, sub) => this.showBanner(text, sub),
    refreshFolds: () => this.refreshItemFolds(),
    onItemFound: () => {
      this.itemsFound++;
      this.trackStat('items_found', this.itemsFound);
    },
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
    onSecretFound: room => {
      this.secretsFound++;
      this.trackStat('secrets_found', this.secretsFound);
      // v5 Wave F — some hoards hide a keepable find.
      if (this.rng.chance(ITEM_TUNING.SECRET_DROP_CHANCE)) {
        this.dropItemInRoom(room, ITEM_TUNING.TREASURE_WEIGHTS);
      }
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
  // v5 Wave F
  private itemsFound = 0;

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
  // v4 — the persistent hero + retire affordance.
  private progression = new ProgressionController();
  // v5 Wave E — class + level-up drafts (extracted); the host closes over
  // live run state (rng is reassigned per expedition).
  private draftFlow = new DraftFlow({
    input: () => this.services?.input,
    rng: () => this.rng,
    floor: () => this.floor,
    progression: () => this.progression,
    player: () => this.player,
    particles: () => this.particles,
    confirmWas: () => this.confirmWas,
    draftNav: (index, count) => this.draftNav(index, count),
    playSound: (name, volume) => this.services?.audio?.playSound?.(name, { volume }),
    showBanner: (text, sub) => this.showBanner(text, sub),
    trackStat: (key, value) => this.trackStat(key, value),
    setChosenClass: id => {
      this.chosenClass = id;
    },
    setActiveSpellIndex: index => {
      this.activeSpellIndex = index;
    },
    refreshStatMods: () => this.refreshItemFolds(),
    flashLight: (x, y) =>
      this.juice.flashLight(x, y, JUICE.FLASH_LEVEL_UP_RADIUS, JUICE.FLASH_LEVEL_UP_LIFE),
  });
  private retireHold = 0;
  private recapRetired = false;
  // v4 Wave B — Lastlight + quest expeditions. v5 Wave G: the expedition
  // lifecycle (depart/victory/interlude) lives in QuestDirector; the session
  // counters stay here in the host callbacks.
  private town = new TownController();
  private quests = new QuestDirector({
    input: () => this.services?.input,
    confirmWas: () => this.confirmWas,
    rng: () => this.rng,
    progression: () => this.progression,
    player: () => this.player,
    inventory: () => this.inventory,
    goldBalance: () => this.goldBalance,
    resetExpedition: () => this.resetExpedition(),
    loadFloor: () => this.loadFloor(),
    enterTownWorld: () => this.enterTownWorld(),
    openBoonDraft: returnTo =>
      this.progression.pendingLevelUp() ? this.draftFlow.openBoonDraft(returnTo) : null,
    refreshItemFolds: () => this.refreshItemFolds(),
    showBanner: (text, sub) => this.showBanner(text, sub),
    playSound: (name, volume) => this.services?.audio?.playSound?.(name, { volume }),
    triggerStinger: name => this.services?.audio?.triggerMusicStinger?.(name),
    shake: amount => this.shake.add(amount),
    trackStat: (key, value) => this.trackStat(key, value),
    onQuestBanked: banked => {
      this.questsCompleted++;
      this.goldBanked += banked;
      this.trackStat('quests_completed', this.questsCompleted);
      this.trackStat('gold_banked', this.goldBanked);
    },
    onSagaCompleted: () => {
      this.sagasCompleted++;
      this.trackStat('sagas_completed', this.sagasCompleted);
    },
  });
  private questsCompleted = 0;
  private goldBanked = 0;
  private sagasCompleted = 0;
  private secretsFound = 0;
  private nestsCleared = 0;
  private spellsCast = 0;
  private activeSpellIndex = 0;
  private sheetReturn: 'playing' | 'town' = 'playing';
  private inventoryReturn: 'playing' | 'town' = 'playing';
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
  private spellWas = false;
  private spellCycleWas = false;
  private sheetWas = false;
  private invWas = false;

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
    this.itemsFound = 0;
    this.inventory.reset();
    this.combo = 1;
    this.killChain = 0;
    this.comboTimer = 0;
    this.chosenClass = null;
    this.draftFlow.reset();
    this.recapStats = null;
    this.player.reset(0, 0);
    this.shake.reset();
    this.particles.clear();
    this.juice.reset();
    this.musicIntensity = -1;

    // v4.1 — the roster: each class keeps its own persistent hero. Wave I —
    // every session now opens on the TITLE PAGE; Lastlight glows behind it
    // and behind the roster overlay that follows.
    this.progression.load();
    this.progression.resetSessionCounters();
    this.retireHold = 0;
    this.recapRetired = false;
    this.quests.reset();
    this.questsCompleted = 0;
    this.goldBanked = 0;
    this.sagasCompleted = 0;
    this.secretsFound = 0;
    this.nestsCleared = 0;
    this.spellsCast = 0;
    this.activeSpellIndex = 0;
    this.state = 'title';

    this.enterTownWorld();
    this.syncExtendedData();
  }

  /** v4 Wave B — swap the live world for Lastlight (state set by callers). */
  private enterTownWorld(): void {
    this.town.reset();
    this.quests.clearQuest();
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
    this.juice.reset();
    this.juice.startCurtain(); // Wave K — Lastlight fades in
    this.musicIntensity = 0.45;
    this.services?.audio?.setMusicIntensity?.(0.45);
  }

  /** Whether the live world is Lastlight (for draws + HUD gold source). */
  private inTownWorld(): boolean {
    return (
      this.state === 'town' ||
      this.state === 'victory' ||
      this.state === 'interlude' ||
      this.state === 'title' ||
      this.state === 'classSelect' ||
      this.state === 'lineageSelect' ||
      (this.state === 'levelUp' && this.draftFlow.returnState === 'town') ||
      (this.state === 'inventory' && this.inventoryReturn === 'town') ||
      (this.state === 'sheet' && this.sheetReturn === 'town')
    );
  }

  private loadFloor(): void {
    // v4 Wave B — quest shape: fixed biome, boss ONLY on the final floor.
    const quest = this.quests.activeQuest;
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
    this.player.rechargeStoneSense(); // Wave I — a new floor, a fresh warning
    this.minimap.resetFor(this.map);
    this.visitedRooms.clear();
    this.damageTakenThisFloor = false;
    this.particles.clear();
    this.juice.reset();
    this.juice.startCurtain(); // Wave K — the new floor fades in under its banner

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
    this.juice.update(dt); // real dt — freezes thaw in real time
    if (this.bannerTimer > 0) this.bannerTimer = Math.max(0, this.bannerTimer - dt);
    if (this.shopDeniedFlash > 0) this.shopDeniedFlash = Math.max(0, this.shopDeniedFlash - dt);

    // v4 Wave D — Tab flips the character sheet open from play or town (and
    // closed again); the world holds its breath underneath.
    const tabDown = this.services?.input?.isKeyPressed('Tab') ?? false;
    if (tabDown && !this.sheetWas && this.progression.hasCharacter()) {
      if (this.state === 'playing' || this.state === 'town') {
        this.sheetReturn = this.state;
        this.state = 'sheet';
        this.services?.audio?.playSound?.('click', { volume: 0.4 });
      } else if (this.state === 'sheet') {
        this.state = this.sheetReturn;
        this.services?.audio?.playSound?.('click', { volume: 0.35 });
      }
    }

    // v5 Wave F — I flips the pack open the same way (world frozen beneath).
    const invDown = this.services?.input?.isKeyPressed('KeyI') ?? false;
    if (invDown && !this.invWas && this.progression.hasCharacter()) {
      if (this.state === 'playing' || this.state === 'town') {
        this.inventoryReturn = this.state;
        this.state = 'inventory';
        this.services?.audio?.playSound?.('click', { volume: 0.4 });
      } else if (this.state === 'inventory') {
        this.state = this.inventoryReturn;
        this.services?.audio?.playSound?.('click', { volume: 0.35 });
      }
    }

    switch (this.state) {
      case 'title': {
        // Wave I — the opening page: any confirm turns it.
        const input = this.services?.input;
        const confirm =
          input?.isKeyPressed('Space') || input?.isKeyPressed('Enter') || input?.isKeyPressed('KeyJ');
        if (confirm && !this.confirmWas) {
          this.state = 'classSelect';
          this.services?.audio?.playSound?.('success', { volume: 0.5 });
        }
        break;
      }
      case 'classSelect': {
        const next = this.draftFlow.updateClassSelect();
        if (next) this.state = next;
        break;
      }
      case 'lineageSelect': {
        const next = this.draftFlow.updateLineageSelect();
        if (next) this.state = next;
        break;
      }
      case 'town':
        this.updateTown(dt);
        break;
      case 'playing':
        // Wave K — hit-stop freezes ONLY the sim; view systems above ride real dt.
        this.updatePlaying(this.juice.simDt(dt));
        break;
      case 'sheet':
        break; // frozen under the character sheet
      case 'inventory':
        this.inventory.update(this.services?.input, {
          navUpWas: this.navUpWas,
          navDownWas: this.navDownWas,
          confirmWas: this.confirmWas,
        });
        break;
      case 'relic':
        this.updateRelicChoice();
        break;
      case 'levelUp': {
        const next = this.draftFlow.updateBoonChoice();
        if (next) this.state = next;
        break;
      }
      case 'victory': {
        const next = this.quests.updateVictory(dt);
        if (next) this.state = next;
        break;
      }
      case 'interlude': {
        const next = this.quests.updateInterlude(dt);
        if (next) this.state = next;
        break;
      }
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
    this.spellWas = input.isKeyPressed('KeyV');
    this.spellCycleWas = input.isKeyPressed('KeyG');
    this.sheetWas = input.isKeyPressed('Tab');
    this.invWas = input.isKeyPressed('KeyI');
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
      pickRumor: pool => this.rng.pick(pool),
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

  /** Set out from the gate (thin delegate — QuestDirector owns the flow). */
  private departOnQuest(quest: QuestDef): void {
    this.state = this.quests.depart(quest);
  }

  /** The final boss fell and the stairs were taken: the quest is won. */
  private openVictory(): void {
    this.state = this.quests.openVictory();
  }

  /** Expedition-scoped resets (session metrics keep accumulating). */
  private resetExpedition(): void {
    this.floor = 1;
    this.combo = 1;
    this.killChain = 0;
    this.comboTimer = 0;
    this.goldBalance = 0;
    this.runSeed = (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0;
    this.rng = new Rng(this.runSeed ^ 0x51ed270b);
  }

  // ------------------------------------------------------------ v4 level-ups

  /** Open the level-up draft (DraftFlow owns it; null = auto-leveled). */
  private openBoonDraft(returnTo: 'playing' | 'town' = 'playing'): void {
    const next = this.draftFlow.openBoonDraft(returnTo);
    if (next) this.state = next;
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
      this.combat.castAbility(this.player.kit.abilityId);
    }

    // v3 wave 3 — read the held scroll (F / O).
    const scrollDown = input ? input.isKeyPressed('KeyF') || input.isKeyPressed('KeyO') : false;
    if (scrollDown && !this.scrollWas && this.player.scroll) {
      this.castScroll(this.player.scroll);
      this.player.scroll = null;
      this.scrollsUsed++;
      this.trackStat('scrolls_used', this.scrollsUsed);
    }

    // v4 Wave D — the grimoire: V casts the active spell, G readies the next.
    if ((input?.isKeyPressed('KeyV') ?? false) && !this.spellWas) this.castActiveSpell();
    if ((input?.isKeyPressed('KeyG') ?? false) && !this.spellCycleWas) this.cycleActiveSpell();

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
      fireBolt: (x, y, dirX, dirY, speed, cause) => {
        const bolt = new Projectile('bolt', x, y, dirX * speed, dirY * speed, 1);
        bolt.cause = cause;
        this.projectiles.push(bolt);
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
        const target = this.combat.nearestEnemyTo(proj.x, proj.y);
        proj.update(dt, this.map, target?.x, target?.y);
      } else {
        proj.update(dt, this.map, this.player.x, this.player.y);
      }
      if (!proj.alive) continue;
      if (proj.kind === 'bolt') {
        const reach = proj.radius + this.player.size / 2;
        if (Math.hypot(proj.x - this.player.x, proj.y - this.player.y) < reach) {
          proj.alive = false;
          this.damagePlayer(
            proj.damage,
            proj.cause ?? (this.boss?.alive ? 'boss_bolt' : 'sorcerer_bolt'),
          );
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
    this.combat.updateHazards(dt);

    // --- Pickups.
    for (const pickup of this.pickupItems) {
      pickup.update(dt, this.player.x, this.player.y, this.player.hasCoinMagnet());
      const reach = pickup.collectRadius + this.player.size / 2;
      if (Math.hypot(pickup.x - this.player.x, pickup.y - this.player.y) < reach) {
        this.pickupResolver.collectPickup(pickup);
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
    this.pickupResolver.tryOpenDoors();
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

  // ------------------------------------------------------------ v4 the grimoire

  /** The hero's readied spell (null before any is learned). */
  private activeSpell(): SpellId | null {
    const spells = this.progression.character()?.spells;
    if (!spells || spells.length === 0) return null;
    return spells[this.activeSpellIndex % spells.length];
  }

  private castActiveSpell(): void {
    const id = this.activeSpell();
    if (!id) return;
    if (this.player.spellCooldown(id) > 0) {
      this.services?.audio?.playSound?.('error', { volume: 0.3 });
      return;
    }
    this.player.startSpellCooldown(id, SPELLS[id].cooldown);
    this.combat.castSpell(id, this.scholarMult());
    this.spellsCast++;
    this.trackStat('spells_cast', this.spellsCast);
  }

  private cycleActiveSpell(): void {
    const spells = this.progression.character()?.spells;
    if (!spells || spells.length < 2) return;
    this.activeSpellIndex = (this.activeSpellIndex + 1) % spells.length;
    this.services?.audio?.playSound?.('click', { volume: 0.35 });
    this.showBanner(SPELLS[spells[this.activeSpellIndex]].name, 'READIED — V TO CAST');
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

    // Purchase (product effects resolve in Combat).
    this.goldBalance -= price;
    this.goldSpent += price;
    this.itemsBought++;
    best.sold = true;
    this.combat.applyShopPurchase(best.product);
    if (best.product === 'potion') this.potionsUsed++;
    this.services?.audio?.playSound?.('success', { volume: 0.5 });
    this.particles.burst(best.x, best.y, PALETTE.gold, 12, 100, 0.6);
    this.trackStat('items_bought', this.itemsBought);
    this.trackStat('gold_spent', this.goldSpent);
  }

  /** v5 Wave F — re-fold worn equipment + effective scores into the player. */
  private refreshItemFolds(): void {
    this.player.applyEquipment(this.inventory.mergedEffects());
    this.player.setStatMods(this.progression.equippedStatDeltas(this.inventory.equippedIds()));
  }

  /** v5 Wave F — drop a rolled find at a room's center (live rng only). */
  private dropItemInRoom(
    room: { tx: number; ty: number; w: number; h: number },
    weights: Parameters<typeof rollItemDrop>[1],
  ): void {
    const center = this.map.tileCenter(
      room.tx + Math.floor(room.w / 2),
      room.ty + Math.floor(room.h / 2),
    );
    this.pickupItems.push(new Pickup('item', center.x, center.y, rollItemDrop(this.rng, weights)));
  }

  /** v4 — Haggler training (+ v5 Presence) talks merchants down, never below 1 gold. */
  private hagglerPrice(base: number): number {
    const discount =
      this.player.boonCount('haggler') * BOON_TUNING.HAGGLER_DISCOUNT +
      this.player.statMods.cha * STAT_TUNING.CHA_SHOP_DISCOUNT;
    if (discount === 0) return base;
    return Math.max(1, Math.round(base * (1 - discount)));
  }

  /** v4 — Scholar training deepens scroll magic where it sensibly can. */
  private scholarMult(): number {
    return this.player.boonCount('scholar') > 0 ? BOON_TUNING.SCHOLAR_MULT : 1;
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
      // v5 Wave F — elites sometimes carry a find worth keeping.
      if (this.rng.chance(ITEM_TUNING.ELITE_DROP_CHANCE)) {
        this.pickupItems.push(
          new Pickup('item', enemy.x, enemy.y, rollItemDrop(this.rng, ITEM_TUNING.ELITE_WEIGHTS)),
        );
      }
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

    // v5 Wave F — a Guardian always yields a find; deeper tiers pay rarer.
    const quest = this.quests.activeQuest;
    const tier =
      quest && quest.bossTier > 0 ? quest.bossTier : Math.max(1, Math.floor(this.floor / 3));
    this.pickupItems.push(
      new Pickup('item', boss.x, boss.y, rollItemDrop(this.rng, bossItemWeights(tier))),
    );

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
    // Wave I — STONE-SENSE: the rock warns a dwarf of the first trap each
    // floor (deterministic, so it fires before any dodge roll).
    if (cause === 'hazard' && this.player.tryConsumeStoneSense()) {
      this.services?.audio?.playSound?.('collision', { volume: 0.25 });
      this.particles.burst(this.player.x, this.player.y, '#9aa0a8', 10, 90, 0.4);
      return;
    }
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
    this.shake.kick(0, 1, JUICE.KICK_HURT); // Wave K — the hit jolts downward
    this.juice.hitStop(JUICE.HITSTOP_PLAYER_HURT); // Wave K — the blow lands heavy
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
      // Wave I — a halfling's luck gets the last word (after magic and grit).
      if (this.player.tryConsumeLuck()) {
        this.shake.add(0.6);
        this.services?.audio?.playSound?.('extraLife', { volume: 0.7 });
        this.particles.burst(this.player.x, this.player.y, '#d8c96a', 26, 180, 0.8);
        this.showBanner("LUCK'S LAST WORD", 'THE BLOW MISSES — ONCE');
        return;
      }
      this.openRecap(cause);
    }
  }

  // ------------------------------------------------------------ pickups + world

  /** v4 Wave C — a player blast breaks a cracked wall open (Combat calls in). */
  private crackWall(tx: number, ty: number): void {
    if (this.map.get(tx, ty) !== Tile.CrackedWall) return;
    this.map.set(tx, ty, Tile.Floor);
    const center = this.map.tileCenter(tx, ty);
    this.particles.burst(center.x, center.y, this.biome.wallFace, 14, 120, 0.6);
    this.particles.burst(center.x, center.y, this.biome.floorCrack, 8, 80, 0.5);
    this.shake.add(0.2);
    this.juice.flashLight(center.x, center.y, JUICE.FLASH_SPELL_RADIUS, JUICE.FLASH_SPELL_LIFE);
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
      const quest = this.quests.activeQuest;
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
      this.pickupResolver.grantRelic(this.relicChoices[this.relicIndex]);
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
      // v5 Wave F — run finds that died unbanked.
      itemsLost: this.inventory.lostCount(this.progression.character()),
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
      // v4 Wave D — the grimoire.
      spells_learned: this.progression.sessionSpellsLearned,
      spells_cast: this.spellsCast,
      // v5 Wave F — vaults & reliquaries.
      items_found: this.itemsFound,
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
      // Lastlight's fixtures: smith (soot-brown), alchemist (violet), board,
      // and (v5 Wave G) the keeper of THE LAST LANTERN at the inn door.
      this.tiles.drawMerchant(ctx, this.town.spots.smith.x, this.town.spots.smith.y, this.gameTime, '#5a3a22', '#3a2414');
      this.tiles.drawMerchant(ctx, this.town.spots.alchemist.x, this.town.spots.alchemist.y, this.gameTime);
      this.tiles.drawMerchant(ctx, this.town.spots.inn.x, this.town.spots.inn.y, this.gameTime, '#7a5a30', '#4a3418');
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

    // Darkness + torchlight (screen space); gathering lives in rendering/lights.
    const lights = gatherLights({
      player: this.player,
      torches: this.plan.torches,
      enemies: this.enemies,
      stairsLocked: this.stairsLocked,
      stairsCenter: this.map.tileCenter(this.plan.stairsTile.tx, this.plan.stairsTile.ty),
      merchant: this.merchant,
      townSpots: this.inTownWorld() ? this.town.spots : null,
      boss: this.boss,
    });
    lights.push(...this.juice.lights()); // Wave K — explosion/spell flash-lights
    this.lighting.render(ctx, VIEW.WIDTH, VIEW.HEIGHT, this.camX - offset.x, this.camY - offset.y, this.floor, lights);
  }

  /** World-space combat FX: projectiles in TileRenderer, booms/waves in Combat. */
  private renderCombatEffects(ctx: CanvasRenderingContext2D): void {
    this.tiles.drawProjectiles(ctx, this.projectiles);
    this.combat.renderEffects(ctx, this.gameTime);
  }

  protected onRenderUI(ctx: CanvasRenderingContext2D): void {
    // Wave K — floor-entry curtain: the world fades in under the HUD chrome.
    const curtain = this.juice.curtainAlpha();
    if (curtain > 0) {
      ctx.fillStyle = `rgba(2, 1, 4, ${curtain.toFixed(3)})`;
      ctx.fillRect(0, 0, VIEW.WIDTH, VIEW.HEIGHT);
    }
    const readiedSpell = this.activeSpell();
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
      spellId: readiedSpell,
      spellFrac: readiedSpell
        ? this.player.spellCooldown(readiedSpell) /
          this.player.spellCooldownFull(SPELLS[readiedSpell].cooldown)
        : 0,
      spellCount: this.progression.character()?.spells.length ?? 0,
      heroLevel: this.progression.character()?.level ?? null,
      heroXpFrac: this.progression.xpFrac(),
      buffs: this.player.buffs,
      relics: this.player.relics,
      itemCount: this.inventory.satchel.length,
      hurtFlash: this.player.hitFlash,
      gameTime: this.gameTime,
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
      this.hud.renderBossBar(
        ctx,
        this.boss.kit.name,
        this.boss.hp,
        this.boss.maxHp,
        this.boss.enraged,
        this.boss.flash,
        this.boss.enrageFlash,
      );
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
    if (this.state === 'victory' && this.quests.activeQuest && this.quests.victoryLedger) {
      this.hud.renderVictory(
        ctx,
        this.quests.activeQuest.name,
        this.quests.victoryLedger,
        this.quests.victoryTimer,
      );
    }
    if (this.state === 'interlude' && this.quests.pendingInterlude) {
      this.hud.renderInterlude(ctx, this.quests.pendingInterlude, this.quests.interludeTimer);
    }
    if (this.state === 'sheet') {
      const hero = this.progression.character();
      if (hero) {
        this.hud.renderCharacterSheet(ctx, hero, this.activeSpell(), this.progression.xpFrac());
      }
    }
    if (this.state === 'inventory') {
      this.hud.renderInventory(ctx, {
        equipped: this.inventory.wornMap(),
        list: this.inventory.browseList(),
        index: this.inventory.index,
        inTown: this.inTownWorld(),
        satchelCount: this.inventory.satchel.length,
      });
    }
    if (this.bannerTimer > 0) this.hud.renderBanner(ctx, this.bannerText, this.bannerSub, this.bannerTimer);
    if (this.state === 'title') {
      this.hud.renderTitle(ctx, this.gameTime);
    }
    if (this.state === 'classSelect') {
      this.hud.renderClassSelect(
        ctx,
        ALL_CLASS_IDS,
        this.draftFlow.classIndex,
        'CHOOSE YOUR HERO',
        'your heroes persist and grow · ← → · SPACE · 1-4',
        id => {
          const hero = this.progression.heroFor(id);
          return hero
            ? { name: hero.name, level: hero.level, lineage: LINEAGES[hero.lineage].name }
            : null;
        },
      );
    }
    if (this.state === 'lineageSelect' && this.draftFlow.pendingClass) {
      this.hud.renderLineageSelect(
        ctx,
        ALL_LINEAGE_IDS,
        this.draftFlow.lineageIndex,
        CLASSES[this.draftFlow.pendingClass].name,
      );
    }
    if (this.state === 'relic') {
      this.hud.renderRelicDraft(ctx, this.relicChoices, this.relicIndex, id => this.player.relicCount(id));
    }
    if (this.state === 'levelUp') {
      this.hud.renderBoonDraft(
        ctx,
        this.draftFlow.choices,
        this.draftFlow.index,
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
