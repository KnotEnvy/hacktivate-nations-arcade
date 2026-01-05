// ===== src/services/ChallengeService.ts =====
export interface Challenge {
  id: string;
  title: string;
  description: string;
  type: 'daily' | 'weekly';
  gameId?: string; // null for cross-game challenges
  target: number;
  progress: number;
  reward: number;
  completed: boolean;
  expiresAt: Date;
}

export class ChallengeService {
  private challenges: Challenge[] = [];
  private listeners: Array<(challenges: Challenge[]) => void> = [];
  private completionListeners: Array<(challenge: Challenge) => void> = [];

  init(): void {
    this.loadChallenges();
    this.generateDailyChallenges();
  }

  private loadChallenges(): void {
    const saved = localStorage.getItem('hacktivate-challenges');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        this.challenges = data.map((c: any) => ({
          ...c,
          expiresAt: new Date(c.expiresAt)
        }));
        this.cleanupExpiredChallenges();
      } catch (error) {
        console.warn('Failed to load challenges:', error);
        this.challenges = [];
      }
    }
  }

  private saveChallenges(): void {
    localStorage.setItem('hacktivate-challenges', JSON.stringify(this.challenges));
  }

  private cleanupExpiredChallenges(): void {
    const now = new Date();
    this.challenges = this.challenges.filter(c => c.expiresAt > now);
  }

  generateDailyChallenges(): void {
    const now = new Date();
    const tomorrowUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
    const todayKey = now.toISOString().slice(0, 10);
    
    // Check if we already have today's challenges
    const hasTodaysChallenges = this.challenges.some(c => 
      c.type === 'daily' && c.expiresAt.toISOString().slice(0, 10) === tomorrowUtc.toISOString().slice(0, 10)
    );

    if (hasTodaysChallenges) return;

    // Clear old daily challenges
    this.challenges = this.challenges.filter(c => c.type !== 'daily');

    // Generate 3 new daily challenges
    const challengeTemplates = [
      // Runner-specific challenges
      { id: 'runner_speed_demon', title: 'Speed Demon', description: 'Reach 2x speed in Endless Runner', gameId: 'runner', target: 1, reward: 200 },
      { id: 'runner_coin_collector', title: 'Coin Collector', description: 'Collect 50 coins in a single run', gameId: 'runner', target: 50, reward: 300 },
      { id: 'runner_marathon', title: 'Marathon Runner', description: 'Run 1000 meters in Endless Runner', gameId: 'runner', target: 1000, reward: 400 },
      { id: 'runner_power_player', title: 'Power Player', description: 'Use 3 power-ups in one run', gameId: 'runner', target: 3, reward: 250 },
      { id: 'runner_combo_master', title: 'Combo Master', description: 'Achieve a 10x coin combo', gameId: 'runner', target: 10, reward: 350 },
      
      // Cross-game challenges
      { id: 'cross_daily_grind', title: 'Daily Grind', description: 'Play any game 3 times', target: 3, reward: 150 },
      { id: 'cross_coin_hunter', title: 'Coin Hunter', description: 'Earn 500 coins from any source', target: 500, reward: 100 },
      { id: 'cross_high_scorer', title: 'High Scorer', description: 'Score 5000 points in any game', target: 5000, reward: 200 },
      { id: 'cross_persistent_player', title: 'Persistent Player', description: 'Play for 10 minutes total', target: 600, reward: 180 }, // 10 minutes in seconds
    ];

    // Randomly select 3 challenges
    const selectedChallenges = [];
    const usedTemplates = new Set();
    
    while (selectedChallenges.length < 3 && usedTemplates.size < challengeTemplates.length) {
      const template = challengeTemplates[Math.floor(Math.random() * challengeTemplates.length)];
      const { id: templateId, ...templateData } = template;
      
      if (!usedTemplates.has(templateId)) {
        usedTemplates.add(templateId);
        selectedChallenges.push({
          id: `daily-${todayKey}-${templateId}`,
          ...templateData,
          type: 'daily' as const,
          progress: 0,
          completed: false,
          expiresAt: tomorrowUtc
        });
      }
    }

    this.challenges.push(...selectedChallenges);
    this.saveChallenges();
    this.notifyListeners();
  }

  setChallenges(challenges: Challenge[]): void {
    this.challenges = challenges;
    this.saveChallenges();
    this.notifyListeners();
  }

  updateProgress(gameId: string, metric: string, value: number): void {
    let updated = false;

    this.challenges.forEach(challenge => {
      if (challenge.completed) return;

      let shouldUpdate = false;
      
      // Check if challenge applies
      if (challenge.gameId && challenge.gameId !== gameId) return;
      
      // Update based on metric
      switch (metric) {
        case 'coins_collected':
          if (challenge.description.includes('coin') && !challenge.description.includes('combo')) {
            challenge.progress = Math.min(challenge.target, challenge.progress + value);
            shouldUpdate = true;
          }
          break;
        case 'distance':
          if (challenge.description.includes('meter') || challenge.description.includes('distance')) {
            challenge.progress = Math.max(challenge.progress, value);
            shouldUpdate = true;
          }
          break;
        case 'speed':
          if (challenge.description.includes('speed')) {
            challenge.progress = Math.max(challenge.progress, value);
            shouldUpdate = true;
          }
          break;
        case 'powerups_used':
          if (challenge.description.includes('power-up')) {
            challenge.progress = Math.min(challenge.target, challenge.progress + value);
            shouldUpdate = true;
          }
          break;
        case 'combo':
          if (challenge.description.includes('combo')) {
            challenge.progress = Math.max(challenge.progress, value);
            shouldUpdate = true;
          }
          break;
        case 'score':
          if (challenge.description.includes('points') || challenge.description.includes('score')) {
            challenge.progress = Math.max(challenge.progress, value);
            shouldUpdate = true;
          }
          break;
        case 'games_played':
          if (challenge.description.includes('Play') && challenge.description.includes('times')) {
            challenge.progress = Math.min(challenge.target, challenge.progress + 1);
            shouldUpdate = true;
          }
          break;
        case 'time_played':
          if (challenge.description.includes('minutes')) {
            challenge.progress = Math.min(challenge.target, challenge.progress + value);
            shouldUpdate = true;
          }
          break;
        case 'coins_earned':
          if (challenge.description.includes('Earn') && challenge.description.includes('coins')) {
            challenge.progress = Math.min(challenge.target, challenge.progress + value);
            shouldUpdate = true;
          }
          break;
      }

      if (shouldUpdate) {
        if (challenge.progress >= challenge.target && !challenge.completed) {
          challenge.completed = true;
          this.completeChallengeReward(challenge);
          this.notifyCompletion(challenge);
        }
        updated = true;
      }
    });

    if (updated) {
      this.saveChallenges();
      this.notifyListeners();
    }
  }

  private completeChallengeReward(challenge: Challenge): void {
    // This will be handled by the currency service
    console.log(`🏆 Challenge completed: ${challenge.title} - Reward: ${challenge.reward} coins`);
  }

  getChallenges(): Challenge[] {
    return [...this.challenges];
  }

  getCompletedChallenges(): Challenge[] {
    return this.challenges.filter(c => c.completed);
  }

  areAllDailyChallengesCompleted(): boolean {
    const daily = this.challenges.filter(c => c.type === 'daily');
    return daily.length > 0 && daily.every(c => c.completed);
  }

  onChallengeCompleted(callback: (challenge: Challenge) => void): () => void {
    this.completionListeners.push(callback);
    return () => {
      const index = this.completionListeners.indexOf(callback);
      if (index > -1) this.completionListeners.splice(index, 1);
    };
  }

  onChallengesChanged(callback: (challenges: Challenge[]) => void): () => void {
    this.listeners.push(callback);
    return () => {
      const index = this.listeners.indexOf(callback);
      if (index > -1) this.listeners.splice(index, 1);
    };
  }

  private notifyCompletion(challenge: Challenge): void {
    this.completionListeners.forEach(cb => cb(challenge));
  }

  private notifyListeners(): void {
    this.listeners.forEach(callback => callback(this.getChallenges()));
  }
}
