// ===== src/games/dungeon-crawl/progression/RecapFlow.ts =====
// Wave O valve — the death-recap overlay lifecycle, extracted from the
// orchestrator for guardrail headroom (the QuestDirector victory/interlude
// precedent). The GAME still assembles RecapStats (its counters, its
// bookkeeping) and hands them to open(); this class owns the overlay timers,
// the hold-R retirement affordance, and the dismiss that ends the session.
// Reaches the run only through the narrow RecapFlowHost.

import { SoundName } from '@/services/AudioManager';
import { OVERLAY } from '../data/constants';
import { PROGRESSION } from '../data/progression';
import type { RecapStats } from '../rendering/HudRenderer';
import { DraftInput } from './DraftFlow';
import { ProgressionController } from './ProgressionController';

export interface RecapFlowHost {
  input(): DraftInput | undefined;
  /** The game's shared confirm edge (Space/Enter, end-of-frame). */
  confirmWas(): boolean;
  progression(): ProgressionController;
  playSound(name: SoundName, volume: number): void;
  /** Dismissal ends the arcade session (BaseGame.endGame). */
  endGame(): void;
}

export class RecapFlow {
  timer = 0;
  stats: RecapStats | null = null;
  retired = false;
  retireHold = 0;

  constructor(private host: RecapFlowHost) {}

  reset(): void {
    this.timer = 0;
    this.stats = null;
    this.retired = false;
    this.retireHold = 0;
  }

  /** The hero has fallen; the game hands over its frozen run stats. */
  open(stats: RecapStats): void {
    this.timer = 0;
    this.stats = stats;
    this.retired = false;
    this.retireHold = 0;
  }

  update(dt: number): void {
    this.timer += dt;
    const input = this.host.input();
    const confirm = input
      ? input.isKeyPressed('Space') || input.isKeyPressed('Enter')
      : false;
    const canDismiss = this.timer > OVERLAY.RECAP_INPUT_LOCKOUT;

    // v4 — hold R past the lockout to retire the hero (hold-gated on purpose).
    if (
      canDismiss &&
      !this.retired &&
      this.host.progression().hasCharacter() &&
      input?.isKeyPressed('KeyR')
    ) {
      this.retireHold += dt;
      if (this.retireHold >= PROGRESSION.RETIRE_HOLD_SECONDS) {
        this.host.progression().retire();
        this.retired = true;
        this.host.playSound('gate_open', 0.5);
      }
    } else {
      this.retireHold = 0;
    }

    if ((canDismiss && confirm && !this.host.confirmWas()) || this.timer > OVERLAY.RECAP_AUTO_DISMISS) {
      this.host.endGame();
    }
  }
}
