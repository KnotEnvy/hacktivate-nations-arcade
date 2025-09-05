// ===== src/services/AchievementService.ts =====
import { ACHIEVEMENTS } from "@/data/Achievements";
export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  gameId?: string;
  category: 'gameplay' | 'progression' | 'skill' | 'collection';
  requirement: {
    type: string;
    value: number;
  };
  reward: number;
  unlocked: boolean;
  unlockedAt?: Date;
}

export class AchievementService {
  private achievements: Achievement[] = [];
  private unlockedAchievements: Set<string> = new Set();
  private listeners: Array<(achievements: Achievement[]) => void> = [];

  init(): void {
    this.setupAchievements();
    this.loadProgress();
  }

  private setupAchievements(): void {
    this.achievements = ACHIEVEMENTS.map(a => ({ ...a }));
  }

  private loadProgress(): void {
    const saved = localStorage.getItem('hacktivate-achievements');
    if (saved) {
      try {
        const unlockedIds = JSON.parse(saved);
        this.unlockedAchievements = new Set(unlockedIds);
        this.achievements.forEach(achievement => {
          if (this.unlockedAchievements.has(achievement.id)) {
            achievement.unlocked = true;
          }
        });
      } catch (error) {
        console.warn('Failed to load achievements:', error);
      }
    }
  }

  private saveProgress(): void {
    const unlockedIds = Array.from(this.unlockedAchievements);
    localStorage.setItem('hacktivate-achievements', JSON.stringify(unlockedIds));
  }

  checkAchievement(type: string, value: number, gameId?: string): Achievement[] {
    const newlyUnlocked: Achievement[] = [];

    this.achievements.forEach(achievement => {
      if (achievement.unlocked) return;
      if (achievement.requirement.type !== type) return;
      if (achievement.gameId && achievement.gameId !== gameId) return;

      if (value >= achievement.requirement.value) {
        achievement.unlocked = true;
        achievement.unlockedAt = new Date();
        this.unlockedAchievements.add(achievement.id);
        newlyUnlocked.push(achievement);
        console.log(`🏆 Achievement unlocked: ${achievement.title}`);
      }
    });

    if (newlyUnlocked.length > 0) {
      this.saveProgress();
      this.notifyListeners();
    }

    return newlyUnlocked;
  }

  // Enhanced stat tracking methods
  trackGameSpecificStat(gameId: string, statType: string, value: number): Achievement[] {
    return this.checkAchievement(statType, value, gameId);
  }

  trackCrossGameStat(statType: string, value: number): Achievement[] {
    return this.checkAchievement(statType, value);
  }

  // Helper methods for complex achievement types
  checkHighScoreAcrossGames(gameScores: Record<string, number>): Achievement[] {
    const gamesWithHighScores = Object.values(gameScores).filter(score => score >= 1000).length;
    return this.checkAchievement('high_scores_across_games', gamesWithHighScores);
  }

  checkUniqueGamesPlayed(gameIds: string[]): Achievement[] {
    const uniqueGames = [...new Set(gameIds)].length;
    return this.checkAchievement('unique_games_played', uniqueGames);
  }

  checkConsecutiveDays(days: number): Achievement[] {
    return this.checkAchievement('consecutive_days', days);
  }

  getAchievements(): Achievement[] {
    return [...this.achievements];
  }

  getUnlockedAchievements(): Achievement[] {
    return this.achievements.filter(a => a.unlocked);
  }

  getLockedAchievements(): Achievement[] {
    return this.achievements.filter(a => !a.unlocked);
  }

  onAchievementsChanged(callback: (achievements: Achievement[]) => void): () => void {
    this.listeners.push(callback);
    return () => {
      const index = this.listeners.indexOf(callback);
      if (index > -1) this.listeners.splice(index, 1);
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach(callback => callback(this.getAchievements()));
  }
}
