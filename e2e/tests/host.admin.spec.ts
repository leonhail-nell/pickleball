import { test, expect } from '@playwright/test';
import { apiLogin, createSession, getCourts } from '../helpers';

/**
 * Host console + TV board — the core operational flow. Runs as the seeded
 * admin. Each test provisions its own fresh session via the API so runs are
 * independent, then drives the host UI.
 */

async function freshSession(title: string) {
  const { api, token } = await apiLogin('admin@pickleplay.local', 'admin123');
  const courts = await getCourts(api, token);
  const session = await createSession(api, token, {
    title,
    courtIds: courts.slice(0, 2).map((c) => c.id),
  });
  await api.dispose();
  return session;
}

test.describe('host console', () => {
  test('starts a not-live session and shows the console', async ({ page }) => {
    const session = await freshSession(`E2E Host ${Date.now()}`);
    await page.goto(`/host/${session.id}`);

    // before starting, the console offers to go live
    await expect(page.getByText(/session is not live yet/i)).toBeVisible();
    await page.getByRole('button', { name: /start live session/i }).click();

    // once live, the header, waiting queue, and check-in panel appear
    await expect(page.getByRole('heading', { name: /host console/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /waiting queue/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /check in a player/i })).toBeVisible();
  });

  test('checks a member in from the console', async ({ page }) => {
    const session = await freshSession(`E2E Checkin ${Date.now()}`);
    await page.goto(`/host/${session.id}`);
    await page.getByRole('button', { name: /start live session/i }).click();

    // search the member list, then check the first result in
    await page.getByPlaceholder('Search members…').fill('Player 2');
    const checkIn = page.getByRole('button', { name: /^check in$/i }).first();
    await expect(checkIn).toBeVisible();
    await checkIn.click();

    // the checked-in player now shows in the waiting queue
    await expect(page.getByText(/player 2/i).first()).toBeVisible();
  });

  test('links out to the TV board', async ({ page, context }) => {
    const session = await freshSession(`E2E Board ${Date.now()}`);
    await page.goto(`/host/${session.id}`);
    await page.getByRole('button', { name: /start live session/i }).click();
    await expect(page.getByRole('link', { name: /tv board/i })).toBeVisible();
  });
});

test.describe('TV board', () => {
  test('loads the live board for a started session', async ({ page }) => {
    const session = await freshSession(`E2E TV ${Date.now()}`);

    // start it via the host page first
    await page.goto(`/host/${session.id}`);
    await page.getByRole('button', { name: /start live session/i }).click();
    await expect(page.getByRole('heading', { name: /host console/i })).toBeVisible();

    // now the public board renders
    await page.goto(`/board/${session.id}`);
    await expect(page.getByRole('heading', { name: /open play — live/i })).toBeVisible();
    await expect(page.getByText(/loading board/i)).toHaveCount(0);
  });
});
