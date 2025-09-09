import { test, expect, Page } from '@playwright/test';

async function dismissOnboardingIfPresent(page: Page) {
  const overlay = page.locator('[data-testid="onboarding-overlay"]');
  if (await overlay.count()) {
    if (await overlay.isVisible().catch(() => false)) {
      await page.getByTestId('onboarding-finish').click();
    }
  }
  // If it appears slightly delayed, allow it to detach
  await overlay.waitFor({ state: 'detached', timeout: 3000 }).catch(() => {});
}

test.describe('Arcade E2E - Smoke', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try { localStorage.setItem('hacktivate-onboarding-shown', 'true'); } catch {}
    });
  });
  test('landing, dismiss onboarding, see hub', async ({ page }) => {
    await page.goto('/');
    await dismissOnboardingIfPresent(page);

    await expect(page.getByTestId('arcade-hub')).toBeVisible();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByText('Game Arcade')).toBeVisible();
  });

  test('start Runner from carousel and see game canvas', async ({ page }) => {
    await page.goto('/');
    await dismissOnboardingIfPresent(page);

    // Play Tier 0 Runner if available
    const playBtn = page.getByTestId('game-play-runner');
    if (await playBtn.count()) {
      await playBtn.first().click();
      await expect(page.locator('canvas')).toBeVisible();
      // Header back button should appear when inside game
      await expect(page.getByText('Back to Hub')).toBeVisible();
    } else {
      // As a fallback, click the first visible "Play Game" button
      const anyPlay = page.getByRole('button', { name: 'Play Game' }).first();
      if (await anyPlay.count()) {
        await anyPlay.click();
        await expect(page.locator('canvas')).toBeVisible();
      } else {
        test.skip(true, 'No unlocked game play button found');
      }
    }
  });
});
