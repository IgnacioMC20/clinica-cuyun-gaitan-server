import { VercelRequest, VercelResponse } from '@vercel/node';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import mongoose from 'mongoose';
import logger from '../src/utils/logger';

// Import plugins
import cookiesPlugin from '../src/plugins/cookies';
import authPlugin from '../src/plugins/auth';
import rateLimitingPlugin from '../src/plugins/rateLimiting';

// Import routes
import routes from '../src/routes';
import authRoutes from '../src/routes/auth';

// Create Fastify instance for serverless
const app = Fastify({
    logger: false // Disable Fastify logger for Vercel
});

let isConnected = false;

async function connectToDatabase() {
    if (isConnected) {
        return;
    }

    try {
        const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/clinica-medica';
        await mongoose.connect(mongoUri);
        isConnected = true;
        console.log('Connected to MongoDB');
    } catch (error) {
        console.error('MongoDB connection error:', error);
        throw error;
    }
}

async function setupApp() {
    try {
        // Register CORS
        await app.register(cors, {
            origin: process.env.FRONTEND_URL || true,
            credentials: true,
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization', 'Cookie']
        });

        // Register plugins
        await app.register(rateLimitingPlugin);
        await app.register(cookiesPlugin);
        await app.register(authPlugin);

        // Register routes
        await app.register(authRoutes, { prefix: '/auth' });
        await app.register(routes);

        // Health check
        app.get('/health', async (request, reply) => {
            return { status: 'ok', timestamp: new Date().toISOString() };
        });

        await app.ready();
    } catch (error) {
        console.error('Error setting up Fastify app:', error);
        throw error;
    }
}

// Initialize app once
let appInitialized = false;

export default async function handler(req: VercelRequest, res: VercelResponse) {
    try {
        // Connect to database
        await connectToDatabase();

        // Setup app if not already done
        if (!appInitialized) {
            await setupApp();
            appInitialized = true;
        }

        // Handle the request
        await app.ready();
        app.server.emit('request', req, res);
    } catch (error) {
        console.error('Handler error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}