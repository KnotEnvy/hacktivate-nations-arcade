// Enhanced Analytics.ts with comprehensive tracking
export interface GameSession {
  gameId: string;
  sessionId: string;
  startTime: Date;
  endTime?: Date;
  score: number;
  duration: number;
  actions: GameAction[];
  outcome: 'completed' | 'abandoned' | 'died';
  playerLevel: number;
  coinsEarned: number;
}

export interface GameAction {
  type: 'jump' | 'move' | 'collect' | 'powerup' | 'pause' | 'resume' | 'click';
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface PlayerMetrics {
  totalPlayTime: number;
  gamesPlayed: number;
  averageSessionLength: number;
  favoriteGame: string;
  skillLevel: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  retentionDays: number;
  lastActiveDate: Date;
}

export interface ConversionFunnel {
  gameViews: number;
  gameStarts: number;
  gameCompletions: number;
  gameReturns: number;
  coinSpends: number;
  gameUnlocks: number;
}

export class Analytics {
  private currentSession: GameSession | null = null;
  private playerMetrics: PlayerMetrics;
  private conversionFunnel: ConversionFunnel;
  private sessionEvents: GameAction[] = [];
  private isInitialized = false;
  private achievementService: any = null;

  // PostHog integration (when available)
  private posthog: any = null;

  constructor() {
    this.playerMetrics = this.loadPlayerMetrics();
    this.conversionFunnel = this.loadConversionFunnel();
  }

  async init(achievementService?: any): Promise<void> {
    try {
      // Store reference to achievement service for triggering checks
      if (achievementService) {
        this.achievementService = achievementService;
      }

      // Initialize PostHog if available (for production)
      if (typeof window !== 'undefined' && (window as any).posthog) {
        this.posthog = (window as any).posthog;
        console.log('📊 Analytics initialized with PostHog');
      } else {
        console.log('📊 Analytics initialized in local mode');
      }

      this.isInitialized = true;
      this.trackEvent('analytics_initialized');

      // Track daily active user
      this.trackDailyActive();
    } catch (error) {
      console.warn('Analytics initialization failed:', error);
    }
  }

  // === GAME SESSION TRACKING ===

  trackGameStart(gameId: string): void {
    if (!this.isInitialized) return;

    const sessionId = this.generateSessionId();
    this.currentSession = {
      gameId,
      sessionId,
      startTime: new Date(),
      score: 0,
      duration: 0,
      actions: [],
      outcome: 'abandoned',
      playerLevel:
        this.playerMetrics.skillLevel === 'beginner'
          ? 1
          : this.playerMetrics.skillLevel === 'intermediate'
            ? 2
            : this.playerMetrics.skillLevel === 'advanced'
              ? 3
              : 4,
      coinsEarned: 0,
    };

    this.conversionFunnel.gameStarts++;
    this.saveConversionFunnel();

    this.trackEvent('game_start', {
      game_id: gameId,
      session_id: sessionId,
      player_level: this.currentSession.playerLevel,
    });

    console.log(`🎮 Game session started: ${gameId}`);
  }

  trackGameEnd(
    gameId: string,
    finalScore: number,
    coinsEarned: number,
    outcome: 'completed' | 'died',
  ): void {
    if (!this.currentSession || !this.isInitialized) return;

    const endTime = new Date();
    const duration = endTime.getTime() - this.currentSession.startTime.getTime();

    this.currentSession.endTime = endTime;
    this.currentSession.score = finalScore;
    this.currentSession.duration = duration;
    this.currentSession.coinsEarned = coinsEarned;
    this.currentSession.outcome = outcome;

    // Update conversion funnel
    if (outcome === 'completed') {
      this.conversionFunnel.gameCompletions++;
    }

    // Update player metrics
    this.updatePlayerMetrics(this.currentSession);

    this.trackEvent('game_end', {
      game_id: gameId,
      session_id: this.currentSession.sessionId,
      score: finalScore,
      duration_ms: duration,
      outcome,
      coins_earned: coinsEarned,
      actions_count: this.currentSession.actions.length,
      skill_assessment: this.assessSkillLevel(finalScore, duration, gameId),
    });

    // Store completed session
    this.storeSession(this.currentSession);
    this.currentSession = null;

    console.log(`🏁 Game session ended: ${gameId}, Score: ${finalScore}`);
  }

