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
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    
    // Check if we already have today's challenges
    const today = now.toDateString();
    const hasTodaysChallenges = this.challenges.some(c => 
      c.type === 'daily' && c.expiresAt.toDateString() === tomorrow.toDateString()
    );

    if (hasTodaysChallenges) return;

    // Clear old daily challenges
    this.challenges = this.challenges.filter(c => c.type !== 'daily');

    // Generate 3 new daily challenges
    const challengeTemplates = [
      // Runner-specific challenges
      { title: 'Speed Demon', description: 'Reach 2x speed in Endless Runner', gameId: 'runner', target: 1, reward: 200 },
      { title: 'Coin Collector', description: 'Collect 50 coins in a single run', gameId: 'runner', target: 50, reward: 300 },
      { title: 'Marathon Runner', description: 'Run 1000 meters in Endless Runner', gameId: 'runner', target: 1000, reward: 400 },
      { title: 'Power Player', description: 'Use 3 power-ups in one run', gameId: 'runner', target: 3, reward: 250 },
      { title: 'Combo Master', description: 'Achieve a 10x coin combo', gameId: 'runner', target: 10, reward: 350 },
      
      // Cross-game challenges
      { title: 'Daily Grind', description: 'Play any game 3 times', target: 3, reward: 150 },
      { title: 'Coin Hunter', description: 'Earn 500 coins from any source', target: 500, reward: 100 },
      { title: 'High Scorer', description: 'Score 5000 points in any game', target: 5000, reward: 200 },
      { title: 'Persistent Player', description: 'Play for 10 minutes total', target: 600, reward: 180 }, // 10 minutes in seconds
    ];

    // Randomly select 3 challenges
    const selectedChallenges = [];
    const usedTemplates = new Set();
    
    while (selectedChallenges.length < 3 && usedTemplates.size < challengeTemplates.length) {
      const template = challengeTemplates[Math.floor(Math.random() * challengeTemplates.length)];
      const templateKey = `${template.title}-${template.gameId || 'cross'}`;
      
      if (!usedTemplates.has(templateKey)) {
        usedTemplates.add(templateKey);
        selectedChallenges.push({
          id: `daily-${Date.now()}-${selectedChallenges.length}`,
          ...template,
          type: 'daily' as const,
          progress: 0,
          completed: false,
          expiresAt: tomorrow
        });
      }
    }

    this.challenges.push(...selectedChallenges);
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

  onChallengesChanged(callback: (challenges: Challenge[]) => void): () => void {
    this.listeners.push(callback);
    return () => {
      const index = this.listeners.indexOf(callback);
      if (index > -1) this.listeners.splice(index, 1);
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach(callback => callback(this.getChallenges()));
  }
}
