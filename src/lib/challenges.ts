export type ChallengeMetric =
  | 'coins_collected'
  | 'distance'
  | 'speed'
  | 'powerups_used'
  | 'combo'
  | 'score'
  | 'games_played'
  | 'time_played'
  | 'coins_earned'
  | 'enemies_destroyed'
  | 'van_pickups'
  | 'sections_cleared';

export type ChallengeAggregation = 'sum' | 'max' | 'count';

export interface ChallengeRequirement {
  metric: ChallengeMetric;
  aggregation: ChallengeAggregation;
}

export interface ChallengeTemplate {
  templateId: string;
  title: string;
  description: string;
  type: 'daily' | 'weekly';
  gameId?: string;
  target: number;
  reward: number;
  requirement: ChallengeRequirement;
}

export const DAILY_CHALLENGE_TEMPLATES: ReadonlyArray<ChallengeTemplate> = [
  {
    templateId: 'runner_speed_demon',
    title: 'Speed Demon',
    description: 'Reach 2x speed in Endless Runner',
    type: 'daily',
    gameId: 'runner',
    target: 1,
    reward: 200,
    requirement: { metric: 'speed', aggregation: 'max' },
  },
  {
    templateId: 'runner_coin_collector',
    title: 'Coin Collector',
    description: 'Collect 50 coins in a single run',
    type: 'daily',
    gameId: 'runner',
    target: 50,
    reward: 300,
    requirement: { metric: 'coins_collected', aggregation: 'sum' },
  },
  {
    templateId: 'runner_marathon',
    title: 'Marathon Runner',
    description: 'Run 1000 meters in Endless Runner',
    type: 'daily',
    gameId: 'runner',
    target: 1000,
    reward: 400,
    requirement: { metric: 'distance', aggregation: 'max' },
  },
  {
    templateId: 'runner_power_player',
    title: 'Power Player',
    description: 'Use 3 power-ups in one run',
    type: 'daily',
    gameId: 'runner',
    target: 3,
    reward: 250,
    requirement: { metric: 'powerups_used', aggregation: 'sum' },
  },
  {
    templateId: 'runner_combo_master',
    title: 'Combo Master',
    description: 'Achieve a 10x coin combo',
    type: 'daily',
    gameId: 'runner',
    target: 10,
    reward: 350,
    requirement: { metric: 'combo', aggregation: 'max' },
  },
  {
    templateId: 'cross_daily_grind',
    title: 'Daily Grind',
    description: 'Play any game 3 times',
    type: 'daily',
    target: 3,
    reward: 150,
    requirement: { metric: 'games_played', aggregation: 'count' },
  },
  {
    templateId: 'cross_coin_hunter',
    title: 'Coin Hunter',
    description: 'Earn 500 coins from any source',
    type: 'daily',
    target: 500,
    reward: 100,
    requirement: { metric: 'coins_earned', aggregation: 'sum' },
  },
  {
    templateId: 'cross_high_scorer',
    title: 'High Scorer',
    description: 'Score 5000 points in any game',
    type: 'daily',
    target: 5000,
    reward: 200,
    requirement: { metric: 'score', aggregation: 'max' },
  },
  {
    templateId: 'cross_persistent_player',
    title: 'Persistent Player',
    description: 'Play for 10 minutes total',
    type: 'daily',
    target: 600,
    reward: 180,
    requirement: { metric: 'time_played', aggregation: 'sum' },
  },
  // ===== Speed Racer =====
  {
    templateId: 'speedracer_distance_haul',
    title: 'Long Haul',
    description: 'Travel 5,000m in a single Speed Racer run',
    type: 'daily',
    gameId: 'speed-racer',
    target: 5000,
    reward: 250,
    requirement: { metric: 'distance', aggregation: 'max' },
  },
  {
    templateId: 'speedracer_demolisher',
    title: 'Demolisher',
    description: 'Destroy 20 enemies in a single Speed Racer run',
    type: 'daily',
    gameId: 'speed-racer',
    target: 20,
    reward: 300,
    requirement: { metric: 'enemies_destroyed', aggregation: 'max' },
  },
  {
    templateId: 'speedracer_top_speed',
    title: 'Pedal to the Metal',
    description: 'Reach top speed in Speed Racer',
    type: 'daily',
    gameId: 'speed-racer',
    target: 640,
    reward: 150,
    requirement: { metric: 'speed', aggregation: 'max' },
  },
  {
    templateId: 'speedracer_bridge_burner',
    title: 'Section Hopper',
    description: 'Clear 3 sections in one Speed Racer run',
    type: 'daily',
    gameId: 'speed-racer',
    target: 3,
    reward: 350,
    requirement: { metric: 'sections_cleared', aggregation: 'max' },
  },
  {
    templateId: 'speedracer_quartermaster',
    title: 'Quartermaster',
    description: 'Dock with 3 weapon vans in one run',
    type: 'daily',
    gameId: 'speed-racer',
    target: 3,
    reward: 200,
    requirement: { metric: 'van_pickups', aggregation: 'max' },
  },
  {
    templateId: 'speedracer_combo_chain',
    title: 'Chain Reaction',
    description: 'Reach a x4 combo in Speed Racer',
    type: 'daily',
    gameId: 'speed-racer',
    target: 4,
    reward: 200,
    requirement: { metric: 'combo', aggregation: 'max' },
  },
];

const DAILY_TEMPLATE_LOOKUP = new Map(
  DAILY_CHALLENGE_TEMPLATES.map(template => [template.templateId, template])
);

const normalizeMetricValue = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.floor(value));
};

export const createDailyChallengeId = (dateKey: string, templateId: string): string =>
  `daily-${dateKey}-${templateId}`;

export const getChallengeTemplateId = (challengeId: string): string => {
  if (!challengeId.startsWith('daily-')) {
    return challengeId;
  }

  return challengeId.split('-').slice(4).join('-');
};

export const getChallengeTemplate = (challengeId: string): ChallengeTemplate | null =>
  DAILY_TEMPLATE_LOOKUP.get(getChallengeTemplateId(challengeId)) ?? null;

export const getDailyChallengeExpiresAt = (challengeId: string): string | null => {
  if (!challengeId.startsWith('daily-')) {
    return null;
  }

  const [, year, month, day] = challengeId.split('-');
  if (!year || !month || !day) {
    return null;
  }

  const expiresAt = new Date(
    Date.UTC(Number(year), Number(month) - 1, Number(day) + 1)
  );

  return Number.isNaN(expiresAt.getTime()) ? null : expiresAt.toISOString();
};

export const applyChallengeProgress = (
  currentProgress: number,
  target: number,
  requirement: ChallengeRequirement,
  value: number
): number => {
  const normalizedCurrent = normalizeMetricValue(currentProgress);
  const normalizedTarget = Math.max(0, Math.floor(target));
  const normalizedValue = normalizeMetricValue(value);

  switch (requirement.aggregation) {
    case 'sum':
      return Math.min(normalizedTarget, normalizedCurrent + normalizedValue);
    case 'count':
      return Math.min(normalizedTarget, normalizedCurrent + 1);
    case 'max':
      return Math.min(normalizedTarget, Math.max(normalizedCurrent, normalizedValue));
    default:
      return normalizedCurrent;
  }
};
