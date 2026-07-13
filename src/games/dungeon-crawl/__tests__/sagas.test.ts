// v4 Wave C tests: the saga data contract (chapters, interludes, unique finale
// kits, reward crown), the pure chapter-walk helpers, the town board's saga
// page, and the game flow — victory advances the arc once, plays the
// interlude, pins the finale's unique boss, and reports sagas_completed.

import { BOSS_KITS, bossKitById } from '@/games/dungeon-crawl/data/bosses';
import {
  ALL_QUEST_IDS,
  QUESTS,
  QuestDef,
  STANDALONE_QUEST_IDS,
} from '@/games/dungeon-crawl/data/quests';
import {
  ALL_SAGA_IDS,
  chaptersDone,
  currentChapter,
  sagaChapterForQuest,
  SAGAS,
} from '@/games/dungeon-crawl/data/sagas';
import { STAT_BASES } from '@/games/dungeon-crawl/data/stats';
import { DungeonCrawlGame } from '@/games/dungeon-crawl/DungeonCrawlGame';
import { CharacterStore } from '@/games/dungeon-crawl/persistence/CharacterStore';
import { TownController, TownCtx } from '@/games/dungeon-crawl/town/TownController';
import { initGame, type Harness } from '@/games/shared/gameTestHarness';

let randomSpy: jest.SpyInstance;
beforeEach(() => {
  randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.42);
});
afterEach(() => {
  randomSpy.mockRestore();
});

function wireHeldKeys(h: Harness): Set<string> {
  const held = new Set<string>();
  const input = h.services.input as unknown as {
    isKeyPressed: jest.Mock;
    isLeftPressed: jest.Mock;
    isRightPressed: jest.Mock;
    isUpPressed: jest.Mock;
    isDownPressed: jest.Mock;
  };
  input.isKeyPressed.mockImplementation((code: string) => held.has(code));
  input.isLeftPressed.mockImplementation(() => held.has('ArrowLeft'));
  input.isRightPressed.mockImplementation(() => held.has('ArrowRight'));
  input.isUpPressed.mockImplementation(() => held.has('ArrowUp'));
  input.isDownPressed.mockImplementation(() => held.has('ArrowDown'));
  return held;
}

interface GameInternals {
  departOnQuest(quest: QuestDef): void;
  openVictory(): void;
  loadFloor(): void;
  floor: number;
  boss: { kit: { id: string } } | null;
  goldBalance: number;
  state: string;
  progression: { load(): void; selectHero(id: string): void };
}

function internals(h: Harness): GameInternals {
  return h.game as unknown as GameInternals;
}

function metrics(h: Harness): Record<string, number> {
  return h.game.getScore!() as unknown as Record<string, number>;
}

function startWithFighter(h: Harness): Set<string> {
  const held = wireHeldKeys(h);
  held.add('Digit1');
  h.game.update(1 / 60); // pick fighter -> town
  held.clear();
  h.game.update(1 / 60);
  return held;
}

/** One clean press-edge of Space after idling past an overlay lockout. */
function pressSpaceAfter(h: Harness, held: Set<string>, idleFrames: number): void {
  held.clear();
  for (let i = 0; i < idleFrames; i++) h.game.update(1 / 60);
  held.add('Space');
  h.game.update(1 / 60);
  held.clear();
  h.game.update(1 / 60);
}

describe('saga data contract', () => {
  test('two authored sagas: flagged chapters, paired interludes, unique finales', () => {
    expect(ALL_SAGA_IDS).toHaveLength(2);
    for (const id of ALL_SAGA_IDS) {
      const saga = SAGAS[id];
      expect(saga.id).toBe(id);
      expect(saga.name.length).toBeGreaterThan(0);
      expect(saga.blurb.length).toBeGreaterThan(0);
      expect(saga.quests.length).toBeGreaterThanOrEqual(3);
      expect(saga.interludes).toHaveLength(saga.quests.length);
      for (const text of saga.interludes) {
        expect(text.length).toBeGreaterThan(0);
        expect(text.split(/\s+/).length).toBeLessThanOrEqual(65); // short beats
      }
      let prevMin = 0;
      for (const qid of saga.quests) {
        const quest = QUESTS[qid];
        expect(quest.saga).toBe(true);
        expect(quest.floors).toBeGreaterThan(0);
        expect(quest.minLevel).toBeGreaterThanOrEqual(prevMin);
        prevMin = quest.minLevel;
      }
      // The finale pins a UNIQUE kit that never joins the tier rotation.
      const finale = QUESTS[saga.quests[saga.quests.length - 1]];
      expect(finale.bossKitId).toBeDefined();
      const kit = bossKitById(finale.bossKitId!);
      expect(kit.id).toBe(finale.bossKitId);
      expect(BOSS_KITS.some(k => k.id === kit.id)).toBe(false);
    }
    // Chapters never leak onto the classic board page.
    for (const id of STANDALONE_QUEST_IDS) expect(QUESTS[id].saga).toBeUndefined();
    // The epic's finale pays the game's largest rewards.
    const crown = QUESTS['the-cinder-regent'];
    for (const id of ALL_QUEST_IDS) {
      expect(crown.rewardGold).toBeGreaterThanOrEqual(QUESTS[id].rewardGold);
      expect(crown.rewardXp).toBeGreaterThanOrEqual(QUESTS[id].rewardXp);
    }
  });

  test('chapter-walk helpers', () => {
    expect(sagaChapterForQuest('the-silent-march')).toEqual({
      saga: SAGAS['pale-procession'],
      chapter: 1,
    });
    expect(sagaChapterForQuest('embers-below')).toBeNull();
    expect(currentChapter(undefined, 'pale-procession')).toBe('the-shallow-graves');
    expect(currentChapter({ 'pale-procession': 2 }, 'pale-procession')).toBe('the-grave-warden');
    expect(currentChapter({ 'pale-procession': 3 }, 'pale-procession')).toBeNull();
    expect(chaptersDone({ 'pale-procession': 99 }, 'pale-procession')).toBe(3);
    expect(chaptersDone(undefined, 'undying-ember')).toBe(0);
  });
});

