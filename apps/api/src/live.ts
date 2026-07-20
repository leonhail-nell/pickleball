import { randomBytes } from 'node:crypto';
import {
  RotationEngine, hashChainRng, commitmentOf, eloDeltas, clampSessionDelta,
  type Assignment, type ChainRng, type RatedPlayer,
} from '@pickleplay/engine';
import { prisma } from '@pickleplay/db';
import type { Server } from 'socket.io';

const AUTO_CONFIRM_MS = 10 * 60_000;

interface NamedPlayer { id: string; name: string; rating: number; avatarUrl: string | null }

interface CourtState {
  courtId: string;
  number: number;
  label: string;
  gameId: string | null;
  teamA: NamedPlayer[];
  teamB: NamedPlayer[];
  startedAt: number | null;
  assignmentType: 'auto' | 'manual' | null;
}

interface PendingGame {
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

type GP = { team: string; userId: string; user?: { name: string } };
type GPU = { team: string; userId: string; user: { name: string; rating: number; avatarUrl: string | null } };

/**
 * In-memory live-session manager, checkpointed to Postgres after every
 * mutation. Randomness comes from a commit–reveal hash chain: sha256(seed) is
 * public from the start; the seed is revealed when the session closes.
 */
export class LiveSession {
  engine: RotationEngine;
  courts = new Map<string, CourtState>();
  pending: PendingGame[] = [];
  seedHash: string | null = null;
  rotationsPaused = false;
  private chain: ChainRng;
  private preview: Assignment | null = null;
  private names = new Map<string, string>();
  private avatars = new Map<string, string | null>();

  private constructor(
    readonly sessionId: string,
    private io: Server,
    chain: ChainRng,
    engineJson?: string,
  ) {
    this.chain = chain;
    this.engine = engineJson
      ? RotationEngine.restore(engineJson, {}, chain.rng)
      : new RotationEngine({}, chain.rng);
  }

  static async start(sessionId: string, io: Server): Promise<LiveSession> {
    const session = await prisma.openSession.findUniqueOrThrow({
      where: { id: sessionId },
      include: { courts: { include: { court: true } } },
    });

    // commit–reveal seed: create once per session, publish only the hash
    let seed = session.seed;
    if (!seed) {
      seed = randomBytes(16).toString('hex');
      await prisma.openSession.update({
        where: { id: sessionId },
        data: { seed, seedHash: commitmentOf(seed) },
      });
    }

    // engineState = { engine, rngCounter } (older checkpoints were bare engine JSON)
    let engineJson: string | undefined;
    let rngCounter = 0;
    if (session.engineState) {
      try {
        const parsed = JSON.parse(session.engineState);
        if (parsed.engine) {
          engineJson = parsed.engine;
          rngCounter = parsed.rngCounter ?? 0;
        } else {
          engineJson = session.engineState;
        }
      } catch {
        /* corrupt checkpoint → fresh engine */
      }
    }

    const live = new LiveSession(sessionId, io, hashChainRng(seed, rngCounter), engineJson);
    live.seedHash = session.seedHash ?? commitmentOf(seed);

    for (const sc of session.courts) {
      live.courts.set(sc.courtId, {
        courtId: sc.courtId, number: sc.court.number, label: sc.court.label,
        gameId: null, teamA: [], teamB: [], startedAt: null, assignmentType: null,
      });
    }

    // restore in-flight and awaiting-confirmation games after a restart
    const openGames = await prisma.game.findMany({
      where: { sessionId, status: { in: ['LIVE', 'REPORTED'] } },
      include: { players: { include: { user: { select: { name: true, rating: true, avatarUrl: true } } } }, court: true },
    });
    for (const g of openGames) {
      const team = (t: string) =>
        g.players.filter((p: GPU) => p.team === t).map((p: GPU) => {
          live.avatars.set(p.userId, p.user.avatarUrl ?? null);
          return { id: p.userId, name: p.user.name, rating: p.user.rating, avatarUrl: p.user.avatarUrl ?? null };
        });
      if (g.status === 'LIVE') {
        const court = live.courts.get(g.courtId);
        if (!court) continue;
        Object.assign(court, {
          gameId: g.id, teamA: team('A'), teamB: team('B'),
          startedAt: g.startedAt?.getTime() ?? Date.now(),
          assignmentType: (g.assignmentType as 'auto' | 'manual') ?? 'auto',
        });
      } else {
        live.pending.push({
          gameId: g.id, courtNumber: g.court?.number ?? null,
          teamA: team('A'), teamB: team('B'),
          a: g.teamAScore, b: g.teamBScore,
          winner: (g.winner as 'A' | 'B') ?? 'A',
          reportedById: g.reportedById, reportedAt: g.reportedAt?.getTime() ?? Date.now(),
          disputed: g.disputed,
        });
      }
    }

    // crash-recovery: free any players whose game no longer exists
    type OG = { status: string; players: GPU[] };
    const livePlayerIds = (openGames as OG[])
      .filter((g) => g.status === 'LIVE')
      .flatMap((g) => g.players.map((p: GPU) => p.userId));
    live.engine.reconcilePlaying(livePlayerIds, Date.now());

    // avatar cache for everyone already in the engine (restored checkpoint)
    const knownIds = live.engine.getPlayers().map((p) => p.id);
    if (knownIds.length) {
      const users = await prisma.user.findMany({
        where: { id: { in: knownIds } },
        select: { id: true, avatarUrl: true },
      });
      for (const u of users as { id: string; avatarUrl: string | null }[]) {
        live.avatars.set(u.id, u.avatarUrl);
      }
    }

    await prisma.openSession.update({ where: { id: sessionId }, data: { status: 'LIVE' } });
    live.recomputePreview();
    return live;
  }

