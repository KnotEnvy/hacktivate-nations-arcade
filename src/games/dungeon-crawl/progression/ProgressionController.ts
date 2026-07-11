// ===== src/games/dungeon-crawl/progression/ProgressionController.ts =====
// v4 — owns the hero ROSTER during play: one persistent hero per class, the
// ACTIVE hero for the current expedition, XP grants, pending level-ups, boon
// drafts, and the session counters that feed the metrics contract. Saves at
// checkpoints (select/create, level-up, descend, death, destroy) — never per
// frame. DungeonCrawlGame stays dispatch glue.

import { ALL_BOON_IDS, BOONS, BoonId } from '../data/boons';
import { ClassId } from '../data/classes';
import {
  cumulativeGains,
  HERO_NAMES,
  LEVEL_CAP,
  LEVEL_GAINS,
  LevelGain,
  levelForXp,
  PROGRESSION,
  xpIntoLevel,
} from '../data/progression';
import { chaptersDone, sagaChapterForQuest, SAGAS } from '../data/sagas';
import { QuestId } from '../data/quests';
import { Rng } from '../dungeon/rng';
import { CharacterStore, SavedHero, SavePayloadV2 } from '../persistence/CharacterStore';

export class ProgressionController {
  private store = new CharacterStore();
  private payload: SavePayloadV2 = { version: 2, characters: {} };
  private activeClass: ClassId | null = null;

  // Session counters (per run, monotonic — feed extendedGameData).
  sessionXp = 0;
  sessionLevels = 0;
  sessionBoons = 0;

  load(): void {
    this.payload = this.store.load();
    this.activeClass = null;
  }

  /** New run (or restart): the per-run metric counters start over. */
  resetSessionCounters(): void {
    this.sessionXp = 0;
    this.sessionLevels = 0;
    this.sessionBoons = 0;
  }

  /** The roster entry for a class (null = not yet forged). */
  heroFor(classId: ClassId): SavedHero | null {
    return this.payload.characters[classId] ?? null;
  }

  /** True when an expedition's hero is active. */
  hasCharacter(): boolean {
    return this.activeClass !== null && this.heroFor(this.activeClass) !== null;
  }

  /** The active expedition's hero (null before the roster pick). */
  character(): SavedHero | null {
    return this.activeClass ? this.heroFor(this.activeClass) : null;
  }

  /** Forge a new hero for an empty class slot; it becomes active. */
  create(classId: ClassId, rng: Rng): SavedHero {
    const names = HERO_NAMES[classId];
    const hero: SavedHero = {
      classId,
      name: names[rng.int(0, names.length - 1)],
      level: 1,
      xp: 0,
      boons: {},
      createdAt: Date.now(),
      stats: { expeditions: 1, deaths: 0, victories: 0 },
      gold: 0,
      gear: {},
      provisions: [],
      sagas: {},
    };
    this.payload.characters[classId] = hero;
    this.activeClass = classId;
    this.store.save(this.payload);
    return hero;
  }

  /** A returning hero sets out again; it becomes active. */
  selectHero(classId: ClassId): SavedHero {
    const hero = this.heroFor(classId)!;
    this.activeClass = classId;
    hero.stats.expeditions++;
    this.store.save(this.payload);
    return hero;
  }

  grantXp(amount: number): void {
    const hero = this.character();
    if (!hero || amount <= 0) return;
    hero.xp += amount;
    this.sessionXp += amount;
  }

  /** True when banked XP has crossed the next level threshold. */
  pendingLevelUp(): boolean {
    const hero = this.character();
    if (!hero) return false;
    return hero.level < LEVEL_CAP && levelForXp(hero.xp) > hero.level;
  }

  /** Up to 3 unmaxed boons for the level-up draft (seeded shuffle). */
  boonChoices(rng: Rng): BoonId[] {
    const hero = this.character();
    if (!hero) return [];
    const open = ALL_BOON_IDS.filter(id => (hero.boons[id] ?? 0) < BOONS[id].maxStacks);
    return rng.shuffle(open).slice(0, 3);
  }

  /**
   * Commit the level-up with the chosen boon. Returns the new level and the
   * class's gain row for it so the game can apply the benefits live.
   */
  confirmLevelUp(boon: BoonId | null): { level: number; gain: LevelGain } {
    const hero = this.character()!;
    hero.level++;
    if (boon) {
      hero.boons[boon] = Math.min(BOONS[boon].maxStacks, (hero.boons[boon] ?? 0) + 1);
      this.sessionBoons++;
    }
    this.sessionLevels++;
    this.store.save(this.payload);
    const gain = LEVEL_GAINS[hero.classId][hero.level - 2] ?? {};
    return { level: hero.level, gain };
  }

  /** 0..1 progress through the current level (1 at the cap). */
  xpFrac(): number {
    const hero = this.character();
    if (!hero) return 0;
    return xpIntoLevel(hero.xp, hero.level).frac;
  }

  /** The gains the active hero's class has banked up to its current level. */
  gains(): { hp: number; speed: number; daggerCap: number } {
    const hero = this.character();
    if (!hero) return { hp: 0, speed: 0, daggerCap: 0 };
    return cumulativeGains(hero.classId, hero.level);
  }

  /**
   * v4 Wave C — a quest victory advances its saga IF it was the hero's current
   * chapter (replays never re-advance). Returns what the game should stage:
   * the interlude for the finished chapter, and whether the saga completed.
   */
  advanceSaga(questId: QuestId): { interlude: string; sagaName: string; completed: boolean } | null {
    const hero = this.character();
    const hit = sagaChapterForQuest(questId);
    if (!hero || !hit) return null;
    const done = chaptersDone(hero.sagas, hit.saga.id);
    if (hit.chapter !== done) return null; // replay or out of order — no advance
    hero.sagas[hit.saga.id] = done + 1;
    this.store.save(this.payload);
    return {
      interlude: SAGAS[hit.saga.id].interludes[hit.chapter],
      sagaName: hit.saga.name,
      completed: done + 1 >= hit.saga.quests.length,
    };
  }

  /** Death checkpoint — the hero endures, XP and boons are banked. */
  recordDeath(): void {
    const hero = this.character();
    if (!hero) return;
    hero.stats.deaths++;
    this.store.save(this.payload);
  }

  /** Plain checkpoint (descend / destroy). */
  saveCheckpoint(): void {
    if (this.activeClass) this.store.save(this.payload);
  }

  /** Retire the ACTIVE hero only — that class slot awaits a new legend. */
  retire(): void {
    if (!this.activeClass) return;
    delete this.payload.characters[this.activeClass];
    this.store.save(this.payload);
    this.activeClass = null;
  }

  /**
   * Enemy-hp counterweight so persistent power keeps floor 1 honest:
   * ×(1 + 0.05·(level−1)), capped. 1 before the roster pick.
   */
  levelPressure(): number {
    const hero = this.character();
    if (!hero) return 1;
    return Math.min(
      PROGRESSION.PRESSURE_HP_CAP,
      1 + PROGRESSION.PRESSURE_HP_PER_LEVEL * (hero.level - 1),
    );
  }
}
