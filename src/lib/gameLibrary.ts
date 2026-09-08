// ===== src/lib/gameLibrary.ts =====
// Pure view-model logic for the arcade library. The component renders what
// these functions decide, so browsing rules stay testable and the UI stays thin.

import type { GameCategory, GameManifest } from '@/lib/types';
import { isGameImplemented } from '@/lib/gameCatalog';
import {
  getNextGameUnlockCost,
  getPaidUnlockedCountInTier,
  isDefaultUnlockedGame,
  isTierUnlocked,
} from '@/lib/unlocks';

/**
 * What a player can actually do with a catalog entry right now. Ordered from
 * most to least actionable — the sort below relies on that order.
 */
export type GameStatus =
  | 'playable' // unlocked, press play
  | 'affordable' // tier open, priced, and the wallet covers it
  | 'short' // tier open and priced, but not enough coins yet
  | 'tier-locked' // the tier itself has to be bought first
  | 'coming-soon'; // in the catalog, not in the registry

const STATUS_ORDER: Record<GameStatus, number> = {
  playable: 0,
  affordable: 1,
  short: 2,
  'tier-locked': 3,
  'coming-soon': 4,
};

export interface GameEntry {
  game: GameManifest;
  status: GameStatus;
  /** Coin price to unlock this game right now. 0 when it is not for sale. */
  unlockCost: number;
  /** Most recent play timestamp (ms), or 0 if never played. */
  lastPlayed: number;
  plays: number;
}

export interface LibraryState {
  unlockedTiers: number[];
  unlockedGames: string[];
  currentCoins: number;
  /** Per-game play history keyed by game id. */
  activity?: Record<string, { plays: number; lastPlayed: number }>;
}

export const isPlayable = (entry: GameEntry): boolean => entry.status === 'playable';

export function buildGameEntries(
  games: GameManifest[],
  state: LibraryState
): GameEntry[] {
  const { unlockedTiers, unlockedGames, currentCoins, activity } = state;
  // Cost is per tier, not per game: it climbs with each paid unlock already
  // owned in that tier, so it is computed once per tier rather than per card.
  const nextCostByTier = new Map<number, number>();
  const costForTier = (tier: number) => {
    const cached = nextCostByTier.get(tier);
    if (cached !== undefined) return cached;
    const cost = getNextGameUnlockCost(
      tier,
      getPaidUnlockedCountInTier(tier, unlockedGames)
    );
    nextCostByTier.set(tier, cost);
    return cost;
  };

  return games.map(game => {
    const history = activity?.[game.id];
    const base = {
      game,
      lastPlayed: history?.lastPlayed ?? 0,
      plays: history?.plays ?? 0,
    };

    if (!isGameImplemented(game.id)) {
      return { ...base, status: 'coming-soon' as const, unlockCost: 0 };
    }

    const owned =
      isDefaultUnlockedGame(game.id) ||
      (isTierUnlocked(game.tier, unlockedTiers) && unlockedGames.includes(game.id));

    if (owned) {
      return { ...base, status: 'playable' as const, unlockCost: 0 };
    }

    if (!isTierUnlocked(game.tier, unlockedTiers)) {
      return { ...base, status: 'tier-locked' as const, unlockCost: costForTier(game.tier) };
    }

    const cost = costForTier(game.tier);
    return {
      ...base,
      status: currentCoins >= cost ? ('affordable' as const) : ('short' as const),
      unlockCost: cost,
    };
  });
}

export type StatusFilter = 'all' | 'ready' | 'locked' | 'coming-soon';

const STATUS_FILTER_MATCH: Record<StatusFilter, (status: GameStatus) => boolean> = {
  all: () => true,
  ready: status => status === 'playable',
  locked: status =>
    status === 'affordable' || status === 'short' || status === 'tier-locked',
  'coming-soon': status => status === 'coming-soon',
};

export interface LibraryFilters {
  search: string;
  status: StatusFilter;
  /** `null` means every category. */
  category: GameCategory | null;
}

export const EMPTY_FILTERS: LibraryFilters = {
  search: '',
  status: 'all',
  category: null,
};

