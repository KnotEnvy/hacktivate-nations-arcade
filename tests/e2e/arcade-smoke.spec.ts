import { expect, test } from '@playwright/test';

test.describe('Arcade browser smoke', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('hacktivate-onboarding-shown', 'true');
    });
  });

  test('home route boots to the current signed-in access boundary', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByTestId('arcade-root')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('arcade-hub')).toBeVisible();
    await expect(
      page.getByRole('heading', { name: /Hacktivate Nations Arcade/i })
    ).toBeVisible();

    const signInGate = page.getByRole('heading', {
      name: /Sign in to enter the arcade/i,
    });
    const authUnavailable = page.getByRole('heading', {
      name: /This build cannot open the arcade right now/i,
    });

    await expect(signInGate.or(authUnavailable)).toBeVisible();
    await expect(
      page.getByText(/Guest play has been retired|Supabase auth is not configured/i)
    ).toBeVisible();
  });

  test('sign-in modal opens when auth is configured', async ({ page }) => {
    await page.goto('/');

    const openSignIn = page.getByRole('button', { name: /Open sign in/i }).first();
    const authUnavailable = page
      .getByText(/Supabase auth is not configured|This build cannot open the arcade/i)
      .first();

    await expect(openSignIn.or(authUnavailable)).toBeVisible({ timeout: 20_000 });

    if (await authUnavailable.isVisible().catch(() => false)) {
      return;
    }

    await openSignIn.click();
    await expect(
      page.getByRole('heading', { name: /Sign in to Hacktivate Arcade/i })
    ).toBeVisible();
    await expect(page.getByLabel(/Email/i)).toBeVisible();
    await expect(page.getByLabel(/Password/i)).toBeVisible();
  });

  test('instructions page remains available without an authenticated session', async ({ page }) => {
    await page.goto('/instructions');

    await expect(page.getByRole('heading', { name: 'How to Play' })).toBeVisible();
    await expect(page.getByText(/Play games to earn/i)).toBeVisible();
    await expect(page.getByRole('link', { name: /Back to Arcade/i })).toHaveAttribute('href', '/');
  });
});
