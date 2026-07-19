import { chromium, request, type FullConfig } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { API_URL, WEB_URL, STORAGE } from './playwright.config';

/** Seeded credentials (see packages/db/prisma/seed.ts). */
const CREDENTIALS = {
  admin: { email: 'admin@pickleplay.local', password: 'admin123' },
  player: { email: 'player1@pickleplay.local', password: 'player123' },
};

interface LoginResult {
  token: string;
  user: { id: string; name: string; role: string; rating: number; avatarUrl: string | null };
}

/**
 * Log each seeded user in through the API and persist a storageState whose
 * localStorage carries the same `pp_token` / `pp_user` the web app expects.
 * Tests then start already authenticated — no per-test UI login.
 */
async function saveAuth(email: string, password: string, file: string) {
  const api = await request.newContext({ baseURL: API_URL });
  const res = await api.post('/auth/login', { data: { email, password } });
  if (!res.ok()) {
    throw new Error(
      `Auth setup failed for ${email} (${res.status()}). ` +
        `Is the API running and the DB seeded? Run: npm run db:push && npm run db:seed`,
    );
  }
  const { token, user } = (await res.json()) as LoginResult;
  await api.dispose();

  // Seed localStorage on the web origin, then dump storageState.
  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(WEB_URL);
  await page.evaluate(
    ([t, u]) => {
      localStorage.setItem('pp_token', t as string);
      localStorage.setItem('pp_user', u as string);
    },
    [token, JSON.stringify(user)],
  );
  fs.mkdirSync(path.dirname(file), { recursive: true });
  await ctx.storageState({ path: file });
  await browser.close();
}

export default async function globalSetup(_config: FullConfig) {
  await saveAuth(CREDENTIALS.admin.email, CREDENTIALS.admin.password, STORAGE.admin);
  await saveAuth(CREDENTIALS.player.email, CREDENTIALS.player.password, STORAGE.player);
}
