const Project = require('../models/Project');
const Board = require('../models/Board');
const Organization = require('../models/Organization');
const Issue = require('../models/Issue');
const Sprint = require('../models/Sprint');

const createProject = async (userId, userOrganizationId, data) => {
    const existingProject = await Project.findOne({
        organization: userOrganizationId,
        key: data.key.toUpperCase(),
    });

    if (existingProject) {
        throw new Error('Project key already exists in this organization');
    }

    const project = await Project.create({
        ...data,
        organization: userOrganizationId,
        lead: userId,
        members: [userId],
    });

    await Board.create({
        name: `${data.name} Board`,
        type: 'kanban',
        project: project._id,
        columns: [
            { name: 'To Do', status: 'todo', position: 0 },
            { name: 'In Progress', status: 'in-progress', position: 1 },
            { name: 'Done', status: 'done', position: 2 },
        ],
    });

    await Organization.findByIdAndUpdate(userOrganizationId, {
        $push: { projects: project._id },
    });

    return project;
};

const getProjects = async (userOrganizationId) => {
    return await Project.find({ organization: userOrganizationId })
        .populate('lead', 'name avatar')
        .sort({ createdAt: -1 });
};

const getProjectById = async (projectId, organizationId) => {
    const project = await Project.findOne({ _id: projectId, organization: organizationId })
        .populate('lead', 'name avatar')
        .populate('members', 'name avatar');

    if (!project) throw new Error('Project not found or not in your organization');

    return project;
};

const updateProject = async (projectId, organizationId, data) => {
    const allowed = ['name', 'description', 'lead'];
    const updateData = {};
    allowed.forEach(k => { if (data[k] !== undefined) updateData[k] = data[k]; });

    const project = await Project.findOneAndUpdate(
        { _id: projectId, organization: organizationId },
        updateData,
        { new: true }
    ).populate('lead', 'name avatar');

    if (!project) throw new Error('Project not found or not in your organization');
    return project;
};

const deleteProject = async (projectId, organizationId) => {
    const project = await Project.findById(projectId);
    if (!project) throw new Error('Project not found');

    // Delete all related data
    await Issue.deleteMany({ project: projectId });
    await Sprint.deleteMany({ project: projectId });
    await Board.deleteMany({ project: projectId });

    // Remove from organization
    await Organization.findByIdAndUpdate(organizationId, {
        $pull: { projects: projectId },
    });

    await project.deleteOne();
};

module.exports = {
    createProject,
    getProjects,
    getProjectById,
    updateProject,
    deleteProject,
};
