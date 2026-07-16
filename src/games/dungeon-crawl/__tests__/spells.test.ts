// v4 Wave D tests: the grimoire — spell data contract (class gating), save
// sanitization, level-up draft mixing for casters, casting effects/cooldowns
// through the game, and the Tab character sheet.

import { ALL_BOON_IDS, BOONS } from '@/games/dungeon-crawl/data/boons';
import { ALL_SPELL_IDS, SPELLS, spellsForClass } from '@/games/dungeon-crawl/data/spells';
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
  test('six authored spells, class-gated to the casters', () => {
    expect(ALL_SPELL_IDS).toHaveLength(6);
    for (const id of ALL_SPELL_IDS) {
      const spell = SPELLS[id];
      expect(spell.id).toBe(id);
      expect(spell.name.length).toBeGreaterThan(0);
      expect(spell.blurb.length).toBeGreaterThan(0);
      expect(spell.cooldown).toBeGreaterThan(0);
      expect(['mage', 'cleric']).toContain(spell.classId);
    }
    expect(spellsForClass('mage')).toHaveLength(3);
    expect(spellsForClass('cleric')).toHaveLength(3);
    expect(spellsForClass('fighter')).toHaveLength(0);
    expect(spellsForClass('thief')).toHaveLength(0);
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

  test('an empty grimoire ignores the cast key safely', () => {
    const h = initGame(new DungeonCrawlGame());
    const held = startWithClass(h, 'Digit1'); // fighter — no spells ever
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