  // ── pool management ────────────────────────────────────────────────

  async checkIn(
    user: { id: string; name: string; rating: number; avatarUrl?: string | null },
    forceProrated: boolean,
  ) {
    this.avatars.set(user.id, user.avatarUrl ?? null);
    // idempotency guard: re-checking-in an existing player must NOT reset their
    // games-played/coverage state (or yank them out of a live game)
    const existing = this.engine.getPlayers().find((p) => p.id === user.id);
    if (existing) {
      if (existing.status === 'paused') this.engine.resume(user.id, Date.now());
      this.broadcast();
      return;
    }
    this.names.set(user.id, user.name);
    this.engine.checkIn(user, Date.now(), forceProrated ? 'prorated' : undefined);
    await this.audit('check_in', null, { userId: user.id, forceProrated });
    this.recomputePreview();
    await this.persist();
    this.broadcast();
  }

  pauseResume(userId: string, action: 'pause' | 'resume') {
    if (action === 'pause') this.engine.pause(userId);
    else this.engine.resume(userId, Date.now());
    this.recomputePreview();
    void this.persist();
    this.broadcast();
  }

  /** Host: swap a player out of a live game for someone from the queue. */
  async swapPlayer(gameId: string, outId: string, inId: string, actorId: string): Promise<void> {
    const court = [...this.courts.values()].find((c) => c.gameId === gameId);
    if (!court) throw new Error('game not live');
    this.engine.substitute(outId, inId, Date.now());
    const old = await prisma.gamePlayer.findUniqueOrThrow({
      where: { gameId_userId: { gameId, userId: outId } },
    });
    await prisma.gamePlayer.delete({ where: { gameId_userId: { gameId, userId: outId } } });
    await prisma.gamePlayer.create({ data: { gameId, userId: inId, team: old.team } });
    await prisma.game.update({ where: { id: gameId }, data: { assignmentType: 'manual' } });
    const replace = (team: NamedPlayer[]) =>
      team.map((p) => (p.id === outId ? this.named(inId) : p));
    court.teamA = replace(court.teamA);
    court.teamB = replace(court.teamB);
    court.assignmentType = 'manual';
    await this.audit('player_swapped', actorId, { gameId, outId, inId });
    this.io.to(`user:${inId}`).emit('youre-up', { court: court.number, label: court.label });
    this.recomputePreview();
    await this.persist();
    this.broadcast();
  }

