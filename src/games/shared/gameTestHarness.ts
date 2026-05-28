// Shared characterization-test harness for game modules.
//
// These helpers build a deterministic fake canvas + stub Services so that a
// GameModule can be constructed, init'd, stepped and rendered without touching
// real browser APIs. Canvas 2D, Web Audio and localStorage are already mocked
// globally in jest.setup.ts; this harness only provides the Services shape and
// driving utilities that the games consume.

import type { GameModule } from '@/games/shared/GameModule';
import type { Services, GameScore } from '@/lib/types';

/**
 * Builds a jsdom-backed canvas. jest.setup.ts mocks getContext('2d') to return
 * a shared stub context, so this is enough for init()/render().
 */
export function makeCanvas(width = 800, height = 600): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

/**
 * The 2d context games will draw into. jest.setup.ts mocks getContext('2d')
 * with a shared stub that lacks the gradient/pattern factory methods, so we
 * augment the returned object here (test-local, never touches global setup).
 */
export function makeCtx(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d')! as unknown as Record<string, unknown>;

  // Some games read ctx.canvas directly (e.g. PlatformGame.renderMenu). The
  // jest.setup.ts mock context is detached, so wire it to this canvas.
  ctx.canvas = canvas;

  const gradient = { addColorStop: jest.fn() };
  const ensure = (name: string, impl: () => unknown) => {
    if (typeof ctx[name] !== 'function') ctx[name] = impl;
  };

  ensure('strokeRect', jest.fn());
  ensure('strokeText', jest.fn());
  ensure('createLinearGradient', jest.fn(() => gradient));
  ensure('createRadialGradient', jest.fn(() => gradient));
  ensure('createConicGradient', jest.fn(() => gradient));
  ensure('createPattern', jest.fn(() => null));
  ensure('ellipse', jest.fn());
  ensure('roundRect', jest.fn());
  ensure('setLineDash', jest.fn());
  ensure('getLineDash', jest.fn(() => []));
  ensure('quadraticCurveTo', jest.fn());
  ensure('bezierCurveTo', jest.fn());
  ensure('arcTo', jest.fn());

  return ctx as unknown as CanvasRenderingContext2D;
}

/**
 * A fully stubbed Services object. Every method games are known to call is a
 * jest.fn so calls are recorded and never throw. Currency methods return stable
 * deterministic values so scoring is reproducible.
 */
export function makeStubServices(): Services {
  const services = {
    input: {
      isKeyPressed: jest.fn(() => false),
      isMousePressed: jest.fn(() => false),
      isMouseDown: jest.fn(() => false),
      getMousePosition: jest.fn(() => ({ x: 0, y: 0 })),
      getTouches: jest.fn(() => []),
      isTouchActive: jest.fn(() => false),
      isActionPressed: jest.fn(() => false),
      isLeftPressed: jest.fn(() => false),
      isRightPressed: jest.fn(() => false),
      isUpPressed: jest.fn(() => false),
      isDownPressed: jest.fn(() => false),
      init: jest.fn(),
      destroy: jest.fn(),
    },
    audio: {
      playSound: jest.fn(),
      playMusic: jest.fn(),
      stopMusic: jest.fn(),
      stopSound: jest.fn(),
      setMasterVolume: jest.fn(),
      resumeContext: jest.fn(() => Promise.resolve()),
    },
    analytics: {
      trackGameStart: jest.fn(),
      trackGameEnd: jest.fn(),
      trackCurrencyTransaction: jest.fn(),
      trackFeatureUsage: jest.fn(),
      trackGameSpecificStat: jest.fn(),
      trackEvent: jest.fn(),
    },
    currency: {
      // Deterministic, stable reward math so getScore() is reproducible.
      getBonusMultiplier: jest.fn(() => 1),
      calculateGameReward: jest.fn(
        (score: number, pickups: number) => Math.floor(score / 100) + pickups,
      ),
      addCoins: jest.fn(),
      spendCoins: jest.fn(() => true),
      getCurrentCoins: jest.fn(() => 0),
    },
    achievements: {
      trackGameSpecificStat: jest.fn(),
      unlockAchievement: jest.fn(),
      getUnlockedAchievements: jest.fn(() => []),
    },
  };

  // Cast through unknown: the real service classes have many more members, but
  // games only ever touch the subset stubbed above (all via optional chaining
  // or the BaseGame contract).
  return services as unknown as Services;
}

export interface Harness {
  game: GameModule;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  services: Services;
}

/**
 * Constructs and init()s a game. Returns the wired-up harness.
 */
export function initGame(game: GameModule): Harness {
  const canvas = makeCanvas();
  const ctx = makeCtx(canvas);
  const services = makeStubServices();
  game.init(canvas, services);
  return { game, canvas, ctx, services };
}

/**
 * Drives update(dt) then render(ctx) for `frames` iterations at fixed dt.
 * Default dt = 1/60s, matching the game loop's target frame time.
 */
export function step(h: Harness, frames: number, dt = 1 / 60): void {
  for (let i = 0; i < frames; i++) {
    h.game.update(dt);
    h.game.render(h.ctx);
  }
}

/** Convenience: read getScore() if implemented, else undefined. */
export function score(h: Harness): GameScore | undefined {
  return h.game.getScore?.();
}
