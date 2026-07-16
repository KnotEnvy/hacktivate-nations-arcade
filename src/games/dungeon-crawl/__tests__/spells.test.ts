// v4 Wave D tests: the grimoire — spell data contract (class gating), save
// sanitization, level-up draft mixing for casters, casting effects/cooldowns
// through the game, and the Tab character sheet.

import { ALL_BOON_IDS, BOONS } from '@/games/dungeon-crawl/data/boons';
import { ALL_SPELL_IDS, SPELLS, spellNoun, spellsForClass } from '@/games/dungeon-crawl/data/spells';
import { DungeonCrawlGame } from '@/games/dungeon-crawl/DungeonCrawlGame';
import { Rng } from '@/games/dungeon-crawl/dungeon/rng';
import { QUESTS } from '@/games/dungeon-crawl/data/quests';
import { CharacterStore } from '@/games/dungeon-crawl/persistence/CharacterStore';
import { ProgressionController } from '@/games/dungeon-crawl/progression/ProgressionController';
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
  departOnQuest(quest: (typeof QUESTS)[keyof typeof QUESTS]): void;
  castActiveSpell(): void;
  state: string;
  player: { hp: number; spellCooldown(id: string): number };
  progression: { load(): void; selectHero(id: string): void };
  projectiles: unknown[];
}

function internals(h: Harness): GameInternals {
  return h.game as unknown as GameInternals;
}

function metrics(h: Harness): Record<string, number> {
  return h.game.getScore!() as unknown as Record<string, number>;
}

/** Turn the title page, pick a class card by digit, forge a HUMAN — Lastlight. */
function startWithClass(h: Harness, digit: string): Set<string> {
  const held = wireHeldKeys(h);
  // Wave I — turn the title page.
  held.add('Space');
  h.game.update(1 / 60);
  held.clear();
  h.game.update(1 / 60);
  held.add(digit);
  h.game.update(1 / 60); // pick the class -> the bloodline page
  held.clear();
  h.game.update(1 / 60); // releasing arms the lineage digits
  held.add('Digit1');
  h.game.update(1 / 60); // forge a HUMAN (card 1) -> town
  held.clear();
  h.game.update(1 / 60);
  return held;
}

describe('spell data contract', () => {
  test('eighteen authored pages across all four classes (Wave J)', () => {
    expect(ALL_SPELL_IDS).toHaveLength(18);
    for (const id of ALL_SPELL_IDS) {
      const spell = SPELLS[id];
      expect(spell.id).toBe(id);
      expect(spell.name.length).toBeGreaterThan(0);
      expect(spell.blurb.length).toBeGreaterThan(0);
      expect(spell.cooldown).toBeGreaterThan(0);
      expect(spell.minLevel).toBeGreaterThanOrEqual(1);
      expect(['mage', 'cleric', 'fighter', 'thief']).toContain(spell.classId);
    }
    expect(spellsForClass('mage')).toHaveLength(6);
    expect(spellsForClass('cleric')).toHaveLength(6);
    expect(spellsForClass('fighter')).toHaveLength(3);
    expect(spellsForClass('thief')).toHaveLength(3);
  });

  test('level bands: casters keep three day-one pages; every martial page is banded', () => {
    for (const classId of ['mage', 'cleric'] as const) {
      const dayOne = spellsForClass(classId).filter(id => SPELLS[id].minLevel === 1);
      expect(dayOne).toHaveLength(3); // the Wave D grimoire is untouched
    }
    for (const classId of ['fighter', 'thief'] as const) {
      // Techniques all live at bands 4/6/8 — a fresh martial draft stays
      // boons-only exactly as it played before Wave J.
      const bands = spellsForClass(classId)
        .map(id => SPELLS[id].minLevel)
        .sort((a, b) => a - b);
      expect(bands).toEqual([4, 6, 8]);
    }
  });

  test('the discipline noun follows the class', () => {
    expect(spellNoun('mage')).toBe('SPELL');
    expect(spellNoun('cleric')).toBe('SPELL');
    expect(spellNoun('fighter')).toBe('TECHNIQUE');
    expect(spellNoun('thief')).toBe('TECHNIQUE');
  });

  test('sanitize keeps only real, class-legal spells', () => {
    const store = new CharacterStore();
    const controller = new ProgressionController();
    controller.load();
    controller.create('cleric', new Rng(5));
    const payload = store.load();
    (payload.characters.cleric as unknown as { spells: string[] }).spells = [
      'cure-wounds', // legal
      'burning-hands', // mage-only — dropped
      'smoke-bomb', // thief technique — dropped (Wave J rides the same gate)
      'wish', // not a spell — dropped
    ];
    store.save(payload);
    expect(store.load().characters.cleric!.spells).toEqual(['cure-wounds']);

    // A pre-Wave-D hero record (no spells field) sanitizes to an empty book.
    delete (payload.characters.cleric as unknown as Record<string, unknown>).spells;
    store.save(payload);
    expect(store.load().characters.cleric!.spells).toEqual([]);
  });
});

