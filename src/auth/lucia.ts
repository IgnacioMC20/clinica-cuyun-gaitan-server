import { randomBytes } from 'crypto';
import { User, Session } from '../models/authModels';

export interface SessionUser {
    id: string;
    email: string;
    role: 'admin' | 'doctor' | 'nurse' | 'assistant';
}

export interface SessionData {
    id: string;
    userId: string;
    expiresAt: Date;
}

export class AuthService {
    private static readonly SESSION_DURATION = 1000 * 60 * 60 * 24 * 7; // 7 days

    static generateSessionId(): string {
        return randomBytes(32).toString('hex');
    }

    static async createSession(userId: string): Promise<SessionData> {
        const sessionId = this.generateSessionId();
        const expiresAt = new Date(Date.now() + this.SESSION_DURATION);

        const session = new Session({
            _id: sessionId,
            user_id: userId,
            active_expires: expiresAt.getTime(),
            idle_expires: expiresAt.getTime()
        });

        await session.save();

        return {
            id: sessionId,
            userId,
            expiresAt
        };
    }

    static async validateSession(sessionId: string): Promise<{ session: SessionData | null; user: SessionUser | null }> {
        if (!sessionId) {
            return { session: null, user: null };
        }

        try {
            const session = await Session.findById(sessionId);

            if (!session || session.active_expires < Date.now()) {
                if (session) {
                    await Session.findByIdAndDelete(sessionId);
                }
                return { session: null, user: null };
            }

            const user = await User.findById(session.user_id);

            if (!user) {
                await Session.findByIdAndDelete(sessionId);
                return { session: null, user: null };
            }

            // Extend session if it's close to expiring
            const timeUntilExpiry = session.active_expires - Date.now();
            if (timeUntilExpiry < this.SESSION_DURATION / 2) {
                const newExpiresAt = Date.now() + this.SESSION_DURATION;
                await Session.findByIdAndUpdate(sessionId, {
                    active_expires: newExpiresAt,
                    idle_expires: newExpiresAt
                });
            }

            return {
                session: {
                    id: session._id,
                    userId: session.user_id,
                    expiresAt: new Date(session.active_expires)
                },
                user: {
                    id: user._id,
                    email: user.email,
                    role: user.role
                }
            };
        } catch (error) {
            return { session: null, user: null };
        }
    }

    static async invalidateSession(sessionId: string): Promise<void> {
        await Session.findByIdAndDelete(sessionId);
    }

    static async invalidateAllUserSessions(userId: string): Promise<void> {
        await Session.deleteMany({ user_id: userId });
    }

    static createSessionCookie(sessionId: string, secure: boolean = false) {
        return {
            name: 'session',
            value: sessionId,
            attributes: {
                httpOnly: true,
                secure,
                sameSite: 'lax' as const,
                path: '/',
                maxAge: this.SESSION_DURATION / 1000 // Convert to seconds
            }
        };
    }
}

export const auth = AuthService;