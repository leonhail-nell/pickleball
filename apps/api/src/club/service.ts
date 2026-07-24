import { prisma } from '@pickleplay/db';

/** Ensure a drop-in payment row exists for a paid session (idempotent).
 *  Active members on a drop-in-free plan are auto-waived. */
export async function ensureSessionPayment(sessionId: string, userId: string): Promise<void> {
  const session = await prisma.openSession.findUniqueOrThrow({
    where: { id: sessionId },
    select: { priceCents: true, clubId: true },
  });
  if (session.priceCents <= 0) return;
  const activeMembership = await prisma.membership.findFirst({
    where: {
      userId,
      endsAt: { gt: new Date() },
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

export const FREE_COURT_LIMIT = 5;

export async function getClub() {
  return prisma.clubConfig.upsert({
    where: { id: 'club' },
    update: {},
    create: { id: 'club' },
  });
}

export async function venueProActive(): Promise<boolean> {
  const club = await getClub();
  return !!club.venueProUntil && club.venueProUntil > new Date();
}
