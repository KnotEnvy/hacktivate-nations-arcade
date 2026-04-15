import { test, expect, Page } from '@playwright/test';

async function dismissOnboardingIfPresent(page: Page) {
  const overlay = page.locator('[data-testid="onboarding-overlay"]');
  if (await overlay.count()) {
    if (await overlay.isVisible().catch(() => false)) {
      await page.getByTestId('onboarding-finish').click();
    }
  }
  await overlay.waitFor({ state: 'detached', timeout: 3000 }).catch(() => {});
}

test.describe('Tabs Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try { localStorage.setItem('hacktivate-onboarding-shown', 'true'); } catch {}
    });
  });
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await dismissOnboardingIfPresent(page);
  });

  test('switch between Games, Challenges, Achievements', async ({ page }) => {
    // Games tab shows carousel
    await expect(page.getByTestId('game-carousel')).toBeVisible();

    // Challenges
    await page.getByTestId('arcade-tab-challenges').click();
    await expect(page.getByTestId('daily-challenges')).toBeVisible();

    // Achievements
    await page.getByTestId('arcade-tab-achievements').click();
    await expect(page.getByTestId('achievements-panel')).toBeVisible();

    // Back to Games
    await page.getByTestId('arcade-tab-games').click();
    await expect(page.getByTestId('game-carousel')).toBeVisible();
  });
});
