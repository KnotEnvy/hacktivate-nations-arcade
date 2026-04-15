import { ACHIEVEMENTS } from '@/data/achievements';
import { ECONOMY } from '@/lib/constants';
import {
  getChallengeTemplate,
  getDailyChallengeExpiresAt,
  type ChallengeTemplate,
} from '@/lib/challenges';
import { isGameImplemented } from '@/lib/gameCatalog';
import { CurrencyService } from '@/services/CurrencyService';
import { UserService } from '@/services/UserServices';

const MAX_TRUSTED_SCORE = 100000000;
const MAX_TRUSTED_PICKUPS = 1000000;
const MAX_TRUSTED_PROGRESS = 1000000;

export interface TrustedGameSessionInput {
  gameId: string;
  score: number;
  pickups: number;
}

export interface TrustedChallengeSyncInput {
  challengeId: string;
  progress: number;
  completed: boolean;
}

export interface ValidatedChallengeSync {
  challengeId: string;
  title: string;
  description: string;
  type: ChallengeTemplate['type'];
  gameId: string | null;
  target: number;
  progress: number;
  reward: number;
  completed: boolean;
  expiresAt: string;
}

const normalizeBoundedInteger = (
  value: number,
  fieldName: string,
  maxValue: number
): number => {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${fieldName} must be a non-negative number.`);
  }

  const normalized = Math.floor(value);
  if (normalized > maxValue) {
    throw new Error(`${fieldName} exceeds the supported limit.`);
  }

  return normalized;
};

export const validateTrustedGameSession = (
  input: TrustedGameSessionInput
): TrustedGameSessionInput => {
  if (!isGameImplemented(input.gameId)) {
    throw new Error('Game is not registered for trusted progression writes.');
  }

  return {
    gameId: input.gameId,
    score: normalizeBoundedInteger(input.score, 'score', MAX_TRUSTED_SCORE),
    pickups: normalizeBoundedInteger(input.pickups, 'pickups', MAX_TRUSTED_PICKUPS),
  };
};

export const calculateTrustedGameReward = (params: {
  level: number;
  score: number;
  pickups: number;
  dailyChallengeMultiplierActive: boolean;
}): number => {
  const currencyService = new CurrencyService();
  const modifiers = UserService.getPerkModifiersForLevel(params.level);

  currencyService.setRewardModifiers({
    coinMultiplier: modifiers.coinMultiplier,
    minCoinsPerGame: modifiers.minCoinsPerGame,
    bonusCoinsPerScore: modifiers.bonusCoinsPerScore,
  });
  currencyService.setBonusMultiplier(
    params.dailyChallengeMultiplierActive
      ? ECONOMY.DAILY_CHALLENGE_MULTIPLIER
      : 1
  );

  return currencyService.calculateGameReward(params.score, params.pickups);
};

export const getAchievementDefinition = (achievementId: string) =>
  ACHIEVEMENTS.find(achievement => achievement.id === achievementId) ?? null;

export const validateAchievementIds = (achievementIds: string[]): string[] => {
  const uniqueIds = Array.from(new Set(achievementIds));

  uniqueIds.forEach(achievementId => {
    if (!getAchievementDefinition(achievementId)) {
      throw new Error(`Unknown achievement id: ${achievementId}`);
    }
  });

  return uniqueIds;
};

export const validateTrustedChallengeSync = (
  challenges: TrustedChallengeSyncInput[]
): ValidatedChallengeSync[] => {
  return challenges.map(challenge => {
    const template = getChallengeTemplate(challenge.challengeId);
    if (!template) {
      throw new Error(`Unknown challenge id: ${challenge.challengeId}`);
    }

    const expiresAt = getDailyChallengeExpiresAt(challenge.challengeId);
    if (!expiresAt) {
      throw new Error(`Challenge id is missing a valid expiry: ${challenge.challengeId}`);
    }

    const progress = normalizeBoundedInteger(
      challenge.progress,
      'challenge progress',
      Math.max(template.target, MAX_TRUSTED_PROGRESS)
    );

    return {
      challengeId: challenge.challengeId,
      title: template.title,
      description: template.description,
      type: template.type,
      gameId: template.gameId ?? null,
      target: template.target,
      progress: Math.min(template.target, progress),
      reward: template.reward,
      completed: challenge.completed,
      expiresAt,
    };
  });
};
