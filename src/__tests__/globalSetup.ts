import { MongoMemoryServer } from 'mongodb-memory-server';

export default async function globalSetup() {
    // Start MongoDB Memory Server
    const mongod = new MongoMemoryServer({
        instance: {
            port: 27018, // Use different port to avoid conflicts
            dbName: 'clinic-test',
        },
    });

    await mongod.start();
    const uri = mongod.getUri();

    // Store the URI and instance for global teardown
    (global as any).__MONGOD__ = mongod;
    process.env.MONGODB_URI = uri;
    process.env.NODE_ENV = 'test';

    console.log('MongoDB Memory Server started for testing');
}