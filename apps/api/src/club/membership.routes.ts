import type { FastifyInstance } from 'fastify';
import { prisma } from '@pickleplay/db';
import { requireRole, type AuthUser } from '../auth.js';

const HOSTS = ['HOST', 'ADMIN'] as const;

/** Membership grants, per-user signup/membership lookups, and session payments. */
export function membershipRoutes(app: FastifyInstance) {
  // ── memberships (admin grants; gateway checkout later) ─────────────
  app.post<{ Body: { userId: string; planId: string; months?: number } }>(
    '/memberships',
    { preHandler: requireRole('ADMIN') },
    async (req) => {
      const plan = await prisma.plan.findUniqueOrThrow({ where: { id: req.body.planId } });
      const months = req.body.months ?? (plan.period === 'ANNUAL' ? 12 : 1);
      const endsAt = new Date();
      endsAt.setMonth(endsAt.getMonth() + months);
      const membership = await prisma.membership.create({
        data: { userId: req.body.userId, planId: plan.id, endsAt },
      });
      await prisma.payment.create({
        data: {
          userId: req.body.userId,
          membershipId: membership.id,
          amountCents: plan.priceCents * (plan.period === 'ANNUAL' ? 1 : months),
          status: 'PAID',
          method: 'CASH',
          paidAt: new Date(),
        },
      });
      return membership;
    },
  );

  // which sessions am I signed up for? (drives "Joined ✓" button states)
  app.get('/me/signups', async (req) => {
    const user = req.user as AuthUser;
    return prisma.signup.findMany({
      where: { userId: user.id, status: { in: ['SIGNED_UP', 'WAITLISTED', 'CHECKED_IN'] } },
      select: { sessionId: true, status: true },
    });
  });

  app.get('/me/membership', async (req) => {
    const user = req.user as AuthUser;
    return prisma.membership.findFirst({
      where: { userId: user.id, endsAt: { gt: new Date() } },
      include: { plan: true },
      orderBy: { endsAt: 'desc' },
    });
  });

  // ── session payments (host marks cash/GCash at the desk) ───────────
  app.get<{ Params: { id: string } }>(
    '/sessions/:id/payments',
    { preHandler: requireRole(...HOSTS) },
    async (req) =>
      prisma.payment.findMany({
        where: { sessionId: req.params.id },
        include: { user: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'asc' },
      }),
  );

  app.post<{ Params: { id: string }; Body: { method?: string; waive?: boolean } }>(
    '/payments/:id/pay',
    { preHandler: requireRole(...HOSTS) },
    async (req) =>
      prisma.payment.update({
        where: { id: req.params.id },
        data: req.body.waive
          ? { status: 'WAIVED' }
          : { status: 'PAID', method: req.body.method ?? 'CASH', paidAt: new Date() },
      }),
  );
}
