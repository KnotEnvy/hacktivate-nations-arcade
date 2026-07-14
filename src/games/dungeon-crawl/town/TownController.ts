// ===== src/games/dungeon-crawl/town/TownController.ts =====
// v4 Wave B — LASTLIGHT, the last safe light above the depths. Builds the
// hand-authored town map (a synthetic FloorPlan the game loads like any
// floor), and owns everything that happens there: walking, the proximity
// prompts, and the three overlays (quest board / blacksmith / alchemist).
// All purchases spend the hero's BANKED gold and save through the host.
// Reaches the game only through the narrow TownCtx.

import { SoundName } from '@/services/AudioManager';
import { BiomePalette } from '../data/constants';
import { ALL_GEAR_IDS, ALL_PROVISION_IDS, GEAR, GEAR_TUNING, PROVISIONS } from '../data/gear';
import { ALL_NPC_IDS, NPCS, storyStage } from '../data/npcs';
import { QUESTS, QuestDef, STANDALONE_QUEST_IDS } from '../data/quests';
import { currentChapter, SAGAS, visibleSagaIds } from '../data/sagas';
import { FloorPlan } from '../dungeon/DungeonGenerator';
import { Tile, TileMap } from '../dungeon/TileMap';
import { Player } from '../entities/Player';
import { SavedHero } from '../persistence/CharacterStore';
import type { HudRenderer } from '../rendering/HudRenderer';

/** Warm lamplit palette — the town is night-dark but never hostile. */
export const TOWN_PALETTE: BiomePalette = {
  id: 'town',
  floorA: '#33291f',
  floorB: '#2e251b',
  floorCrack: '#241c14',
  wallTop: '#5a4632',
  wallFace: '#443525',
  wallEdge: '#1a130c',
  flameOuter: '#ffb84d',
  flameInner: '#ffe8b0',
  hazardStyle: 'vent',
};

export type TownOverlay = 'none' | 'quests' | 'smith' | 'alchemist' | 'inn';
type TownStation = Exclude<TownOverlay, 'none'> | 'gate';

export interface TownInput {
  isKeyPressed(code: string): boolean;
  isLeftPressed(): boolean;
  isRightPressed(): boolean;
  isUpPressed(): boolean;
  isDownPressed(): boolean;
}

export interface TownCtx {
  dt: number;
  input: TownInput | undefined;
  edges: {
    interactWas: boolean;
    confirmWas: boolean;
    navLeftWas: boolean;
    navRightWas: boolean;
    navUpWas: boolean;
    navDownWas: boolean;
  };
  player: Player;
  hero: SavedHero | null;
  save(): void;
  playSound(name: SoundName, volume: number): void;
  showBanner(text: string, sub: string): void;
  depart(quest: QuestDef): void;
  /** v5 Wave G — one line of bar talk from a pool (the game's live rng). */
  pickRumor(pool: readonly string[]): string;
}

const INTERACT_RADIUS = 34;

export class TownController {
  readonly plan: FloorPlan;
  readonly spots: Record<TownStation, { x: number; y: number }>;
  overlay: TownOverlay = 'none';
  selection = 0;
  /** v4 Wave C — the board carries two pages: contracts and sagas. */
  boardPage: 'quests' | 'sagas' = 'quests';
  /** v5 Wave G — the line currently being told across the bar. */
  innRumor = '';
  private nearStation: TownStation | null = null;

  constructor() {
    const built = buildTown();
    this.plan = built.plan;
    this.spots = built.spots;
  }

  /** Fresh arrival (session start / return from an expedition). */
  reset(): void {
    this.overlay = 'none';
    this.selection = 0;
    this.boardPage = 'quests';
    this.innRumor = '';
    this.nearStation = null;
  }

  /** The proximity prompt, or null when nothing is in reach. */
  promptText(): string | null {
    if (this.overlay !== 'none') return null;
    switch (this.nearStation) {
      case 'quests':
        return 'QUEST BOARD — press E';
      case 'smith':
        return 'BLACKSMITH — press E';
      case 'alchemist':
        return 'ALCHEMIST — press E';
      case 'inn':
        return 'THE LAST LANTERN — press E';
      case 'gate':
        return 'THE DEPTHS GATE — press E to choose a quest';
      default:
        return null;
    }
  }

