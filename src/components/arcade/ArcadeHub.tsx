// ===== src/components/arcade/ArcadeHub.tsx =====
'use client';

import dynamic from 'next/dynamic';
import { useState, useEffect, useCallback, useRef } from 'react';
import type { GameModule } from '@/lib/types';
import { gameLoader } from '@/games/registry';
import { CurrencyService } from '@/services/CurrencyService';
import { ChallengeService, Challenge } from '@/services/ChallengeService';
import { AchievementService } from '@/services/AchievementService';
import { UserService } from '@/services/UserServices';
import type { AudioManager, SoundName } from '@/services/AudioManager';
import { ECONOMY } from '@/lib/constants';
import { GameCarousel } from './GameCarousel';
import { CurrencyDisplay } from './CurrencyDisplay';
import { CompactPlayerBadge, UserProfile } from './UserProfiles';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { useArcadeUnlockState } from '@/hooks/useArcadeUnlockState';
import { useArcadeSupabaseSync } from '@/hooks/useArcadeSupabaseSync';
import { AVAILABLE_GAMES } from '@/data/Games';
import {
  PLAYABLE_GAME_CATALOG,
  hasImplementedGamesInTier,
  isGameImplemented,
} from '@/lib/gameCatalog';
import {
  DEFAULT_UNLOCKED_GAME_IDS,
  getTierUnlockCost,
  isDefaultUnlockedGame,
  isGameUnlocked,
} from '@/lib/unlocks';

const AudioSettings = dynamic(
  () => import('./AudioSettings').then(module => module.AudioSettings),
  { ssr: false }
);

const AchievementPanel = dynamic(
  () => import('./AchievementPanel').then(module => module.AchievementPanel),
  { ssr: false }
);

const AnalyticsOverview = dynamic(
  () => import('./AnalyticsOverview').then(module => module.AnalyticsOverview),
  { ssr: false }
);

const AuthModal = dynamic(
  () => import('@/components/auth/AuthModal').then(module => module.AuthModal),
  { ssr: false }
);

const DailyChallenges = dynamic(
  () => import('./DailyChallenges').then(module => module.DailyChallenges),
  { ssr: false }
);

const LeaderboardsTab = dynamic(
  () => import('./LeaderboardsTab').then(module => module.LeaderboardsTab),
  { ssr: false }
);

const OnboardingOverlay = dynamic(
  () => import('./OnboardingOverlay').then(module => module.OnboardingOverlay),
  { ssr: false }
);

const ThemedGameCanvas = dynamic(
  () => import('./ThemedGameCanvas').then(module => module.ThemedGameCanvas),
  { ssr: false }
);

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
  cells_cleared?: number;
  games_won?: number;
  fast_win?: number;
  bricks_broken?: number;
  levels_cleared?: number;
  total_bricks_broken?: number;
  // Speed Racer
  van_pickups?: number;
  powerups_used?: number;
  sections_cleared?: number;
  civilians_lost?: number;
  pacifist_distance?: number;
  choppers_killed?: number;
  perfect_sections?: number;
  unique_sections_visited?: number;
  shots_fired?: number;
}

type ArcadeTab = 'games' | 'leaderboards' | 'challenges' | 'achievements' | 'profile';

const TRUSTED_SESSION_CORE_FIELDS = new Set([
  'score',
  'pickups',
  'coinsEarned',
  'timePlayedMs',
]);

const getTrustedSessionMetrics = (gameData: GameEndData): Record<string, number> => {
  const metrics: Record<string, number> = {};

  Object.entries(gameData as Record<string, unknown>).forEach(([key, value]) => {
    if (TRUSTED_SESSION_CORE_FIELDS.has(key)) {
      return;
    }

    if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
      metrics[key] = value;
    }
  });

  if (Array.isArray(gameData.powerupTypesUsed)) {
    metrics.powerup_types = gameData.powerupTypesUsed.length;
  }

  return metrics;
};

const LOCAL_STORAGE_KEYS = [
  'hacktivate-unlocks-v2',
  'hacktivate-unlocked-tiers',
  'hacktivate-user-progress',
  'hacktivate-user-profile',
  'hacktivate-user-stats',
  'hacktivate-achievements',
  'hacktivate-challenges',
  'hacktivate-coins',
  'hacktivate-analytics',
  'hacktivate-supabase-sync-outbox-v1',
];

