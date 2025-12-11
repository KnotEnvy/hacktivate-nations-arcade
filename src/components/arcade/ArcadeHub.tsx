// ===== src/components/arcade/ArcadeHub.tsx =====
'use client';

import { useState, useEffect, useCallback } from 'react';
import { GameModule } from '@/lib/types';
import { gameLoader } from '@/games/registry';
import { CurrencyService } from '@/services/CurrencyService';
import { ChallengeService, Challenge } from '@/services/ChallengeService';
import { AchievementService } from '@/services/AchievementService';
import { UserService } from '@/services/UserServices';
import { AudioManager } from '@/services/AudioManager';
import { ECONOMY } from '@/lib/constants';
import { ThemedGameCanvas } from './ThemedGameCanvas';
import { GameCarousel } from './GameCarousel';
import { CurrencyDisplay } from './CurrencyDisplay';
import { DailyChallenges } from './DailyChallenges';
import { AchievementPanel } from './AchievementPanel';
import { UserProfile } from './UserProfiles';
import { AnalyticsOverview } from './AnalyticsOverview';
import { OnboardingOverlay } from './OnboardingOverlay';
import { AudioSettings } from './AudioSettings';
import { AuthModal } from '@/components/auth/AuthModal';
import { WelcomeBanner } from '@/components/auth/WelcomeBanner';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { LeaderboardPanel } from './LeaderboardPanel';
import { SupabaseArcadeService } from '@/services/SupabaseArcadeService';
import { getSupabaseBrowserClient } from '@/lib/supabase';
import { AVAILABLE_GAMES } from '@/data/Games';

