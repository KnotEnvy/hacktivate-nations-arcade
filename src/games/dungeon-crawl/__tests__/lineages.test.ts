// Wave I tests: the title page and the bloodlines — data contract, forge
// nudges + FAR HORIZONS, sanitize fallback, the Player passives (KEEN QUIVER
// sheath, STONE-SENSE per floor, LUCK'S LAST WORD per expedition), and the
// title -> roster -> bloodline flow through the public GameModule surface.

import { CLASSES, DEFAULT_KIT } from '@/games/dungeon-crawl/data/classes';
import { PLAYER } from '@/games/dungeon-crawl/data/constants';
import {
  ALL_LINEAGE_IDS,
  applyLineageNudge,
  asLineageId,
  LINEAGE_TUNING,
  LINEAGES,
} from '@/games/dungeon-crawl/data/lineages';
import {
  ALL_STAT_IDS,
  STAT_BASES,
  STAT_TUNING,
} from '@/games/dungeon-crawl/data/stats';
import { DungeonCrawlGame } from '@/games/dungeon-crawl/DungeonCrawlGame';
import { Rng } from '@/games/dungeon-crawl/dungeon/rng';
import { Player } from '@/games/dungeon-crawl/entities/Player';
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

function metrics(h: Harness): Record<string, number> {
  return h.game.getScore!() as unknown as Record<string, number>;
}

function press(h: Harness, held: Set<string>, code: string): void {
  held.add(code);
  h.game.update(1 / 60);
  held.clear();
  h.game.update(1 / 60);
}

