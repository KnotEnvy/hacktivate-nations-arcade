// ===== src/components/arcade/GameCarousel.tsx =====
'use client';

import { useState } from 'react';
import { GameManifest } from '@/lib/types';
import { UNLOCK_COSTS } from '@/lib/constants';

interface GameCarouselProps {
  games: GameManifest[];
  unlockedTiers: number[];
  currentCoins: number;
  onGameSelect: (gameId: string) => void;
  onGameUnlock: (gameId: string, cost: number) => void;
}

export function GameCarousel({ games, unlockedTiers, currentCoins, onGameSelect, onGameUnlock }: GameCarouselProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const isGameUnlocked = (game: GameManifest) => {
    return unlockedTiers.includes(game.tier);
  };

  const canUnlockGame = (game: GameManifest) => {
    const cost = UNLOCK_COSTS[game.tier as keyof typeof UNLOCK_COSTS] || 0;
    return !isGameUnlocked(game) && currentCoins >= cost;
  };

  const getUnlockCost = (game: GameManifest) => {
    return UNLOCK_COSTS[game.tier as keyof typeof UNLOCK_COSTS] || 0;
  };

  return (
    <div className="w-full">
      <h2 className="text-2xl font-bold text-white mb-6 text-center">Game Arcade</h2>
      
      <div className="flex gap-4 overflow-x-auto pb-4">
        {games.map((game, index) => {
          const unlocked = isGameUnlocked(game);
          const canUnlock = canUnlockGame(game);
          const cost = getUnlockCost(game);

          return (
            <div
              key={game.id}
              className={`game-card min-w-[200px] ${
                selectedIndex === index ? 'ring-2 ring-primary-400' : ''
              }`}
              onClick={() => setSelectedIndex(index)}
            >
              <div className="aspect-square bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center relative">
                {unlocked ? (
                  <div className="text-4xl">🎮</div>
                ) : (
                  <div className="text-4xl opacity-50">🔒</div>
                )}
                
                {!unlocked && (
                  <div className="absolute bottom-2 right-2 bg-yellow-500 text-black text-xs px-2 py-1 rounded-full font-bold">
                    {cost} coins
                  </div>
                )}
              </div>
              
              <div className="p-4">
                <h3 className="font-bold text-white mb-2">{game.title}</h3>
                <p className="text-sm text-gray-300 mb-3">{game.description}</p>
                
                {unlocked ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onGameSelect(game.id);
                    }}
                    className="w-full arcade-button text-sm py-2"
                  >
                    Play Game
                  </button>
                ) : canUnlock ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onGameUnlock(game.id, cost);
                    }}
                    className="w-full bg-yellow-500 hover:bg-yellow-600 text-black font-bold py-2 px-4 rounded-lg transition-colors text-sm"
                  >
                    Unlock for {cost} coins
                  </button>
                ) : (
                  <div className="w-full bg-gray-600 text-gray-400 font-bold py-2 px-4 rounded-lg text-center text-sm">
                    Need {cost} coins
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
