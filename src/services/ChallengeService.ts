// ===== src/services/ChallengeService.ts =====
import {
  DAILY_CHALLENGE_TEMPLATES,
  type ChallengeRequirement,
  applyChallengeProgress,
  createDailyChallengeId,
  getChallengeTemplate,
} from '@/lib/challenges';

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
  requirement?: ChallengeRequirement;
}

interface StoredChallenge {
  id: string;
  title: string;
  description: string;
  type: 'daily' | 'weekly';
  gameId?: string;
  target: number;
  progress: number;
  reward: number;
  completed: boolean;
  expiresAt: string;
  requirement?: ChallengeRequirement;
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
        const data = JSON.parse(saved) as StoredChallenge[];
        this.challenges = data.map(c =>
          this.normalizeChallenge({
            ...c,
            expiresAt: new Date(c.expiresAt),
          })
        );
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

    // Randomly select 3 challenges
    const selectedChallenges: Challenge[] = [];
    const usedTemplates = new Set();
    
    while (
      selectedChallenges.length < 3 &&
      usedTemplates.size < DAILY_CHALLENGE_TEMPLATES.length
    ) {
      const template =
        DAILY_CHALLENGE_TEMPLATES[
          Math.floor(Math.random() * DAILY_CHALLENGE_TEMPLATES.length)
        ];
      const templateId = template.templateId;
      
      if (!usedTemplates.has(templateId)) {
        usedTemplates.add(templateId);
        selectedChallenges.push({
          id: createDailyChallengeId(todayKey, templateId),
          title: template.title,
          description: template.description,
          type: template.type,
          gameId: template.gameId,
          target: template.target,
          progress: 0,
          reward: template.reward,
          completed: false,
          expiresAt: tomorrowUtc,
          requirement: template.requirement,
        });
      }
    }

    this.challenges.push(...selectedChallenges);
    this.saveChallenges();
    this.notifyListeners();
  }

  setChallenges(challenges: Challenge[]): void {
    this.challenges = challenges.map(challenge => this.normalizeChallenge(challenge));
    this.saveChallenges();
    this.notifyListeners();
  }

  updateProgress(gameId: string, metric: string, value: number): void {
    let updated = false;

    this.challenges.forEach(challenge => {
      if (challenge.completed) return;

      // Check if challenge applies
      if (challenge.gameId && challenge.gameId !== gameId) return;

      const requirement =
        challenge.requirement ?? getChallengeTemplate(challenge.id)?.requirement;
      if (!requirement || requirement.metric !== metric) {
        return;
      }

      const nextProgress = applyChallengeProgress(
        challenge.progress,
        challenge.target,
        requirement,
        value
      );
      const shouldUpdate = nextProgress !== challenge.progress;

      if (shouldUpdate) {
        challenge.progress = nextProgress;
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

  private normalizeChallenge(challenge: Challenge): Challenge {
    const template = getChallengeTemplate(challenge.id);

    return {
      ...challenge,
      requirement: challenge.requirement ?? template?.requirement,
    };
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
