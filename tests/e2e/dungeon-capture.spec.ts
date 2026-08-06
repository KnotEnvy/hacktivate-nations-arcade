import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

// THE TUNING FINALE — the eye.
//
// Drives the dev-only capture harness (src/dev/dungeon-capture) and writes one
// PNG per named scene to .captures/. These frames are what the finale's visual
// critics grade against the rubric; they are NOT assertions about pixels and
// this spec is deliberately NOT in the CI gate (DOCS/START-HERE.md — the lean
// gate is a deliberate choice, not an oversight).
//
// Run: npm run capture

const OUT = path.resolve(process.cwd(), '.captures');
const SEED = process.env.CAPTURE_SEED ?? '1337';

// The harness's control surface. Declared here rather than imported because
// tsconfig excludes src/dev/**, so the component's own `declare global` is not
// part of this program and cannot conflict with this one.
interface CaptureControl {
  ready: boolean;
  step(frames: number, dt?: number): void;
  press(code: string, frames?: number): void;
  setAuto(on: boolean): void;
  bootToTown(): void;
  depart(questId: string, settleFrames?: number): void;
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

/** Scenes reachable by departing on a quest: the four biomes, the four planes. */
const EXPEDITIONS: Array<{ name: string; questId: string; expectBiome: string }> = [
  { name: 'biome-ember', questId: 'embers-below', expectBiome: 'ember' },
  { name: 'biome-bone', questId: 'bone-galleries', expectBiome: 'bone' },
  { name: 'biome-sunken', questId: 'sunken-vaults', expectBiome: 'sunken' },
  { name: 'biome-ash', questId: 'ashen-court', expectBiome: 'ash' },
  { name: 'plane-silver-void', questId: 'the-silver-reach', expectBiome: 'silver-void' },
  { name: 'plane-brass-marches', questId: 'the-ruled-plain', expectBiome: 'brass-marches' },
  { name: 'plane-churning', questId: 'the-unsettled', expectBiome: 'churning' },
  { name: 'plane-the-pit', questId: 'the-lowest-terrace', expectBiome: 'the-pit' },
];

/** Town station overlays, poked directly — walking to each arch is not worth it. */
const OVERLAYS = ['quests', 'smith', 'alchemist', 'inn', 'temple', 'waydoor'] as const;

test.beforeAll(() => {
  fs.mkdirSync(OUT, { recursive: true });
});

test.describe('dungeon capture', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/dev/dungeon-crawl?seed=${SEED}`);
    await page.waitForFunction(() => window.__dc?.ready === true, null, {
      timeout: 30_000,
    });
  });

  const shoot = async (page: import('@playwright/test').Page, name: string) => {
    const canvas = page.getByTestId('dungeon-capture-canvas');
    await expect(canvas).toBeVisible();
    await canvas.screenshot({ path: path.join(OUT, `${name}.png`) });
  };

  test('town, its overlays, and the character sheet', async ({ page }) => {
    // The harness boots straight to town.
    const state = await page.evaluate(() => window.__dc!.state());
    expect(state).toBe('town');

    await page.evaluate(() => window.__dc!.step(30));
    await shoot(page, 'town-square');

    for (const overlay of OVERLAYS) {
      await page.evaluate((o) => window.__dc!.setOverlay(o), overlay);
      await shoot(page, `town-${overlay}`);
    }

    await page.evaluate(() => window.__dc!.setOverlay('none'));

    // Character sheet (Tab) and the pack (KeyI).
    await page.evaluate(() => window.__dc!.press('Tab', 2));
    await page.evaluate(() => window.__dc!.step(6));
    await shoot(page, 'character-sheet');
  });

  for (const scene of EXPEDITIONS) {
    test(`expedition: ${scene.name}`, async ({ page }) => {
      const biome = await page.evaluate((s) => {
        window.__dc!.depart(s.questId, 40);
        return window.__dc!.biomeId();
      }, scene);

      expect(biome).toBe(scene.expectBiome);
      await shoot(page, `${scene.name}-arrival`);

      // Let the floor breathe: torch flicker, idle enemy drift, particles.
      await page.evaluate(() => window.__dc!.step(90));
      await shoot(page, `${scene.name}-settled`);
    });
  }
});
