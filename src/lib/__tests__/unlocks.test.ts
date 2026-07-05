import {
  DEFAULT_UNLOCKED_GAME_IDS,
  getNextGameUnlockCost,
  getPaidUnlockedCountInTier,
  getTierGameIncrement,
  getTierUnlockCost,
  isDefaultUnlockedGame,
  isGameUnlocked,
  isTierUnlocked,
} from '@/lib/unlocks';
import { TIER_GAME_COST_INCREMENTS, TIER_UNLOCK_COSTS } from '@/lib/constants';

describe('unlocks', () => {
  describe('isDefaultUnlockedGame', () => {
    test('true for the default unlocked games', () => {
      DEFAULT_UNLOCKED_GAME_IDS.forEach(id => {
        expect(isDefaultUnlockedGame(id)).toBe(true);
      });
      expect(isDefaultUnlockedGame('runner')).toBe(true);
    });

    test('false for non-default games', () => {
      expect(isDefaultUnlockedGame('snake')).toBe(false);
      expect(isDefaultUnlockedGame('space')).toBe(false);
      expect(isDefaultUnlockedGame('')).toBe(false);
      expect(isDefaultUnlockedGame('unknown')).toBe(false);
    });
  });

  describe('getTierUnlockCost', () => {
    test('returns configured cost for known tiers', () => {
      expect(getTierUnlockCost(0)).toBe(TIER_UNLOCK_COSTS[0]);
      expect(getTierUnlockCost(1)).toBe(TIER_UNLOCK_COSTS[1]);
      expect(getTierUnlockCost(4)).toBe(TIER_UNLOCK_COSTS[4]);
    });

    test('tier 0 is free', () => {
      expect(getTierUnlockCost(0)).toBe(0);
    });

    test('returns 0 for unknown tiers', () => {
      expect(getTierUnlockCost(99)).toBe(0);
      expect(getTierUnlockCost(-1)).toBe(0);
    });
  });

  describe('getTierGameIncrement', () => {
    test('returns configured increment for known tiers', () => {
      expect(getTierGameIncrement(0)).toBe(TIER_GAME_COST_INCREMENTS[0]);
      expect(getTierGameIncrement(2)).toBe(TIER_GAME_COST_INCREMENTS[2]);
    });

    test('returns 0 for unknown tiers', () => {
      expect(getTierGameIncrement(99)).toBe(0);
      expect(getTierGameIncrement(-5)).toBe(0);
    });
  });

  describe('getNextGameUnlockCost', () => {
    test('first paid game in tier 0 costs one increment', () => {
      // increment * (0 + 1)
      expect(getNextGameUnlockCost(0, 0)).toBe(TIER_GAME_COST_INCREMENTS[0]);
    });

    test('scales with number already unlocked', () => {
      const inc = TIER_GAME_COST_INCREMENTS[0];
      expect(getNextGameUnlockCost(0, 1)).toBe(inc * 2);
      expect(getNextGameUnlockCost(0, 3)).toBe(inc * 4);
    });

    test('returns 0 for unknown tier (no increment)', () => {
      expect(getNextGameUnlockCost(99, 0)).toBe(0);
      expect(getNextGameUnlockCost(99, 5)).toBe(0);
    });

    test('never returns a negative value', () => {
      // Defensive: a negative unlock count should still clamp to >= 0
      expect(getNextGameUnlockCost(0, -5)).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getPaidUnlockedCountInTier', () => {
    test('counts only paid, implemented, unlocked games in the tier', () => {
      // snake is tier 0, implemented, not default-unlocked
      const count = getPaidUnlockedCountInTier(0, ['runner', 'snake']);
      // runner is default-unlocked so excluded; snake counts
      expect(count).toBe(1);
    });

    test('excludes the default unlocked game even if present', () => {
      expect(getPaidUnlockedCountInTier(0, ['runner'])).toBe(0);
    });

    test('excludes games from other tiers', () => {
      // space is tier 2; should not count toward tier 0
      const count = getPaidUnlockedCountInTier(0, ['space']);
      expect(count).toBe(0);
    });

    test('counts games for their own tier', () => {
      // space is tier 2, implemented, paid
      expect(getPaidUnlockedCountInTier(2, ['space'])).toBe(1);
    });

    test('ignores unimplemented / unknown ids', () => {
      expect(getPaidUnlockedCountInTier(3, ['target-shooter', 'bogus'])).toBe(0);
    });

    test('returns 0 for empty unlocked list', () => {
      expect(getPaidUnlockedCountInTier(0, [])).toBe(0);
    });

    test('deduplicates ids via set membership', () => {
      // Duplicates should not double-count
      expect(getPaidUnlockedCountInTier(0, ['snake', 'snake'])).toBe(1);
    });
  });

  describe('isTierUnlocked', () => {
    test('true when tier is in the unlocked list', () => {
      expect(isTierUnlocked(1, [0, 1, 2])).toBe(true);
    });

    test('false when tier is absent', () => {
      expect(isTierUnlocked(3, [0, 1])).toBe(false);
    });

    test('false for empty unlocked tiers', () => {
      expect(isTierUnlocked(0, [])).toBe(false);
    });
  });

  describe('isGameUnlocked', () => {
    test('default game is always unlocked regardless of tiers/ids', () => {
      expect(isGameUnlocked('runner', [], [])).toBe(true);
    });

    test('false for unimplemented games even if listed as unlocked', () => {
      expect(isGameUnlocked('target-shooter', [0, 1, 2, 3], ['target-shooter'])).toBe(false);
    });

    test('false for unknown game ids', () => {
      expect(isGameUnlocked('bogus', [0, 1, 2], ['bogus'])).toBe(false);
    });

    test('requires both tier unlocked and id in unlocked list', () => {
      // snake is tier 0, implemented, paid
      expect(isGameUnlocked('snake', [0], ['snake'])).toBe(true);
      // tier not unlocked
      expect(isGameUnlocked('snake', [], ['snake'])).toBe(false);
      // id not in unlocked list
      expect(isGameUnlocked('snake', [0], [])).toBe(false);
    });

    test('higher-tier game needs its own tier unlocked', () => {
      // space is tier 2
      expect(isGameUnlocked('space', [0, 1], ['space'])).toBe(false);
      expect(isGameUnlocked('space', [0, 1, 2], ['space'])).toBe(true);
    });
  });
});