  trackGameAction(action: GameAction): void {
    if (!this.currentSession || !this.isInitialized) return;

    this.currentSession.actions.push(action);
    this.sessionEvents.push(action);

    // Track significant actions
    if (['powerup', 'collect'].includes(action.type)) {
      this.trackEvent('game_action', {
        action_type: action.type,
        game_id: this.currentSession.gameId,
        session_id: this.currentSession.sessionId,
        ...action.metadata,
      });
    }
  }

  // === PLAYER PROGRESSION TRACKING ===

  trackLevelUp(newLevel: number, coinsSpent: number): void {
    this.trackEvent('level_up', {
      new_level: newLevel,
      coins_spent: coinsSpent,
      total_playtime: this.playerMetrics.totalPlayTime,
    });

    console.log(`⬆️ Player leveled up to ${newLevel}`);
  }

  trackGameUnlock(gameId: string, cost: number, playerLevel: number): void {
    this.conversionFunnel.gameUnlocks++;
    this.conversionFunnel.coinSpends++;
    this.saveConversionFunnel();

    this.trackEvent('game_unlock', {
      game_id: gameId,
      cost,
      player_level: playerLevel,
      games_owned: this.getUnlockedGamesCount(),
    });

    console.log(`🔓 Game unlocked: ${gameId} for ${cost} coins`);
  }

  trackCurrencyTransaction(amount: number, source: string, newBalance: number): void {
    this.trackEvent('currency_transaction', {
      amount,
      source,
      new_balance: newBalance,
      transaction_type: amount > 0 ? 'earn' : 'spend',
    });

    if (amount < 0) {
      this.conversionFunnel.coinSpends++;
      this.saveConversionFunnel();
    }
  }

  // === GAME-SPECIFIC STAT TRACKING ===

  trackGameSpecificStat(gameId: string, statType: string, value: number, metadata?: Record<string, any>): void {
    if (!this.isInitialized) return;

    this.trackEvent('game_stat', {
      game_id: gameId,
      stat_type: statType,
      value,
      session_id: this.currentSession?.sessionId,
      ...metadata,
    });

    // Trigger achievement checks if service is available
    if (this.achievementService) {
      this.achievementService.trackGameSpecificStat(gameId, statType, value);
    }
  }

  // Helper methods for common game stats
  trackWaveCompleted(gameId: string, waveNumber: number): void {
    this.trackGameSpecificStat(gameId, 'waves_completed', waveNumber, { wave_number: waveNumber });
  }

  trackBossDefeated(gameId: string, bossNumber: number, timeTaken?: number): void {
    this.trackGameSpecificStat(gameId, 'bosses_defeated', bossNumber, { 
      boss_number: bossNumber,
      time_taken: timeTaken 
    });
  }

  trackEnemyDestroyed(gameId: string, enemyType?: string): void {
    const currentCount = this.getGameStatTotal(gameId, 'enemies_destroyed') + 1;
    this.trackGameSpecificStat(gameId, 'enemies_destroyed', currentCount, { enemy_type: enemyType });
  }

  trackPowerupCollected(gameId: string, powerupType?: string): void {
    const currentCount = this.getGameStatTotal(gameId, 'powerups_collected') + 1;
    this.trackGameSpecificStat(gameId, 'powerups_collected', currentCount, { powerup_type: powerupType });
  }

  trackSurvivalTime(gameId: string, seconds: number): void {
    this.trackGameSpecificStat(gameId, 'survival_time', seconds);
  }

  trackLevelCompleted(gameId: string, level: number, timeTaken?: number, perfect?: boolean): void {
    this.trackGameSpecificStat(gameId, 'levels_completed', level, { 
      time_taken: timeTaken,
      perfect: perfect 
    });

    if (perfect) {
      this.trackGameSpecificStat(gameId, 'perfect_levels', 1);
    }

    if (timeTaken && timeTaken < 30) {
      this.trackGameSpecificStat(gameId, 'fast_completion', timeTaken);
    }
  }

  trackMatchMade(gameId: string): void {
    const currentCount = this.getGameStatTotal(gameId, 'matches_made') + 1;
    this.trackGameSpecificStat(gameId, 'matches_made', currentCount);
  }