describe('level-up draft mixing', () => {
  test('a caster with every training maxed drafts only spells', () => {
    const controller = new ProgressionController();
    controller.create('mage', new Rng(3));
    const store = new CharacterStore();
    const payload = store.load();
    for (const id of ALL_BOON_IDS) payload.characters.mage!.boons[id] = BOONS[id].maxStacks;
    store.save(payload);
    controller.load();
    controller.selectHero('mage');
    const choices = controller.draftChoices(new Rng(11));
    expect(choices.length).toBe(3);
    expect(choices.every(pick => pick.kind === 'spell')).toBe(true);
  });

  test('level bands gate the draft both ways (Wave J)', () => {
    const controller = new ProgressionController();
    controller.create('mage', new Rng(3));
    const store = new CharacterStore();
    const payload = store.load();
    // Max the training and learn the three day-one pages so ONLY banded
    // pages can appear.
    for (const id of ALL_BOON_IDS) payload.characters.mage!.boons[id] = BOONS[id].maxStacks;
    payload.characters.mage!.spells = ['burning-hands', 'frost-ray', 'blink'];
    store.save(payload);
    controller.load();
    controller.selectHero('mage');

    // Reaching level 2: every deeper page is out of band — the draft is empty.
    expect(controller.draftChoices(new Rng(11))).toHaveLength(0);

    // Reaching level 4: MAGIC MISSILE (band 4) and nothing deeper.
    payload.characters.mage!.level = 3;
    store.save(payload);
    controller.load();
    controller.selectHero('mage');
    expect(controller.draftChoices(new Rng(11))).toEqual([
      { kind: 'spell', id: 'magic-missile' },
    ]);
  });

  test('martial techniques join the draft at their bands (Wave J)', () => {
    const controller = new ProgressionController();
    controller.create('fighter', new Rng(3));
    const store = new CharacterStore();
    const payload = store.load();
    for (const id of ALL_BOON_IDS) payload.characters.fighter!.boons[id] = BOONS[id].maxStacks;
    store.save(payload);
    controller.load();
    controller.selectHero('fighter');

    // Reaching level 2: no technique is in band yet — pre-Wave-J feel intact.
    expect(controller.draftChoices(new Rng(5))).toHaveLength(0);

    // Reaching level 4: WAR CRY arrives, alone.
    payload.characters.fighter!.level = 3;
    store.save(payload);
    controller.load();
    controller.selectHero('fighter');
    expect(controller.draftChoices(new Rng(5))).toEqual([{ kind: 'spell', id: 'war-cry' }]);
  });

  test('confirmLevelUp learns the spell once and persists it', () => {
    const controller = new ProgressionController();
    controller.create('mage', new Rng(3));
    controller.confirmLevelUp({ kind: 'spell', id: 'blink' });
    expect(controller.sessionSpellsLearned).toBe(1);
    expect(controller.character()?.spells).toEqual(['blink']);
    // Learning the same page twice writes it once.
    controller.confirmLevelUp({ kind: 'spell', id: 'blink' });
    expect(controller.character()?.spells).toEqual(['blink']);
    expect(new CharacterStore().load().characters.mage?.spells).toEqual(['blink']);
  });
});