  update(ctx: TownCtx): void {
    if (this.overlay === 'none') {
      this.updateWalking(ctx);
    } else if (this.overlay === 'quests') {
      this.updateQuestBoard(ctx);
    } else if (this.overlay === 'inn') {
      this.updateInn(ctx);
    } else {
      this.updateShop(ctx, this.overlay);
    }
  }

  // ---------------------------------------------------------------- walking

  private updateWalking(ctx: TownCtx): void {
    const { input, player } = ctx;
    let moveX = 0;
    let moveY = 0;
    if (input) {
      if (input.isLeftPressed()) moveX -= 1;
      if (input.isRightPressed()) moveX += 1;
      if (input.isUpPressed()) moveY -= 1;
      if (input.isDownPressed()) moveY += 1;
    }
    player.update(ctx.dt, moveX, moveY, this.plan.map);

    // Nearest station in reach.
    this.nearStation = null;
    let best = INTERACT_RADIUS;
    for (const station of Object.keys(this.spots) as TownStation[]) {
      const spot = this.spots[station];
      const dist = Math.hypot(spot.x - player.x, spot.y - player.y);
      if (dist < best) {
        best = dist;
        this.nearStation = station;
      }
    }

    const interactDown = input?.isKeyPressed('KeyE') ?? false;
    if (!interactDown || ctx.edges.interactWas || !this.nearStation) return;

    this.selection = 0;
    this.boardPage = 'quests';
    ctx.playSound('click', 0.4);
    // The gate and the board both open the quest list — confirming departs.
    this.overlay =
      this.nearStation === 'smith'
        ? 'smith'
        : this.nearStation === 'alchemist'
          ? 'alchemist'
          : this.nearStation === 'inn'
            ? 'inn'
            : 'quests';
    if (this.overlay === 'inn') this.rollRumor(ctx);
  }

  // ---------------------------------------------------------------- the inn

  /** v5 Wave G — bar talk: ←→ picks a patron, SPACE asks for another word. */
  private updateInn(ctx: TownCtx): void {
    const { input } = ctx;
    if (!input) return;
    const before = this.selection;
    this.navigate(ctx, ALL_NPC_IDS.length);
    if (this.selection !== before) this.rollRumor(ctx);

    if (this.closeRequested(ctx)) return;

    const confirm =
      input.isKeyPressed('Space') || input.isKeyPressed('Enter') || input.isKeyPressed('KeyJ');
    if (confirm && !ctx.edges.confirmWas) {
      this.rollRumor(ctx);
      ctx.playSound('click', 0.4);
    }
  }

  /** A fresh line from the selected patron's pool for the hero's story stage. */
  private rollRumor(ctx: TownCtx): void {
    const npc = NPCS[ALL_NPC_IDS[this.selection]];
    this.innRumor = ctx.pickRumor(npc.rumors[storyStage(ctx.hero)]);
  }

  // ---------------------------------------------------------------- quest board

  private updateQuestBoard(ctx: TownCtx): void {
    const { input } = ctx;
    if (!input) return;

    // v4 Wave C — Up/Down flips between the contracts page and the sagas page.
    const flip =
      (input.isUpPressed() && !ctx.edges.navUpWas) ||
      (input.isDownPressed() && !ctx.edges.navDownWas);
    if (flip) {
      this.boardPage = this.boardPage === 'quests' ? 'sagas' : 'quests';
      this.selection = 0;
      ctx.playSound('click', 0.35);
      return;
    }
    if (this.boardPage === 'sagas') {
      this.updateSagaBoard(ctx);
      return;
    }

    const count = STANDALONE_QUEST_IDS.length;
    this.navigate(ctx, count);

    if (this.closeRequested(ctx)) return;

    const confirm =
      input.isKeyPressed('Space') || input.isKeyPressed('Enter') || input.isKeyPressed('KeyJ');
    if (confirm && !ctx.edges.confirmWas) {
      const quest = QUESTS[STANDALONE_QUEST_IDS[this.selection]];
      this.departWithWarning(ctx, quest);
    }
  }

