// Characterization tests for PlatformGame (Crystal Caverns).
//
// These pin the CURRENT observable behavior of the GameModule public surface so
// an upcoming refactor can be proven behavior-preserving. They intentionally
// assert only stable, deterministic facts (manifest, no-throw update/render
// loop, score shape, lifecycle hooks) and NOT pixel output or private state.

import { PlatformGame } from '@/games/platform-adventure/PlatformGame';
import { initGame, step, type Harness } from '@/games/shared/gameTestHarness';

// Make all randomness deterministic so repeated runs are identical.
let randomSpy: jest.SpyInstance;
beforeEach(() => {
  randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.42);
});
afterEach(() => {
  randomSpy.mockRestore();
});

function newHarness(): Harness {
  return initGame(new PlatformGame());
}

describe('PlatformGame characterization', () => {
  describe('manifest', () => {
    test('exposes stable identifying fields', () => {
      const game = new PlatformGame();
      expect(game.manifest.id).toBe('platform-adventure');
      expect(game.manifest.title).toBe('Crystal Caverns');
      expect(game.manifest.tier).toBe(2);
      expect(game.manifest.inputSchema).toEqual(['keyboard', 'touch']);
      expect(game.manifest.assetBudgetKB).toBeLessThanOrEqual(300);
    });
  });

  describe('construction + init', () => {
    test('init(canvas, services) does not throw', () => {
      expect(() => newHarness()).not.toThrow();
    });

    test('canvas is sized to the configured game resolution', () => {
      const h = newHarness();
      expect(h.canvas.width).toBe(800);
      expect(h.canvas.height).toBe(600);
    });

    test('trackGameStart is reported to analytics on init', () => {
      const h = newHarness();
      expect(h.services.analytics.trackGameStart).toHaveBeenCalledWith('platform-adventure');
    });
  });

  describe('initial state', () => {
    test('isGameOver() is false at start', () => {
      const h = newHarness();
      expect(h.game.isGameOver?.()).toBe(false);
    });

    test('getScore() returns the GameScore shape with zeroed counters', () => {
      const h = newHarness();
      const s = h.game.getScore!();
      expect(s).toEqual(
        expect.objectContaining({
          score: 0,
          pickups: 0,
          coinsEarned: expect.any(Number),
          timePlayedMs: expect.any(Number),
        }),
      );
      expect(s.score).toBe(0);
      expect(s.pickups).toBe(0);
    });
  });

  describe('update/render loop', () => {
    test('stepping 120 frames at fixed dt does not throw', () => {
      const h = newHarness();
      expect(() => step(h, 120)).not.toThrow();
    });

    test('render(ctx) is safe to call before any update', () => {
      const h = newHarness();
      expect(() => h.game.render(h.ctx)).not.toThrow();
    });

    test('remains not-game-over after stepping with no input', () => {
      const h = newHarness();
      step(h, 300);
      expect(h.game.isGameOver?.()).toBe(false);
    });
  });

  describe('lifecycle hooks', () => {
    test('pause()/resume() do not throw and update is a no-op while paused', () => {
      const h = newHarness();
      h.game.pause?.();
      expect(() => step(h, 30)).not.toThrow();
      h.game.resume?.();
      expect(() => step(h, 30)).not.toThrow();
      expect(h.game.isGameOver?.()).toBe(false);
    });

    test('resize() does not throw and applies new dimensions', () => {
      const h = newHarness();
      expect(() => h.game.resize?.(1024, 768)).not.toThrow();
      expect(h.canvas.width).toBe(1024);
      expect(h.canvas.height).toBe(768);
    });

    test('restart() does not throw and keeps the game running with zeroed score', () => {
      const h = newHarness();
      step(h, 60);
      expect(() => h.game.restart?.()).not.toThrow();
      expect(h.game.isGameOver?.()).toBe(false);
      expect(h.game.getScore!().score).toBe(0);
    });

    test('destroy() does not throw and ends the running game', () => {
      const h = newHarness();
      expect(() => h.game.destroy?.()).not.toThrow();
      expect(h.game.isGameOver?.()).toBe(true);
    });
  });
});
