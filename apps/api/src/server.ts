import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import { Server } from 'socket.io';
import { authRoutes } from './auth.js';
import { sessionRoutes } from './routes.js';
import { clubRoutes } from './club.js';
import { LiveSessionRegistry } from './live.js';

const PORT = Number(process.env.PORT ?? 4000);
const WEB_ORIGIN = process.env.WEB_ORIGIN ?? 'http://localhost:3000';
const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret';

const app = Fastify({ logger: true });

await app.register(cors, { origin: WEB_ORIGIN });
await app.register(jwt, { secret: JWT_SECRET });

// everything requires a token except /auth/*, /health, and public read views
// (TV board, event detail, leaderboard, per-player match history)
const isPublic = (req: { method: string; url: string }) => {
  if (req.url.startsWith('/auth/') || req.url === '/health' || req.url === '/stats') return true;
  if (req.method === 'GET' && req.url === '/club') return true;
  if (req.method !== 'GET') return false;
  const path = req.url.split('?')[0];
  return (
    /^\/sessions\/[^/]+$/.test(path) ||
    /^\/sessions\/[^/]+\/(board|standings)$/.test(path) ||
    /^\/sessions\/[^/]+\/players\/[^/]+\/games$/.test(path)
  );
};

app.addHook('onRequest', async (req, reply) => {
  if (isPublic(req)) return;
  try {
    await req.jwtVerify();
  } catch {
    return reply.code(401).send({ error: 'unauthorized' });
  }
});

app.get('/health', async () => ({ ok: true }));

const io = new Server(app.server, { cors: { origin: WEB_ORIGIN } });
const registry = new LiveSessionRegistry(io);

io.on('connection', (socket) => {
  socket.on('join-session', (sessionId: string) => socket.join(`session:${sessionId}`));
  socket.on('join-user', (userId: string) => socket.join(`user:${userId}`));
});

authRoutes(app);
sessionRoutes(app, registry);
clubRoutes(app, registry);

// auto-confirm reported games older than 10 minutes
setInterval(() => void registry.autoConfirmAll(), 60_000);

app.listen({ port: PORT, host: '0.0.0.0' }).then(() => {
  console.log(`PicklePlay API on :${PORT}`);
});