export function ArcadeHub() {
  const [currentGame, setCurrentGame] = useState<GameModule | null>(null);
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  const [currencyService] = useState(new CurrencyService());
  const [currentCoins, setCurrentCoins] = useState(0);
  const [showHub, setShowHub] = useState(true);
  const [activeTab, setActiveTab] = useState<ArcadeTab>('games');
  const [challenges, setChallenges] = useState<Challenge[]>([]);

  // Services
  const [challengeService] = useState(new ChallengeService());
  const [achievementService] = useState(new AchievementService());
  const [userService] = useState(new UserService());
  const [audioManager, setAudioManager] = useState<AudioManager | null>(null);
  const audioManagerRef = useRef<AudioManager | null>(null);
  const audioLoadPromiseRef = useRef<Promise<AudioManager> | null>(null);
  const schedulePlayerSyncRef = useRef<
    (overrides?: { unlockedTiers?: number[]; unlockedGames?: string[] }) => void
  >(() => {});
  const runWhileHydratingRef = useRef<(callback: () => void) => void>(callback => {
    callback();
  });
  const schedulePlayerSyncAdapter = useCallback(
    (overrides?: { unlockedTiers?: number[]; unlockedGames?: string[] }) => {
      schedulePlayerSyncRef.current(overrides);
    },
    []
  );
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
  const audioInitPromiseRef = useRef<Promise<void> | null>(null);
  const audioInitializedRef = useRef(false);
  const getAudioManager = useCallback(async () => {
    if (audioManagerRef.current) {
      return audioManagerRef.current;
    }

    if (!audioLoadPromiseRef.current) {
      audioLoadPromiseRef.current = import('@/services/AudioManager')
        .then(module => {
          const manager = new module.AudioManager();
          audioManagerRef.current = manager;
          setAudioManager(manager);
          return manager;
        })
        .catch(error => {
          audioLoadPromiseRef.current = null;
          throw error;
        });
    }

    return audioLoadPromiseRef.current;
  }, []);
  const playUiSound = useCallback((sound: SoundName) => {
    audioManagerRef.current?.playSound(sound);
  }, []);
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
    emailSentMode,
    pendingEmail,
    authDisabled,
    signInWithEmail,
    signInWithPassword,
    signUpWithPassword,
    resendEmail,
    clearAuthMessages,
    signOut,
  } = useSupabaseAuth();

  useEffect(() => {
    if (session && showAuthModal) {
      setShowAuthModal(false);
    }
  }, [session, showAuthModal]);

  useEffect(() => {
    if (!session && !showHub) {
      setShowHub(true);
      setCurrentGame(null);
      setSelectedGameId(null);
      setActiveTab('games');
      audioManagerRef.current?.stopHubMusicRotation();
      audioManagerRef.current?.stopMusic(0.2);
    }
  }, [session, showHub]);

  const ensureAudioInitialized = useCallback(async () => {
    const manager = await getAudioManager();

    if (audioInitializedRef.current) {
      return manager;
    }

    if (!audioInitPromiseRef.current) {
      audioInitPromiseRef.current = manager
        .init()
        .then(() => {
          audioInitializedRef.current = true;
        })
        .catch(error => {
          audioInitPromiseRef.current = null;
          throw error;
        });
    }

    await audioInitPromiseRef.current;
    return manager;
  }, [getAudioManager]);

  const {
    unlockedTiers,
    unlockedGames,
    unlocksRef,
    saveUnlockState,
  } = useArcadeUnlockState({
    achievementService,
    schedulePlayerSync: schedulePlayerSyncAdapter,
  });

  const applyLocalAchievementRewards = useCallback(
    (achievementIds: string[]) => {
      achievementIds.forEach(achievementId => {
        const achievement = achievementService
          .getAchievements()
          .find(entry => entry.id === achievementId);
        if (achievement) {
          currencyService.addCoins(
            achievement.reward,
            `achievement_${achievement.id}`
          );
        }
      });
    },
    [achievementService, currencyService]
  );

  const applyTrustedAchievementUnlocks = useCallback(
    (achievementIds: string[]) => {
      if (achievementIds.length === 0) {
        return;
      }

      const currentUnlockedIds = achievementService.getUnlockedAchievementIds();
      const currentUnlockedSet = new Set(currentUnlockedIds);
      const nextUnlockedIds = Array.from(
        new Set([...currentUnlockedIds, ...achievementIds])
      );
      const newlyUnlockedIds = achievementIds.filter(
        achievementId => !currentUnlockedSet.has(achievementId)
      );

      if (newlyUnlockedIds.length === 0) {
        return;
      }

      runWhileHydratingRef.current(() => {
        achievementService.setUnlockedAchievements(
          nextUnlockedIds.map(id => ({ id }))
        );
        userService.updateStats({
          achievementsUnlocked: nextUnlockedIds.length,
        });
      });

      newlyUnlockedIds.forEach(achievementId => {
        const achievement = achievementService
          .getAchievements()
          .find(entry => entry.id === achievementId);
        if (!achievement) {
          return;
        }

        playUiSound('success');
        addNotification(
          'achievement',
          achievement.title,
          `+${achievement.reward} coins`
        );
      });
    },
    [achievementService, addNotification, playUiSound, userService]
  );

  const resetLocalState = useCallback(() => {
    runWhileHydratingRef.current(() => {
      LOCAL_STORAGE_KEYS.forEach(key => localStorage.removeItem(key));
      currencyService.resetCoins();
      saveUnlockState([0], Array.from(DEFAULT_UNLOCKED_GAME_IDS), { sync: false });
      challengeService.init();
      achievementService.init();
      userService.init();
      setChallenges(challengeService.getChallenges());
      setCurrentCoins(0);
      setNotifications([]);
    });
  }, [
    achievementService,
    challengeService,
    currencyService,
    saveUnlockState,
    userService,
  ]);

  const {
    supabaseService,
    pendingSyncCount,
    isSyncingPending,
    isAccountHydrating,
    isBrowserOffline,
    syncDiagnostics,
    isHydratingRef,
    runWhileHydrating,
    schedulePlayerSync,
    queueSyncOperation,
    retryPendingSyncs,
    reconcileTrustedBalance,
  } = useArcadeSupabaseSync({
    session,
    achievementService,
    challengeService,
    currencyService,
    userService,
    unlocksRef,
    saveUnlockState,
    resetLocalState,
  });
  schedulePlayerSyncRef.current = schedulePlayerSync;
  runWhileHydratingRef.current = runWhileHydrating;

  useEffect(() => {
    if (!session || isAccountHydrating || !showHub) {
      return;
    }

    const warmGameIds = Array.from(
      new Set([...DEFAULT_UNLOCKED_GAME_IDS, ...unlockedGames])
    ).filter(isGameImplemented);

    if (warmGameIds.length === 0) {
      return;
    }

    const warmGames = () => {
      void gameLoader.preloadGames(warmGameIds);
    };

    if ('requestIdleCallback' in window) {
      const idleId = window.requestIdleCallback(warmGames, { timeout: 2500 });
      return () => window.cancelIdleCallback(idleId);
    }

    const timeoutId = setTimeout(warmGames, 1200);
    return () => clearTimeout(timeoutId);
  }, [isAccountHydrating, session, showHub, unlockedGames]);

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

      if (isHydratingRef.current) {
        return;
      }

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
      if (newAchievements.length === 0) {
        return;
      }

      newAchievements.forEach(achievement => {
        playUiSound('success');
        addNotification('achievement', achievement.title, `+${achievement.reward} coins!`);
      });

      if (supabaseService && session?.access_token) {
        void supabaseService
          .claimAchievements(
            newAchievements.map(achievement => achievement.id),
            { accessToken: session.access_token }
          )
          .then(result => {
            reconcileTrustedBalance(result.balance);
          })
          .catch(error => {
            console.warn('Trusted achievement claim failed:', error);
            queueSyncOperation({
              kind: 'trusted-achievement-claim',
              payload: {
                achievementIds: newAchievements.map(achievement => achievement.id),
              },
            });
            applyLocalAchievementRewards(
              newAchievements.map(achievement => achievement.id)
            );
          });
      } else {
        newAchievements.forEach(achievement => {
          currencyService.addCoins(achievement.reward, `achievement_${achievement.id}`);
        });
      }
    });

    return unsubscribe;
  }, [
    achievementService,
    challengeService,
    currencyService,
    addNotification,
    applyLocalAchievementRewards,
    playUiSound,
    isHydratingRef,
    reconcileTrustedBalance,
    queueSyncOperation,
    session,
    supabaseService,
    userService,
  ]);

  useEffect(() => {
    if (!showHub || audioInitializedRef.current) {
      return;
    }

    let active = true;
    const unlockAudio = () => {
      void ensureAudioInitialized().then(() => {
        if (active && showHub && !currentGame) {
          audioManagerRef.current?.startHubMusicRotation(4);
        }
      });
    };

    window.addEventListener('pointerdown', unlockAudio, { once: true });
    window.addEventListener('keydown', unlockAudio, { once: true });

    return () => {
      active = false;
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    };
  }, [currentGame, ensureAudioInitialized, showHub]);

  useEffect(() => {
    const applyPerkModifiers = () => {
      const modifiers = userService.getPerkModifiers();
      currencyService.setRewardModifiers({
        coinMultiplier: modifiers.coinMultiplier,
        minCoinsPerGame: modifiers.minCoinsPerGame,
        bonusCoinsPerScore: modifiers.bonusCoinsPerScore,
      });
    };

    applyPerkModifiers();
    const unsubscribe = userService.onUserDataChanged(() => {
      applyPerkModifiers();
    });

    return unsubscribe;
  }, [currencyService, userService]);

  useEffect(() => {
    setChallenges(challengeService.getChallenges());
    const unsubscribe = challengeService.onChallengesChanged((next) => {
      setChallenges(next);
    });
    return unsubscribe;
  }, [challengeService]);

  useEffect(() => {
    const seen = localStorage.getItem('hacktivate-onboarding-shown');
    if (!seen) {
      setShowOnboarding(true);
      localStorage.setItem('hacktivate-onboarding-shown', 'true');
    }
  }, []);

  const requireSignedIn = useCallback(() => {
    if (session) {
      return true;
    }

    playUiSound('click');
    setShowAuthModal(true);
    return false;
  }, [playUiSound, session]);

  const handleGameSelect = async (gameId: string) => {
    try {
      if (!requireSignedIn()) return;
      const manager = await ensureAudioInitialized();
      manager.playSound('click');
      if (!isGameImplemented(gameId)) return;
      if (!isGameUnlocked(gameId, unlockedTiers, unlockedGames)) return;
      const game = await gameLoader.loadGame(gameId);
      if (game) {
        setCurrentGame(game);
        setSelectedGameId(gameId);
        setShowHub(false);

        // Stop hub rotation and transition to game-specific music
        manager.stopHubMusicRotation();
        manager.playGameMusic(gameId, 'primary', 2.0);
        
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

  const handleTierUnlock = async (tier: number, cost: number) => {
    if (!requireSignedIn()) return;
    if (!hasImplementedGamesInTier(tier)) return;

    const applyLocalUnlock = () => {
      if (currencyService.spendCoins(cost, `unlock_tier_${tier}`)) {
        if (!unlockedTiers.includes(tier)) {
          playUiSound('unlock');
          const newTiers = [...unlockedTiers, tier].sort((a, b) => a - b);
          saveUnlockState(newTiers, unlockedGames);
          addNotification('achievement', 'Tier Unlocked!', `Tier ${tier} is now open`);
        }
      }
    };

    if (supabaseService && session?.access_token) {
      try {
        const result = await supabaseService.unlockTierTrusted(tier, {
          accessToken: session.access_token,
        });
        playUiSound('unlock');
        reconcileTrustedBalance(result.balance);
        saveUnlockState(result.unlockedTiers, result.unlockedGames);
        addNotification('achievement', 'Tier Unlocked!', `Tier ${tier} is now open`);
      } catch (error) {
        console.warn('Trusted tier unlock failed:', error);
        queueSyncOperation({
          kind: 'trusted-tier-unlock',
          payload: { tier },
        });
        applyLocalUnlock();
      }
      return;
    }

    queueSyncOperation({
      kind: 'trusted-tier-unlock',
      payload: { tier },
    });
    applyLocalUnlock();
  };

  const handleGameUnlock = async (gameId: string, cost: number) => {
    if (!requireSignedIn()) return;
    const game = AVAILABLE_GAMES.find(g => g.id === gameId);
    if (!game) return;
    if (!isGameImplemented(gameId)) return;
    if (!unlockedTiers.includes(game.tier)) return;
    if (unlockedGames.includes(gameId) || isDefaultUnlockedGame(gameId)) return;

    const applyLocalUnlock = () => {
      if (currencyService.spendCoins(cost, `unlock_${gameId}`)) {
        playUiSound('unlock');
        const newGames = [...unlockedGames, gameId];
        saveUnlockState(unlockedTiers, newGames);

        const paidUnlocked = newGames.filter(id => !isDefaultUnlockedGame(id)).length;
        achievementService.checkAchievement('games_unlocked', paidUnlocked);
        if (newGames.length >= PLAYABLE_GAME_CATALOG.length) {
          achievementService.checkAchievement('all_games_unlocked', 1);
        }

        addNotification('achievement', 'Game Unlocked!', `${game.title} is now available`);
      }
    };

    if (supabaseService && session?.access_token) {
      try {
        const result = await supabaseService.unlockGameTrusted(gameId, {
          accessToken: session.access_token,
        });
        playUiSound('unlock');
        reconcileTrustedBalance(result.balance);
        saveUnlockState(result.unlockedTiers, result.unlockedGames);

        const paidUnlocked = result.unlockedGames.filter(
          id => !isDefaultUnlockedGame(id)
        ).length;
        achievementService.checkAchievement('games_unlocked', paidUnlocked);
        if (result.unlockedGames.length >= PLAYABLE_GAME_CATALOG.length) {
          achievementService.checkAchievement('all_games_unlocked', 1);
        }

        addNotification('achievement', 'Game Unlocked!', `${game.title} is now available`);
      } catch (error) {
        console.warn('Trusted game unlock failed:', error);
        queueSyncOperation({
          kind: 'trusted-game-unlock',
          payload: { gameId },
        });
        applyLocalUnlock();
      }
      return;
    }

    queueSyncOperation({
      kind: 'trusted-game-unlock',
      payload: { gameId },
    });
    applyLocalUnlock();
  };

  const handleBackToHub = () => {
    playUiSound('click');
    setShowHub(true);
    setCurrentGame(null);
    setSelectedGameId(null);
    setActiveTab('games');

    // Return to hub music with auto-rotation
    if (audioInitializedRef.current) {
      audioManagerRef.current?.startHubMusicRotation(4);
    }
  };

  const handleChallengeComplete = useCallback(
    (challenge: Challenge) => {
      if (!session) {
        setShowAuthModal(true);
        return;
      }

      const applyDailyChallengeBonus = () => {
        if (!challengeService.areAllDailyChallengesCompleted()) {
          return;
        }

        playUiSound('powerup');
        currencyService.setBonusMultiplier(ECONOMY.DAILY_CHALLENGE_MULTIPLIER);
        addNotification(
          'challenge',
          'All Daily Challenges Complete!',
          `Coins are now multiplied by ${ECONOMY.DAILY_CHALLENGE_MULTIPLIER}x`
        );
      };

      if (supabaseService && session?.access_token) {
        void supabaseService
          .claimChallenge(challenge.id, challenge.progress, {
            accessToken: session.access_token,
          })
          .then(result => {
            playUiSound('success');
            addNotification(
              'challenge',
              'Challenge Complete!',
              `${challenge.title} - +${result.rewardAwarded} coins`
            );
            reconcileTrustedBalance(result.balance);
            if (!result.alreadyClaimed) {
              const current = userService.getStats().challengesCompleted;
              userService.updateStats({ challengesCompleted: current + 1 });
            }
            applyDailyChallengeBonus();
          })
          .catch(error => {
            console.warn('Trusted challenge claim failed:', error);
            queueSyncOperation({
              kind: 'trusted-challenge-claim',
              payload: {
                challengeId: challenge.id,
                progress: challenge.progress,
              },
            });
            const current = userService.getStats().challengesCompleted;
            const modifiers = userService.getPerkModifiers();
            const reward = Math.floor(
              challenge.reward * modifiers.challengeRewardMultiplier
            );
            playUiSound('success');
            addNotification(
              'challenge',
              'Challenge Complete!',
              `${challenge.title} - +${reward} coins`
            );
            currencyService.addCoins(reward, `challenge_${challenge.id}`);
            userService.updateStats({ challengesCompleted: current + 1 });
            applyDailyChallengeBonus();
          });
        return;
      }

      queueSyncOperation({
        kind: 'trusted-challenge-claim',
        payload: {
          challengeId: challenge.id,
          progress: challenge.progress,
        },
      });
      const current = userService.getStats().challengesCompleted;
      const modifiers = userService.getPerkModifiers();
      const reward = Math.floor(
        challenge.reward * modifiers.challengeRewardMultiplier
      );
      playUiSound('success');
      addNotification(
        'challenge',
        'Challenge Complete!',
        `${challenge.title} - +${reward} coins`
      );
      currencyService.addCoins(reward, `challenge_${challenge.id}`);
      userService.updateStats({ challengesCompleted: current + 1 });
      applyDailyChallengeBonus();
    },
    [
      addNotification,
      challengeService,
      currencyService,
      playUiSound,
      queueSyncOperation,
      reconcileTrustedBalance,
      session,
      supabaseService,
      userService,
    ]
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
    if (!session?.access_token || !supabaseService) {
      setShowAuthModal(true);
      handleBackToHub();
      return;
    }
    
    const stats = userService.getStats();
    const profile = userService.getProfile();
    const previousLevel = profile.level;
    const modifiers = userService.getPerkModifiers();
    
    // Calculate experience gained
    const baseExperience = Math.floor((gameData.score || 0) / 10) + (gameData.coinsEarned || 0);
    const experienceGained = Math.floor(baseExperience * modifiers.xpMultiplier);
    const levelResult = userService.addExperience(experienceGained);
    
    if (levelResult.leveledUp) {
      playUiSound('powerup');
      addNotification('levelup', 'Level Up!', `You reached level ${levelResult.newLevel}!`);

      const unlockedPerks = UserService.getNewPerks(previousLevel, levelResult.newLevel);
      unlockedPerks.forEach((perk) => {
        addNotification('levelup', `Perk Unlocked: ${perk.name}`, perk.description);
      });

      const unlockedMilestones = UserService.getNewMilestones(previousLevel, levelResult.newLevel);
      unlockedMilestones.forEach((milestone) => {
        addNotification('levelup', milestone.title, milestone.description);
        currencyService.addCoins(milestone.bonusCoins, `milestone_level_${milestone.level}`);
      });
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
    if (selectedGameId === 'speed-racer') {
      challengeService.updateProgress('speed-racer', 'distance', gameData.distance || 0);
      challengeService.updateProgress('speed-racer', 'speed', gameData.speed || 0);
      challengeService.updateProgress('speed-racer', 'combo', gameData.combo || 0);
      challengeService.updateProgress('speed-racer', 'enemies_destroyed', gameData.enemies_destroyed || 0);
      challengeService.updateProgress('speed-racer', 'powerups_used', gameData.powerups_used || 0);
      challengeService.updateProgress('speed-racer', 'van_pickups', gameData.van_pickups || 0);
      challengeService.updateProgress('speed-racer', 'sections_cleared', gameData.sections_cleared || 0);
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
        : []),
      ...(selectedGameId === 'speed-racer'
        ? [
            ...achievementService.checkAchievement('enemies_destroyed', gameData.enemies_destroyed || 0, selectedGameId),
            ...achievementService.checkAchievement('van_pickups', gameData.van_pickups || 0, selectedGameId),
            ...achievementService.checkAchievement('powerups_used', gameData.powerups_used || 0, selectedGameId),
            ...achievementService.checkAchievement('sections_cleared', gameData.sections_cleared || 0, selectedGameId),
            ...achievementService.checkAchievement('pacifist_distance', gameData.pacifist_distance || 0, selectedGameId),
            ...achievementService.checkAchievement('perfect_sections', gameData.perfect_sections || 0, selectedGameId),
            ...achievementService.checkAchievement('choppers_killed', gameData.choppers_killed || 0, selectedGameId),
            ...achievementService.checkAchievement('unique_sections_visited', gameData.unique_sections_visited || 0, selectedGameId),
          ]
        : [])
    ];

    const trustedAchievementIds: string[] = [];
    newlyUnlocked.forEach((achievement) => {
      playUiSound('success');
      addNotification(
        'achievement',
        achievement.title,
        `+${achievement.reward} coins`
      );
      trustedAchievementIds.push(achievement.id);
    });

    if (newlyUnlocked.length > 0) {
      const current = userService.getStats().achievementsUnlocked;
      userService.updateStats({ achievementsUnlocked: current + newlyUnlocked.length });
    }

    const trustedSessionMetrics = getTrustedSessionMetrics(gameData);

    // Persist score and economy-sensitive rewards through the trusted server path.
    void (async () => {
      const clientMutationId =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

      try {
        const sessionResult = await supabaseService.recordTrustedGameSession(
          {
            gameId: selectedGameId,
            score: gameData.score || 0,
            pickups: gameData.pickups || 0,
            timePlayedMs: gameData.timePlayedMs || 0,
            metrics: trustedSessionMetrics,
            clientMutationId,
          },
          {
            accessToken: session.access_token,
          }
        );
        reconcileTrustedBalance(sessionResult.balance);
        applyTrustedAchievementUnlocks(sessionResult.achievementIds ?? []);
      } catch (error) {
        console.warn('Trusted session sync failed:', error);
        queueSyncOperation({
          kind: 'trusted-session-record',
          payload: {
            gameId: selectedGameId,
            score: gameData.score || 0,
            pickups: gameData.pickups || 0,
            timePlayedMs: gameData.timePlayedMs || 0,
            metrics: trustedSessionMetrics,
            clientMutationId,
          },
        });
        if (trustedAchievementIds.length > 0) {
          applyLocalAchievementRewards(trustedAchievementIds);
        }
      }
    })();

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
    
    resetLocalState();
    
    alert('\u{1F3AE} All progress reset! Welcome back to the beginning.');
  };

  const tabButtons: Array<{ id: ArcadeTab; label: string; icon: string }> = [
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
    'Player';

  const handleEmailSignIn = async (email: string) => {
    await signInWithEmail(email);
  };

  const showAuthGate = !authLoading && !authDisabled && !session;
  const showAuthUnavailable = authDisabled;
  const showAccountLoading = authLoading || (!!session && isAccountHydrating);

  const releasedTiers = Array.from(new Set(PLAYABLE_GAME_CATALOG.map(g => g.tier))).sort(
    (a, b) => a - b
  );
  const nextTierToUnlock = releasedTiers.find(t => t !== 0 && !unlockedTiers.includes(t));
  const nextUnlockMessage =
    nextTierToUnlock != null
      ? `Next tier unlock: ${getTierUnlockCost(nextTierToUnlock)} coins (Tier ${nextTierToUnlock})`
      : 'All released tiers unlocked';
  const daily = challenges.filter(c => c.type === 'daily');
  const dailyCompleted = daily.filter(c => c.completed).length;
  const unlockedReleasedTierCount = releasedTiers.filter(tier => unlockedTiers.includes(tier)).length;
  const unlockedGameCount = unlockedGames.filter(isGameImplemented).length;

  return (
    <div
      className="relative min-h-screen overflow-x-hidden bg-[linear-gradient(135deg,#050816_0%,#10172a_44%,#24073f_100%)] px-4 py-5 text-white"
      data-testid="arcade-root"
    >
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 opacity-45">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.055)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:44px_44px]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_0%,rgba(34,211,238,0.08)_48%,transparent_100%)]" />
      </div>
      {/* Header */}
      <header className="sticky top-3 z-40 mx-auto mb-6 flex max-w-7xl flex-col gap-3 rounded-2xl border border-white/10 bg-slate-950/75 px-4 py-3 shadow-[0_18px_45px_rgba(0,0,0,0.38)] backdrop-blur-xl lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-col leading-tight">
            <h1 className="font-arcade text-xl font-bold text-white md:text-2xl">
              Hacktivate Nations Arcade
            </h1>
            <div className="text-xs text-cyan-100/70">
              Earn coins • Unlock tiers • Chase highscores
            </div>
          </div>
          {!showHub && (
            <button
              onClick={handleBackToHub}
              className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/15"
            >
              {'\u2190 Back to Hub'}
            </button>
          )}
          <button
            onClick={() => setShowOnboarding(true)}
            className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/15"
          >
            Help
          </button>
          <button
            onClick={() => {
              void ensureAudioInitialized().then(manager => {
                manager.playSound('click');
                setShowAudioSettings(true);
              });
            }}
            className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/15"
          >
            Audio
          </button>
          {/* Debug buttons for development */}
          {process.env.NODE_ENV === 'development' && session && (
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
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
          {!authDisabled ? (
            <div className="text-left sm:text-right">
              <div className="text-sm font-semibold text-white">
                {session ? `Signed in as ${welcomeName}` : 'Sign in required'}
              </div>
              <div className="flex justify-end gap-2">
                {session ? (
                  <button
                    onClick={() => signOut()}
                    className="text-xs text-cyan-100 underline hover:text-white"
                  >
                    Sign out
                  </button>
                ) : (
                  <button
                    onClick={() => setShowAuthModal(true)}
                    className="text-xs text-cyan-100 underline hover:text-white"
                  >
                    Open sign in
                  </button>
                )}
              </div>
              {session && pendingSyncCount > 0 && (
                <div className="text-[11px] text-amber-200 mt-1 max-w-[260px]">
                  <div>
                    {isSyncingPending
                      ? `Syncing ${pendingSyncCount} pending change${pendingSyncCount === 1 ? '' : 's'}...`
                      : isBrowserOffline
                        ? `${pendingSyncCount} change${pendingSyncCount === 1 ? '' : 's'} waiting for reconnect`
                        : syncDiagnostics.failedCount > 0
                          ? `${pendingSyncCount} change${pendingSyncCount === 1 ? '' : 's'} queued after ${syncDiagnostics.highestRetryCount} failed sync attempt${syncDiagnostics.highestRetryCount === 1 ? '' : 's'}`
                          : `${pendingSyncCount} change${pendingSyncCount === 1 ? '' : 's'} queued for sync`}
                  </div>
                  {syncDiagnostics.lastError && (
                    <div className="text-[10px] text-red-200 mt-1">
                      Last sync error: {syncDiagnostics.lastError}
                    </div>
                  )}
                  {!isSyncingPending && (
                    <button
                      onClick={() => {
                        void retryPendingSyncs();
                      }}
                      disabled={isBrowserOffline}
                      className="text-[10px] text-purple-100 underline hover:text-white disabled:text-gray-400 disabled:no-underline mt-1"
                    >
                      {isBrowserOffline ? 'Retry unavailable offline' : 'Retry sync now'}
                    </button>
                  )}
                </div>
              )}
              {authError && (
                <div className="text-[11px] text-red-200 mt-1 max-w-[220px]">
                  {authError}
                </div>
              )}
            </div>
          ) : (
            <div className="text-right text-xs text-orange-200 max-w-[200px]">
              Supabase not configured; authentication is required.
            </div>
          )}
          {session && (
            <>
              <CompactPlayerBadge
                userService={userService}
                onOpenProfile={() => {
                  playUiSound('click');
                  setShowHub(true);
                  setActiveTab('profile');
                }}
              />
              <CurrencyDisplay currencyService={currencyService} />
            </>
          )}
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
        {showAccountLoading ? (
          <div className="mx-auto max-w-3xl rounded-3xl border border-white/10 bg-black/30 backdrop-blur-xl p-8 text-center text-white shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
            <div className="text-xs uppercase tracking-[0.3em] text-cyan-200/80">
              Account Sync
            </div>
            <h2 className="mt-4 text-3xl font-black">Loading your arcade profile</h2>
            <p className="mt-3 text-sm text-gray-300">
              Pulling down your wallet, unlocks, challenges, and achievements before the
              arcade opens.
            </p>
          </div>
        ) : showAuthUnavailable ? (
          <div className="mx-auto max-w-3xl rounded-3xl border border-orange-400/30 bg-orange-500/10 backdrop-blur-xl p-8 text-center text-orange-100 shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
            <div className="text-xs uppercase tracking-[0.3em] text-orange-200/80">
              Authentication Unavailable
            </div>
            <h2 className="mt-4 text-3xl font-black text-white">
              This build cannot open the arcade right now
            </h2>
            <p className="mt-3 text-sm text-orange-100/90">
              Supabase auth is not configured. Production access now requires a signed-in
              account, so the guest path has been removed.
            </p>
          </div>
        ) : showAuthGate ? (
          <div className="mx-auto max-w-4xl rounded-3xl border border-white/10 bg-black/30 backdrop-blur-xl p-8 md:p-10 text-white shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
            <div className="grid gap-8 lg:grid-cols-[1.25fr_0.75fr] lg:items-center">
              <div>
                <div className="text-xs uppercase tracking-[0.3em] text-cyan-200/80">
                  Production Access
                </div>
                <h2 className="mt-4 text-3xl md:text-5xl font-black leading-tight">
                  Sign in to enter the arcade
                </h2>
                <p className="mt-4 max-w-2xl text-sm md:text-base text-gray-300 leading-relaxed">
                  Guest play has been retired. Every session now runs against an authenticated
                  player record so wallet balance, unlocks, achievements, challenges, and
                  leaderboards stay tied to the correct account.
                </p>
                <div className="mt-6 grid gap-3 md:grid-cols-3">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="text-xs uppercase tracking-wide text-cyan-200/80">
                      Wallet
                    </div>
                    <div className="mt-2 text-sm text-gray-200">
                      Trusted coin balance and unlock state.
                    </div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="text-xs uppercase tracking-wide text-cyan-200/80">
                      Progress
                    </div>
                    <div className="mt-2 text-sm text-gray-200">
                      Challenges, achievements, and stats follow your account.
                    </div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="text-xs uppercase tracking-wide text-cyan-200/80">
                      Leaderboards
                    </div>
                    <div className="mt-2 text-sm text-gray-200">
                      Scores post under the signed-in player identity.
                    </div>
                  </div>
                </div>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
                <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-5">
                  <div className="text-xs uppercase tracking-[0.22em] text-cyan-100/70">
                    Sign In Required
                  </div>
                  <h3 className="mt-3 text-2xl font-black leading-tight text-white">
                    Use an approved account to continue
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-slate-300">
                    This arcade now requires sign in. Use your assigned account to access
                    progress, leaderboards, and sync.
                  </p>
                </div>
                <button
                  onClick={() => setShowAuthModal(true)}
                  className="mt-5 w-full rounded-xl bg-white text-gray-950 py-3 font-semibold hover:bg-gray-100 transition-colors"
                >
                  Open sign in
                </button>
                <div className="mt-3 text-xs text-gray-400 leading-relaxed">
                  Use one of the provisioned accounts for testing, or your assigned development
                  account while we finish launch hardening.
                </div>
                {authError && (
                  <div className="mt-4 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                    {authError}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : showHub ? (
          <div className="space-y-6">
            {/* Tab Navigation */}
            <div className="flex justify-center lg:justify-start">
              <div className="flex max-w-full gap-1 overflow-x-auto rounded-2xl border border-white/10 bg-slate-950/60 p-1 shadow-[0_14px_34px_rgba(0,0,0,0.28)] backdrop-blur">
                {tabButtons.map(tab => (
                  <button
                    key={tab.id}
                    data-testid={`arcade-tab-${tab.id}`}
                    onClick={() => {
                      if (activeTab !== tab.id) {
                        playUiSound('click');
                        setActiveTab(tab.id);
                      }
                    }}
                    className={`min-h-11 shrink-0 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all ${
                      activeTab === tab.id
                        ? 'bg-gradient-to-r from-cyan-300 via-purple-400 to-amber-200 text-slate-950 shadow'
                        : 'text-slate-300 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    {tab.icon} {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tab Content */}
            <div>
              {activeTab === 'games' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-4 backdrop-blur">
                      <div className="text-xs uppercase tracking-wider text-cyan-100/70">
                        Daily Challenges
                      </div>
                      <div className="mt-2 flex items-baseline gap-2">
                        <div className="text-3xl font-black text-white">
                          {dailyCompleted}/{daily.length}
                        </div>
                        <div className="text-sm text-slate-300">complete</div>
                      </div>
                      <button
                        onClick={() => {
                          playUiSound('click');
                          setActiveTab('challenges');
                        }}
                        className="mt-4 min-h-11 w-full rounded-xl border border-white/10 bg-white/10 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/15"
                      >
                        View Challenges
                      </button>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-4 backdrop-blur">
                      <div className="text-xs uppercase tracking-wider text-cyan-100/70">
                        Unlock Progress
                      </div>
                      <div className="mt-2 text-3xl font-black text-white">
                        {unlockedGameCount}/{PLAYABLE_GAME_CATALOG.length}
                      </div>
                      <div className="mt-1 text-sm text-slate-300">released games unlocked</div>
                      <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 text-center text-sm font-semibold text-white/90">
                        {nextUnlockMessage}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-4 backdrop-blur">
                      <div className="text-xs uppercase tracking-wider text-cyan-100/70">
                        Balance
                      </div>
                      <div className="mt-2 text-3xl font-black text-amber-200">
                        {currentCoins}
                      </div>
                      <div className="mt-1 text-sm text-slate-300">coins available</div>
                      <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 text-center text-sm font-semibold text-white/90">
                        Tiers open: {unlockedReleasedTierCount}/{releasedTiers.length}
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
              )}

              {activeTab === 'leaderboards' && (
                <div className="space-y-4">
                  <LeaderboardsTab
                    supabaseService={supabaseService}
                    signedIn={!!session}
                    authDisabled={authDisabled}
                    games={PLAYABLE_GAME_CATALOG}
                    unlockedTiers={unlockedTiers}
                    unlockedGames={unlockedGames}
                    onPlayGame={(gameId) => void handleGameSelect(gameId)}
                    onRequestSignIn={() => setShowAuthModal(true)}
                  />
                </div>
              )}

              {activeTab === 'challenges' && (
                <DailyChallenges challengeService={challengeService} />
              )}

              {activeTab === 'achievements' && (
                <AchievementPanel achievementService={achievementService} />
              )}

              {activeTab === 'profile' && (
                <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(320px,0.85fr)_minmax(0,1.6fr)]">
                  <UserProfile userService={userService} />
                  <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    <DailyChallenges challengeService={challengeService} />
                    <AchievementPanel achievementService={achievementService} />
                    <AnalyticsOverview analyticsOwnerId={session?.user.id} />
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : audioManager ? (
          <div className="flex justify-center">
            <ThemedGameCanvas 
              game={currentGame} 
              currencyService={currencyService}
              audioManager={audioManager}
              achievementService={achievementService}
              analyticsOwnerId={session?.user.id}
              onGameEnd={handleGameEnd}
            />
          </div>
        ) : (
          <div className="flex justify-center text-white">Loading audio engine...</div>
        )}
      </main>
      {showOnboarding && (
        <OnboardingOverlay onClose={() => setShowOnboarding(false)} />
      )}
      {showAudioSettings && audioManager && (
        <AudioSettings
          audioManager={audioManager}
          isOpen={showAudioSettings}
          onClose={() => setShowAudioSettings(false)}
        />
      )}
      {showAuthModal && (
        <AuthModal
          open={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          onMagicLink={handleEmailSignIn}
          onPasswordSignIn={(email, password) => signInWithPassword(email, password)}
          onPasswordSignUp={(email, password, username) =>
            signUpWithPassword(email, password, username)
          }
          onResendEmail={resendEmail}
          onClearMessages={clearAuthMessages}
          loading={authLoading}
          error={authError}
          emailSentMode={emailSentMode}
          pendingEmail={pendingEmail}
        />
      )}
    </div>
  );
}
