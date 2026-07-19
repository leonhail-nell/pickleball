/** Host console domain types (shared across its sub-components). */

export interface Member {
  id: string;
  name: string;
  email: string;
  rating: number;
}

/** Pending manual pairing per court (player ids for teams A and B). */
export type Pending = { A: string[]; B: string[] };

export interface SessionPayment {
  id: string;
  amountCents: number;
  status: "PENDING" | "PAID" | "WAIVED" | "REFUNDED";
  method: string | null;
  user: { id: string; name: string };
}

/** A live-game player being swapped out. */
export interface SwapTarget {
  gameId: string;
  outId: string;
  name: string;
}

/** Which team just won, pending a final score entry. */
export interface ScoreTarget {
  gameId: string;
  winner: "A" | "B";
}

/** A player row being edited (name + rating as a string for the field). */
export interface EditTarget {
  id: string;
  name: string;
  rating: string;
}

/** Manual score-resolution buffer keyed by gameId. */
export type ResolveMap = Record<string, { a: string; b: string }>;
