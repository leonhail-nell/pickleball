import { randomBytes } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { prisma } from '@pickleplay/db';
import { requireRole, type AuthUser } from '../auth.js';
import { ensureSessionPayment, venueProActive, FREE_COURT_LIMIT } from '../club/service.js';
import type { LiveSessionRegistry } from '../live/index.js';
import { tierBlock, HOSTS } from './helpers.js';

/** Session lifecycle: list, detail, create, delete, signups, start/close, board. */
export function sessionRoutes(app: FastifyInstance, registry: LiveSessionRegistry) {
  app.get('/sessions', async () =>
    prisma.openSession.findMany({
      orderBy: { startsAt: 'desc' },
      include: { courts: { include: { court: true } }, _count: { select: { signups: true } } },
    }),
  );

  // public session detail (event page)
  app.get<{ Params: { id: string } }>('/sessions/:id', async (req, reply) => {
    const s = await prisma.openSession.findUnique({
      where: { id: req.params.id },
      include: {
        courts: { include: { court: true } },
        _count: { select: { signups: { where: { status: { in: ['SIGNED_UP', 'CHECKED_IN'] } } } } },
      },
    });
    if (!s) return reply.code(404).send({ error: 'not found' });
    const { seed, engineState, qrToken, ...pub } = s as Record<string, unknown>;
    return pub;
  });

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
      const { title, description, organizer, priceCents } = req.body as {
        title?: string; description?: string; organizer?: string; priceCents?: number;
      };
      return prisma.openSession.create({
        data: {
          title: title || 'Open Play',
          description: description ?? '',
          organizer: organizer ?? '',
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
      include: { user: { select: { id: true, name: true, rating: true } } },
    }),
  );

  // ── live session control (host) ──────────────────────────────────
  app.post<{ Params: { id: string } }>(
    '/sessions/:id/start',
    { preHandler: requireRole(...HOSTS) },
    async (req) => {
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

  app.post<{ Params: { id: string } }>(
    '/sessions/:id/close',
    { preHandler: requireRole(...HOSTS) },
    async (req) => {
      const { seed } = await registry.close(req.params.id);
      return { ok: true, seedRevealed: seed };
    },
  );

  app.get<{ Params: { id: string } }>('/sessions/:id/board', async (req, reply) => {
    const live = await registry.getOrRestore(req.params.id);
    if (!live) return reply.code(404).send({ error: 'session not live' });
    return live.board();
  });
}
