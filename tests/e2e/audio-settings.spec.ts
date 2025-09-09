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

test.describe('Audio Settings', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try { localStorage.setItem('hacktivate-onboarding-shown', 'true'); } catch {}
    });
  });
  test('open modal, adjust controls, mute, close', async ({ page }) => {
    await page.goto('/');

    // Dismiss onboarding if present
    await dismissOnboardingIfPresent(page);

    // Open audio settings via header button (label contains "Audio")
    await page.getByRole('button', { name: /Audio\b/i }).first().click();

    const modal = page.getByTestId('audio-settings-modal');
    await expect(modal).toBeVisible();

    // Adjust sliders
    await page.getByTestId('master-volume-slider').fill('0.5');
    await page.getByTestId('sfx-volume-slider').fill('0.6');
    await page.getByTestId('music-volume-slider').fill('0.3');

    // Toggle mute
    await page.getByTestId('mute-toggle').click();

    // Close
    await page.getByTestId('audio-settings-close').click();
    await expect(modal).toBeHidden();
  });
});
