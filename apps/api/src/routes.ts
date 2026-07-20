import { randomBytes } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { prisma } from '@pickleplay/db';
import { hashPassword, requireRole, manageBlock, type AuthUser } from './auth.js';
import { ensureSessionPayment, venueProActive, isClubMember, FREE_COURT_LIMIT } from './club.js';
import type { LiveSession, LiveSessionRegistry } from './live.js';

const HOSTS = ['HOST', 'ADMIN'] as const;

/** Shared check-in path for host check-in and QR self check-in. */
async function performCheckIn(live: LiveSession, sessionId: string, userId: string) {
  const session = await prisma.openSession.findUniqueOrThrow({ where: { id: sessionId } });
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const minutesLate = (Date.now() - session.startsAt.getTime()) / 60_000;
  const forceProrated = minutesLate > session.lateProratedAfterMin;
  await prisma.signup.upsert({
    where: { sessionId_userId: { sessionId, userId } },
    update: { status: 'CHECKED_IN', checkedInAt: new Date() },
    create: { sessionId, userId, status: 'CHECKED_IN', checkedInAt: new Date() },
  });
  await ensureSessionPayment(sessionId, userId); // walk-ins get a payment row too
  await live.checkIn(
    { id: user.id, name: user.name, rating: user.rating, avatarUrl: user.avatarUrl ?? null },
    forceProrated,
  );
  await live.fillCourts();
}

/** Leaderboard, PickleHub-style ranking: wins → win% → point differential. */
async function computeStandings(sessionId: string) {
  const games = await prisma.game.findMany({
    where: { sessionId, status: 'FINAL', isExhibition: false },
    include: { players: { include: { user: { select: { name: true, rating: true, avatarUrl: true } } } } },
  });
  type Row = {
    userId: string; name: string; rating: number; avatarUrl: string | null;
    wins: number; losses: number; pf: number; pa: number;
  };
  const rows = new Map<string, Row>();
  const rowOf = (id: string, name: string, rating: number, avatarUrl: string | null): Row => {
    let r = rows.get(id);
    if (!r) {
      r = { userId: id, name, rating, avatarUrl, wins: 0, losses: 0, pf: 0, pa: 0 };
      rows.set(id, r);
    }
    return r;
  };
  for (const g of games) {
    if (!g.winner) continue;
    const sa = g.teamAScore ?? (g.winner === 'A' ? 11 : 0);
    const sb = g.teamBScore ?? (g.winner === 'B' ? 11 : 0);
    for (const p of g.players as { team: string; userId: string; user: { name: string; rating: number; avatarUrl: string | null } }[]) {
      const r = rowOf(p.userId, p.user.name, p.user.rating, p.user.avatarUrl);
      const mine = p.team === 'A' ? sa : sb;
      const theirs = p.team === 'A' ? sb : sa;
      r.pf += mine;
      r.pa += theirs;
      if (g.winner === p.team) r.wins += 1;
      else r.losses += 1;
    }
  }
  return [...rows.values()]
    .map((r) => ({
      ...r,
      played: r.wins + r.losses,
      winPct: r.wins + r.losses ? r.wins / (r.wins + r.losses) : 0,
      diff: r.pf - r.pa,
    }))
    .sort((a, b) => b.wins - a.wins || b.winPct - a.winPct || b.diff - a.diff)
    .map((r, i) => ({ ...r, rank: i + 1 }));
}

