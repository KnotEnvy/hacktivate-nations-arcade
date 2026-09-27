'use client';

// DEV-ONLY visual capture harness for ANY registered game.
//
// Why this exists: jest.setup.ts stubs getContext('2d'), so unit tests record
// draw CALLS and never produce pixels. Judging how a game LOOKS means real
// rendering in a real browser at the real canvas size. This component mounts
// a game from the registry by id (`?game=snake`) and exposes a scripted
// control surface on `window.__gc` for Playwright to drive: step the sim by
// frames, press keys, click, tap, long-press, swipe, and reach into the
// game's internals to jump to a scene.
//
// It is reachable only through src/app/dev/game/page.tsx, which
// scripts/sync-dev-routes.js DELETES before type-check, lint and build. It
// can never reach production.
//
// Run: npx playwright test tier0-capture --project=chromium
//      (CAPTURE_GAMES=snake,memory to limit which games are captured)

import { useEffect, useRef, useState } from 'react';
import { GAME_CONFIG } from '@/lib/constants';
import { gameLoader } from '@/games/registry';
import type { GameModule, Services } from '@/lib/types';

/** Deterministic PRNG so round N and round N+1 are pixel-comparable. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface FakeInputState {
  held: Set<string>;
  mouse: { x: number; y: number };
  buttons: Set<number>;
  touches: Array<{ id: number; x: number; y: number }>;
}

/** Every Services method a game touches, as a no-op or a stateful fake. */
function makeCaptureServices(state: FakeInputState): Services {
  const noop = () => {};
  const arrows = {
    left: ['ArrowLeft', 'KeyA'],
    right: ['ArrowRight', 'KeyD'],
    up: ['ArrowUp', 'KeyW'],
    down: ['ArrowDown', 'KeyS'],
  };
  const any = (codes: string[]) => codes.some(c => state.held.has(c));
  return {
    input: {
      isKeyPressed: (code: string) => state.held.has(code),
      isMousePressed: (button = 0) => state.buttons.has(button),
      isMouseDown: (button = 0) => state.buttons.has(button),
      getMousePosition: () => ({ ...state.mouse }),
      getTouches: () => state.touches.map(t => ({ ...t })),
      isTouchActive: () => state.touches.length > 0,
      isActionPressed: () =>
        state.held.has('Space') ||
        state.held.has('Enter') ||
        state.buttons.has(0) ||
        state.touches.length > 0,
      isLeftPressed: () => any(arrows.left),
      isRightPressed: () => any(arrows.right),
      isUpPressed: () => any(arrows.up),
      isDownPressed: () => any(arrows.down),
      init: noop,
      destroy: noop,
    },
    audio: {
      playSound: noop,
      playMusic: noop,
      stopMusic: noop,
      stopSound: noop,
      playGameMusic: noop,
      setMusicIntensity: noop,
      setMasterVolume: noop,
      resumeContext: () => Promise.resolve(),
    },
    analytics: {
      trackGameStart: noop,
      trackGameEnd: noop,
      trackCurrencyTransaction: noop,
      trackFeatureUsage: noop,
      trackGameSpecificStat: noop,
      trackEvent: noop,
    },
    currency: {
      getBonusMultiplier: () => 1,
      calculateGameReward: (score: number, pickups: number) =>
        Math.floor(score / 100) + pickups * 10,
      addCoins: noop,
      spendCoins: () => true,
      getCurrentCoins: () => 0,
    },
    achievements: {
      trackGameSpecificStat: noop,
      unlockAchievement: noop,
      getUnlockedAchievements: () => [],
    },
  } as unknown as Services;
}

export interface GameCaptureControl {
  ready: boolean;
  gameId: string;
  /** Advance the sim `frames` times at `dt` seconds each, rendering each. */
  step(frames: number, dt?: number): void;
  /** Hold a key for `frames`, release, settle two frames. */
  press(code: string, frames?: number): void;
  hold(code: string): void;
  release(code: string): void;
  /** Move the mouse (canvas coordinates). */
  mouseMove(x: number, y: number): void;
  mouseDown(x: number, y: number, button?: number): void;
  mouseUp(button?: number): void;
  /** Press and release the mouse at (x, y), holding for `frames`. */
  click(x: number, y: number, button?: number, frames?: number): void;
  touchStart(x: number, y: number): void;
  touchMove(x: number, y: number): void;
  touchEnd(): void;
  /** A finger tap at (x, y) held for `frames`. */
  tap(x: number, y: number, frames?: number): void;
  /** A finger held still at (x, y) for `frames` (for long-press flags). */
  longPress(x: number, y: number, frames?: number): void;
  /** A finger swipe from (x, y) by (dx, dy) over `frames`. */
  swipe(x: number, y: number, dx: number, dy: number, frames?: number): void;
  /** The live game object, for scene jumps through its private fields. */
  game(): unknown;
  /** `gameState` if the game has one, else 'unknown'. */
  state(): string;
  score(): number;
  isOver(): boolean;
  restart(): void;
  setAuto(on: boolean): void;
  /** Blit a magnified crop of the last frame into the loupe canvas. */
  loupe(x: number, y: number, w: number, h: number): void;
}

declare global {
  interface Window {
    __gc?: GameCaptureControl;
  }
}

