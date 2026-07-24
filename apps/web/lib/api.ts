'use client';

export const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('pp_token');
}

export function getUser(): { id: string; name: string; role: string; avatarUrl?: string | null } | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem('pp_user');
  return raw ? JSON.parse(raw) : null;
}

export function setAuth(token: string, user: object) {
  localStorage.setItem('pp_token', token);
  localStorage.setItem('pp_user', JSON.stringify(user));
}

export function clearAuth() {
  localStorage.removeItem('pp_token');
  localStorage.removeItem('pp_user');
}

export async function api<T = unknown>(
  path: string,
  options: RequestInit & { json?: object } = {},
): Promise<T> {
  const { json, ...init } = options;
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      ...(json ? { 'Content-Type': 'application/json' } : {}),
      ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
      ...init.headers,
    },
    body: json ? JSON.stringify(json) : init.body,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ── domain types (source of truth: @/types/*) ────────────────────
export type {
  Board,
  BoardCourt,
  BoardPlayer,
  NamedPlayer,
  PendingGame,
} from '@/types/board';
export type {
  PlayerGame,
  SessionMeta,
  SessionRow,
  Standing,
} from '@/types/session';
