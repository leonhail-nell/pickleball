import { prisma } from '@pickleplay/db';
import type { Server } from 'socket.io';
import { LiveSession } from './session.js';

/** Owns the set of in-memory live sessions, restoring them from Postgres on demand. */
export class LiveSessionRegistry {
  private sessions = new Map<string, LiveSession>();
  constructor(private io: Server) {}

  get(sessionId: string): LiveSession | undefined {
    return this.sessions.get(sessionId);
  }

  all(): LiveSession[] {
    return [...this.sessions.values()];
  }

  async getOrRestore(sessionId: string): Promise<LiveSession | undefined> {
    const existing = this.sessions.get(sessionId);
    if (existing) return existing;
    const s = await prisma.openSession.findUnique({
      where: { id: sessionId },
      select: { status: true },
    });
    if (s?.status !== 'LIVE') return undefined;
    return this.start(sessionId);
  }

  async start(sessionId: string): Promise<LiveSession> {
    let live = this.sessions.get(sessionId);
    if (!live) {
      live = await LiveSession.start(sessionId, this.io);
      this.sessions.set(sessionId, live);
    }
    return live;
  }

  /** Close: convert no-shows to strikes, reveal the RNG seed for audit. */
  async close(sessionId: string): Promise<{ seed: string | null }> {
    this.sessions.delete(sessionId);
    const noShows = await prisma.signup.findMany({
      where: { sessionId, status: 'SIGNED_UP' },
      select: { id: true, userId: true },
    });
    for (const s of noShows) {
      await prisma.signup.update({ where: { id: s.id }, data: { status: 'NO_SHOW' } });
      await prisma.user.update({ where: { id: s.userId }, data: { strikes: { increment: 1 } } });
    }
    const session = await prisma.openSession.update({
      where: { id: sessionId },
      data: { status: 'CLOSED' },
      select: { seed: true },
    });
    await prisma.auditEvent.create({
      data: {
        sessionId, type: 'seed_reveal', actorId: null,
        payload: { seed: session.seed, note: 'verify: sha256(seed) === published seedHash' } as never,
      },
    });
    return { seed: session.seed };
  }

  async autoConfirmAll(): Promise<void> {
    for (const live of this.sessions.values()) {
      await live.autoConfirm().catch(() => {});
    }
  }
}
