// ===== src/stores/gameStore.ts =====
import { create } from 'zustand';
import { GameModule, GameScore } from '@/lib/types';

interface GameState {
  currentGame: GameModule | null;
  selectedGameId: string | null;
  isPlaying: boolean;
  currentScore: GameScore | null;
  
  // Actions
  setCurrentGame: (game: GameModule | null) => void;
  setSelectedGameId: (id: string | null) => void;
  setIsPlaying: (playing: boolean) => void;
  setCurrentScore: (score: GameScore | null) => void;
  resetGame: () => void;
}

export const useGameStore = create<GameState>((set) => ({
  currentGame: null,
  selectedGameId: null,
  isPlaying: false,
  currentScore: null,
  
  setCurrentGame: (game) => set({ currentGame: game }),
  setSelectedGameId: (id) => set({ selectedGameId: id }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  setCurrentScore: (score) => set({ currentScore: score }),
  resetGame: () => set({ 
    currentGame: null, 
    selectedGameId: null, 
    isPlaying: false, 
    currentScore: null 
  }),
}));
