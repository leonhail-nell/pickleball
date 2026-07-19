/** Shared in-memory types for the live-session manager. */

export const AUTO_CONFIRM_MS = 10 * 60_000;

export interface NamedPlayer {
  id: string;
  name: string;
  rating: number;
}

export interface CourtState {
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

/** Prisma GamePlayer projections used across releaseCourt / rating logic. */
export type GP = { team: string; userId: string; user?: { name: string } };
export type GPU = { team: string; userId: string; user: { name: string; rating: number } };
