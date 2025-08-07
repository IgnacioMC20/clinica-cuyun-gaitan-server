import fp from 'fastify-plugin';
import rateLimit from '@fastify/rate-limit';

export default fp(async (app) => {
    // Global rate limiting
    await app.register(rateLimit, {
        max: 100, // 100 requests per window
        timeWindow: '1 minute',
        errorResponseBuilder: (request, context) => ({
            error: 'Too Many Requests',
            message: `Rate limit exceeded, retry in ${Math.round(context.ttl / 1000)} seconds`,
            statusCode: 429,
            ttl: context.ttl
        })
    });

    // Stricter rate limiting for auth routes
    app.register(async (authApp) => {
        await authApp.register(rateLimit, {
            max: 5, // 5 attempts per window
            timeWindow: '15 minutes',
            errorResponseBuilder: (request, context) => ({
                error: 'Too Many Requests',
                message: `Too many authentication attempts, retry in ${Math.round(context.ttl / 1000)} seconds`,
                statusCode: 429,
                ttl: context.ttl
            })
        });
    }, { prefix: '/auth' });
});