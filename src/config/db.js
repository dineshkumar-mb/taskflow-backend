const mongoose = require('mongoose');

let cached = global.mongoose;

if (!cached) {
    cached = global.mongoose = { conn: null, promise: null };
}

const connectDB = async () => {
    if (!process.env.MONGO_URI) {
        throw new Error('MONGO_URI is not defined in environment variables');
    }

    if (cached.conn) {
        return cached.conn;
    }

    if (!cached.promise) {
        const opts = {
            maxPoolSize: parseInt(process.env.MONGO_MAX_POOL_SIZE, 10) || 25,
            minPoolSize: parseInt(process.env.MONGO_MIN_POOL_SIZE, 10) || 5,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
            bufferCommands: false,
        };

        cached.promise = mongoose.connect(process.env.MONGO_URI, opts).then(async (m) => {
            console.log(`[Database] MongoDB Connected: ${m.connection.host} (Pool: ${opts.minPoolSize}-${opts.maxPoolSize})`);

            // Seed SuperAdmin on initial connection
            try {
                const { seedSuperAdmin } = require('../utils/seeder');
                await seedSuperAdmin();
            } catch (seedErr) {
                console.warn('[Database] Seeder notice:', seedErr.message);
            }

            return m;
        }).catch((err) => {
            cached.promise = null;
            console.error(`[Database Error] MongoDB connection failed: ${err.message}`);
            throw err;
        });
    }

    try {
        cached.conn = await cached.promise;
    } catch (e) {
        cached.promise = null;
        throw e;
    }

    return cached.conn;
};

module.exports = connectDB;
