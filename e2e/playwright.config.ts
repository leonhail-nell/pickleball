import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';

/**
 * Playwright config for PicklePlay end-to-end tests.
 *
 * Base URLs are env-overridable; defaults match the local dev ports.
 * When PW_NO_SERVER is set, Playwright assumes the API + web are already
 * running (useful in CI or when iterating against a live stack).
 */
export const WEB_URL = process.env.WEB_URL ?? 'http://localhost:3000';
export const API_URL = process.env.API_URL ?? 'http://localhost:4000';

const repoRoot = path.resolve(__dirname, '..');

/** Auth storage-state files produced by global-setup. */
export const STORAGE = {
  admin: path.join(__dirname, '.auth', 'admin.json'),
  player: path.join(__dirname, '.auth', 'player.json'),
};

export default defineConfig({
  testDir: './tests',
  globalSetup: require.resolve('./global-setup.ts'),
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list'], ['html', { open: 'never' }]],

  use: {
    baseURL: WEB_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'public',
      testMatch: /.*\.public\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'admin',
      testMatch: /.*\.admin\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], storageState: STORAGE.admin },
    },
    {
      name: 'player',
      testMatch: /.*\.player\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], storageState: STORAGE.player },
    },
  ],

  // Boot the API + web automatically unless PW_NO_SERVER is set.
  webServer: process.env.PW_NO_SERVER
    ? undefined
    : [
        {
          command: 'npm --workspace apps/api run dev',
          cwd: repoRoot,
          url: `${API_URL}/stats`,
          reuseExistingServer: !process.env.CI,
          timeout: 60_000,
        },
        {
          command: 'npm --workspace apps/web run dev',
          cwd: repoRoot,
          url: WEB_URL,
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        },
      ],
});
