/** Session, standings, and participant domain types. */

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

/** A row in the sessions list. */
export interface SessionRow {
  id: string;
  title: string;
  organizer: string;
  location?: string;
  createdById?: string | null;
  priceCents: number;
  startsAt: string;
  endsAt: string;
  capacity: number;
  status: string;
  tierMin: number | null;
  tierMax: number | null;
  isPrivate?: boolean;
  courts: { court: { id: string; number: number } }[];
  _count: { signups: number };
}

/** A signed-up participant on the public session page. */
export interface Participant {
  id: string;
  status: string;
  user: { id: string; name: string; rating: number; avatarUrl?: string | null };
}
