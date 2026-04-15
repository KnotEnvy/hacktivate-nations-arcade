import { ECONOMY } from '@/lib/constants';
import {
  calculateTrustedGameReward,
  validateAchievementIds,
  validateTrustedChallengeSync,
  validateTrustedGameSession,
} from '@/lib/trustedProgression';
import { UserService } from '@/services/UserServices';

describe('trustedProgression helpers', () => {
  test('validateTrustedGameSession floors values and rejects unknown games', () => {
    expect(
      validateTrustedGameSession({
        gameId: 'runner',
        score: 123.9,
        pickups: 9.7,
      })
    ).toEqual({
      gameId: 'runner',
      score: 123,
      pickups: 9,
    });

    expect(() =>
      validateTrustedGameSession({
        gameId: 'not-a-game',
        score: 10,
        pickups: 1,
      })
    ).toThrow('Game is not registered for trusted progression writes.');
  });

  test('calculateTrustedGameReward applies level perks and daily multiplier', () => {
    const level = 20;
    const score = 12_345;
    const pickups = 4;
    const baseReward = Math.floor(score / ECONOMY.SCORE_TO_COINS_RATIO) + pickups * ECONOMY.PICKUP_COIN_VALUE;
    const expectedWithoutDaily = Math.max(
      Math.floor(baseReward * UserService.getPerkModifiersForLevel(level).coinMultiplier) +
        Math.floor(score / 1000) *
          UserService.getPerkModifiersForLevel(level).bonusCoinsPerScore,
      UserService.getPerkModifiersForLevel(level).minCoinsPerGame
    );

    const withoutDaily = calculateTrustedGameReward({
      level,
      score,
      pickups,
      dailyChallengeMultiplierActive: false,
    });
    const withDaily = calculateTrustedGameReward({
      level,
      score,
      pickups,
      dailyChallengeMultiplierActive: true,
    });

    expect(withoutDaily).toBe(expectedWithoutDaily);
    expect(withDaily).toBeGreaterThan(withoutDaily);
    expect(withDaily).toBe(
      Math.max(
        Math.floor(baseReward * UserService.getPerkModifiersForLevel(level).coinMultiplier * ECONOMY.DAILY_CHALLENGE_MULTIPLIER) +
          Math.floor(score / 1000) *
            UserService.getPerkModifiersForLevel(level).bonusCoinsPerScore,
        UserService.getPerkModifiersForLevel(level).minCoinsPerGame
      )
    );
  });

  test('validateAchievementIds deduplicates known ids and rejects unknown ids', () => {
    expect(validateAchievementIds(['first_jump', 'first_jump', 'coin_collector'])).toEqual([
      'first_jump',
      'coin_collector',
    ]);

    expect(() => validateAchievementIds(['first_jump', 'made-up-achievement'])).toThrow(
      'Unknown achievement id: made-up-achievement'
    );
  });

  test('validateTrustedChallengeSync validates template-backed daily challenges', () => {
    const [validated] = validateTrustedChallengeSync([
      {
        challengeId: 'daily-2026-04-14-runner_coin_collector',
        progress: 999,
        completed: true,
      },
    ]);

    expect(validated).toEqual({
      challengeId: 'daily-2026-04-14-runner_coin_collector',
      title: 'Coin Collector',
      description: 'Collect 50 coins in a single run',
      type: 'daily',
      gameId: 'runner',
      target: 50,
      progress: 50,
      reward: 300,
      completed: true,
      expiresAt: '2026-04-15T00:00:00.000Z',
    });
  });

  test('validateTrustedChallengeSync rejects malformed challenge ids', () => {
    expect(() =>
      validateTrustedChallengeSync([
        {
          challengeId: 'not-a-daily-id',
          progress: 1,
          completed: false,
        },
      ])
    ).toThrow('Unknown challenge id: not-a-daily-id');
  });
});
