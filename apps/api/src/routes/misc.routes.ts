import type { FastifyInstance } from 'fastify';
import { prisma } from '@pickleplay/db';
import { requireRole } from '../auth.js';
import { computeStandings, HOSTS } from './helpers.js';

/** Public read endpoints: courts, landing stats, standings, and match history. */
export function miscRoutes(app: FastifyInstance) {
  app.get('/courts', async () => prisma.court.findMany({ orderBy: { number: 'asc' } }));

  // public landing-page stats
  app.get('/stats', async () => {
    const [sessions, players, games] = await Promise.all([
      prisma.openSession.count(),
      prisma.user.count(),
      prisma.game.count({ where: { status: 'FINAL' } }),
    ]);
    return { sessions, players, games };
  });

  // public leaderboard (live and completed sessions)
  app.get<{ Params: { id: string } }>('/sessions/:id/standings', async (req) =>
    computeStandings(req.params.id),
  );

  // public per-player match history (tap a leaderboard row)
  app.get<{ Params: { id: string; userId: string } }>(
    '/sessions/:id/players/:userId/games',
    async (req) => {
      const games = await prisma.game.findMany({
        where: {
          sessionId: req.params.id,
          status: 'FINAL',
          isExhibition: false,
          players: { some: { userId: req.params.userId } },
        },
        include: {
          players: { include: { user: { select: { name: true } } } },
          court: { select: { number: true } },
        },
        orderBy: { endedAt: 'asc' },
      });
      type P = { team: string; userId: string; user: { name: string } };
      type G = {
        id: string; winner: string | null; teamAScore: number | null; teamBScore: number | null;
        endedAt: Date | null; players: P[]; court: { number: number };
      };
      return (games as G[]).map((g) => {
        const me = (g.players as P[]).find((p) => p.userId === req.params.userId)!;
        const partner = (g.players as P[]).find((p) => p.team === me.team && p.userId !== me.userId);
        const opponents = (g.players as P[]).filter((p) => p.team !== me.team);
        const myScore = me.team === 'A' ? g.teamAScore : g.teamBScore;
        const theirScore = me.team === 'A' ? g.teamBScore : g.teamAScore;
        return {
          gameId: g.id,
          court: g.court.number,
          win: g.winner === me.team,
          myScore, theirScore,
          partner: partner?.user.name ?? '—',
          opponents: opponents.map((o) => o.user.name),
          endedAt: g.endedAt,
        };
      });
    },
  );

  // host: session audit log
  app.get<{ Params: { id: string } }>(
    '/sessions/:id/audit',
    { preHandler: requireRole(...HOSTS) },
    async (req) =>
      prisma.auditEvent.findMany({
        where: { sessionId: req.params.id },
        orderBy: { createdAt: 'desc' },
        take: 200,
      }),
  );
}
