import { AVAILABLE_GAMES } from '@/data/Games';
import { TIER_GAME_COST_INCREMENTS, TIER_UNLOCK_COSTS } from './constants';

export const DEFAULT_UNLOCKED_GAME_IDS = ['runner'] as const;

export const isDefaultUnlockedGame = (gameId: string) =>
  (DEFAULT_UNLOCKED_GAME_IDS as readonly string[]).includes(gameId);

export const getTierUnlockCost = (tier: number): number =>
  (TIER_UNLOCK_COSTS as Record<number, number>)[tier] ?? 0;

export const getTierGameIncrement = (tier: number): number =>
  (TIER_GAME_COST_INCREMENTS as Record<number, number>)[tier] ?? 0;

export const getNextGameUnlockCost = (tier: number, unlockedPaidInTier: number): number => {
  const increment = getTierGameIncrement(tier);
  return Math.max(0, increment * (unlockedPaidInTier + 1));
};

export const getPaidUnlockedCountInTier = (tier: number, unlockedGameIds: string[]): number => {
  const byId = new Set(unlockedGameIds);
  return AVAILABLE_GAMES.filter(
    g => g.tier === tier && !isDefaultUnlockedGame(g.id) && byId.has(g.id)
  ).length;
};

export const isTierUnlocked = (tier: number, unlockedTiers: number[]): boolean =>
  unlockedTiers.includes(tier);

export const isGameUnlocked = (
  gameId: string,
  unlockedTiers: number[],
  unlockedGameIds: string[]
): boolean => {
  if (isDefaultUnlockedGame(gameId)) return true;
  const game = AVAILABLE_GAMES.find(g => g.id === gameId);
  if (!game) return false;
  return isTierUnlocked(game.tier, unlockedTiers) && unlockedGameIds.includes(gameId);
};

