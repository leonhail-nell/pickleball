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

// ── board types (mirror of API board payload) ──────────────────────
export interface BoardPlayer {
  id: string;
  name: string;
  rating: number;
  avatarUrl?: string | null;
  gamesPlayed: number;
  status: 'active' | 'paused' | 'playing';
  deficit: number;
  coverage: { played: number; total: number };
}

export interface NamedPlayer {
  id: string;
  name: string;
  rating: number;
  avatarUrl?: string | null;
}

export interface BoardCourt {
  courtId: string;
  number: number;
  label: string;
  gameId: string | null;
  teamA: NamedPlayer[];
  teamB: NamedPlayer[];
  startedAt: number | null;
  assignmentType: 'auto' | 'manual' | null;
}

export interface PendingGame {
  gameId: string;
  courtNumber: number | null;
  teamA: NamedPlayer[];
  teamB: NamedPlayer[];
  a: number | null;
  b: number | null;
  winner: 'A' | 'B';
  reportedById: string | null;
  reportedAt: number;
  disputed: boolean;
}

export interface SessionMeta {
  id: string;
  title: string;
  description: string;
  location?: string;
  organizer: string;
  createdById?: string | null;
  priceCents: number;
  startsAt: string;
  endsAt: string;
  capacity: number;
  status: string;
  tierMin: number | null;
  tierMax: number | null;
  seedHash: string | null;
  courts: { court: { id: string; number: number; label: string } }[];
  _count: { signups: number };
}

export interface Standing {
  rank: number;
  userId: string;
  name: string;
  rating: number;
  avatarUrl?: string | null;
  wins: number;
  losses: number;
  played: number;
  winPct: number;
  pf: number;
  pa: number;
  diff: number;
}

export interface PlayerGame {
  gameId: string;
  court: number;
  win: boolean;
  myScore: number | null;
  theirScore: number | null;
  partner: string;
  opponents: string[];
  endedAt: string | null;
}

export interface Board {
  sessionId: string;
  seedHash: string | null;
  rotationsPaused?: boolean;
  clubTheme?: Record<string, string>;
  courts: BoardCourt[];
  waiting: BoardPlayer[];
  players: BoardPlayer[];
  pending: PendingGame[];
  nextMatch: { teamA: NamedPlayer[]; teamB: NamedPlayer[] } | null;
  warnings?: string[];
}
