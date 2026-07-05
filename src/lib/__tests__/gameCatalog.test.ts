import { AVAILABLE_GAMES } from '@/data/Games';
import {
  COMING_SOON_GAME_CATALOG,
  PLAYABLE_GAME_CATALOG,
  getImplementedGamesInTier,
  hasImplementedGamesInTier,
  isGameImplemented,
  sanitizeUnlockedGameIds,
} from '@/lib/gameCatalog';

describe('gameCatalog', () => {
  describe('isGameImplemented', () => {
    test('returns true for registered games', () => {
      expect(isGameImplemented('runner')).toBe(true);
      expect(isGameImplemented('snake')).toBe(true);
      expect(isGameImplemented('speed-racer')).toBe(true);
    });

    test('returns false for catalog games that are not registered (coming soon)', () => {
      expect(isGameImplemented('target-shooter')).toBe(false);
      expect(isGameImplemented('rhythm-challenge')).toBe(false);
    });

    test('returns false for completely unknown ids', () => {
      expect(isGameImplemented('not-a-real-game')).toBe(false);
      expect(isGameImplemented('')).toBe(false);
    });
  });

  describe('PLAYABLE_GAME_CATALOG / COMING_SOON_GAME_CATALOG partition', () => {
    test('every playable game is implemented', () => {
      PLAYABLE_GAME_CATALOG.forEach(game => {
        expect(isGameImplemented(game.id)).toBe(true);
      });
    });

    test('every coming-soon game is not implemented', () => {
      COMING_SOON_GAME_CATALOG.forEach(game => {
        expect(isGameImplemented(game.id)).toBe(false);
      });
    });

    test('the two catalogs are a complete, disjoint partition of AVAILABLE_GAMES', () => {
      expect(PLAYABLE_GAME_CATALOG.length + COMING_SOON_GAME_CATALOG.length).toBe(
        AVAILABLE_GAMES.length
      );

      const playableIds = new Set(PLAYABLE_GAME_CATALOG.map(g => g.id));
      const comingSoonIds = new Set(COMING_SOON_GAME_CATALOG.map(g => g.id));

      // Disjoint
      playableIds.forEach(id => expect(comingSoonIds.has(id)).toBe(false));

      // Union covers all
      const unionIds = new Set([...playableIds, ...comingSoonIds]);
      AVAILABLE_GAMES.forEach(g => expect(unionIds.has(g.id)).toBe(true));
    });

    test('playable catalog contains the default game', () => {
      expect(PLAYABLE_GAME_CATALOG.some(g => g.id === 'runner')).toBe(true);
    });
  });

  describe('getImplementedGamesInTier', () => {
    test('returns only implemented games of the given tier', () => {
      const tier0 = getImplementedGamesInTier(0);
      tier0.forEach(game => {
        expect(game.tier).toBe(0);
        expect(isGameImplemented(game.id)).toBe(true);
      });
      expect(tier0.some(g => g.id === 'runner')).toBe(true);
    });

    test('returns empty array for a tier with no implemented games', () => {
      // Tier 4 is all coming-soon per the registry (tier 3 shipped dungeon-crawl)
      expect(getImplementedGamesInTier(4)).toEqual([]);
    });

    test('returns empty array for a non-existent tier', () => {
      expect(getImplementedGamesInTier(99)).toEqual([]);
    });

    test('is a subset of PLAYABLE_GAME_CATALOG', () => {
      const playableIds = new Set(PLAYABLE_GAME_CATALOG.map(g => g.id));
      getImplementedGamesInTier(1).forEach(g => {
        expect(playableIds.has(g.id)).toBe(true);
      });
    });
  });

  describe('hasImplementedGamesInTier', () => {
    test('true for tiers that contain implemented games', () => {
      expect(hasImplementedGamesInTier(0)).toBe(true);
      expect(hasImplementedGamesInTier(1)).toBe(true);
      expect(hasImplementedGamesInTier(2)).toBe(true);
      expect(hasImplementedGamesInTier(3)).toBe(true);
    });

    test('false for tiers without implemented games', () => {
      expect(hasImplementedGamesInTier(4)).toBe(false);
      expect(hasImplementedGamesInTier(99)).toBe(false);
    });
  });

  describe('sanitizeUnlockedGameIds', () => {
    test('removes unimplemented ids', () => {
      const result = sanitizeUnlockedGameIds(['runner', 'target-shooter', 'snake']);
      expect(result).toEqual(['runner', 'snake']);
    });

    test('removes unknown ids', () => {
      expect(sanitizeUnlockedGameIds(['runner', 'bogus-id'])).toEqual(['runner']);
    });

    test('deduplicates while keeping first-seen order', () => {
      expect(sanitizeUnlockedGameIds(['runner', 'snake', 'runner'])).toEqual([
        'runner',
        'snake',
      ]);
    });

    test('returns empty array for empty input', () => {
      expect(sanitizeUnlockedGameIds([])).toEqual([]);
    });

    test('returns empty array when nothing is implemented', () => {
      expect(sanitizeUnlockedGameIds(['target-shooter', 'bogus'])).toEqual([]);
    });

    test('only returns implemented ids', () => {
      const result = sanitizeUnlockedGameIds(AVAILABLE_GAMES.map(g => g.id));
      result.forEach(id => expect(isGameImplemented(id)).toBe(true));
    });
  });
});
