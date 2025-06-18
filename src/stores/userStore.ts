// ===== src/stores/userStore.ts =====
import { create } from 'zustand';
import { UserProgress } from '@/lib/types';

interface UserState extends UserProgress {
  // Actions
  setLevel: (level: number) => void;
  setTotalCoins: (coins: number) => void;
  addUnlockedTier: (tier: number) => void;
  addAchievement: (achievementId: string) => void;
  updateLastPlayed: () => void;
  loadFromStorage: () => void;
  saveToStorage: () => void;
}

export const useUserStore = create<UserState>((set, get) => ({
  level: 1,
  totalCoins: 0,
  unlockedTiers: [0], // Tier 0 is always unlocked
  achievements: [],
  lastPlayedAt: new Date(),
  
  setLevel: (level) => set({ level }),
  setTotalCoins: (totalCoins) => set({ totalCoins }),
  
  addUnlockedTier: (tier) => {
    const state = get();
    if (!state.unlockedTiers.includes(tier)) {
      const newTiers = [...state.unlockedTiers, tier];
      set({ unlockedTiers: newTiers });
      get().saveToStorage();
    }
  },
  
  addAchievement: (achievementId) => {
    const state = get();
    if (!state.achievements.includes(achievementId)) {
      const newAchievements = [...state.achievements, achievementId];
      set({ achievements: newAchievements });
      get().saveToStorage();
    }
  },
  
  updateLastPlayed: () => {
    set({ lastPlayedAt: new Date() });
    get().saveToStorage();
  },
  
  loadFromStorage: () => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('hacktivate-user-progress');
      if (saved) {
        try {
          const data = JSON.parse(saved);
          set({
            ...data,
            lastPlayedAt: new Date(data.lastPlayedAt)
          });
        } catch (error) {
          console.warn('Failed to load user progress:', error);
        }
      }
    }
  },
  
  saveToStorage: () => {
    if (typeof window !== 'undefined') {
      const state = get();
      localStorage.setItem('hacktivate-user-progress', JSON.stringify({
        level: state.level,
        totalCoins: state.totalCoins,
        unlockedTiers: state.unlockedTiers,
        achievements: state.achievements,
        lastPlayedAt: state.lastPlayedAt.toISOString()
      }));
    }
  },
}));
