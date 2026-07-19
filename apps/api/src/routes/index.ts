import type { FastifyInstance } from 'fastify';
import type { LiveSessionRegistry } from '../live/index.js';
import { miscRoutes } from './misc.routes.js';
import { sessionRoutes as registerSessionRoutes } from './session.routes.js';
import { checkinRoutes } from './checkin.routes.js';
import { courtRoutes } from './court.routes.js';
import { gameRoutes } from './game.routes.js';
import { playerRoutes } from './player.routes.js';

/**
 * Registers all session-related API routes. Split by domain into
 * misc / session / checkin / court / game / player modules; shared helpers
 * live in ./helpers.
 */
export function sessionRoutes(app: FastifyInstance, registry: LiveSessionRegistry) {
  miscRoutes(app);
  registerSessionRoutes(app, registry);
  checkinRoutes(app, registry);
  courtRoutes(app, registry);
  gameRoutes(app, registry);
  playerRoutes(app, registry);
}
