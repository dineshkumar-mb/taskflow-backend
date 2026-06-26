const projectService = require('../services/project.service');
const auditService = require('../services/audit.service');

const createProject = async (req, res) => {
    try {
        const project = await projectService.createProject(
            req.user._id,
            req.user.organizationId,
            req.body
        );
        res.status(201).json(project);
        
        auditService.logAction({
            action: 'CREATE',
            entityType: 'Project',
            entityId: project._id,
            user: req.user._id,
            organization: req.user.organizationId,
            details: { name: project.name, key: project.key },
            ipAddress: req.ip
        });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

const getProjects = async (req, res) => {
    try {
        const projects = await projectService.getProjects(req.user.organizationId);
        res.json(projects);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const getProjectById = async (req, res) => {
    try {
        const project = await projectService.getProjectById(req.params.id, req.user.organizationId);
        res.json(project);
    } catch (error) {
        res.status(404).json({ message: error.message });
    }
};

const updateProject = async (req, res) => {
    try {
        const project = await projectService.updateProject(req.params.id, req.user.organizationId, req.body);
        res.json(project);

        auditService.logAction({
            action: 'UPDATE',
            entityType: 'Project',
            entityId: project._id,
            user: req.user._id,
            organization: req.user.organizationId,
            details: { changedFields: req.body },
            ipAddress: req.ip
        });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

const deleteProject = async (req, res) => {
    try {
        await projectService.deleteProject(req.params.id, req.user.organizationId);
        res.json({ message: 'Project deleted' });

        auditService.logAction({
            action: 'DELETE',
            entityType: 'Project',
            entityId: req.params.id,
            user: req.user._id,
            organization: req.user.organizationId,
            ipAddress: req.ip
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    createProject,
    getProjects,
    getProjectById,
    updateProject,
    deleteProject,
};
