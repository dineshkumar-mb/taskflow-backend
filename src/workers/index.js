require('dotenv').config();
const connectDB = require('../config/db');
const { initRedis } = require('../config/redis');
const { initQueues } = require('../queues/queueManager');
const { initWorkers, shutdownWorkers } = require('./workerManager');

async function startWorkerService() {
    console.log('[Worker Service] Starting TaskFlow distributed background worker...');
    try {
        await connectDB();
        await initRedis();
        initQueues();
        initWorkers();
        console.log('[Worker Service] All distributed workers active and listening for jobs.');
    } catch (err) {
        console.error('[Worker Service Fatal Error]', err);
        process.exit(1);
    }
}

const handleShutdown = async (signal) => {
    console.log(`[Worker Service] Received ${signal}. Stopping workers...`);
    try {
        await shutdownWorkers();
        const mongoose = require('mongoose');
        await mongoose.connection.close();
        console.log('[Worker Service] Shutdown completed cleanly.');
        process.exit(0);
    } catch (err) {
        console.error('[Worker Service Shutdown Error]', err);
        process.exit(1);
    }
};

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));

startWorkerService();