export function sessionRoutes(app: FastifyInstance, registry: LiveSessionRegistry) {
  // ── schedule ─────────────────────────────────────────────────────
  // Private sessions are visible only to club members (staff or active
  // members) and to the organizer who created them.
  app.get('/sessions', async (req) => {
    const user = req.user as AuthUser;
    const member = await isClubMember(user);
    return prisma.openSession.findMany({
      where: member ? {} : { OR: [{ isPrivate: false }, { createdById: user.id }] },
      orderBy: { startsAt: 'desc' },
      include: { courts: { include: { court: true } }, _count: { select: { signups: true } } },
    });
  });

  app.get('/courts', async () => prisma.court.findMany({ orderBy: { number: 'asc' } }));

  // public landing-page stats
  app.get('/stats', async () => {
    const [sessions, players, games] = await Promise.all([
      prisma.openSession.count(),
      prisma.user.count(),
      prisma.game.count({ where: { status: 'FINAL' } }),
    ]);
    return { sessions, players, games };
  });

  // public session detail (event page) — this route is auth-optional, so
  // read the token if present to check private-session visibility.
  app.get<{ Params: { id: string } }>('/sessions/:id', async (req, reply) => {
    const s = await prisma.openSession.findUnique({
      where: { id: req.params.id },
      include: {
        courts: { include: { court: true } },
        _count: { select: { signups: { where: { status: { in: ['SIGNED_UP', 'CHECKED_IN'] } } } } },
      },
    });
    if (!s) return reply.code(404).send({ error: 'not found' });
    if (s.isPrivate) {
      const viewer = await req.jwtVerify<AuthUser>().catch(() => null);
      const allowed = viewer && (viewer.id === s.createdById || (await isClubMember(viewer)));
      if (!allowed) return reply.code(404).send({ error: 'not found' });
    }
    const { seed, engineState, qrToken, ...pub } = s as Record<string, unknown>;
    return pub;
  });

  // public leaderboard (live and completed sessions)
  app.get<{ Params: { id: string } }>('/sessions/:id/standings', async (req) =>
    computeStandings(req.params.id),
  );

  // public per-player match history (tap a leaderboard row)
  app.get<{ Params: { id: string; userId: string } }>(
    '/sessions/:id/players/:userId/games',
    async (req) => {
      const games = await prisma.game.findMany({
        where: {
          sessionId: req.params.id,
          status: 'FINAL',
          isExhibition: false,
          players: { some: { userId: req.params.userId } },
        },
        include: {
          players: { include: { user: { select: { name: true } } } },
          court: { select: { number: true } },
        },
        orderBy: { endedAt: 'asc' },
      });
      type P = { team: string; userId: string; user: { name: string } };
      type G = {
        id: string; winner: string | null; teamAScore: number | null; teamBScore: number | null;
        endedAt: Date | null; players: P[]; court: { number: number };
      };
      return (games as G[]).map((g) => {
        const me = (g.players as P[]).find((p) => p.userId === req.params.userId)!;
        const partner = (g.players as P[]).find((p) => p.team === me.team && p.userId !== me.userId);
        const opponents = (g.players as P[]).filter((p) => p.team !== me.team);
        const myScore = me.team === 'A' ? g.teamAScore : g.teamBScore;
        const theirScore = me.team === 'A' ? g.teamBScore : g.teamAScore;
        return {
          gameId: g.id,
          court: g.court.number,
          win: g.winner === me.team,
          myScore, theirScore,
          partner: partner?.user.name ?? '—',
          opponents: opponents.map((o) => o.user.name),
          endedAt: g.endedAt,
        };
      });
    },
  );

  // walk-in check-in support: host can search the member list
  app.get('/users', { preHandler: requireRole(...HOSTS) }, async () =>
    prisma.user.findMany({
      select: { id: true, name: true, email: true, rating: true, role: true, strikes: true, avatarUrl: true },
      orderBy: { name: 'asc' },
    }),
  );

  app.post<{
    Body: {
      startsAt: string; endsAt: string; capacity?: number; courtIds: string[];
      tierMin?: number | null; tierMax?: number | null;
    };
  }>(
    '/sessions',
    { preHandler: requireRole(...HOSTS) },
    async (req, reply) => {
      const { startsAt, endsAt, capacity, courtIds, tierMin, tierMax } = req.body;
      if (courtIds.length > FREE_COURT_LIMIT && !(await venueProActive())) {
        return reply.code(402).send({
          error: `Free plan supports up to ${FREE_COURT_LIMIT} courts — start a Venue Pro trial in the club dashboard to run more.`,
        });
      }
      const { title, description, organizer, priceCents, isPrivate } = req.body as {
        title?: string; description?: string; organizer?: string; priceCents?: number; isPrivate?: boolean;
      };
      const creator = req.user as AuthUser;
      return prisma.openSession.create({
        data: {
          title: title || 'Open Play',
          description: description ?? '',
          organizer: organizer ?? '',
          createdById: creator.id,
          isPrivate: isPrivate ?? false,
          priceCents: priceCents ?? 0,
          startsAt: new Date(startsAt),
          endsAt: new Date(endsAt),
          capacity: capacity ?? 24,
          status: 'OPEN',
          tierMin: tierMin ?? null,
          tierMax: tierMax ?? null,
          courts: { create: courtIds.map((courtId) => ({ courtId })) },
        },
      });
    },
  );

  // host: delete a session and all its records (blocked while live)
  app.delete<{ Params: { id: string } }>(
    '/sessions/:id',
    { preHandler: requireRole(...HOSTS) },
    async (req, reply) => {
      const blocked = await manageBlock(req.params.id, req.user as AuthUser);
      if (blocked) return reply.code(403).send({ error: blocked });
      const s = await prisma.openSession.findUnique({
        where: { id: req.params.id },
        select: { status: true },
      });
      if (!s) return reply.code(404).send({ error: 'not found' });
      if (s.status === 'LIVE' || registry.get(req.params.id)) {
        return reply.code(400).send({ error: 'end the session before deleting it' });
      }
      const sessionId = req.params.id;
      await prisma.$transaction([
        prisma.gamePlayer.deleteMany({ where: { game: { sessionId } } }),
        prisma.game.deleteMany({ where: { sessionId } }),
        prisma.payment.deleteMany({ where: { sessionId } }),
        prisma.signup.deleteMany({ where: { sessionId } }),
        prisma.auditEvent.deleteMany({ where: { sessionId } }),
        prisma.sessionCourt.deleteMany({ where: { sessionId } }),
        prisma.openSession.delete({ where: { id: sessionId } }),
      ]);
      return { ok: true };
    },
  );

  /** Tier gate for player-initiated joins (hosts can always override). */
  async function tierBlock(sessionId: string, userId: string): Promise<string | null> {
    const [s, u] = await Promise.all([
      prisma.openSession.findUniqueOrThrow({
        where: { id: sessionId }, select: { tierMin: true, tierMax: true },
      }),
      prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { rating: true } }),
    ]);
    if (s.tierMin != null && u.rating < s.tierMin)
      return `this session is rated ${s.tierMin}–${s.tierMax ?? '∞'}; your rating is ${u.rating.toFixed(2)}`;
    if (s.tierMax != null && u.rating > s.tierMax)
      return `this session is rated ${s.tierMin ?? 0}–${s.tierMax}; your rating is ${u.rating.toFixed(2)}`;
    return null;
  }

  // ── signup / cancel ──────────────────────────────────────────────
  app.post<{ Params: { id: string } }>('/sessions/:id/signups', async (req, reply) => {
    const user = req.user as AuthUser;
    const session = await prisma.openSession.findUniqueOrThrow({
      where: { id: req.params.id },
      include: { _count: { select: { signups: { where: { status: { in: ['SIGNED_UP', 'CHECKED_IN'] } } } } } },
    });
    if (session.status === 'CLOSED') return reply.code(400).send({ error: 'session closed' });
    const block = await tierBlock(session.id, user.id);
    if (block) return reply.code(403).send({ error: block });
    const waitlisted = session._count.signups >= session.capacity;
    const signup = await prisma.signup.upsert({
      where: { sessionId_userId: { sessionId: session.id, userId: user.id } },
      update: { status: waitlisted ? 'WAITLISTED' : 'SIGNED_UP' },
      create: {
        sessionId: session.id,
        userId: user.id,
        status: waitlisted ? 'WAITLISTED' : 'SIGNED_UP',
      },
    });
    if (!waitlisted) await ensureSessionPayment(session.id, user.id);
    return signup;
  });

  app.delete<{ Params: { id: string } }>('/sessions/:id/signups/me', async (req) => {
    const user = req.user as AuthUser;
    await prisma.signup.update({
      where: { sessionId_userId: { sessionId: req.params.id, userId: user.id } },
      data: { status: 'CANCELLED' },
    });
    // drop the unpaid drop-in fee, if any
    await prisma.payment.deleteMany({
      where: { sessionId: req.params.id, userId: user.id, status: 'PENDING' },
    });
    // promote first waitlisted
    const next = await prisma.signup.findFirst({
      where: { sessionId: req.params.id, status: 'WAITLISTED' },
      orderBy: { id: 'asc' },
    });
    if (next) {
      await prisma.signup.update({ where: { id: next.id }, data: { status: 'SIGNED_UP' } });
      await ensureSessionPayment(req.params.id, next.userId); // promoted player owes the fee
    }
    return { ok: true };
  });

  app.get<{ Params: { id: string } }>('/sessions/:id/signups', async (req) =>
    prisma.signup.findMany({
      where: { sessionId: req.params.id, status: { not: 'CANCELLED' } },
      include: { user: { select: { id: true, name: true, rating: true, avatarUrl: true } } },
    }),
  );

  // ── live session control (host) ──────────────────────────────────
  app.post<{ Params: { id: string } }>(
    '/sessions/:id/start',
    { preHandler: requireRole(...HOSTS) },
    async (req, reply) => {
      const blocked = await manageBlock(req.params.id, req.user as AuthUser);
      if (blocked) return reply.code(403).send({ error: blocked });
      const live = await registry.start(req.params.id);
      // ensure a QR self check-in token exists
      const s = await prisma.openSession.findUniqueOrThrow({ where: { id: req.params.id } });
      if (!s.qrToken) {
        await prisma.openSession.update({
          where: { id: req.params.id },
          data: { qrToken: randomBytes(8).toString('hex') },
        });
      }
      return live.board();
    },
  );

  // host: fetch the QR token to render the check-in code
  app.get<{ Params: { id: string } }>(
    '/sessions/:id/qr',
    { preHandler: requireRole(...HOSTS) },
    async (req, reply) => {
      const blocked = await manageBlock(req.params.id, req.user as AuthUser);
      if (blocked) return reply.code(403).send({ error: blocked });
      const s = await prisma.openSession.findUniqueOrThrow({
        where: { id: req.params.id },
        select: { qrToken: true },
      });
      return { token: s.qrToken };
    },
  );

  // player: resolve a scanned QR token to its session
  app.get<{ Params: { token: string } }>('/checkin-token/:token', async (req, reply) => {
    const s = await prisma.openSession.findUnique({
      where: { qrToken: req.params.token },
      select: { id: true, status: true },
    });
    if (!s) return reply.code(404).send({ error: 'invalid check-in code' });
    return s;
  });

  // player: QR self check-in
  app.post<{ Params: { id: string }; Body: { token: string } }>(
    '/sessions/:id/checkin/self',
    async (req, reply) => {
      const user = req.user as AuthUser;
      const s = await prisma.openSession.findUniqueOrThrow({
        where: { id: req.params.id },
        select: { qrToken: true },
      });
      if (!s.qrToken || s.qrToken !== req.body.token) {
        return reply.code(403).send({ error: 'invalid check-in code' });
      }
      const block = await tierBlock(req.params.id, user.id);
      if (block) return reply.code(403).send({ error: block });
      // waitlisted players can't self-check-in past capacity
      const [signup, session] = await Promise.all([
        prisma.signup.findUnique({
          where: { sessionId_userId: { sessionId: req.params.id, userId: user.id } },
        }),
        prisma.openSession.findUniqueOrThrow({
          where: { id: req.params.id },
          include: {
            _count: { select: { signups: { where: { status: { in: ['SIGNED_UP', 'CHECKED_IN'] } } } } },
          },
        }),
      ]);
      if (signup?.status === 'WAITLISTED' && session._count.signups >= session.capacity) {
        return reply.code(403).send({ error: 'you are on the waitlist — see the host at the desk' });
      }
      const live = await registry.getOrRestore(req.params.id);
      if (!live) return reply.code(400).send({ error: 'session not live' });
      await performCheckIn(live, req.params.id, user.id);
      return live.board();
    },
  );

  app.post<{ Params: { id: string } }>(
    '/sessions/:id/close',
    { preHandler: requireRole(...HOSTS) },
    async (req, reply) => {
      const blocked = await manageBlock(req.params.id, req.user as AuthUser);
      if (blocked) return reply.code(403).send({ error: blocked });
      const { seed } = await registry.close(req.params.id);
      return { ok: true, seedRevealed: seed };
    },
  );

  app.post<{ Params: { id: string }; Body: { userId: string } }>(
    '/sessions/:id/checkin',
    { preHandler: requireRole(...HOSTS) },
    async (req, reply) => {
      const blocked = await manageBlock(req.params.id, req.user as AuthUser);
      if (blocked) return reply.code(403).send({ error: blocked });
      const live = await registry.getOrRestore(req.params.id);
      if (!live) return reply.code(400).send({ error: 'session not live' });
      await performCheckIn(live, req.params.id, req.body.userId);
      return live.board();
    },
  );

  // admin: add a member directly (default password until they reset)
  app.post<{ Body: { name: string; email: string; rating?: number } }>(
    '/users',
    { preHandler: requireRole('ADMIN') },
    async (req, reply) => {
      const { name, email, rating } = req.body;
      if (!name?.trim() || !email?.trim()) return reply.code(400).send({ error: 'name and email required' });
      const existing = await prisma.user.findUnique({ where: { email: email.trim() } });
      if (existing) return reply.code(409).send({ error: 'email already registered' });
      return prisma.user.create({
        data: {
          name: name.trim(),
          email: email.trim(),
          passwordHash: hashPassword('welcome123'),
          rating: rating ?? 3.0,
        },
        select: { id: true, name: true, email: true, rating: true, role: true },
      });
    },
  );

  // host: edit a player's name/rating (updates any live session too); admins can change roles
  app.patch<{
    Params: { userId: string };
    Body: { name?: string; rating?: number; role?: 'PLAYER' | 'HOST' | 'ADMIN'; sessionId?: string };
  }>(
    '/users/:userId',
    { preHandler: requireRole(...HOSTS) },
    async (req, reply) => {
      const actor = req.user as AuthUser;
      const { name, rating, role, sessionId } = req.body;
      if (role && actor.role !== 'ADMIN') {
        return reply.code(403).send({ error: 'only admins can change roles' });
      }
      const clamped = rating != null ? Math.min(5.5, Math.max(1.5, rating)) : undefined;
      const user = await prisma.user.update({
        where: { id: req.params.userId },
        data: {
          ...(name?.trim() ? { name: name.trim() } : {}),
          ...(clamped != null ? { rating: clamped } : {}),
          ...(role ? { role } : {}),
        },
        select: { id: true, name: true, rating: true },
      });
      if (sessionId) {
        const live = registry.get(sessionId);
        if (live) await live.updatePlayer(user.id, user.name, user.rating);
        return live ? live.board() : user;
      }
      return user;
    },
  );

  // host: swap a player in a live game with someone from the queue
  app.post<{ Params: { id: string }; Body: { sessionId: string; outId: string; inId: string } }>(
    '/games/:id/players/swap',
    { preHandler: requireRole(...HOSTS) },
    async (req, reply) => {
      const blocked = await manageBlock(req.body.sessionId, req.user as AuthUser);
      if (blocked) return reply.code(403).send({ error: blocked });
      const live = await registry.getOrRestore(req.body.sessionId);
      if (!live) return reply.code(400).send({ error: 'session not live' });
      const user = req.user as AuthUser;
      await live.swapPlayer(req.params.id, req.body.outId, req.body.inId, user.id);
      return live.board();
    },
  );

  // host: remove a player from the session
  app.post<{ Params: { id: string; userId: string } }>(
    '/sessions/:id/players/:userId/remove',
    { preHandler: requireRole(...HOSTS) },
    async (req, reply) => {
      const blocked = await manageBlock(req.params.id, req.user as AuthUser);
      if (blocked) return reply.code(403).send({ error: blocked });
      const live = await registry.getOrRestore(req.params.id);
      if (!live) return reply.code(400).send({ error: 'session not live' });
      const user = req.user as AuthUser;
      await live.removePlayer(req.params.userId, user.id);
      return live.board();
    },
  );

  // host: pause/resume auto-rotation
  app.post<{ Params: { id: string }; Body: { action: 'pause' | 'resume' } }>(
    '/sessions/:id/rotations',
    { preHandler: requireRole(...HOSTS) },
    async (req, reply) => {
      const blocked = await manageBlock(req.params.id, req.user as AuthUser);
      if (blocked) return reply.code(403).send({ error: blocked });
      const live = await registry.getOrRestore(req.params.id);
      if (!live) return reply.code(400).send({ error: 'session not live' });
      const user = req.user as AuthUser;
      await live.setRotations(req.body.action === 'pause', user.id);
      return live.board();
    },
  );

  // host: attach another court to a live session (reuses an idle court or creates the next number)
  app.post<{ Params: { id: string } }>(
    '/sessions/:id/courts',
    { preHandler: requireRole(...HOSTS) },
    async (req, reply) => {
      const blocked = await manageBlock(req.params.id, req.user as AuthUser);
      if (blocked) return reply.code(403).send({ error: blocked });
      const live = await registry.getOrRestore(req.params.id);
      if (!live) return reply.code(400).send({ error: 'session not live' });
      if (live.courts.size >= FREE_COURT_LIMIT && !(await venueProActive())) {
        return reply.code(402).send({
          error: `Free plan supports up to ${FREE_COURT_LIMIT} courts — start a Venue Pro trial in the club dashboard to add more.`,
        });
      }
      const user = req.user as AuthUser;
      let court = await prisma.court.findFirst({
        where: { isActive: true, sessions: { none: { sessionId: req.params.id } } },
        orderBy: { number: 'asc' },
      });
      if (!court) {
        const max = await prisma.court.aggregate({ _max: { number: true } });
        court = await prisma.court.create({ data: { number: (max._max.number ?? 0) + 1 } });
      }
      await prisma.sessionCourt.create({
        data: { sessionId: req.params.id, courtId: court.id },
      });
      await live.addCourt({ courtId: court.id, number: court.number, label: court.label }, user.id);
      return live.board();
    },
  );

  // host: detach an idle court from a live session
  app.delete<{ Params: { id: string; courtId: string } }>(
    '/sessions/:id/courts/:courtId',
    { preHandler: requireRole(...HOSTS) },
    async (req, reply) => {
      const blocked = await manageBlock(req.params.id, req.user as AuthUser);
      if (blocked) return reply.code(403).send({ error: blocked });
      const live = await registry.getOrRestore(req.params.id);
      if (!live) return reply.code(400).send({ error: 'session not live' });
      const user = req.user as AuthUser;
      await live.removeCourt(req.params.courtId, user.id);
      return live.board();
    },
  );

  // host: add a walk-in guest by name (creates a lightweight account + checks in)
  app.post<{ Params: { id: string }; Body: { name: string; rating?: number } }>(
    '/sessions/:id/guests',
    { preHandler: requireRole(...HOSTS) },
    async (req, reply) => {
      const blocked = await manageBlock(req.params.id, req.user as AuthUser);
      if (blocked) return reply.code(403).send({ error: blocked });
      const live = await registry.getOrRestore(req.params.id);
      if (!live) return reply.code(400).send({ error: 'session not live' });
      if (!req.body.name?.trim()) return reply.code(400).send({ error: 'name required' });
      const guest = await prisma.user.create({
        data: {
          name: req.body.name.trim(),
          email: `guest-${randomBytes(4).toString('hex')}@pickleplay.local`,
          passwordHash: hashPassword(randomBytes(12).toString('hex')),
          rating: req.body.rating ?? 3.0,
        },
      });
      await performCheckIn(live, req.params.id, guest.id);
      return live.board();
    },
  );

  app.post<{ Params: { id: string }; Body: { userId?: string; action: 'pause' | 'resume' } }>(
    '/sessions/:id/pause',
    async (req, reply) => {
      const live = await registry.getOrRestore(req.params.id);
      if (!live) return reply.code(400).send({ error: 'session not live' });
      const user = req.user as AuthUser;
      // players can pause themselves; hosts can pause anyone
      const target =
        req.body.userId && ['HOST', 'ADMIN'].includes(user.role) ? req.body.userId : user.id;
      live.pauseResume(target, req.body.action);
      return live.board();
    },
  );

  app.get<{ Params: { id: string } }>('/sessions/:id/board', async (req, reply) => {
    const live = await registry.getOrRestore(req.params.id);
    if (!live) return reply.code(404).send({ error: 'session not live' });
    return live.board();
  });

  // ── games ────────────────────────────────────────────────────────
  app.post<{
    Params: { id: string };
    Body: { courtId: string; teamA: [string, string]; teamB: [string, string]; exhibition?: boolean };
  }>(
    '/sessions/:id/assignments/manual',
    { preHandler: requireRole(...HOSTS) },
    async (req, reply) => {
      const blocked = await manageBlock(req.params.id, req.user as AuthUser);
      if (blocked) return reply.code(403).send({ error: blocked });
      const live = await registry.getOrRestore(req.params.id);
      if (!live) return reply.code(400).send({ error: 'session not live' });
      const user = req.user as AuthUser;
      const { courtId, teamA, teamB, exhibition } = req.body;
      const result = await live.manualGame(courtId, teamA, teamB, user.id, exhibition ?? false);
      return { ...live.board(), warnings: result.warnings };
    },
  );

  app.post<{
    Params: { id: string };
    Body: { sessionId: string; a?: number; b?: number; winner?: 'A' | 'B'; void?: boolean };
  }>(
    '/games/:id/finish',
    { preHandler: requireRole(...HOSTS) },
    async (req, reply) => {
      const blocked = await manageBlock(req.body.sessionId, req.user as AuthUser);
      if (blocked) return reply.code(403).send({ error: blocked });
      const live = await registry.getOrRestore(req.body.sessionId);
      if (!live) return reply.code(400).send({ error: 'session not live' });
      const scores =
        req.body.a !== undefined && req.body.b !== undefined
          ? { a: req.body.a, b: req.body.b }
          : null;
      await live.finishGame(req.params.id, scores, req.body.winner ?? null, req.body.void ?? false);
      return live.board();
    },
  );

  /** A player in the game reports the score → court freed, awaits confirmation. */
  app.post<{ Params: { id: string }; Body: { sessionId: string; a: number; b: number } }>(
    '/games/:id/report',
    async (req, reply) => {
      const user = req.user as AuthUser;
      const inGame = await prisma.gamePlayer.findUnique({
        where: { gameId_userId: { gameId: req.params.id, userId: user.id } },
      });
      if (!inGame) return reply.code(403).send({ error: 'you are not in this game' });
      const live = await registry.getOrRestore(req.body.sessionId);
      if (!live) return reply.code(400).send({ error: 'session not live' });
      await live.reportGame(req.params.id, { a: req.body.a, b: req.body.b }, user.id);
      return live.board();
    },
  );

  /** A player from the other team confirms → ratings apply. */
  app.post<{ Params: { id: string }; Body: { sessionId: string } }>(
    '/games/:id/confirm',
    async (req, reply) => {
      const user = req.user as AuthUser;
      const [inGame, game] = await Promise.all([
        prisma.gamePlayer.findUnique({
          where: { gameId_userId: { gameId: req.params.id, userId: user.id } },
        }),
        prisma.game.findUniqueOrThrow({
          where: { id: req.params.id },
          select: { reportedById: true, players: { select: { userId: true, team: true } } },
        }),
      ]);
      const isHost = ['HOST', 'ADMIN'].includes(user.role);
      if (!inGame && !isHost) return reply.code(403).send({ error: 'you are not in this game' });
      if (inGame && game.reportedById) {
        const reporterTeam = game.players.find((p: { userId: string; team: string }) => p.userId === game.reportedById)?.team;
        if (reporterTeam && inGame.team === reporterTeam && !isHost) {
          return reply.code(403).send({ error: 'the other team must confirm' });
        }
      }
      const live = await registry.getOrRestore(req.body.sessionId);
      if (!live) return reply.code(400).send({ error: 'session not live' });
      await live.confirmGame(req.params.id, user.id);
      return live.board();
    },
  );

  app.post<{ Params: { id: string }; Body: { sessionId: string } }>(
    '/games/:id/dispute',
    async (req, reply) => {
      const user = req.user as AuthUser;
      const inGame = await prisma.gamePlayer.findUnique({
        where: { gameId_userId: { gameId: req.params.id, userId: user.id } },
      });
      if (!inGame) return reply.code(403).send({ error: 'you are not in this game' });
      const live = await registry.getOrRestore(req.body.sessionId);
      if (!live) return reply.code(400).send({ error: 'session not live' });
      await live.disputeGame(req.params.id, user.id);
      return live.board();
    },
  );

  /** Host resolves a disputed (or any pending) game with final scores. */
  app.post<{ Params: { id: string }; Body: { sessionId: string; a: number; b: number } }>(
    '/games/:id/resolve',
    { preHandler: requireRole(...HOSTS) },
    async (req, reply) => {
      const user = req.user as AuthUser;
      const blocked = await manageBlock(req.body.sessionId, user);
      if (blocked) return reply.code(403).send({ error: blocked });
      const live = await registry.getOrRestore(req.body.sessionId);
      if (!live) return reply.code(400).send({ error: 'session not live' });
      await live.resolvePending(req.params.id, { a: req.body.a, b: req.body.b }, user.id);
      return live.board();
    },
  );

  app.patch<{ Params: { id: string }; Body: { sessionId: string; courtId: string } }>(
    '/games/:id/court',
    { preHandler: requireRole(...HOSTS) },
    async (req, reply) => {
      const blocked = await manageBlock(req.body.sessionId, req.user as AuthUser);
      if (blocked) return reply.code(403).send({ error: blocked });
      const live = await registry.getOrRestore(req.body.sessionId);
      if (!live) return reply.code(400).send({ error: 'session not live' });
      await live.moveGame(req.params.id, req.body.courtId);
      return live.board();
    },
  );

  app.get<{ Params: { id: string } }>('/sessions/:id/audit', { preHandler: requireRole(...HOSTS) }, async (req, reply) => {
    const blocked = await manageBlock(req.params.id, req.user as AuthUser);
    if (blocked) return reply.code(403).send({ error: blocked });
    return prisma.auditEvent.findMany({
      where: { sessionId: req.params.id },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  });
}
