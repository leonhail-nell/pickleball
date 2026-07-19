import type { FastifyInstance } from 'fastify';
import { prisma } from '@pickleplay/db';
import { requireRole, type AuthUser } from '../auth.js';
import type { LiveSessionRegistry } from '../live/index.js';
import { HOSTS } from './helpers.js';

/** Game lifecycle: manual pairing, finish, report/confirm/dispute/resolve, move. */
export function gameRoutes(app: FastifyInstance, registry: LiveSessionRegistry) {
  app.post<{
    Params: { id: string };
    Body: { courtId: string; teamA: [string, string]; teamB: [string, string]; exhibition?: boolean };
  }>(
    '/sessions/:id/assignments/manual',
    { preHandler: requireRole(...HOSTS) },
    async (req, reply) => {
      const live = await registry.getOrRestore(req.params.id);
      if (!live) return reply.code(400).send({ error: 'session not live' });
      const user = req.user as AuthUser;
      const { courtId, teamA, teamB, exhibition } = req.body;
      const result = await live.manualGame(courtId, teamA, teamB, user.id, exhibition ?? false);
      return { ...live.board(), warnings: result.warnings };
    },
  );

  app.post<{
    Params: { id: string };
    Body: { sessionId: string; a?: number; b?: number; winner?: 'A' | 'B'; void?: boolean };
  }>(
    '/games/:id/finish',
    { preHandler: requireRole(...HOSTS) },
    async (req, reply) => {
      const live = await registry.getOrRestore(req.body.sessionId);
      if (!live) return reply.code(400).send({ error: 'session not live' });
      const scores =
        req.body.a !== undefined && req.body.b !== undefined
          ? { a: req.body.a, b: req.body.b }
          : null;
      await live.finishGame(req.params.id, scores, req.body.winner ?? null, req.body.void ?? false);
      return live.board();
    },
  );

  /** A player in the game reports the score → court freed, awaits confirmation. */
  app.post<{ Params: { id: string }; Body: { sessionId: string; a: number; b: number } }>(
    '/games/:id/report',
    async (req, reply) => {
      const user = req.user as AuthUser;
      const inGame = await prisma.gamePlayer.findUnique({
        where: { gameId_userId: { gameId: req.params.id, userId: user.id } },
      });
      if (!inGame) return reply.code(403).send({ error: 'you are not in this game' });
      const live = await registry.getOrRestore(req.body.sessionId);
      if (!live) return reply.code(400).send({ error: 'session not live' });
      await live.reportGame(req.params.id, { a: req.body.a, b: req.body.b }, user.id);
      return live.board();
    },
  );

  /** A player from the other team confirms → ratings apply. */
  app.post<{ Params: { id: string }; Body: { sessionId: string } }>(
    '/games/:id/confirm',
    async (req, reply) => {
      const user = req.user as AuthUser;
      const [inGame, game] = await Promise.all([
        prisma.gamePlayer.findUnique({
          where: { gameId_userId: { gameId: req.params.id, userId: user.id } },
        }),
        prisma.game.findUniqueOrThrow({
          where: { id: req.params.id },
          select: { reportedById: true, players: { select: { userId: true, team: true } } },
        }),
      ]);
      const isHost = ['HOST', 'ADMIN'].includes(user.role);
      if (!inGame && !isHost) return reply.code(403).send({ error: 'you are not in this game' });
      if (inGame && game.reportedById) {
        const reporterTeam = game.players.find((p: { userId: string; team: string }) => p.userId === game.reportedById)?.team;
        if (reporterTeam && inGame.team === reporterTeam && !isHost) {
          return reply.code(403).send({ error: 'the other team must confirm' });
        }
      }
      const live = await registry.getOrRestore(req.body.sessionId);
      if (!live) return reply.code(400).send({ error: 'session not live' });
      await live.confirmGame(req.params.id, user.id);
      return live.board();
    },
  );

  app.post<{ Params: { id: string }; Body: { sessionId: string } }>(
    '/games/:id/dispute',
    async (req, reply) => {
      const user = req.user as AuthUser;
      const inGame = await prisma.gamePlayer.findUnique({
        where: { gameId_userId: { gameId: req.params.id, userId: user.id } },
      });
      if (!inGame) return reply.code(403).send({ error: 'you are not in this game' });
      const live = await registry.getOrRestore(req.body.sessionId);
      if (!live) return reply.code(400).send({ error: 'session not live' });
      await live.disputeGame(req.params.id, user.id);
      return live.board();
    },
  );

  /** Host resolves a disputed (or any pending) game with final scores. */
  app.post<{ Params: { id: string }; Body: { sessionId: string; a: number; b: number } }>(
    '/games/:id/resolve',
    { preHandler: requireRole(...HOSTS) },
    async (req, reply) => {
      const user = req.user as AuthUser;
      const live = await registry.getOrRestore(req.body.sessionId);
      if (!live) return reply.code(400).send({ error: 'session not live' });
      await live.resolvePending(req.params.id, { a: req.body.a, b: req.body.b }, user.id);
      return live.board();
    },
  );

  app.patch<{ Params: { id: string }; Body: { sessionId: string; courtId: string } }>(
    '/games/:id/court',
    { preHandler: requireRole(...HOSTS) },
    async (req, reply) => {
      const live = await registry.getOrRestore(req.body.sessionId);
      if (!live) return reply.code(400).send({ error: 'session not live' });
      await live.moveGame(req.params.id, req.body.courtId);
      return live.board();
    },
  );
}
