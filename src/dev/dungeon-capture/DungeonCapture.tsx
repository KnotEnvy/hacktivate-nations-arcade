'use client';

// DEV-ONLY visual capture harness for Dungeon Crawl.
//
// Why this exists: jest.setup.ts stubs getContext('2d'), so the 366 dungeon
// tests record draw CALLS and never produce pixels. THE TUNING FINALE needs to
// judge how the game LOOKS, which means real rendering in a real browser at the
// real canvas size. This component mounts DungeonCrawlGame directly, seeds a
// roster so the title/roster/bloodline pages can be walked past, and exposes a
// scripted control surface on `window.__dc` for Playwright to drive.
//
// It is reachable only through src/app/dev/dungeon-crawl/page.tsx, which
// scripts/sync-dev-routes.js DELETES before type-check, lint and build. It can
// never reach production.

import { useEffect, useRef, useState } from 'react';
import { GAME_CONFIG } from '@/lib/constants';
import { DungeonCrawlGame } from '@/games/dungeon-crawl/DungeonCrawlGame';
import { CharacterStore } from '@/games/dungeon-crawl/persistence/CharacterStore';
import { QUESTS } from '@/games/dungeon-crawl/data/quests';
import { STAT_BASES } from '@/games/dungeon-crawl/data/stats';
import { LEVEL_CAP } from '@/games/dungeon-crawl/data/progression';
import type { SavedHero } from '@/games/dungeon-crawl/persistence/CharacterStore';
import type { ClassId } from '@/games/dungeon-crawl/data/classes';
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

/**
 * Every Services method the games are known to touch, as a no-op. Mirrors
 * gameTestHarness.makeStubServices() but without jest, since this runs in a
 * real browser. Cast through unknown for the same reason the harness does: the
 * real service classes have many more members than any game consumes.
 */
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

/** A level-capped hero, so every scene in the game is reachable. */
function captureHero(overrides: Partial<SavedHero> = {}): SavedHero {
  const classId: ClassId = (overrides.classId ?? 'fighter') as ClassId;
  return {
    classId,
    name: 'SIR ROWAN',
    level: LEVEL_CAP,
    xp: 55400,
    boons: {},
    createdAt: 0,
    stats: { expeditions: 12, deaths: 2, victories: 9 },
    gold: 5000,
    gear: {},
    provisions: [],
    sagas: {},
    spells: [],
    scores: { ...STAT_BASES[classId] },
    equipment: {},
    stash: [],
    lineage: 'human',
    hpRolls: Array(LEVEL_CAP - 1).fill(6),
    curse: null,
    ascended: true,
    ...overrides,
  } as SavedHero;
}

/** The internals the capture driver reaches through. Mirrors the test casts. */
interface GameInternals {
  departOnQuest(quest: unknown): void;
  state: string;
  floor: number;
  biome: { id: string; style?: string; darkness?: number };
  enemies: unknown[];
  town: { overlay: string; selection: number };
}

export interface CaptureControl {
  ready: boolean;
  held: Set<string>;
  /** Advance the sim by N fixed frames, rendering each. Loop must be paused. */
  step(frames: number, dt?: number): void;
  /** Hold a key for N frames, then release and settle. */
  press(code: string, frames?: number): void;
  /** Free-run via requestAnimationFrame (off by default for determinism). */
  setAuto(on: boolean): void;
  /** Seed a roster and walk title -> roster -> bloodline -> town. */
  bootToTown(overrides?: Partial<SavedHero>): void;
  /** Depart on a quest by id, then settle N frames into the floor. */
  depart(questId: string, settleFrames?: number): void;
  /** Open a town station overlay directly, rather than walking to its arch. */
  setOverlay(overlay: string): void;
  state(): string;
  floor(): number;
  biomeId(): string;
  questIds(): string[];
}

declare global {
  interface Window {
    __dc?: CaptureControl;
  }
}

