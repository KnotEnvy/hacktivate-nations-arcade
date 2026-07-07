// Class system tests for DungeonCrawlGame v3 (development suite only).
//
// Covers the class data contract, kit application on the Player, and the
// run-start class-select flow through the public GameModule surface (metric
// keys), mirroring the characterization test's input-mock pattern.

import {
  ALL_CLASS_IDS,
  CLASSES,
  DEFAULT_KIT,
} from '@/games/dungeon-crawl/data/classes';
import { PLAYER } from '@/games/dungeon-crawl/data/constants';
import { DungeonCrawlGame } from '@/games/dungeon-crawl/DungeonCrawlGame';
import { Player } from '@/games/dungeon-crawl/entities/Player';
import { initGame, type Harness } from '@/games/shared/gameTestHarness';

let randomSpy: jest.SpyInstance;
beforeEach(() => {
  randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.42);
});
afterEach(() => {
  randomSpy.mockRestore();
});

/** Route the harness input mocks through a mutable held-key set. */
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

describe('class data contract', () => {
  test('exactly four classes with unique ids', () => {
    expect(ALL_CLASS_IDS).toHaveLength(4);
    expect(new Set(ALL_CLASS_IDS).size).toBe(4);
    for (const id of ALL_CLASS_IDS) {
      expect(CLASSES[id].id).toBe(id);
    }
  });

  test('every class card is fully authored', () => {
    for (const id of ALL_CLASS_IDS) {
      const def = CLASSES[id];
      expect(def.name.length).toBeGreaterThan(0);
      expect(def.blurb.length).toBeGreaterThan(0);
      expect(def.icon.length).toBeGreaterThan(0);
      expect(def.abilityName.length).toBeGreaterThan(0);
      expect(def.abilityBlurb.length).toBeGreaterThan(0);
      expect(def.color).toMatch(/^#/);
      expect(def.tunic).toMatch(/^#/);
      expect(def.trim).toMatch(/^#/);
    }
  });

  test('every kit is playable: positive vitals, timers and weapons', () => {
    for (const id of ALL_CLASS_IDS) {
      const kit = CLASSES[id].kit;
      expect(kit.maxHp).toBeGreaterThan(0);
      expect(kit.maxHp % 2).toBe(0); // hearts draw 2hp apiece
      expect(kit.maxHp).toBeLessThanOrEqual(PLAYER.HP_CAP);
      expect(kit.speedMult).toBeGreaterThan(0);
      expect(kit.meleeRange).toBeGreaterThan(0);
      expect(kit.meleeArcDeg).toBeGreaterThan(0);
      expect(kit.meleeCooldown).toBeGreaterThan(0);
      expect(kit.startDaggers).toBeGreaterThan(0);
      expect(kit.daggerCap).toBeGreaterThanOrEqual(kit.startDaggers);
      expect(kit.abilityCooldown).toBeGreaterThan(0);
    }
  });

  test('DEFAULT_KIT reproduces the pre-v3 hero exactly', () => {
    expect(DEFAULT_KIT.maxHp).toBe(PLAYER.MAX_HP);
    expect(DEFAULT_KIT.speedMult).toBe(1);
    expect(DEFAULT_KIT.meleeDamageBonus).toBe(0);
    expect(DEFAULT_KIT.meleeRange).toBe(PLAYER.SWORD_RANGE);
    expect(DEFAULT_KIT.meleeArcDeg).toBe(PLAYER.SWORD_ARC_DEG);
    expect(DEFAULT_KIT.meleeCooldown).toBe(PLAYER.SWORD_COOLDOWN);
    expect(DEFAULT_KIT.meleeKnockback).toBe(PLAYER.SWORD_KNOCKBACK);
    expect(DEFAULT_KIT.startDaggers).toBe(PLAYER.START_DAGGERS);
    expect(DEFAULT_KIT.daggerCap).toBe(PLAYER.DAGGER_CAP);
    expect(DEFAULT_KIT.goldDropMult).toBe(1);
    expect(DEFAULT_KIT.backstabMult).toBe(1);
  });
});

describe('kit application on the Player', () => {
  test('reset() restores the neutral kit', () => {
    const player = new Player();
    player.applyKit(CLASSES.fighter);
    player.reset(0, 0);
    expect(player.classId).toBeNull();
    expect(player.maxHp).toBe(PLAYER.MAX_HP);
    expect(player.daggers).toBe(PLAYER.START_DAGGERS);
  });

  test('fighter kit: four hearts', () => {
    const player = new Player();
    player.reset(0, 0);
    player.applyKit(CLASSES.fighter);
    expect(player.classId).toBe('fighter');
    expect(player.maxHp).toBe(8);
    expect(player.hp).toBe(8);
  });

  test('thief kit: extra daggers and a faster stride', () => {
    const player = new Player();
    player.reset(0, 0);
    const baseSpeed = player.speed();
    player.applyKit(CLASSES.thief);
    expect(player.daggers).toBe(8);
    expect(player.speed()).toBeGreaterThan(baseSpeed);
  });

  test('cleric kit: heavier blows', () => {
    const player = new Player();
    player.reset(0, 0);
    const baseDamage = player.swordDamage();
    player.applyKit(CLASSES.cleric);
    expect(player.swordDamage()).toBe(baseDamage + 1);
    expect(player.meleeKnockback()).toBeGreaterThan(DEFAULT_KIT.meleeKnockback);
  });

  test('mage kit: fragile, capped seeking bolts', () => {
    const player = new Player();
    player.reset(0, 0);
    player.applyKit(CLASSES.mage);
    expect(player.maxHp).toBe(4);
    expect(player.daggerCap()).toBe(6);
    expect(player.kit.daggerHoming).toBeGreaterThan(0);
  });

  test('tryAbility gates on its cooldown', () => {
    const player = new Player();
    player.reset(0, 0);
    player.applyKit(CLASSES.fighter);
    expect(player.tryAbility()).toBe(true);
    expect(player.tryAbility()).toBe(false); // still cooling down
    expect(player.abilityCooldownFrac()).toBeGreaterThan(0);
  });
});

describe('class-select flow (public metric contract)', () => {
  test('all class depth keys are 0 before the pick', () => {
    const h = initGame(new DungeonCrawlGame());
    const s = metrics(h);
    for (const id of ALL_CLASS_IDS) {
      expect(s[`${id}_depth`]).toBe(0);
    }
    expect(s.abilities_used).toBe(0);
  });

  test('browsing with nav keys alone never starts the run', () => {
    const h = initGame(new DungeonCrawlGame());
    const held = wireHeldKeys(h);
    held.add('ArrowRight');
    for (let i = 0; i < 30; i++) h.game.update(1 / 60);
    const s = metrics(h);
    for (const id of ALL_CLASS_IDS) {
      expect(s[`${id}_depth`]).toBe(0);
    }
  });

  test('Digit2 picks the second class and starts play on floor 1', () => {
    const h = initGame(new DungeonCrawlGame());
    const held = wireHeldKeys(h);
    held.add('Digit2');
    h.game.update(1 / 60);
    const picked = ALL_CLASS_IDS[1];
    const s = metrics(h);
    expect(s[`${picked}_depth`]).toBe(1);
    for (const id of ALL_CLASS_IDS) {
      if (id !== picked) expect(s[`${id}_depth`]).toBe(0);
    }
  });

  test('Q fires the signature ability once play begins', () => {
    const h = initGame(new DungeonCrawlGame());
    const held = wireHeldKeys(h);
    held.add('Digit1');
    h.game.update(1 / 60); // pick fighter, enter play
    held.clear();
    h.game.update(1 / 60); // release everything (input edges settle)
    held.add('KeyQ');
    h.game.update(1 / 60);
    expect(metrics(h).abilities_used).toBeGreaterThanOrEqual(1);
  });

  test('restart returns to the class draft with class keys zeroed', () => {
    const h = initGame(new DungeonCrawlGame());
    const held = wireHeldKeys(h);
    held.add('Digit3');
    h.game.update(1 / 60);
    expect(metrics(h)[`${ALL_CLASS_IDS[2]}_depth`]).toBe(1);
    held.clear();
    h.game.restart?.();
    const s = metrics(h);
    for (const id of ALL_CLASS_IDS) {
      expect(s[`${id}_depth`]).toBe(0);
    }
  });
});
