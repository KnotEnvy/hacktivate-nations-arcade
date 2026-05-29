import {
  DAILY_CHALLENGE_TEMPLATES,
  applyChallengeProgress,
  createDailyChallengeId,
  getChallengeTemplate,
  getChallengeTemplateId,
  getDailyChallengeExpiresAt,
  type ChallengeRequirement,
} from '@/lib/challenges';

describe('challenges', () => {
  describe('DAILY_CHALLENGE_TEMPLATES', () => {
    test('has unique template ids', () => {
      const ids = DAILY_CHALLENGE_TEMPLATES.map(t => t.templateId);
      expect(new Set(ids).size).toBe(ids.length);
    });

    test('every template is well-formed', () => {
      DAILY_CHALLENGE_TEMPLATES.forEach(t => {
        expect(typeof t.templateId).toBe('string');
        expect(t.templateId.length).toBeGreaterThan(0);
        expect(t.type).toBe('daily');
        expect(t.target).toBeGreaterThan(0);
        expect(t.reward).toBeGreaterThan(0);
        expect(['sum', 'max', 'count']).toContain(t.requirement.aggregation);
      });
    });
  });

  describe('createDailyChallengeId', () => {
    test('builds a daily- prefixed id from date key and template', () => {
      expect(createDailyChallengeId('2026-04-14', 'runner_coin_collector')).toBe(
        'daily-2026-04-14-runner_coin_collector'
      );
    });
  });

  describe('getChallengeTemplateId', () => {
    test('extracts the template id from a full daily challenge id', () => {
      expect(getChallengeTemplateId('daily-2026-04-14-runner_coin_collector')).toBe(
        'runner_coin_collector'
      );
    });

    test('round-trips with createDailyChallengeId', () => {
      DAILY_CHALLENGE_TEMPLATES.forEach(t => {
        const id = createDailyChallengeId('2026-04-14', t.templateId);
        expect(getChallengeTemplateId(id)).toBe(t.templateId);
      });
    });

    test('returns input unchanged when not a daily id', () => {
      expect(getChallengeTemplateId('runner_coin_collector')).toBe('runner_coin_collector');
      expect(getChallengeTemplateId('weekly-something')).toBe('weekly-something');
    });
  });

  describe('getChallengeTemplate', () => {
    test('resolves a template from a full daily challenge id', () => {
      const template = getChallengeTemplate('daily-2026-04-14-runner_coin_collector');
      expect(template).not.toBeNull();
      expect(template?.title).toBe('Coin Collector');
      expect(template?.target).toBe(50);
    });

    test('resolves a template directly from a template id', () => {
      const template = getChallengeTemplate('cross_daily_grind');
      expect(template?.title).toBe('Daily Grind');
    });

    test('returns null for unknown template id', () => {
      expect(getChallengeTemplate('daily-2026-04-14-does_not_exist')).toBeNull();
      expect(getChallengeTemplate('totally-unknown')).toBeNull();
    });
  });

  describe('getDailyChallengeExpiresAt', () => {
    test('returns the next-day UTC midnight ISO string', () => {
      expect(getDailyChallengeExpiresAt('daily-2026-04-14-runner_coin_collector')).toBe(
        '2026-04-15T00:00:00.000Z'
      );
    });

    test('is deterministic regardless of system timezone/clock', () => {
      const first = getDailyChallengeExpiresAt('daily-2026-01-31-cross_daily_grind');
      const second = getDailyChallengeExpiresAt('daily-2026-01-31-cross_daily_grind');
      expect(first).toBe(second);
      // Jan 31 + 1 day -> Feb 1
      expect(first).toBe('2026-02-01T00:00:00.000Z');
    });

    test('returns null for non-daily ids', () => {
      expect(getDailyChallengeExpiresAt('weekly-2026-04-14-foo')).toBeNull();
      expect(getDailyChallengeExpiresAt('runner_coin_collector')).toBeNull();
    });

    test('returns null when date parts are missing', () => {
      expect(getDailyChallengeExpiresAt('daily-')).toBeNull();
      expect(getDailyChallengeExpiresAt('daily-2026')).toBeNull();
    });
  });

  describe('applyChallengeProgress', () => {
    const sum: ChallengeRequirement = { metric: 'coins_collected', aggregation: 'sum' };
    const max: ChallengeRequirement = { metric: 'speed', aggregation: 'max' };
    const count: ChallengeRequirement = { metric: 'games_played', aggregation: 'count' };

    describe('sum aggregation', () => {
      test('accumulates value onto current progress', () => {
        expect(applyChallengeProgress(10, 100, sum, 5)).toBe(15);
      });

      test('clamps to target', () => {
        expect(applyChallengeProgress(98, 100, sum, 50)).toBe(100);
      });

      test('floors fractional input values', () => {
        expect(applyChallengeProgress(0, 100, sum, 5.9)).toBe(5);
        expect(applyChallengeProgress(2.9, 100, sum, 3.9)).toBe(5);
      });
    });

    describe('count aggregation', () => {
      test('increments by exactly one ignoring value magnitude', () => {
        expect(applyChallengeProgress(0, 3, count, 999)).toBe(1);
        expect(applyChallengeProgress(2, 3, count, 0)).toBe(3);
      });

      test('clamps to target', () => {
        expect(applyChallengeProgress(3, 3, count, 1)).toBe(3);
      });
    });

    describe('max aggregation', () => {
      test('keeps the larger of current and value', () => {
        expect(applyChallengeProgress(10, 100, max, 5)).toBe(10);
        expect(applyChallengeProgress(5, 100, max, 40)).toBe(40);
      });

      test('clamps to target', () => {
        expect(applyChallengeProgress(0, 100, max, 250)).toBe(100);
      });
    });

    describe('edge cases', () => {
      test('non-finite current progress is treated as 0', () => {
        expect(applyChallengeProgress(Number.NaN, 100, sum, 10)).toBe(10);
        expect(applyChallengeProgress(Number.POSITIVE_INFINITY, 100, sum, 10)).toBe(10);
      });

      test('negative current progress is clamped to 0', () => {
        expect(applyChallengeProgress(-50, 100, sum, 10)).toBe(10);
      });

      test('non-finite incoming value is treated as 0', () => {
        expect(applyChallengeProgress(20, 100, sum, Number.NaN)).toBe(20);
        expect(applyChallengeProgress(20, 100, sum, Number.POSITIVE_INFINITY)).toBe(20);
      });

      test('negative incoming value is clamped to 0', () => {
        expect(applyChallengeProgress(20, 100, sum, -10)).toBe(20);
      });

      test('zero target clamps result to 0', () => {
        expect(applyChallengeProgress(50, 0, sum, 10)).toBe(0);
        expect(applyChallengeProgress(50, 0, count, 1)).toBe(0);
        expect(applyChallengeProgress(50, 0, max, 10)).toBe(0);
      });

      test('unknown aggregation returns normalized current progress', () => {
        const bogus = {
          metric: 'score',
          aggregation: 'bogus',
        } as unknown as ChallengeRequirement;
        expect(applyChallengeProgress(7.8, 100, bogus, 50)).toBe(7);
      });
    });
  });
});
