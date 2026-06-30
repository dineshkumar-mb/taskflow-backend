const mongoose = require('mongoose');

const up = async () => {
    console.log('[Migration 005] Synchronizing and building database indexes...');

    const models = [
        require('../src/models/User'),
        require('../src/models/Organization'),
        require('../src/models/OrganizationMember'),
        require('../src/models/Project'),
        require('../src/models/Board'),
        require('../src/models/Sprint'),
        require('../src/models/Issue'),
        require('../src/models/Comment'),
        require('../src/models/Meeting'),
        require('../src/models/Message'),
        require('../src/models/Conversation'),
        require('../src/models/Team'),
        require('../src/models/Attachment'),
        require('../src/models/Subscription'),
        require('../src/models/BillingEvent'),
        require('../src/models/UsageEvents'),
        require('../src/models/OutboxEvent'),
        require('../src/models/AuditLog'),
        require('../src/models/Role')
    ];

    for (const model of models) {
        try {
            console.log(`[Migration 005] Syncing indexes for collection: ${model.collection.name}`);
            await model.syncIndexes();
        } catch (err) {
            console.error(`[Migration 005] Error syncing indexes for ${model.collection.name}:`, err.message);
        }
    }

    console.log('[Migration 005] Completed successfully.');
};

const down = async () => {
    console.log('[Migration 005] Rollback not implemented.');
};

module.exports = { up, down };
