// Characterization tests for FrogHopGame.
//
// Pins the CURRENT observable GameModule surface ahead of a refactor. Asserts
// only stable, deterministic facts: manifest, no-throw update/render, score
// shape, lifecycle hooks, and the timeout->lives->game-over transition driven
// deterministically via fake timers.

import { FrogHopGame } from '@/games/frog-hop/FrogHopGame';
import { initGame, step, type Harness } from '@/games/shared/gameTestHarness';

let randomSpy: jest.SpyInstance;
beforeEach(() => {
  randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.42);
});
afterEach(() => {
  randomSpy.mockRestore();
});

function newHarness(): Harness {
  return initGame(new FrogHopGame());
}

describe('FrogHopGame characterization', () => {
  describe('manifest', () => {
    test('exposes stable identifying fields', () => {
      const game = new FrogHopGame();
      expect(game.manifest.id).toBe('frog-hop');
      expect(game.manifest.title).toBe('Frog Hop');
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
      expect(h.services.analytics.trackGameStart).toHaveBeenCalledWith('frog-hop');
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

    test('remains not-game-over within a single round timer window', () => {
      const h = newHarness();
      // Well under one 30s round timer (frames clamp dt to ~33ms).
      step(h, 300);
      expect(h.game.isGameOver?.()).toBe(false);
    });
  });

  describe('game-over transition (timer exhaustion)', () => {
    test('runs out of lives via timeouts and flips isGameOver()', () => {
      jest.useFakeTimers();
      try {
        const h = newHarness();
        // dt of 0.05s -> clamped to 0.033s -> 33ms per frame. The 30000ms
        // round timer drains in ~910 frames; loop with generous bound and
        // flush the death/respawn setTimeouts between phases.
        let guard = 0;
        while (h.game.isGameOver?.() === false && guard < 20000) {
          h.game.update(0.05);
          // Advance any pending death/respawn timers so lives decrement and
          // state cycles back to 'playing'.
          jest.runOnlyPendingTimers();
          guard++;
        }
        expect(h.game.isGameOver?.()).toBe(true);
        // Coins are awarded exactly once on the terminal endGame().
        expect(h.services.currency.addCoins).toHaveBeenCalled();
      } finally {
        jest.clearAllTimers();
        jest.useRealTimers();
      }
    });
  });

  describe('lifecycle hooks', () => {
    test('pause()/resume() do not throw', () => {
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
