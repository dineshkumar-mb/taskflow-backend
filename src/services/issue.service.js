const Issue = require('../models/Issue');
const Project = require('../models/Project');
const Activity = require('../models/Activity');
const notificationService = require('./notification.service');

const createIssue = async (userId, organizationId, data, io) => {
    // Auto-generate issue key by atomically incrementing project counter
    const project = await Project.findOneAndUpdate(
        { _id: data.project, organization: organizationId },
        { $inc: { issueCounter: 1 } },
        { new: true }
    );
    if (!project) throw new Error('Project not found or not in your organization');

    const issueKey = `${project.key}-${project.issueCounter}`;

    // Get highest position in the column/status to append
    const lastIssue = await Issue.findOne({
        project: data.project,
        organization: organizationId,
        status: data.status,
    }).sort({ position: -1 });

    const position = lastIssue ? lastIssue.position + 1 : 0;

    const issue = await Issue.create({
        ...data,
        key: issueKey,
        reporter: userId,
        organization: organizationId,
        position,
    });

    await Activity.create({
        issue: issue._id,
        user: userId,
        type: 'create',
    });

    if (data.assignee) {
        await notificationService.createNotification({
            user: data.assignee,
            initiator: userId,
            type: 'assignment',
            message: `assigned you to ${issueKey}`,
            issue: issue._id
        }, io);
    }

    return await Issue.findById(issue._id)
        .populate('assignee', 'name avatar')
        .populate('reporter', 'name avatar');
};

const getIssues = async (organizationId, projectId, filters = {}) => {
    const query = { project: projectId, organization: organizationId };

    if (filters.sprint) query.sprint = filters.sprint;
    if (filters.assignee) query.assignee = filters.assignee;
    if (filters.status) query.status = filters.status;
    if (filters.noSprint === 'true') query.$or = [{ sprint: { $exists: false } }, { sprint: null }];
    if (filters.parentIssue) query.parentIssue = filters.parentIssue;

    return await Issue.find(query)
        .populate('assignee', 'name avatar')
        .populate('reporter', 'name avatar')
        .sort({ position: 1 });
};

const getIssueById = async (issueId, organizationId) => {
    const issue = await Issue.findOne({ _id: issueId, organization: organizationId })
        .populate('assignee', 'name avatar')
        .populate('reporter', 'name avatar')
        .populate('sprint', 'name status')
        .populate('links.issue', 'key title status');

    if (!issue) throw new Error('Issue not found in your organization');
    return issue;
};

const updateIssue = async (issueId, organizationId, data, userId, io) => {
    const oldIssue = await Issue.findOne({ _id: issueId, organization: organizationId });
    if (!oldIssue) throw new Error('Issue not found in your organization');

    const updatedIssue = await Issue.findByIdAndUpdate(issueId, data, { new: true })
        .populate('assignee', 'name avatar')
        .populate('reporter', 'name avatar');

    if (userId) {
        const fieldsToTrack = ['status', 'priority', 'type', 'title', 'sprint', 'assignee', 'dueDate'];
        for (const field of fieldsToTrack) {
            if (data[field] !== undefined && String(oldIssue[field] || '') !== String(data[field] || '')) {
                await Activity.create({
                    issue: issueId,
                    user: userId,
                    type: 'update',
                    field,
                    oldValue: String(oldIssue[field] || ''),
                    newValue: String(data[field] || ''),
                });

                if (field === 'assignee' && data.assignee && String(oldIssue.assignee) !== String(data.assignee)) {
                    await notificationService.createNotification({
                        user: data.assignee,
                        initiator: userId,
                        type: 'assignment',
                        message: `assigned you to ${oldIssue.key}`,
                        issue: issueId
                    }, io);
                }
            }
        }
    }

    return updatedIssue;
};

const deleteIssue = async (issueId, organizationId) => {
    return await Issue.findOneAndDelete({ _id: issueId, organization: organizationId });
};

const getIssueActivities = async (issueId) => {
    return await Activity.find({ issue: issueId })
        .populate('user', 'name avatar')
        .sort({ createdAt: -1 });
};

