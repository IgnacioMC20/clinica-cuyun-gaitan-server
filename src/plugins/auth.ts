import fp from 'fastify-plugin';
import { auth, SessionUser, SessionData } from '../auth/lucia';

export default fp(async (app) => {
  app.decorate('auth', auth);

  app.addHook('preHandler', async (request, reply) => {
    try {
      const sessionId = request.cookies?.session || '';

      if (!sessionId) {

        request.user = null;
        request.session = null;
        return;
      }

      const { session, user } = await auth.validateSession(sessionId);

      request.user = user;
      request.session = session;
    } catch (error) {
      console.error('Auth preHandler error:', error);
      request.user = null;
      request.session = null;
    }
  });
});

declare module 'fastify' {
  interface FastifyInstance {
    auth: typeof auth;
  }
  interface FastifyRequest {
    user: SessionUser | null;
    session: SessionData | null;
    cookies: { [key: string]: string };
  }
}