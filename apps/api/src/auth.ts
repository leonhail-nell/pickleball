import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { prisma } from '@pickleplay/db';

export function hashPassword(pw: string): string {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(pw, salt, 64).toString('hex')}`;
}

export function verifyPassword(pw: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  const candidate = scryptSync(pw, salt, 64);
  return timingSafeEqual(candidate, Buffer.from(hash, 'hex'));
}

export interface AuthUser {
  id: string;
  role: 'PLAYER' | 'HOST' | 'ADMIN';
}

export function requireRole(...roles: AuthUser['role'][]) {
  return async (req: FastifyRequest) => {
    const user = req.user as AuthUser;
    if (!roles.includes(user.role)) throw Object.assign(new Error('forbidden'), { statusCode: 403 });
  };
}

/**
 * Session ownership guard. Admins manage everything; a HOST may only manage
 * sessions they created. Legacy sessions without a creator are admin-only.
 * Returns an error message, or null when the user may proceed.
 */
export async function manageBlock(sessionId: string, user: AuthUser): Promise<string | null> {
  if (user.role === 'ADMIN') return null;
  const s = await prisma.openSession.findUnique({
    where: { id: sessionId },
    select: { createdById: true },
  });
  if (!s) return 'session not found';
  if (s.createdById !== user.id) {
    return 'this session belongs to another organizer — only its creator or an admin can manage it';
  }
  return null;
}

export function authRoutes(app: FastifyInstance) {
  app.post<{
    Body: { name: string; email: string; password: string; rating?: number; organizer?: boolean };
  }>(
    '/auth/register',
    async (req, reply) => {
      const { name, email, password, rating, organizer } = req.body;
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) return reply.code(409).send({ error: 'email already registered' });
      const user = await prisma.user.create({
        data: {
          name,
          email,
          passwordHash: hashPassword(password),
          rating: rating ?? 3.0,
          role: organizer ? 'HOST' : 'PLAYER',
        },
      });
      // organizers get their own club (seeded with 4 courts) right away
      if (organizer) {
        const club = await prisma.club.create({
          data: { ownerId: user.id, name: `${user.name}'s Club` },
        });
        await prisma.court.createMany({
          data: [1, 2, 3, 4].map((n) => ({ clubId: club.id, number: n, label: '' })),
        });
      }
      const token = app.jwt.sign({ id: user.id, role: user.role });
      return { token, user: { id: user.id, name: user.name, role: user.role, rating: user.rating, avatarUrl: user.avatarUrl ?? null } };
    },
  );

  // Google Identity Services: verify the ID token server-side, upsert the user
  app.post<{ Body: { credential: string } }>('/auth/google', async (req, reply) => {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) return reply.code(501).send({ error: 'Google sign-in is not configured' });
    const res = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(req.body.credential)}`,
    );
    if (!res.ok) return reply.code(401).send({ error: 'invalid Google token' });
    const payload = (await res.json()) as {
      aud: string; email?: string; email_verified?: string; name?: string;
    };
    if (payload.aud !== clientId || !payload.email || payload.email_verified !== 'true') {
      return reply.code(401).send({ error: 'invalid Google token' });
    }
    let user = await prisma.user.findUnique({ where: { email: payload.email } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          name: payload.name ?? payload.email.split('@')[0],
          email: payload.email,
          passwordHash: hashPassword(randomBytes(16).toString('hex')),
          rating: 3.0,
        },
      });
    }
    const token = app.jwt.sign({ id: user.id, role: user.role });
    return { token, user: { id: user.id, name: user.name, role: user.role, rating: user.rating, avatarUrl: user.avatarUrl ?? null } };
  });

  app.post<{ Body: { email: string; password: string } }>('/auth/login', async (req, reply) => {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return reply.code(401).send({ error: 'invalid credentials' });
    }
    const token = app.jwt.sign({ id: user.id, role: user.role });
    return { token, user: { id: user.id, name: user.name, role: user.role, rating: user.rating, avatarUrl: user.avatarUrl ?? null } };
  });
}