const matchesSearch = (game: GameManifest, query: string): boolean => {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return (
    game.title.toLowerCase().includes(needle) ||
    game.id.toLowerCase().includes(needle) ||
    (game.category?.toLowerCase().includes(needle) ?? false) ||
    (game.tagline?.toLowerCase().includes(needle) ?? false) ||
    (game.description?.toLowerCase().includes(needle) ?? false)
  );
};

export function filterEntries(
  entries: GameEntry[],
  filters: LibraryFilters
): GameEntry[] {
  return entries.filter(entry => {
    if (!STATUS_FILTER_MATCH[filters.status](entry.status)) return false;
    if (filters.category && entry.game.category !== filters.category) return false;
    return matchesSearch(entry.game, filters.search);
  });
}

/** Most actionable first, then alphabetical so the grid never reshuffles. */
export function sortEntries(entries: GameEntry[]): GameEntry[] {
  return [...entries].sort((a, b) => {
    const byStatus = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
    if (byStatus !== 0) return byStatus;
    return a.game.title.localeCompare(b.game.title);
  });
}

export interface TierGroup {
  tier: number;
  unlocked: boolean;
  /** True when the tier holds at least one registered, playable game. */
  hasReleasedGames: boolean;
  /** Cost to open the tier itself. */
  tierCost: number;
  /** Cost of the next paid game inside the tier. */
  nextGameCost: number;
  ownedCount: number;
  releasedCount: number;
  entries: GameEntry[];
}

export function groupByTier(
  entries: GameEntry[],
  allEntries: GameEntry[],
  state: Pick<LibraryState, 'unlockedTiers' | 'unlockedGames'>,
  tierCostFor: (tier: number) => number
): TierGroup[] {
  const tiers = Array.from(new Set(allEntries.map(entry => entry.game.tier))).sort(
    (a, b) => a - b
  );

  return tiers
    .map(tier => {
      const inTier = allEntries.filter(entry => entry.game.tier === tier);
      const released = inTier.filter(entry => entry.status !== 'coming-soon');
      return {
        tier,
        unlocked: isTierUnlocked(tier, state.unlockedTiers),
        hasReleasedGames: released.length > 0,
        tierCost: tierCostFor(tier),
        nextGameCost: getNextGameUnlockCost(
          tier,
          getPaidUnlockedCountInTier(tier, state.unlockedGames)
        ),
        ownedCount: released.filter(entry => entry.status === 'playable').length,
        releasedCount: released.length,
        entries: sortEntries(entries.filter(entry => entry.game.tier === tier)),
      };
    })
    .filter(group => group.entries.length > 0);
}

/**
 * The single game the library leads with. Preference order: the game the player
 * was last in the middle of, then anything unlocked they have not tried, then
 * the cheapest thing they could unlock right now.
 */
export function pickFeatured(entries: GameEntry[]): GameEntry | null {
  const playable = entries.filter(isPlayable);

  const lastPlayed = playable
    .filter(entry => entry.lastPlayed > 0)
    .sort((a, b) => b.lastPlayed - a.lastPlayed)[0];
  if (lastPlayed) return lastPlayed;

  const untouched = playable.find(entry => entry.plays === 0);
  if (untouched) return untouched;
  if (playable.length > 0) return playable[0];

  const affordable = entries
    .filter(entry => entry.status === 'affordable')
    .sort((a, b) => a.unlockCost - b.unlockCost)[0];
  return affordable ?? null;
}

export function countByStatus(entries: GameEntry[]): Record<StatusFilter, number> {
  return {
    all: entries.length,
    ready: entries.filter(entry => STATUS_FILTER_MATCH.ready(entry.status)).length,
    locked: entries.filter(entry => STATUS_FILTER_MATCH.locked(entry.status)).length,
    'coming-soon': entries.filter(entry =>
      STATUS_FILTER_MATCH['coming-soon'](entry.status)
    ).length,
  };
}

export function listCategories(entries: GameEntry[]): GameCategory[] {
  const seen = new Set<GameCategory>();
  entries.forEach(entry => {
    if (entry.game.category) seen.add(entry.game.category);
  });
  return Array.from(seen).sort((a, b) => a.localeCompare(b));
}
