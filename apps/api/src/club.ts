import type { FastifyInstance } from 'fastify';
import type { LiveSessionRegistry } from './live.js';
import { prisma } from '@pickleplay/db';
import { requireRole, manageBlock, type AuthUser } from './auth.js';

const HOSTS = ['HOST', 'ADMIN'] as const;

/** Venue Pro price: ₱1,499 per month. */
export const PRO_PRICE_CENTS = 149_900;

/** Court-theme keys a Venue Pro club may customize (hex colors only). */
const THEME_KEYS = ['frame', 'slot', 'kitchen', 'netA', 'netB', 'netEdge', 'star', 'chipBg', 'chipText'] as const;
const HEX_COLOR = /^#[0-9a-fA-F]{3,8}$/;

function sanitizeTheme(input: unknown): Record<string, string> | null {
  if (input == null || typeof input !== 'object') return null;
  const out: Record<string, string> = {};
  for (const key of THEME_KEYS) {
    const v = (input as Record<string, unknown>)[key];
    if (typeof v === 'string' && HEX_COLOR.test(v)) out[key] = v;
  }
  return out;
}

/** Ensure a drop-in payment row exists for a paid session (idempotent).
 *  Active members on a drop-in-free plan are auto-waived. */
export async function ensureSessionPayment(sessionId: string, userId: string): Promise<void> {
  const session = await prisma.openSession.findUniqueOrThrow({
    where: { id: sessionId },
    select: { priceCents: true, clubId: true },
  });
  if (session.priceCents <= 0) return;
  // members of *this session's club* on a drop-in-free plan are auto-waived
  const activeMembership = await prisma.membership.findFirst({
    where: {
      userId, endsAt: { gt: new Date() },
      ...(session.clubId ? { clubId: session.clubId } : {}),
      plan: { dropInFree: true, isActive: true },
    },
  });
  await prisma.payment.upsert({
    where: { userId_sessionId: { userId, sessionId } },
    update: {},
    create: {
      userId,
      sessionId,
      amountCents: activeMembership ? 0 : session.priceCents,
      status: activeMembership ? 'WAIVED' : 'PENDING',
    },
  });
}

export const FREE_COURT_LIMIT = 4;

interface Club {
  id: string; name: string; ownerId: string;
  venueProUntil: Date | null; theme: unknown;
}

/**
 * The club owned by an organizer (HOST/ADMIN). Created lazily on first access,
 * seeded with 4 courts so a brand-new organizer can run play immediately.
 */
export async function getOrCreateClubForOwner(user: { id: string; name?: string }): Promise<Club> {
  const existing = await prisma.club.findUnique({ where: { ownerId: user.id } });
  if (existing) return existing as Club;
  const club = await prisma.club.create({
    data: { ownerId: user.id, name: user.name ? `${user.name}'s Club` : 'My Club' },
  });
  // seed this club's own courts (numbers are unique within a club)
  await prisma.court.createMany({
    data: [1, 2, 3, 4].map((n) => ({ clubId: club.id, number: n, label: '' })),
  });
  return club as Club;
}

/** The club whose data a request operates on: the owner's club for organizers. */
export async function callerClub(user: AuthUser & { name?: string }): Promise<Club> {
  return getOrCreateClubForOwner(user);
}

export function venueProActiveForClub(club: Club): boolean {
  return !!club.venueProUntil && club.venueProUntil > new Date();
}

/** Back-compat: Pro status for the caller's own club. */
export async function venueProActive(user: AuthUser): Promise<boolean> {
  return venueProActiveForClub(await callerClub(user));
}

/**
 * Member of a specific club = the club owner, or a user with a membership
 * record in that club (comp or paid). A self-registered user is NOT a member
 * of someone else's club until that club adds them.
 */
export async function isClubMemberOf(
  user: { id: string; role: string } | null | undefined,
  clubId: string | null | undefined,
): Promise<boolean> {
  if (!user || !clubId) return false;
  const club = await prisma.club.findUnique({ where: { id: clubId }, select: { ownerId: true } });
  if (club?.ownerId === user.id) return true;
  const m = await prisma.membership.findFirst({
    where: { userId: user.id, clubId },
    select: { id: true },
  });
  return !!m;
}

/** The full club dashboard (stats, plans, members) is admin-or-Venue-Pro. */
export async function requireDashboard(user: AuthUser & { name?: string }): Promise<string | null> {
  if (user.role === 'ADMIN') return null;
  const club = await callerClub(user);
  return venueProActiveForClub(club)
    ? null
    : 'The full club dashboard (stats, plans & members) is a Venue Pro feature — upgrade to unlock it.';
}

