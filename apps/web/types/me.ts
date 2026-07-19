/** Player profile ("me") page domain types. */

export interface MyStats {
  name: string;
  rating: number;
  strikes: number;
  games: number;
  wins: number;
  losses: number;
  winPct: number;
  sessions: number;
  ratingHistory: { at: string | null; rating: number }[];
}

export interface MyMembership {
  endsAt: string;
  plan: { name: string; dropInFree: boolean };
}
