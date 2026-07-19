import type { FastifyInstance } from 'fastify';
import { prisma } from '@pickleplay/db';
import { requireRole, type AuthUser } from '../auth.js';
import { venueProActive, FREE_COURT_LIMIT } from '../club/service.js';
import type { LiveSessionRegistry } from '../live/index.js';
import { HOSTS } from './helpers.js';

/** Host: attach/detach courts and pause/resume auto-rotation. */
export function courtRoutes(app: FastifyInstance, registry: LiveSessionRegistry) {
  // host: pause/resume auto-rotation
  app.post<{ Params: { id: string }; Body: { action: 'pause' | 'resume' } }>(
    '/sessions/:id/rotations',
    { preHandler: requireRole(...HOSTS) },
    async (req, reply) => {
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

  // host: detach a court from a live session. `?force=1` voids any live game first.
  app.delete<{ Params: { id: string; courtId: string }; Querystring: { force?: string } }>(
    '/sessions/:id/courts/:courtId',
    { preHandler: requireRole(...HOSTS) },
    async (req, reply) => {
      const live = await registry.getOrRestore(req.params.id);
      if (!live) return reply.code(400).send({ error: 'session not live' });
      const user = req.user as AuthUser;
      const force = req.query.force === '1' || req.query.force === 'true';
      await live.removeCourt(req.params.courtId, user.id, force);
      return live.board();
    },
  );
}
