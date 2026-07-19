import { cryptoRng, fisherYates, type Rng } from './rng.js';
import {
  defaultConfig,
  type Assignment,
  type EngineConfig,
  type EnginePlayer,
  type FinishedGame,
  type PlayerId,
} from './types.js';

const pairKey = (a: PlayerId, b: PlayerId) => (a < b ? `${a}|${b}` : `${b}|${a}`);

interface CheckInInfo {
  id: PlayerId;
  name: string;
  rating: number;
}

interface InternalPlayer extends EnginePlayer {
  /** games credited at check-in (prorated catch-up) — effective = gamesPlayed + credit */
  credit: number;
}

/**
 * Pure rotation engine. No I/O — callers persist state and drive the clock.
 * All randomness flows through the injected Rng (CSPRNG in production),
 * so every decision is reproducible from the audit log.
 */
export class RotationEngine {
  private players = new Map<PlayerId, InternalPlayer>();
  private partnered = new Map<string, number>();
  private opposed = new Map<string, number>();
  readonly config: EngineConfig;
  private rng: Rng;

  constructor(config: Partial<EngineConfig> = {}, rng: Rng = cryptoRng) {
    this.config = { ...defaultConfig, ...config };
    this.rng = rng;
  }

  // ── pool management ────────────────────────────────────────────────

  checkIn(info: CheckInInfo, now: number, modeOverride?: 'full' | 'prorated'): void {
    const mode = modeOverride ?? this.config.catchUpMode;
    const others = this.activePlayers();
    const poolMin = others.length ? Math.min(...others.map((p) => this.effective(p))) : 0;
    this.players.set(info.id, {
      ...info,
      gamesPlayed: 0,
      credit: mode === 'prorated' ? poolMin : 0,
      lastFinishedAt: now,
      checkedInAt: now,
      status: 'active',
      consecutiveGames: 0,
    });
  }

  pause(id: PlayerId): void {
    const p = this.players.get(id);
    if (p && p.status === 'active') p.status = 'paused';
  }

  resume(id: PlayerId, now: number): void {
    const p = this.players.get(id);
    if (p && p.status === 'paused') {
      p.status = 'active';
      p.lastFinishedAt = now; // no wait accrues while paused
    }
  }

  remove(id: PlayerId): void {
    this.players.delete(id);
  }

  /** Apply a confirmed rating change so future team balancing uses it. */
  updateRating(id: PlayerId, rating: number): void {
    const p = this.players.get(id);
    if (p) p.rating = rating;
  }

  /** Host edit: update a checked-in player's display name and/or rating. */
  updateInfo(id: PlayerId, name?: string, rating?: number): void {
    const p = this.players.get(id);
    if (!p) return;
    if (name) p.name = name;
    if (rating != null) p.rating = rating;
  }

  /** Mid-game substitution: `outId` leaves the court, `inId` takes their spot. */
  substitute(outId: PlayerId, inId: PlayerId, now: number): void {
    const out = this.players.get(outId);
    const sub = this.players.get(inId);
    if (!out || out.status !== 'playing') throw new Error('player to swap out is not playing');
    if (!sub) throw new Error('substitute is not checked in');
    if (sub.status === 'playing') throw new Error('substitute is already playing');
    out.status = 'active';
    out.lastFinishedAt = now;
    sub.status = 'playing';
    sub.consecutiveGames += 1;
  }

  /** Crash-recovery: players marked 'playing' whose game no longer exists
   *  return to the active pool (call after restoring live games). */
  reconcilePlaying(liveGamePlayerIds: PlayerId[], now: number): void {
    const keep = new Set(liveGamePlayerIds);
    for (const p of this.players.values()) {
      if (p.status === 'playing' && !keep.has(p.id)) {
        p.status = 'active';
        p.lastFinishedAt = now;
      }
    }
  }

  // ── selection ──────────────────────────────────────────────────────