const addAttachments = async (issueId, organizationId, fileUrls, userId) => {
    const updatedIssue = await Issue.findOneAndUpdate(
        { _id: issueId, organization: organizationId },
        { $push: { attachments: { $each: fileUrls } } },
        { new: true }
    );

    if (!updatedIssue) throw new Error('Issue not found in your organization');

    if (userId) {
        await Activity.create({
            issue: issueId,
            user: userId,
            type: 'update',
            field: 'attachments',
            newValue: `Added ${fileUrls.length} attachment(s)`
        });
    }

    return updatedIssue;
};

const addLink = async (issueId, organizationId, linkType, targetIssueId, userId) => {
    // Add the link to the source issue
    const issue = await Issue.findOneAndUpdate(
        { _id: issueId, organization: organizationId },
        { $push: { links: { type: linkType, issue: targetIssueId } } },
        { new: true }
    ).populate('links.issue', 'key title status');

    if (!issue) throw new Error('Issue not found in your organization');

    // Add the inverse link to the target issue (ensuring it's in the same org)
    await Issue.findOneAndUpdate(
        { _id: targetIssueId, organization: organizationId },
        { $push: { links: { type: inverseTypes[linkType] || 'relates-to', issue: issueId } } }
    );

    if (userId) {
        await Activity.create({
            issue: issueId,
            user: userId,
            type: 'update',
            field: 'links',
            newValue: `Linked as ${linkType} to ${targetIssueId}`
        });
    }

    return issue;
};

const removeLink = async (issueId, organizationId, linkId, userId) => {
    const issue = await Issue.findOne({ _id: issueId, organization: organizationId });
    if (!issue) throw new Error('Issue not found in your organization');

    const link = issue.links.id(linkId);
    if (!link) throw new Error('Link not found');

    const targetIssueId = link.issue;

    // Remove from source
    issue.links.pull(linkId);
    await issue.save();

    // Remove inverse from target (ensuring same org)
    await Issue.findOneAndUpdate(
        { _id: targetIssueId, organization: organizationId },
        { $pull: { links: { issue: issueId } } }
    );

    if (userId) {
        await Activity.create({
            issue: issueId,
            user: userId,
            type: 'update',
            field: 'links',
            newValue: `Removed link`
        });
    }

    return await Issue.findById(issueId).populate('links.issue', 'key title status');
};

const reorderIssues = async (userId, organizationId, { issueId, status, position, projectId, sprintId }, io) => {
    const issue = await Issue.findOne({ _id: issueId, organization: organizationId });
    if (!issue) throw new Error('Issue not found or not in your organization');

    const oldStatus = issue.status;
    const oldPosition = issue.position;
    const oldSprint = issue.sprint;

    // Update the primary issue
    issue.status = status;
    issue.position = position;
    issue.sprint = sprintId || null;
    await issue.save();

    // Reorder other issues in the same column/sprint to avoid duplicates or gaps
    const query = {
        project: projectId,
        organization: organizationId,
        status: status,
        _id: { $ne: issueId }
    };
    if (sprintId) query.sprint = sprintId;
    else query.$or = [{ sprint: { $exists: false } }, { sprint: null }];

    const otherIssues = await Issue.find(query).sort({ position: 1 });

    // Splice in the moved issue at the new position
    const newOrder = [...otherIssues];
    newOrder.splice(position, 0, issue);

    // Update all positions in this neighborhood
    const bulkOps = newOrder.map((item, index) => ({
        updateOne: {
            filter: { _id: item._id, organization: organizationId },
            update: { $set: { position: index } }
        }
    }));

    if (bulkOps.length > 0) {
        await Issue.bulkWrite(bulkOps);
    }

    // Notify others
    if (io) {
        io.to(projectId.toString()).emit('issue:reordered', {
            projectId,
            issueId,
            status,
            sprintId
        });
    }

    // Log activity if status or sprint changed
    if (oldStatus !== status || String(oldSprint || '') !== String(sprintId || '')) {
        await Activity.create({
            issue: issueId,
            user: userId,
            type: 'update',
            field: oldStatus !== status ? 'status' : 'sprint',
            oldValue: oldStatus !== status ? oldStatus : String(oldSprint || 'backlog'),
            newValue: oldStatus !== status ? status : String(sprintId || 'backlog'),
        });
    }

    return await Issue.findById(issueId)
        .populate('assignee', 'name avatar')
        .populate('reporter', 'name avatar');
};

module.exports = {
    createIssue,
    getIssues,
    getIssueById,
    updateIssue,
    deleteIssue,
    getIssueActivities,
    addAttachments,
    addLink,
    removeLink,
    reorderIssues,
};
