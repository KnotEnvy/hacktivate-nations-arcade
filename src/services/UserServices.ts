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

export const MAX_LEVEL = 35;
const WARRIOR_XP_STEP = 250000;

export interface PerkModifiers {
  coinMultiplier: number;
  xpMultiplier: number;
  challengeRewardMultiplier: number;
  minCoinsPerGame: number;
  bonusCoinsPerScore: number;
}

export interface PlayerPerk {
  id: string;
  level: number;
  name: string;
  description: string;
  modifiers: Partial<PerkModifiers>;
}

export interface LevelMilestone {
  level: number;
  title: string;
  description: string;
  bonusCoins: number;
  modifiers: Partial<PerkModifiers>;
}

const WARRIOR_XP_TABLE: number[] = (() => {
  const table: number[] = [
    0, // index 0 unused
    0, // level 1
    2000,
    4000,
    8000,
    18000,
    35000,
    70000,
    125000,
    250000,
  ];

  for (let level = 10; level <= MAX_LEVEL; level += 1) {
    table[level] = (table[level - 1] || 0) + WARRIOR_XP_STEP;
  }

  return table;
})();

const PERKS: PlayerPerk[] = [
  {
    id: 'token-magnet',
    level: 3,
    name: 'Token Magnet',
    description: 'Permanent +10% coins earned from games.',
    modifiers: { coinMultiplier: 0.1 },
  },
  {
    id: 'extra-credit',
    level: 7,
    name: 'Extra Credit',
    description: 'Permanent +10% XP earned from games.',
    modifiers: { xpMultiplier: 0.1 },
  },
  {
    id: 'arcade-allowance',
    level: 11,
    name: 'Arcade Allowance',
    description: 'Guarantees at least 20 coins per game.',
    modifiers: { minCoinsPerGame: 20 },
  },
  {
    id: 'daily-double',
    level: 15,
    name: 'Daily Double',
    description: 'Permanent +50% daily challenge coin rewards.',
    modifiers: { challengeRewardMultiplier: 0.5 },
  },
  {
    id: 'high-score-dividend',
    level: 25,
    name: 'High Score Dividend',
    description: 'Earn +1 bonus coin per 1,000 score.',
    modifiers: { bonusCoinsPerScore: 1 },
  },
];

const LEVEL_MILESTONES: LevelMilestone[] = [
  {
    level: 20,
    title: 'CRT Overdrive',
    description: 'Legend status unlocked. +20% coins, +20% XP, and a bonus coin drop.',
    bonusCoins: 1000,
    modifiers: { coinMultiplier: 0.2, xpMultiplier: 0.2 },
  },
];

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

    if (this.profile.level > MAX_LEVEL) {
      this.profile.level = MAX_LEVEL;
    }
    const minExperience = UserService.experienceForLevel(this.profile.level);
    const maxExperience = UserService.experienceForLevel(MAX_LEVEL);
    this.profile.experience = Math.min(Math.max(this.profile.experience, minExperience), maxExperience);
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
    const clampedLevel = Math.min(Math.max(1, level), MAX_LEVEL);
    return WARRIOR_XP_TABLE[clampedLevel] ?? WARRIOR_XP_TABLE[MAX_LEVEL];
  }

  addExperience(amount: number): { leveledUp: boolean; newLevel: number } {
    const maxExperience = UserService.experienceForLevel(MAX_LEVEL);

    if (this.profile.level >= MAX_LEVEL) {
      this.profile.experience = Math.min(this.profile.experience + amount, maxExperience);
      this.saveUserData();
      this.notifyListeners();
      return { leveledUp: false, newLevel: MAX_LEVEL };
    }

    this.profile.experience = Math.min(this.profile.experience + amount, maxExperience);
    let newLevel = this.profile.level;

    // Level up once per call when crossing the next threshold
    const nextLevelExp = UserService.experienceForLevel(this.profile.level + 1);
    const leveledUp = this.profile.experience >= nextLevelExp && this.profile.level < MAX_LEVEL;
    if (leveledUp) {
      this.profile.level += 1;
      newLevel = this.profile.level;
      this.notifyLevelUp(this.profile.level);
    }

    this.saveUserData();
    this.notifyListeners();

    return { leveledUp, newLevel };
  }

  public static getUnlockedPerksForLevel(level: number): PlayerPerk[] {
    return PERKS.filter(perk => level >= perk.level);
  }

  public static getNewPerks(previousLevel: number, newLevel: number): PlayerPerk[] {
    return PERKS.filter(perk => perk.level > previousLevel && perk.level <= newLevel);
  }

  public static getMilestonesForLevel(level: number): LevelMilestone[] {
    return LEVEL_MILESTONES.filter(milestone => level >= milestone.level);
  }

  public static getNewMilestones(previousLevel: number, newLevel: number): LevelMilestone[] {
    return LEVEL_MILESTONES.filter(milestone => milestone.level > previousLevel && milestone.level <= newLevel);
  }

  public getPerkModifiers(): PerkModifiers {
    const unlockedPerks = UserService.getUnlockedPerksForLevel(this.profile.level);
    const unlockedMilestones = UserService.getMilestonesForLevel(this.profile.level);

    const modifiers: PerkModifiers = {
      coinMultiplier: 1,
      xpMultiplier: 1,
      challengeRewardMultiplier: 1,
      minCoinsPerGame: 0,
      bonusCoinsPerScore: 0,
    };

    const allModifiers = [...unlockedPerks.map(perk => perk.modifiers), ...unlockedMilestones.map(m => m.modifiers)];

    allModifiers.forEach((perk) => {
      if (perk.coinMultiplier) {
        modifiers.coinMultiplier += perk.coinMultiplier;
      }
      if (perk.xpMultiplier) {
        modifiers.xpMultiplier += perk.xpMultiplier;
      }
      if (perk.challengeRewardMultiplier) {
        modifiers.challengeRewardMultiplier += perk.challengeRewardMultiplier;
      }
      if (perk.minCoinsPerGame) {
        modifiers.minCoinsPerGame = Math.max(modifiers.minCoinsPerGame, perk.minCoinsPerGame);
      }
      if (perk.bonusCoinsPerScore) {
        modifiers.bonusCoinsPerScore += perk.bonusCoinsPerScore;
      }
    });

    return modifiers;
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