/** A club's built-in $0 "Club Member" plan (auto-created), used to add members. */
export async function getOrCreateCompPlan(clubId: string): Promise<{ id: string }> {
  const existing = await prisma.plan.findFirst({ where: { clubId, name: 'Club Member' }, select: { id: true } });
  if (existing) return existing;
  return prisma.plan.create({
    data: { clubId, name: 'Club Member', priceCents: 0, dropInFree: false, isActive: false },
    select: { id: true },
  });
}

export function clubRoutes(app: FastifyInstance, registry?: LiveSessionRegistry) {
  // ── club config & Venue Pro (per-organizer club) ──────────────────
  app.get('/club', { preHandler: requireRole(...HOSTS) }, async (req) => {
    const club = await callerClub(req.user as AuthUser & { name?: string });
    return {
      id: club.id,
      name: club.name,
      venuePro: venueProActiveForClub(club),
      venueProUntil: club.venueProUntil,
      freeCourtLimit: FREE_COURT_LIMIT,
      theme: (club.theme as Record<string, string> | null) ?? {},
      proPriceCents: PRO_PRICE_CENTS,
      providers: {
        stripe: !!process.env.STRIPE_SECRET_KEY,
        paymongo: !!process.env.PAYMONGO_SECRET_KEY, // GCash + Maya
      },
    };
  });

  app.patch<{ Body: { name?: string; theme?: Record<string, string> | null } }>(
    '/club',
    { preHandler: requireRole(...HOSTS) },
    async (req, reply) => {
      const club = await callerClub(req.user as AuthUser & { name?: string });
      let themePatch: Record<string, unknown> = {};
      if (req.body.theme !== undefined) {
        if (!venueProActiveForClub(club)) {
          return reply.code(402).send({ error: 'Custom court themes are a Venue Pro feature — upgrade to unlock them.' });
        }
        themePatch = { theme: req.body.theme === null ? {} : (sanitizeTheme(req.body.theme) ?? {}) };
      }
      return prisma.club.update({
        where: { id: club.id },
        data: {
          ...(req.body.name?.trim() ? { name: req.body.name.trim() } : {}),
          ...themePatch,
        },
      });
    },
  );

  // ── Venue Pro checkout (Stripe card, GCash/Maya via PayMongo) ──────
  app.post<{ Body: { provider: 'stripe' | 'gcash' | 'maya'; months?: number } }>(
    '/club/venue-pro/checkout',
    { preHandler: requireRole(...HOSTS) },
    async (req, reply) => {
      const provider = req.body.provider;
      const months = Math.min(12, Math.max(1, req.body.months ?? 1));
      // annual (12 months) gets 17% off
      const amount = months === 12 ? Math.round(PRO_PRICE_CENTS * 12 * 0.83) : PRO_PRICE_CENTS * months;
      const origin = (req.headers.origin as string | undefined) ?? process.env.WEB_ORIGIN ?? 'http://localhost:3000';
      const label = `PicklePlay Venue Pro — ${months} month${months > 1 ? 's' : ''}`;

      const club = await callerClub(req.user as AuthUser & { name?: string });
      const order = await prisma.proOrder.create({
        data: {
          clubId: club.id,
          provider: provider.toUpperCase(),
          months,
          amountCents: amount,
          createdById: (req.user as AuthUser).id,
        },
      });

      if (provider === 'stripe') {
        const key = process.env.STRIPE_SECRET_KEY;
        if (!key) {
          return reply.code(501).send({ error: 'Card payments are not configured yet — set STRIPE_SECRET_KEY in apps/api/.env.' });
        }
        const params = new URLSearchParams({
          mode: 'payment',
          'line_items[0][price_data][currency]': 'php',
          'line_items[0][price_data][product_data][name]': label,
          'line_items[0][price_data][unit_amount]': String(amount),
          'line_items[0][quantity]': '1',
          success_url: `${origin}/admin?pro_order=${order.id}`,
          cancel_url: `${origin}/admin?pro_cancel=1`,
        });
        const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
          method: 'POST',
          headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/x-www-form-urlencoded' },
          body: params.toString(),
        });
        const data = (await res.json()) as { id?: string; url?: string; error?: { message?: string } };
        if (!res.ok || !data.url) {
          return reply.code(502).send({ error: data.error?.message ?? 'Stripe checkout could not be created.' });
        }
        await prisma.proOrder.update({ where: { id: order.id }, data: { providerRef: data.id } });
        return { url: data.url, orderId: order.id };
      }

      // GCash / Maya ride on PayMongo checkout sessions
      const key = process.env.PAYMONGO_SECRET_KEY;
      if (!key) {
        return reply.code(501).send({ error: 'GCash/Maya payments are not configured yet — set PAYMONGO_SECRET_KEY in apps/api/.env.' });
      }
      const res = await fetch('https://api.paymongo.com/v1/checkout_sessions', {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${key}:`).toString('base64')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          data: {
            attributes: {
              payment_method_types: [provider === 'gcash' ? 'gcash' : 'paymaya'],
              line_items: [{ name: label, amount, currency: 'PHP', quantity: 1 }],
              description: 'PicklePlay Venue Pro subscription',
              success_url: `${origin}/admin?pro_order=${order.id}`,
              cancel_url: `${origin}/admin?pro_cancel=1`,
            },
          },
        }),
      });
      const data = (await res.json()) as {
        data?: { id: string; attributes?: { checkout_url?: string } };
        errors?: { detail?: string }[];
      };
      const url = data.data?.attributes?.checkout_url;
      if (!res.ok || !url) {
        return reply.code(502).send({ error: data.errors?.[0]?.detail ?? 'PayMongo checkout could not be created.' });
      }
      await prisma.proOrder.update({ where: { id: order.id }, data: { providerRef: data.data!.id } });
      return { url, orderId: order.id };
    },
  );

  /** After the gateway redirects back, verify payment and extend Venue Pro. */
  app.post<{ Params: { orderId: string } }>(
    '/club/venue-pro/verify/:orderId',
    { preHandler: requireRole(...HOSTS) },
    async (req, reply) => {
      const order = await prisma.proOrder.findUnique({ where: { id: req.params.orderId } });
      if (!order) return reply.code(404).send({ error: 'order not found' });
      const club = await callerClub(req.user as AuthUser & { name?: string });
      if (order.clubId && order.clubId !== club.id) {
        return reply.code(403).send({ error: 'this order belongs to another club' });
      }
      if (order.status === 'PAID') {
        return { ok: true, venueProUntil: club.venueProUntil };
      }
      if (!order.providerRef) return reply.code(400).send({ error: 'order was never sent to the gateway' });

      let paid = false;
      if (order.provider === 'STRIPE') {
        const key = process.env.STRIPE_SECRET_KEY;
        if (!key) return reply.code(501).send({ error: 'Stripe is not configured' });
        const res = await fetch(`https://api.stripe.com/v1/checkout/sessions/${order.providerRef}`, {
          headers: { Authorization: `Bearer ${key}` },
        });
        const data = (await res.json()) as { payment_status?: string };
        paid = data.payment_status === 'paid';
      } else {
        const key = process.env.PAYMONGO_SECRET_KEY;
        if (!key) return reply.code(501).send({ error: 'PayMongo is not configured' });
        const res = await fetch(`https://api.paymongo.com/v1/checkout_sessions/${order.providerRef}`, {
          headers: { Authorization: `Basic ${Buffer.from(`${key}:`).toString('base64')}` },
        });
        const data = (await res.json()) as {
          data?: { attributes?: { payments?: { attributes?: { status?: string } }[] } };
        };
        paid = (data.data?.attributes?.payments ?? []).some((p) => p.attributes?.status === 'paid');
      }

      if (!paid) return reply.code(402).send({ error: 'Payment not completed yet — finish checkout and try again.' });

      const base = club.venueProUntil && club.venueProUntil > new Date()
        ? new Date(club.venueProUntil)
        : new Date();
      base.setMonth(base.getMonth() + order.months);
      await prisma.club.update({ where: { id: club.id }, data: { venueProUntil: base } });
      await prisma.proOrder.update({
        where: { id: order.id },
        data: { status: 'PAID', paidAt: new Date() },
      });
      return { ok: true, venueProUntil: base };
    },
  );

  // 14-day Venue Pro trial — starts it for the organizer's own club
  app.post('/club/venue-pro/trial', { preHandler: requireRole(...HOSTS) }, async (req, reply) => {
    const club = await callerClub(req.user as AuthUser & { name?: string });
    if (venueProActiveForClub(club)) {
      return reply.code(400).send({ error: 'Venue Pro is already active' });
    }
    const until = new Date();
    until.setDate(until.getDate() + 14);
    return prisma.club.update({ where: { id: club.id }, data: { venueProUntil: until } });
  });

  // cancel Venue Pro — ends the entitlement now and reverts the club to the free plan
  app.post('/club/venue-pro/cancel', { preHandler: requireRole(...HOSTS) }, async (req) => {
    const club = await callerClub(req.user as AuthUser & { name?: string });
    return prisma.club.update({ where: { id: club.id }, data: { venueProUntil: null } });
  });
  // ── plans (per club) ────────────────────────────────────────────────
  app.get('/plans', { preHandler: requireRole(...HOSTS) }, async (req) => {
    const club = await callerClub(req.user as AuthUser & { name?: string });
    return prisma.plan.findMany({
      where: { isActive: true, clubId: club.id },
      orderBy: { priceCents: 'asc' },
    });
  });

  app.post<{ Body: { name: string; priceCents: number; period?: 'MONTHLY' | 'ANNUAL'; dropInFree?: boolean } }>(
    '/plans',
    { preHandler: requireRole(...HOSTS) },
    async (req, reply) => {
      const gate = await requireDashboard(req.user as AuthUser & { name?: string });
      if (gate) return reply.code(402).send({ error: gate });
      const club = await callerClub(req.user as AuthUser & { name?: string });
      return prisma.plan.create({
        data: {
          clubId: club.id,
          name: req.body.name,
          priceCents: req.body.priceCents,
          period: req.body.period ?? 'MONTHLY',
          dropInFree: req.body.dropInFree ?? true,
        },
      });
    },
  );

  // ── memberships (admin grants; gateway checkout later) ─────────────
  app.post<{ Body: { userId: string; planId: string; months?: number } }>(
    '/memberships',
    { preHandler: requireRole(...HOSTS) },
    async (req, reply) => {
      const gate = await requireDashboard(req.user as AuthUser & { name?: string });
      if (gate) return reply.code(402).send({ error: gate });
      const club = await callerClub(req.user as AuthUser & { name?: string });
      const plan = await prisma.plan.findUniqueOrThrow({ where: { id: req.body.planId } });
      const months = req.body.months ?? (plan.period === 'ANNUAL' ? 12 : 1);
      const endsAt = new Date();
      endsAt.setMonth(endsAt.getMonth() + months);
      const membership = await prisma.membership.create({
        data: { clubId: club.id, userId: req.body.userId, planId: plan.id, endsAt },
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
    async (req, reply) => {
      const blocked = await manageBlock(req.params.id, req.user as AuthUser);
      if (blocked) return reply.code(403).send({ error: blocked });
      return prisma.payment.findMany({
        where: { sessionId: req.params.id },
        include: { user: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'asc' },
      });
    },
  );

  app.post<{ Params: { id: string }; Body: { method?: string; waive?: boolean } }>(
    '/payments/:id/pay',
    { preHandler: requireRole(...HOSTS) },
    async (req, reply) => {
      const payment = await prisma.payment.findUnique({
        where: { id: req.params.id },
        select: { sessionId: true },
      });
      if (!payment) return reply.code(404).send({ error: 'payment not found' });
      if (payment.sessionId) {
        const blocked = await manageBlock(payment.sessionId, req.user as AuthUser);
        if (blocked) return reply.code(403).send({ error: blocked });
      }
      return prisma.payment.update({
        where: { id: req.params.id },
        data: req.body.waive
          ? { status: 'WAIVED' }
          : { status: 'PAID', method: req.body.method ?? 'CASH', paidAt: new Date() },
      });
    },
  );

  // ── club dashboard stats (this club only; admin or Venue Pro) ───────
  app.get('/admin/stats', { preHandler: requireRole(...HOSTS) }, async (req, reply) => {
    const gate = await requireDashboard(req.user as AuthUser & { name?: string });
    if (gate) return reply.code(402).send({ error: gate });
    const club = await callerClub(req.user as AuthUser & { name?: string });
    const inClub = { clubId: club.id };
    const [sessions, games, paid, pending, members, recent] = await Promise.all([
      prisma.openSession.count({ where: inClub }),
      prisma.game.count({ where: { status: 'FINAL', isExhibition: false, session: inClub } }),
      prisma.payment.aggregate({ where: { status: 'PAID', session: inClub }, _sum: { amountCents: true } }),
      prisma.payment.aggregate({ where: { status: 'PENDING', session: inClub }, _sum: { amountCents: true } }),
      prisma.membership.count({ where: { endsAt: { gt: new Date() }, clubId: club.id } }),
      prisma.openSession.findMany({
        where: inClub,
        orderBy: { startsAt: 'desc' },
        take: 20,
        include: {
          _count: { select: { signups: { where: { status: 'CHECKED_IN' } } } },
          games: { where: { status: 'FINAL' }, select: { id: true } },
          payments: { where: { status: 'PAID' }, select: { amountCents: true } },
        },
      }),
    ]);
    // players = everyone who has ever signed up for one of this club's sessions
    const players = (await prisma.signup.findMany({
      where: { session: inClub }, select: { userId: true }, distinct: ['userId'],
    })).length;
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
          await live.updatePlayer(updated.id, updated.name, updated.rating, updated.avatarUrl ?? null).catch(() => {});
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
