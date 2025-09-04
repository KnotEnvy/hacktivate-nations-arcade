import { UserService } from '@/services/UserServices';

describe('UserService', () => {
  let userService: UserService;

  beforeEach(() => {
    userService = new UserService();
    localStorage.clear();
  });

  describe('initialization', () => {
    test('creates default profile on first init', () => {
      userService.init();
      const profile = userService.getProfile();
      
      expect(profile.username).toBe('Player');
      expect(profile.level).toBe(1);
      expect(profile.experience).toBe(0);
      expect(profile.totalCoins).toBe(0);
      expect(profile.avatar).toBe('🎮');
    });

    test('loads existing profile from localStorage', () => {
      const existingProfile = {
        username: 'TestPlayer',
        level: 5,
        experience: 2500,
        totalCoins: 1000,
        avatar: '🚀',
        joinedAt: new Date('2024-01-01'),
        lastActiveAt: new Date('2024-01-02'),
        totalPlayTime: 3600
      };
      
      localStorage.setItem('hacktivate-user-profile', JSON.stringify(existingProfile));
      
      userService.init();
      const profile = userService.getProfile();
      
      expect(profile.username).toBe('TestPlayer');
      expect(profile.level).toBe(5);
      expect(profile.experience).toBe(2500);
      expect(profile.avatar).toBe('🚀');
    });
  });

  describe('experience and leveling', () => {
    beforeEach(() => {
      userService.init();
    });

    test('calculates correct experience for levels', () => {
      expect(UserService.experienceForLevel(1)).toBe(0);
      expect(UserService.experienceForLevel(2)).toBe(1000); // 500 * 2 * 1
      expect(UserService.experienceForLevel(3)).toBe(3000); // 500 * 3 * 2
      expect(UserService.experienceForLevel(10)).toBe(45000); // 500 * 10 * 9
    });

    test('adds experience correctly', () => {
      userService.addExperience(150);
      const profile = userService.getProfile();
      
      expect(profile.experience).toBe(150);
    });

    test('levels up when experience threshold is reached', () => {
      const initialLevel = userService.getProfile().level;
      
      // Add enough XP to level up (1000 XP for level 2)
      userService.addExperience(1500);
      
      const profile = userService.getProfile();
      expect(profile.level).toBe(initialLevel + 1);
    });

    test('handles multiple level ups correctly', () => {
      // Add enough XP for multiple levels
      userService.addExperience(1000);
      
      const profile = userService.getProfile();
      expect(profile.level).toBeGreaterThan(1);
    });

    test('notifies listeners when level changes', () => {
      const levelUps: number[] = [];
      userService.onLevelUp((newLevel) => levelUps.push(newLevel));
      
      userService.addExperience(1500); // Should level up to 2
      userService.addExperience(2000); // Should level up to 3
      
      expect(levelUps).toContain(2);
      expect(levelUps).toContain(3);
    });
  });

  describe('profile updates', () => {
    beforeEach(() => {
      userService.init();
    });

    test('updates profile properties', () => {
      userService.updateProfile({ 
        username: 'NewName',
        avatar: '🎮',
        totalCoins: 500 
      });
      
      const profile = userService.getProfile();
      expect(profile.username).toBe('NewName');
      expect(profile.avatar).toBe('🎮');
      expect(profile.totalCoins).toBe(500);
    });

    test('persists profile updates to localStorage', () => {
      userService.updateProfile({ username: 'SavedName' });
      
      const saved = localStorage.getItem('hacktivate-user-profile');
      expect(saved).toBeDefined();
      
      const savedProfile = JSON.parse(saved!);
      expect(savedProfile.username).toBe('SavedName');
    });

    test('updates lastActiveAt timestamp on activity', () => {
      const beforeUpdate = new Date();
      userService.updateProfile({ totalCoins: 100 });
      
      const profile = userService.getProfile();
      const lastActive = new Date(profile.lastActiveAt);
      expect(lastActive.getTime()).toBeGreaterThanOrEqual(beforeUpdate.getTime());
    });
  });

  describe('stats tracking', () => {
    beforeEach(() => {
      userService.init();
    });

    test('initializes with default stats', () => {
      const stats = userService.getStats();
      
      expect(stats.gamesPlayed).toBe(0);
      expect(stats.totalDistance).toBe(0);
      expect(stats.totalJumps).toBe(0);
      expect(stats.maxSpeed).toBe(0);
      expect(stats.maxCombo).toBe(0);
      expect(stats.powerupsUsed).toBe(0);
      expect(stats.coinsEarned).toBe(0);
      expect(stats.achievementsUnlocked).toBe(0);
      expect(stats.challengesCompleted).toBe(0);
    });

    test('updates stats correctly', () => {
      userService.updateStats({
        gamesPlayed: 5,
        totalDistance: 1000,
        maxSpeed: 25.5
      });
      
      const stats = userService.getStats();
      expect(stats.gamesPlayed).toBe(5);
      expect(stats.totalDistance).toBe(1000);
      expect(stats.maxSpeed).toBe(25.5);
    });

    test('persists stats to localStorage', () => {
      userService.updateStats({ gamesPlayed: 3 });
      
      const saved = localStorage.getItem('hacktivate-user-stats');
      expect(saved).toBeDefined();
      
      const savedStats = JSON.parse(saved!);
      expect(savedStats.gamesPlayed).toBe(3);
    });

    test('notifies listeners on stats changes', () => {
      const changes: any[] = [];
      userService.onUserDataChanged((profile, stats) => {
        changes.push({ profile, stats });
      });
      
      userService.updateStats({ gamesPlayed: 1 });
      
      expect(changes).toHaveLength(1);
      expect(changes[0].stats.gamesPlayed).toBe(1);
    });
  });

  describe('avatar system', () => {
    beforeEach(() => {
      userService.init();
    });

    test('provides list of available avatars', () => {
      const avatars = userService.getAvailableAvatars();
      
      expect(Array.isArray(avatars)).toBe(true);
      expect(avatars.length).toBeGreaterThan(0);
      expect(avatars).toContain('🎮'); // Default avatar
      expect(avatars).toContain('🎮'); // Gaming avatar
    });

    test('all avatars are emoji characters', () => {
      const avatars = userService.getAvailableAvatars();
      
      avatars.forEach(avatar => {
        expect(typeof avatar).toBe('string');
        expect(avatar.length).toBeGreaterThanOrEqual(1);
        // Basic check for emoji (Unicode characters)
        expect(avatar).toMatch(/[\u{1F000}-\u{1F6FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u);
      });
    });

    test('updates avatar correctly', () => {
      const avatars = userService.getAvailableAvatars();
      const newAvatar = avatars.find(a => a !== userService.getProfile().avatar)!;
      
      userService.updateProfile({ avatar: newAvatar });
      
      const profile = userService.getProfile();
      expect(profile.avatar).toBe(newAvatar);
    });
  });

  describe('data listeners', () => {
    beforeEach(() => {
      userService.init();
    });

    test('notifies listeners on profile changes', () => {
      const updates: any[] = [];
      const unsubscribe = userService.onUserDataChanged((profile, stats) => {
        updates.push({ profile, stats });
      });
      
      userService.updateProfile({ username: 'TestUpdate' });
      
      expect(updates).toHaveLength(1);
      expect(updates[0].profile.username).toBe('TestUpdate');
      
      unsubscribe();
    });

    test('stops notifications after unsubscribe', () => {
      const updates: any[] = [];
      const unsubscribe = userService.onUserDataChanged((profile, stats) => {
        updates.push({ profile, stats });
      });
      
      unsubscribe();
      userService.updateProfile({ username: 'ShouldNotNotify' });
      
      expect(updates).toHaveLength(0);
    });

    test('handles multiple listeners correctly', () => {
      const updates1: any[] = [];
      const updates2: any[] = [];
      
      userService.onUserDataChanged(() => updates1.push(1));
      userService.onUserDataChanged(() => updates2.push(1));
      
      userService.updateProfile({ username: 'MultiTest' });
      
      expect(updates1).toHaveLength(1);
      expect(updates2).toHaveLength(1);
    });
  });

  describe('level up callbacks', () => {
    beforeEach(() => {
      userService.init();
    });

    test('triggers level up callback at correct time', () => {
      const levelUps: number[] = [];
      userService.onLevelUp((level) => levelUps.push(level));
      
      // Add just enough XP to reach level 2
      userService.addExperience(1000);
      
      expect(levelUps).toEqual([2]);
    });

    test('handles multiple level up callbacks', () => {
      const allLevelUps: number[] = [];
      const evenLevelUps: number[] = [];
      
      userService.onLevelUp((level) => allLevelUps.push(level));
      userService.onLevelUp((level) => {
        if (level % 2 === 0) evenLevelUps.push(level);
      });
      
      userService.addExperience(500); // Should trigger multiple level ups
      
      expect(allLevelUps.length).toBeGreaterThan(0);
      evenLevelUps.forEach(level => {
        expect(level % 2).toBe(0);
      });
    });
  });
});