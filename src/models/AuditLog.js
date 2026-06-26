const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
    {
        action: {
            type: String,
            required: true,
            enum: ['CREATE', 'UPDATE', 'DELETE', 'STATUS_CHANGE', 'ASSIGN', 'LOGIN', 'LOGOUT'],
        },
        entityType: {
            type: String,
            required: true,
            enum: ['Issue', 'Project', 'Sprint', 'User', 'Role', 'Organization'],
        },
        entityId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            refPath: 'entityType' // Dynamic reference based on entityType
        },
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        organization: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Organization',
            required: true,
        },
        details: {
            type: Object, // Flexible JSON object to store changes, e.g., { before: { status: 'TODO' }, after: { status: 'DONE' } }
            default: {}
        },
        ipAddress: {
            type: String
        }
    },
    {
        timestamps: true,
    }
);

// Indexes for fast querying on the frontend table
auditLogSchema.index({ organization: 1, createdAt: -1 });
auditLogSchema.index({ entityType: 1, entityId: 1 });
auditLogSchema.index({ user: 1 });

const AuditLog = mongoose.model('AuditLog', auditLogSchema);

module.exports = AuditLog;
