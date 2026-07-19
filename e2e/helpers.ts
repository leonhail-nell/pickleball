import { request, type APIRequestContext } from '@playwright/test';
import { API_URL } from './playwright.config';

/** Log in via the API and return a token + user (for direct API-driven setup). */
export async function apiLogin(email: string, password: string) {
  const api = await request.newContext({ baseURL: API_URL });
  const res = await api.post('/auth/login', { data: { email, password } });
  if (!res.ok()) throw new Error(`login failed for ${email}: ${res.status()}`);
  const body = (await res.json()) as { token: string; user: { id: string; role: string } };
  return { api, ...body };
}

/** Create an OPEN session (as an authenticated host/admin) and return its id. */
export async function createSession(
  api: APIRequestContext,
  token: string,
  opts: { title?: string; courtIds: string[]; priceCents?: number } ,
) {
  const now = new Date();
  const end = new Date(now.getTime() + 3 * 3600_000);
  const res = await api.post('/sessions', {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      title: opts.title ?? 'E2E Open Play',
      organizer: 'E2E',
      priceCents: opts.priceCents ?? 0,
      startsAt: now.toISOString(),
      endsAt: end.toISOString(),
      capacity: 24,
      courtIds: opts.courtIds,
    },
  });
  if (!res.ok()) throw new Error(`createSession failed: ${res.status()} ${await res.text()}`);
  return (await res.json()) as { id: string; title: string };
}

/** Fetch the seeded courts (needs a host/admin token). */
export async function getCourts(api: APIRequestContext, token: string) {
  const res = await api.get('/courts', { headers: { Authorization: `Bearer ${token}` } });
  return (await res.json()) as { id: string; number: number }[];
}