  /** v4 Wave C — sagas: confirm departs on the hero's CURRENT chapter. */
  private updateSagaBoard(ctx: TownCtx): void {
    const { input } = ctx;
    if (!input) return;
    // v5 Wave G — locked meta arcs stay off the board until earned.
    const visible = visibleSagaIds(ctx.hero?.sagas);
    this.navigate(ctx, visible.length);

    if (this.closeRequested(ctx)) return;

    const confirm =
      input.isKeyPressed('Space') || input.isKeyPressed('Enter') || input.isKeyPressed('KeyJ');
    if (!confirm || ctx.edges.confirmWas) return;
    const saga = SAGAS[visible[this.selection]];
    // A told saga's finale may be relived; progress never rewinds.
    const chapterId =
      currentChapter(ctx.hero?.sagas, saga.id) ?? saga.quests[saga.quests.length - 1];
    this.departWithWarning(ctx, QUESTS[chapterId]);
  }

  private departWithWarning(ctx: TownCtx, quest: QuestDef): void {
    const hero = ctx.hero;
    if (hero && quest.minLevel > hero.level) {
      ctx.showBanner('THE BOARD WARNS', `RECOMMENDED LEVEL ${quest.minLevel} — COURAGE OR FOLLY?`);
    }
    ctx.playSound('gate_open', 0.55);
    this.overlay = 'none';
    ctx.depart(quest);
  }

  // ---------------------------------------------------------------- shops

  private updateShop(ctx: TownCtx, which: 'smith' | 'alchemist'): void {
    const { input } = ctx;
    if (!input) return;
    const count = which === 'smith' ? ALL_GEAR_IDS.length : ALL_PROVISION_IDS.length;
    this.navigate(ctx, count);

    if (this.closeRequested(ctx)) return;

    const confirm =
      input.isKeyPressed('Space') || input.isKeyPressed('Enter') || input.isKeyPressed('KeyJ');
    if (!confirm || ctx.edges.confirmWas) return;
    const hero = ctx.hero;
    if (!hero) return;

    if (which === 'smith') {
      const gear = GEAR[ALL_GEAR_IDS[this.selection]];
      const tier = hero.gear[gear.id] ?? 0;
      if (tier >= GEAR_TUNING.MAX_TIER) {
        ctx.playSound('error', 0.35);
        ctx.showBanner(gear.name, 'FULLY FORGED — NOTHING MORE TO ADD');
        return;
      }
      const price = gear.prices[tier];
      if (hero.gold < price) {
        ctx.playSound('error', 0.4);
        return;
      }
      hero.gold -= price;
      hero.gear[gear.id] = tier + 1;
      ctx.save();
      ctx.playSound('success', 0.5);
      ctx.showBanner(gear.name, `TIER ${tier + 1} — WORN FROM THE NEXT EXPEDITION ON`);
    } else {
      const provision = PROVISIONS[ALL_PROVISION_IDS[this.selection]];
      if (hero.provisions.includes(provision.id)) {
        ctx.playSound('error', 0.35);
        ctx.showBanner(provision.name, 'ALREADY PACKED FOR THE ROAD');
        return;
      }
      if (hero.gold < provision.price) {
        ctx.playSound('error', 0.4);
        return;
      }
      hero.gold -= provision.price;
      hero.provisions.push(provision.id);
      ctx.save();
      ctx.playSound('success', 0.5);
      ctx.showBanner(provision.name, 'PACKED — APPLIED AT THE GATE');
    }
  }

  // ---------------------------------------------------------------- rendering

  /** v4 Wave C — the town routes its own overlay to the HUD's pure views. */
  renderOverlay(ctx: CanvasRenderingContext2D, hud: HudRenderer, hero: SavedHero | null): void {
    if (this.overlay === 'quests') {
      if (this.boardPage === 'sagas') {
        hud.renderSagaBoard(
          ctx,
          visibleSagaIds(hero?.sagas),
          hero?.sagas ?? {},
          this.selection,
          hero?.level ?? 1,
        );
      } else {
        hud.renderQuestBoard(ctx, STANDALONE_QUEST_IDS, this.selection, hero?.level ?? 1);
      }
    } else if (this.overlay === 'inn') {
      hud.renderInn(ctx, ALL_NPC_IDS, this.selection, this.innRumor);
    } else if (this.overlay === 'smith') {
      hud.renderSmith(ctx, ALL_GEAR_IDS, this.selection, id => hero?.gear[id] ?? 0, hero?.gold ?? 0);
    } else if (this.overlay === 'alchemist') {
      hud.renderAlchemist(
        ctx,
        ALL_PROVISION_IDS,
        this.selection,
        id => hero?.provisions.includes(id) ?? false,
        hero?.gold ?? 0,
      );
    }
  }

