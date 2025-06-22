// ===== src/services/UserService.ts =====
export interface UserProfile {
  username: string;
  level: number;
  experience: number;
  avatar: string;
  totalCoins: number;
  totalPlayTime: number; // in seconds
  gamesPlayed: number;
  joinedAt: Date;
  lastActiveAt: Date;
}

export interface UserStats {
  totalDistance: number;
  maxSpeed: number;
  maxCombo: number;
  totalJumps: number;
  powerupsUsed: number;
  achievementsUnlocked: number;
  challengesCompleted: number;
  gamesPlayed: number; // total games played
  coinsEarned: number; // total coins earned across all games
}

export class UserService {
  private profile: UserProfile;
  private stats: UserStats;
  private listeners: Array<(profile: UserProfile, stats: UserStats) => void> = [];

  constructor() {
    this.profile = this.getDefaultProfile();
    this.stats = this.getDefaultStats();
  }

  init(): void {
    this.loadUserData();
  }

  private getDefaultProfile(): UserProfile {
    return {
      username: 'Player',
      level: 1,
      experience: 0,
      avatar: '🎮',
      totalCoins: 0,
      totalPlayTime: 0,
      gamesPlayed: 0,
      joinedAt: new Date(),
      lastActiveAt: new Date()
    };
  }

  private getDefaultStats(): UserStats {
    return {
      totalDistance: 0,
      maxSpeed: 0,
      maxCombo: 0,
      totalJumps: 0,
      powerupsUsed: 0,
      achievementsUnlocked: 0,
      challengesCompleted: 0,
      gamesPlayed: 0,
      coinsEarned: 0
    };
  }

  private loadUserData(): void {
    // Load profile
    const savedProfile = localStorage.getItem('hacktivate-user-profile');
    if (savedProfile) {
      try {
        const data = JSON.parse(savedProfile);
        this.profile = {
          ...data,
          joinedAt: new Date(data.joinedAt),
          lastActiveAt: new Date(data.lastActiveAt)
        };
      } catch (error) {
        console.warn('Failed to load user profile:', error);
      }
    }

    // Load stats
    const savedStats = localStorage.getItem('hacktivate-user-stats');
    if (savedStats) {
      try {
        const data = JSON.parse(savedStats);
        // Migrate old `gameplayed` field to `gamesPlayed`
        if ('gameplayed' in data && !('gamesPlayed' in data)) {
          data.gamesPlayed = data.gameplayed;
          delete data.gameplayed;
        }
        this.stats = { ...this.getDefaultStats(), ...data };
      } catch (error) {
        console.warn('Failed to load user stats:', error);
      }
    }
  }

  private saveUserData(): void {
    localStorage.setItem('hacktivate-user-profile', JSON.stringify(this.profile));
    localStorage.setItem('hacktivate-user-stats', JSON.stringify(this.stats));
  }

  updateProfile(updates: Partial<UserProfile>): void {
    this.profile = { ...this.profile, ...updates };
    this.profile.lastActiveAt = new Date();
    this.saveUserData();
    this.notifyListeners();
  }

  updateStats(updates: Partial<UserStats>): void {
    this.stats = { ...this.stats, ...updates };
    this.saveUserData();
    this.notifyListeners();
  }

  addExperience(amount: number): { leveledUp: boolean; newLevel: number } {
    const oldLevel = this.profile.level;
    this.profile.experience += amount;
    
    // Calculate level based on experience
    const newLevel = Math.floor(this.profile.experience / 1000) + 1;
    const leveledUp = newLevel > oldLevel;
    
    if (leveledUp) {
      this.profile.level = newLevel;
      console.log(`🆙 Level up! Now level ${newLevel}`);
    }

    this.saveUserData();
    this.notifyListeners();

    return { leveledUp, newLevel };
  }

  getProfile(): UserProfile {
    return { ...this.profile };
  }

  getStats(): UserStats {
    return { ...this.stats };
  }

  getAvailableAvatars(): string[] {
    const baseAvatars = ['🎮', '🚀', '🏃‍♂️', '🦸‍♂️', '🤖', '👾', '🕹️'];
    const unlockedAvatars = ['😎', '🏆', '⭐', '💎']; // These could be unlocked through achievements
    
    // For now, return all avatars. Later, filter based on achievements
    return [...baseAvatars, ...unlockedAvatars];
  }

  onUserDataChanged(callback: (profile: UserProfile, stats: UserStats) => void): () => void {
    this.listeners.push(callback);
    return () => {
      const index = this.listeners.indexOf(callback);
      if (index > -1) this.listeners.splice(index, 1);
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach(callback => callback(this.getProfile(), this.getStats()));
  }
}
