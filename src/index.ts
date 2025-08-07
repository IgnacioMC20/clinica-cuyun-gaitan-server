import Fastify from 'fastify';
import cors from '@fastify/cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import logger from './utils/logger';

// Import plugins
import cookiesPlugin from './plugins/cookies';
import authPlugin from './plugins/auth';
import rateLimitingPlugin from './plugins/rateLimiting';

// Import routes
import routes from './routes';
import authRoutes from './routes/auth';

// Load environment variables
dotenv.config();

const app = Fastify({
    logger: true
});

async function start() {
    try {
        // Register CORS
        await app.register(cors, {
            origin: process.env.FRONTEND_URL,
            credentials: true,
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization', 'Cookie']
        });

        // Register plugins
        await app.register(rateLimitingPlugin);
        await app.register(cookiesPlugin);
        await app.register(authPlugin);

        // Connect to MongoDB
        const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/clinica-medica';
        await mongoose.connect(mongoUri);
        logger.database('Conectado a MongoDB');

        // Register routes
        await app.register(authRoutes, { prefix: '/api/auth' });
        await app.register(routes, { prefix: '/api' });

        // Health check
        app.get('/health', async (request, reply) => {
            return { status: 'ok', timestamp: new Date().toISOString() };
        });

        // Start server
        const port = parseInt(process.env.PORT || '3000');
        const host = process.env.HOST || '0.0.0.0';

        await app.listen({ port, host });
        logger.success('Servidor iniciado');
        logger.server(`Ejecutándose en http://${host}:${port}`);
        logger.warning('Cargando entorno dev');
    } catch (error) {
        logger.error('Error al iniciar el servidor');
        if (error instanceof Error && error.message.includes('ECONNREFUSED')) {
            logger.error('Error al conectar a la base de datos');
        }
        app.log.error(error);
        process.exit(1);
    }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
    try {
        await app.close();
        await mongoose.disconnect();
        logger.success('Servidor cerrado correctamente');
        process.exit(0);
    } catch (error) {
        logger.error('Error durante el cierre del servidor');
        console.error(error);
        process.exit(1);
    }
});

start();