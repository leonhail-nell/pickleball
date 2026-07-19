import { test, expect } from '@playwright/test';

/**
 * Public flows: the marketing landing page and the login form.
 * These run with no stored auth (the "public" project).
 */

test.describe('landing page', () => {
  test('renders the hero and primary CTAs', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: /run open play/i })).toBeVisible();
    await expect(page.getByText(/fairly, every time/i)).toBeVisible();
    await expect(page.getByRole('link', { name: /get started free/i })).toBeVisible();
    await expect(page.getByText(/how it works/i)).toBeVisible();
  });
});

test.describe('login', () => {
  test('logs in with seeded admin credentials and lands on sessions', async ({ page }) => {
    await page.goto('/login');

    await page.getByPlaceholder('you@example.com').fill('admin@pickleplay.local');
    await page.getByPlaceholder('Your password').fill('admin123');
    await page.getByRole('button', { name: /^log in$/i }).click();

    await expect(page).toHaveURL(/\/sessions/);
  });

  test('shows an error for bad credentials', async ({ page }) => {
    await page.goto('/login');

    await page.getByPlaceholder('you@example.com').fill('admin@pickleplay.local');
    await page.getByPlaceholder('Your password').fill('wrong-password');
    await page.getByRole('button', { name: /^log in$/i }).click();

    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test('respects the ?next= redirect target', async ({ page }) => {
    await page.goto('/login?next=/me');

    await page.getByPlaceholder('you@example.com').fill('player1@pickleplay.local');
    await page.getByPlaceholder('Your password').fill('player123');
    await page.getByRole('button', { name: /^log in$/i }).click();

    await expect(page).toHaveURL(/\/me/);
  });
});