  /**
   * Pick the next foursome + team split for a free court, or null if <4 eligible.
   * Does NOT mutate state — call startGame(assignment) to commit.
   */
  selectNextGame(): Assignment | null {
    const eligible = this.activePlayers();
    if (eligible.length < 4) return null;

    // deficit per player vs the rest of the pool (late-arrival catch-up)
    const deficit = new Map<PlayerId, number>();
    for (const p of eligible) {
      const others = eligible.filter((o) => o.id !== p.id);
      const minOthers = Math.min(...others.map((o) => this.effective(o)));
      deficit.set(p.id, Math.max(0, minOthers - this.effective(p)));
    }

    // catch-up priority, monopoly-guarded
    const catchUps = eligible
      .filter((p) => deficit.get(p.id)! > 0 && p.consecutiveGames < this.config.maxConsecutive)
      .sort(
        (a, b) => deficit.get(b.id)! - deficit.get(a.id)! || a.checkedInAt - b.checkedInAt,
      );

    // monopoly guard: capped catch-up players sit this rotation entirely
    const resting = new Set(
      eligible
        .filter((p) => deficit.get(p.id)! > 0 && p.consecutiveGames >= this.config.maxConsecutive)
        .map((p) => p.id),
    );

    const chosen: InternalPlayer[] = catchUps.slice(0, 4);
    let slots = 4 - chosen.length;

    if (slots > 0) {
      const chosenIds = new Set(chosen.map((p) => p.id));
      const rest = eligible
        .filter((p) => !chosenIds.has(p.id) && !resting.has(p.id))
        .sort(
          (a, b) => this.effective(a) - this.effective(b) || a.lastFinishedAt - b.lastFinishedAt,
        );

      // fill whole fairness groups (same effective games); coverage-weighted
      // random sample when a group is larger than the remaining slots
      let i = 0;
      while (slots > 0 && i < rest.length) {
        const groupGames = this.effective(rest[i]);
        const group: InternalPlayer[] = [];
        while (i < rest.length && this.effective(rest[i]) === groupGames) group.push(rest[i++]);

        if (group.length <= slots) {
          chosen.push(...group);
          slots -= group.length;
        } else {
          chosen.push(...this.sampleForCoverage(chosen, group, slots));
          slots = 0;
        }
      }
    }

    // last resort: not enough non-resting players → resting players fill in
    if (chosen.length < 4 && resting.size > 0) {
      const chosenIds = new Set(chosen.map((p) => p.id));
      const fillers = eligible
        .filter((p) => resting.has(p.id) && !chosenIds.has(p.id))
        .sort((a, b) => this.effective(a) - this.effective(b));
      chosen.push(...fillers.slice(0, 4 - chosen.length));
    }

    if (chosen.length < 4) return null;
    return this.splitTeams(chosen.slice(0, 4), deficit);
  }

  /** Commit an assignment: mark players playing, update consecutive counters. */
  startGame(a: Assignment): void {
    const ids = new Set([...a.teamA, ...a.teamB]);
    for (const p of this.players.values()) {
      if (ids.has(p.id)) {
        p.status = 'playing';
        p.consecutiveGames += 1;
      } else if (p.status === 'active') {
        p.consecutiveGames = 0; // they sat this rotation
      }
    }
  }

  /** Record a finished game: counters, wait clocks, partner/opponent matrix. */
  finishGame(game: FinishedGame, now: number): void {
    const all = [...game.teamA, ...game.teamB];
    for (const id of all) {
      const p = this.players.get(id);
      if (!p) continue;
      p.status = 'active';
      p.lastFinishedAt = now;
      if (!game.exhibition) p.gamesPlayed += 1;
    }
    if (!game.exhibition) {
      this.bump(this.partnered, game.teamA[0], game.teamA[1]);
      this.bump(this.partnered, game.teamB[0], game.teamB[1]);
      for (const a of game.teamA) for (const b of game.teamB) this.bump(this.opposed, a, b);
    }
  }

  /** Abandoned/voided game: players return to the pool, nothing counts. */
  voidGame(ids: PlayerId[], now: number): void {
    for (const id of ids) {
      const p = this.players.get(id);
      if (!p) continue;
      p.status = 'active';
      p.lastFinishedAt = now;
      p.consecutiveGames = Math.max(0, p.consecutiveGames - 1);
    }
  }

  // ── advisory validation for facilitator custom pairing ────────────

  validateCustom(teamA: [PlayerId, PlayerId], teamB: [PlayerId, PlayerId]): string[] {
    const warnings: string[] = [];
    const pc = (x: PlayerId, y: PlayerId) => this.partnered.get(pairKey(x, y)) ?? 0;
    if (pc(...teamA) > 0) warnings.push(`repeats partner ×${pc(...teamA)}: ${teamA.join(' + ')}`);
    if (pc(...teamB) > 0) warnings.push(`repeats partner ×${pc(...teamB)}: ${teamB.join(' + ')}`);
    const rating = (id: PlayerId) => this.players.get(id)?.rating ?? 0;
    const gap = Math.abs(
      rating(teamA[0]) + rating(teamA[1]) - rating(teamB[0]) - rating(teamB[1]),
    );
    if (gap >= 1) warnings.push(`team rating gap ${gap.toFixed(1)}`);
    for (const id of [...teamA, ...teamB]) {
      const p = this.players.get(id);
      if (!p) warnings.push(`${id} is not checked in`);
      else if (p.status === 'playing') warnings.push(`${p.name} is currently playing`);
      else if (p.status === 'paused') warnings.push(`${p.name} is paused`);
    }
    return warnings;
  }

  // ── introspection / persistence ────────────────────────────────────

  getPlayers(): EnginePlayer[] {
    return [...this.players.values()].map(({ credit, ...p }) => ({ ...p }));
  }

  partnerCount(a: PlayerId, b: PlayerId): number {
    return this.partnered.get(pairKey(a, b)) ?? 0;
  }

  /** partners this player hasn't played with yet (coverage ring on the board) */
  coverage(id: PlayerId): { played: number; total: number } {
    const others = [...this.players.keys()].filter((o) => o !== id);
    const played = others.filter((o) => this.partnerCount(id, o) > 0).length;
    return { played, total: others.length };
  }

