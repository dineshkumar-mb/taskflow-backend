const sprintService = require('../services/sprint.service');
const webhookService = require('../services/webhook.service');

const createSprint = async (req, res) => {
    try {
        const sprint = await sprintService.createSprint(req.user.organizationId, req.body);
        res.status(201).json(sprint);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

const getSprints = async (req, res) => {
    try {
        const sprints = await sprintService.getSprints(req.user.organizationId, req.params.projectId);
        res.json(sprints);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const updateSprint = async (req, res) => {
    try {
        const sprint = await sprintService.updateSprint(req.params.id, req.user.organizationId, req.body);
        res.json(sprint);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

const startSprint = async (req, res) => {
    try {
        const sprint = await sprintService.startSprint(req.params.id, req.user.organizationId);
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
        const sprint = await sprintService.completeSprint(req.params.id, req.user.organizationId);
        res.json(sprint);
        // n8n: fire-and-forget
        webhookService.emit('sprint.completed', {
            sprint: {
                id: sprint._id, name: sprint.name, goal: sprint.goal,
                startDate: sprint.startDate, endDate: sprint.endDate,
                project: sprint.project, status: sprint.status,
            },
            triggeredBy: { id: req.user._id, email: req.user.email, name: req.user.name },
        });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

module.exports = {
    createSprint,
    getSprints,
    updateSprint,
    startSprint,
    completeSprint,
};
