import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

// Extend Jest matchers
expect.extend({
    toBeValidObjectId(received: any) {
        const pass = mongoose.Types.ObjectId.isValid(received);
        if (pass) {
            return {
                message: () => `expected ${received} not to be a valid ObjectId`,
                pass: true,
            };
        } else {
            return {
                message: () => `expected ${received} to be a valid ObjectId`,
                pass: false,
            };
        }
    },
});

// Increase timeout for database operations
jest.setTimeout(30000);

// Mock console methods to reduce noise in tests
global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
};