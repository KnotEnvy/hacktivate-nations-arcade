// v5 Wave E tests: the six ability scores — data contract, the one modifier
// formula, delta folding (flat base = zero deltas = legacy feel), the seeded
// forge roll, milestone schedule, persistence sanitize, and the Player folds.

import { ALL_CLASS_IDS, CLASSES } from '@/games/dungeon-crawl/data/classes';
import {
  ALL_STAT_IDS,
  isStatMilestone,
  rollStatScores,
  STAT_BASES,
  STAT_FAVORED,
  STAT_TUNING,
  statMod,
  statModDeltas,
  STATS,
  zeroStatMods,
} from '@/games/dungeon-crawl/data/stats';
import { LINEAGE_TUNING } from '@/games/dungeon-crawl/data/lineages';
import { Rng } from '@/games/dungeon-crawl/dungeon/rng';
import { Player } from '@/games/dungeon-crawl/entities/Player';
import { CharacterStore } from '@/games/dungeon-crawl/persistence/CharacterStore';
import { ProgressionController } from '@/games/dungeon-crawl/progression/ProgressionController';

describe('stats data contract', () => {
  test('six authored scores with unique tags and original text', () => {
    expect(ALL_STAT_IDS).toHaveLength(6);
    const abbrs = new Set<string>();
    const names = new Set<string>();
    for (const id of ALL_STAT_IDS) {
      const def = STATS[id];
      expect(def.id).toBe(id);
      expect(def.abbr).toMatch(/^[A-Z]{3}$/);
      expect(def.name.length).toBeGreaterThan(0);
      expect(def.blurb.length).toBeGreaterThan(0);
      expect(def.icon.length).toBeGreaterThan(0);
      expect(def.color).toMatch(/^#/);
      abbrs.add(def.abbr);
      names.add(def.name);
    }
    expect(abbrs.size).toBe(6);
    expect(names.size).toBe(6);
  });

  test('every class base array is complete, bounded, and sums to 72', () => {
    for (const classId of ALL_CLASS_IDS) {
      const base = STAT_BASES[classId];
      let sum = 0;
      for (const id of ALL_STAT_IDS) {
        expect(base[id]).toBeGreaterThanOrEqual(3);
        expect(base[id]).toBeLessThanOrEqual(STAT_TUNING.SCORE_MAX);
        sum += base[id];
      }
      // Pins class balance consciously — a base-array knob turn must land here.
      expect(sum).toBe(72);
    }
  });

  test('favored stats are distinct, odd at base, and below the cap', () => {
    for (const classId of ALL_CLASS_IDS) {
      const [a, b] = STAT_FAVORED[classId];
      expect(a).not.toBe(b);
      for (const id of [a, b]) {
        expect(STAT_BASES[classId][id] % 2).toBe(1); // first bump crosses a mod boundary
        expect(STAT_BASES[classId][id]).toBeLessThan(STAT_TUNING.SCORE_MAX);
      }
    }
  });
});

describe('the modifier formula', () => {
  test('statMod boundary table', () => {
    expect(statMod(3)).toBe(-4);
    expect(statMod(8)).toBe(-1);
    expect(statMod(9)).toBe(-1);
    expect(statMod(10)).toBe(0);
    expect(statMod(11)).toBe(0);
    expect(statMod(12)).toBe(1);
    expect(statMod(13)).toBe(1);
    expect(statMod(15)).toBe(2);
    expect(statMod(17)).toBe(3);
    expect(statMod(18)).toBe(4);
  });

  test('a hero at the flat class base has all-zero deltas (legacy feel)', () => {
    for (const classId of ALL_CLASS_IDS) {
      expect(statModDeltas(classId, { ...STAT_BASES[classId] })).toEqual(zeroStatMods());
    }
  });

  test('deltas count modifier points above base, never below', () => {
    const scores = { ...STAT_BASES.fighter, str: 18, dex: 12, int: 3 };
    const deltas = statModDeltas('fighter', scores);
    expect(deltas.str).toBe(1); // 17(+3) -> 18(+4)
    expect(deltas.dex).toBe(1); // 10(0) -> 12(+1)
    expect(deltas.int).toBe(0); // floored at zero even when tampered below base
    expect(deltas.con).toBe(0);
  });
});

describe('the forge roll', () => {
  test('deterministic per seed, spends exactly the variance points, respects the cap', () => {
    for (const classId of ALL_CLASS_IDS) {
      const a = rollStatScores(classId, new Rng(1234));
      const b = rollStatScores(classId, new Rng(1234));
      expect(a).toEqual(b);
      let total = 0;
      for (const id of ALL_STAT_IDS) {
        expect(a[id]).toBeGreaterThanOrEqual(STAT_BASES[classId][id]);
        expect(a[id]).toBeLessThanOrEqual(STAT_TUNING.SCORE_MAX);
        total += a[id];
      }
      expect(total).toBe(72 + STAT_TUNING.FORGE_VARIANCE_POINTS);
    }
  });

  test('different seeds forge different heroes', () => {
    const rolls = new Set<string>();
    for (let seed = 1; seed <= 20; seed++) {
      rolls.add(JSON.stringify(rollStatScores('fighter', new Rng(seed))));
    }
    expect(rolls.size).toBeGreaterThan(1);
  });
});

describe('milestones', () => {
  test('levels 3, 6, 9 and only those', () => {
    for (let level = 1; level <= 10; level++) {
      expect(isStatMilestone(level)).toBe([3, 6, 9].includes(level));
    }
  });
});

describe('persistence (mirrors the sagas clamp pattern)', () => {
  test('sanitize clamps to [class base, cap]; junk and absent fields land on the flat base', () => {
    const store = new CharacterStore();
    window.localStorage.setItem(
      store.key(),
      JSON.stringify({
        version: 2,
        characters: {
          // Tampered scores: overgrown, below-base, junk value, missing key.
          fighter: {
            classId: 'fighter',
            level: 3,
            xp: 450,
            scores: { str: 99, dex: 3, con: 'many', unknown: 7 },
          },
          // A veteran save from before Wave E: no scores field at all.
          thief: { classId: 'thief', level: 5, xp: 1500 },
        },
      }),
    );

    const payload = store.load();
    expect(payload.characters.fighter?.scores).toEqual({
      ...STAT_BASES.fighter,
      str: STAT_TUNING.SCORE_MAX, // 99 clamps down to the cap
      // dex 3 clamps UP to base; con junk and the missing rest land on base
    });
    expect(payload.characters.thief?.scores).toEqual({ ...STAT_BASES.thief });
  });

  test('a forged hero rolls once and persists through a store round-trip', () => {
    const ctrl = new ProgressionController();
    ctrl.load();
    const forged = ctrl.create('mage', new Rng(7));
    const total = ALL_STAT_IDS.reduce((sum, id) => sum + forged.scores[id], 0);
    // Wave I — create() defaults to HUMAN, whose FAR HORIZONS rolls wider.
    expect(total).toBe(
      72 + STAT_TUNING.FORGE_VARIANCE_POINTS + LINEAGE_TUNING.HUMAN_EXTRA_FORGE_POINTS,
    );

    const reloaded = new ProgressionController();
    reloaded.load();
    expect(reloaded.heroFor('mage')?.scores).toEqual(forged.scores);
  });

  test('statDeltas is zero before the roster pick and for flat-base heroes', () => {
    const ctrl = new ProgressionController();
    ctrl.load();
    expect(ctrl.statDeltas()).toEqual(zeroStatMods());
  });
});

describe('milestone stat cards in the level-up draft', () => {
  function seededController(heroFields: Record<string, unknown>): ProgressionController {
    const store = new CharacterStore();
    const classId = heroFields.classId as 'fighter';
    window.localStorage.setItem(
      store.key(),
      JSON.stringify({ version: 2, characters: { [classId]: heroFields } }),
    );
    const ctrl = new ProgressionController();
    ctrl.load();
    ctrl.selectHero(classId);
    return ctrl;
  }

  test('reaching level 3 leads with BOTH favored cards, then the normal pool', () => {
    const ctrl = seededController({ classId: 'fighter', level: 2, xp: 400 });
    const choices = ctrl.draftChoices(new Rng(9));
    expect(choices).toHaveLength(3);
    expect(choices[0]).toEqual({ kind: 'stat', id: 'str' });
    expect(choices[1]).toEqual({ kind: 'stat', id: 'con' });
    expect(choices[2].kind).not.toBe('stat');
  });

  test('non-milestone levels draft no stat cards', () => {
    const ctrl = seededController({ classId: 'fighter', level: 1, xp: 150 });
    for (const pick of ctrl.draftChoices(new Rng(9))) {
      expect(pick.kind).not.toBe('stat');
    }
  });

  test('a capped favored score is excluded from the milestone lead', () => {
    const ctrl = seededController({
      classId: 'fighter',
      level: 2,
      xp: 400,
      scores: { ...STAT_BASES.fighter, str: 18 },
    });
    const statCards = ctrl.draftChoices(new Rng(9)).filter(pick => pick.kind === 'stat');
    expect(statCards).toEqual([{ kind: 'stat', id: 'con' }]);
  });

  test('confirming a stat pick raises the score once, clamps at the cap, and persists', () => {
    const ctrl = seededController({ classId: 'fighter', level: 2, xp: 400 });
    const boonsBefore = ctrl.sessionBoons;
    const { level } = ctrl.confirmLevelUp({ kind: 'stat', id: 'str' });
    expect(level).toBe(3);
    expect(ctrl.character()?.scores.str).toBe(18); // 17 + 1
    expect(ctrl.sessionBoons).toBe(boonsBefore); // stat picks are not boons
    expect(ctrl.sessionLevels).toBe(1);

    // Clamps at the cap on a second bump.
    ctrl.confirmLevelUp({ kind: 'stat', id: 'str' });
    expect(ctrl.character()?.scores.str).toBe(STAT_TUNING.SCORE_MAX);

    const reloaded = new ProgressionController();
    reloaded.load();
    expect(reloaded.heroFor('fighter')?.scores.str).toBe(STAT_TUNING.SCORE_MAX);
  });
});

describe('Player folds (siblings of the zero-delta legacy pins)', () => {
  function armedFighter(deltas: Partial<Record<string, number>>): Player {
    const player = new Player();
    player.reset(0, 0);
    player.applyKit(CLASSES.fighter);
    player.applyProgression(
      { hp: 0, speed: 0, daggerCap: 0 },
      {},
      {},
      { ...zeroStatMods(), ...deltas },
    );
    return player;
  }

  test('CON deepens the well: the legacy 18-hp fighter reaches 20 with +1 CON', () => {
    const player = new Player();
    player.reset(0, 0);
    player.applyKit(CLASSES.fighter);
    player.applyProgression(
      { hp: 6, speed: 0, daggerCap: 0 }, // = cumulativeGains('fighter', 5)
      { toughness: 2 },
      {},
      { ...zeroStatMods(), con: 1 },
    );
    expect(player.maxHp).toBe(18 + STAT_TUNING.CON_HP);
  });

  test('STR lands on sword damage and knockback', () => {
    const base = armedFighter({});
    const strong = armedFighter({ str: 1 });
    expect(strong.swordDamage()).toBe(base.swordDamage() + STAT_TUNING.STR_DAMAGE);
    expect(strong.meleeKnockback()).toBeGreaterThan(base.meleeKnockback());
  });

  test('DEX quickens stride and dash recovery', () => {
    const base = armedFighter({});
    const deft = armedFighter({ dex: 2 });
    expect(deft.speed()).toBeGreaterThan(base.speed());
    expect(deft.dashCooldownFull()).toBeCloseTo(
      base.dashCooldownFull() * Math.pow(STAT_TUNING.DEX_DASH_CD_MULT, 2),
    );
  });

  test('WIS deepens heart healing; INT shortens spell cooldowns', () => {
    const base = armedFighter({});
    const wise = armedFighter({ wis: 1 });
    expect(wise.heartHealBonus()).toBe(base.heartHealBonus() + STAT_TUNING.WIS_HEAL);
    const keen = armedFighter({ int: 1 });
    keen.startSpellCooldown('cure-wounds', 10);
    expect(keen.spellCooldown('cure-wounds')).toBeCloseTo(10 * STAT_TUNING.INT_SPELL_CD_MULT);
  });

  test('a mid-run stat bump lands at once; a CON rise grants its hearts', () => {
    const player = armedFighter({});
    const before = player.maxHp;
    player.setStatMods({ ...zeroStatMods(), con: 1 });
    expect(player.maxHp).toBe(before + STAT_TUNING.CON_HP);
    expect(player.hp).toBe(player.maxHp);
    player.setStatMods({ ...zeroStatMods(), con: 1, str: 1 }); // no double CON grant
    expect(player.maxHp).toBe(before + STAT_TUNING.CON_HP);
  });

  test('WIS multiplies earned XP (rounded)', () => {
    const store = new CharacterStore();
    window.localStorage.setItem(
      store.key(),
      JSON.stringify({
        version: 2,
        characters: {
          cleric: {
            classId: 'cleric',
            level: 1,
            xp: 0,
            scores: { ...STAT_BASES.cleric, wis: 18 }, // 17(+3) -> 18(+4): +1 delta
          },
        },
      }),
    );
    const ctrl = new ProgressionController();
    ctrl.load();
    ctrl.selectHero('cleric');
    ctrl.grantXp(100);
    expect(ctrl.character()?.xp).toBe(Math.round(100 * (1 + STAT_TUNING.WIS_XP_MULT)));
  });
});
