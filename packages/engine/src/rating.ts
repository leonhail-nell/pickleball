/**
 * Elo-style rating updates on a DUPR-like 2.0–5.0 scale.
 * Pure functions — callers persist results and enforce the per-session clamp.
 */

export interface RatedPlayer {
  id: string;
  rating: number;
  gamesPlayed: number;
}

/** Divisor for expected-score curve: a 0.5 team-rating gap → ~76% expected win. */
const DIVISOR = 1.0;
/** K decays with games played: new players converge fast, veterans stay stable. */
const K_BASE = 0.08;
const K_MIN = 0.02;
const K_DECAY_GAMES = 30;
/** Max movement from a single game. */
export const MAX_GAME_DELTA = 0.12;
/** Max total movement within one session (enforced by the caller per player). */
export const MAX_SESSION_DELTA = 0.5;

export function kFactor(gamesPlayed: number): number {
  return Math.max(K_MIN, K_BASE * (K_DECAY_GAMES / (K_DECAY_GAMES + gamesPlayed)));
}

export function expectedScore(teamRating: number, opponentRating: number): number {
  return 1 / (1 + 10 ** ((opponentRating - teamRating) / DIVISOR));
}

/**
 * Per-player rating deltas for one game. Team rating = average of the pair.
 * Returns a map playerId → delta (positive for winners, negative for losers).
 */
export function eloDeltas(
  teamA: [RatedPlayer, RatedPlayer],
  teamB: [RatedPlayer, RatedPlayer],
  aWon: boolean,
): Map<string, number> {
  const avg = (t: [RatedPlayer, RatedPlayer]) => (t[0].rating + t[1].rating) / 2;
  const expA = expectedScore(avg(teamA), avg(teamB));
  const outcomeA = aWon ? 1 : 0;

  const deltas = new Map<string, number>();
  for (const p of teamA) {
    const d = kFactor(p.gamesPlayed) * (outcomeA - expA);
    deltas.set(p.id, clamp(d, MAX_GAME_DELTA));
  }
  for (const p of teamB) {
    const d = kFactor(p.gamesPlayed) * ((1 - outcomeA) - (1 - expA));
    deltas.set(p.id, clamp(d, MAX_GAME_DELTA));
  }
  return deltas;
}

/** Clamp a proposed delta so the player's total session movement stays bounded. */
export function clampSessionDelta(proposed: number, sessionDeltaSoFar: number): number {
  const room =
    proposed >= 0
      ? Math.max(0, MAX_SESSION_DELTA - sessionDeltaSoFar)
      : Math.max(0, MAX_SESSION_DELTA + sessionDeltaSoFar);
  return proposed >= 0 ? Math.min(proposed, room) : Math.max(proposed, -room);
}

function clamp(v: number, limit: number): number {
  return Math.max(-limit, Math.min(limit, v));
}