  /** Host: remove a checked-in player from the session (left the venue). */
  async removePlayer(userId: string, actorId: string): Promise<void> {
    const playing = this.engine.getPlayers().find((p) => p.id === userId)?.status === 'playing';
    if (playing) throw new Error('player is mid-game — swap them out or void the game first');
    this.engine.remove(userId);
    await prisma.signup.updateMany({
      where: { sessionId: this.sessionId, userId },
      data: { status: 'CANCELLED' },
    });
    // don't keep chasing a fee from someone who left
    await prisma.payment.deleteMany({
      where: { sessionId: this.sessionId, userId, status: 'PENDING' },
    });
    await this.audit('player_removed', actorId, { userId });
    this.recomputePreview();
    await this.persist();
    this.broadcast();
  }

  /** Host edit: propagate a player's new name/rating/photo into the live session. */
  async updatePlayer(userId: string, name?: string, rating?: number, avatarUrl?: string | null): Promise<void> {
    this.engine.updateInfo(userId, name, rating);
    if (name) this.names.set(userId, name);
    if (avatarUrl !== undefined) this.avatars.set(userId, avatarUrl);
    const patch = (team: NamedPlayer[]) =>
      team.map((p) => (p.id === userId
        ? {
            ...p,
            name: name ?? p.name,
            rating: rating ?? p.rating,
            avatarUrl: avatarUrl !== undefined ? avatarUrl : p.avatarUrl,
          }
        : p));
    for (const c of this.courts.values()) {
      c.teamA = patch(c.teamA);
      c.teamB = patch(c.teamB);
    }
    this.recomputePreview();
    await this.persist();
    this.broadcast();
  }

  /** Host: attach an additional court to this live session. */
  async addCourt(court: { courtId: string; number: number; label: string }, actorId: string) {
    this.courts.set(court.courtId, {
      courtId: court.courtId, number: court.number, label: court.label,
      gameId: null, teamA: [], teamB: [], startedAt: null, assignmentType: null,
    });
    await this.audit('court_added', actorId, { courtId: court.courtId, number: court.number });
    await this.fillCourts(); // broadcasts
  }

  /** Host: detach a court from this session. A live game on it is voided
   *  first (players go back to the queue) and other courts refill. */
  async removeCourt(courtId: string, actorId: string): Promise<void> {
    const court = this.courts.get(courtId);
    if (!court) throw new Error('court is not attached to this session');
    if (court.gameId) {
      const gameId = court.gameId;
      const game = await prisma.game.findUniqueOrThrow({
        where: { id: gameId },
        include: { players: true },
      });
      const ids = (game.players as GP[]).map((p) => p.userId);
      this.engine.voidGame(ids, Date.now());
      await prisma.game.update({
        where: { id: gameId },
        data: { status: 'VOID', endedAt: new Date() },
      });
      await this.audit('game_void', actorId, { gameId, reason: 'court_removed' });
      Object.assign(court, { gameId: null, teamA: [], teamB: [], startedAt: null, assignmentType: null });
    }
    this.courts.delete(courtId);
    await prisma.sessionCourt.delete({
      where: { sessionId_courtId: { sessionId: this.sessionId, courtId } },
    });
    await this.audit('court_removed', actorId, { courtId, number: court.number });
    this.recomputePreview();
    await this.fillCourts(); // reassign freed players; broadcasts
  }

  /** Host: pause/resume auto-rotation (water break, announcements…). */
  async setRotations(paused: boolean, actorId: string): Promise<void> {
    this.rotationsPaused = paused;
    await this.audit(paused ? 'rotations_paused' : 'rotations_resumed', actorId, {});
    if (!paused) await this.fillCourts();
    else this.broadcast();
  }

