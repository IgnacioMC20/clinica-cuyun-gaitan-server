import { FastifyRequest, FastifyReply, preHandlerHookHandler } from 'fastify';

export function requireAuth(roles?: string[]): preHandlerHookHandler {
    return async (request: FastifyRequest, reply: FastifyReply) => {

        if (!request.user) {
            return reply.code(401).send({
                error: 'Unauthorized',
                message: 'Authentication required'
            });
        }

        if (roles && roles.length > 0 && !roles.includes(request.user.role)) {
            return reply.code(403).send({
                error: 'Forbidden',
                message: 'Insufficient permissions'
            });
        }
    };
}

export function requireSession() {
    return async (request: FastifyRequest, reply: FastifyReply) => {
        if (!request.cookies.session) {
            return reply.code(401).send({
                error: 'Unauthorized',
                message: 'Session required'
            });
        }
    }
}

export function requireRole(role: string) {
    return requireAuth([role]);
}

export function requireAnyRole(roles: string[]) {
    return requireAuth(roles);
}
