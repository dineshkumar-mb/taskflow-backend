const Sprint = require('../models/Sprint');
const Issue = require('../models/Issue');

const createSprint = async (organizationId, data) => {
    const sprintCount = await Sprint.countDocuments({ project: data.project, organization: organizationId });
    const name = data.name || `Sprint ${sprintCount + 1}`;
    return await Sprint.create({ ...data, organization: organizationId, name });
};

const getSprints = async (organizationId, projectId) => {
    return await Sprint.find({ project: projectId, organization: organizationId }).sort({ createdAt: 1 });
};

const updateSprint = async (sprintId, organizationId, data) => {
    return await Sprint.findOneAndUpdate({ _id: sprintId, organization: organizationId }, data, { new: true });
};

const startSprint = async (sprintId, organizationId) => {
    const sprint = await Sprint.findOne({ _id: sprintId, organization: organizationId });
    if (!sprint) throw new Error('Sprint not found in your organization');

    // Check if there's already an active sprint
    const activeSprint = await Sprint.findOne({ project: sprint.project, organization: organizationId, status: 'active' });
    if (activeSprint && activeSprint._id.toString() !== sprintId) {
        throw new Error('A sprint is already active for this project');
    }

    sprint.status = 'active';
    if (!sprint.startDate) sprint.startDate = new Date();
    await sprint.save();
    return sprint;
};

const completeSprint = async (sprintId, organizationId) => {
    const sprint = await Sprint.findOne({ _id: sprintId, organization: organizationId });
    if (!sprint) throw new Error('Sprint not found in your organization');

    // Move unfinished issues (not 'done') to backlog by clearing sprint (ensuring org match)
    await Issue.updateMany(
        { sprint: sprintId, organization: organizationId, status: { $ne: 'done' } },
        { $unset: { sprint: '' } }
    );

    sprint.status = 'completed';
    if (!sprint.endDate) sprint.endDate = new Date();
    await sprint.save();
    return sprint;
};

module.exports = {
    createSprint,
    getSprints,
    updateSprint,
    startSprint,
    completeSprint,
};
