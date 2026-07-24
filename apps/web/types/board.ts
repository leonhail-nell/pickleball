/**
 * Live-board domain types — mirror of the API's board payload.
 * Consumed by the board, host, and play views.
 */

export interface BoardPlayer {
  id: string;
  name: string;
  rating: number;
  avatarUrl?: string | null;
  gamesPlayed: number;
  status: "active" | "paused" | "playing";
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
  assignmentType: "auto" | "manual" | null;
}

export interface PendingGame {
  gameId: string;
  courtNumber: number | null;
  teamA: NamedPlayer[];
  teamB: NamedPlayer[];
  a: number | null;
  b: number | null;
  winner: "A" | "B";
  reportedById: string | null;
  reportedAt: number;
  disputed: boolean;
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