export default function DungeonCapture() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [status, setStatus] = useState('booting…');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const params = new URLSearchParams(window.location.search);
    const seed = Number(params.get('seed') ?? '1337');

    // Deterministic RNG BEFORE the game is constructed — generation, spawn
    // rolls and particle jitter all read Math.random.
    const rand = mulberry32(seed);
    const realRandom = Math.random;
    Math.random = rand;

    // resetExpedition() seeds the run with `Date.now() ^ Math.random()`, so
    // pinning Math.random alone still produced a DIFFERENT dungeon every
    // capture — which would make round-over-round frame comparison worthless.
    // The game drives entirely off the dt we hand it, never the wall clock.
    const realNow = Date.now;
    Date.now = () => 1_700_000_000_000;

    canvas.width = GAME_CONFIG.CANVAS_WIDTH;
    canvas.height = GAME_CONFIG.CANVAS_HEIGHT;
    const ctx = canvas.getContext('2d')!;

    const held = new Set<string>();
    let game: DungeonCrawlGame | null = null;
    let raf = 0;
    let auto = false;

    const step = (frames: number, dt = 1 / 60) => {
      if (!game) return;
      for (let i = 0; i < frames; i++) {
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

    const bootToTown = (overrides: Partial<SavedHero> = {}) => {
      // The roster must be on disk BEFORE construction, or the roster page
      // finds an empty slot and forges a new hero instead of resuming one.
      const hero = captureHero(overrides);
      const store = new CharacterStore();
      window.localStorage.setItem(
        store.key(),
        JSON.stringify({ version: 2, characters: { [hero.classId]: hero } })
      );

      game = new DungeonCrawlGame();
      game.init(canvas, makeCaptureServices(held));
      press('Space'); // title
      press('Digit1'); // roster slot 1
      step(4);
      setStatus(`town (${internals().state})`);
    };

    const depart = (questId: string, settleFrames = 30) => {
      const quest = (QUESTS as Record<string, unknown>)[questId];
      if (!quest) throw new Error(`unknown quest: ${questId}`);
      internals().departOnQuest(quest);

      // depart() returns 'interlude' — the DM briefing, which is TIMER-driven
      // (QuestDirector.updateInterlude) with Space to skip. Bounded-wait for
      // the floor rather than guessing a frame count.
      for (let i = 0; i < 900 && internals().state !== 'playing'; i++) {
        if (i % 30 === 0) press('Space', 2);
        else step(1);
      }
      if (internals().state !== 'playing') {
        throw new Error(`depart(${questId}) stalled in '${internals().state}'`);
      }
      step(settleFrames);
      setStatus(`${internals().state} f${internals().floor}`);
    };

    const loop = () => {
      if (auto) step(1);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const control: CaptureControl = {
      ready: true,
      held,
      step,
      press,
      setAuto: (on: boolean) => {
        auto = on;
      },
      bootToTown,
      depart,
      setOverlay: (overlay: string) => {
        const town = internals().town;
        if (!town) return;
        town.overlay = overlay;
        step(4);
      },
      state: () => internals().state,
      floor: () => internals().floor,
      biomeId: () => internals().biome?.id ?? '',
      questIds: () => Object.keys(QUESTS),
    };
    window.__dc = control;

    bootToTown();

    return () => {
      cancelAnimationFrame(raf);
      game?.destroy?.();
      Math.random = realRandom;
      Date.now = realNow;
      delete window.__dc;
    };
  }, []);

  return (
    <main style={{ background: '#0a0a0c', minHeight: '100vh', padding: 16 }}>
      <p style={{ color: '#8a8a94', font: '12px monospace', margin: '0 0 8px' }}>
        DEV capture harness · {status} · drive via <code>window.__dc</code>
      </p>
      <canvas
        ref={canvasRef}
        data-testid="dungeon-capture-canvas"
        style={{ display: 'block', imageRendering: 'pixelated' }}
      />
    </main>
  );
}
