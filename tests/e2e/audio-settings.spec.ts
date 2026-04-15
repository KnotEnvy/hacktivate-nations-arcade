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

async function setRangeValue(page: Page, testId: string, value: string) {
  await page.getByTestId(testId).evaluate((element, nextValue) => {
    const input = element as HTMLInputElement;
    input.value = nextValue;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
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
    await setRangeValue(page, 'master-volume-slider', '0.5');
    await setRangeValue(page, 'sfx-volume-slider', '0.6');
    await setRangeValue(page, 'music-volume-slider', '0.3');

    // Toggle mute
    await page.getByTestId('mute-toggle').click();

    // Close
    await page.getByTestId('audio-settings-close').click({ force: true });
    await expect(page.getByTestId('audio-settings-modal')).toHaveCount(0);
  });
});
