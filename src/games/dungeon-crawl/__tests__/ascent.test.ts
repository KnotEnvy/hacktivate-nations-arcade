// Wave Q1 tests: THE LONG ASCENT. Pins the extended level curve and gain rows,
// the level/class BAND gate on THE GREAT BOONS (from both sides), the promise
// that a hero's first ten levels are untouched, the save contract at the new
// cap, and each of the ten new folds — the Player-level ones as units, the
// rng- and Combat-driven ones through the LIVE game.

import { ALL_BOON_IDS, BOON_TUNING, BOONS, GREAT_BOON_IDS } from '@/games/dungeon-crawl/data/boons';
import { ALL_CLASS_IDS, CLASSES } from '@/games/dungeon-crawl/data/classes';
import { PLAYER } from '@/games/dungeon-crawl/data/constants';
import {
  ENEMY_CONFIGS,
  EnemyTypeId,
  MORALE,
  moraleBreakChance,
  spawnWeightsForFloor,
} from '@/games/dungeon-crawl/data/enemies';
import { ALL_PLANE_IDS } from '@/games/dungeon-crawl/data/planes';
import {
  LEVEL_CAP,
  LEVEL_CURVE,
  LEVEL_GAINS,
  levelForXp,
  PROGRESSION,
  xpIntoLevel,
} from '@/games/dungeon-crawl/data/progression';
import { QUESTS } from '@/games/dungeon-crawl/data/quests';
import { STAT_BASES } from '@/games/dungeon-crawl/data/stats';
import { DungeonCrawlGame } from '@/games/dungeon-crawl/DungeonCrawlGame';
import { Rng } from '@/games/dungeon-crawl/dungeon/rng';
import { Enemy } from '@/games/dungeon-crawl/entities/Enemy';
import { Player } from '@/games/dungeon-crawl/entities/Player';
import {
  CharacterStore,
  SavedHero,
  SavePayloadV2,
} from '@/games/dungeon-crawl/persistence/CharacterStore';
import { ProgressionController } from '@/games/dungeon-crawl/progression/ProgressionController';
import { initGame, type Harness } from '@/games/shared/gameTestHarness';

/** Wave Q2 — everything that lives past the gate, derived from the tables. */
const PLANAR_TYPE_IDS = new Set<EnemyTypeId>(
  ALL_PLANE_IDS.flatMap(id => spawnWeightsForFloor(1, id).map(r => r.type)),
);

let randomSpy: jest.SpyInstance;
beforeEach(() => {
  randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.42);
});
afterEach(() => {
  randomSpy.mockRestore();
});

function hero(overrides: Partial<SavedHero> = {}): SavedHero {
  const classId = overrides.classId ?? 'fighter';
  return {
    classId,
    name: 'SIR ROWAN',
    level: 3,
    xp: 450,
    boons: {},
    createdAt: 0,
    stats: { expeditions: 1, deaths: 0, victories: 0 },
    gold: 0,
    gear: {},
    provisions: [],
    sagas: {},
    spells: [],
    scores: { ...STAT_BASES[classId] },
    equipment: {},
    stash: [],
    lineage: 'human',
    hpRolls: [6, 6],
    curse: null,
    ascended: false,
    ...overrides,
  };
}

function saveRoster(store: CharacterStore, heroes: SavedHero[]): void {
  const characters: SavePayloadV2['characters'] = {};
  for (const h of heroes) characters[h.classId] = h;
  window.localStorage.setItem(store.key(), JSON.stringify({ version: 2, characters }));
}

/** A controller with one hero already active, at the level we want to draft from. */
function controllerAt(level: number, classId: SavedHero['classId'] = 'fighter'): ProgressionController {
  const store = new CharacterStore();
  const rolls = Array.from({ length: level - 1 }, () => 5);
  saveRoster(store, [hero({ classId, level, hpRolls: rolls })]);
  const progression = new ProgressionController();
  progression.load();
  progression.selectHero(classId);
  return progression;
}

