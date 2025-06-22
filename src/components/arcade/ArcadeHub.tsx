// ===== src/components/arcade/ArcadeHub.tsx =====
'use client';

import { useState, useEffect } from 'react';
import { GameModule, GameManifest } from '@/lib/types';
import { gameLoader } from '@/games/registry';
import { CurrencyService } from '@/services/CurrencyService';
import { ChallengeService } from '@/services/ChallengeService';
import { AchievementService } from '@/services/AchievementService';
import { UserService } from '@/services/UserServices';
import { GameCanvas } from './GameCanvas';
import { GameCarousel } from './GameCarousel';
import { CurrencyDisplay } from './CurrencyDisplay';
import { DailyChallenges } from './DailyChallenges';
import { AchievementPanel } from './AchievementPanel';
import { UserProfile } from './UserProfiles';

const AVAILABLE_GAMES: GameManifest[] = [
  {
    id: 'runner',
    title: 'Endless Runner',
    thumbnail: '/games/runner/runner-thumb.svg',
    inputSchema: ['keyboard', 'touch'],
    assetBudgetKB: 50,
    tier: 0,
    description: 'Jump and collect coins in this fast-paced endless runner!'
  },
  // Placeholder for future games
  {
    id: 'puzzle',
    title: 'Block Puzzle',
    thumbnail: '/games/puzzle/puzzle-thumb.svg',
    inputSchema: ['keyboard', 'touch'],
    assetBudgetKB: 75,
    tier: 1,
    description: 'Coming Soon! Match blocks to clear lines.'
  },
  {
    id: 'space',
    title: 'Space Shooter',
    thumbnail: '/games/space/space-thumb.svg',
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
  const [activeTab, setActiveTab] = useState<'games' | 'challenges' | 'achievements' | 'profile'>('games');

  // Services
  const [challengeService] = useState(new ChallengeService());
  const [achievementService] = useState(new AchievementService());
  const [userService] = useState(new UserService());
  
  // Notifications
  const [notifications, setNotifications] = useState<Array<{
    id: string;
    type: 'achievement' | 'challenge' | 'levelup';
    title: string;
    message: string;
    timestamp: Date;
  }>>([]);

  useEffect(() => {
    currencyService.init();
    challengeService.init();
    achievementService.init();
    userService.init();

    setCurrentCoins(currencyService.getCurrentCoins());

    let lastCoins = currencyService.getCurrentCoins();
    const unsubscribe = currencyService.onCoinsChanged((newCoins) => {
      const delta = newCoins - lastCoins;
      lastCoins = newCoins;
      setCurrentCoins(newCoins);

      // Update user profile
      userService.updateProfile({ totalCoins: newCoins });

      if (delta > 0) {
        const stats = userService.getStats();
        const updated = stats.coinsEarned + delta;
        userService.updateStats({ coinsEarned: updated });
        achievementService.checkAchievement('total_coins_earned', updated);
      }

      // Check achievements for total coins on hand
      const newAchievements = achievementService.checkAchievement('total_coins', newCoins);
      newAchievements.forEach(achievement => {
        addNotification('achievement', achievement.title, `+${achievement.reward} coins!`);
        currencyService.addCoins(achievement.reward, `achievement_${achievement.id}`);
      });
    });

    return unsubscribe;
  }, [challengeService, achievementService, userService]);

  useEffect(() => {
    // Load unlocked tiers from localStorage
    const saved = localStorage.getItem('hacktivate-unlocked-tiers');
    if (saved) {
      const tiers = JSON.parse(saved);
      setUnlockedTiers(tiers);
      
      // Check unlocking achievements
      if (tiers.length > 1) {
        achievementService.checkAchievement('games_unlocked', tiers.length - 1);
      }
      if (tiers.length >= AVAILABLE_GAMES.length) {
        achievementService.checkAchievement('all_games_unlocked', 1);
      }
    }
  }, [achievementService]);

    const addNotification = (type: string, title: string, message: string) => {
    const notification = {
      id: `${Date.now()}-${Math.random()}`,
      type: type as any,
      title,
      message,
      timestamp: new Date()
    };
    
    setNotifications(prev => [notification, ...prev.slice(0, 4)]); // Keep only 5 notifications
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== notification.id));
    }, 5000);
  };

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
        // Track game start
        const gamesPlayed = userService.getStats().gamesPlayed + 1;
        userService.updateStats({ gamesPlayed });
        challengeService.updateProgress(gameId, 'games_played', 1);
        achievementService.checkAchievement('games_played', gamesPlayed);

      }
    } catch (error) {
      console.error('Failed to load game:', error);
    }
  };

  const handleGameUnlock = (gameId: string, cost: number) => {
    if (currencyService.spendCoins(cost, `unlock_${gameId}`)) {
      const game = AVAILABLE_GAMES.find(g => g.id === gameId);
      if (game && !unlockedTiers.includes(game.tier)) {
        const newTiers = [...unlockedTiers, game.tier];
        saveUnlockedTiers(newTiers);
        
        // Check achievements
        achievementService.checkAchievement('games_unlocked', newTiers.length - 1);
        if (newTiers.length >= AVAILABLE_GAMES.length) {
          achievementService.checkAchievement('all_games_unlocked', 1);
        }
        
        addNotification('achievement', 'Game Unlocked!', `${game.title} is now available`);
      }
    }
  };

  const handleBackToHub = () => {
    setShowHub(true);
    setCurrentGame(null);
    setSelectedGameId(null);
    setActiveTab('games');
  };

  const handleGameEnd = (gameData?: any) => {
    if (!gameData || !selectedGameId) return;
    
    const stats = userService.getStats();
    const profile = userService.getProfile();
    
    // Calculate experience gained
    const experienceGained = Math.floor(gameData.score / 10) + gameData.coinsEarned;
    const levelResult = userService.addExperience(experienceGained);
    
    if (levelResult.leveledUp) {
      addNotification('levelup', 'Level Up!', `You reached level ${levelResult.newLevel}!`);
    }
    
    // Update user stats
    const newStats = {
      totalDistance: Math.max(stats.totalDistance, gameData.distance || 0),
      maxSpeed: Math.max(stats.maxSpeed, gameData.speed || 0),
      maxCombo: Math.max(stats.maxCombo, gameData.combo || 0),
      totalJumps: stats.totalJumps + (gameData.jumps || 0),
      powerupsUsed: stats.powerupsUsed + (gameData.powerupsUsed || 0),
      coinsEarned: stats.coinsEarned + (gameData.coinsEarned || 0)
    };
    userService.updateStats(newStats);
    const updatedStats = userService.getStats();
    
    // Update play time
    const playTimeSeconds = Math.floor((gameData.timePlayedMs || 0) / 1000);
    userService.updateProfile({ 
      totalPlayTime: profile.totalPlayTime + playTimeSeconds 
    });
    
    // Update challenges
    if (selectedGameId === 'runner') {
      challengeService.updateProgress('runner', 'distance', gameData.distance || 0);
      challengeService.updateProgress('runner', 'speed', gameData.speed || 0);
      challengeService.updateProgress('runner', 'coins_collected', gameData.pickups || 0);
      challengeService.updateProgress('runner', 'combo', gameData.combo || 0);
      challengeService.updateProgress('runner', 'powerups_used', gameData.powerupsUsed || 0);
    }
    
    // Cross-game challenges
    challengeService.updateProgress('', 'score', gameData.score || 0);
    challengeService.updateProgress('', 'coins_earned', gameData.coinsEarned || 0);
    challengeService.updateProgress('', 'time_played', playTimeSeconds);
    
    // Check achievements and handle rewards
    const newlyUnlocked = [
      ...achievementService.checkAchievement('distance', gameData.distance || 0, selectedGameId),
      ...achievementService.checkAchievement('max_speed', gameData.speed || 0, selectedGameId),
      ...achievementService.checkAchievement('max_combo', gameData.combo || 0, selectedGameId),
      ...achievementService.checkAchievement(
        'total_playtime',
        profile.totalPlayTime + playTimeSeconds
      ),
      ...achievementService.checkAchievement('total_coins_earned', updatedStats.coinsEarned),
      ...achievementService.checkAchievement('jumps', gameData.jumps || 0, selectedGameId),
      ...achievementService.checkAchievement('total_jumps', updatedStats.totalJumps),
      ...achievementService.checkAchievement('powerups_total', updatedStats.powerupsUsed),
      ...(gameData.powerupTypesUsed
        ? achievementService.checkAchievement(
            'powerup_types',
            gameData.powerupTypesUsed.length,
            selectedGameId
          )
        : []),
      ...achievementService.checkAchievement('games_played', updatedStats.gamesPlayed)
    ];

    newlyUnlocked.forEach((achievement) => {
      addNotification(
        'achievement',
        achievement.title,
        `+${achievement.reward} coins`
      );
      currencyService.addCoins(
        achievement.reward,
        `achievement_${achievement.id}`
      );
    });

  };

  const resetProgress = () => {
    const confirmed = window.confirm(
      '🔄 Reset All Progress?\n\n' +
      'This will reset:\n' +
      '• Coins and unlocked games\n' +
      '• User profile and stats\n' +
      '• Achievements and challenges\n' +
      '• All saved progress\n\n' +
      'This action cannot be undone!'
    );
    
    if (!confirmed) return;
    
    // Reset all services
    currencyService.resetCoins();
    saveUnlockedTiers([0]);
    
    // Clear all localStorage
    localStorage.removeItem('hacktivate-unlocked-tiers');
    localStorage.removeItem('hacktivate-user-progress');
    localStorage.removeItem('hacktivate-user-profile');
    localStorage.removeItem('hacktivate-user-stats');
    localStorage.removeItem('hacktivate-achievements');
    localStorage.removeItem('hacktivate-challenges');
    
    // Reinitialize services
    challengeService.init();
    achievementService.init();
    userService.init();
    
    setCurrentCoins(0);
    setNotifications([]);
    
    alert('🎮 All progress reset! Welcome back to the beginning.');
  };

  const tabButtons = [
    { id: 'games', label: 'Games', icon: '🎮' },
    { id: 'challenges', label: 'Challenges', icon: '🎯' },
    { id: 'achievements', label: 'Achievements', icon: '🏆' },
    { id: 'profile', label: 'Profile', icon: '👤' }
  ];

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
          {/* Debug buttons for development */}
          {process.env.NODE_ENV === 'development' && (
            <div className="flex gap-1">
              <button
                onClick={() => currencyService.addCoins(500, 'debug_test')}
                className="bg-green-600 hover:bg-green-700 text-white text-xs px-2 py-1 rounded"
                title="Add 500 coins"
              >
                +500
              </button>
              <button
                onClick={() => currencyService.addCoins(2000, 'debug_unlock')}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-2 py-1 rounded"
                title="Add 2000 coins (unlock tier 1)"
              >
                +2K
              </button>
              <button
                onClick={resetProgress}
                className="bg-orange-600 hover:bg-orange-700 text-white text-xs px-2 py-1 rounded"
                title="Reset all progress"
              >
                🔄 Reset
              </button>
            </div>
          )}
        </div>
        <CurrencyDisplay currencyService={currencyService} />
      </header>

      {/* Notifications */}
      {notifications.length > 0 && (
        <div className="fixed top-4 right-4 z-50 space-y-2">
          {notifications.map(notification => (
            <div
              key={notification.id}
              className={`p-3 rounded-lg shadow-lg border-l-4 bg-gray-800 text-white animate-in slide-in-from-right ${
                notification.type === 'achievement' ? 'border-yellow-500' :
                notification.type === 'levelup' ? 'border-purple-500' :
                'border-blue-500'
              }`}
            >
              <div className="font-bold text-sm">{notification.title}</div>
              <div className="text-xs text-gray-300">{notification.message}</div>
            </div>
          ))}
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto">
        {showHub ? (
          <div className="space-y-6">
            {/* Tab Navigation */}
            <div className="flex justify-center">
              <div className="bg-gray-800 p-1 rounded-lg">
                {tabButtons.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      activeTab === tab.id
                        ? 'bg-purple-600 text-white'
                        : 'text-gray-300 hover:text-white hover:bg-gray-700'
                    }`}
                  >
                    {tab.icon} {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tab Content */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {activeTab === 'games' && (
                <>
                  <div className="lg:col-span-2">
                    <GameCarousel
                      games={AVAILABLE_GAMES}
                      unlockedTiers={unlockedTiers}
                      currentCoins={currentCoins}
                      onGameSelect={handleGameSelect}
                      onGameUnlock={handleGameUnlock}
                    />
                  </div>
                  <div>
                    <UserProfile userService={userService} />
                  </div>
                </>
              )}

              {activeTab === 'challenges' && (
                <>
                  <div className="lg:col-span-2">
                    <DailyChallenges 
                      challengeService={challengeService}
                      onChallengeComplete={(challenge) => {
                        addNotification('challenge', 'Challenge Complete!', `${challenge.title} - +${challenge.reward} coins`);
                        currencyService.addCoins(challenge.reward, `challenge_${challenge.id}`);
                      }}
                    />
                  </div>
                  <div>
                    <UserProfile userService={userService} />
                  </div>
                </>
              )}

              {activeTab === 'achievements' && (
                <>
                  <div className="lg:col-span-2">
                    <AchievementPanel achievementService={achievementService} />
                  </div>
                  <div>
                    <UserProfile userService={userService} />
                  </div>
                </>
              )}

              {activeTab === 'profile' && (
                <>
                  <div className="lg:col-span-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <DailyChallenges 
                        challengeService={challengeService}
                        onChallengeComplete={(challenge) => {
                          addNotification('challenge', 'Challenge Complete!', `${challenge.title} - +${challenge.reward} coins`);
                          currencyService.addCoins(challenge.reward, `challenge_${challenge.id}`);
                        }}
                      />
                      <AchievementPanel achievementService={achievementService} />
                    </div>
                  </div>
                  <div>
                    <UserProfile userService={userService} />
                  </div>
                </>
              )}
            </div>

            {/* Welcome message for games tab */}
            {activeTab === 'games' && (
              <div className="text-center text-gray-300 mt-8">
                <h3 className="text-xl mb-4">Welcome to the Arcade!</h3>
                <p className="max-w-2xl mx-auto">
                  Play games to earn coins and experience, unlock new games, complete daily challenges, 
                  and collect achievements. Each game offers unique challenges and rewards!
                </p>
                <p className="text-sm mt-4 opacity-75">
                  Current Balance: {currentCoins} coins | Next unlock at: 2,000 coins
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="flex justify-center">
            <GameCanvas 
              game={currentGame} 
              currencyService={currencyService}
              onGameEnd={handleGameEnd}
            />
          </div>
        )}
      </main>
    </div>
  );
}