const AuditLog = require('../models/AuditLog');

// @desc    Get organization audit logs
// @route   GET /api/audit
// @access  Private
const getAuditLogs = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;

        const query = { organization: req.user.organizationId };

        if (req.query.user) {
            query.user = req.query.user;
        }
        if (req.query.entityType) {
            query.entityType = req.query.entityType;
        }

        const logs = await AuditLog.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate('user', 'name email avatar')
            .populate('entityId', 'name title'); // Attempt to populate name/title depending on entity

        const total = await AuditLog.countDocuments(query);

        res.status(200).json({
            logs,
            pagination: {
                total,
                page,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getAuditLogs
};
