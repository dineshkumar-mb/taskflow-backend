const Redis = require('ioredis');

let redisClient = null;
let isConnected = false;

const redisConfig = {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: null, // Required by BullMQ
    enableReadyCheck: false,
    retryStrategy(times) {
        if (times > 10 && !process.env.REDIS_URL && !process.env.REDIS_HOST) {
            // Stop spamming retries if no redis is configured locally
            return null;
        }
        const delay = Math.min(times * 100, 3000);
        return delay;
    },
    lazyConnect: true
};

const createRedisConnection = () => {
    if (process.env.REDIS_URL) {
        return new Redis(process.env.REDIS_URL, {
            maxRetriesPerRequest: null,
            retryStrategy: redisConfig.retryStrategy,
            lazyConnect: true
        });
    }
    return new Redis(redisConfig);
};

const initRedis = async () => {
    if (redisClient) return redisClient;

    redisClient = createRedisConnection();

    redisClient.on('connect', () => {
        isConnected = true;
        console.log('[Redis] Connected successfully');
    });

    redisClient.on('ready', () => {
        isConnected = true;
    });

    redisClient.on('error', (err) => {
        isConnected = false;
        // Log cleanly without crashing the process
        if (process.env.NODE_ENV !== 'production' && err.code === 'ECONNREFUSED') {
            // Local dev without Redis running
        } else {
            console.error('[Redis Error]', err.message);
        }
    });

    redisClient.on('close', () => {
        isConnected = false;
    });

    try {
        await redisClient.connect();
    } catch (err) {
        console.warn(`[Redis Notice] Redis not available at ${redisConfig.host}:${redisConfig.port}. Operating in local-memory fallback mode.`);
    }

    return redisClient;
};

const getRedisClient = () => {
    if (!redisClient) {
        redisClient = createRedisConnection();
    }
    return redisClient;
};

const isRedisAvailable = () => isConnected;

module.exports = {
    initRedis,
    getRedisClient,
    createRedisConnection,
    isRedisAvailable,
    redisConfig
};
