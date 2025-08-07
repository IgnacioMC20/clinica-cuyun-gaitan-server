import Fastify, { FastifyInstance } from 'fastify';
import routes from '../routes';

export async function build(): Promise<FastifyInstance> {
    const app = Fastify({
        logger: false // Disable logging in tests
    });

    // Register CORS
    await app.register(import('@fastify/cors'), {
        origin: true
    });

    // Register routes with /api prefix
    await app.register(routes, { prefix: '/api' });

    return app;
}