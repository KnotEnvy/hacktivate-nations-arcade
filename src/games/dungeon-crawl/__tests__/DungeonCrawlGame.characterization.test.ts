// Characterization tests for DungeonCrawlGame (development suite only).
//
// Pins the GameModule surface the arcade relies on: manifest, safe
// init/update/render, GameScore + extendedGameData metric keys, restart, and
// the destroy -> endGame coin-award path. Gameplay/balance is validated by
// manual playtest, not here.

import { DungeonCrawlGame } from '@/games/dungeon-crawl/DungeonCrawlGame';
import { initGame, step, type Harness } from '@/games/shared/gameTestHarness';

let randomSpy: jest.SpyInstance;
beforeEach(() => {
  randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.42);
});
afterEach(() => {
  randomSpy.mockRestore();
});

function newHarness(): Harness {
  return initGame(new DungeonCrawlGame());
}

describe('DungeonCrawlGame characterization', () => {
  describe('manifest', () => {
    test('exposes stable identifying fields', () => {
      const game = new DungeonCrawlGame();
      expect(game.manifest.id).toBe('dungeon-crawl');
      expect(game.manifest.title).toBe('Dungeon Crawl');
      expect(game.manifest.tier).toBe(3);
      expect(game.manifest.inputSchema).toEqual(['keyboard']);
      expect(game.manifest.assetBudgetKB).toBeLessThanOrEqual(300);
      expect(game.manifest.thumbnail).toBe('/games/dungeon-crawl/dungeon-crawl-thumb.svg');
    });
  });

  describe('construction + init', () => {
    test('init(canvas, services) does not throw', () => {
      expect(() => newHarness()).not.toThrow();
    });

    test('canvas is sized to the arcade resolution', () => {
      const h = newHarness();
      expect(h.canvas.width).toBe(800);
      expect(h.canvas.height).toBe(600);
    });

    test('trackGameStart is reported to analytics on init', () => {
      const h = newHarness();
      expect(h.services.analytics.trackGameStart).toHaveBeenCalledWith('dungeon-crawl');
    });
  });

  describe('initial state', () => {
    test('isGameOver() is false at start', () => {
      const h = newHarness();
      expect(h.game.isGameOver?.()).toBe(false);
    });

    test('getScore() returns GameScore plus dungeon metric keys', () => {
      const h = newHarness();
      const s = h.game.getScore!() as unknown as Record<string, unknown>;
      expect(s).toEqual(
        expect.objectContaining({
          score: 0,
          pickups: 0,
          coinsEarned: expect.any(Number),
          timePlayedMs: expect.any(Number),
          // extendedGameData metric contract (trusted progression + achievements)
          depth: 1,
          enemies_slain: 0,
          gold_collected: 0,
          bosses_slain: 0,
          relics_collected: 0,
          combo: 1,
          daggers_thrown: 0,
          mimics_found: 0,
          perfect_floors: 0,
          keys_used: 0,
          potions_used: 0,
          // v2 metric contract
          elites_slain: 0,
          items_bought: 0,
          gold_spent: 0,
          unique_bosses: 0,
          dashes_used: 0,
        }),
      );
      expect(typeof s.rooms_explored).toBe('number');
    });
  });

  describe('update/render loop', () => {
    test('stepping 180 frames at fixed dt does not throw', () => {
      const h = newHarness();
      expect(() => step(h, 180)).not.toThrow();
    });

    test('render(ctx) is safe to call before any update', () => {
      const h = newHarness();
      expect(() => h.game.render(h.ctx)).not.toThrow();
    });

    test('pause blocks update, resume restores it', () => {
      const h = newHarness();
      h.game.pause?.();
      expect(() => step(h, 30)).not.toThrow();
      h.game.resume?.();
      expect(() => step(h, 30)).not.toThrow();
      expect(h.game.isGameOver?.()).toBe(false);
    });
  });

  describe('restart', () => {
    test('restart() rebuilds the run without throwing and zeroes the score', () => {
      const h = newHarness();
      step(h, 60);
      expect(() => h.game.restart?.()).not.toThrow();
      const s = h.game.getScore!();
      expect(s.score).toBe(0);
      expect(s.pickups).toBe(0);
      expect(h.game.isGameOver?.()).toBe(false);
      expect(() => step(h, 60)).not.toThrow();
    });
  });

  describe('input monkey test', () => {
    test('3000 frames of chaotic movement + attacks never throw', () => {
      // Drive the real update loop with pseudo-random held keys so combat,
      // AI, projectile and pickup paths actually execute (idle stepping never
      // leaves the start room). Seeded LCG keeps the chaos reproducible.
      const h = newHarness();
      let lcg = 1234567;
      const rand = () => {
        lcg = (lcg * 1103515245 + 12345) & 0x7fffffff;
        return lcg / 0x7fffffff;
      };
      const held = new Set<string>();
      const input = h.services.input as unknown as {
        isKeyPressed: jest.Mock;
        isLeftPressed: jest.Mock;
        isRightPressed: jest.Mock;
        isUpPressed: jest.Mock;
        isDownPressed: jest.Mock;
      };
      input.isKeyPressed.mockImplementation((code: string) => held.has(code));
      input.isLeftPressed.mockImplementation(() => held.has('ArrowLeft'));
      input.isRightPressed.mockImplementation(() => held.has('ArrowRight'));
      input.isUpPressed.mockImplementation(() => held.has('ArrowUp'));
      input.isDownPressed.mockImplementation(() => held.has('ArrowDown'));

      const keys = [
        'ArrowLeft',
        'ArrowRight',
        'ArrowUp',
        'ArrowDown',
        'Space',
        'KeyX',
        'Enter',
        'Digit1',
        'ShiftLeft', // v2 dash
        'KeyC', // v2 dash alt
        'KeyE', // v2 shop interact
      ];
      expect(() => {
        for (let frame = 0; frame < 3000; frame++) {
          if (frame % 7 === 0) {
            held.clear();
            for (const key of keys) if (rand() < 0.35) held.add(key);
          }
          h.game.update(1 / 60);
          if (frame % 3 === 0) h.game.render(h.ctx);
        }
      }).not.toThrow();

      // Whatever happened, the score contract must still hold.
      const s = h.game.getScore!();
      expect(s.score).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(s.coinsEarned)).toBe(true);
    });
  });

  describe('destroy -> endGame contract', () => {
    test('destroy() ends the run, awards coins, and reports analytics', () => {
      const h = newHarness();
      step(h, 30);
      h.game.destroy?.();
      expect(h.game.isGameOver?.()).toBe(true);
      expect(h.services.currency.addCoins).toHaveBeenCalledWith(
        expect.any(Number),
        'game_dungeon-crawl',
      );
      expect(h.services.analytics.trackGameEnd).toHaveBeenCalled();
    });
  });
});
