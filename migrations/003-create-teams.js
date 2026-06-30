const Team = require('../src/models/Team');

const up = async () => {
    console.log('[Migration 003] Team migration initialized (Teams collection is ready).');
};

const down = async () => {
    console.log('[Migration 003] Rollback not implemented.');
};

module.exports = { up, down };
