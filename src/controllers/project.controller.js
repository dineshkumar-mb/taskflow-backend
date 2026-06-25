const projectService = require('../services/project.service');

const createProject = async (req, res) => {
    try {
        const project = await projectService.createProject(
            req.user._id,
            req.user.organizationId,
            req.body
        );
        res.status(201).json(project);
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
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

const deleteProject = async (req, res) => {
    try {
        await projectService.deleteProject(req.params.id, req.user.organizationId);
        res.json({ message: 'Project deleted' });
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