  deficitOf(id: PlayerId): number {
    const p = this.players.get(id);
    if (!p || p.status === 'paused') return 0;
    const others = this.activePlayers(true).filter((o) => o.id !== id);
    if (!others.length) return 0;
    return Math.max(0, Math.min(...others.map((o) => this.effective(o))) - this.effective(p));
  }

  serialize(): string {
    return JSON.stringify({
      players: [...this.players.values()],
      partnered: [...this.partnered.entries()],
      opposed: [...this.opposed.entries()],
    });
  }

  static restore(json: string, config: Partial<EngineConfig> = {}, rng?: Rng): RotationEngine {
    const e = new RotationEngine(config, rng);
    const data = JSON.parse(json);
    for (const p of data.players) e.players.set(p.id, p);
    e.partnered = new Map(data.partnered);
    e.opposed = new Map(data.opposed);
    return e;
  }

  // ── internals ──────────────────────────────────────────────────────

  private activePlayers(includePlaying = false): InternalPlayer[] {
    return [...this.players.values()].filter(
      (p) => p.status === 'active' || (includePlaying && p.status === 'playing'),
    );
  }

  private effective(p: InternalPlayer): number {
    return p.gamesPlayed + p.credit;
  }

  private bump(map: Map<string, number>, a: PlayerId, b: PlayerId): void {
    const k = pairKey(a, b);
    map.set(k, (map.get(k) ?? 0) + 1);
  }

  /** Among a tie group larger than the open slots, sample subsets and prefer
   *  the one creating the most never-before pairings. Random tiebreak. */
  private sampleForCoverage(
    already: InternalPlayer[],
    group: InternalPlayer[],
    slots: number,
  ): InternalPlayer[] {
    let best: InternalPlayer[] | null = null;
    let bestScore = -1;
    for (let s = 0; s < this.config.candidateSamples; s++) {
      const pick = fisherYates([...group], this.rng).slice(0, slots);
      const four = [...already, ...pick].map((p) => p.id);
      // a foursome that still admits a fully-fresh team split beats raw pair count
      const score =
        (four.length === 4 && this.hasFreshSplit(four) ? 100 : 0) + this.newPairingCount(four);
      if (score > bestScore) {
        bestScore = score;
        best = pick;
      }
    }
    return best!;
  }

  /** true if at least one of the 3 team splits of this foursome has two never-partnered pairs */
  private hasFreshSplit(ids: PlayerId[]): boolean {
    const fresh = (x: PlayerId, y: PlayerId) => (this.partnered.get(pairKey(x, y)) ?? 0) === 0;
    const [a, b, c, d] = ids;
    return (
      (fresh(a, b) && fresh(c, d)) || (fresh(a, c) && fresh(b, d)) || (fresh(a, d) && fresh(b, c))
    );
  }

  private newPairingCount(ids: PlayerId[]): number {
    let n = 0;
    for (let i = 0; i < ids.length; i++)
      for (let j = i + 1; j < ids.length; j++)
        if ((this.partnered.get(pairKey(ids[i], ids[j])) ?? 0) === 0) n++;
    return n;
  }

  private splitTeams(four: InternalPlayer[], deficit: Map<PlayerId, number>): Assignment {
    const [a, b, c, d] = four;
    const splits: [[InternalPlayer, InternalPlayer], [InternalPlayer, InternalPlayer]][] = [
      [[a, b], [c, d]],
      [[a, c], [b, d]],
      [[a, d], [b, c]],
    ];

    const repeats = (s: (typeof splits)[number]) =>
      ((this.partnered.get(pairKey(s[0][0].id, s[0][1].id)) ?? 0) > 0 ? 1 : 0) +
      ((this.partnered.get(pairKey(s[1][0].id, s[1][1].id)) ?? 0) > 0 ? 1 : 0);

    // HARD RULE: only consider splits with the fewest repeated partnerships
    const minRepeats = Math.min(...splits.map(repeats));
    const candidates = fisherYates(
      splits.filter((s) => repeats(s) === minRepeats),
      this.rng,
    );

    const score = (s: (typeof splits)[number]) => {
      const gap = Math.abs(
        s[0][0].rating + s[0][1].rating - (s[1][0].rating + s[1][1].rating),
      );
      let opp = 0;
      for (const x of s[0]) for (const y of s[1]) opp += this.opposed.get(pairKey(x.id, y.id)) ?? 0;
      return gap + this.config.opposedPenalty * opp;
    };

    const bestSplit = candidates.reduce((m, s) => (score(s) < score(m) ? s : m));
    const ids = four.map((p) => p.id);
    return {
      teamA: [bestSplit[0][0].id, bestSplit[0][1].id],
      teamB: [bestSplit[1][0].id, bestSplit[1][1].id],
      meta: {
        newPairings: this.newPairingCount(ids),
        repeatPartnerPairs: minRepeats,
        ratingGap: Math.abs(
          bestSplit[0][0].rating + bestSplit[0][1].rating -
            bestSplit[1][0].rating - bestSplit[1][1].rating,
        ),
        catchUpIds: ids.filter((id) => (deficit.get(id) ?? 0) > 0),
      },
    };
  }
}
