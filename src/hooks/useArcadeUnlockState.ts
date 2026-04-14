'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { AchievementService } from '@/services/AchievementService';
import { PLAYABLE_GAME_CATALOG, sanitizeUnlockedGameIds } from '@/lib/gameCatalog';
import { DEFAULT_UNLOCKED_GAME_IDS, isDefaultUnlockedGame } from '@/lib/unlocks';

const UNLOCKS_STORAGE_KEY = 'hacktivate-unlocks-v2';
const LEGACY_UNLOCKED_TIERS_KEY = 'hacktivate-unlocked-tiers';

interface UnlockSyncOverrides {
  unlockedTiers?: number[];
  unlockedGames?: string[];
}

interface UseArcadeUnlockStateOptions {
  achievementService: AchievementService;
  schedulePlayerSync: (overrides?: UnlockSyncOverrides) => void;
}

interface UnlockState {
  tiers: number[];
  games: string[];
}

const normalizeUnlockedTiers = (tiers: number[]): number[] =>
  Array.from(new Set(tiers.includes(0) ? tiers : [0, ...tiers])).sort((a, b) => a - b);

const normalizeUnlockedGames = (games: string[]): string[] =>
  Array.from(new Set([...DEFAULT_UNLOCKED_GAME_IDS, ...sanitizeUnlockedGameIds(games)]));

const syncAchievementProgress = (
  achievementService: AchievementService,
  games: string[]
): void => {
  const paidUnlocked = games.filter(id => !isDefaultUnlockedGame(id)).length;
  if (paidUnlocked > 0) {
    achievementService.checkAchievement('games_unlocked', paidUnlocked);
  }
  if (games.length >= PLAYABLE_GAME_CATALOG.length) {
    achievementService.checkAchievement('all_games_unlocked', 1);
  }
};

export function useArcadeUnlockState({
  achievementService,
  schedulePlayerSync,
}: UseArcadeUnlockStateOptions) {
  const [unlockedTiers, setUnlockedTiers] = useState<number[]>([0]);
  const [unlockedGames, setUnlockedGames] = useState<string[]>(
    Array.from(DEFAULT_UNLOCKED_GAME_IDS)
  );
  const unlocksRef = useRef<UnlockState>({
    tiers: [0],
    games: Array.from(DEFAULT_UNLOCKED_GAME_IDS),
  });

  useEffect(() => {
    unlocksRef.current = { tiers: unlockedTiers, games: unlockedGames };
  }, [unlockedGames, unlockedTiers]);

  const saveUnlockState = useCallback(
    (tiers: number[], games: string[], options?: { sync?: boolean }) => {
      const normalizedTiers = normalizeUnlockedTiers(tiers);
      const normalizedGames = normalizeUnlockedGames(games);
      unlocksRef.current = { tiers: normalizedTiers, games: normalizedGames };
      setUnlockedTiers(normalizedTiers);
      setUnlockedGames(normalizedGames);
      localStorage.setItem(
        UNLOCKS_STORAGE_KEY,
        JSON.stringify({ tiers: normalizedTiers, games: normalizedGames })
      );
      if (options?.sync !== false) {
        schedulePlayerSync({
          unlockedTiers: normalizedTiers,
          unlockedGames: normalizedGames,
        });
      }
    },
    [schedulePlayerSync]
  );

  useEffect(() => {
    const savedUnlocks = localStorage.getItem(UNLOCKS_STORAGE_KEY);
    if (savedUnlocks) {
      try {
        const parsed = JSON.parse(savedUnlocks) as {
          tiers?: number[];
          games?: string[];
        };
        const tiers = Array.isArray(parsed.tiers) ? parsed.tiers : [0];
        const games = Array.isArray(parsed.games) ? parsed.games : [];
        const normalizedTiers = normalizeUnlockedTiers(tiers);
        const normalizedGames = normalizeUnlockedGames(games);
        saveUnlockState(normalizedTiers, normalizedGames);
        syncAchievementProgress(achievementService, normalizedGames);
      } catch (error) {
        console.warn('Failed to load unlock state:', error);
      }
      return;
    }

    const legacyTiersRaw = localStorage.getItem(LEGACY_UNLOCKED_TIERS_KEY);
    if (!legacyTiersRaw) return;

    try {
      const legacyTiers = JSON.parse(legacyTiersRaw) as number[];
      const normalizedTiers = normalizeUnlockedTiers(legacyTiers);
      const legacyGames = PLAYABLE_GAME_CATALOG.filter(game =>
        normalizedTiers.includes(game.tier)
      ).map(game => game.id);
      const normalizedGames = normalizeUnlockedGames(legacyGames);
      saveUnlockState(normalizedTiers, normalizedGames);
      syncAchievementProgress(achievementService, normalizedGames);
    } catch (error) {
      console.warn('Failed to migrate unlock tiers:', error);
    }
  }, [achievementService, saveUnlockState]);

  return {
    unlockedTiers,
    unlockedGames,
    unlocksRef,
    saveUnlockState,
  };
}
