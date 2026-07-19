export type PlayerId = string;

export type PlayerStatus = 'active' | 'paused' | 'playing';

export interface EnginePlayer {
  id: PlayerId;
  name: string;
  rating: number;
  gamesPlayed: number;
  /** epoch ms of last game end (check-in time initially) — wait-time tiebreak */
  lastFinishedAt: number;
  checkedInAt: number;
  status: PlayerStatus;
  /** consecutive games played without sitting (monopoly guard for catch-up) */
  consecutiveGames: number;
}

export interface EngineConfig {
  /** Max consecutive games while catching up before forced sit (default 2) */
  maxConsecutive: number;
  /** Soft penalty weight for repeated opponents in team split scoring */
  opposedPenalty: number;
  /** 'full': late arrivals equalize total games. 'prorated': equalize from arrival. */
  catchUpMode: 'full' | 'prorated';
  /** Random foursome completions sampled when a tie group exceeds open slots */
  candidateSamples: number;
}

export const defaultConfig: EngineConfig = {
  maxConsecutive: 2,
  opposedPenalty: 0.5,
  catchUpMode: 'full',
  candidateSamples: 24,
};

export interface Assignment {
  teamA: [PlayerId, PlayerId];
  teamB: [PlayerId, PlayerId];
  meta: {
    newPairings: number;      // never-before-partnered pairs in this foursome (of 6)
    repeatPartnerPairs: number; // team pairs that have partnered before (0 unless unavoidable)
    ratingGap: number;
    catchUpIds: PlayerId[];
  };
}

export interface FinishedGame {
  teamA: [PlayerId, PlayerId];
  teamB: [PlayerId, PlayerId];
  /** exhibition games don't touch counters or the partner matrix */
  exhibition?: boolean;
}
