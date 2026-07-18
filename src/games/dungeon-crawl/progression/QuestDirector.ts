// ===== src/games/dungeon-crawl/progression/QuestDirector.ts =====
// v5 Wave G — the quest expedition lifecycle, extracted from the orchestrator
// for guardrail headroom: departure (re-arming the hero, packing provisions),
// victory banking, the victory overlay, saga interludes, and the landing back
// in Lastlight. Owns the active quest + overlay state the HUD renders from;
// reaches the run only through the narrow QuestDirectorHost. Update methods
// return the next GameState (as a string literal) or null for "no
// transition"; the game assigns. Metric counters stay in the game's host
// callbacks (the PickupResolver precedent).

import { SoundName } from '@/services/AudioManager';
import { CLASSES } from '../data/classes';
import { OVERLAY } from '../data/constants';
import { PROVISION_TUNING } from '../data/gear';
import { QuestDef } from '../data/quests';
import { sagaChapterForQuest } from '../data/sagas';
import { ALL_SCROLL_IDS } from '../data/scrolls';
import { STAT_TUNING } from '../data/stats';
import { Rng } from '../dungeon/rng';
import { Player } from '../entities/Player';
import { Inventory } from '../systems/Inventory';
import type { VictoryLedger } from '../rendering/HudRenderer';
import { DraftInput } from './DraftFlow';
import { ProgressionController } from './ProgressionController';

export interface QuestDirectorHost {
  input(): DraftInput | undefined;
  /** The game's shared confirm edge (Space/Enter/KeyJ, end-of-frame). */
  confirmWas(): boolean;
  rng(): Rng;
  progression(): ProgressionController;
  player(): Player;
  inventory(): Inventory;
  goldBalance(): number;
  /** Expedition-scoped resets: floor 1, combo chain, run wallet, fresh seed. */
  resetExpedition(): void;
  loadFloor(): void;
  enterTownWorld(): void;
  /** Open the level-up draft IF one is pending; null = nothing to draft. */
  openBoonDraft(returnTo: 'playing' | 'town'): 'levelUp' | null;
  refreshItemFolds(): void;
  showBanner(text: string, sub: string): void;
  playSound(name: SoundName, volume: number): void;
  triggerStinger(name: 'transition' | 'success'): void;
  shake(amount: number): void;
  trackStat(key: string, value: number): void;
  /** A victory banked gold — the game keeps the session counters. */
  onQuestBanked(banked: number): void;
  onSagaCompleted(): void;
}

/**
 * The staged interlude view: a saga beat after a chapter victory (dismiss
 * lands in town), or — v5 Wave G — the DM's briefing at departure (dismiss
 * descends onto floor 1).
 */
export interface PendingInterlude {
  sagaName: string;
  title: string;
  text: string;
  onDismiss: 'town' | 'descend';
}

export class QuestDirector {
  /** The quest shaping the current expedition (null in town/classic play). */
  activeQuest: QuestDef | null = null;
  /** Victory overlay state (HUD renders from these). */
  victoryTimer = 0;
  victoryLedger: VictoryLedger | null = null;
  /** Interlude overlay state, staged by openVictory. */
  pendingInterlude: PendingInterlude | null = null;
  interludeTimer = 0;

  constructor(private host: QuestDirectorHost) {}

  /** New run: no quest, no overlays in flight. */
  reset(): void {
    this.activeQuest = null;
    this.victoryTimer = 0;
    this.victoryLedger = null;
    this.pendingInterlude = null;
    this.interludeTimer = 0;
  }

  /** Back in Lastlight — the expedition (and its shape) is over. */
  clearQuest(): void {
    this.activeQuest = null;
  }

  /** Set out from the gate: fresh seed, quest shape, packed provisions. */
  depart(quest: QuestDef): 'interlude' {
    const progression = this.host.progression();
    const hero = progression.character();
    this.activeQuest = quest;

    // Expedition-scoped resets (session metrics keep accumulating).
    this.host.resetExpedition();

    // Re-arm the hero: kit + training + gear, then whatever was packed.
    if (hero) {
      const player = this.host.player();
      player.reset(0, 0);
      player.applyKit(CLASSES[hero.classId]);
      player.applyLineage(hero.lineage);
      player.applyProgression(
        progression.gains(),
        hero.boons,
        hero.gear,
        progression.statDeltas(),
        hero.level, // Wave L — CON's HP share is per hit die
      );
      // v5 Wave F — wear the saved equipment (folds + effective scores) so
      // provisions below see the right dagger caps.
      this.host.inventory().armFromHero(hero);
      this.host.refreshItemFolds();
      for (const provision of hero.provisions) {
        if (provision === 'field-scroll') {
          player.scroll = this.host.rng().pick(ALL_SCROLL_IDS);
        } else if (provision === 'bandolier') {
          player.daggers = Math.min(
            player.daggerCap(),
            player.daggers + PROVISION_TUNING.BANDOLIER_DAGGERS,
          );
        } else if (provision === 'blessed-candle') {
          player.provisionTorch = PROVISION_TUNING.CANDLE_TORCH_BONUS;
        }
      }
      hero.provisions = [];
      progression.saveCheckpoint();
    }

    // v5 Wave G — the DM sets the scene; dismissing the briefing descends
    // (loadFloor waits for the dismiss so the floor banner plays properly).
    this.pendingInterlude = {
      sagaName: sagaChapterForQuest(quest.id)?.saga.name ?? 'THE QUEST BOARD',
      title: quest.name,
      text: quest.intro,
      onDismiss: 'descend',
    };
    this.interludeTimer = 0;
    return 'interlude';
  }