describe('lineage data contract', () => {
  test('four bloodlines, HUMAN first and neutral, all text original and complete', () => {
    expect(ALL_LINEAGE_IDS).toHaveLength(4);
    expect(ALL_LINEAGE_IDS[0]).toBe('human');
    expect(LINEAGES.human.statNudge).toEqual({});
    const names = new Set<string>();
    for (const id of ALL_LINEAGE_IDS) {
      const def = LINEAGES[id];
      expect(def.id).toBe(id);
      expect(def.name.length).toBeGreaterThan(0);
      expect(def.epithet.length).toBeGreaterThan(0);
      expect(def.blurb.length).toBeGreaterThan(0);
      expect(def.passiveName.length).toBeGreaterThan(0);
      expect(def.passiveBlurb.length).toBeGreaterThan(0);
      expect(def.color).toMatch(/^#/);
      names.add(def.name);
    }
    expect(names.size).toBe(4);
    // The demihuman nudges stay single-point (texture, not a rebalance).
    for (const id of ['dwarf', 'elf', 'halfling'] as const) {
      const total = Object.values(LINEAGES[id].statNudge).reduce((a, b) => a + b, 0);
      expect(total).toBe(1);
    }
  });

  test('asLineageId falls back to human; the nudge clamps at the cap', () => {
    expect(asLineageId('dwarf')).toBe('dwarf');
    expect(asLineageId('dragonborn')).toBe('human');
    expect(asLineageId(undefined)).toBe('human');

    const capped = applyLineageNudge({ ...STAT_BASES.fighter, con: 18 }, 'dwarf', 18);
    expect(capped.con).toBe(18);
  });
});

describe('the forge', () => {
  test('a demihuman forge lands its nudge; sanitize keeps it through a round-trip', () => {
    const ctrl = new ProgressionController();
    ctrl.load();
    const forged = ctrl.create('fighter', new Rng(7), 'dwarf');
    expect(forged.lineage).toBe('dwarf');
    const total = ALL_STAT_IDS.reduce((sum, id) => sum + forged.scores[id], 0);
    // Base 72 + the standard variance + the dwarf's +1 CON.
    expect(total).toBe(72 + STAT_TUNING.FORGE_VARIANCE_POINTS + 1);
    expect(forged.scores.con).toBeGreaterThanOrEqual(STAT_BASES.fighter.con + 1);

    const reloaded = new ProgressionController();
    reloaded.load();
    expect(reloaded.heroFor('fighter')?.lineage).toBe('dwarf');
    expect(reloaded.heroFor('fighter')?.scores).toEqual(forged.scores);
  });

  test('FAR HORIZONS: only the human forge rolls the wider variance', () => {
    const human = new ProgressionController();
    human.load();
    const forgedHuman = human.create('mage', new Rng(7), 'human');
    const humanTotal = ALL_STAT_IDS.reduce((s, id) => s + forgedHuman.scores[id], 0);
    expect(humanTotal).toBe(
      72 + STAT_TUNING.FORGE_VARIANCE_POINTS + LINEAGE_TUNING.HUMAN_EXTRA_FORGE_POINTS,
    );

    localStorage.clear();
    const elf = new ProgressionController();
    elf.load();
    const forgedElf = elf.create('mage', new Rng(7), 'elf');
    const elfTotal = ALL_STAT_IDS.reduce((s, id) => s + forgedElf.scores[id], 0);
    expect(elfTotal).toBe(72 + STAT_TUNING.FORGE_VARIANCE_POINTS + 1);
  });

  test('a veteran save without the field sanitizes to human', () => {
    const store = new CharacterStore();
    const ctrl = new ProgressionController();
    ctrl.load();
    ctrl.create('thief', new Rng(3), 'halfling');
    const raw = JSON.parse(localStorage.getItem(store.key())!) as {
      characters: { thief: Record<string, unknown> };
    };
    delete raw.characters.thief.lineage;
    localStorage.setItem(store.key(), JSON.stringify(raw));
    expect(store.load().characters.thief?.lineage).toBe('human');
  });
});

describe('the Player passives', () => {
  test('KEEN QUIVER: an elf sheath holds one more blade', () => {
    const player = new Player();
    player.reset(0, 0);
    player.applyKit(CLASSES.thief);
    const base = player.daggerCap();
    player.applyLineage('elf');
    expect(player.daggerCap()).toBe(base + LINEAGE_TUNING.ELF_DAGGER_CAP);
    player.applyLineage('human');
    expect(player.daggerCap()).toBe(base);
  });

  test('STONE-SENSE: one warning per floor, dwarves only, recharges', () => {
    const player = new Player();
    player.reset(0, 0);
    player.applyKit(CLASSES.fighter);
    expect(player.tryConsumeStoneSense()).toBe(false); // human feels nothing
    player.applyLineage('dwarf');
    expect(player.tryConsumeStoneSense()).toBe(true);
    expect(player.tryConsumeStoneSense()).toBe(false); // spent this floor
    player.rechargeStoneSense();
    expect(player.tryConsumeStoneSense()).toBe(true);
    // Never while already invulnerable (the hit would not have landed).
    player.rechargeStoneSense();
    player.invuln = 1;
    expect(player.tryConsumeStoneSense()).toBe(false);
  });

  test("LUCK'S LAST WORD: once per expedition, halflings only", () => {
    const player = new Player();
    player.reset(0, 0);
    player.applyKit(CLASSES.fighter);
    player.hp = 0;
    expect(player.tryConsumeLuck()).toBe(false);
    player.applyLineage('halfling');
    expect(player.tryConsumeLuck()).toBe(true);
    // Wave L — every death-cheat returns at the same fraction of the pool.
    expect(player.hp).toBe(Math.ceil(player.maxHp * PLAYER.REVIVE_FRAC));
    expect(player.invuln).toBeGreaterThan(0);
    player.hp = 0;
    expect(player.tryConsumeLuck()).toBe(false); // luck spoke once
    player.reset(0, 0); // a new expedition re-arms it (the depart path)
    player.applyLineage('halfling');
    expect(player.tryConsumeLuck()).toBe(true);
  });
});

describe('the title page and the bloodline flow (public surface)', () => {
  test('the title holds until a confirm; digits do nothing on the page', () => {
    const h = initGame(new DungeonCrawlGame());
    const held = wireHeldKeys(h);
    held.add('Digit1');
    for (let i = 0; i < 20; i++) h.game.update(1 / 60);
    held.clear();
    h.game.update(1 / 60);
    expect(metrics(h).fighter_depth).toBe(0); // still on the page
    press(h, held, 'Space'); // the page turns -> roster
    press(h, held, 'Digit1'); // pick fighter -> the bloodline page
    expect(metrics(h).fighter_depth).toBe(0); // not forged yet
    press(h, held, 'Digit2'); // forge a DWARF
    expect(metrics(h).fighter_depth).toBe(1);
    expect(new CharacterStore().load().characters.fighter?.lineage).toBe('dwarf');
  });

  test('a held digit cannot fall through the class pick and auto-forge', () => {
    const h = initGame(new DungeonCrawlGame());
    const held = wireHeldKeys(h);
    press(h, held, 'Space'); // past the title
    held.add('Digit1');
    for (let i = 0; i < 10; i++) h.game.update(1 / 60); // held across screens
    // The bloodline page is armed only after the digit releases.
    expect(metrics(h).fighter_depth).toBe(0);
    held.clear();
    h.game.update(1 / 60);
    press(h, held, 'Digit1'); // now it forges (HUMAN, card 1)
    expect(metrics(h).fighter_depth).toBe(1);
    expect(new CharacterStore().load().characters.fighter?.lineage).toBe('human');
  });

  test('a returning hero skips the bloodline page', () => {
    const h = initGame(new DungeonCrawlGame());
    const held = wireHeldKeys(h);
    press(h, held, 'Space');
    press(h, held, 'Digit1');
    press(h, held, 'Digit3'); // forge an ELF fighter
    expect(new CharacterStore().load().characters.fighter?.lineage).toBe('elf');

    h.game.restart?.();
    press(h, held, 'Space'); // title again
    press(h, held, 'Digit1'); // resume — straight to Lastlight
    expect(metrics(h).fighter_depth).toBe(1);
  });

  test('the kit defaults stay untouched by lineage plumbing', () => {
    // The DEFAULT_KIT contract (pre-class hero) must not grow a sheath bonus.
    const player = new Player();
    player.reset(0, 0);
    expect(player.lineage).toBe('human');
    expect(player.daggerCap()).toBe(DEFAULT_KIT.daggerCap);
  });
});
