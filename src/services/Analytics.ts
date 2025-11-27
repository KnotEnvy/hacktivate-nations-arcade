export type SessionOutcome = 'completed' | 'abandoned' | 'died';

interface StoredAnalytics {
  gamesPlayed: number;
  totalPlayTime: number;
  gameStats: Record<string, { plays: number; totalTime: number }>;
}

interface GameSession {
  gameId: string;
  startTime: number;
  score: number;
  coinsEarned: number;
}

export interface PlayerMetrics {
  gamesPlayed: number;
  totalPlayTime: number;
  averageSessionLength: number;
  favoriteGame: string;
}

export interface PlayerInsights {
  skillLevel: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  mostPlayedGame: string;
  preferredGameLength: 'short' | 'medium' | 'long';
}

export class Analytics {
  private storageKey = 'hacktivate-analytics';
  private metrics: StoredAnalytics = {
    gamesPlayed: 0,
    totalPlayTime: 0,
    gameStats: {},
  };
  private currentSession: GameSession | null = null;
  private sessionDurations: number[] = [];

  async init(): Promise<void> {
    this.metrics = this.loadStoredMetrics();
  }

  trackGameStart(gameId: string): void {
    const startTime = Date.now();
    this.currentSession = { gameId, startTime, score: 0, coinsEarned: 0 };
    this.metrics.gamesPlayed += 1;

    const stats = this.metrics.gameStats[gameId] ?? { plays: 0, totalTime: 0 };
    stats.plays += 1;
    this.metrics.gameStats[gameId] = stats;
    this.persist();
  }

  trackGameEnd(gameId: string, finalScore: number, coinsEarned: number, _outcome: SessionOutcome): void {
    if (!this.currentSession || this.currentSession.gameId !== gameId) return;
    const endTime = Date.now();
    const duration = Math.max(0, endTime - this.currentSession.startTime + 1);
    this.currentSession.score = finalScore;
    this.currentSession.coinsEarned = coinsEarned;
    this.metrics.totalPlayTime += duration;
    this.sessionDurations.push(duration);

    const stats = this.metrics.gameStats[gameId] ?? { plays: 0, totalTime: 0 };
    stats.totalTime += duration;
    this.metrics.gameStats[gameId] = stats;
    this.currentSession = null;
    this.persist();
  }

  trackGameSpecificStat(_gameId: string, _statType: string, _value: number): void {
    // Placeholder hook for game-specific analytics; not persisted yet.
  }

  trackCrossGameStat(_statType: string, _value: number): void {
    // Placeholder hook for cross-game analytics; not persisted yet.
  }

  trackCurrencyTransaction(_amount: number, _source: string, _balanceAfter: number): void {
    // Placeholder for future analytics; kept for API compatibility.
  }

  trackAchievementUnlock(_id: string, _reward: number): void {
    // Placeholder for future analytics; kept for API compatibility.
  }

  getPlayerMetrics(): PlayerMetrics {
    const favoriteGame = this.computeFavoriteGame();
    const averageSessionLength =
      this.metrics.gamesPlayed > 0
        ? Math.floor(this.metrics.totalPlayTime / this.metrics.gamesPlayed)
        : 0;
    return {
      gamesPlayed: this.metrics.gamesPlayed,
      totalPlayTime: this.metrics.totalPlayTime,
      averageSessionLength,
      favoriteGame,
    };
  }

  getPlayerInsights(): PlayerInsights {
    const metrics = this.getPlayerMetrics();
    const skillLevel =
      metrics.gamesPlayed > 20
        ? 'expert'
        : metrics.gamesPlayed > 10
          ? 'advanced'
          : metrics.gamesPlayed > 5
            ? 'intermediate'
            : 'beginner';

    const preferredGameLength = this.computePreferredLength();

    return {
      skillLevel,
      mostPlayedGame: metrics.favoriteGame,
      preferredGameLength,
    };
  }

  private computeFavoriteGame(): string {
    const entries = Object.entries(this.metrics.gameStats);
    if (entries.length === 0) return 'none';
    const [gameId] = entries.reduce(
      (top, current) => (current[1].plays > top[1].plays ? current : top),
      entries[0]
    );
    return gameId;
  }

  private computePreferredLength(): 'short' | 'medium' | 'long' {
    if (this.sessionDurations.length === 0) return 'short';
    const avg = this.sessionDurations.reduce((sum, d) => sum + d, 0) / this.sessionDurations.length;
    if (avg < 30_000) return 'short';
    if (avg < 90_000) return 'medium';
    return 'long';
  }

  private loadStoredMetrics(): StoredAnalytics {
    if (typeof window === 'undefined') return { gamesPlayed: 0, totalPlayTime: 0, gameStats: {} };
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) return { gamesPlayed: 0, totalPlayTime: 0, gameStats: {} };
      return { gamesPlayed: 0, totalPlayTime: 0, gameStats: {}, ...JSON.parse(raw) };
    } catch {
      return { gamesPlayed: 0, totalPlayTime: 0, gameStats: {} };
    }
  }

  private persist(): void {
    if (typeof window === 'undefined') return;
    const payload: StoredAnalytics = { ...this.metrics };
    localStorage.setItem(this.storageKey, JSON.stringify(payload));
  }
}
