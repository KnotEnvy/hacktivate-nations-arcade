import { ChallengeService, type Challenge } from '@/services/ChallengeService';

describe('ChallengeService', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.restoreAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  const makeChallenge = (overrides: Partial<Challenge> = {}): Challenge => ({
    id: 'custom-distance-challenge',
    title: 'Distance Matters',
    description: 'Collect coins, ignore movement',
    type: 'daily',
    gameId: 'runner',
    target: 1000,
    progress: 0,
    reward: 250,
    completed: false,
    expiresAt: new Date('2026-04-15T00:00:00.000Z'),
    requirement: { metric: 'distance', aggregation: 'max' },
    ...overrides,
  });

  test('updates progress from typed requirements even when description does not match', () => {
    const svc = new ChallengeService();
    const completedChallenges: string[] = [];

    svc.onChallengeCompleted(challenge => {
      completedChallenges.push(challenge.id);
    });

    svc.setChallenges([makeChallenge()]);
    svc.updateProgress('runner', 'distance', 1200);

    const [challenge] = svc.getChallenges();
    expect(challenge.progress).toBe(1000);
    expect(challenge.completed).toBe(true);
    expect(completedChallenges).toEqual(['custom-distance-challenge']);
  });

  test('ignores metrics that do not match the typed requirement', () => {
    const svc = new ChallengeService();
    svc.setChallenges([
      makeChallenge({
        id: 'custom-score-challenge',
        title: 'Score Hunt',
        description: 'Collect 50 coins in a single run',
        target: 5000,
        requirement: { metric: 'score', aggregation: 'max' },
      }),
    ]);

    svc.updateProgress('runner', 'coins_collected', 50);

    const [challenge] = svc.getChallenges();
    expect(challenge.progress).toBe(0);
    expect(challenge.completed).toBe(false);
  });

  test('hydrates template-backed challenges without relying on description parsing', () => {
    const svc = new ChallengeService();
    svc.setChallenges([
      {
        id: 'daily-2026-04-14-cross_daily_grind',
        title: 'Daily Grind',
        description: 'Play any game 3 times',
        type: 'daily',
        target: 3,
        progress: 0,
        reward: 150,
        completed: false,
        expiresAt: new Date('2026-04-15T00:00:00.000Z'),
      } as Challenge,
    ]);

    svc.updateProgress('', 'games_played', 1);

    const [challenge] = svc.getChallenges();
    expect(challenge.requirement).toEqual({
      metric: 'games_played',
      aggregation: 'count',
    });
    expect(challenge.progress).toBe(1);
  });
});