interface GameEndData {
  score?: number;
  coinsEarned?: number;
  distance?: number;
  speed?: number;
  combo?: number;
  jumps?: number;
  powerupsUsed?: number;
  powerupTypesUsed?: string[];
  linesCleared?: number;
  level?: number;
  tetrisCount?: number;
  uniqueThemes?: number;
  timePlayedMs?: number;
  pickups?: number;
  wave?: number;
  waves_completed?: number;
  bosses_defeated?: number;
  max_stage?: number;
  enemies_destroyed?: number;
  powerups_collected?: number;
  survival_time?: number;
  totalKills?: number;
  matches_made?: number;
  perfect_levels?: number;
  fast_completion?: number;
  levels_completed?: number;
  bricks_broken?: number;
  levels_cleared?: number;
  total_bricks_broken?: number;
}

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
  const [audioManager] = useState(new AudioManager());
  
  // Notifications
  const [notifications, setNotifications] = useState<Array<{
    id: string;
    type: 'achievement' | 'challenge' | 'levelup';
    title: string;
    message: string;
    timestamp: Date;
  }>>([]);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showAudioSettings, setShowAudioSettings] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [supabaseService, setSupabaseService] = useState<SupabaseArcadeService | null>(null);
  const addNotification = useCallback((type: 'achievement' | 'challenge' | 'levelup', title: string, message: string) => {
    const notification = {
      id: `${Date.now()}-${Math.random()}`,
      type,
      title,
      message,
      timestamp: new Date()
    };
    
    setNotifications(prev => [notification, ...prev.slice(0, 4)]); // Keep only 5 notifications
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== notification.id));
    }, 5000);
  }, []);
  const {
    session,
    profile,
    loading: authLoading,
    error: authError,
    emailSent,
    authDisabled,
    signInWithEmail,
    signInWithPassword,
    signUpWithPassword,
    signOut,
  } = useSupabaseAuth();

  useEffect(() => {
    currencyService.init();
    challengeService.init();
    achievementService.init();
    userService.init();
    
    // Initialize audio manager
    audioManager.init().then(() => {
      // Start hub music after a brief delay
      setTimeout(() => {
        audioManager.playMusic('hub_music', 3.0);
      }, 1000);
    });

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
        audioManager.playSound('success');
        addNotification('achievement', achievement.title, `+${achievement.reward} coins!`);
        currencyService.addCoins(achievement.reward, `achievement_${achievement.id}`);
      });
    });

    return unsubscribe;
  }, [challengeService, achievementService, userService, audioManager, currencyService, addNotification]);

  // Create Supabase service on the client when signed in.
  useEffect(() => {
    let mounted = true;
    if (!session) {
      setSupabaseService(null);
      return () => {
        mounted = false;
      };
    }

    const init = async () => {
      try {
        const client = getSupabaseBrowserClient();
        if (!mounted) return;
        setSupabaseService(new SupabaseArcadeService(client));
      } catch (error) {
        console.warn('Supabase unavailable; staying offline:', error);
        setSupabaseService(null);
      }
    };

    void init();
    return () => {
      mounted = false;
    };
  }, [session]);

  // Keep Supabase profile in sync with the local profile.
  useEffect(() => {
    if (!supabaseService || !session) return;
    const profileData = userService.getProfile();
    void supabaseService
      .upsertProfile({
        id: session.user.id,
        username: profileData.username,
        avatarUrl: profileData.avatar,
      })
      .catch(error => console.warn('Supabase profile sync failed:', error));
  }, [session, supabaseService, userService]);

  // Push wallet updates when coins change.
  useEffect(() => {
    if (!supabaseService || !session) return;
    const unsubscribe = currencyService.onCoinsChanged(balance => {
      const stats = userService.getStats();
      void supabaseService
        .upsertWallet({
          userId: session.user.id,
          balance,
          lifetimeEarned: stats.coinsEarned,
        })
        .catch(error => console.warn('Supabase wallet sync failed:', error));
    });
    return unsubscribe;
  }, [currencyService, session, supabaseService, userService]);


  useEffect(() => {
    const seen = localStorage.getItem('hacktivate-onboarding-shown');
    if (!seen) {
      setShowOnboarding(true);
      localStorage.setItem('hacktivate-onboarding-shown', 'true');
    }
  }, []);

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

  const saveUnlockedTiers = (tiers: number[]) => {
    setUnlockedTiers(tiers);
    localStorage.setItem('hacktivate-unlocked-tiers', JSON.stringify(tiers));
  };


  const handleGameSelect = async (gameId: string) => {
    try {
      audioManager.playSound('click');
      const game = await gameLoader.loadGame(gameId);
      if (game) {
        setCurrentGame(game);
        setSelectedGameId(gameId);
        setShowHub(false);
        
        // Transition to game music
        audioManager.playMusic('game_music', 2.0);
        
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
        audioManager.playSound('unlock');
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
    audioManager.playSound('click');
    setShowHub(true);
    setCurrentGame(null);
    setSelectedGameId(null);
    setActiveTab('games');
    
    // Return to hub music
    audioManager.playMusic('hub_music', 2.0);
  };

  const handleChallengeComplete = useCallback(
    (challenge: Challenge) => {
      audioManager.playSound('success');
      addNotification(
        'challenge',
        'Challenge Complete!',
        `${challenge.title} - +${challenge.reward} coins`
      );
      currencyService.addCoins(challenge.reward, `challenge_${challenge.id}`);
      const current = userService.getStats().challengesCompleted;
      userService.updateStats({ challengesCompleted: current + 1 });
      if (challengeService.areAllDailyChallengesCompleted()) {
        audioManager.playSound('powerup');
        currencyService.setBonusMultiplier(ECONOMY.DAILY_CHALLENGE_MULTIPLIER);
        addNotification(
          'challenge',
          'All Daily Challenges Complete!',
          `Coins are now multiplied by ${ECONOMY.DAILY_CHALLENGE_MULTIPLIER}x`
        );
      }
    },
    [addNotification, currencyService, userService, challengeService, audioManager]
  );

  // Track completed challenges even when the DailyChallenges
  // component isn't mounted by subscribing at the hub level.
  useEffect(() => {
    const unsubscribe = challengeService.onChallengeCompleted(
      handleChallengeComplete
    );
    return unsubscribe;
  }, [challengeService, handleChallengeComplete]);

  const handleGameEnd = (gameData?: GameEndData) => {
    if (!gameData || !selectedGameId) return;
    
    const stats = userService.getStats();
    const profile = userService.getProfile();
    
    // Calculate experience gained
    const experienceGained = Math.floor(gameData.score / 10) + gameData.coinsEarned;
    const levelResult = userService.addExperience(experienceGained);
    
    if (levelResult.leveledUp) {
      audioManager.playSound('powerup');
      addNotification('levelup', 'Level Up!', `You reached level ${levelResult.newLevel}!`);
    }
    
    // Update user stats
    const totalCoinsEarned = stats.coinsEarned + (gameData.coinsEarned || 0);
    const newStats = {
      totalDistance: Math.max(stats.totalDistance, gameData.distance || 0),
      maxSpeed: Math.max(stats.maxSpeed, gameData.speed || 0),
      maxCombo: Math.max(stats.maxCombo, gameData.combo || 0),
      totalJumps: stats.totalJumps + (gameData.jumps || 0),
      powerupsUsed: stats.powerupsUsed + (gameData.powerupsUsed || 0),
      coinsEarned: totalCoinsEarned
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
    const survivalSeconds = Math.floor((gameData.timePlayedMs || 0) / 1000);

    const newlyUnlocked = [
      ...achievementService.checkAchievement('distance', gameData.distance || 0, selectedGameId),
      ...achievementService.checkAchievement('max_speed', gameData.speed || 0, selectedGameId),
      ...achievementService.checkAchievement('max_combo', gameData.combo || 0, selectedGameId),
      ...achievementService.checkAchievement(
        'total_playtime',
        profile.totalPlayTime + playTimeSeconds
      ),
      ...achievementService.checkAchievement('total_coins_earned', totalCoinsEarned),
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
      ...achievementService.checkAchievement('lines_cleared', gameData.linesCleared || 0, selectedGameId),
      ...achievementService.checkAchievement('puzzle_level', gameData.level || 0, selectedGameId),
      ...achievementService.checkAchievement('score', gameData.score || 0, selectedGameId),
      ...achievementService.checkAchievement('tetris_count', gameData.tetrisCount || 0, selectedGameId),
      ...achievementService.checkAchievement('unique_themes', gameData.uniqueThemes || 0, selectedGameId),
      ...achievementService.checkAchievement('games_played', updatedStats.gamesPlayed),
      ...(selectedGameId === 'space'
        ? [
            ...achievementService.checkAchievement('waves_completed', gameData.waves_completed || gameData.wave || 0, selectedGameId),
            ...achievementService.checkAchievement('bosses_defeated', gameData.bosses_defeated || 0, selectedGameId),
            ...achievementService.checkAchievement('max_stage', gameData.max_stage || gameData.level || 0, selectedGameId),
            ...achievementService.checkAchievement('enemies_destroyed', gameData.enemies_destroyed || gameData.totalKills || 0, selectedGameId),
            ...achievementService.checkAchievement('powerups_collected', gameData.powerups_collected || 0, selectedGameId),
            ...achievementService.checkAchievement('survival_time', survivalSeconds, selectedGameId),
          ]
        : []),
      ...(selectedGameId === 'memory'
        ? [
            ...achievementService.checkAchievement('matches_made', gameData.matches_made || 0, selectedGameId),
            ...achievementService.checkAchievement('perfect_levels', gameData.perfect_levels || 0, selectedGameId),
            ...(gameData.fast_completion ? achievementService.checkAchievement('fast_completion', gameData.fast_completion, selectedGameId) : []),
            ...achievementService.checkAchievement('levels_completed', gameData.levels_completed || 0, selectedGameId),
          ]
        : []),
      ...(selectedGameId === 'breakout'
        ? [
            ...achievementService.checkAchievement('bricks_broken', gameData.bricks_broken || 0, selectedGameId),
            ...achievementService.checkAchievement('levels_cleared', gameData.levels_cleared || 0, selectedGameId),
            ...achievementService.checkAchievement('powerups_collected', gameData.powerups_collected || 0, selectedGameId),
            ...achievementService.checkAchievement('total_bricks_broken', gameData.total_bricks_broken || 0, selectedGameId),
          ]
        : [])
    ];

    newlyUnlocked.forEach((achievement) => {
      audioManager.playSound('success');
      addNotification(
        'achievement',
        achievement.title,
        `+${achievement.reward} coins`
      );
      currencyService.addCoins(
        achievement.reward,
        `achievement_${achievement.id}`
      );

      if (supabaseService && session) {
        void supabaseService
          .upsertAchievement({
            userId: session.user.id,
            achievementId: achievement.id,
            progress: achievement.requirement.value,
            unlockedAt: achievement.unlockedAt?.toISOString() ?? new Date().toISOString(),
          })
          .catch(error => console.warn('Supabase achievement sync failed:', error));
      }
    });

    if (newlyUnlocked.length > 0) {
      const current = userService.getStats().achievementsUnlocked;
      userService.updateStats({ achievementsUnlocked: current + newlyUnlocked.length });
    }

    // Persist session + wallet to Supabase when available (non-blocking).
    if (supabaseService && session) {
      void supabaseService
        .recordGameSession({
          userId: session.user.id,
          gameId: selectedGameId,
          score: gameData.score || 0,
          durationMs: gameData.timePlayedMs || 0,
          metadata: { ...gameData },
        })
        .catch(error => console.warn('Supabase session record failed:', error));

      void supabaseService
        .upsertWallet({
          userId: session.user.id,
          balance: currencyService.getCurrentCoins(),
          lifetimeEarned: newStats.coinsEarned,
        })
        .catch(error => console.warn('Supabase wallet sync failed:', error));
    }

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

  const welcomeName =
    profile?.username ||
    session?.user.email?.split('@')[0] ||
    session?.user.user_metadata?.preferred_username ||
    'Guest';

  const handleEmailSignIn = async (email: string) => {
    await signInWithEmail(email);
  };


  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 p-4" data-testid="arcade-root">
      {/* Header */}
      <header className="relative flex justify-between items-center mb-8 bg-gradient-to-r from-purple-800 to-purple-900 rounded-lg px-4 py-3 shadow-lg">
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
          <button
            onClick={() => setShowOnboarding(true)}
            className="ml-2 text-sm text-white underline hover:text-purple-200"
          >
            Help
          </button>
          <button
            onClick={() => {
              audioManager.playSound('click');
              setShowAudioSettings(true);
            }}
            className="ml-2 px-3 py-1 bg-purple-700 hover:bg-purple-600 text-white text-sm rounded transition-colors"
          >
            🔊 Audio
          </button>
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
        <div className="flex items-center gap-4">
          {!authDisabled ? (
            <div className="text-right">
              <div className="text-sm text-white font-semibold">
                {session ? `Signed in as ${welcomeName}` : 'Guest mode'}
              </div>
              <div className="flex justify-end gap-2">
                {session ? (
                  <button
                    onClick={() => signOut()}
                    className="text-xs text-purple-200 underline hover:text-white"
                  >
                    Sign out
                  </button>
                ) : (
                  <button
                    onClick={() => setShowAuthModal(true)}
                    className="text-xs text-purple-200 underline hover:text-white"
                  >
                    Sign in
                  </button>
                )}
              </div>
              {authError && (
                <div className="text-[11px] text-red-200 mt-1 max-w-[220px]">
                  {authError}
                </div>
              )}
            </div>
          ) : (
            <div className="text-right text-xs text-orange-200 max-w-[200px]">
              Supabase not configured; running in offline mode.
            </div>
          )}
          <CurrencyDisplay currencyService={currencyService} />
        </div>
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
      <main className="max-w-7xl mx-auto" data-testid="arcade-hub">
        {showHub ? (
          <div className="space-y-6">
            <WelcomeBanner
              name={welcomeName}
              authenticated={!!session}
              onSignIn={() => !authDisabled && setShowAuthModal(true)}
              onSignOut={() => void signOut()}
            />
            {/* Tab Navigation */}
            <div className="flex justify-center">
              <div className="bg-gray-800 p-1 rounded-lg">
                {tabButtons.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => {
                      if (activeTab !== tab.id) {
                        audioManager.playSound('click');
                        setActiveTab(tab.id as any);
                      }
                    }}
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
                  <div className="lg:col-span-2 space-y-4">
                    <GameCarousel
                      games={AVAILABLE_GAMES}
                      unlockedTiers={unlockedTiers}
                      currentCoins={currentCoins}
                      onGameSelect={handleGameSelect}
                      onGameUnlock={handleGameUnlock}
                    />
                    <LeaderboardPanel supabaseService={supabaseService} signedIn={!!session} />
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
                      onChallengeComplete={handleChallengeComplete}
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
                        onChallengeComplete={handleChallengeComplete}
                      />
                      <AchievementPanel achievementService={achievementService} />
                      <AnalyticsOverview />
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
            <ThemedGameCanvas 
              game={currentGame} 
              currencyService={currencyService}
              audioManager={audioManager}
              achievementService={achievementService}
              onGameEnd={handleGameEnd}
            />
          </div>
        )}
      </main>
      {showOnboarding && (
        <OnboardingOverlay onClose={() => setShowOnboarding(false)} />
      )}
      {showAudioSettings && (
        <AudioSettings
          audioManager={audioManager}
          isOpen={showAudioSettings}
          onClose={() => setShowAudioSettings(false)}
        />
      )}
      <AuthModal
        open={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onMagicLink={handleEmailSignIn}
        onPasswordSignIn={(email, password) => signInWithPassword(email, password)}
        onPasswordSignUp={(email, password, username) =>
          signUpWithPassword(email, password, username)
        }
        loading={authLoading}
        error={authError}
        emailSent={emailSent}
      />
    </div>
  );
}
