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
  gamesPlayed: number;
  coinsEarned: number;
}

const XP_BASE = 1500;
const XP_GROWTH = 1.6;

export class UserService {
  private profile: UserProfile;
  private stats: UserStats;
  private listeners: Array<(profile: UserProfile, stats: UserStats) => void> = [];
  private levelUpListeners: Array<(level: number) => void> = [];

  constructor() {
    this.profile = this.getDefaultProfile();
    this.stats = this.getDefaultStats();
  }

  init(): void {
    this.loadUserData();

    if (typeof window !== 'undefined') {
      const savedProfile = localStorage.getItem('hacktivate-user-profile');
      if (!savedProfile) {
        this.profile.joinedAt = new Date();
        this.profile.lastActiveAt = new Date();
        this.saveUserData();
      }
    }
    this.notifyListeners();
  }

  private getDefaultProfile(): UserProfile {
    const placeholderDate = new Date(0);
    const currentDate = new Date();
    const date = typeof window === 'undefined' ? placeholderDate : currentDate;
    return {
      username: 'Player',
      level: 1,
      experience: 0,
      avatar: '🎮',
      totalCoins: 0,
      totalPlayTime: 0,
      gamesPlayed: 0,
      joinedAt: date,
      lastActiveAt: date,
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
      coinsEarned: 0,
    };
  }

  private loadUserData(): void {
    // Load profile
    const savedProfile = typeof window !== 'undefined'
      ? localStorage.getItem('hacktivate-user-profile')
      : null;
    if (savedProfile) {
      try {
        const data = JSON.parse(savedProfile);
        this.profile = {
          ...this.profile,
          ...data,
          joinedAt: new Date(data.joinedAt),
          lastActiveAt: new Date(data.lastActiveAt),
        };
      } catch (error) {
        console.warn('Failed to load user profile:', error);
      }
    }

    // Load stats
    const savedStats = typeof window !== 'undefined'
      ? localStorage.getItem('hacktivate-user-stats')
      : null;
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
    if (typeof window === 'undefined') return;
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

  public static experienceForLevel(level: number): number {
    if (level <= 1) return 0;
    const tiers = level - 1;
    return Math.floor((XP_BASE * (Math.pow(XP_GROWTH, tiers) - 1)) / (XP_GROWTH - 1));
  }

  addExperience(amount: number): { leveledUp: boolean; newLevel: number } {
    const oldLevel = this.profile.level;
    this.profile.experience += amount;
    let newLevel = this.profile.level;

    // Level up once per call when crossing the next threshold
    const nextLevelExp = UserService.experienceForLevel(this.profile.level + 1);
    const leveledUp = this.profile.experience >= nextLevelExp;
    if (leveledUp) {
      this.profile.level += 1;
      newLevel = this.profile.level;
      this.notifyLevelUp(this.profile.level);
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
    const baseAvatars = ['🎮', '★', '☀', '☁', '☂', '☃', '☯'];
    const unlockedAvatars = ['✦', '✺', '♞', '♟']; // These could be unlocked through achievements
    return [...baseAvatars, ...unlockedAvatars];
  }

  onUserDataChanged(callback: (profile: UserProfile, stats: UserStats) => void): () => void {
    this.listeners.push(callback);
    return () => {
      const index = this.listeners.indexOf(callback);
      if (index > -1) this.listeners.splice(index, 1);
    };
  }

  onLevelUp(callback: (level: number) => void): () => void {
    this.levelUpListeners.push(callback);
    return () => {
      const index = this.levelUpListeners.indexOf(callback);
      if (index > -1) this.levelUpListeners.splice(index, 1);
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach(callback => callback(this.getProfile(), this.getStats()));
  }

  private notifyLevelUp(level: number): void {
    this.levelUpListeners.forEach(callback => callback(level));
  }
}
