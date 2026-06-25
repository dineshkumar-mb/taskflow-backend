const Issue = require('../models/Issue');
const Project = require('../models/Project');
const Sprint = require('../models/Sprint');
const Organization = require('../models/Organization');
const mongoose = require('mongoose');

const getOrgStats = async (organizationId) => {
    // 1. Issues by status (org-wide totals)
    const statusStats = await Issue.aggregate([
        { $match: { organization: new mongoose.Types.ObjectId(organizationId) } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    // 1b. Issues by status per project (for grouped bar chart + rich tooltip)
    const statusByProject = await Issue.aggregate([
        { $match: { organization: new mongoose.Types.ObjectId(organizationId) } },
        {
            $lookup: {
                from: 'projects',
                localField: 'project',
                foreignField: '_id',
                as: 'projectInfo'
            }
        },
        { $unwind: { path: '$projectInfo', preserveNullAndEmptyArrays: true } },
        {
            $group: {
                _id: {
                    project: '$projectInfo.name',
                    status: '$status'
                },
                count: { $sum: 1 }
            }
        },
        { $sort: { '_id.project': 1, '_id.status': 1 } }
    ]);

    // 2. Total projects, issues, and members
    const totalProjects = await Project.countDocuments({ organization: organizationId });
    const totalIssues = await Issue.countDocuments({ organization: organizationId });
    const org = await Organization.findById(organizationId).select('members');
    const totalMembers = org ? org.members.length : 0;

    // 3. Issue types distribution
    const typeStats = await Issue.aggregate([
        { $match: { organization: new mongoose.Types.ObjectId(organizationId) } },
        { $group: { _id: '$type', count: { $sum: 1 } } },
    ]);

    // 4. Priority distribution
    const priorityStats = await Issue.aggregate([
        { $match: { organization: new mongoose.Types.ObjectId(organizationId) } },
        { $group: { _id: '$priority', count: { $sum: 1 } } },
    ]);

    return {
        statusStats,
        statusByProject,
        typeStats,
        priorityStats,
        totalProjects,
        totalIssues,
        totalMembers,
    };
};


const getProjectAnalytics = async (projectId, organizationId) => {
    // 1. Velocity (Completed issues in last few sprints)
    const completedSprints = await Sprint.find({
        project: projectId,
        organization: organizationId,
        status: 'completed'
    }).sort({ endDate: -1 }).limit(5);

    const velocityData = await Promise.all(completedSprints.map(async (sprint) => {
        const issues = await Issue.find({ sprint: sprint._id, status: 'done' });
        const storyPoints = issues.reduce((sum, issue) => sum + (issue.storyPoints || 0), 0);
        return {
            name: sprint.name,
            points: storyPoints,
            count: issues.length
        };
    }));

    // 2. Burndown (Current active sprint)
    const activeSprint = await Sprint.findOne({ project: projectId, organization: organizationId, status: 'active' });
    let burndownData = [];
    if (activeSprint) {
        // Simple mock of daily burndown for now
        // In a real app, you'd track daily snapshots of remaining points
    }

    return {
        velocity: velocityData.reverse(),
        activeSprint
    };
};

module.exports = {
    getOrgStats,
    getProjectAnalytics,
};
