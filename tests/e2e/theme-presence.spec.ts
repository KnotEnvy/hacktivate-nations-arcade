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

test.describe('Theme Presence', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try { localStorage.setItem('hacktivate-onboarding-shown', 'true'); } catch {}
    });
  });
  test('runner shows game title and ready overlay', async ({ page }) => {
    await page.goto('/');

    await dismissOnboardingIfPresent(page);

    // Start Runner if visible; otherwise start any game
    const runnerPlay = page.getByTestId('game-play-runner');
    if (await runnerPlay.count()) {
      await runnerPlay.first().click();
    } else {
      const anyPlay = page.getByRole('button', { name: 'Play Game' }).first();
      await anyPlay.click();
    }

    // Canvas should be visible
    await expect(page.locator('canvas')).toBeVisible();

    // Game title should appear in the header area
    await expect(page.getByRole('heading', { level: 2 })).toBeVisible();

    // Ready overlay copy appears before starting
    await expect(page.getByText('READY TO PLAY!', { exact: false })).toBeVisible();
  });
});
