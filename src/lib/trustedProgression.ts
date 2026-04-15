import { ACHIEVEMENTS } from '@/data/achievements';
import { ECONOMY } from '@/lib/constants';
import {
  applyChallengeProgress,
  getChallengeTemplate,
  getDailyChallengeExpiresAt,
  type ChallengeMetric,
  type ChallengeTemplate,
} from '@/lib/challenges';
import { isGameImplemented } from '@/lib/gameCatalog';
import { CurrencyService } from '@/services/CurrencyService';
import { UserService, type UserStats } from '@/services/UserServices';

const MAX_TRUSTED_SCORE = 100000000;
const MAX_TRUSTED_PICKUPS = 1000000;
const MAX_TRUSTED_PROGRESS = 1000000;
const MAX_TRUSTED_TIME_PLAYED_MS = 24 * 60 * 60 * 1000;
const MAX_TRUSTED_SESSION_METRIC = 100000000;

const DEFAULT_USER_STATS: UserStats = {
  totalDistance: 0,
  maxSpeed: 0,
  maxCombo: 0,
  totalJumps: 0,
  powerupsUsed: 0,
  achievementsUnlocked: 0,
  challengesCompleted: 0,
  gamesPlayed: 0,
  coinsEarned: 0,
};

const SESSION_METRIC_ALIASES: Record<string, string[]> = {
  max_speed: ['max_speed', 'speed'],
  max_combo: ['max_combo', 'combo'],
  puzzle_level: ['puzzle_level', 'level'],
  tetris_count: ['tetris_count', 'tetrisCount'],
  unique_themes: ['unique_themes', 'uniqueThemes'],
  waves_completed: ['waves_completed', 'wave'],
  max_stage: ['max_stage', 'level'],
  enemies_destroyed: ['enemies_destroyed', 'totalKills'],
  powerup_types: ['powerup_types'],
  max_fever: ['max_fever', 'max_fever_level'],
  owl_found: ['owl_found', 'found_owl'],
  totalScore: ['totalScore', 'score'],
  powerups_used: ['powerups_used', 'powerupsUsed'],
  lines_cleared: ['lines_cleared', 'linesCleared'],
};

export interface TrustedSessionMetrics {
  [metric: string]: number;
}

