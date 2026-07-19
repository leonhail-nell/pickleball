import type { FastifyInstance } from 'fastify';
import { prisma } from '@pickleplay/db';
import { requireRole, type AuthUser } from '../auth.js';
import type { LiveSessionRegistry } from '../live/index.js';

/** Admin dashboard stats and the signed-in player's profile + stats. */
export function profileRoutes(app: FastifyInstance, registry?: LiveSessionRegistry) {
  // ── admin dashboard ─────────────────────────────────────────────────
  app.get('/admin/stats', { preHandler: requireRole('ADMIN') }, async () => {
    const [sessions, players, games, paid, pending, members, recent] = await Promise.all([
      prisma.openSession.count(),
      prisma.user.count(),
      prisma.game.count({ where: { status: 'FINAL', isExhibition: false } }),
      prisma.payment.aggregate({ where: { status: 'PAID' }, _sum: { amountCents: true } }),
      prisma.payment.aggregate({ where: { status: 'PENDING' }, _sum: { amountCents: true } }),
      prisma.membership.count({ where: { endsAt: { gt: new Date() } } }),
      prisma.openSession.findMany({
        orderBy: { startsAt: 'desc' },
        take: 20,
        include: {
          _count: { select: { signups: { where: { status: 'CHECKED_IN' } } } },
          games: { where: { status: 'FINAL' }, select: { id: true } },
          payments: { where: { status: 'PAID' }, select: { amountCents: true } },
        },
      }),
    ]);
    type R = (typeof recent)[number];
    return {
      totals: {
        sessions,
        players,
        games,
        revenueCents: paid._sum.amountCents ?? 0,
        pendingCents: pending._sum.amountCents ?? 0,
        activeMemberships: members,
      },
      sessions: (recent as R[]).map((s) => ({
        id: s.id,
        title: s.title,
        startsAt: s.startsAt,
        status: s.status,
        checkedIn: s._count.signups,
        games: s.games.length,
        revenueCents: s.payments.reduce((sum: number, p: { amountCents: number }) => sum + p.amountCents, 0),
      })),
    };
  });

  // ── my profile ──────────────────────────────────────────────────────
  app.patch<{ Body: { name?: string; rating?: number; avatar?: string | null } }>(
    '/me',
    async (req, reply) => {
      const user = req.user as AuthUser;
      const { name, rating, avatar } = req.body;
      if (avatar && avatar.length > 200_000) {
        return reply.code(413).send({ error: 'photo too large — please pick a smaller one' });
      }
      if (avatar && !avatar.startsWith('data:image/')) {
        return reply.code(400).send({ error: 'invalid photo' });
      }
      const clamped = rating != null ? Math.min(5.5, Math.max(1.5, rating)) : undefined;
      const updated = await prisma.user.update({
        where: { id: user.id },
        data: {
          ...(name?.trim() ? { name: name.trim() } : {}),
          ...(clamped != null ? { rating: clamped } : {}),
          ...(avatar !== undefined ? { avatarUrl: avatar } : {}),
        },
        select: { id: true, name: true, rating: true, avatarUrl: true, role: true },
      });
      // reflect into any live session
      if (registry) {
        for (const live of registry.all()) {
          await live.updatePlayer(updated.id, updated.name, updated.rating).catch(() => {});
        }
      }
      return updated;
    },
  );

  // ── player stats ────────────────────────────────────────────────────
  app.get('/me/stats', async (req) => {
    const user = req.user as AuthUser;
    const gps = await prisma.gamePlayer.findMany({
      where: { userId: user.id, game: { status: 'FINAL', isExhibition: false } },
      include: { game: { select: { winner: true, sessionId: true, endedAt: true } } },
      orderBy: { gameId: 'asc' },
    });
    type GPRow = (typeof gps)[number];
    const rows = gps as GPRow[];
    const wins = rows.filter((g) => g.game.winner === g.team).length;
    const ratingHistory = rows
      .filter((g) => g.ratingAfter != null)
      .map((g) => ({ at: g.game.endedAt, rating: g.ratingAfter }));
    const me = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { name: true, rating: true, strikes: true, createdAt: true, avatarUrl: true },
    });
    return {
      ...me,
      games: rows.length,
      wins,
      losses: rows.length - wins,
      winPct: rows.length ? wins / rows.length : 0,
      sessions: new Set(rows.map((g) => g.game.sessionId)).size,
      ratingHistory,
    };
  });
}