export default function GameCapture() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const loupeRef = useRef<HTMLCanvasElement | null>(null);
  const [status, setStatus] = useState('booting…');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const params = new URLSearchParams(window.location.search);
    const gameId = params.get('game') ?? 'snake';
    const seed = Number(params.get('seed') ?? '1337');

    let cancelled = false;
    let raf = 0;
    let game: GameModule | null = null;
    let restoreGlobals: (() => void) | null = null;

    (async () => {
      const loaded = await gameLoader.loadGame(gameId);
      if (cancelled || !loaded) {
        setStatus(`no such game: ${gameId}`);
        return;
      }
      game = loaded;

      // Deterministic RNG BEFORE init — spawn rolls, shuffles and particle
      // jitter all read Math.random.
      const rand = mulberry32(seed);
      const realRandom = Math.random;
      Math.random = rand;

      // Some renderers still animate off Date.now(). Pin it, but let it
      // advance with the sim so those animations are not frozen solid.
      const realNow = Date.now;
      let clock = 1_700_000_000_000;
      Date.now = () => clock;
      restoreGlobals = () => {
        Math.random = realRandom;
        Date.now = realNow;
      };

      canvas.width = GAME_CONFIG.CANVAS_WIDTH;
      canvas.height = GAME_CONFIG.CANVAS_HEIGHT;
      const ctx = canvas.getContext('2d')!;

      const input: FakeInputState = {
        held: new Set(),
        mouse: { x: 0, y: 0 },
        buttons: new Set(),
        touches: [],
      };

      game.init(canvas, makeCaptureServices(input));
      let auto = false;

      const step = (frames: number, dt = 1 / 60) => {
        for (let i = 0; i < frames; i++) {
          clock += Math.round(dt * 1000);
          game!.update(dt);
          game!.render(ctx);
        }
      };

      const press = (code: string, frames = 1) => {
        input.held.add(code);
        step(frames);
        input.held.delete(code);
        step(2);
      };

      const internals = () => game as unknown as Record<string, unknown>;

      const loop = () => {
        if (auto) step(1);
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);

      const control: GameCaptureControl = {
        ready: true,
        gameId,
        step,
        press,
        hold: code => {
          input.held.add(code);
        },
        release: code => {
          input.held.delete(code);
        },
        mouseMove: (x, y) => {
          input.mouse = { x, y };
          step(1);
        },
        mouseDown: (x, y, button = 0) => {
          input.mouse = { x, y };
          input.buttons.add(button);
          step(1);
        },
        mouseUp: (button = 0) => {
          input.buttons.delete(button);
          step(1);
        },
        click: (x, y, button = 0, frames = 3) => {
          input.mouse = { x, y };
          input.buttons.add(button);
          step(frames);
          input.buttons.delete(button);
          step(2);
        },
        touchStart: (x, y) => {
          input.touches = [{ id: 1, x, y }];
          step(1);
        },
        touchMove: (x, y) => {
          input.touches = [{ id: 1, x, y }];
          step(1);
        },
        touchEnd: () => {
          input.touches = [];
          step(1);
        },
        tap: (x, y, frames = 3) => {
          input.touches = [{ id: 1, x, y }];
          step(frames);
          input.touches = [];
          step(2);
        },
        longPress: (x, y, frames = 40) => {
          input.touches = [{ id: 1, x, y }];
          step(frames);
          input.touches = [];
          step(2);
        },
        swipe: (x, y, dx, dy, frames = 6) => {
          for (let i = 1; i <= frames; i++) {
            const k = i / frames;
            input.touches = [{ id: 1, x: x + dx * k, y: y + dy * k }];
            step(1);
          }
          input.touches = [];
          step(2);
        },
        game: () => game,
        state: () => {
          const s = internals().gameState;
          return typeof s === 'string' ? s : 'unknown';
        },
        score: () => game!.getScore?.().score ?? 0,
        isOver: () => game!.isGameOver?.() ?? false,
        restart: () => {
          game!.restart?.();
          step(1);
        },
        setAuto: on => {
          auto = on;
        },
        loupe: (x, y, w, h) => {
          const out = loupeRef.current;
          if (!out) return;
          const scale = Math.min(640 / w, 480 / h);
          out.width = Math.round(w * scale);
          out.height = Math.round(h * scale);
          const octx = out.getContext('2d');
          if (!octx) return;
          octx.imageSmoothingEnabled = false;
          octx.clearRect(0, 0, out.width, out.height);
          octx.drawImage(canvas, x, y, w, h, 0, 0, out.width, out.height);
        },
      };
      window.__gc = control;

      // Render the first frame so a capture taken before any driving is valid.
      game.render(ctx);
      setStatus(`${gameId} ready`);
    })();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      game?.destroy?.();
      restoreGlobals?.();
      delete window.__gc;
    };
  }, []);

  return (
    <main style={{ background: '#0a0a0c', minHeight: '100vh', padding: 16 }}>
      {/* The Next.js dev indicator would sit on top of the loupe. */}
      <style>{`nextjs-portal { display: none; }`}</style>
      <p
        style={{ color: '#8a8a94', font: '12px monospace', margin: '0 0 8px' }}
      >
        DEV capture harness · {status} · drive via <code>window.__gc</code>
      </p>
      <canvas
        ref={canvasRef}
        data-testid="game-capture-canvas"
        style={{ display: 'block' }}
      />
      <canvas
        ref={loupeRef}
        data-testid="game-capture-loupe"
        width={16}
        height={16}
        style={{ display: 'block', marginTop: 12, background: '#000' }}
      />
    </main>
  );
}
