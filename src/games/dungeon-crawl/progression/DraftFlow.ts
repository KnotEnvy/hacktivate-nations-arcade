// ===== src/games/dungeon-crawl/progression/DraftFlow.ts =====
// v5 Wave E — the two hero drafts, extracted from the orchestrator for
// guardrail headroom: the run-start class/hero select and the level-up card
// draft (boons, spells, and — this wave — milestone stat bumps). Owns the
// draft cursor state the HUD renders from; reaches the run only through the
// narrow DraftFlowHost. Update methods return the next GameState (as a
// string literal) or null for "no transition"; the game assigns.

import { SoundName } from '@/services/AudioManager';
import { BOONS } from '../data/boons';
import { ALL_CLASS_IDS, CLASSES, ClassId } from '../data/classes';
import { ALL_LINEAGE_IDS, LINEAGES } from '../data/lineages';
import { SPELLS } from '../data/spells';
import { STATS } from '../data/stats';
import { Rng } from '../dungeon/rng';
import { ParticleSystem } from '../systems/ParticleSystem';
import { Player } from '../entities/Player';
import { DraftPick, ProgressionController } from './ProgressionController';

/** The slice of InputManager the drafts read (structural, TownInput-style). */
export interface DraftInput {
  isKeyPressed(code: string): boolean;
}

export interface DraftFlowHost {
  input(): DraftInput | undefined;
  rng(): Rng;
  floor(): number;
  progression(): ProgressionController;
  player(): Player;
  particles(): ParticleSystem;
  /** The game's shared confirm edge (Space/Enter/KeyJ, end-of-frame). */
  confirmWas(): boolean;
  /** Shared ←/→/digit draft navigation (lives with the relic draft). */
  draftNav(index: number, count: number): number;
  playSound(name: SoundName, volume: number): void;
  showBanner(text: string, sub: string): void;
  trackStat(key: string, value: number): void;
  setChosenClass(id: ClassId): void;
  setActiveSpellIndex(index: number): void;
  /** v5 Wave F — re-fold effective scores (equipment-aware) into the player. */
  refreshStatMods(): void;
  /** Wave K — a burst of light blooms where the hero levels up. */
  flashLight(x: number, y: number): void;
}

export class DraftFlow {
  /** Run-start class draft cursor (HUD renders from this). */
  classIndex = 0;
  /** Wave I — the forge's lineage pick (HUD renders from these). */
  pendingClass: ClassId | null = null;
  lineageIndex = 0;
  /** Digits must be RELEASED once after the class pick before they forge. */
  private lineageArmed = false;
  /** Level-up draft cards + cursor (HUD renders from these). */
  choices: DraftPick[] = [];
  index = 0;
  returnState: 'playing' | 'town' = 'playing';

  constructor(private host: DraftFlowHost) {}

  /** New run: back to the first class card; no draft in flight. */
  reset(): void {
    this.classIndex = 0;
    this.pendingClass = null;
    this.lineageIndex = 0;
    this.lineageArmed = false;
    this.choices = [];
    this.index = 0;
    this.returnState = 'playing';
  }

  /** v3 — run-start class draft. Mirrors the relic draft's input handling. */
  updateClassSelect(): 'town' | 'lineageSelect' | null {
    const input = this.host.input();
    if (!input) return null;

    this.classIndex = this.host.draftNav(this.classIndex, ALL_CLASS_IDS.length);

    const confirm =
      input.isKeyPressed('Space') || input.isKeyPressed('Enter') || input.isKeyPressed('KeyJ');
    const directPick = ALL_CLASS_IDS.some((_, i) => input.isKeyPressed(`Digit${i + 1}`));
    if ((confirm && !this.host.confirmWas()) || directPick) {
      const def = CLASSES[ALL_CLASS_IDS[this.classIndex]];
      const progression = this.host.progression();
      // v4.1 — resume this class's hero...
      if (progression.heroFor(def.id)) {
        this.enterTown(def.id, true);
        return 'town';
      }
      // ...or, Wave I, choose a bloodline before the forge lights.
      this.pendingClass = def.id;
      this.lineageIndex = 0;
      this.lineageArmed = false;
      this.host.playSound('success', 0.45);
      return 'lineageSelect';
    }
    return null;
  }

  /** Wave I — the forge's lineage pick (same card grammar as the classes). */
  updateLineageSelect(): 'town' | null {
    const input = this.host.input();
    if (!input || !this.pendingClass) return null;

    this.lineageIndex = this.host.draftNav(this.lineageIndex, ALL_LINEAGE_IDS.length);

    // A digit held over from the class pick must release before it can forge.
    const anyDigit = ALL_LINEAGE_IDS.some((_, i) => input.isKeyPressed(`Digit${i + 1}`));
    if (!this.lineageArmed) {
      if (!anyDigit) this.lineageArmed = true;
      return null;
    }

    const confirm =
      input.isKeyPressed('Space') || input.isKeyPressed('Enter') || input.isKeyPressed('KeyJ');
    if ((confirm && !this.host.confirmWas()) || anyDigit) {
      this.enterTown(this.pendingClass, false);
      this.pendingClass = null;
      return 'town';
    }
    return null;
  }

