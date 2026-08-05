// Wave O tests: THE TEMPLE AND THE CURSE. Pins the curse data contract, the
// four Player maluses (the relic-read idiom: one fold each), the SavedHero
// curse sanitize, and — in later steps — the shrine veil rolls, the cling at
// run end, and the temple station's services through the live game.

import {
  ALL_CURSE_IDS,
  asCurseId,
  CURSE_TUNING,
  CURSES,
  CurseId,
} from '@/games/dungeon-crawl/data/curses';
import { PROVISION_TUNING } from '@/games/dungeon-crawl/data/gear';
import { QUESTS } from '@/games/dungeon-crawl/data/quests';
import { Enemy } from '@/games/dungeon-crawl/entities/Enemy';
import { Hireling } from '@/games/dungeon-crawl/entities/Hireling';
import { STAT_BASES } from '@/games/dungeon-crawl/data/stats';
import { Tile } from '@/games/dungeon-crawl/dungeon/TileMap';
import { DungeonCrawlGame } from '@/games/dungeon-crawl/DungeonCrawlGame';
import { Pickup } from '@/games/dungeon-crawl/entities/Pickup';
import { Player } from '@/games/dungeon-crawl/entities/Player';
import {
  CharacterStore,
  SavedHero,
  SavePayloadV2,
} from '@/games/dungeon-crawl/persistence/CharacterStore';
import { initGame, type Harness } from '@/games/shared/gameTestHarness';

let randomSpy: jest.SpyInstance;
beforeEach(() => {
  randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.42);
});
afterEach(() => {
  randomSpy.mockRestore();
});

