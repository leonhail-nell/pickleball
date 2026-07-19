import type { FastifyInstance } from 'fastify';
import { prisma } from '@pickleplay/db';
import { requireRole } from '../auth.js';
import { getClub, FREE_COURT_LIMIT } from './service.js';

/** Club config, Venue Pro trial, and membership plans. */
export function clubConfigRoutes(app: FastifyInstance) {
  // ── club config & Venue Pro ────────────────────────────────────────
  app.get('/club', async () => {
    const club = await getClub();
    return {
      name: club.name,
      venuePro: !!club.venueProUntil && club.venueProUntil > new Date(),
      venueProUntil: club.venueProUntil,
      freeCourtLimit: FREE_COURT_LIMIT,
    };
  });

  app.patch<{ Body: { name?: string } }>(
    '/club',
    { preHandler: requireRole('ADMIN') },
    async (req) => {
      await getClub();
      return prisma.clubConfig.update({
        where: { id: 'club' },
        data: { ...(req.body.name?.trim() ? { name: req.body.name.trim() } : {}) },
      });
    },
  );

  // 14-day Venue Pro trial (payment gateway hookup comes later)
  app.post('/club/venue-pro/trial', { preHandler: requireRole('ADMIN') }, async (req, reply) => {
    const club = await getClub();
    if (club.venueProUntil && club.venueProUntil > new Date()) {
      return reply.code(400).send({ error: 'Venue Pro is already active' });
    }
    const until = new Date();
    until.setDate(until.getDate() + 14);
    return prisma.clubConfig.update({
      where: { id: 'club' },
      data: { venueProUntil: until },
    });
  });

  // ── plans ──────────────────────────────────────────────────────────
  app.get('/plans', async () =>
    prisma.plan.findMany({ where: { isActive: true }, orderBy: { priceCents: 'asc' } }),
  );

  app.post<{ Body: { name: string; priceCents: number; period?: 'MONTHLY' | 'ANNUAL'; dropInFree?: boolean } }>(
    '/plans',
    { preHandler: requireRole('ADMIN') },
    async (req) =>
      prisma.plan.create({
        data: {
          name: req.body.name,
          priceCents: req.body.priceCents,
          period: req.body.period ?? 'MONTHLY',
          dropInFree: req.body.dropInFree ?? true,
        },
      }),
  );
}