  /** Resume or forge the hero, arm the player, and step into Lastlight. */
  private enterTown(classId: ClassId, existing: boolean): void {
    const def = CLASSES[classId];
    const progression = this.host.progression();
    const hero = existing
      ? progression.selectHero(classId)
      : progression.create(classId, this.host.rng(), ALL_LINEAGE_IDS[this.lineageIndex]);
    const player = this.host.player();
    player.applyKit(def);
    player.applyLineage(hero.lineage);
    player.applyProgression(progression.gains(), hero.boons, {}, progression.statDeltas());
    this.host.setChosenClass(def.id);
    this.host.trackStat(`${def.id}_depth`, this.host.floor());
    this.host.trackStat('character_level', hero.level);
    this.host.playSound('powerup', 0.55);
    this.host.showBanner(
      hero.name,
      existing
        ? `LEVEL ${hero.level} ${def.name} — WELCOME TO LASTLIGHT`
        : `${LINEAGES[hero.lineage].name} ${def.name} — THE QUEST BOARD AWAITS`,
    );
  }

  /** Open the level-up draft for a pending level (or auto-level when maxed). */
  openBoonDraft(returnTo: 'playing' | 'town' = 'playing'): 'levelUp' | null {
    const progression = this.host.progression();
    this.returnState = returnTo;
    this.choices = progression.draftChoices(this.host.rng());
    this.index = 0;
    if (this.choices.length === 0) {
      // Every training maxed — the level still lands.
      while (progression.pendingLevelUp()) {
        const { level, gain } = progression.confirmLevelUp(null);
        this.host.player().gainLevelBenefits(gain);
        this.host.showBanner(`LEVEL ${level}!`, 'YOUR LEGEND GROWS');
      }
      this.syncProgressionStats();
      return null;
    }
    this.host.playSound('success', 0.5);
    return 'levelUp';
  }

  /** Level-up draft input — mirrors the relic draft. */
  updateBoonChoice(): 'playing' | 'town' | 'levelUp' | null {
    const input = this.host.input();
    if (!input) return null;

    this.index = this.host.draftNav(this.index, this.choices.length);

    const confirm =
      input.isKeyPressed('Space') || input.isKeyPressed('Enter') || input.isKeyPressed('KeyJ');
    const directPick = this.choices.some((_, i) => input.isKeyPressed(`Digit${i + 1}`));
    if ((confirm && !this.host.confirmWas()) || directPick) {
      const progression = this.host.progression();
      const player = this.host.player();
      const pick = this.choices[this.index];
      const { level, gain } = progression.confirmLevelUp(pick);
      if (pick.kind === 'boon') {
        player.gainBoon(pick.id);
        this.host.particles().burst(player.x, player.y, BOONS[pick.id].color, 18, 130, 0.8);
        this.host.showBanner(`LEVEL ${level}!`, BOONS[pick.id].name);
      } else if (pick.kind === 'spell') {
        // v4 Wave D — a spell joins the grimoire and readies itself at once.
        this.host.setActiveSpellIndex(
          Math.max(0, (progression.character()?.spells.length ?? 1) - 1),
        );
        this.host.particles().burst(player.x, player.y, SPELLS[pick.id].color, 18, 130, 0.8);
        this.host.showBanner(`LEVEL ${level}!`, `${SPELLS[pick.id].name} — V TO CAST`);
        this.host.trackStat('spells_learned', progression.sessionSpellsLearned);
      } else {
        // v5 Wave E — a favored score rises; its new deltas land on the spot
        // (equipment-aware since Wave F).
        this.host.refreshStatMods();
        this.host.particles().burst(player.x, player.y, STATS[pick.id].color, 18, 130, 0.8);
        this.host.showBanner(`LEVEL ${level}!`, `${STATS[pick.id].name} RISES`);
      }
      player.gainLevelBenefits(gain);
      this.host.flashLight(player.x, player.y); // Wave K — the moment glows
      this.host.particles().ring(player.x, player.y, '#ffd980', 46, 0.45);
      this.host.playSound('powerup', 0.6);
      this.syncProgressionStats();
      // Boss XP can cross two thresholds — draft again if another level waits.
      if (progression.pendingLevelUp()) return this.openBoonDraft(this.returnState);
      return this.returnState;
    }
    return null;
  }

  private syncProgressionStats(): void {
    const progression = this.host.progression();
    const hero = progression.character();
    if (hero) this.host.trackStat('character_level', hero.level);
    this.host.trackStat('levels_gained', progression.sessionLevels);
    this.host.trackStat('boons_chosen', progression.sessionBoons);
  }
}
