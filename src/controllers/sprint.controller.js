const sprintService = require('../services/sprint.service');
const webhookService = require('../services/webhook.service');
const { assertProjectAccess, getActiveOrganizationId } = require('../security/tenantAccess');

const createSprint = async (req, res) => {
    try {
        const { project: projectId } = req.body;
        if (!projectId) return res.status(400).json({ message: 'Project ID is required' });

        const project = await assertProjectAccess(req, projectId, { requiredPermission: 'sprint:create' });
        const orgId = project.organization || req.organizationId;

        const sprint = await sprintService.createSprint(orgId, req.body);
        res.status(201).json(sprint);
    } catch (error) {
        const statusCode = error.statusCode || (error.name === 'TenantAccessError' ? 403 : 400);
        res.status(statusCode).json({ message: error.message });
    }
};

const getSprints = async (req, res) => {
    try {
        const project = await assertProjectAccess(req, req.params.projectId, { requiredPermission: 'project:read' });
        const orgId = project.organization || req.organizationId;

        const sprints = await sprintService.getSprints(orgId, req.params.projectId);
        res.json(sprints);
    } catch (error) {
        const statusCode = error.statusCode || (error.name === 'TenantAccessError' ? 403 : 500);
        res.status(statusCode).json({ message: error.message });
    }
};

const updateSprint = async (req, res) => {
    try {
        const orgId = req.organizationId || await getActiveOrganizationId(req);
        const sprint = await sprintService.updateSprint(req.params.id, orgId, req.body);
        if (!sprint) return res.status(404).json({ message: 'Sprint not found in your organization' });
        res.json(sprint);
    } catch (error) {
        const statusCode = error.statusCode || (error.name === 'TenantAccessError' ? 403 : 400);
        res.status(statusCode).json({ message: error.message });
    }
};

const startSprint = async (req, res) => {
    try {
        const orgId = req.organizationId || await getActiveOrganizationId(req);
        const sprint = await sprintService.startSprint(req.params.id, orgId);
        res.json(sprint);
        // n8n: fire-and-forget
        webhookService.emit('sprint.started', {
            sprint: {
                id: sprint._id, name: sprint.name, goal: sprint.goal,
                startDate: sprint.startDate, endDate: sprint.endDate,
                project: sprint.project,
            },
            triggeredBy: { id: req.user._id, email: req.user.email, name: req.user.name },
        });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

const completeSprint = async (req, res) => {
    try {
        const orgId = req.organizationId || await getActiveOrganizationId(req);
        const sprint = await sprintService.completeSprint(req.params.id, orgId);
        res.json(sprint);
        // n8n: fire-and-forget
        webhookService.emit('sprint.completed', {
            sprint: {
                id: sprint._id, name: sprint.name, goal: sprint.goal,
                startDate: sprint.startDate, endDate: sprint.endDate,
                project: sprint.project, status: sprint.status,
            },
            organizationId: orgId,
            triggeredBy: { id: req.user._id, email: req.user.email, name: req.user.name },
        });
    } catch (error) {
        const statusCode = error.statusCode || (error.name === 'TenantAccessError' ? 403 : 400);
        res.status(statusCode).json({ message: error.message });
    }
};

module.exports = {
    createSprint,
    getSprints,
    updateSprint,
    startSprint,
    completeSprint,
};