  trackBricksBroken(gameId: string, count: number = 1): void {
    const currentCount = this.getGameStatTotal(gameId, 'bricks_broken') + count;
    this.trackGameSpecificStat(gameId, 'bricks_broken', currentCount);
    
    // Also track total bricks for cross-session achievements
    const totalBricks = this.getGameStatTotal(gameId, 'total_bricks_broken') + count;
    this.trackGameSpecificStat(gameId, 'total_bricks_broken', totalBricks);
  }

  trackCellsCleared(gameId: string, count: number = 1): void {
    const currentCount = this.getGameStatTotal(gameId, 'cells_cleared') + count;
    this.trackGameSpecificStat(gameId, 'cells_cleared', currentCount);
  }

  trackGameWon(gameId: string, timeTaken?: number): void {
    const currentCount = this.getGameStatTotal(gameId, 'games_won') + 1;
    this.trackGameSpecificStat(gameId, 'games_won', currentCount, { time_taken: timeTaken });

    if (timeTaken && timeTaken < 60) {
      this.trackGameSpecificStat(gameId, 'fast_win', timeTaken);
    }
  }

  // Helper to get current stat totals for a game
  private getGameStatTotal(gameId: string, statType: string): number {
    const events = this.getStoredEvents();
    return events
      .filter(event => 
        event.event === 'game_stat' && 
        event.game_id === gameId && 
        event.stat_type === statType
      )
      .reduce((max, event) => Math.max(max, event.value || 0), 0);
  }

  private getStoredEvents(): any[] {
    try {
      return JSON.parse(localStorage.getItem('analytics_events') || '[]');
    } catch {
      return [];
    }
  }

  // === ENGAGEMENT TRACKING ===

  trackPageView(page: string): void {
    if (page === 'game_hub') {
      this.conversionFunnel.gameViews++;
      this.saveConversionFunnel();
    }

    this.trackEvent('page_view', { page });
  }

  trackFeatureUsage(feature: string, metadata?: Record<string, any>): void {
    this.trackEvent('feature_usage', {
      feature,
      ...metadata,
    });
  }

