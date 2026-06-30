const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

router.get('/', async (req, res) => {
    try {
        const mongoConnected = mongoose.connection.readyState === 1;
        
        const health = {
            status: mongoConnected ? 'healthy' : 'unhealthy',
            timestamp: new Date(),
            services: {
                database: mongoConnected ? 'connected' : 'disconnected',
                redis: 'disabled_month1', // Redis is plan for month 2 or later, queue is currently local memory
                queue: 'local_memory'
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
