// ===== src/components/arcade/ArcadeHub.tsx =====
'use client';

import { useState, useEffect } from 'react';
import { GameModule, GameManifest } from '@/lib/types';
import { gameLoader } from '@/games/registry';
import { CurrencyService } from '@/services/CurrencyService';
import { GameCanvas } from './GameCanvas';
import { GameCarousel } from './GameCarousel';
import { CurrencyDisplay } from './CurrencyDisplay';

const AVAILABLE_GAMES: GameManifest[] = [
  {
    id: 'runner',
    title: 'Endless Runner',
    thumbnail: '/images/runner-thumb.png',
    inputSchema: ['keyboard', 'touch'],
    assetBudgetKB: 50,
    tier: 0,
    description: 'Jump and collect coins in this fast-paced endless runner!'
  },
  // Placeholder for future games
  {
    id: 'puzzle',
    title: 'Block Puzzle',
    thumbnail: '/images/puzzle-thumb.png',
    inputSchema: ['keyboard', 'touch'],
    assetBudgetKB: 75,
    tier: 1,
    description: 'Coming Soon! Match blocks to clear lines.'
  },
  {
    id: 'space',
    title: 'Space Shooter',
    thumbnail: '/images/space-thumb.png',
    inputSchema: ['keyboard'],
    assetBudgetKB: 100,
    tier: 2,
    description: 'Coming Soon! Defend Earth from alien invaders!'
  }
];

export function ArcadeHub() {
  const [currentGame, setCurrentGame] = useState<GameModule | null>(null);
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  const [unlockedTiers, setUnlockedTiers] = useState<number[]>([0]); // Tier 0 is always unlocked
  const [currencyService] = useState(new CurrencyService());
  const [currentCoins, setCurrentCoins] = useState(0);
  const [showHub, setShowHub] = useState(true);

  useEffect(() => {
    currencyService.init();
    setCurrentCoins(currencyService.getCurrentCoins());

    const unsubscribe = currencyService.onCoinsChanged(setCurrentCoins);
    return unsubscribe;
  }, [currencyService]);

  useEffect(() => {
    // Load unlocked tiers from localStorage
    const saved = localStorage.getItem('hacktivate-unlocked-tiers');
    if (saved) {
      setUnlockedTiers(JSON.parse(saved));
    }
  }, []);

  const saveUnlockedTiers = (tiers: number[]) => {
    setUnlockedTiers(tiers);
    localStorage.setItem('hacktivate-unlocked-tiers', JSON.stringify(tiers));
  };

  const handleGameSelect = async (gameId: string) => {
    try {
      const game = await gameLoader.loadGame(gameId);
      if (game) {
        setCurrentGame(game);
        setSelectedGameId(gameId);
        setShowHub(false);
      }
    } catch (error) {
      console.error('Failed to load game:', error);
    }
  };

  const handleGameUnlock = (gameId: string, cost: number) => {
    if (currencyService.spendCoins(cost, `unlock_${gameId}`)) {
      const game = AVAILABLE_GAMES.find(g => g.id === gameId);
      if (game && !unlockedTiers.includes(game.tier)) {
        saveUnlockedTiers([...unlockedTiers, game.tier]);
      }
    }
  };

  const handleBackToHub = () => {
    setShowHub(true);
    setCurrentGame(null);
    setSelectedGameId(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 p-4">
      {/* Header */}
      <header className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-4">
          <h1 className="text-3xl font-bold text-white font-arcade">
            🕹️ HacktivateNations Arcade
          </h1>
          {!showHub && (
            <button
              onClick={handleBackToHub}
              className="arcade-button text-sm px-4 py-2"
            >
              ← Back to Hub
            </button>
          )}
        </div>
        <CurrencyDisplay currencyService={currencyService} />
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto">
        {showHub ? (
          <div className="space-y-8">
            <GameCarousel
              games={AVAILABLE_GAMES}
              unlockedTiers={unlockedTiers}
              currentCoins={currentCoins}
              onGameSelect={handleGameSelect}
              onGameUnlock={handleGameUnlock}
            />
            
            <div className="text-center text-gray-300">
              <h3 className="text-xl mb-4">Welcome to the Arcade!</h3>
              <p className="max-w-2xl mx-auto">
                Play games to earn coins, unlock new experiences, and climb the leaderboards. 
                Each game offers unique challenges and rewards. Start with the Endless Runner 
                and work your way up to more complex adventures!
              </p>
            </div>
          </div>
        ) : (
          <div className="flex justify-center">
            <GameCanvas 
              game={currentGame} 
              onGameEnd={() => {
                // Could show a game over modal here
                console.log('Game ended!');
              }}
            />
          </div>
        )}
      </main>
    </div>
  );
}
