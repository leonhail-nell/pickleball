import { test, expect } from '@playwright/test';

/**
 * Sessions list + public session detail. Runs authenticated as the seeded
 * admin (the "admin" project supplies storageState). The admin is a host, so
 * the "Create session" bar is available.
 */

test.describe('sessions list', () => {
  test('shows the host create bar and existing sessions', async ({ page }) => {
    await page.goto('/sessions');

    await expect(page.getByPlaceholder('Friday Night Open Play')).toBeVisible();
    await expect(
      page.getByRole('button', { name: /create session \(now, all courts\)/i }),
    ).toBeVisible();
  });

  test('host can create a session and it appears in the list', async ({ page }) => {
    await page.goto('/sessions');

    const title = `E2E Session ${Date.now()}`;
    await page.getByPlaceholder('Friday Night Open Play').fill(title);
    await page.getByRole('button', { name: /create session \(now, all courts\)/i }).click();

    await expect(page.getByRole('heading', { name: title })).toBeVisible();
    // a freshly created session exposes Details + Join actions
    const card = page.locator('div', { has: page.getByRole('heading', { name: title }) }).first();
    await expect(card.getByRole('link', { name: /details/i })).toBeVisible();
  });
});

test.describe('session detail', () => {
  test('opens a session and switches between tabs', async ({ page }) => {
    await page.goto('/sessions');

    // open the first session's detail page
    const firstDetails = page.getByRole('link', { name: /details/i }).first();
    await expect(firstDetails).toBeVisible();
    await firstDetails.click();

    await expect(page).toHaveURL(/\/session\//);

    // Details tab (default)
    await expect(page.getByRole('heading', { name: /event details/i })).toBeVisible();

    // Participants tab
    await page.getByRole('tab', { name: /participants/i }).click();
    // Leaderboard tab
    await page.getByRole('tab', { name: /leaderboard/i }).click();
    await expect(page.getByRole('heading', { name: /leaderboard/i })).toBeVisible();
  });
});
