// v5 Wave G tests — the DM wave: the townsfolk data contract (five named
// regulars, stage-keyed rumor pools), the pure storyStage walk, the Inn
// station, DM quest briefings through the interlude overlay, and THE LAST
// PAGE meta-saga gating (hidden until both sagas are TOLD).

import { ALL_NPC_IDS, NPCS, NpcId, storyStage, StoryStage } from '@/games/dungeon-crawl/data/npcs';
import { ALL_QUEST_IDS, QUESTS, QuestDef } from '@/games/dungeon-crawl/data/quests';
import { DungeonCrawlGame } from '@/games/dungeon-crawl/DungeonCrawlGame';
import { initGame, type Harness } from '@/games/shared/gameTestHarness';
import {
  ALL_SAGA_IDS,
  metaUnlocked,
  SAGAS,
  SagaId,
  visibleSagaIds,
} from '@/games/dungeon-crawl/data/sagas';
import { STAT_BASES } from '@/games/dungeon-crawl/data/stats';
import { isReachable } from '@/games/dungeon-crawl/dungeon/DungeonGenerator';
import { SavedHero } from '@/games/dungeon-crawl/persistence/CharacterStore';
import { TownController, TownCtx } from '@/games/dungeon-crawl/town/TownController';

function heroFixture(
  level: number,
  sagas: Partial<Record<SagaId, number>>,
): SavedHero {
  return {
    classId: 'fighter',
    name: 'SIR ROWAN',
    level,
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
    lineage: 'human',
    hpRolls: [],
  };
}

/** A board/inn-side TownCtx (walking paths never run in these tests). */
function townCtx(
  pressed: Set<string>,
  hero: SavedHero,
  hooks?: { departed?: unknown[]; pools?: (readonly string[])[] },
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
    player: null as unknown as TownCtx['player'],
    hero,
    save: () => {},
    playSound: () => {},
    showBanner: () => {},
    depart: quest => hooks?.departed?.push(quest),
    pickRumor: pool => {
      hooks?.pools?.push(pool);
      return pool[0];
    },
  };
}

const ALL_STAGES: readonly StoryStage[] = ['arrival', 'delving', 'the-page', 'aftermath'];

let randomSpy: jest.SpyInstance;
beforeEach(() => {
  randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.42);
});
afterEach(() => {
  randomSpy.mockRestore();
});

// ---------------------------------------------------------- game-flow rig
// (the established dev-test pattern: wire held keys, poke internals)

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
  state: string;
  floor: number;
  boss: unknown;
  map: { cols: number };
  quests: {
    pendingInterlude: {
      sagaName: string;
      title: string;
      text: string;
      onDismiss: string;
    } | null;
  };
}