/** Every boon a hero at this level could be OFFERED (drafts are only 3 wide). */
function draftablePool(progression: ProgressionController): Set<string> {
  const seen = new Set<string>();
  for (let seed = 1; seed <= 250; seed++) {
    for (const pick of progression.draftChoices(new Rng(seed))) {
      if (pick.kind === 'boon') seen.add(pick.id);
    }
  }
  return seen;
}

function freshPlayer(boons: Partial<Record<string, number>> = {}): Player {
  const player = new Player();
  player.reset(0, 0);
  player.applyKit(CLASSES.fighter);
  player.applyProgression({ hp: 0, speed: 0, daggerCap: 0 }, boons as never);
  return player;
}

// ------------------------------------------------------------- the curve

describe('the ascent curve', () => {
  test('the cap is 20 and the curve spans it, still monotone', () => {
    expect(LEVEL_CAP).toBe(20);
    expect(LEVEL_CURVE).toHaveLength(LEVEL_CAP + 1);
    for (let n = 2; n <= LEVEL_CAP; n++) {
      expect(LEVEL_CURVE[n]).toBeGreaterThan(LEVEL_CURVE[n - 1]);
    }
  });

  test('the dungeon-era rows 1-10 are untouched', () => {
    // The pre-Wave-Q1 curve, verbatim: a level-10 veteran must sit exactly
    // where it always sat.
    expect(LEVEL_CURVE.slice(0, 11)).toEqual([
      0, 0, 150, 400, 800, 1400, 2200, 3200, 4500, 6200, 8400,
    ]);
  });

  test('each ascent step costs more than the one before it', () => {
    for (let n = 12; n <= LEVEL_CAP; n++) {
      const step = LEVEL_CURVE[n] - LEVEL_CURVE[n - 1];
      const prev = LEVEL_CURVE[n - 1] - LEVEL_CURVE[n - 2];
      expect(step).toBeGreaterThan(prev);
    }
  });

  test('levelForXp reaches — and stops at — 20', () => {
    expect(levelForXp(LEVEL_CURVE[11] - 1)).toBe(10);
    expect(levelForXp(LEVEL_CURVE[11])).toBe(11);
    expect(levelForXp(LEVEL_CURVE[20])).toBe(20);
    expect(levelForXp(LEVEL_CURVE[20] * 10)).toBe(20);
  });

  test('the XP bar fills at the new cap, not the old one', () => {
    expect(xpIntoLevel(LEVEL_CURVE[10], 10).frac).toBeLessThan(1);
    expect(xpIntoLevel(LEVEL_CURVE[20], 20).frac).toBe(1);
  });

  test('nineteen gain rows per class, HP still left to the hit die', () => {
    for (const classId of ALL_CLASS_IDS) {
      expect(LEVEL_GAINS[classId]).toHaveLength(LEVEL_CAP - 1);
      for (const row of LEVEL_GAINS[classId]) expect(row.hp).toBeUndefined();
    }
  });

  test('the ascent keeps each class row-grammar: thief thirds, mage halves', () => {
    // Rows are 0-indexed by "reaching level i + 2".
    const strideLevels = LEVEL_GAINS.thief
      .map((row, i) => (row.speed ? i + 2 : 0))
      .filter(Boolean);
    expect(strideLevels).toEqual([3, 6, 9, 11, 14, 17]);
    const poolLevels = LEVEL_GAINS.mage
      .map((row, i) => (row.daggerCap ? i + 2 : 0))
      .filter(Boolean);
    expect(poolLevels).toEqual([2, 4, 6, 8, 10, 11, 13, 15, 17, 19]);
  });

  test('a god-rolled level-20 pool still fits under the safety ceiling', () => {
    for (const classId of ALL_CLASS_IDS) {
      const die = CLASSES[classId].kit.hitDie;
      expect(die + (LEVEL_CAP - 1) * die).toBeLessThanOrEqual(PLAYER.HP_CAP);
    }
  });

  test('level pressure now climbs past the old ceiling — but only after 10', () => {
    const store = new CharacterStore();
    saveRoster(store, [hero({ level: 10, hpRolls: Array(9).fill(5) })]);
    const at10 = new ProgressionController();
    at10.load();
    at10.selectHero('fighter');
    // Unchanged from the dungeon era: 1 + 0.05 * 9 = 1.45, the OLD cap exactly.
    expect(at10.levelPressure()).toBeCloseTo(1.45, 5);
    expect(PROGRESSION.PRESSURE_HP_CAP).toBeGreaterThan(1.45);
  });
});