  // ── assignment ─────────────────────────────────────────────────────

  /** Fill every idle court, lowest number first. Consumes the published
   *  next-match preview first so the board preview always matches reality. */
  async fillCourts(): Promise<void> {
    if (this.rotationsPaused) {
      this.broadcast();
      return;
    }
    const idle = [...this.courts.values()]
      .filter((c) => !c.gameId)
      .sort((a, b) => a.number - b.number);
    for (const court of idle) {
      const assignment = this.preview ?? this.engine.selectNextGame();
      this.preview = null;
      if (!assignment) break;
      await this.commitGame(court, assignment, 'auto', null);
    }
    this.recomputePreview();
    this.broadcast();
  }

  async manualGame(
    courtId: string,
    teamA: [string, string],
    teamB: [string, string],
    actorId: string,
    exhibition: boolean,
  ): Promise<{ warnings: string[] }> {
    const court = this.courts.get(courtId);
    if (!court) throw new Error('unknown court');
    if (court.gameId) throw new Error('court is busy');
    const warnings = this.engine.validateCustom(teamA, teamB);
    const assignment: Assignment = {
      teamA, teamB,
      meta: { newPairings: 0, repeatPartnerPairs: 0, ratingGap: 0, catchUpIds: [] },
    };
    await this.commitGame(court, assignment, 'manual', actorId, exhibition, warnings);
    this.recomputePreview();
    this.broadcast();
    return { warnings };
  }

  // ── game completion: host-final, player-report, confirm, dispute ────

  /** Host path: winner (or scores) is authoritative — FINAL + ratings now. */
  async finishGame(
    gameId: string,
    scores: { a: number; b: number } | null,
    winner: 'A' | 'B' | null,
    voided: boolean,
  ): Promise<void> {
    const { teamA, teamB, exhibition } = await this.releaseCourt(gameId);
    const w = winner ?? (scores && scores.a !== scores.b ? (scores.a > scores.b ? 'A' : 'B') : null);

    if (voided || !w) {
      this.engine.voidGame([...teamA, ...teamB], Date.now());
      await prisma.game.update({
        where: { id: gameId },
        data: { status: 'VOID', endedAt: new Date() },
      });
      await this.audit('game_void', null, { gameId });
    } else {
      this.engine.finishGame({ teamA, teamB, exhibition }, Date.now());
      await prisma.game.update({
        where: { id: gameId },
        data: {
          status: 'FINAL', winner: w,
          teamAScore: scores?.a ?? null, teamBScore: scores?.b ?? null,
          endedAt: new Date(),
        },
      });
      await this.audit('game_final', null, { gameId, winner: w, scores });
      if (!exhibition) await this.applyRatingsSafe(gameId, teamA, teamB, w);
    }
    await this.fillCourts();
    await this.persist();
  }

  /** Player path: reporting frees the court immediately; ratings wait for
   *  confirmation by the other team (or the 10-minute auto-confirm). */
  async reportGame(
    gameId: string,
    scores: { a: number; b: number },
    reporterId: string,
  ): Promise<void> {
    if (scores.a === scores.b) throw new Error('scores cannot be tied');
    const court = [...this.courts.values()].find((c) => c.gameId === gameId);
    const { teamA, teamB, exhibition } = await this.releaseCourt(gameId);
    const w: 'A' | 'B' = scores.a > scores.b ? 'A' : 'B';
    this.engine.finishGame({ teamA, teamB, exhibition }, Date.now());
    await prisma.game.update({
      where: { id: gameId },
      data: {
        status: 'REPORTED', winner: w,
        teamAScore: scores.a, teamBScore: scores.b,
        reportedById: reporterId, reportedAt: new Date(), endedAt: new Date(),
      },
    });
    this.pending.push({
      gameId, courtNumber: court?.number ?? null,
      teamA: teamA.map((id: string) => this.named(id)), teamB: teamB.map((id: string) => this.named(id)),
      a: scores.a, b: scores.b, winner: w,
      reportedById: reporterId, reportedAt: Date.now(), disputed: false,
    });
    await this.audit('game_reported', reporterId, { gameId, scores, winner: w });
    await this.fillCourts();
    await this.persist();
  }

