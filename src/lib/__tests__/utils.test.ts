import { calculateCoinsEarned, cn, formatNumber } from '@/lib/utils';
import { ECONOMY } from '@/lib/constants';

describe('utils', () => {
  describe('cn', () => {
    test('joins multiple class name strings', () => {
      expect(cn('a', 'b', 'c')).toBe('a b c');
    });

    test('ignores falsy values', () => {
      expect(cn('a', false, null, undefined, '', 'b')).toBe('a b');
    });

    test('handles conditional object syntax', () => {
      expect(cn('base', { active: true, disabled: false })).toBe('base active');
    });

    test('handles array inputs', () => {
      expect(cn(['a', 'b'], 'c')).toBe('a b c');
    });

    test('returns empty string for no/falsy input', () => {
      expect(cn()).toBe('');
      expect(cn(false, null, undefined)).toBe('');
    });
  });

  describe('calculateCoinsEarned', () => {
    test('combines score-to-coins ratio and pickup value', () => {
      // 250/100 -> 2, plus 3 pickups * 10 = 30 => 32
      const expected =
        Math.floor(250 / ECONOMY.SCORE_TO_COINS_RATIO) + 3 * ECONOMY.PICKUP_COIN_VALUE;
      expect(calculateCoinsEarned(250, 3)).toBe(expected);
      expect(calculateCoinsEarned(250, 3)).toBe(32);
    });

    test('floors fractional score contribution', () => {
      // 99/100 -> 0
      expect(calculateCoinsEarned(99, 0)).toBe(0);
      // 199/100 -> 1
      expect(calculateCoinsEarned(199, 0)).toBe(1);
    });

    test('returns 0 for zero score and zero pickups', () => {
      expect(calculateCoinsEarned(0, 0)).toBe(0);
    });

    test('handles pickups only', () => {
      expect(calculateCoinsEarned(0, 5)).toBe(5 * ECONOMY.PICKUP_COIN_VALUE);
    });

    test('scales linearly with pickups', () => {
      const a = calculateCoinsEarned(0, 1);
      const b = calculateCoinsEarned(0, 2);
      expect(b - a).toBe(ECONOMY.PICKUP_COIN_VALUE);
    });

    test('handles large scores', () => {
      expect(calculateCoinsEarned(1_000_000, 0)).toBe(10_000);
    });
  });

  describe('formatNumber', () => {
    test('returns plain string below 1000', () => {
      expect(formatNumber(0)).toBe('0');
      expect(formatNumber(42)).toBe('42');
      expect(formatNumber(999)).toBe('999');
    });

    test('formats thousands with K suffix', () => {
      expect(formatNumber(1000)).toBe('1.0K');
      expect(formatNumber(1500)).toBe('1.5K');
      expect(formatNumber(999999)).toBe('1000.0K');
    });

    test('formats millions with M suffix', () => {
      expect(formatNumber(1_000_000)).toBe('1.0M');
      expect(formatNumber(2_500_000)).toBe('2.5M');
    });

    test('boundary at exactly 1000 uses K', () => {
      expect(formatNumber(1000)).toBe('1.0K');
    });

    test('boundary at exactly 1000000 uses M', () => {
      expect(formatNumber(1_000_000)).toBe('1.0M');
    });

    test('rounds to one decimal place', () => {
      expect(formatNumber(1234)).toBe('1.2K');
      expect(formatNumber(1250)).toBe('1.3K'); // toFixed rounds
    });
  });
});
