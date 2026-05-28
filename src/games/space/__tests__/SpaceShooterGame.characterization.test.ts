// Characterization tests for SpaceShooterGame.
//
// Pins the CURRENT observable GameModule surface ahead of a refactor. Only
// stable, deterministic facts are asserted: manifest, no-throw update/render,
// score shape, and lifecycle hooks. SpaceShooterGame triggers its actual
// game-over via setTimeout after a ship death, which is not reachable from the
// public surface without simulating collisions/input, so game-over-true is NOT
// asserted here (see report note).

import { SpaceShooterGame } from '@/games/space/SpaceShooterGame';
import { initGame, step, type Harness } from '@/games/shared/gameTestHarness';

let randomSpy: jest.SpyInstance;
beforeEach(() => {
  randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.42);
});
afterEach(() => {
  randomSpy.mockRestore();
});

function newHarness(): Harness {
  return initGame(new SpaceShooterGame());
}

describe('SpaceShooterGame characterization', () => {
  describe('manifest', () => {
    test('exposes stable identifying fields', () => {
      const game = new SpaceShooterGame();
      expect(game.manifest.id).toBe('space');
      expect(game.manifest.title).toBe('Space Shooter');
      expect(game.manifest.tier).toBe(2);
      expect(game.manifest.inputSchema).toEqual(['keyboard']);
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
      expect(h.services.analytics.trackGameStart).toHaveBeenCalledWith('space');
    });
  });

  describe('initial state', () => {
    test('isGameOver() is false at start', () => {
      const h = newHarness();
      expect(h.game.isGameOver?.()).toBe(false);
    });

    test('getScore() returns the GameScore shape with zeroed score', () => {
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

    test('remains not-game-over after stepping with no input', () => {
      const h = newHarness();
      step(h, 300);
      expect(h.game.isGameOver?.()).toBe(false);
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