  /** The final boss fell and the stairs were taken: the quest is won. */
  openVictory(): 'victory' {
    const quest = this.activeQuest!;
    const progression = this.host.progression();
    const hero = progression.character();
    this.victoryTimer = 0;
    // v5 Wave G — a won expedition's briefing is moot; only a fresh saga
    // beat below may stage an interlude (replays stay interlude-free).
    this.pendingInterlude = null;

    // v5 Wave E — Presence talks the reward up (per CHA delta point).
    const rewardGold = Math.round(
      quest.rewardGold *
        (1 + STAT_TUNING.CHA_QUEST_GOLD * this.host.player().statMods.cha),
    );
    // v5 Wave F — the ONLY moment run finds become permanent; duplicates and
    // stash overflow convert to gold, folded into banked BEFORE the ledger.
    const finds = hero
      ? this.host.inventory().bankOnVictory(hero)
      : { bankedCount: 0, dupeGold: 0 };
    const carried = this.host.goldBalance();
    const banked = carried + rewardGold + finds.dupeGold;
    if (hero) {
      hero.gold += banked;
      hero.stats.victories++;
    }
    progression.grantXp(quest.rewardXp);
    this.host.trackStat('xp_earned', progression.sessionXp);
    progression.saveCheckpoint();
    this.host.onQuestBanked(banked);

    // v4 Wave C — a current-chapter victory advances its saga and stages the
    // interlude (replays return null: no re-advance, no repeated story beat).
    const sagaHit = progression.advanceSaga(quest.id);
    if (sagaHit) {
      this.pendingInterlude = {
        sagaName: sagaHit.sagaName,
        title: sagaHit.completed ? 'THE SAGA IS TOLD' : 'THE TALE CONTINUES',
        text: sagaHit.interlude,
        onDismiss: 'town',
      };
      if (sagaHit.completed) this.host.onSagaCompleted();
    }

    this.victoryLedger = {
      carried,
      rewardGold,
      rewardXp: quest.rewardXp,
      banked,
      treasury: hero?.gold ?? 0,
      bankedFinds: finds.bankedCount,
      dupeGold: finds.dupeGold,
    };
    this.host.shake(0.3);
    this.host.playSound('success', 0.7);
    this.host.triggerStinger('success');
    return 'victory';
  }

  updateVictory(dt: number): 'interlude' | 'town' | 'levelUp' | null {
    this.victoryTimer += dt;
    const input = this.host.input();
    const confirm = input
      ? input.isKeyPressed('Space') || input.isKeyPressed('Enter')
      : false;
    if (this.victoryTimer > 1.0 && confirm && !this.host.confirmWas()) {
      this.host.enterTownWorld();
      if (this.pendingInterlude) {
        // v4 Wave C — the story beat plays before Lastlight takes over.
        this.interludeTimer = 0;
        this.host.playSound('unlock', 0.4);
        return 'interlude';
      }
      return this.arrive();
    }
    return null;
  }

  /**
   * v4 Wave C — dismissing a saga interlude lands the hero back in town.
   * v5 Wave G — dismissing a DM briefing descends onto floor 1 instead.
   */
  updateInterlude(dt: number): 'playing' | 'town' | 'levelUp' | null {
    this.interludeTimer += dt;
    const input = this.host.input();
    const confirm = input
      ? input.isKeyPressed('Space') || input.isKeyPressed('Enter')
      : false;
    if (this.interludeTimer > OVERLAY.INTERLUDE_LOCKOUT && confirm && !this.host.confirmWas()) {
      const descend = this.pendingInterlude?.onDismiss === 'descend';
      this.pendingInterlude = null;
      if (descend) {
        this.host.loadFloor();
        this.host.triggerStinger('transition');
        return 'playing';
      }
      return this.arrive();
    }
    return null;
  }

  /** Post-victory landing: banner + any level-up the reward XP earned. */
  private arrive(): 'town' | 'levelUp' {
    this.host.showBanner('LASTLIGHT', 'THE GATE CLOSES BEHIND YOU — WELL FOUGHT');
    // Reward XP can cross a threshold — level up right at the gate.
    return this.host.openBoonDraft('town') ?? 'town';
  }
}
