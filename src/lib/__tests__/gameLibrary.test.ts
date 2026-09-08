import {
  EMPTY_FILTERS,
  buildGameEntries,
  countByStatus,
  filterEntries,
  groupByTier,
  listCategories,
  pickFeatured,
  sortEntries,
} from '@/lib/gameLibrary';
import { getTierUnlockCost } from '@/lib/unlocks';
import type { GameManifest } from '@/lib/types';

// Registry-backed ids so `isGameImplemented` resolves deterministically:
// runner/snake are registered tier-0 games, space is a registered tier-2 game,
// and ice-hockey is a catalog-only entry.
const game = (overrides: Partial<GameManifest> & { id: string }): GameManifest => ({
  title: overrides.id,
  thumbnail: `/games/${overrides.id}/thumb.svg`,
  inputSchema: ['keyboard'],
  assetBudgetKB: 60,
  tier: 0,
  ...overrides,
});

const RUNNER = game({ id: 'runner', title: 'Endless Runner', tier: 0, category: 'Action' });
const SNAKE = game({ id: 'snake', title: 'Snake', tier: 0, category: 'Arcade' });
const SPACE = game({ id: 'space', title: 'Space Shooter', tier: 2, category: 'Shooter' });
const ICE = game({ id: 'ice-hockey', title: 'Ice Hockey', tier: 3, category: 'Sports' });
const MINESWEEPER = game({ id: 'minesweeper', title: 'Minesweeper', tier: 0, category: 'Puzzle' });

const CATALOG = [RUNNER, SNAKE, SPACE, ICE];

const statusFor = (
  id: string,
  state: Parameters<typeof buildGameEntries>[1]
): string | undefined =>
  buildGameEntries(CATALOG, state).find(entry => entry.game.id === id)?.status;

describe('buildGameEntries', () => {
  const base = { unlockedTiers: [0], unlockedGames: [] as string[], currentCoins: 0 };

  it('treats the default-unlocked game as playable', () => {
    expect(statusFor('runner', base)).toBe('playable');
  });

  it('treats an unregistered catalog entry as coming soon regardless of tier state', () => {
    expect(statusFor('ice-hockey', { ...base, unlockedTiers: [0, 3] })).toBe(
      'coming-soon'
    );
  });

  it('marks games in a locked tier as tier-locked', () => {
    expect(statusFor('space', base)).toBe('tier-locked');
  });

  it('separates affordable from unaffordable inside an open tier', () => {
    const openTier2 = { ...base, unlockedTiers: [0, 2] };
    expect(statusFor('space', { ...openTier2, currentCoins: 0 })).toBe('short');
    expect(statusFor('space', { ...openTier2, currentCoins: 5000 })).toBe('affordable');
  });

  it('marks a purchased game as playable', () => {
    expect(
      statusFor('space', { unlockedTiers: [0, 2], unlockedGames: ['space'], currentCoins: 0 })
    ).toBe('playable');
  });

  it('prices the next tier-0 game from how many are already owned', () => {
    const tier0 = [RUNNER, SNAKE, MINESWEEPER];
    const first = buildGameEntries(tier0, base);
    // Tier 0's increment is 100 and runner is free, so the first paid unlock is 100.
    expect(first.find(entry => entry.game.id === 'snake')?.unlockCost).toBe(100);
    expect(first.find(entry => entry.game.id === 'minesweeper')?.unlockCost).toBe(100);

    const afterOne = buildGameEntries(tier0, { ...base, unlockedGames: ['snake'] });
    // With one paid tier-0 unlock owned, the next one costs 200.
    expect(afterOne.find(entry => entry.game.id === 'minesweeper')?.unlockCost).toBe(200);
  });

  it('carries play history onto the entry', () => {
    const entries = buildGameEntries(CATALOG, {
      ...base,
      activity: { runner: { plays: 4, lastPlayed: 1234 } },
    });
    const runner = entries.find(entry => entry.game.id === 'runner');
    expect(runner?.plays).toBe(4);
    expect(runner?.lastPlayed).toBe(1234);
  });
});

