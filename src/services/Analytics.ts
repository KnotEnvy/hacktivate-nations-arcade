export type SessionOutcome = 'completed' | 'abandoned' | 'died';

interface FeatureUsageEntry {
  count: number;
  lastUsed: number;
  lastPayload?: Record<string, unknown>;
}

interface GameStatsEntry {
  plays: number;
  totalTime: number;
  totalScore: number;
  coinsEarned: number;
  lastPlayed: number;
}

interface ConversionSnapshot {
  gameStarts: number;
  gameCompletions: number;
  returnVisits: number;
  monetizationEvents: number;
  lastActiveAt: number;
}

interface StoredAnalytics {
  gamesPlayed: number;
  totalPlayTime: number;
  gameStats: Record<string, GameStatsEntry>;
  featureUsage: Record<string, FeatureUsageEntry>;
  conversion: ConversionSnapshot;
  recentScores: number[];
  achievements: string[];
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
  lastActiveAt?: number;
}

export interface ConversionMetrics {
  gameStartRate: number;
  completionRate: number;
  retentionRate: number;
  monetizationRate: number;
}

export interface PlayerInsights {
  skillLevel: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  mostPlayedGame: string;
  preferredGameLength: 'short' | 'medium' | 'long';
  averageScore: number;
  improvementAreas: string[];
  achievements: string[];
}

export class Analytics {
  private storageKey = 'hacktivate-analytics';
  private metrics: StoredAnalytics = {
    gamesPlayed: 0,
    totalPlayTime: 0,
    gameStats: {},
    featureUsage: {},
    conversion: {
      gameStarts: 0,
      gameCompletions: 0,
      returnVisits: 0,
      monetizationEvents: 0,
      lastActiveAt: 0,
    },
    recentScores: [],
    achievements: [],
  };
  private currentSession: GameSession | null = null;
  private sessionDurations: number[] = [];
  private maxRecentScores = 30;

  async init(): Promise<void> {
    this.metrics = this.loadStoredMetrics();
  }

  trackGameStart(gameId: string): void {
    const startTime = Date.now();
    this.currentSession = { gameId, startTime, score: 0, coinsEarned: 0 };
    this.metrics.gamesPlayed += 1;
    this.metrics.conversion.gameStarts += 1;
    this.recordReturnVisit();

    const stats =
      this.metrics.gameStats[gameId] ?? {
        plays: 0,
        totalTime: 0,
        totalScore: 0,
        coinsEarned: 0,
        lastPlayed: 0,
      };
    stats.plays += 1;
    stats.lastPlayed = startTime;
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
    this.metrics.recentScores = [finalScore, ...this.metrics.recentScores].slice(0, this.maxRecentScores);

    const stats =
      this.metrics.gameStats[gameId] ?? {
        plays: 0,
        totalTime: 0,
        totalScore: 0,
        coinsEarned: 0,
        lastPlayed: 0,
      };
    stats.totalTime += duration;
    stats.totalScore += finalScore;
    stats.coinsEarned += coinsEarned;
    stats.lastPlayed = endTime;
    this.metrics.gameStats[gameId] = stats;
    if (_outcome === 'completed') {
      this.metrics.conversion.gameCompletions += 1;
    }
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
    // Count currency events toward monetization engagement for now.
    this.metrics.conversion.monetizationEvents += 1;
    this.persist();
  }

  trackAchievementUnlock(_id: string, _reward: number): void {
    if (!this.metrics.achievements.includes(_id)) {
      this.metrics.achievements = [...this.metrics.achievements, _id].slice(0, 25);
      this.persist();
    }
  }

  trackFeatureUsage(feature: string, payload?: Record<string, unknown>): void {
    const current = this.metrics.featureUsage[feature] ?? { count: 0, lastUsed: 0 };
    this.metrics.featureUsage[feature] = {
      count: current.count + 1,
      lastUsed: Date.now(),
      lastPayload: payload,
    };
    this.persist();
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
      lastActiveAt: this.metrics.conversion.lastActiveAt,
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
    const averageScore =
      this.metrics.recentScores.length > 0
        ? this.metrics.recentScores.reduce((sum, score) => sum + score, 0) /
          this.metrics.recentScores.length
        : 0;
    const improvementAreas: string[] = [];
    if (metrics.averageSessionLength < 45_000) {
      improvementAreas.push('Play slightly longer runs to boost XP gains.');
    }
    if (metrics.gamesPlayed < 3) {
      improvementAreas.push('Try multiple games to unlock better matchups.');
    }
    if (averageScore === 0) {
      improvementAreas.push('Finish a round to start building your score history.');
    }

    return {
      skillLevel,
      mostPlayedGame: metrics.favoriteGame,
      preferredGameLength,
      averageScore,
      improvementAreas,
      achievements: this.metrics.achievements,
    };
  }

  getConversionMetrics(): ConversionMetrics {
    const starts = this.metrics.conversion.gameStarts;
    const completions = this.metrics.conversion.gameCompletions;
    const returns = this.metrics.conversion.returnVisits;
    const monetization = this.metrics.conversion.monetizationEvents;
    const sessions = Math.max(1, this.metrics.gamesPlayed);
    return {
      gameStartRate: Math.min(1, starts / sessions),
      completionRate: sessions === 0 ? 0 : completions / sessions,
      retentionRate: starts === 0 ? 0 : Math.min(1, returns / starts),
      monetizationRate: starts === 0 ? 0 : Math.min(1, monetization / starts),
    };
  }

  getRecommendedGames(): string[] {
    const entries = Object.entries(this.metrics.gameStats);
    if (entries.length === 0) {
      return ['runner', 'tapdodge', 'breakout'];
    }
    return entries
      .sort(([, a], [, b]) => {
        const aScore = a.plays * 2 + a.totalTime / 1000;
        const bScore = b.plays * 2 + b.totalTime / 1000;
        return bScore - aScore;
      })
      .map(([gameId]) => gameId)
      .slice(0, 3);
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
    const base: StoredAnalytics = {
      gamesPlayed: 0,
      totalPlayTime: 0,
      gameStats: {},
      featureUsage: {},
      conversion: {
        gameStarts: 0,
        gameCompletions: 0,
        returnVisits: 0,
        monetizationEvents: 0,
        lastActiveAt: 0,
      },
      recentScores: [],
      achievements: [],
    };
    if (typeof window === 'undefined') return base;
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) return base;
      const parsed = JSON.parse(raw);
      return {
        ...base,
        ...parsed,
        gameStats: { ...base.gameStats, ...(parsed.gameStats ?? {}) },
        featureUsage: { ...base.featureUsage, ...(parsed.featureUsage ?? {}) },
        conversion: { ...base.conversion, ...(parsed.conversion ?? {}) },
        recentScores: parsed.recentScores ?? base.recentScores,
        achievements: parsed.achievements ?? base.achievements,
      };
    } catch {
      return base;
    }
  }

  private persist(): void {
    if (typeof window === 'undefined') return;
    const payload: StoredAnalytics = { ...this.metrics };
    localStorage.setItem(this.storageKey, JSON.stringify(payload));
  }

  private recordReturnVisit(): void {
    const now = Date.now();
    const lastActive = this.metrics.conversion.lastActiveAt;
    if (lastActive > 0) {
      const daysSince = (now - lastActive) / (1000 * 60 * 60 * 24);
      if (daysSince >= 1) {
        this.metrics.conversion.returnVisits += 1;
      }
    }
    this.metrics.conversion.lastActiveAt = now;
  }
}
