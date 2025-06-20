// ===== src/services/AchievementService.ts =====
export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
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
    this.achievements = [
      // Gameplay achievements
      {
        id: 'first_jump',
        title: 'Taking Flight',
        description: 'Jump for the first time',
        icon: '🦅',
        category: 'gameplay',
        requirement: { type: 'jumps', value: 1 },
        reward: 50,
        unlocked: false
      },
      {
        id: 'coin_collector',
        title: 'Coin Collector',
        description: 'Collect 100 coins total',
        icon: '💰',
        category: 'collection',
        requirement: { type: 'total_coins', value: 100 },
        reward: 100,
        unlocked: false
      },
      {
        id: 'speed_demon',
        title: 'Speed Demon',
        description: 'Reach 3x speed',
        icon: '⚡',
        category: 'skill',
        requirement: { type: 'max_speed', value: 3 },
        reward: 200,
        unlocked: false
      },
      {
        id: 'marathon_runner',
        title: 'Marathon Runner',
        description: 'Run 5000 meters in a single game',
        icon: '🏃‍♂️',
        category: 'skill',
        requirement: { type: 'distance', value: 5000 },
        reward: 300,
        unlocked: false
      },
      {
        id: 'power_user',
        title: 'Power User',
        description: 'Use all 4 types of power-ups',
        icon: '🌟',
        category: 'collection',
        requirement: { type: 'powerup_types', value: 4 },
        reward: 250,
        unlocked: false
      },
      {
        id: 'combo_master',
        title: 'Combo Master',
        description: 'Achieve a 15x combo',
        icon: '🔥',
        category: 'skill',
        requirement: { type: 'max_combo', value: 15 },
        reward: 400,
        unlocked: false
      },
      
      // Progression achievements
      {
        id: 'spender',
        title: 'Big Spender',
        description: 'Unlock your first paid game',
        icon: '🎮',
        category: 'progression',
        requirement: { type: 'games_unlocked', value: 1 },
        reward: 150,
        unlocked: false
      },
      {
        id: 'completionist',
        title: 'Completionist',
        description: 'Unlock all available games',
        icon: '🏆',
        category: 'progression',
        requirement: { type: 'all_games_unlocked', value: 1 },
        reward: 500,
        unlocked: false
      },
      {
        id: 'dedicated_player',
        title: 'Dedicated Player',
        description: 'Play for 30 minutes total',
        icon: '⏰',
        category: 'progression',
        requirement: { type: 'total_playtime', value: 1800 }, // 30 minutes in seconds
        reward: 200,
        unlocked: false
      },
      
      // Collection achievements
      {
        id: 'rich_player',
        title: 'Rich Player',
        description: 'Accumulate 10,000 coins',
        icon: '💎',
        category: 'collection',
        requirement: { type: 'total_coins_earned', value: 10000 },
        reward: 1000,
        unlocked: false
      }
    ];
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

  checkAchievement(type: string, value: number): Achievement[] {
    const newlyUnlocked: Achievement[] = [];

    this.achievements.forEach(achievement => {
      if (achievement.unlocked) return;
      if (achievement.requirement.type !== type) return;
      
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