describe('the saga board page', () => {
  function boardCtx(
    pressed: Set<string>,
    departed: QuestDef[],
    sagas: Record<string, number>,
  ): TownCtx {
    return {
      dt: 1 / 60,
      input: {
        isKeyPressed: (code: string) => pressed.has(code),
        isLeftPressed: () => pressed.has('ArrowLeft'),
        isRightPressed: () => pressed.has('ArrowRight'),
        isUpPressed: () => pressed.has('ArrowUp'),
        isDownPressed: () => pressed.has('ArrowDown'),
      },
      edges: {
        interactWas: false,
        confirmWas: false,
        navLeftWas: false,
        navRightWas: false,
        navUpWas: false,
        navDownWas: false,
      },
      player: null as unknown as TownCtx['player'], // board path never touches it
      hero: {
        classId: 'fighter',
        name: 'SIR ROWAN',
        level: 9,
        xp: 0,
        boons: {},
        createdAt: 0,
        stats: { expeditions: 1, deaths: 0, victories: 0 },
        gold: 0,
        gear: {},
        provisions: [],
        sagas,
        spells: [],
        scores: { ...STAT_BASES.fighter },
        equipment: {},
        stash: [],
      },
      save: () => {},
      playSound: () => {},
      showBanner: () => {},
      depart: quest => departed.push(quest),
    };
  }

  test('Up/Down flips pages; confirm departs on the hero CURRENT chapter', () => {
    const town = new TownController();
    town.overlay = 'quests';
    const departed: QuestDef[] = [];

    // Flip to the saga page.
    town.update(boardCtx(new Set(['ArrowDown']), departed, {}));
    expect(town.boardPage).toBe('sagas');

    // A fresh hero departs on chapter 1 of the first saga.
    town.update(boardCtx(new Set(['Space']), departed, {}));
    expect(departed[0]?.id).toBe('the-shallow-graves');

    // Mid-arc progress departs on the next unlocked chapter.
    town.overlay = 'quests';
    town.boardPage = 'sagas';
    town.update(boardCtx(new Set(['Space']), departed, { 'pale-procession': 2 }));
    expect(departed[1]?.id).toBe('the-grave-warden');

    // A told saga relives its finale (progress never rewinds).
    town.overlay = 'quests';
    town.boardPage = 'sagas';
    town.update(boardCtx(new Set(['Space']), departed, { 'pale-procession': 3 }));
    expect(departed[2]?.id).toBe('the-grave-warden');
  });
});

describe('saga flow through victory', () => {
  test('a chapter victory advances once, plays the interlude, ignores replays', () => {
    const h = initGame(new DungeonCrawlGame());
    const held = startWithFighter(h);
    const game = internals(h);

    game.departOnQuest(QUESTS['the-shallow-graves']);
    game.openVictory();
    h.game.update(1 / 60);
    expect(new CharacterStore().load().characters.fighter?.sagas['pale-procession']).toBe(1);

    // Victory overlay -> interlude -> town (Space past each lockout).
    pressSpaceAfter(h, held, 70);
    expect(game.state).toBe('interlude');
    pressSpaceAfter(h, held, 70);
    expect(game.state).toBe('town');

    // Replaying the same chapter never re-advances (and no interlude replays).
    game.departOnQuest(QUESTS['the-shallow-graves']);
    game.openVictory();
    h.game.update(1 / 60);
    expect(new CharacterStore().load().characters.fighter?.sagas['pale-procession']).toBe(1);
    pressSpaceAfter(h, held, 70);
    // 220 lifetime XP crossed the level-2 threshold, so the gate opens the
    // level-up draft BEFORE Lastlight (designed: level up right at the gate)
    // — and no interlude replays for a re-told chapter.
    expect(game.state).toBe('levelUp');
    held.add('Digit1');
    h.game.update(1 / 60);
    held.clear();
    h.game.update(1 / 60);
    expect(game.state).toBe('town');
    expect(metrics(h).sagas_completed).toBe(0);
  });

  test('the finale pins its unique boss and completes the saga', () => {
    const h = initGame(new DungeonCrawlGame());
    startWithFighter(h);
    const game = internals(h);

    // Hand the fighter a saga on the brink of its finale.
    const store = new CharacterStore();
    const payload = store.load();
    payload.characters.fighter!.sagas = { 'pale-procession': 2 };
    store.save(payload);
    game.progression.load();
    game.progression.selectHero('fighter');

    game.departOnQuest(QUESTS['the-grave-warden']);
    game.floor = QUESTS['the-grave-warden'].floors;
    game.loadFloor();
    expect(game.boss).not.toBeNull();
    expect(game.boss!.kit.id).toBe('grave-warden');

    game.openVictory();
    h.game.update(1 / 60);
    expect(metrics(h).sagas_completed).toBe(1);
    expect(new CharacterStore().load().characters.fighter?.sagas['pale-procession']).toBe(3);
  });
});
