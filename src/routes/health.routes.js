const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { isRedisAvailable } = require('../config/redis');

// Liveness probe (Kubernetes / ECS / Cloud Run)
router.get('/live', (req, res) => {
    res.status(200).json({
        status: 'alive',
        timestamp: new Date().toISOString(),
        uptime: Math.floor(process.uptime())
    });
});

// Readiness probe
router.get('/ready', async (req, res) => {
    try {
        const mongoConnected = mongoose.connection.readyState === 1;
        const redisConnected = isRedisAvailable();

        const health = {
            status: mongoConnected ? 'healthy' : 'degraded',
            timestamp: new Date().toISOString(),
            uptime: Math.floor(process.uptime()),
            services: {
                database: mongoConnected ? 'connected' : 'disconnected',
                redis: redisConnected ? 'connected' : 'fallback_mode',
                queue: redisConnected ? 'bullmq_distributed' : 'resilient_async_fallback'
            }
        };

        if (!mongoConnected) {
            return res.status(503).json(health);
        }

        res.status(200).json(health);
    } catch (error) {
        res.status(500).json({ status: 'unhealthy', error: error.message });
    }
});

// Default health endpoint (backward compatible)
router.get('/', async (req, res) => {
    try {
        const mongoConnected = mongoose.connection.readyState === 1;
        const redisConnected = isRedisAvailable();
        
        const health = {
            status: mongoConnected ? 'healthy' : 'unhealthy',
            timestamp: new Date().toISOString(),
            services: {
                database: mongoConnected ? 'connected' : 'disconnected',
                redis: redisConnected ? 'connected' : 'fallback_mode',
                queue: redisConnected ? 'bullmq_distributed' : 'resilient_async_fallback'
            }
        };

        if (!mongoConnected) {
            return res.status(503).json(health);
        }

        res.status(200).json(health);
    } catch (error) {
        res.status(500).json({ status: 'unhealthy', error: error.message });
    }
});

module.exports = router;
