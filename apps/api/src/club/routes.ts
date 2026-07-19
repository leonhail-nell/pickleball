import type { FastifyInstance } from 'fastify';
import type { LiveSessionRegistry } from '../live/index.js';
import { clubConfigRoutes } from './config.routes.js';
import { membershipRoutes } from './membership.routes.js';
import { profileRoutes } from './profile.routes.js';

/** Registers all club, membership, payment, admin, and profile routes. */
export function clubRoutes(app: FastifyInstance, registry?: LiveSessionRegistry) {
  clubConfigRoutes(app);
  membershipRoutes(app);
  profileRoutes(app, registry);
}
