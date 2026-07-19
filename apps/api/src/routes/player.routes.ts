import type { FastifyInstance } from 'fastify';
import { prisma } from '@pickleplay/db';
import { hashPassword, requireRole, type AuthUser } from '../auth.js';
import type { LiveSessionRegistry } from '../live/index.js';
import { HOSTS } from './helpers.js';

/** Member management: list, create, edit, swap in-game, remove from session. */
export function playerRoutes(app: FastifyInstance, registry: LiveSessionRegistry) {
  // walk-in check-in support: host can search the member list
  app.get('/users', { preHandler: requireRole(...HOSTS) }, async () =>
    prisma.user.findMany({
      select: { id: true, name: true, email: true, rating: true, role: true, strikes: true, avatarUrl: true },
      orderBy: { name: 'asc' },
    }),
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
      const live = await registry.getOrRestore(req.params.id);
      if (!live) return reply.code(400).send({ error: 'session not live' });
      const user = req.user as AuthUser;
      await live.removePlayer(req.params.userId, user.id);
      return live.board();
    },
  );
}