  trackRetentionEvent(): void {
    const lastActive = this.playerMetrics.lastActiveDate;
    const daysSinceLastActive = lastActive
      ? Math.floor((Date.now() - lastActive.getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    if (daysSinceLastActive > 0) {
      this.conversionFunnel.gameReturns++;
      this.playerMetrics.retentionDays++;
    }

    this.playerMetrics.lastActiveDate = new Date();
    this.savePlayerMetrics();

    this.trackEvent('retention_event', {
      days_since_last_active: daysSinceLastActive,
      total_retention_days: this.playerMetrics.retentionDays,
    });
  }

  // === ANALYTICS INSIGHTS ===

  getPlayerInsights(): {
    skillLevel: string;
    preferredGameLength: 'short' | 'medium' | 'long';
    mostPlayedGame: string;
    averageScore: number;
    improvementAreas: string[];
    achievements: string[];
  } {
    const sessions = this.getStoredSessions();

    const gamePlayCounts = sessions.reduce((acc, session) => {
      acc[session.gameId] = (acc[session.gameId] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const mostPlayedGame =
      Object.entries(gamePlayCounts).sort(([, a], [, b]) => b - a)[0]?.[0] ||
      'unknown';

    const averageSessionLength =
      sessions.length > 0
        ? sessions.reduce((acc, s) => acc + s.duration, 0) / sessions.length
        : 0;

    const preferredGameLength =
      averageSessionLength < 60_000
        ? 'short'
        : averageSessionLength < 300_000
          ? 'medium'
          : 'long';

    const averageScore =
      sessions.length > 0
        ? sessions.reduce((acc, s) => acc + s.score, 0) / sessions.length
        : 0;

    const improvementAreas = this.analyzeImprovementAreas(sessions);
    const achievements = this.calculateAchievements(sessions);

    return {
      skillLevel: this.playerMetrics.skillLevel,
      preferredGameLength,
      mostPlayedGame,
      averageScore,
      improvementAreas,
      achievements,
    };
  }

  getConversionMetrics(): {
    gameStartRate: number;
    completionRate: number;
    retentionRate: number;
    monetizationRate: number;
  } {
    const { gameViews, gameStarts, gameCompletions, gameReturns, coinSpends } =
      this.conversionFunnel;

    return {
      gameStartRate: gameViews > 0 ? gameStarts / gameViews : 0,
      completionRate: gameStarts > 0 ? gameCompletions / gameStarts : 0,
      retentionRate: gameStarts > 0 ? gameReturns / gameStarts : 0,
      monetizationRate: gameStarts > 0 ? coinSpends / gameStarts : 0,
    };
  }

  getPlayerMetrics(): PlayerMetrics {
    return { ...this.playerMetrics };
  }

  // === PERSONALIZATION HELPERS ===

  getRecommendedGames(): string[] {
    const insights = this.getPlayerInsights();

    // Simple recommendation based on skill level and preferences
    const recommendations: string[] = [];

    if (insights.skillLevel === 'beginner') {
      recommendations.push('runner');
    } else {
      recommendations.push('puzzle');
    }

    // Recommend based on session length preference
    if (insights.preferredGameLength === 'short') {
      recommendations.push('runner');
    } else {
      recommendations.push('puzzle');
    }

    return [...new Set(recommendations)];
  }

  shouldShowTutorial(gameId: string): boolean {
    const gameSessions = this.getStoredSessions().filter((s) => s.gameId === gameId);
    return gameSessions.length < 3;
  }

  getDynamicDifficulty(gameId: string): 'easy' | 'medium' | 'hard' {
    const gameSessions = this.getStoredSessions()
      .filter((s) => s.gameId === gameId)
      .slice(-5);

    if (gameSessions.length === 0) return 'easy';

    const averageScore =
      gameSessions.reduce((acc, s) => acc + s.score, 0) / gameSessions.length;
    const completionRate =
      gameSessions.filter((s) => s.outcome === 'completed').length /
      gameSessions.length;

    if (averageScore > 1000 && completionRate > 0.7) return 'hard';
    if (averageScore > 500 && completionRate > 0.4) return 'medium';
    return 'easy';
  }

  // === PRIVATE HELPERS ===

  private trackEvent(event: string, properties?: Record<string, any>): void {
    const eventData = {
      event,
      timestamp: new Date().toISOString(),
      player_id: this.getPlayerId(),
      session_id: this.currentSession?.sessionId || 'hub',
      ...properties,
    };

    // Send to PostHog if available
    if (this.posthog) {
      this.posthog.capture(event, properties);
    }

    // Store locally for offline analytics
    this.storeEvent(eventData);

    // Development logging
    if (process.env.NODE_ENV === 'development') {
      console.log('📊 Analytics Event:', eventData);
    }
  }

  private trackDailyActive(): void {
    const today = new Date().toDateString();
    const lastTracked = localStorage.getItem('analytics_last_dau');

    if (lastTracked !== today) {
      this.trackEvent('daily_active_user');
      localStorage.setItem('analytics_last_dau', today);
    }
  }

  private updatePlayerMetrics(session: GameSession): void {
    this.playerMetrics.totalPlayTime += session.duration;
    this.playerMetrics.gamesPlayed++;
    this.playerMetrics.averageSessionLength =
      this.playerMetrics.totalPlayTime / this.playerMetrics.gamesPlayed;

    // Update skill level based on recent performance
    const recentSessions = this.getStoredSessions().slice(-10);
    this.playerMetrics.skillLevel = this.calculateSkillLevel(recentSessions);

    this.savePlayerMetrics();
  }

  private assessSkillLevel(
    score: number,
    duration: number,
    gameId: string,
  ): string {
    // Game-specific skill assessment
    if (gameId === 'runner') {
      if (score > 2000) return 'expert';
      if (score > 1000) return 'advanced';
      if (score > 500) return 'intermediate';
      return 'beginner';
    }

    if (gameId === 'puzzle') {
      const linesPerMinute = score / 100 / (duration / 60_000);
      if (linesPerMinute > 2) return 'expert';
      if (linesPerMinute > 1) return 'advanced';
      if (linesPerMinute > 0.5) return 'intermediate';
      return 'beginner';
    }

    return 'intermediate';
  }

  private calculateSkillLevel(
    sessions: GameSession[],
  ): 'beginner' | 'intermediate' | 'advanced' | 'expert' {
    if (sessions.length < 5) return 'beginner';

    const averageScore =
      sessions.reduce((acc, s) => acc + s.score, 0) / sessions.length;
    const completionRate =
      sessions.filter((s) => s.outcome === 'completed').length / sessions.length;

    if (averageScore > 1500 && completionRate > 0.8) return 'expert';
    if (averageScore > 1000 && completionRate > 0.6) return 'advanced';
    if (averageScore > 500 && completionRate > 0.4) return 'intermediate';
    return 'beginner';
  }

  private analyzeImprovementAreas(sessions: GameSession[]): string[] {
    const areas: string[] = [];

    if (sessions.length < 3) return ['Play more games to unlock insights'];

    const completionRate =
      sessions.filter((s) => s.outcome === 'completed').length / sessions.length;
    if (completionRate < 0.3) areas.push('Focus on survival and avoiding obstacles');

    const averageActionRate =
      sessions.reduce((acc, s) => acc + s.actions.length / (s.duration / 1000), 0) /
      sessions.length;
    if (averageActionRate < 2) areas.push('Try to be more active in games');

    const shortSessions = sessions.filter((s) => s.duration < 30_000).length;
    if (shortSessions / sessions.length > 0.7) areas.push('Try to play longer sessions');

    return areas.length > 0 ? areas : ['Keep up the great work!'];
  }

  private calculateAchievements(sessions: GameSession[]): string[] {
    const achievements: string[] = [];

    if (sessions.length >= 10) achievements.push('Dedicated Player');
    if (sessions.some((s) => s.score > 2000)) achievements.push('High Scorer');
    if (sessions.filter((s) => s.outcome === 'completed').length >= 5)
      achievements.push('Survivor');

    const totalCoins = sessions.reduce((acc, s) => acc + s.coinsEarned, 0);
    if (totalCoins > 1000) achievements.push('Coin Collector');

    return achievements;
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getPlayerId(): string {
    let playerId = localStorage.getItem('analytics_player_id');
    if (!playerId) {
      playerId = `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('analytics_player_id', playerId);
    }
    return playerId;
  }

  private getUnlockedGamesCount(): number {
    // This would integrate with your unlock system
    return 1; // Placeholder
  }

  // === STORAGE METHODS ===

  private storeSession(session: GameSession): void {
    const sessions = this.getStoredSessions();
    sessions.push(session);
    const recentSessions = sessions.slice(-100);
    localStorage.setItem('analytics_sessions', JSON.stringify(recentSessions));
  }

  private getStoredSessions(): GameSession[] {
    try {
      const stored = localStorage.getItem('analytics_sessions');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  private storeEvent(event: any): void {
    try {
      const events = JSON.parse(localStorage.getItem('analytics_events') || '[]');
      events.push(event);
      const recentEvents = events.slice(-1000);
      localStorage.setItem('analytics_events', JSON.stringify(recentEvents));
    } catch (error) {
      console.warn('Failed to store analytics event:', error);
    }
  }

  private loadPlayerMetrics(): PlayerMetrics {
    try {
      const stored = localStorage.getItem('analytics_player_metrics');
      return stored
        ? JSON.parse(stored)
        : {
            totalPlayTime: 0,
            gamesPlayed: 0,
            averageSessionLength: 0,
            favoriteGame: 'runner',
            skillLevel: 'beginner',
            retentionDays: 0,
            lastActiveDate: new Date(),
          };
    } catch {
      return {
        totalPlayTime: 0,
        gamesPlayed: 0,
        averageSessionLength: 0,
        favoriteGame: 'runner',
        skillLevel: 'beginner',
        retentionDays: 0,
        lastActiveDate: new Date(),
      };
    }
  }

  private savePlayerMetrics(): void {
    localStorage.setItem('analytics_player_metrics', JSON.stringify(this.playerMetrics));
  }

  private loadConversionFunnel(): ConversionFunnel {
    try {
      const stored = localStorage.getItem('analytics_conversion_funnel');
      return stored
        ? JSON.parse(stored)
        : {
            gameViews: 0,
            gameStarts: 0,
            gameCompletions: 0,
            gameReturns: 0,
            coinSpends: 0,
            gameUnlocks: 0,
          };
    } catch {
      return {
        gameViews: 0,
        gameStarts: 0,
        gameCompletions: 0,
        gameReturns: 0,
        coinSpends: 0,
        gameUnlocks: 0,
      };
    }
  }

  private saveConversionFunnel(): void {
    localStorage.setItem('analytics_conversion_funnel', JSON.stringify(this.conversionFunnel));
  }
}