  async confirmGame(gameId: string, byId: string | null): Promise<void> {
    const p = this.pending.find((x) => x.gameId === gameId);
    if (!p) throw new Error('game is not awaiting confirmation');
    this.pending = this.pending.filter((x) => x.gameId !== gameId);
    await prisma.game.update({ where: { id: gameId }, data: { status: 'FINAL' } });
    await this.audit('game_confirmed', byId, { gameId, auto: byId === null });
    await this.applyRatingsSafe(
      gameId, p.teamA.map((x) => x.id), p.teamB.map((x) => x.id), p.winner,
    );
    await this.persist();
    this.broadcast();
  }

  async disputeGame(gameId: string, byId: string): Promise<void> {
    const p = this.pending.find((x) => x.gameId === gameId);
    if (!p) throw new Error('game is not awaiting confirmation');
    p.disputed = true;
    await prisma.game.update({ where: { id: gameId }, data: { disputed: true } });
    await this.audit('game_disputed', byId, { gameId });
    this.broadcast();
  }

  /** Host resolves a disputed/pending game with authoritative scores. */
  async resolvePending(gameId: string, scores: { a: number; b: number }, actorId: string) {
    const p = this.pending.find((x) => x.gameId === gameId);
    if (!p) throw new Error('game is not awaiting confirmation');
    this.pending = this.pending.filter((x) => x.gameId !== gameId);
    const w: 'A' | 'B' = scores.a > scores.b ? 'A' : 'B';
    await prisma.game.update({
      where: { id: gameId },
      data: { status: 'FINAL', teamAScore: scores.a, teamBScore: scores.b, winner: w, disputed: false },
    });
    await this.audit('game_resolved', actorId, { gameId, scores, winner: w });
    await this.applyRatingsSafe(gameId, p.teamA.map((x) => x.id), p.teamB.map((x) => x.id), w);
    await this.persist();
    this.broadcast();
  }

  async autoConfirm(): Promise<void> {
    const due = this.pending.filter(
      (p) => !p.disputed && Date.now() - p.reportedAt > AUTO_CONFIRM_MS,
    );
    for (const p of due) await this.confirmGame(p.gameId, null);
  }

  async moveGame(gameId: string, toCourtId: string): Promise<void> {
    const from = [...this.courts.values()].find((c) => c.gameId === gameId);
    const to = this.courts.get(toCourtId);
    if (!from || !to) throw new Error('unknown court/game');
    if (to.gameId) throw new Error('target court is busy');
    Object.assign(to, {
      gameId: from.gameId, teamA: from.teamA, teamB: from.teamB,
      startedAt: from.startedAt, assignmentType: from.assignmentType,
    });
    Object.assign(from, { gameId: null, teamA: [], teamB: [], startedAt: null, assignmentType: null });
    await prisma.game.update({ where: { id: gameId }, data: { courtId: toCourtId } });
    await this.audit('game_moved', null, { gameId, toCourtId });
    this.broadcast();
  }

  // ── ratings ─────────────────────────────────────────────────────────

  /** Ratings must never break the rotation flow — failures are audited instead. */
  private async applyRatingsSafe(gameId: string, teamA: string[], teamB: string[], winner: 'A' | 'B') {
    try {
      await this.applyRatings(gameId, teamA, teamB, winner);
    } catch (err) {
      await this.audit('rating_error', null, { gameId, error: (err as Error).message.slice(0, 500) });
    }
  }

