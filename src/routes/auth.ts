import { FastifyPluginAsync } from 'fastify';
import { auth } from '../auth/lucia';
import { User } from '../models/authModels';
import { randomUUID } from 'crypto';
import argon2 from 'argon2';
import logger from '../utils/logger';

// @fastify/cookie already provides setCookie and clearCookie methods

const authRoutes: FastifyPluginAsync = async (app) => {
    // Sign up
    app.post('/signup', async (req, reply) => {
        logger.auth('Solicitud de registro recibida');
        try {
            const { email, password, role } = req.body as {
                email: string;
                password: string;
                role?: 'admin' | 'doctor' | 'nurse' | 'assistant';
            };

            logger.debug(`Registro: ${email}, rol: ${role || 'assistant'}`);

            if (!email || !password) {
                return reply.code(400).send({
                    error: 'Validation Error',
                    message: 'Email and password are required'
                });
            }

            // Check if user already exists
            const existing = await User.findOne({ email });
            if (existing) {
                return reply.code(409).send({
                    error: 'Conflict',
                    message: 'Email already in use'
                });
            }

            // Hash password
            const hashed = await argon2.hash(password);
            const userId = randomUUID();

            // Create user
            await User.create({
                _id: userId,
                email,
                hashed_password: hashed,
                role: role || 'assistant'
            });

            // Create session
            const session = await auth.createSession(userId);
            const cookie = auth.createSessionCookie(
                session.id,
                process.env.NODE_ENV === 'production'
            );

            reply.setCookie(cookie.name, cookie.value, cookie.attributes);

            return reply.code(201).send({
                message: 'User created successfully',
                user: { id: userId, email, role: role || 'assistant' }
            });
        } catch (error) {
            logger.error('Error en registro de usuario');
            req.log.error('Signup error:', error);
            return reply.code(500).send({
                error: 'Internal Server Error',
                message: 'Failed to create user'
            });
        }
    });

    // Login
    app.post('/login', async (req, reply) => {
        try {
            const { email, password } = req.body as { email: string; password: string };

            if (!email || !password) {
                return reply.code(400).send({
                    error: 'Validation Error',
                    message: 'Email and password are required'
                });
            }

            // Find user
            const user = await User.findOne({ email });
            if (!user) {
                return reply.code(401).send({
                    error: 'Unauthorized',
                    message: 'Invalid credentials'
                });
            }

            // Verify password
            const isValidPassword = await argon2.verify(user.hashed_password, password);
            if (!isValidPassword) {
                return reply.code(401).send({
                    error: 'Unauthorized',
                    message: 'Invalid credentials'
                });
            }

            // Create session
            const session = await auth.createSession(user._id);
            const cookie = auth.createSessionCookie(
                session.id,
                process.env.NODE_ENV === 'production'
            );

            reply.setCookie(cookie.name, cookie.value, cookie.attributes);

            return reply.send({
                message: 'Logged in successfully',
                user: { id: user._id, email: user.email, role: user.role }
            });
        } catch (error) {
            req.log.error('Login error:', error);
            return reply.code(500).send({
                error: 'Internal Server Error',
                message: 'Failed to login'
            });
        }
    });

    // Logout
    app.post('/logout', async (req, reply) => {
        try {
            if (req.session) {
                await auth.invalidateSession(req.session.id);
            }

            reply.clearCookie('session', { path: '/' });

            return reply.send({ message: 'Logged out successfully' });
        } catch (error) {
            req.log.error('Logout error:', error);
            return reply.code(500).send({
                error: 'Internal Server Error',
                message: 'Failed to logout'
            });
        }
    });

    // Test endpoint (no auth required)
    app.get('/test', async (req, reply) => {
        return reply.send({
            message: 'Auth routes working',
            timestamp: new Date().toISOString(),
            cookies: req.cookies || {},
            headers: {
                cookie: req.headers.cookie || 'none'
            }
        });
    });

    // Current user
    app.get('/me', async (req, reply) => {

        if (!req.user) {
            return reply.code(401).send({
                error: 'Unauthorized',
                message: 'Not authenticated'
            });
        }

        return reply.send({
            user: req.user
        });
    });
};

export default authRoutes;