/** A complete fighter hero record for sanitize round-trips. */
function fighterHero(overrides: Partial<SavedHero> = {}): SavedHero {
  return {
    classId: 'fighter',
    name: 'SIR ROWAN',
    level: 3,
    xp: 450,
    boons: {},
    createdAt: 0,
    stats: { expeditions: 1, deaths: 0, victories: 0 },
    gold: 200,
    gear: {},
    provisions: [],
    sagas: {},
    spells: [],
    scores: { ...STAT_BASES.fighter },
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

// ------------------------------------------------------------- data contract

describe('the curse data contract', () => {
  test('four curses, each fully authored', () => {
    expect(ALL_CURSE_IDS).toHaveLength(4);
    for (const id of ALL_CURSE_IDS) {
      const curse = CURSES[id];
      expect(curse.id).toBe(id);
      expect(curse.name.length).toBeGreaterThan(0);
      expect(curse.blurb.length).toBeGreaterThan(0);
      expect(curse.icon.length).toBeGreaterThan(0);
      expect(curse.color).toMatch(/^#/);
    }
  });

  test('asCurseId keeps real ids and lands everything else unburdened', () => {
    for (const id of ALL_CURSE_IDS) expect(asCurseId(id)).toBe(id);
    expect(asCurseId('grave-rot')).toBeNull();
    expect(asCurseId(undefined)).toBeNull();
    expect(asCurseId(7)).toBeNull();
  });

  test('the tuning stays in sane bands', () => {
    expect(CURSE_TUNING.VEIL_CHANCE).toBeGreaterThan(0);
    expect(CURSE_TUNING.VEIL_CHANCE).toBeLessThan(1);
    expect(CURSE_TUNING.CURSE_CHANCE).toBeGreaterThan(0);
    expect(CURSE_TUNING.CURSE_CHANCE).toBeLessThan(1);
    expect(CURSE_TUNING.LEADEN_SPEED_MULT).toBeGreaterThan(0);
    expect(CURSE_TUNING.LEADEN_SPEED_MULT).toBeLessThan(1);
    expect(CURSE_TUNING.MISER_GOLD_MULT).toBeGreaterThan(0);
    expect(CURSE_TUNING.MISER_GOLD_MULT).toBeLessThan(1);
    expect(CURSE_TUNING.LIFT_PRICE_BASE).toBeGreaterThan(0);
    expect(CURSE_TUNING.LIFT_PRICE_PER_LEVEL).toBeGreaterThan(0);
  });
});

// ------------------------------------------------------------- player maluses

describe('the four maluses fold like relic reads', () => {
  function freshPlayer(): Player {
    const player = new Player();
    player.reset(0, 0);
    return player;
  }

  test('LEADEN BLOOD drags the stride by exactly its multiplier', () => {
    const player = freshPlayer();
    const clean = player.speed();
    player.applyCurse('leaden-blood');
    expect(player.speed()).toBeCloseTo(clean * CURSE_TUNING.LEADEN_SPEED_MULT);
    player.applyCurse(null);
    expect(player.speed()).toBeCloseTo(clean);
  });

  test('THE DIMMING pulls the torch in one radius step', () => {
    const player = freshPlayer();
    const clean = player.torchBonus();
    player.applyCurse('dim-sight');
    expect(player.torchBonus()).toBe(clean - CURSE_TUNING.DIM_TORCH_MALUS);
  });

  test('THE HUNGRY WOUND drinks from heart heals; the chrism gives back', () => {
    const player = freshPlayer();
    const clean = player.heartHealBonus();
    player.applyCurse('hungry-wound');
    expect(player.heartHealBonus()).toBe(clean - CURSE_TUNING.HUNGRY_HEAL_MALUS);
    player.chrismHeal = 1;
    expect(player.heartHealBonus()).toBe(clean - CURSE_TUNING.HUNGRY_HEAL_MALUS + 1);
  });

  test("THE MISER'S SHADOW thins the gold multiplier", () => {
    const player = freshPlayer();
    const clean = player.goldDropMult();
    player.applyCurse('misers-shadow');
    expect(player.goldDropMult()).toBeCloseTo(clean * CURSE_TUNING.MISER_GOLD_MULT);
  });

  test('each curse touches ONLY its own stat', () => {
    const player = freshPlayer();
    const clean = {
      speed: player.speed(),
      torch: player.torchBonus(),
      heal: player.heartHealBonus(),
      gold: player.goldDropMult(),
    };
    player.applyCurse('leaden-blood');
    expect(player.torchBonus()).toBe(clean.torch);
    expect(player.heartHealBonus()).toBe(clean.heal);
    expect(player.goldDropMult()).toBeCloseTo(clean.gold);
    player.applyCurse('misers-shadow');
    expect(player.speed()).toBeCloseTo(clean.speed);
  });

  test('reset() leaves a fresh, unburdened body', () => {
    const player = freshPlayer();
    player.applyCurse('leaden-blood');
    player.veiledRelics.push('ember-blade');
    player.blessWard = true;
    player.augury = true;
    player.chrismHeal = 1;
    player.reset(0, 0);
    expect(player.curse).toBeNull();
    expect(player.veiledRelics).toHaveLength(0);
    expect(player.blessWard).toBe(false);
    expect(player.augury).toBe(false);
    expect(player.chrismHeal).toBe(0);
  });
});

// ------------------------------------------------------------- live harness

interface GameInternals {
  departOnQuest(quest: (typeof QUESTS)[keyof typeof QUESTS]): void;
  state: string;
  player: Player;
  rng: { next(): number };
  pickupResolver: { collectPickup(pickup: Pickup): void };
  damagePlayer(amount: number, cause: string): void;
  progression: { recordDeath(curse: CurseId | null): void; character(): SavedHero | null };
  quests: { openVictory(): string };
  town: {
    overlay: string;
    selection: number;
    spots: Record<string, { x: number; y: number }>;
    plan: { map: { get(tx: number, ty: number): number } };
  };
  hireling: Hireling | null;
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

/** Turn the title page, pick a class by digit, forge a HUMAN — Lastlight. */
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

/** Feed the live rng a fixed roll sequence (then a tail of 0.9s). */
function forceRolls(game: GameInternals, rolls: number[]): void {
  const queue = [...rolls];
  game.rng.next = () => queue.shift() ?? 0.9;
}

function collectShrine(game: GameInternals): void {
  game.pickupResolver.collectPickup(new Pickup('relic-shrine', game.player.x, game.player.y));
}

// ------------------------------------------------------------- the veil

describe('the veil at the shrine', () => {
  test('both metric keys exist from the first frame', () => {
    const h = initGame(new DungeonCrawlGame());
    expect(metrics(h)).toHaveProperty('curses_suffered', 0);
    expect(metrics(h)).toHaveProperty('curses_lifted', 0);
  });

  test('an unveiled find grants a named relic exactly as before', () => {
    const h = initGame(new DungeonCrawlGame());
    const game = enterDepths(h, startWithClass(h, 'Digit1'));
    forceRolls(game, [0.9, 0]); // no veil, pick the first relic
    collectShrine(game);
    h.game.update(1 / 60);
    expect(game.player.relicCount('ember-blade')).toBe(1);
    expect(game.player.veiledRelics).toHaveLength(0);
    expect(metrics(h).relics_collected).toBe(1);
  });

  test('a veiled-but-true find grants the power with the name hidden', () => {
    const h = initGame(new DungeonCrawlGame());
    const game = enterDepths(h, startWithClass(h, 'Digit1'));
    forceRolls(game, [0.2, 0.9, 0]); // veiled, not cursed, first relic
    collectShrine(game);
    h.game.update(1 / 60);
    expect(game.player.relicCount('ember-blade')).toBe(1);
    expect(game.player.veiledRelics).toEqual(['ember-blade']);
    expect(game.player.identifiedRelicCount('ember-blade')).toBe(0);
    expect(metrics(h).relics_collected).toBe(1); // a real relic still counts
    expect(metrics(h).curses_suffered).toBe(0);
  });

  test('a cursed find seizes the hero: no relic, one metric count', () => {
    const h = initGame(new DungeonCrawlGame());
    const game = enterDepths(h, startWithClass(h, 'Digit1'));
    forceRolls(game, [0.2, 0.1, 0]); // veiled, CURSED, first curse
    collectShrine(game);
    h.game.update(1 / 60);
    expect(game.player.curse).toBe('leaden-blood');
    expect(game.player.relics.size).toBe(0);
    expect(metrics(h).relics_collected).toBe(0);
    expect(metrics(h).curses_suffered).toBe(1);
  });

  test('a second curse cannot land — the first holds its grip', () => {
    const h = initGame(new DungeonCrawlGame());
    const game = enterDepths(h, startWithClass(h, 'Digit1'));
    forceRolls(game, [0.2, 0.1, 0.9]); // seize: veil, curse, pick LAST curse
    collectShrine(game);
    const first = game.player.curse;
    expect(first).not.toBeNull();
    forceRolls(game, [0.2, 0.1]); // a second lie reaches for the hero
    collectShrine(game);
    h.game.update(1 / 60);
    expect(game.player.curse).toBe(first);
    expect(metrics(h).curses_suffered).toBe(1); // counted once, not twice
  });

  test('the warding chrism burns the curse away and cleanses the relic', () => {
    const h = initGame(new DungeonCrawlGame());
    const game = enterDepths(h, startWithClass(h, 'Digit1'));
    game.player.blessWard = true;
    forceRolls(game, [0.2, 0.1, 0]); // would-be curse; ward intervenes
    collectShrine(game);
    h.game.update(1 / 60);
    expect(game.player.blessWard).toBe(false); // consumed
    expect(game.player.curse).toBeNull();
    expect(game.player.relicCount('ember-blade')).toBe(1); // named, not veiled
    expect(game.player.veiledRelics).toHaveLength(0);
    expect(metrics(h).curses_suffered).toBe(0);
  });

  test('the augury refuses a lie and names a true find on the spot', () => {
    const h = initGame(new DungeonCrawlGame());
    const game = enterDepths(h, startWithClass(h, 'Digit1'));
    game.player.augury = true;
    forceRolls(game, [0.2, 0.1]); // a lie — refused outright
    collectShrine(game);
    expect(game.player.curse).toBeNull();
    expect(game.player.relics.size).toBe(0);
    forceRolls(game, [0.2, 0.9, 0]); // veiled-but-true — named by the priests
    collectShrine(game);
    h.game.update(1 / 60);
    expect(game.player.relicCount('ember-blade')).toBe(1);
    expect(game.player.veiledRelics).toHaveLength(0);
    expect(metrics(h).curses_suffered).toBe(0);
  });
});

// ------------------------------------------------------------- the cling

describe('the curse clings at run end and rides out again', () => {
  test('death writes the run curse to the hero', () => {
    const h = initGame(new DungeonCrawlGame());
    const game = enterDepths(h, startWithClass(h, 'Digit1'));
    forceRolls(game, [0.2, 0.1, 0]); // seize LEADEN BLOOD
    collectShrine(game);
    expect(game.player.curse).toBe('leaden-blood');
    game.damagePlayer(999, 'hazard');
    for (let i = 0; i < 5; i++) h.game.update(1 / 60);
    expect(game.state).toBe('recap');
    expect(new CharacterStore().load().characters.fighter?.curse).toBe('leaden-blood');
  });

  test('victory banks the gold but never the curse — it clings', () => {
    const h = initGame(new DungeonCrawlGame());
    const game = enterDepths(h, startWithClass(h, 'Digit1'));
    forceRolls(game, [0.2, 0.1, 0.6]); // seize the third curse
    collectShrine(game);
    const seized = game.player.curse;
    expect(seized).not.toBeNull();
    game.quests.openVictory();
    expect(new CharacterStore().load().characters.fighter?.curse).toBe(seized);
  });

  test('a cursed hero is re-armed with the burden at BOTH arm sites', () => {
    const h = initGame(new DungeonCrawlGame());
    const game = enterDepths(h, startWithClass(h, 'Digit1'));
    game.progression.recordDeath('misers-shadow'); // the burden on the record
    // Arm site 1 — the gate (QuestDirector.depart).
    game.departOnQuest(QUESTS.endless);
    expect(game.player.curse).toBe('misers-shadow');
    // Arm site 2 — town resume (DraftFlow.enterTown), on a fresh session.
    const h2 = initGame(new DungeonCrawlGame());
    startWithClass(h2, 'Digit1');
    const game2 = internals(h2);
    expect(game2.state).toBe('town');
    expect(game2.player.curse).toBe('misers-shadow');
  });
});

// ------------------------------------------------------------- the temple

/** Walk up to the temple keeper and open the overlay with E. */
function openTemple(h: Harness, held: Set<string>): GameInternals {
  const game = internals(h);
  expect(game.state).toBe('town');
  game.player.x = game.town.spots.temple.x;
  game.player.y = game.town.spots.temple.y;
  held.add('KeyE');
  h.game.update(1 / 60);
  held.clear();
  h.game.update(1 / 60);
  expect(game.town.overlay).toBe('temple');
  return game;
}

function pressSpace(h: Harness, held: Set<string>): void {
  held.add('Space');
  h.game.update(1 / 60);
  held.clear();
  h.game.update(1 / 60);
}

describe('the temple station', () => {
  test('the keeper stands on open ground before a real chapel', () => {
    const h = initGame(new DungeonCrawlGame());
    startWithClass(h, 'Digit1');
    const game = internals(h);
    const spot = game.town.spots.temple;
    expect(spot).toBeTruthy();
    // The keeper's tile is walkable floor (TILE = 32 world px per tile).
    const tx = Math.floor(spot.x / 32);
    const ty = Math.floor(spot.y / 32);
    expect(game.town.plan.map.get(tx, ty)).toBe(Tile.Floor);
  });

  test('the rite lifts a clinging curse for banked gold, saves, and counts', () => {
    const h = initGame(new DungeonCrawlGame());
    const held = startWithClass(h, 'Digit1');
    const game = internals(h);
    const hero = game.progression.character()!;
    hero.curse = 'dim-sight';
    hero.gold = 500;
    game.player.applyCurse('dim-sight');

    openTemple(h, held);
    pressSpace(h, held); // card 0 — THE RITE OF LIFTING
    expect(hero.curse).toBeNull();
    expect(game.player.curse).toBeNull();
    expect(hero.gold).toBe(500 - (CURSE_TUNING.LIFT_PRICE_BASE + CURSE_TUNING.LIFT_PRICE_PER_LEVEL));
    expect(metrics(h).curses_lifted).toBe(1);
    // The lift persisted (ctx.save() ran).
    expect(new CharacterStore().load().characters.fighter?.curse).toBeNull();
  });

  test('an unburdened hero is turned away in peace — nothing spent', () => {
    const h = initGame(new DungeonCrawlGame());
    const held = startWithClass(h, 'Digit1');
    const game = internals(h);
    const hero = game.progression.character()!;
    hero.gold = 500;

    openTemple(h, held);
    pressSpace(h, held);
    expect(hero.gold).toBe(500);
    expect(metrics(h).curses_lifted).toBe(0);
  });

  test('the priests sell their two wares on the provision path, dedup held', () => {
    const h = initGame(new DungeonCrawlGame());
    const held = startWithClass(h, 'Digit1');
    const game = internals(h);
    const hero = game.progression.character()!;
    hero.gold = 500;

    openTemple(h, held);
    held.add('Digit2'); // card 1 — RITE OF AUGURY
    h.game.update(1 / 60);
    held.clear();
    h.game.update(1 / 60);
    pressSpace(h, held);
    expect(hero.provisions).toContain('rite-of-augury');
    const afterFirst = hero.gold;
    pressSpace(h, held); // ALREADY PACKED — nothing more is taken
    expect(hero.gold).toBe(afterFirst);

    held.add('Digit3'); // card 2 — WARDING CHRISM
    h.game.update(1 / 60);
    held.clear();
    h.game.update(1 / 60);
    pressSpace(h, held);
    expect(hero.provisions).toContain('warding-chrism');
  });

  test('the gate arms both wares and empties the pack', () => {
    const h = initGame(new DungeonCrawlGame());
    startWithClass(h, 'Digit1');
    const game = internals(h);
    const hero = game.progression.character()!;
    hero.provisions = ['rite-of-augury', 'warding-chrism'];

    game.departOnQuest(QUESTS.endless);
    expect(game.player.augury).toBe(true);
    expect(game.player.blessWard).toBe(true);
    expect(game.player.chrismHeal).toBe(PROVISION_TUNING.CHRISM_HEAL_BONUS);
    expect(hero.provisions).toHaveLength(0);
  });
});

// ------------------------------------------------------------- the sellsword

describe('the sellsword (cut-line follower)', () => {
  /** Hire the blade, then walk the gate onto floor 1. */
  function enterWithSellsword(h: Harness): { game: GameInternals; held: Set<string> } {
    const held = startWithClass(h, 'Digit1');
    const game = internals(h);
    game.progression.character()!.provisions = ['sellsword'];
    return { game: enterDepths(h, held), held };
  }

  test('the gate arms the hired blade beside the hero', () => {
    const h = initGame(new DungeonCrawlGame());
    const { game } = enterWithSellsword(h);
    expect(game.hireling?.alive).toBe(true);
    const dist = Math.hypot(
      game.hireling!.x - game.player.x,
      game.hireling!.y - game.player.y,
    );
    expect(dist).toBeLessThan(120);
  });

  test('it strikes through the REAL kill path — the slain foe counts', () => {
    const h = initGame(new DungeonCrawlGame());
    const { game } = enterWithSellsword(h);
    const blade = game.hireling!;
    const victim = new Enemy('slime', blade.x + 12, blade.y);
    victim.hp = 1;
    game.enemies.length = 0;
    game.enemies.push(victim);
    const before = metrics(h).enemies_slain;
    for (let i = 0; i < 4; i++) h.game.update(1 / 60);
    expect(victim.alive).toBe(false);
    expect(metrics(h).enemies_slain).toBe(before + 1);
  });

  test('wading into the pack has teeth — the blade can fall, and stays down', () => {
    const h = initGame(new DungeonCrawlGame());
    const { game } = enterWithSellsword(h);
    const blade = game.hireling!;
    blade.hp = 1;
    const brute = new Enemy('knight', blade.x, blade.y);
    brute.hp = 999; // outlives the strikes long enough to bite
    game.enemies.length = 0;
    game.enemies.push(brute);
    for (let i = 0; i < 10 && blade.alive; i++) h.game.update(1 / 60);
    expect(blade.alive).toBe(false);
    // The fallen blade never rises again this expedition.
    for (let i = 0; i < 5; i++) h.game.update(1 / 60);
    expect(game.hireling?.alive).toBe(false);
  });
});

// ------------------------------------------------------------- save sanitize

describe('SavedHero.curse sanitize', () => {
  test('a real curse survives the round-trip', () => {
    const store = new CharacterStore();
    saveRoster(store, [fighterHero({ curse: 'misers-shadow' })]);
    expect(store.load().characters.fighter?.curse).toBe('misers-shadow');
  });

  test('an unknown curse lands unburdened, not dropped', () => {
    const store = new CharacterStore();
    saveRoster(store, [fighterHero({ curse: 'grave-rot' as unknown as CurseId })]);
    const hero = store.load().characters.fighter;
    expect(hero).toBeTruthy();
    expect(hero?.curse).toBeNull();
  });

  test('a veteran save without the field lands unburdened', () => {
    const store = new CharacterStore();
    const veteran = fighterHero() as Partial<SavedHero>;
    delete veteran.curse;
    saveRoster(store, [veteran as SavedHero]);
    const hero = store.load().characters.fighter;
    expect(hero).toBeTruthy();
    expect(hero?.curse).toBeNull();
  });
});
