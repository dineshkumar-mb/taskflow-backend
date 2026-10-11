const analyticsService = require('../services/analytics.service');
const { assertProjectAccess, getActiveOrganizationId } = require('../security/tenantAccess');

const getOrgStats = async (req, res) => {
    try {
        const orgId = req.organizationId || await getActiveOrganizationId(req);
        const stats = await analyticsService.getOrgStats(orgId);
        res.json(stats);
    } catch (error) {
        const statusCode = error.statusCode || (error.name === 'TenantAccessError' ? 403 : 500);
        res.status(statusCode).json({ message: error.message });
    }
};

const getProjectAnalytics = async (req, res) => {
    try {
        const project = await assertProjectAccess(req, req.params.projectId, { requiredPermission: 'project:read' });
        const orgId = project.organization || req.organizationId;
        const stats = await analyticsService.getProjectAnalytics(req.params.projectId, orgId);
        res.json(stats);
    } catch (error) {
        const statusCode = error.statusCode || (error.name === 'TenantAccessError' ? 403 : 500);
        res.status(statusCode).json({ message: error.message });
    }
};

module.exports = {
    getOrgStats,
    getProjectAnalytics,
};