function internals(h: Harness): GameInternals {
  return h.game as unknown as GameInternals;
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

describe('the townsfolk data contract', () => {
  test('five named regulars, every stage pool stocked with original lines', () => {
    expect(ALL_NPC_IDS).toHaveLength(5);
    for (const id of ALL_NPC_IDS) {
      const npc = NPCS[id];
      expect(npc.id).toBe(id);
      expect(npc.name.length).toBeGreaterThan(0);
      expect(npc.title.length).toBeGreaterThan(0);
      expect(npc.icon.length).toBeGreaterThan(0);
      expect(npc.color).toMatch(/^#/);
      for (const stage of ALL_STAGES) {
        const pool = npc.rumors[stage];
        expect(pool.length).toBeGreaterThanOrEqual(2);
        for (const rumor of pool) {
          expect(rumor.length).toBeGreaterThan(0);
          expect(rumor.split(/\s+/).length).toBeLessThanOrEqual(24); // bar talk, not speeches
        }
      }
    }
  });

  test('rumor pools are distinct per NPC voice (no copy-paste across stages)', () => {
    for (const id of ALL_NPC_IDS) {
      const all = ALL_STAGES.flatMap(stage => NPCS[id as NpcId].rumors[stage]);
      expect(new Set(all).size).toBe(all.length);
    }
  });
});

describe('storyStage (pure, stateless)', () => {
  test('a missing or fresh hero hears arrival talk', () => {
    expect(storyStage(null)).toBe('arrival');
    expect(storyStage({ level: 1, sagas: {} })).toBe('arrival');
    expect(storyStage({ level: 3, sagas: {} })).toBe('arrival');
  });

  test('level or first saga deeds promote the hero to delving gossip', () => {
    expect(storyStage({ level: 4, sagas: {} })).toBe('delving');
    expect(storyStage({ level: 1, sagas: { 'pale-procession': 1 } })).toBe('delving');
    expect(storyStage({ level: 1, sagas: { 'undying-ember': 2 } })).toBe('delving');
  });
});

describe('meta-saga gating helpers', () => {
  const paleTold = SAGAS['pale-procession'].quests.length;
  const emberTold = SAGAS['undying-ember'].quests.length;

  test('metaUnlocked only when every non-meta saga is TOLD', () => {
    expect(metaUnlocked(undefined)).toBe(false);
    expect(metaUnlocked({ 'pale-procession': paleTold })).toBe(false);
    expect(metaUnlocked({ 'undying-ember': emberTold })).toBe(false);
    expect(
      metaUnlocked({ 'pale-procession': paleTold, 'undying-ember': emberTold }),
    ).toBe(true);
  });

  test('visibleSagaIds hides locked meta arcs and nothing else', () => {
    const visible = visibleSagaIds({});
    for (const id of visible) expect(SAGAS[id].meta).toBeUndefined();
    const earned = visibleSagaIds({
      'pale-procession': paleTold,
      'undying-ember': emberTold,
    });
    expect(earned).toEqual(ALL_SAGA_IDS);
  });
});

describe('THE LAST LANTERN (the inn station)', () => {
  test('the keeper stands on reachable ground', () => {
    const town = new TownController();
    const { map, playerStart } = town.plan;
    const startTile = map.tileAtWorld(playerStart.x, playerStart.y);
    const tile = map.tileAtWorld(town.spots.inn.x, town.spots.inn.y);
    expect(map.isSolidAt(tile.tx, tile.ty)).toBe(false);
    expect(isReachable(map, startTile, tile)).toBe(true);
  });

  test('patron browse re-rolls from the stage pool; SPACE asks for another; E steps away', () => {
    const town = new TownController();
    town.overlay = 'inn';
    const pools: (readonly string[])[] = [];
    const hero = heroFixture(9, {}); // level 9, no saga deeds -> delving talk

    // → moves to the second patron and pours a fresh line from their pool.
    town.update(townCtx(new Set(['ArrowRight']), hero, { pools }));
    expect(town.selection).toBe(1);
    expect(pools[0]).toBe(NPCS[ALL_NPC_IDS[1]].rumors.delving);
    expect(town.innRumor.length).toBeGreaterThan(0);

    // SPACE asks the same patron for another word.
    town.update(townCtx(new Set(['Space']), hero, { pools }));
    expect(pools).toHaveLength(2);
    expect(pools[1]).toBe(NPCS[ALL_NPC_IDS[1]].rumors.delving);

    // E closes the bar.
    town.update(townCtx(new Set(['KeyE']), hero, { pools }));
    expect(town.overlay).toBe('none');
  });
});

describe('THE LAST PAGE (meta-saga)', () => {
  const bothTold = () => ({
    'pale-procession': SAGAS['pale-procession'].quests.length,
    'undying-ember': SAGAS['undying-ember'].quests.length,
  });

  test('the meta arc is flagged and crowns the story stages', () => {
    expect(SAGAS['the-last-page'].meta).toBe(true);
    expect(storyStage(heroFixture(10, bothTold()))).toBe('the-page');
    expect(
      storyStage(
        heroFixture(10, { ...bothTold(), 'the-last-page': SAGAS['the-last-page'].quests.length }),
      ),
    ).toBe('aftermath');
  });

  test('the saga board offers the meta arc only once both sagas are TOLD', () => {
    const town = new TownController();
    town.overlay = 'quests';
    town.boardPage = 'sagas';
    const departed: QuestDef[] = [];

    // Locked: Digit3 cannot reach a third card — the first saga departs.
    town.update(townCtx(new Set(['Digit3', 'Space']), heroFixture(9, {}), { departed }));
    expect(departed[0]?.id).toBe('the-shallow-graves');

    // Unlocked: the third card departs on the meta arc's first chapter.
    town.overlay = 'quests';
    town.boardPage = 'sagas';
    town.selection = 0;
    town.update(
      townCtx(new Set(['Digit3', 'Space']), heroFixture(10, bothTold()), { departed }),
    );
    expect(departed[1]?.id).toBe('the-blank-ledger');
  });
});

describe('DM quest briefings', () => {
  test('every quest carries a short original briefing', () => {
    for (const id of ALL_QUEST_IDS) {
      const intro = QUESTS[id].intro;
      expect(intro.length).toBeGreaterThan(0);
      expect(intro.split(/\s+/).length).toBeLessThanOrEqual(60);
    }
  });

  test('departure stages the briefing; dismissing it descends onto floor 1', () => {
    const h = initGame(new DungeonCrawlGame());
    const held = startWithFighter(h);
    const game = internals(h);

    game.departOnQuest(QUESTS['embers-below']);
    h.game.update(1 / 60);
    expect(game.state).toBe('interlude');
    expect(game.quests.pendingInterlude).toMatchObject({
      sagaName: 'THE QUEST BOARD',
      title: 'EMBERS BELOW',
      text: QUESTS['embers-below'].intro,
      onDismiss: 'descend',
    });
    // The world behind the briefing is still Lastlight (26 cols).
    expect(game.map.cols).toBe(26);

    // Space past the lockout descends: floor 1 loads, play begins.
    pressSpaceAfter(h, held, 70);
    expect(game.state).toBe('playing');
    expect(game.floor).toBe(1);
    expect(game.map.cols).toBeGreaterThanOrEqual(42); // a real dungeon floor
  });

  test('a saga chapter briefs under its saga name', () => {
    const h = initGame(new DungeonCrawlGame());
    startWithFighter(h);
    const game = internals(h);
    game.departOnQuest(QUESTS['the-shallow-graves']);
    expect(game.quests.pendingInterlude?.sagaName).toBe('THE PALE PROCESSION');
  });

  test('victory clears a stale briefing — dismissal never re-briefs', () => {
    const h = initGame(new DungeonCrawlGame());
    const held = startWithFighter(h);
    const game = internals(h);

    game.departOnQuest(QUESTS['embers-below']);
    game.openVictory(); // dev-test poke: win without playing the floors
    h.game.update(1 / 60);
    expect(game.state).toBe('victory');
    expect(game.quests.pendingInterlude).toBeNull(); // not a saga chapter

    pressSpaceAfter(h, held, 70);
    // Reward XP may open the level-up draft at the gate; either way the
    // stale briefing must not replay as an interlude.
    expect(['town', 'levelUp']).toContain(game.state);
  });
});
