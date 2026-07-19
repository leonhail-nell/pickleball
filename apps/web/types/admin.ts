/** Admin (club dashboard) domain types. */

export interface AdminStats {
  totals: {
    sessions: number;
    players: number;
    games: number;
    revenueCents: number;
    pendingCents: number;
    activeMemberships: number;
  };
  sessions: {
    id: string;
    title: string;
    startsAt: string;
    status: string;
    checkedIn: number;
    games: number;
    revenueCents: number;
  }[];
}

export interface Plan {
  id: string;
  name: string;
  priceCents: number;
  period: string;
}

export interface Member {
  id: string;
  name: string;
  email: string;
  rating: number;
  role: string;
  strikes: number;
}

export interface Club {
  name: string;
  venuePro: boolean;
  venueProUntil: string | null;
  freeCourtLimit: number;
}

export interface EditMemberTarget {
  id: string;
  name: string;
  rating: number;
}