// ------------------------------------------------------------- the band gate

describe('THE GREAT BOONS: the band gate', () => {
  test('ten great boons, all banded above level 1 and fully authored', () => {
    expect(ALL_BOON_IDS).toHaveLength(20);
    expect(GREAT_BOON_IDS).toHaveLength(10);
    for (const id of GREAT_BOON_IDS) {
      const def = BOONS[id];
      expect(def.minLevel).toBeGreaterThanOrEqual(11);
      expect(def.minLevel).toBeLessThanOrEqual(LEVEL_CAP);
      expect(def.name.length).toBeGreaterThan(0);
      expect(def.blurb.length).toBeGreaterThan(0);
      expect(def.color).toMatch(/^#/);
    }
  });

  test('THE PROMISE: the ten original boons stay unbanded and classless', () => {
    const original = ALL_BOON_IDS.filter(id => !GREAT_BOON_IDS.includes(id));
    expect(original).toHaveLength(10);
    for (const id of original) {
      expect(BOONS[id].minLevel).toBeUndefined();
      expect(BOONS[id].classId).toBeUndefined();
    }
  });

  test('a hero reaching level 10 is never offered a great boon', () => {
    const pool = draftablePool(controllerAt(9));
    for (const id of GREAT_BOON_IDS) expect(pool.has(id)).toBe(false);
    // ...and the old cards are all still there.
    expect(pool.has('toughness')).toBe(true);
  });

  test('a hero reaching level 11 opens the band', () => {
    const pool = draftablePool(controllerAt(10));
    expect(pool.has('hardiness')).toBe(true);
    expect(pool.has('dread')).toBe(true);
    // ...but only the band it has actually reached.
    expect(pool.has('inner-focus')).toBe(false); // 13
    expect(pool.has('signature-item')).toBe(false); // 15
  });

  test('the deeper bands open in turn', () => {
    expect(draftablePool(controllerAt(12)).has('inner-focus')).toBe(true);
    expect(draftablePool(controllerAt(14)).has('signature-item')).toBe(true);
  });

  test('a class-keyed boon reaches only its own class', () => {
    const cases: Array<[SavedHero['classId'], string, string]> = [
      ['fighter', 'breech', 'evasion'],
      ['thief', 'evasion', 'breech'],
      ['cleric', 'smite', 'spell-sculpting'],
      ['mage', 'spell-sculpting', 'smite'],
    ];
    for (const [classId, mine, theirs] of cases) {
      const pool = draftablePool(controllerAt(15, classId));
      expect(pool.has(mine)).toBe(true);
      expect(pool.has(theirs)).toBe(false);
    }
  });

  test('a maxed great boon leaves the pool like any other', () => {
    const store = new CharacterStore();
    saveRoster(
      store,
      [hero({ level: 15, hpRolls: Array(14).fill(5), boons: { hardiness: 2 } })],
    );
    const progression = new ProgressionController();
    progression.load();
    progression.selectHero('fighter');
    expect(draftablePool(progression).has('hardiness')).toBe(false);
  });
});

// ------------------------------------------------------------- the save

describe('the save contract at the new cap', () => {
  test('level 20 survives sanitize; 21 drops the hero', () => {
    const store = new CharacterStore();
    saveRoster(store, [hero({ level: 20, hpRolls: Array(19).fill(6) })]);
    expect(store.load().characters.fighter?.level).toBe(20);

    saveRoster(store, [hero({ level: 21, hpRolls: Array(20).fill(6) })]);
    expect(store.load().characters.fighter).toBeUndefined();
  });

  test('a level-10 veteran keeps its nine kept rolls and climbs from there', () => {
    const store = new CharacterStore();
    saveRoster(store, [hero({ level: 10, xp: 8400, hpRolls: [7, 3, 9, 5, 5, 8, 2, 6, 6] })]);
    const progression = new ProgressionController();
    progression.load();
    const veteran = progression.heroFor('fighter')!;
    expect(veteran.hpRolls).toEqual([7, 3, 9, 5, 5, 8, 2, 6, 6]);

    progression.selectHero('fighter');
    // The ascent is now reachable where before the bar was full and done.
    expect(progression.pendingLevelUp()).toBe(false);
    progression.grantXp(LEVEL_CURVE[11] - 8400);
    expect(progression.pendingLevelUp()).toBe(true);
    const { level } = progression.confirmLevelUp(null, 8);
    expect(level).toBe(11);
    expect(progression.heroFor('fighter')!.hpRolls).toHaveLength(10);
  });

  test('sanitize does NOT band-check — a learned boon stays learned', () => {
    // The Wave J rule: banding is a DRAFT rule, not a save rule.
    const store = new CharacterStore();
    saveRoster(store, [hero({ level: 2, hpRolls: [5], boons: { hardiness: 1 } })]);
    expect(store.load().characters.fighter?.boons.hardiness).toBe(1);
  });
});

// ------------------------------------------------------------- the folds

describe('the folds (unit)', () => {
  test('HARDINESS soaks per stack but a blow always lands', () => {
    expect(freshPlayer().takeDamage(5)).toBe(5);
    expect(freshPlayer({ hardiness: 1 }).takeDamage(5)).toBe(5 - BOON_TUNING.HARDINESS_SOAK);
    expect(freshPlayer({ hardiness: 2 }).takeDamage(5)).toBe(5 - 2 * BOON_TUNING.HARDINESS_SOAK);
    // Never to nothing — the floor is 1, however deep the training runs.
    expect(freshPlayer({ hardiness: 2 }).takeDamage(1)).toBe(1);
  });

  test('HARDINESS touches only the wound, not the grace after it', () => {
    const plain = freshPlayer();
    const hardy = freshPlayer({ hardiness: 2 });
    plain.takeDamage(4);
    hardy.takeDamage(4);
    expect(hardy.invuln).toBeCloseTo(plain.invuln, 6);
    expect(hardy.speed()).toBeCloseTo(plain.speed(), 6);
  });

  test('INNER FOCUS shortens every page, for every class', () => {
    const plain = freshPlayer();
    const focused = freshPlayer({ 'inner-focus': 2 });
    expect(plain.spellCooldownFull(10)).toBeCloseTo(10, 6);
    expect(focused.spellCooldownFull(10)).toBeCloseTo(
      10 * BOON_TUNING.INNER_FOCUS_SPELL_CD_MULT ** 2,
      6,
    );
  });

  test('SHADOW STEP opens a hidden window on the dash; without it, none', () => {
    const plain = freshPlayer();
    plain.tryDash(1, 0);
    expect(plain.hiddenTimer).toBe(0);

    const stepper = freshPlayer({ 'shadow-step': 1 });
    stepper.tryDash(1, 0);
    expect(stepper.hiddenTimer).toBeCloseTo(BOON_TUNING.SHADOW_STEP_WINDOW, 6);
  });

  test('DREAD raises the pack break chance — and the cap still has the last word', () => {
    const base = moraleBreakChance(1, 1, 4, 4);
    expect(moraleBreakChance(1, 1, 4, 4, BOON_TUNING.DREAD_MORALE_BONUS)).toBeCloseTo(
      base + BOON_TUNING.DREAD_MORALE_BONUS,
      6,
    );
    expect(moraleBreakChance(20, 1, 1, 8, 5)).toBe(MORALE.CHANCE_CAP);
    // The law is unchanged when no one is afraid of you.
    expect(moraleBreakChance(3, 2, 4, 4, 0)).toBe(base + MORALE.HERO_LEVEL_BONUS);
  });

  test('WARDED in the DEPTHS is a deliberate, pinned set — the half-real only', () => {
    // Wave Q2 — CONSCIOUS narrowing: the flag was widened past the gate (that
    // is the whole point of BREECH), so this pins the DUNGEON's three, which
    // must not drift. The planar side is pinned in planes.test.
    const dungeonWarded = (Object.keys(ENEMY_CONFIGS) as EnemyTypeId[]).filter(
      id => ENEMY_CONFIGS[id].warded && !PLANAR_TYPE_IDS.has(id),
    );
    expect(new Set(dungeonWarded)).toEqual(new Set(['wraith', 'shade', 'gargoyle']));
  });
});

// ------------------------------------------------------------- live harness

interface GameInternals {
  departOnQuest(quest: (typeof QUESTS)[keyof typeof QUESTS]): void;
  state: string;
  player: Player;
  rng: { next(): number };
  damagePlayer(amount: number, cause: string): void;
  combat: {
    hitEnemy(enemy: Enemy, damage: number, source: 'sword' | 'dagger' | 'ability'): void;
    turnUndead(): void;
  };
  enemies: Enemy[];
}

function internals(h: Harness): GameInternals {
  return h.game as unknown as GameInternals;
}

function metrics(h: Harness): Record<string, number> {
  return h.game.getScore!() as unknown as Record<string, number>;
}

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

/** Title -> roster digit -> human bloodline, landing in Lastlight. */
function startWithClass(h: Harness, digit: string): Set<string> {
  const held = wireHeldKeys(h);
  held.add('Space');
  h.game.update(1 / 60);
  held.clear();
  h.game.update(1 / 60);
  held.add(digit);
  h.game.update(1 / 60);
  held.clear();
  h.game.update(1 / 60);
  held.add('Digit1');
  h.game.update(1 / 60);
  held.clear();
  h.game.update(1 / 60);
  return held;
}

/** Through the gate onto floor 1: depart, sit out the DM lockout, dismiss. */
function enterDepths(h: Harness, held: Set<string>): GameInternals {
  const game = internals(h);
  game.departOnQuest(QUESTS.endless);
  for (let i = 0; i < 70; i++) h.game.update(1 / 60);
  held.add('Space');
  h.game.update(1 / 60);
  held.clear();
  h.game.update(1 / 60);
  expect(game.state).toBe('playing');
  return game;
}

function forceRolls(game: GameInternals, rolls: number[]): void {
  const queue = [...rolls];
  game.rng.next = () => queue.shift() ?? 0.9;
}

/** Grant a boon to the ARMED player mid-run (the gainBoon path). */
function grant(game: GameInternals, id: string, times = 1): void {
  for (let i = 0; i < times; i++) game.player.gainBoon(id as never);
}

// ------------------------------------------------------------- live folds

describe('the folds (through the live game)', () => {
  test('EVASION shrugs a blast whole — and the number never lies about it', () => {
    const h = initGame(new DungeonCrawlGame());
    const game = enterDepths(h, startWithClass(h, 'Digit2')); // thief
    grant(game, 'evasion');
    const before = game.player.hp;
    forceRolls(game, [0]); // inside EVASION_CHANCE
    game.damagePlayer(3, 'explosion');
    expect(game.player.hp).toBe(before);
  });

  test('EVASION answers the trap and the boom, never a creature', () => {
    const h = initGame(new DungeonCrawlGame());
    const game = enterDepths(h, startWithClass(h, 'Digit2'));
    grant(game, 'evasion');
    const before = game.player.hp;
    forceRolls(game, [0, 0, 0]); // would evade if the cause allowed it
    game.damagePlayer(3, 'skeleton'); // a blow from a living thing
    expect(game.player.hp).toBeLessThan(before);
  });

  test('HARDINESS shows the ACTUAL wound, not the raw roll (Wave L)', () => {
    const h = initGame(new DungeonCrawlGame());
    const game = enterDepths(h, startWithClass(h, 'Digit1'));
    grant(game, 'hardiness', 2);
    const before = game.player.hp;
    game.damagePlayer(5, 'skeleton');
    expect(before - game.player.hp).toBe(5 - 2 * BOON_TUNING.HARDINESS_SOAK);
  });

  test('BREECH bites the warded and leaves everything else alone', () => {
    const h = initGame(new DungeonCrawlGame());
    const game = enterDepths(h, startWithClass(h, 'Digit1')); // fighter
    forceRolls(game, [0.99]); // never a death blow

    const plainWraith = new Enemy('wraith', game.player.x + 10, game.player.y);
    plainWraith.hp = 40;
    game.combat.hitEnemy(plainWraith, 3, 'sword');
    const plainDealt = 40 - plainWraith.hp;

    grant(game, 'breech');
    forceRolls(game, [0.99]);
    const wraith = new Enemy('wraith', game.player.x + 10, game.player.y);
    wraith.hp = 40;
    game.combat.hitEnemy(wraith, 3, 'sword');
    expect(40 - wraith.hp).toBe(plainDealt + BOON_TUNING.BREECH_DAMAGE);

    // An ordinary foe feels nothing.
    forceRolls(game, [0.99]);
    const skeleton = new Enemy('skeleton', game.player.x + 10, game.player.y);
    skeleton.hp = 40;
    game.combat.hitEnemy(skeleton, 3, 'sword');
    expect(40 - skeleton.hp).toBe(plainDealt);
  });

  test('DEATH BLOW fells through the REAL kill path — the metric counts it', () => {
    const h = initGame(new DungeonCrawlGame());
    const game = enterDepths(h, startWithClass(h, 'Digit1'));
    grant(game, 'death-blow');
    const slainBefore = metrics(h).enemies_slain;

    const victim = new Enemy('skeleton', game.player.x + 10, game.player.y);
    victim.hp = 99; // far past anything a single blow should manage
    game.enemies.push(victim);
    forceRolls(game, [0]); // the stroke lands
    game.combat.hitEnemy(victim, 1, 'sword');

    expect(victim.alive).toBe(false);
    // The metric bag is rebuilt each frame — tick once to read it.
    h.game.update(1 / 60);
    expect(metrics(h).enemies_slain).toBe(slainBefore + 1);
  });

  test('DEATH BLOW spares elites, and a dagger never carries it', () => {
    const h = initGame(new DungeonCrawlGame());
    const game = enterDepths(h, startWithClass(h, 'Digit1'));
    grant(game, 'death-blow');

    const elite = new Enemy('skeleton', game.player.x + 10, game.player.y, 'bulwark');
    elite.hp = 99;
    forceRolls(game, [0]);
    game.combat.hitEnemy(elite, 1, 'sword');
    expect(elite.alive).toBe(true);

    const thrown = new Enemy('skeleton', game.player.x + 10, game.player.y);
    thrown.hp = 99;
    forceRolls(game, [0]);
    game.combat.hitEnemy(thrown, 1, 'dagger');
    expect(thrown.alive).toBe(true);
  });

  test('SMITE makes the turning wave bite the living', () => {
    const h = initGame(new DungeonCrawlGame());
    const game = enterDepths(h, startWithClass(h, 'Digit3')); // cleric

    // A LIVING foe (the lizardman) — the undead already take the wave's bite.
    const alive = new Enemy('lizardman', game.player.x + 10, game.player.y);
    alive.hp = 40;
    game.enemies.length = 0;
    game.enemies.push(alive);
    game.combat.turnUndead();
    expect(alive.hp).toBe(40); // shoved only, as it always was

    grant(game, 'smite');
    const smitten = new Enemy('lizardman', game.player.x + 10, game.player.y);
    smitten.hp = 40;
    game.enemies.length = 0;
    game.enemies.push(smitten);
    game.combat.turnUndead();
    expect(smitten.hp).toBe(40 - BOON_TUNING.SMITE_DAMAGE);
  });

  test('SMITE never robs the undead of the turning they already feared', () => {
    const h = initGame(new DungeonCrawlGame());
    const game = enterDepths(h, startWithClass(h, 'Digit3'));

    const bones = new Enemy('skeleton', game.player.x + 10, game.player.y);
    bones.hp = 40;
    game.enemies.length = 0;
    game.enemies.push(bones);
    game.combat.turnUndead();
    const plainBite = 40 - bones.hp;
    expect(plainBite).toBeGreaterThan(0);
    expect(bones.stunned).toBeGreaterThan(0);

    grant(game, 'smite');
    const bones2 = new Enemy('skeleton', game.player.x + 10, game.player.y);
    bones2.hp = 40;
    game.enemies.length = 0;
    game.enemies.push(bones2);
    game.combat.turnUndead();
    expect(40 - bones2.hp).toBe(plainBite); // the undead branch is untouched
  });

  test('SIGNATURE ITEM deepens what is worn — through the real worn set', () => {
    const h = initGame(new DungeonCrawlGame());
    const game = enterDepths(h, startWithClass(h, 'Digit1'));
    const bare = game.player.swordDamage();

    // DAWNSLIVER is a real find: +2 damage in the weapon slot.
    const inner = h.game as unknown as {
      inventory: { equipped: Record<string, string> };
      refreshItemFolds(): void;
    };
    inner.inventory.equipped.weapon = 'dawnsliver';
    inner.refreshItemFolds();
    expect(game.player.swordDamage()).toBe(bare + 2);

    grant(game, 'signature-item');
    inner.refreshItemFolds();
    expect(game.player.swordDamage()).toBe(
      bare + Math.round(2 * BOON_TUNING.SIGNATURE_ITEM_MULT),
    );

    // Untrained, the merge is bit-for-bit what it always was.
    const inv = (h.game as unknown as {
      inventory: { mergedEffects(mult?: number): { damage: number } };
    }).inventory;
    expect(inv.mergedEffects()).toEqual(inv.mergedEffects(1));
  });

  test('SPELL SCULPTING widens the working, never its damage', () => {
    const h = initGame(new DungeonCrawlGame());
    const game = enterDepths(h, startWithClass(h, 'Digit4')); // mage
    const combat = (h.game as unknown as {
      combat: {
        bombs: Array<{ boom: { radius: number; damage: number } }>;
        castSpell(id: string, scholarMult: number, sculptMult?: number): void;
      };
    }).combat;

    combat.castSpell('burning-hands', 1);
    const plain = { ...combat.bombs[combat.bombs.length - 1].boom };

    combat.castSpell('burning-hands', 1, BOON_TUNING.SPELL_SCULPT_MULT);
    const sculpted = combat.bombs[combat.bombs.length - 1].boom;

    expect(sculpted.radius).toBeCloseTo(plain.radius * BOON_TUNING.SPELL_SCULPT_MULT, 6);
    expect(sculpted.damage).toBe(plain.damage); // reach and count only

    // ...and the scalar handed in comes from the stacks the hero holds.
    expect(game.player.sculptMult()).toBe(1);
    grant(game, 'spell-sculpting', 2);
    expect(game.player.sculptMult()).toBeCloseTo(BOON_TUNING.SPELL_SCULPT_MULT ** 2, 6);
  });
});
