const analyticsService = require('../services/analytics.service');

const getOrgStats = async (req, res) => {
    try {
        const stats = await analyticsService.getOrgStats(req.user.organizationId);
        res.json(stats);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const getProjectAnalytics = async (req, res) => {
    try {
        const stats = await analyticsService.getProjectAnalytics(req.params.projectId, req.user.organizationId);
        res.json(stats);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getOrgStats,
    getProjectAnalytics,
};
