import { AVAILABLE_GAMES } from '@/data/Games';
import { gameLoader } from '@/games/registry';
import type { GameManifest } from '@/lib/types';

const REGISTERED_GAME_IDS = new Set(gameLoader.getAvailableGames());

export const isGameImplemented = (gameId: string): boolean =>
  REGISTERED_GAME_IDS.has(gameId);

export const PLAYABLE_GAME_CATALOG: GameManifest[] = AVAILABLE_GAMES.filter(game =>
  isGameImplemented(game.id)
);

export const COMING_SOON_GAME_CATALOG: GameManifest[] = AVAILABLE_GAMES.filter(
  game => !isGameImplemented(game.id)
);

export const getImplementedGamesInTier = (tier: number): GameManifest[] =>
  PLAYABLE_GAME_CATALOG.filter(game => game.tier === tier);

export const hasImplementedGamesInTier = (tier: number): boolean =>
  getImplementedGamesInTier(tier).length > 0;

export const sanitizeUnlockedGameIds = (gameIds: string[]): string[] =>
  Array.from(new Set(gameIds.filter(isGameImplemented)));
