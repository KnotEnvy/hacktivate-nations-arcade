'use client';

// DEV-ONLY visual capture harness for Endless Runner.
//
// Why this exists: jest.setup.ts stubs getContext('2d'), so unit tests record
// draw CALLS and never produce pixels. Judging how the runner LOOKS means real
// rendering in a real browser at the real canvas size. This component mounts
// RunnerGame directly and exposes a scripted control surface on `window.__rc`
// for Playwright to drive.
//
// It is reachable only through src/app/dev/runner/page.tsx, which
// scripts/sync-dev-routes.js DELETES before type-check, lint and build. It can
// never reach production.

import { useEffect, useRef, useState } from 'react';
import { GAME_CONFIG } from '@/lib/constants';
import { RunnerGame } from '@/games/runner/RunnerGame';
import type { Services } from '@/lib/types';

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

/** Every Services method the runner touches, as a no-op. */
function makeCaptureServices(held: Set<string>): Services {
  const noop = () => {};
  return {
    input: {
      isKeyPressed: (code: string) => held.has(code),
      isMousePressed: () => false,
      isMouseDown: () => false,
      getMousePosition: () => ({ x: 0, y: 0 }),
      getTouches: () => [],
      isTouchActive: () => false,
      isActionPressed: () => held.has('Space'),
      isLeftPressed: () => held.has('ArrowLeft'),
      isRightPressed: () => held.has('ArrowRight'),
      isUpPressed: () => held.has('ArrowUp'),
      isDownPressed: () => held.has('ArrowDown'),
      init: noop,
      destroy: noop,
    },
    audio: {
      playSound: noop,
      playMusic: noop,
      stopMusic: noop,
      stopSound: noop,
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
        Math.floor(score / 100) + pickups,
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

/** The internals the capture driver reaches through. */
interface GameInternals {
  gameState: string;
  deathAnimationTimer: number;
  deathAnimationScale: number;
  themeLevel: number;
  themeProgress: number;
  distance: number;
  lives: number;
  gameSpeed: number;
  boss: { health: number; maxHealth: number; takeDamage(n: number): void } | null;
  bossProjectiles: unknown[];
  groundPounds: unknown[];
  bossDefeatedForTheme: boolean;
  environmentSystem: { setTheme(i: number): void };
  spawnBoss(): void;
  activatePowerUp(type: string): void;
  spawnPowerUp(): void;
  activeEvent: string;
  eventTimer: number;
  comboSystem: { addCoin(): number };
  player: { position: { x: number; y: number } };
}

export interface RunnerCaptureControl {
  ready: boolean;
  held: Set<string>;
  step(frames: number, dt?: number): void;
  press(code: string, frames?: number): void;
  hold(code: string): void;
  release(code: string): void;
  setAuto(on: boolean): void;
  /** Keep an unattended run alive so later scenes are reachable. */
  setImmortal(on: boolean): void;
  /** Leave the menu into a live run. */
  start(): void;
  /** Jump straight to a theme index (0..4) and settle. */
  setTheme(index: number, settleFrames?: number): void;
  /** Force the boss for the current theme to spawn and settle past its intro. */
  bossFight(settleFrames?: number): void;
  /** Knock the live boss down to a fraction of its health (1 = untouched). */
  hurtBoss(fraction: number): void;
  /** Finish the live boss off, to reach the stage-clear screen. */
  killBoss(): void;
  /** Push the combo counter up without having to catch coins. */
  addCombo(n: number): void;
  activatePowerUp(type: string): void;
  setEvent(event: string): void;
  /** Blit a magnified crop of the last frame into the loupe canvas. */
  loupe(x: number, y: number, w: number, h: number): void;
  /** Blit a magnified crop centred on the runner, wherever they are. */
  loupePlayer(w?: number, h?: number): void;
  state(): string;
  theme(): number;
  distance(): number;
  lives(): number;
  bossHealth(): number | null;
}

declare global {
  interface Window {
    __rc?: RunnerCaptureControl;
  }
}

export default function RunnerCapture() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const loupeRef = useRef<HTMLCanvasElement | null>(null);
  const [status, setStatus] = useState('booting…');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const params = new URLSearchParams(window.location.search);
    const seed = Number(params.get('seed') ?? '1337');

    // Deterministic RNG BEFORE construction — spawn rolls, particle jitter and
    // obstacle variety all read Math.random.
    const rand = mulberry32(seed);
    const realRandom = Math.random;
    Math.random = rand;

    // Several renderers animate off Date.now() (invulnerability blink, hover
    // bob, boss health pulse). Pin it so frames are comparable, but let it
    // advance with the sim so those animations are not frozen solid.
    const realNow = Date.now;
    let clock = 1_700_000_000_000;
    Date.now = () => clock;

    canvas.width = GAME_CONFIG.CANVAS_WIDTH;
    canvas.height = GAME_CONFIG.CANVAS_HEIGHT;
    const ctx = canvas.getContext('2d')!;

    const held = new Set<string>();
    const game = new RunnerGame();
    game.init(canvas, makeCaptureServices(held));
    let raf = 0;
    let auto = false;

    // Nothing is holding the controller during a capture, so an unattended run
    // dies within a minute or two and every later scene would be a game-over
    // screen. Immortal mode tops the lives back up and rewinds a death.
    let immortal = true;

    const step = (frames: number, dt = 1 / 60) => {
      for (let i = 0; i < frames; i++) {
        if (immortal) {
          const g = internals();
          if (g.gameState === 'death-animation' || g.gameState === 'stats-recap') {
            g.gameState = 'playing';
            g.deathAnimationTimer = 0;
            g.deathAnimationScale = 1;
          }
          if (g.gameState === 'playing' && g.lives < 3) g.lives = 3;
        }
        clock += Math.round(dt * 1000);
        game.update(dt);
        game.render(ctx);
      }
    };

    const press = (code: string, frames = 1) => {
      held.add(code);
      step(frames);
      held.delete(code);
      step(2);
    };

    const internals = () => game as unknown as GameInternals;

    const start = () => {
      // Menu: 'play' is preselected, so a single confirm enters the run.
      press('Space', 2);
      step(4);
      setStatus(`playing (${internals().gameState})`);
    };

    const setTheme = (index: number, settleFrames = 60) => {
      const g = internals();
      // A boss left over from the previous theme would otherwise stay on
      // screen and own the HUD through every later scene.
      g.boss = null;
      g.bossProjectiles = [];
      g.groundPounds = [];
      g.themeLevel = index;
      g.themeProgress = 0;
      g.bossDefeatedForTheme = false;
      g.environmentSystem.setTheme(index);
      step(settleFrames);
      setStatus(`theme ${index}`);
    };

    const bossFight = (settleFrames = 120) => {
      const g = internals();
      if (!g.boss) g.spawnBoss();
      step(settleFrames);
      setStatus(`boss ${g.boss ? `${g.boss.health}/${g.boss.maxHealth}` : 'gone'}`);
    };

    const loop = () => {
      if (auto) step(1);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const control: RunnerCaptureControl = {
      ready: true,
      held,
      step,
      press,
      hold: (code: string) => {
        held.add(code);
      },
      release: (code: string) => {
        held.delete(code);
      },
      setAuto: (on: boolean) => {
        auto = on;
      },
      setImmortal: (on: boolean) => {
        immortal = on;
      },
      start,
      setTheme,
      bossFight,
      hurtBoss: (fraction: number) => {
        const boss = internals().boss;
        if (!boss) return;
        const target = Math.max(1, Math.round(boss.maxHealth * fraction));
        // takeDamage is a no-op while the boss is still in its intro, so this
        // is bounded rather than a `while (health > target)` spin.
        for (let i = 0; i < boss.maxHealth && boss.health > target; i++) {
          boss.takeDamage(1);
        }
        step(4);
      },
      killBoss: () => {
        const boss = internals().boss;
        if (!boss) return;
        for (let i = 0; i <= boss.maxHealth; i++) boss.takeDamage(1);
        step(4);
      },
      addCombo: (n: number) => {
        for (let i = 0; i < n; i++) internals().comboSystem.addCoin();
        step(2);
      },
      activatePowerUp: (type: string) => {
        internals().activatePowerUp(type);
        step(2);
      },
      setEvent: (event: string) => {
        internals().activeEvent = event;
        internals().eventTimer = 0;
        step(2);
      },
      loupe: (x: number, y: number, w: number, h: number) => {
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
      loupePlayer: (w = 170, h = 130) => {
        const pos = internals().player.position;
        control.loupe(
          Math.max(0, Math.min(canvas.width - w, pos.x + 16 - w / 2)),
          Math.max(0, Math.min(canvas.height - h, pos.y + 16 - h / 2)),
          w,
          h
        );
      },
      state: () => internals().gameState,
      theme: () => internals().themeLevel,
      distance: () => internals().distance,
      lives: () => internals().lives,
      bossHealth: () => internals().boss?.health ?? null,
    };
    window.__rc = control;

    // Render the menu frame so a capture taken before any driving is valid.
    game.render(ctx);
    setStatus('menu');

    return () => {
      cancelAnimationFrame(raf);
      game.destroy?.();
      Math.random = realRandom;
      Date.now = realNow;
      delete window.__rc;
    };
  }, []);

  return (
    <main style={{ background: '#0a0a0c', minHeight: '100vh', padding: 16 }}>
      <p style={{ color: '#8a8a94', font: '12px monospace', margin: '0 0 8px' }}>
        DEV capture harness · {status} · drive via <code>window.__rc</code>
      </p>
      <canvas
        ref={canvasRef}
        data-testid="runner-capture-canvas"
        style={{ display: 'block' }}
      />
      <canvas
        ref={loupeRef}
        data-testid="runner-capture-loupe"
        width={16}
        height={16}
        style={{ display: 'block', marginTop: 12, background: '#000' }}
      />
    </main>
  );
}
