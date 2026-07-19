import { prisma } from '@pickleplay/db';
import { ensureSessionPayment } from '../club/service.js';
import type { LiveSession } from '../live/index.js';

/** Shared check-in path for host check-in and QR self check-in. */
export async function performCheckIn(live: LiveSession, sessionId: string, userId: string) {
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
  await live.checkIn({ id: user.id, name: user.name, rating: user.rating }, forceProrated);
  await live.fillCourts();
}

/** Leaderboard, PickleHub-style ranking: wins → win% → point differential. */
export async function computeStandings(sessionId: string) {
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

/** Tier gate for player-initiated joins (hosts can always override). */
export async function tierBlock(sessionId: string, userId: string): Promise<string | null> {
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

export const HOSTS = ['HOST', 'ADMIN'] as const;
