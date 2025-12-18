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
import { LeaderboardsTab } from './LeaderboardsTab';
import { SupabaseArcadeService } from '@/services/SupabaseArcadeService';
import { getSupabaseBrowserClient } from '@/lib/supabase';
import { AVAILABLE_GAMES } from '@/data/Games';
import {
  DEFAULT_UNLOCKED_GAME_IDS,
  getTierUnlockCost,
  isDefaultUnlockedGame,
  isGameUnlocked,
} from '@/lib/unlocks';

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
  const [unlockedGames, setUnlockedGames] = useState<string[]>(Array.from(DEFAULT_UNLOCKED_GAME_IDS));
  const [currencyService] = useState(new CurrencyService());
  const [currentCoins, setCurrentCoins] = useState(0);
  const [showHub, setShowHub] = useState(true);
  const [activeTab, setActiveTab] = useState<'games' | 'leaderboards' | 'challenges' | 'achievements' | 'profile'>(
    'games'
  );
  const [challenges, setChallenges] = useState<Challenge[]>([]);

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

  useEffect(() => {
    setChallenges(challengeService.getChallenges());
    const unsubscribe = challengeService.onChallengesChanged((next) => {
      setChallenges(next);
    });
    return unsubscribe;
  }, [challengeService]);

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
    const accessToken = session.access_token;
    if (!accessToken) {
      console.warn('Supabase profile sync skipped: missing access token.');
      return;
    }
    void supabaseService
      .upsertProfile({
        id: session.user.id,
        username: profileData.username,
        avatarUrl: profileData.avatar,
      }, {
        accessToken,
      })
      .catch(error => console.warn('Supabase profile sync failed:', error));
  }, [session, supabaseService, userService]);

  // Push wallet updates when coins change.
  useEffect(() => {
    if (!supabaseService || !session) return;
    const accessToken = session.access_token;
    if (!accessToken) {
      console.warn('Supabase wallet sync skipped: missing access token.');
      return;
    }
    const unsubscribe = currencyService.onCoinsChanged(balance => {
      const stats = userService.getStats();
      void supabaseService
        .upsertWallet({
          userId: session.user.id,
          balance,
          lifetimeEarned: stats.coinsEarned,
        }, {
          accessToken,
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
    const savedV2 = localStorage.getItem('hacktivate-unlocks-v2');
    if (savedV2) {
      try {
        const parsed = JSON.parse(savedV2) as { tiers?: number[]; games?: string[] };
        const tiers = Array.isArray(parsed.tiers) ? parsed.tiers : [0];
        const games = Array.isArray(parsed.games)
          ? Array.from(new Set([...DEFAULT_UNLOCKED_GAME_IDS, ...parsed.games]))
          : Array.from(DEFAULT_UNLOCKED_GAME_IDS);

        setUnlockedTiers(tiers.includes(0) ? tiers : [0, ...tiers]);
        setUnlockedGames(games);

        const paidUnlocked = games.filter(id => !isDefaultUnlockedGame(id)).length;
        if (paidUnlocked > 0) {
          achievementService.checkAchievement('games_unlocked', paidUnlocked);
        }
        if (games.length >= AVAILABLE_GAMES.length) {
          achievementService.checkAchievement('all_games_unlocked', 1);
        }
      } catch (error) {
        console.warn('Failed to load unlock state:', error);
      }
      return;
    }

    const legacy = localStorage.getItem('hacktivate-unlocked-tiers');
    if (legacy) {
      try {
        const legacyTiers = JSON.parse(legacy) as number[];
        const tiers = Array.from(new Set([0, ...legacyTiers])).sort((a, b) => a - b);
        const legacyGames = AVAILABLE_GAMES.filter(g => tiers.includes(g.tier)).map(g => g.id);
        const games = Array.from(new Set([...DEFAULT_UNLOCKED_GAME_IDS, ...legacyGames]));

        setUnlockedTiers(tiers);
        setUnlockedGames(games);
        localStorage.setItem('hacktivate-unlocks-v2', JSON.stringify({ tiers, games }));

        const paidUnlocked = games.filter(id => !isDefaultUnlockedGame(id)).length;
        if (paidUnlocked > 0) {
          achievementService.checkAchievement('games_unlocked', paidUnlocked);
        }
        if (games.length >= AVAILABLE_GAMES.length) {
          achievementService.checkAchievement('all_games_unlocked', 1);
        }
      } catch (error) {
        console.warn('Failed to migrate unlock tiers:', error);
      }
    }
  }, [achievementService]);

  const saveUnlockState = (tiers: number[], games: string[]) => {
    setUnlockedTiers(tiers);
    setUnlockedGames(games);
    localStorage.setItem('hacktivate-unlocks-v2', JSON.stringify({ tiers, games }));
  };


  const handleGameSelect = async (gameId: string) => {
    try {
      audioManager.playSound('click');
      if (!isGameUnlocked(gameId, unlockedTiers, unlockedGames)) return;
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

  const handleTierUnlock = (tier: number, cost: number) => {
    if (currencyService.spendCoins(cost, `unlock_tier_${tier}`)) {
      if (!unlockedTiers.includes(tier)) {
        audioManager.playSound('unlock');
        const newTiers = [...unlockedTiers, tier].sort((a, b) => a - b);
        saveUnlockState(newTiers, unlockedGames);
        addNotification('achievement', 'Tier Unlocked!', `Tier ${tier} is now open`);
      }
    }
  };

  const handleGameUnlock = (gameId: string, cost: number) => {
    const game = AVAILABLE_GAMES.find(g => g.id === gameId);
    if (!game) return;
    if (!unlockedTiers.includes(game.tier)) return;
    if (unlockedGames.includes(gameId) || isDefaultUnlockedGame(gameId)) return;

    if (currencyService.spendCoins(cost, `unlock_${gameId}`)) {
      audioManager.playSound('unlock');
      const newGames = [...unlockedGames, gameId];
      saveUnlockState(unlockedTiers, newGames);

      const paidUnlocked = newGames.filter(id => !isDefaultUnlockedGame(id)).length;
      achievementService.checkAchievement('games_unlocked', paidUnlocked);
      if (newGames.length >= AVAILABLE_GAMES.length) {
        achievementService.checkAchievement('all_games_unlocked', 1);
      }

      addNotification('achievement', 'Game Unlocked!', `${game.title} is now available`);
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
        : []),
      ...(selectedGameId === 'minesweeper'
        ? [
            ...achievementService.checkAchievement('cells_cleared', gameData.cells_cleared || 0, selectedGameId),
            ...achievementService.checkAchievement('games_won', gameData.games_won || 0, selectedGameId),
            ...(gameData.fast_win
              ? achievementService.checkAchievement('fast_win', gameData.fast_win, selectedGameId)
              : []),
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
         const accessToken = session.access_token;
         if (!accessToken) {
           console.warn('Supabase achievement sync skipped: missing access token.');
         } else {
          void supabaseService
            .upsertAchievement({
              userId: session.user.id,
              achievementId: achievement.id,
              progress: achievement.requirement.value,
              unlockedAt: achievement.unlockedAt?.toISOString() ?? new Date().toISOString(),
            }, {
             accessToken,
           })
            .catch(error => console.warn('Supabase achievement sync failed:', error));
         }
       }
     });

    if (newlyUnlocked.length > 0) {
      const current = userService.getStats().achievementsUnlocked;
      userService.updateStats({ achievementsUnlocked: current + newlyUnlocked.length });
    }

    // Persist session + wallet to Supabase when available (non-blocking).
     if (supabaseService && session) {
       const accessToken = session.access_token;
       if (!accessToken) {
         console.warn('Supabase session sync skipped: missing access token.');
         return;
       }
       void supabaseService
         .recordGameSession({
           userId: session.user.id,
           gameId: selectedGameId,
           score: gameData.score || 0,
           durationMs: gameData.timePlayedMs || 0,
           metadata: { ...gameData },
         }, {
           accessToken,
         })
         .catch(error => console.warn('Supabase session record failed:', error));

       void supabaseService
         .upsertWallet({
           userId: session.user.id,
           balance: currencyService.getCurrentCoins(),
           lifetimeEarned: newStats.coinsEarned,
         }, {
           accessToken,
         })
         .catch(error => console.warn('Supabase wallet sync failed:', error));
     }

  };

  const resetProgress = () => {
    const confirmed = window.confirm(
      '🔄 Reset All Progress?\n\n' +
      'This will reset:\n' +
      '\u2022 Coins and unlocks\n' +
      '\u2022 User profile and stats\n' +
      '\u2022 Achievements and challenges\n' +
      '\u2022 All saved progress\n\n' +
      'This action cannot be undone!'
    );
    
    if (!confirmed) return;
    
    // Reset all services
    currencyService.resetCoins();
    saveUnlockState([0], Array.from(DEFAULT_UNLOCKED_GAME_IDS));
    
    // Clear all localStorage
    localStorage.removeItem('hacktivate-unlocks-v2');
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
    
    alert('\u{1F3AE} All progress reset! Welcome back to the beginning.');
  };

  const tabButtons = [
    { id: 'games', label: 'Games', icon: '\u{1F3AE}' },
    { id: 'leaderboards', label: 'Leaderboards', icon: '\u{1F3C6}' },
    { id: 'challenges', label: 'Challenges', icon: '\u{1F3AF}' },
    { id: 'achievements', label: 'Achievements', icon: '\u{1F3C5}' },
    { id: 'profile', label: 'Profile', icon: '\u{1F464}' }
  ];

  const welcomeName =
    profile?.username ||
    session?.user.email?.split('@')[0] ||
    session?.user.user_metadata?.preferred_username ||
    'Guest';

  const handleEmailSignIn = async (email: string) => {
    await signInWithEmail(email);
  };

  const tiers = Array.from(new Set(AVAILABLE_GAMES.map(g => g.tier))).sort((a, b) => a - b);
  const nextTierToUnlock = tiers.find(t => t !== 0 && !unlockedTiers.includes(t));
  const nextUnlockMessage =
    nextTierToUnlock != null
      ? `Next tier unlock: ${getTierUnlockCost(nextTierToUnlock)} coins (Tier ${nextTierToUnlock})`
      : 'All tiers unlocked';
  const daily = challenges.filter(c => c.type === 'daily');
  const dailyCompleted = daily.filter(c => c.completed).length;
  const unlockedGameCount = unlockedGames.length;

  return (
    <div
      className="min-h-screen relative overflow-x-hidden bg-gradient-to-br from-gray-950 via-purple-950 to-gray-950 px-4 py-6"
      data-testid="arcade-root"
    >
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-40 left-1/2 h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-purple-600/15 blur-3xl" />
        <div className="absolute -top-24 left-8 h-72 w-72 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-fuchsia-500/10 blur-3xl" />
      </div>
      {/* Header */}
      <header className="sticky top-4 z-40 flex justify-between items-center mb-8 max-w-7xl mx-auto border border-white/10 bg-gradient-to-r from-purple-900/60 to-indigo-900/40 backdrop-blur-xl rounded-2xl px-4 py-3 shadow-[0_12px_40px_rgba(0,0,0,0.45)]">
        <div className="flex items-center gap-4">
          <div className="flex flex-col leading-tight">
            <h1 className="text-2xl font-bold text-white font-arcade">
              Hacktivate Nations Arcade
            </h1>
            <div className="text-xs text-purple-200/80">
              Earn coins • Unlock tiers • Chase highscores
            </div>
          </div>
          {!showHub && (
            <button
              onClick={handleBackToHub}
              className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-white text-sm font-semibold border border-white/10 transition-colors"
            >
              {'\u2190 Back to Hub'}
            </button>
          )}
          <button
            onClick={() => setShowOnboarding(true)}
            className="ml-1 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-white text-sm font-semibold border border-white/10 transition-colors"
          >
            Help
          </button>
          <button
            onClick={() => {
              audioManager.playSound('click');
              setShowAudioSettings(true);
            }}
            className="ml-1 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-white text-sm font-semibold border border-white/10 transition-colors"
          >
            Audio
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
                title="Add 2000 coins (debug)"
              >
                +2K
              </button>
              <button
                onClick={resetProgress}
                className="bg-orange-600 hover:bg-orange-700 text-white text-xs px-2 py-1 rounded"
                title="Reset all progress"
              >
                Reset
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
              className={`p-3 rounded-xl shadow-lg border bg-gray-900/80 backdrop-blur text-white animate-in slide-in-from-right ${
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
              <div className="inline-flex gap-1 bg-gray-900/50 border border-white/10 backdrop-blur p-1 rounded-full shadow-sm">
                {tabButtons.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => {
                      if (activeTab !== tab.id) {
                        audioManager.playSound('click');
                        setActiveTab(tab.id as any);
                      }
                    }}
                    className={`px-5 py-2.5 rounded-full text-sm font-semibold transition-all ${
                      activeTab === tab.id
                        ? 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white shadow'
                        : 'text-gray-300 hover:text-white hover:bg-white/10'
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
                  <div className="lg:col-span-2 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="rounded-2xl bg-white/5 border border-white/10 backdrop-blur p-4">
                        <div className="text-xs uppercase tracking-wider text-gray-300">
                          Daily Challenges
                        </div>
                        <div className="mt-2 flex items-baseline gap-2">
                          <div className="text-2xl font-bold text-white">
                            {dailyCompleted}/{daily.length}
                          </div>
                          <div className="text-sm text-gray-300">complete</div>
                        </div>
                        <div className="mt-2 text-xs text-gray-400">
                          Finish all dailies for a 1.5× coin boost.
                        </div>
                        <button
                          onClick={() => {
                            audioManager.playSound('click');
                            setActiveTab('challenges');
                          }}
                          className="mt-3 w-full rounded-lg bg-white/10 hover:bg-white/15 border border-white/10 text-white text-sm font-semibold py-2 transition-colors"
                        >
                          View Challenges
                        </button>
                      </div>

                      <div className="rounded-2xl bg-white/5 border border-white/10 backdrop-blur p-4">
                        <div className="text-xs uppercase tracking-wider text-gray-300">
                          Unlock Progress
                        </div>
                        <div className="mt-2 text-2xl font-bold text-white">
                          {unlockedGameCount}/{AVAILABLE_GAMES.length}
                        </div>
                        <div className="mt-1 text-sm text-gray-300">games unlocked</div>
                        <div className="mt-2 text-xs text-gray-400">
                          Tiers open: {unlockedTiers.length}/{tiers.length}
                        </div>
                        <div className="mt-3 w-full rounded-lg bg-white/10 border border-white/10 text-white/90 text-sm font-semibold py-2 text-center">
                          {nextUnlockMessage}
                        </div>
                      </div>

                      <div className="rounded-2xl bg-white/5 border border-white/10 backdrop-blur p-4">
                        <div className="text-xs uppercase tracking-wider text-gray-300">
                          Pro Tip
                        </div>
                        <div className="mt-2 text-sm text-gray-200 leading-relaxed">
                          Bounce between games to stack coins faster, then come back and
                          unlock the next tier.
                        </div>
                        <div className="mt-3 flex items-center justify-between rounded-lg bg-black/30 border border-white/10 px-3 py-2">
                          <div className="text-xs text-gray-300">Balance</div>
                          <div className="text-sm font-bold text-yellow-300">
                            {currentCoins} coins
                          </div>
                        </div>
                      </div>
                    </div>
                    <GameCarousel
                      games={AVAILABLE_GAMES}
                      unlockedTiers={unlockedTiers}
                      unlockedGames={unlockedGames}
                      currentCoins={currentCoins}
                      onGameSelect={handleGameSelect}
                      onTierUnlock={handleTierUnlock}
                      onGameUnlock={handleGameUnlock}
                    />
                  </div>
                  <div>
                    <UserProfile userService={userService} />
                  </div>
                </>
              )}

              {activeTab === 'leaderboards' && (
                <>
                  <div className="lg:col-span-2 space-y-4">
                    <LeaderboardsTab
                      supabaseService={supabaseService}
                      signedIn={!!session}
                      authDisabled={authDisabled}
                      games={AVAILABLE_GAMES}
                      unlockedTiers={unlockedTiers}
                      unlockedGames={unlockedGames}
                      onPlayGame={(gameId) => void handleGameSelect(gameId)}
                      onRequestSignIn={() => setShowAuthModal(true)}
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
              <div className="mt-8 rounded-2xl bg-white/5 border border-white/10 backdrop-blur p-6 text-center text-gray-200">
                <h3 className="text-xl font-bold text-white">Welcome to the Arcade</h3>
                <p className="max-w-2xl mx-auto mt-2 text-sm text-gray-300">
                  Play to earn coins, unlock tiers, and then unlock games within each tier.
                  Complete daily challenges for bonuses, and chase leaderboard spots.
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