export interface TrustedGameSessionInput {
  gameId: string;
  score: number;
  pickups: number;
  timePlayedMs?: number;
  metrics?: TrustedSessionMetrics;
  clientMutationId?: string;
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

export interface TrustedProgressionSettings {
  processedSessionMutationIds: string[];
  playedGameIds: string[];
  bestScoresByGame: Record<string, number>;
}

export interface TrustedSessionProgressionState {
  gamesPlayed: number;
  totalPlayTime: number;
  stats: UserStats;
  settings: TrustedProgressionSettings;
}

export interface TrustedChallengeProgressUpdate {
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

const normalizeBoundedNumber = (
  value: number,
  fieldName: string,
  maxValue: number
): number => {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${fieldName} must be a non-negative number.`);
  }

  if (value > maxValue) {
    throw new Error(`${fieldName} exceeds the supported limit.`);
  }

  return value;
};

const getNumericStat = (
  value: unknown,
  fallback: number
): number => (typeof value === 'number' && Number.isFinite(value) ? value : fallback);

const getMetricValue = (
  metrics: TrustedSessionMetrics,
  metric: string
): number => {
  const keys = SESSION_METRIC_ALIASES[metric] ?? [metric];

  for (const key of keys) {
    const value = metrics[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
  }

  if (metric === 'time_bonus') {
    const timeRemaining = metrics.time_remaining;
    return typeof timeRemaining === 'number' && timeRemaining >= 60 ? 1 : 0;
  }

  return 0;
};

const normalizeTrustedSessionMetrics = (
  metrics: TrustedSessionMetrics | undefined
): TrustedSessionMetrics => {
  if (!metrics) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(metrics).map(([metric, value]) => [
      metric,
      normalizeBoundedNumber(
        value,
        `trusted session metric "${metric}"`,
        MAX_TRUSTED_SESSION_METRIC
      ),
    ])
  );
};

const normalizeBestScoresByGame = (value: unknown): Record<string, number> => {
  if (typeof value !== 'object' || value === null) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, score]) => typeof score === 'number' && Number.isFinite(score))
      .map(([gameId, score]) => [gameId, Math.max(0, Math.floor(score as number))])
  );
};

export const getTrustedProgressionSettings = (
  settings: unknown
): TrustedProgressionSettings => {
  const record =
    typeof settings === 'object' && settings !== null
      ? (settings as Record<string, unknown>)
      : {};

  return {
    processedSessionMutationIds: Array.isArray(record.processedSessionMutationIds)
      ? record.processedSessionMutationIds.filter(
          (entry): entry is string => typeof entry === 'string'
        )
      : [],
    playedGameIds: Array.isArray(record.playedGameIds)
      ? Array.from(
          new Set(
            record.playedGameIds.filter(
              (entry): entry is string => typeof entry === 'string'
            )
          )
        )
      : [],
    bestScoresByGame: normalizeBestScoresByGame(record.bestScoresByGame),
  };
};

export const getProcessedSessionMutationIds = (settings: unknown): string[] =>
  getTrustedProgressionSettings(settings).processedSessionMutationIds;

export const appendProcessedSessionMutationId = (
  settings: unknown,
  mutationId: string
): TrustedProgressionSettings => {
  const nextSettings = getTrustedProgressionSettings(settings);
  nextSettings.processedSessionMutationIds = Array.from(
    new Set([...nextSettings.processedSessionMutationIds, mutationId])
  ).slice(-100);
  return nextSettings;
};

export const getTrustedUserStats = (stats: unknown): UserStats => {
  const record =
    typeof stats === 'object' && stats !== null
      ? (stats as Record<string, unknown>)
      : {};

  return {
    totalDistance: getNumericStat(record.totalDistance, DEFAULT_USER_STATS.totalDistance),
    maxSpeed: getNumericStat(record.maxSpeed, DEFAULT_USER_STATS.maxSpeed),
    maxCombo: getNumericStat(record.maxCombo, DEFAULT_USER_STATS.maxCombo),
    totalJumps: getNumericStat(record.totalJumps, DEFAULT_USER_STATS.totalJumps),
    powerupsUsed: getNumericStat(record.powerupsUsed, DEFAULT_USER_STATS.powerupsUsed),
    achievementsUnlocked: getNumericStat(
      record.achievementsUnlocked,
      DEFAULT_USER_STATS.achievementsUnlocked
    ),
    challengesCompleted: getNumericStat(
      record.challengesCompleted,
      DEFAULT_USER_STATS.challengesCompleted
    ),
    gamesPlayed: getNumericStat(record.gamesPlayed, DEFAULT_USER_STATS.gamesPlayed),
    coinsEarned: getNumericStat(record.coinsEarned, DEFAULT_USER_STATS.coinsEarned),
  };
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
    timePlayedMs: normalizeBoundedInteger(
      input.timePlayedMs ?? 0,
      'timePlayedMs',
      MAX_TRUSTED_TIME_PLAYED_MS
    ),
    metrics: normalizeTrustedSessionMetrics(input.metrics),
    clientMutationId: input.clientMutationId?.trim() || undefined,
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

export const buildTrustedSessionProgressionState = (params: {
  currentStats: unknown;
  currentSettings: unknown;
  currentGamesPlayed: number;
  currentTotalPlayTime: number;
  session: TrustedGameSessionInput;
  rewardAwarded: number;
}): TrustedSessionProgressionState => {
  const stats = getTrustedUserStats(params.currentStats);
  const settings = getTrustedProgressionSettings(params.currentSettings);
  const metrics = params.session.metrics ?? {};

  const nextStats: UserStats = {
    ...stats,
    totalDistance: Math.max(stats.totalDistance, getMetricValue(metrics, 'distance')),
    maxSpeed: Math.max(stats.maxSpeed, getMetricValue(metrics, 'max_speed')),
    maxCombo: Math.max(stats.maxCombo, getMetricValue(metrics, 'max_combo')),
    totalJumps: stats.totalJumps + Math.floor(getMetricValue(metrics, 'jumps')),
    powerupsUsed:
      stats.powerupsUsed + Math.floor(getMetricValue(metrics, 'powerups_used')),
    achievementsUnlocked: stats.achievementsUnlocked,
    challengesCompleted: stats.challengesCompleted,
    gamesPlayed: Math.max(0, Math.floor(params.currentGamesPlayed)) + 1,
    coinsEarned: stats.coinsEarned + params.rewardAwarded,
  };

  const nextSettings: TrustedProgressionSettings = {
    ...settings,
    playedGameIds: Array.from(
      new Set([...settings.playedGameIds, params.session.gameId])
    ),
    bestScoresByGame: {
      ...settings.bestScoresByGame,
      [params.session.gameId]: Math.max(
        settings.bestScoresByGame[params.session.gameId] ?? 0,
        params.session.score
      ),
    },
  };

  return {
    gamesPlayed: nextStats.gamesPlayed,
    totalPlayTime:
      Math.max(0, Math.floor(params.currentTotalPlayTime)) +
      Math.floor((params.session.timePlayedMs ?? 0) / 1000),
    stats: nextStats,
    settings: nextSettings,
  };
};

const getHighScoresAcrossGamesCount = (
  bestScoresByGame: Record<string, number>
): number =>
  Object.values(bestScoresByGame).filter(score => score >= 1000).length;

const getTrustedAchievementValue = (params: {
  requirementType: string;
  gameId: string | undefined;
  sessionGameId: string;
  sessionScore: number;
  totalPlayTime: number;
  stats: UserStats;
  settings: TrustedProgressionSettings;
  metrics: TrustedSessionMetrics;
}): number | null => {
  if (params.gameId && params.gameId !== params.sessionGameId) {
    return null;
  }

  switch (params.requirementType) {
    case 'games_played':
      return params.stats.gamesPlayed;
    case 'total_playtime':
      return params.totalPlayTime;
    case 'total_coins_earned':
      return params.stats.coinsEarned;
    case 'total_jumps':
      return params.stats.totalJumps;
    case 'powerups_total':
      return params.stats.powerupsUsed;
    case 'unique_games_played':
      return params.settings.playedGameIds.length;
    case 'high_scores_across_games':
      return getHighScoresAcrossGamesCount(params.settings.bestScoresByGame);
    case 'consecutive_days':
      return null;
    case 'score':
      return params.sessionScore;
    default: {
      const value = getMetricValue(params.metrics, params.requirementType);
      return value > 0 || params.metrics[params.requirementType] === 0 ? value : 0;
    }
  }
};

export const getTrustedSessionAchievementIds = (params: {
  session: TrustedGameSessionInput;
  totalPlayTime: number;
  stats: UserStats;
  settings: TrustedProgressionSettings;
  existingAchievementIds: string[];
}): string[] => {
  const existingIds = new Set(params.existingAchievementIds);
  const metrics = params.session.metrics ?? {};

  return ACHIEVEMENTS.filter(achievement => !existingIds.has(achievement.id))
    .filter(achievement => {
      const value = getTrustedAchievementValue({
        requirementType: achievement.requirement.type,
        gameId: achievement.gameId,
        sessionGameId: params.session.gameId,
        sessionScore: params.session.score,
        totalPlayTime: params.totalPlayTime,
        stats: params.stats,
        settings: params.settings,
        metrics,
      });
      return value !== null && value >= achievement.requirement.value;
    })
    .map(achievement => achievement.id);
};

export const getTrustedChallengeMetricValue = (params: {
  metric: ChallengeMetric;
  session: TrustedGameSessionInput;
  rewardAwarded: number;
}): number => {
  switch (params.metric) {
    case 'games_played':
      return 1;
    case 'time_played':
      return Math.floor((params.session.timePlayedMs ?? 0) / 1000);
    case 'coins_earned':
      return params.rewardAwarded;
    case 'score':
      return params.session.score;
    case 'coins_collected':
      return getMetricValue(params.session.metrics ?? {}, 'coins_collected') || params.session.pickups;
    default:
      return getMetricValue(params.session.metrics ?? {}, params.metric);
  }
};

export const buildTrustedChallengeProgressUpdate = (params: {
  challengeId: string;
  currentProgress: number;
  session: TrustedGameSessionInput;
  rewardAwarded: number;
}): TrustedChallengeProgressUpdate | null => {
  const template = getChallengeTemplate(params.challengeId);
  if (!template) {
    return null;
  }

  const expiresAt = getDailyChallengeExpiresAt(params.challengeId);
  if (!expiresAt) {
    return null;
  }

  const value = getTrustedChallengeMetricValue({
    metric: template.requirement.metric,
    session: params.session,
    rewardAwarded: params.rewardAwarded,
  });

  const progress = applyChallengeProgress(
    params.currentProgress,
    template.target,
    template.requirement,
    value
  );

  return {
    challengeId: params.challengeId,
    title: template.title,
    description: template.description,
    type: template.type,
    gameId: template.gameId ?? null,
    target: template.target,
    progress,
    reward: template.reward,
    completed: progress >= template.target,
    expiresAt,
  };
};