  private async applyRatings(gameId: string, teamA: string[], teamB: string[], winner: 'A' | 'B') {
    const users = await prisma.user.findMany({
      where: { id: { in: [...teamA, ...teamB] } },
      select: { id: true, rating: true },
    });
    const rating = new Map<string, number>(users.map((u: { id: string; rating: number }) => [u.id, u.rating]));
    const engineGames = new Map(this.engine.getPlayers().map((p) => [p.id, p.gamesPlayed]));

    const rated = (id: string): RatedPlayer => ({
      id, rating: rating.get(id) ?? 3, gamesPlayed: engineGames.get(id) ?? 0,
    });
    const deltas = eloDeltas(
      [rated(teamA[0]), rated(teamA[1])],
      [rated(teamB[0]), rated(teamB[1])],
      winner === 'A',
    );

    for (const [userId, rawDelta] of deltas) {
      // per-session clamp: sum of confirmed movement so far this session
      const priors = await prisma.gamePlayer.findMany({
        where: { userId, game: { sessionId: this.sessionId, status: 'FINAL' }, ratingAfter: { not: null } },
        select: { ratingBefore: true, ratingAfter: true },
      });
      const soFar = priors.reduce((acc: number, r: { ratingBefore: number | null; ratingAfter: number | null }) => acc + ((r.ratingAfter ?? 0) - (r.ratingBefore ?? 0)), 0);
      const delta = clampSessionDelta(rawDelta, soFar);
      const before = rating.get(userId) ?? 3;
      const after = Math.min(5.5, Math.max(1.5, before + delta));
      await prisma.user.update({ where: { id: userId }, data: { rating: after } });
      await prisma.gamePlayer.update({
        where: { gameId_userId: { gameId, userId } },
        data: { ratingBefore: before, ratingAfter: after },
      });
      this.engine.updateRating(userId, after);
    }
    await this.audit('rating_update', null, { gameId, deltas: Object.fromEntries(deltas) });
  }

  // ── board ───────────────────────────────────────────────────────────

  board() {
    const players = this.engine.getPlayers().map((p) => ({
      ...p,
      avatarUrl: this.avatars.get(p.id) ?? null,
      deficit: this.engine.deficitOf(p.id),
      coverage: this.engine.coverage(p.id),
    }));
    const waiting = players
      .filter((p) => p.status === 'active')
      .sort((a, b) => b.deficit - a.deficit || a.gamesPlayed - b.gamesPlayed || a.lastFinishedAt - b.lastFinishedAt);
    return {
      sessionId: this.sessionId,
      seedHash: this.seedHash,
      rotationsPaused: this.rotationsPaused,
      courts: [...this.courts.values()].sort((a, b) => a.number - b.number),
      waiting,
      players,
      pending: this.pending,
      nextMatch: this.preview
        ? {
            teamA: this.preview.teamA.map((id) => this.named(id)),
            teamB: this.preview.teamB.map((id) => this.named(id)),
            meta: this.preview.meta,
          }
        : null,
    };
  }

  broadcast() {
    this.io.to(`session:${this.sessionId}`).emit('board', this.board());
  }

  // ── internals ───────────────────────────────────────────────────────

  private recomputePreview() {
    this.preview = this.engine.selectNextGame();
  }

  /** Free the court a game occupies; return its rosters. */
  private async releaseCourt(gameId: string) {
    const court = [...this.courts.values()].find((c) => c.gameId === gameId);
    if (!court) throw new Error('game not live');
    const game = await prisma.game.findUniqueOrThrow({
      where: { id: gameId },
      include: { players: true },
    });
    const teamA = game.players.filter((p: GP) => p.team === 'A').map((p: GP) => p.userId);
    const teamB = game.players.filter((p: GP) => p.team === 'B').map((p: GP) => p.userId);
    Object.assign(court, { gameId: null, teamA: [], teamB: [], startedAt: null, assignmentType: null });
    return { teamA, teamB, exhibition: game.isExhibition, courtNumber: court.number };
  }

