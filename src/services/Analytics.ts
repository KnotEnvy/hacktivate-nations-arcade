// ===== src/services/Analytics.ts =====
export interface AnalyticsEvent {
  name: string;
  properties?: Record<string, any>;
  timestamp?: Date;
}

export class Analytics {
  private isEnabled: boolean = false;
  private queue: AnalyticsEvent[] = [];

  init(): void {
    // For now, just log events. Later integrate with PostHog
    this.isEnabled = true;
    console.log('Analytics: Initialized (development mode)');
  }

  track(event: string, properties?: Record<string, any>): void {
    if (!this.isEnabled) return;

    const analyticsEvent: AnalyticsEvent = {
      name: event,
      properties,
      timestamp: new Date(),
    };

    // For development, just log
    console.log('Analytics:', analyticsEvent);
    
    // Store in queue for future backend integration
    this.queue.push(analyticsEvent);
  }

  // Game-specific tracking methods
  trackGameStart(gameId: string): void {
    this.track('game_started', { gameId });
  }

  trackGameEnd(gameId: string, score: number, duration: number): void {
    this.track('game_ended', { gameId, score, duration });
  }

  trackCurrencyEarned(amount: number, source: string): void {
    this.track('currency_earned', { amount, source });
  }

  trackGameUnlocked(gameId: string, tier: number, cost: number): void {
    this.track('game_unlocked', { gameId, tier, cost });
  }

  trackChallengeCompleted(challengeId: string, reward: number): void {
    this.track('challenge_completed', { challengeId, reward });
  }
}
