const AuditLog = require('../models/AuditLog');

/**
 * Log an action to the audit trail
 * @param {Object} data 
 * @param {String} data.action - Action performed (e.g. CREATE, UPDATE, DELETE)
 * @param {String} data.entityType - Type of entity (e.g. Issue, Project)
 * @param {ObjectId} data.entityId - ID of the entity
 * @param {ObjectId} data.user - ID of the user performing the action
 * @param {ObjectId} data.organization - Organization ID
 * @param {Object} [data.details] - Any extra details (before/after states)
 * @param {String} [data.ipAddress] - IP Address
 */
const logAction = async (data) => {
    try {
        await AuditLog.create(data);
    } catch (error) {
        console.error('Failed to write audit log:', error);
    }
};

module.exports = {
    logAction
};