  private async commitGame(
    court: CourtState,
    a: Assignment,
    type: 'auto' | 'manual',
    actorId: string | null,
    exhibition = false,
    warnings: string[] = [],
  ) {
    this.engine.startGame(a);
    const game = await prisma.game.create({
      data: {
        sessionId: this.sessionId, courtId: court.courtId,
        status: 'LIVE', assignmentType: type, isExhibition: exhibition,
        startedAt: new Date(),
        players: {
          create: [
            ...a.teamA.map((id) => ({ userId: id, team: 'A' })),
            ...a.teamB.map((id) => ({ userId: id, team: 'B' })),
          ],
        },
      },
    });
    court.gameId = game.id;
    court.teamA = a.teamA.map((id) => this.named(id));
    court.teamB = a.teamB.map((id) => this.named(id));
    court.startedAt = Date.now();
    court.assignmentType = type;
    await this.audit(type === 'auto' ? 'auto_assignment' : 'manual_assignment', actorId, {
      gameId: game.id, teamA: a.teamA, teamB: a.teamB, court: court.number, meta: a.meta, warnings,
    });
    for (const id of [...a.teamA, ...a.teamB]) {
      this.io.to(`user:${id}`).emit('youre-up', { court: court.number, label: court.label });
    }
    await this.persist();
  }

  private named(id: string): NamedPlayer {
    const p = this.engine.getPlayers().find((x) => x.id === id);
    return {
      id,
      name: p?.name ?? this.names.get(id) ?? id,
      rating: p?.rating ?? 3,
      avatarUrl: this.avatars.get(id) ?? null,
    };
  }

  private async persist() {
    await prisma.openSession.update({
      where: { id: this.sessionId },
      data: {
        engineState: JSON.stringify({
          engine: this.engine.serialize(),
          rngCounter: this.chain.counter(),
        }),
      },
    });
  }

  private async audit(type: string, actorId: string | null, payload: object) {
    await prisma.auditEvent.create({
      data: { sessionId: this.sessionId, type, actorId, payload: payload as never },
    });
  }
}

export class LiveSessionRegistry {
  private sessions = new Map<string, LiveSession>();
  constructor(private io: Server) {}

  get(sessionId: string): LiveSession | undefined {
    return this.sessions.get(sessionId);
  }

  all(): LiveSession[] {
    return [...this.sessions.values()];
  }

  async getOrRestore(sessionId: string): Promise<LiveSession | undefined> {
    const existing = this.sessions.get(sessionId);
    if (existing) return existing;
    const s = await prisma.openSession.findUnique({
      where: { id: sessionId },
      select: { status: true },
    });
    if (s?.status !== 'LIVE') return undefined;
    return this.start(sessionId);
  }

  async start(sessionId: string): Promise<LiveSession> {
    let live = this.sessions.get(sessionId);
    if (!live) {
      live = await LiveSession.start(sessionId, this.io);
      this.sessions.set(sessionId, live);
    }
    return live;
  }

  /** Close: convert no-shows to strikes, reveal the RNG seed for audit. */
  async close(sessionId: string): Promise<{ seed: string | null }> {
    this.sessions.delete(sessionId);
    const noShows = await prisma.signup.findMany({
      where: { sessionId, status: 'SIGNED_UP' },
      select: { id: true, userId: true },
    });
    for (const s of noShows) {
      await prisma.signup.update({ where: { id: s.id }, data: { status: 'NO_SHOW' } });
      await prisma.user.update({ where: { id: s.userId }, data: { strikes: { increment: 1 } } });
    }
    const session = await prisma.openSession.update({
      where: { id: sessionId },
      data: { status: 'CLOSED' },
      select: { seed: true },
    });
    await prisma.auditEvent.create({
      data: {
        sessionId, type: 'seed_reveal', actorId: null,
        payload: { seed: session.seed, note: 'verify: sha256(seed) === published seedHash' } as never,
      },
    });
    return { seed: session.seed };
  }

  async autoConfirmAll(): Promise<void> {
    for (const live of this.sessions.values()) {
      await live.autoConfirm().catch(() => {});
    }
  }
}