describe('casting through the game', () => {
  test('V-cast heals, counts spells_cast, and honors the cooldown', () => {
    const h = initGame(new DungeonCrawlGame());
    startWithClass(h, 'Digit3'); // cleric
    const game = internals(h);

    // Teach the cleric CURE WOUNDS directly on the save.
    const store = new CharacterStore();
    const payload = store.load();
    payload.characters.cleric!.spells = ['cure-wounds'];
    store.save(payload);
    game.progression.load();
    game.progression.selectHero('cleric');

    game.departOnQuest(QUESTS.endless);
    game.player.hp = 1;
    game.castActiveSpell();
    h.game.update(1 / 60);
    expect(game.player.hp).toBeGreaterThan(1);
    expect(metrics(h).spells_cast).toBe(1);
    expect(game.player.spellCooldown('cure-wounds')).toBeGreaterThan(0);

    // Still cooling down: the second cast fizzles.
    game.castActiveSpell();
    h.game.update(1 / 60);
    expect(metrics(h).spells_cast).toBe(1);
  });

  test('a martial technique casts through the same pipeline (Wave J)', () => {
    const h = initGame(new DungeonCrawlGame());
    startWithClass(h, 'Digit1'); // fighter
    const game = internals(h);

    // Teach the fighter SECOND WIND directly on the save.
    const store = new CharacterStore();
    const payload = store.load();
    payload.characters.fighter!.spells = ['second-wind'];
    store.save(payload);
    game.progression.load();
    game.progression.selectHero('fighter');

    game.departOnQuest(QUESTS.endless);
    game.player.hp = 1;
    game.castActiveSpell();
    h.game.update(1 / 60);
    expect(game.player.hp).toBeGreaterThan(1);
    expect(metrics(h).spells_cast).toBe(1);
    expect(game.player.spellCooldown('second-wind')).toBeGreaterThan(0);
  });

  test('FAN OF KNIVES throws eight blades without spending ammo (Wave J)', () => {
    const h = initGame(new DungeonCrawlGame());
    startWithClass(h, 'Digit2'); // thief
    const game = internals(h);

    const store = new CharacterStore();
    const payload = store.load();
    payload.characters.thief!.spells = ['fan-of-knives'];
    store.save(payload);
    game.progression.load();
    game.progression.selectHero('thief');

    game.departOnQuest(QUESTS.endless);
    const before = game.projectiles.length;
    game.castActiveSpell();
    expect(game.projectiles.length).toBe(before + 8);
    h.game.update(1 / 60);
    expect(metrics(h).spells_cast).toBe(1);
  });

  test('an empty grimoire ignores the cast key safely', () => {
    const h = initGame(new DungeonCrawlGame());
    const held = startWithClass(h, 'Digit1'); // fighter — nothing learned yet
    const game = internals(h);
    game.departOnQuest(QUESTS.endless);
    held.add('KeyV');
    expect(() => {
      for (let i = 0; i < 10; i++) h.game.update(1 / 60);
    }).not.toThrow();
    expect(metrics(h).spells_cast).toBe(0);
  });
});

describe('the character sheet (Tab)', () => {
  test('Tab opens the sheet from town, freezes play, and Tab closes it', () => {
    const h = initGame(new DungeonCrawlGame());
    const held = startWithClass(h, 'Digit2'); // thief
    const game = internals(h);
    expect(game.state).toBe('town');

    held.add('Tab');
    h.game.update(1 / 60);
    expect(game.state).toBe('sheet');
    expect(() => h.game.render(h.ctx)).not.toThrow();

    held.clear();
    h.game.update(1 / 60);
    held.add('Tab');
    h.game.update(1 / 60);
    expect(game.state).toBe('town');
  });
});