describe('filtering and sorting', () => {
  const entries = buildGameEntries(CATALOG, {
    unlockedTiers: [0, 2],
    unlockedGames: ['space'],
    currentCoins: 100,
  });

  it('counts entries per status filter', () => {
    const counts = countByStatus(entries);
    expect(counts.all).toBe(4);
    expect(counts.ready).toBe(2); // runner + space
    expect(counts.locked).toBe(1); // snake, affordable at 100
    expect(counts['coming-soon']).toBe(1);
  });

  it('matches search across title, id, category and tagline', () => {
    expect(
      filterEntries(entries, { ...EMPTY_FILTERS, search: 'shooter' }).map(e => e.game.id)
    ).toEqual(['space']);
    expect(
      filterEntries(entries, { ...EMPTY_FILTERS, search: 'ice-hockey' }).map(e => e.game.id)
    ).toEqual(['ice-hockey']);
  });

  it('ignores case and surrounding whitespace in the search term', () => {
    expect(
      filterEntries(entries, { ...EMPTY_FILTERS, search: '  SNAKE ' }).map(e => e.game.id)
    ).toEqual(['snake']);
  });

  it('filters by category', () => {
    expect(
      filterEntries(entries, { ...EMPTY_FILTERS, category: 'Arcade' }).map(e => e.game.id)
    ).toEqual(['snake']);
  });

  it('filters by status', () => {
    expect(
      filterEntries(entries, { ...EMPTY_FILTERS, status: 'ready' })
        .map(e => e.game.id)
        .sort()
    ).toEqual(['runner', 'space']);
  });

  it('sorts the most actionable entries first, then alphabetically', () => {
    expect(sortEntries(entries).map(e => e.game.id)).toEqual([
      'runner', // playable, "Endless Runner"
      'space', // playable, "Space Shooter"
      'snake', // affordable
      'ice-hockey', // coming soon
    ]);
  });

  it('lists only the categories present in the catalog', () => {
    expect(listCategories(entries)).toEqual(['Action', 'Arcade', 'Shooter', 'Sports']);
  });
});

describe('groupByTier', () => {
  const state = { unlockedTiers: [0], unlockedGames: [] as string[] };
  const entries = buildGameEntries(CATALOG, { ...state, currentCoins: 0 });

  it('groups by tier and reports per-tier unlock progress', () => {
    const groups = groupByTier(entries, entries, state, getTierUnlockCost);
    expect(groups.map(group => group.tier)).toEqual([0, 2, 3]);

    const tier0 = groups[0];
    expect(tier0.unlocked).toBe(true);
    expect(tier0.ownedCount).toBe(1); // runner
    expect(tier0.releasedCount).toBe(2); // runner + snake

    const tier3 = groups[2];
    // Ice hockey is catalog-only, so tier 3 has nothing purchasable.
    expect(tier3.hasReleasedGames).toBe(false);
    expect(tier3.unlocked).toBe(false);
  });

  it('drops tiers with no matching entries but keeps their unlock costs accurate', () => {
    const filtered = filterEntries(entries, { ...EMPTY_FILTERS, search: 'space' });
    const groups = groupByTier(filtered, entries, state, getTierUnlockCost);
    expect(groups.map(group => group.tier)).toEqual([2]);
    expect(groups[0].tierCost).toBe(getTierUnlockCost(2));
  });
});

describe('pickFeatured', () => {
  const state = { unlockedTiers: [0, 2], unlockedGames: ['space'], currentCoins: 0 };

  it('prefers the most recently played unlocked game', () => {
    const entries = buildGameEntries(CATALOG, {
      ...state,
      activity: {
        runner: { plays: 9, lastPlayed: 1000 },
        space: { plays: 1, lastPlayed: 9000 },
      },
    });
    expect(pickFeatured(entries)?.game.id).toBe('space');
  });

  it('falls back to an unlocked game the player has not tried', () => {
    const entries = buildGameEntries(CATALOG, state);
    expect(pickFeatured(entries)?.game.id).toBe('runner');
  });

  it('falls back to the cheapest affordable unlock when nothing is playable', () => {
    // Nothing owned and tier 2 open with enough coins for the tier-2 game.
    const entries = buildGameEntries([SPACE, ICE], {
      unlockedTiers: [0, 2],
      unlockedGames: [],
      currentCoins: 999_999,
    });
    expect(pickFeatured(entries)?.game.id).toBe('space');
  });

  it('returns null when there is nothing to play or buy', () => {
    const entries = buildGameEntries([ICE], {
      unlockedTiers: [0],
      unlockedGames: [],
      currentCoins: 0,
    });
    expect(pickFeatured(entries)).toBeNull();
  });
});
