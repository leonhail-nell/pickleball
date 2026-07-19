import { randomBytes } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { prisma } from '@pickleplay/db';
import { hashPassword, requireRole, type AuthUser } from '../auth.js';
import type { LiveSessionRegistry } from '../live/index.js';
import { performCheckIn, tierBlock, HOSTS } from './helpers.js';

/** QR tokens, host/self check-in, walk-in guests, and self/host pause. */
export function checkinRoutes(app: FastifyInstance, registry: LiveSessionRegistry) {
  // host: fetch the QR token to render the check-in code
  app.get<{ Params: { id: string } }>(
    '/sessions/:id/qr',
    { preHandler: requireRole(...HOSTS) },
    async (req) => {
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

  // host: check a member in by id
  app.post<{ Params: { id: string }; Body: { userId: string } }>(
    '/sessions/:id/checkin',
    { preHandler: requireRole(...HOSTS) },
    async (req, reply) => {
      const live = await registry.getOrRestore(req.params.id);
      if (!live) return reply.code(400).send({ error: 'session not live' });
      await performCheckIn(live, req.params.id, req.body.userId);
      return live.board();
    },
  );

  // host: add a walk-in guest by name (creates a lightweight account + checks in)
  app.post<{ Params: { id: string }; Body: { name: string; rating?: number } }>(
    '/sessions/:id/guests',
    { preHandler: requireRole(...HOSTS) },
    async (req, reply) => {
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

  // player self-pause; hosts can pause anyone
  app.post<{ Params: { id: string }; Body: { userId?: string; action: 'pause' | 'resume' } }>(
    '/sessions/:id/pause',
    async (req, reply) => {
      const live = await registry.getOrRestore(req.params.id);
      if (!live) return reply.code(400).send({ error: 'session not live' });
      const user = req.user as AuthUser;
      const target =
        req.body.userId && ['HOST', 'ADMIN'].includes(user.role) ? req.body.userId : user.id;
      live.pauseResume(target, req.body.action);
      return live.board();
    },
  );
}