  // ---------------------------------------------------------------- shared

  private navigate(ctx: TownCtx, count: number): void {
    const input = ctx.input!;
    if (input.isLeftPressed() && !ctx.edges.navLeftWas) {
      this.selection = (this.selection + count - 1) % count;
      ctx.playSound('click', 0.3);
    }
    if (input.isRightPressed() && !ctx.edges.navRightWas) {
      this.selection = (this.selection + 1) % count;
      ctx.playSound('click', 0.3);
    }
    for (let i = 0; i < count; i++) {
      if (input.isKeyPressed(`Digit${i + 1}`)) this.selection = i;
    }
  }

  /** E closes any overlay (edge-detected). */
  private closeRequested(ctx: TownCtx): boolean {
    const interactDown = ctx.input?.isKeyPressed('KeyE') ?? false;
    if (interactDown && !ctx.edges.interactWas) {
      this.overlay = 'none';
      ctx.playSound('click', 0.35);
      return true;
    }
    return false;
  }
}

// ------------------------------------------------------------------ builder

function buildTown(): {
  plan: FloorPlan;
  spots: Record<TownStation, { x: number; y: number }>;
} {
  const cols = 26;
  const rows = 18;
  const map = new TileMap(cols, rows);

  // Open square ringed by walls.
  for (let ty = 1; ty < rows - 1; ty++) {
    for (let tx = 1; tx < cols - 1; tx++) {
      map.set(tx, ty, Tile.Floor);
    }
  }
  for (let tx = 0; tx < cols; tx++) {
    map.set(tx, 0, Tile.Wall);
    map.set(tx, rows - 1, Tile.Wall);
  }
  for (let ty = 0; ty < rows; ty++) {
    map.set(0, ty, Tile.Wall);
    map.set(cols - 1, ty, Tile.Wall);
  }

  // The Inn — a solid little building with a south door (set dressing).
  for (let ty = 2; ty <= 5; ty++) {
    for (let tx = 2; tx <= 8; tx++) {
      map.set(tx, ty, Tile.Wall);
    }
  }
  map.set(5, 5, Tile.Door);

  // The gate down to the depths.
  const gateTile = { tx: 13, ty: 15 };
  map.set(gateTile.tx, gateTile.ty, Tile.Stairs);

  const torches: Array<{ tx: number; ty: number }> = [
    { tx: 11, ty: 0 },
    { tx: 15, ty: 0 },
    { tx: 3, ty: 6 },
    { tx: 7, ty: 6 },
    { tx: 0, ty: 11 },
    { tx: 25, ty: 8 },
    { tx: 12, ty: 17 },
    { tx: 14, ty: 17 },
  ];
  for (const torch of torches) map.set(torch.tx, torch.ty, Tile.TorchWall);

  const center = (tx: number, ty: number) => map.tileCenter(tx, ty);
  const spots = {
    quests: center(13, 4),
    smith: center(20, 8),
    alchemist: center(6, 11),
    // v5 Wave G — the keeper stands before the inn's south door.
    inn: center(5, 6),
    gate: center(gateTile.tx, gateTile.ty),
  };

  const plan: FloorPlan = {
    map,
    rooms: [{ tx: 1, ty: 1, w: cols - 2, h: rows - 2, kind: 'normal' }],
    playerStart: center(13, 9),
    stairsTile: gateTile,
    enemies: [],
    pickups: [],
    torches,
    isBossFloor: false,
    bossSpawn: null,
    shop: null,
    hazards: [],
    urns: [],
    secrets: [],
  };

  return { plan, spots };
}
