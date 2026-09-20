import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

// Endless Runner — the eye.
//
// Drives the dev-only capture harness (src/dev/runner-capture) and writes one
// PNG per named scene to .captures/runner/. These frames are for grading how
// the game LOOKS; they are NOT assertions about pixels, and this spec is
// deliberately NOT in the CI gate (DOCS/START-HERE.md — the lean gate is a
// deliberate choice, not an oversight).
//
// Run: npx playwright test runner-capture --project=chromium

const OUT = path.resolve(process.cwd(), '.captures', 'runner');
const SEED = process.env.CAPTURE_SEED ?? '1337';

interface RunnerCaptureControl {
  ready: boolean;
  step(frames: number, dt?: number): void;
  press(code: string, frames?: number): void;
  hold(code: string): void;
  release(code: string): void;
  setAuto(on: boolean): void;
  setImmortal(on: boolean): void;
  start(): void;
  setTheme(index: number, settleFrames?: number): void;
  bossFight(settleFrames?: number): void;
  hurtBoss(fraction: number): void;
  killBoss(): void;
  addCombo(n: number): void;
  activatePowerUp(type: string): void;
  setEvent(event: string): void;
  spawnFeature(kind: string, settleFrames?: number): void;
  loupe(x: number, y: number, w: number, h: number): void;
  loupePlayer(w?: number, h?: number): void;
  loupeBoss(w?: number, h?: number): void;
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

const THEMES = ['day', 'sunset', 'night', 'desert', 'forest'];

test.beforeAll(() => {
  fs.mkdirSync(OUT, { recursive: true });
});

test.describe('runner capture', () => {
  test('capture every scene', async ({ page }) => {
    test.setTimeout(240_000);

    const canvas = page.locator('[data-testid="runner-capture-canvas"]');
    const loupe = page.locator('[data-testid="runner-capture-loupe"]');
    const shot = async (name: string) => {
      await canvas.screenshot({ path: path.join(OUT, `${name}.png`) });
    };
    /** A magnified crop centred on the runner. */
    const zoomPlayer = async (name: string) => {
      await page.evaluate(() => window.__rc!.loupePlayer());
      await loupe.screenshot({ path: path.join(OUT, `${name}.png`) });
    };
    /** A magnified crop, for judging sprite work that is 32px on screen. */
    const zoom = async (
      name: string,
      x: number,
      y: number,
      w: number,
      h: number
    ) => {
      await page.evaluate(
        ([zx, zy, zw, zh]) => window.__rc!.loupe(zx, zy, zw, zh),
        [x, y, w, h]
      );
      await loupe.screenshot({ path: path.join(OUT, `${name}.png`) });
    };

    await page.goto(`/dev/runner?seed=${SEED}`);
    await page.waitForFunction(() => window.__rc?.ready === true);
    await expect(canvas).toBeVisible();

    // 1. The menu, as a cold player first sees it.
    await shot('01-menu');

    // 2. The tutorial: select the second option and confirm.
    await page.evaluate(() => {
      window.__rc!.press('ArrowDown', 2);
      // The menu has a 0.2s input cooldown; confirm only after it lapses.
      window.__rc!.step(20);
      window.__rc!.press('Space', 2);
      window.__rc!.step(90);
    });
    await shot('02-tutorial-jump');

    // Walk to the slide step, which is the one with a barrier to duck.
    await page.evaluate(() => {
      const rc = window.__rc!;
      for (let i = 0; i < 40; i++) {
        rc.press('Space', 12);
        rc.step(30);
      }
      rc.step(30);
    });
    await shot('03-tutorial-slide');
    await page.reload();
    await page.waitForFunction(() => window.__rc?.ready === true);

    // 3. A live run in each of the five themes, plus each theme's boss.
    await page.evaluate(() => window.__rc!.start());
    for (let i = 0; i < THEMES.length; i++) {
      await page.evaluate((idx) => window.__rc!.setTheme(idx, 180), i);
      await shot(`10-theme-${i}-${THEMES[i]}`);

      await page.evaluate(() => window.__rc!.step(240));
      await shot(`11-theme-${i}-${THEMES[i]}-later`);
      await zoomPlayer(`12z-theme-${i}-${THEMES[i]}-runner`);

      // The intro runs about 3.3s; settle past it so the fight scenes are of
      // an actually fighting boss.
      await page.evaluate(() => window.__rc!.bossFight(320));
      await shot(`20-boss-${i}-${THEMES[i]}`);

      // Rage phase: below 30% health the fight changes character.
      await page.evaluate(() => {
        window.__rc!.hurtBoss(0.25);
        window.__rc!.step(120);
      });
      await shot(`21-boss-${i}-${THEMES[i]}-rage`);
      await page.evaluate(() => window.__rc!.loupeBoss());
      await loupe.screenshot({
        path: path.join(OUT, `22z-boss-${i}-${THEMES[i]}.png`),
      });
    }

    // 3a. Each stage's signature feature, on the stage it belongs to.
    // Settle frames are tuned so each feature is still mid-screen when the
    // shutter opens; they scroll at the world speed.
    const FEATURES: [number, string, number][] = [
      [1, 'geyser', 52],
      [2, 'updraft', 50],
      [3, 'gust', 78],
      [4, 'bounce', 48],
    ];
    for (const [themeIndex, kind, settle] of FEATURES) {
      await page.evaluate(
        ([idx]) => window.__rc!.setTheme(idx as number, 60),
        [themeIndex]
      );
      await page.evaluate(
        ([k, frames]) => window.__rc!.spawnFeature(k as string, frames as number),
        [kind, settle]
      );
      await shot(`15-feature-${kind}`);
      // The hint card is up for the first few seconds of a feature's first
      // appearance, so grab it before it fades.
      if (kind === 'gust') await shot('16-feature-hint');
    }

    // 3b. The stage-clear screen, by finishing a boss off.
    await page.evaluate(() => {
      const rc = window.__rc!;
      rc.setTheme(0, 30);
      rc.bossFight(320);
      rc.killBoss();
      for (let i = 0; i < 400 && rc.state() !== 'boss-victory'; i++) rc.step(1);
      rc.step(40);
    });
    await shot('25-stage-clear');

    // 4. Reload for clean state, then the juice scenes.
    await page.reload();
    await page.waitForFunction(() => window.__rc?.ready === true);
    await page.evaluate(() => {
      window.__rc!.start();
      window.__rc!.step(120);
      window.__rc!.addCombo(12);
      window.__rc!.activatePowerUp('speed-boost');
      window.__rc!.activatePowerUp('invincibility');
      window.__rc!.step(20);
    });
    await shot('30-powered-up');

    await page.evaluate(() => {
      window.__rc!.setEvent('coin-shower');
      window.__rc!.step(90);
    });
    await shot('31-coin-shower');

    await page.evaluate(() => {
      window.__rc!.setEvent('speed-zone');
      window.__rc!.step(60);
    });
    await shot('32-speed-zone');

    // 5. Mid-jump, to see the airborne pose and the aura.
    await page.evaluate(() => {
      window.__rc!.hold('Space');
      window.__rc!.step(8);
    });
    await shot('33-midair');
    await zoomPlayer('33z-midair-player');
    await page.evaluate(() => {
      window.__rc!.release('Space');
      window.__rc!.step(4);
      window.__rc!.hold('ArrowDown');
      window.__rc!.step(6);
      window.__rc!.release('ArrowDown');
    });
    await shot('34-slide');
    await zoomPlayer('34z-slide-player');

    // 6. Death and the recap, by dropping immortality and running dry.
    await page.evaluate(() => {
      const rc = window.__rc!;
      rc.setImmortal(false);
      for (let i = 0; i < 5400 && rc.state() === 'playing'; i++) rc.step(1);
      rc.step(12);
    });
    await shot('40-death-animation');

    await page.evaluate(() => {
      const rc = window.__rc!;
      for (let i = 0; i < 900 && rc.state() !== 'stats-recap'; i++) rc.step(1);
      rc.step(30);
    });
    await shot('41-stats-recap');
  });
});
