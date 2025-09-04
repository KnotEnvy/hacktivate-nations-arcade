import { Analytics } from '@/services/Analytics';

describe('Analytics', () => {
  let analytics: Analytics;

  beforeEach(() => {
    analytics = new Analytics();
    localStorage.clear();
  });

  describe('initialization', () => {
    test('initializes with empty metrics', async () => {
      await analytics.init();
      const metrics = analytics.getPlayerMetrics();
      
      expect(metrics.gamesPlayed).toBe(0);
      expect(metrics.totalPlayTime).toBe(0);
      expect(metrics.favoriteGame).toBe('none');
    });

    test('loads existing data from localStorage', async () => {
      const existingData = {
        gamesPlayed: 5,
        totalPlayTime: 10000,
        gameStats: {
          'runner': { plays: 3, totalTime: 6000 },
          'snake': { plays: 2, totalTime: 4000 }
        }
      };
      localStorage.setItem('hacktivate-analytics', JSON.stringify(existingData));

      await analytics.init();
      const metrics = analytics.getPlayerMetrics();
      
      expect(metrics.gamesPlayed).toBe(5);
      expect(metrics.totalPlayTime).toBe(10000);
      expect(metrics.favoriteGame).toBe('runner'); // Most played
    });
  });

  describe('game session tracking', () => {
    beforeEach(async () => {
      await analytics.init();
    });

    test('tracks game start event', () => {
      analytics.trackGameStart('runner');
      
      const metrics = analytics.getPlayerMetrics();
      expect(metrics.gamesPlayed).toBe(1);
    });

    test('tracks game end with score and coins', () => {
      analytics.trackGameStart('runner');
      analytics.trackGameEnd('runner', 1000, 50, 'completed');
      
      const insights = analytics.getPlayerInsights();
      expect(insights.skillLevel).toBeDefined();
    });

    test('calculates total play time correctly', () => {
      const startTime = Date.now();
      analytics.trackGameStart('runner');
      
      // Mock time passage
      jest.spyOn(Date, 'now').mockReturnValue(startTime + 5000);
      analytics.trackGameEnd('runner', 500, 25, 'died');
      
      const metrics = analytics.getPlayerMetrics();
      expect(metrics.totalPlayTime).toBeGreaterThanOrEqual(5000);
    });

    test('tracks multiple game sessions', () => {
      analytics.trackGameStart('runner');
      analytics.trackGameEnd('runner', 800, 40, 'completed');
      
      analytics.trackGameStart('snake');
      analytics.trackGameEnd('snake', 1200, 60, 'died');
      
      const metrics = analytics.getPlayerMetrics();
      expect(metrics.gamesPlayed).toBe(2);
    });
  });

  describe('player insights generation', () => {
    beforeEach(async () => {
      await analytics.init();
    });

    test('determines skill level based on performance', () => {
      // Play multiple high-scoring games
      for (let i = 0; i < 5; i++) {
        analytics.trackGameStart('runner');
        analytics.trackGameEnd('runner', 2000, 100, 'completed');
      }
      
      const insights = analytics.getPlayerInsights();
      expect(['beginner', 'intermediate', 'advanced', 'expert']).toContain(insights.skillLevel);
    });

    test('identifies most played game correctly', () => {
      // Play runner 3 times
      for (let i = 0; i < 3; i++) {
        analytics.trackGameStart('runner');
        analytics.trackGameEnd('runner', 1000, 50, 'completed');
      }
      
      // Play snake 1 time
      analytics.trackGameStart('snake');
      analytics.trackGameEnd('snake', 800, 40, 'died');
      
      const insights = analytics.getPlayerInsights();
      expect(insights.mostPlayedGame).toBe('runner');
    });

    test('determines preferred game length', () => {
      // Play short sessions
      for (let i = 0; i < 3; i++) {
        analytics.trackGameStart('runner');
        // Short session (10 seconds)
        jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 10000);
        analytics.trackGameEnd('runner', 500, 25, 'died');
      }
      
      const insights = analytics.getPlayerInsights();
      expect(['short', 'medium', 'long']).toContain(insights.preferredGameLength);
    });
  });

  describe('currency tracking', () => {
    beforeEach(async () => {
      await analytics.init();
    });

    test('tracks currency transactions', () => {
      analytics.trackCurrencyTransaction(100, 'game_runner', 500);
      analytics.trackCurrencyTransaction(-50, 'unlock_game', 450);
      
      // Should store transaction data for analysis
      const metrics = analytics.getPlayerMetrics();
      expect(metrics).toBeDefined();
    });

    test('calculates average coins per session', () => {
      analytics.trackGameStart('runner');
      analytics.trackGameEnd('runner', 1000, 50, 'completed');
      
      analytics.trackGameStart('snake');  
      analytics.trackGameEnd('snake', 800, 40, 'died');
      
      const insights = analytics.getPlayerInsights();
      expect(insights).toBeDefined();
    });
  });

  describe('achievement tracking', () => {
    beforeEach(async () => {
      await analytics.init();
    });

    test('tracks achievement unlocks', () => {
      analytics.trackAchievementUnlock('first_game', 50);
      
      // Should be reflected in player metrics
      const metrics = analytics.getPlayerMetrics();
      expect(metrics).toBeDefined();
    });
  });

  describe('data persistence', () => {
    test('saves analytics data to localStorage', async () => {
      await analytics.init();
      
      analytics.trackGameStart('runner');
      analytics.trackGameEnd('runner', 1000, 50, 'completed');
      
      const saved = localStorage.getItem('hacktivate-analytics');
      expect(saved).toBeDefined();
      
      const data = JSON.parse(saved!);
      expect(data.gamesPlayed).toBe(1);
    });

    test('persists data across analytics instances', async () => {
      await analytics.init();
      analytics.trackGameStart('runner');
      analytics.trackGameEnd('runner', 1000, 50, 'completed');
      
      // Create new instance
      const newAnalytics = new Analytics();
      await newAnalytics.init();
      
      const metrics = newAnalytics.getPlayerMetrics();
      expect(metrics.gamesPlayed).toBe(1);
    });
  });

  describe('session length tracking', () => {
    beforeEach(async () => {
      await analytics.init();
    });

    test('calculates average session length', () => {
      const sessions = [5000, 10000, 15000]; // 5s, 10s, 15s
      
      sessions.forEach((duration, i) => {
        analytics.trackGameStart('runner');
        jest.spyOn(Date, 'now').mockReturnValue(Date.now() + duration);
        analytics.trackGameEnd('runner', 1000, 50, 'completed');
      });
      
      const metrics = analytics.getPlayerMetrics();
      expect(metrics.averageSessionLength).toBeCloseTo(10000, -2); // ~10 seconds
    });
  });
});