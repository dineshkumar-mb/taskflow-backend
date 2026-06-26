const issueService = require('../services/issue.service');
const Issue = require('../models/Issue'); // for webhook lookup
const User = require('../models/User');
const webhookService = require('../services/webhook.service');
const notificationService = require('../services/notification.service');
const auditService = require('../services/audit.service');

const createIssue = async (req, res) => {
    try {
        const issue = await issueService.createIssue(req.user._id, req.user.organizationId, req.body, req.io);
        res.status(201).json(issue);
        
        auditService.logAction({
            action: 'CREATE',
            entityType: 'Issue',
            entityId: issue._id,
            user: req.user._id,
            organization: req.user.organizationId,
            details: { title: issue.title, key: issue.key },
            ipAddress: req.ip
        });

        // n8n: fire-and-forget
        webhookService.emit('issue.created', {
            issue: {
                id: issue._id, key: issue.key, title: issue.title,
                type: issue.type, status: issue.status, priority: issue.priority,
                project: issue.project, assignee: issue.assignee, reporter: issue.reporter,
            },
            triggeredBy: { id: req.user._id, email: req.user.email, name: req.user.name },
        });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

const getIssues = async (req, res) => {
    try {
        const { projectId, sprint, assignee, status, noSprint, parentIssue } = req.query;
        const issues = await issueService.getIssues(req.user.organizationId, projectId, { sprint, assignee, status, noSprint, parentIssue });
        res.json(issues);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const getIssueById = async (req, res) => {
    try {
        const issue = await issueService.getIssueById(req.params.id, req.user.organizationId);
        res.json(issue);
    } catch (error) {
        res.status(404).json({ message: error.message });
    }
};

const updateIssue = async (req, res) => {
    try {
        const issue = await issueService.updateIssue(req.params.id, req.user.organizationId, req.body, req.user._id, req.io);
        res.json(issue);

        auditService.logAction({
            action: 'UPDATE',
            entityType: 'Issue',
            entityId: issue._id,
            user: req.user._id,
            organization: req.user.organizationId,
            details: { changedFields: req.body },
            ipAddress: req.ip
        });

        // n8n: fire-and-forget, includes changed fields for routing in n8n
        webhookService.emit('issue.updated', {
            issue: {
                id: issue._id, key: issue.key, title: issue.title,
                type: issue.type, status: issue.status, priority: issue.priority,
                project: issue.project, assignee: issue.assignee,
            },
            changedFields: req.body,
            triggeredBy: { id: req.user._id, email: req.user.email, name: req.user.name },
        });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

const deleteIssue = async (req, res) => {
    try {
        await issueService.deleteIssue(req.params.id, req.user.organizationId);
        res.json({ message: 'Issue removed' });

        auditService.logAction({
            action: 'DELETE',
            entityType: 'Issue',
            entityId: req.params.id,
            user: req.user._id,
            organization: req.user.organizationId,
            ipAddress: req.ip
        });

        // n8n: fire-and-forget
        webhookService.emit('issue.deleted', {
            issueId: req.params.id,
            triggeredBy: { id: req.user._id, email: req.user.email, name: req.user.name },
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const getIssueActivities = async (req, res) => {
    try {
        const activities = await issueService.getIssueActivities(req.params.id);
        res.json(activities);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const githubWebhook = async (req, res) => {
    try {
        const { commits } = req.body;

        if (!commits || !Array.isArray(commits)) {
            return res.status(200).json({ message: 'No commits to process' });
        }

        let linkedCount = 0;

        for (const commit of commits) {
            // Find issue keys like "WEB-12"
            const issueKeyRegex = /([A-Z]+-\d+)/g;
            const match = commit.message.match(issueKeyRegex);

            if (match) {
                for (const key of match) {
                    const issue = await Issue.findOne({ key });
                    if (issue) {
                        const exists = issue.commits.some(c => c.hash === commit.id);
                        if (!exists) {
                            issue.commits.push({
                                hash: commit.id,
                                message: commit.message,
                                url: commit.url,
                                author: commit.author?.name || 'GitHub User',
                                date: commit.timestamp || new Date()
                            });
                            await issue.save();
                            linkedCount++;
                        }
                    }
                }
            }
        }

        res.status(200).json({ message: `Processed webhook. Linked ${linkedCount} commits.` });
    } catch (error) {
        console.error('Webhook error:', error);
        res.status(500).json({ message: 'Server Error processing webhook' });
    }
};

const uploadAttachments = async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ message: 'No files uploaded' });
        }

        // Generate relative URLs or direct file paths for the frontend
        const fileUrls = req.files.map(file => `/uploads/${file.filename}`);

        // Use issueService to append these paths
        const issue = await issueService.addAttachments(req.params.id, req.user.organizationId, fileUrls, req.user._id);

        res.status(200).json({ message: 'Files uploaded successfully', issue });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const addLink = async (req, res) => {
    try {
        const { type, targetIssueId } = req.body;
        if (!type || !targetIssueId) return res.status(400).json({ message: 'type and targetIssueId are required' });
        const issue = await issueService.addLink(req.params.id, req.user.organizationId, type, targetIssueId, req.user._id);
        res.json(issue);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

const removeLink = async (req, res) => {
    try {
        const issue = await issueService.removeLink(req.params.id, req.user.organizationId, req.params.linkId, req.user._id);
        res.json(issue);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

const reorderIssues = async (req, res) => {
    try {
        const issue = await issueService.reorderIssues(req.user._id, req.user.organizationId, req.body, req.io);
        res.json(issue);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

/**
 * n8n callback endpoint: PUT /api/issues/:id/assign
 * Called by n8n workflow to auto-assign a high-priority issue.
 * Authenticated via x-n8n-secret header (not JWT) so n8n doesn't need credentials.
 */
const assignIssue = async (req, res) => {
    try {
        // Lightweight secret-based auth for n8n callbacks
        const secret = req.headers['x-n8n-secret'];
        if (secret !== process.env.N8N_CALLBACK_SECRET) {
            return res.status(401).json({ message: 'Unauthorized: invalid n8n secret' });
        }

        const { assignee: assigneeName } = req.body;
        if (!assigneeName) {
            return res.status(400).json({ message: 'assignee name is required' });
        }

        // Find issue
        const issue = await Issue.findById(req.params.id);
        if (!issue) {
            return res.status(404).json({ message: 'Issue not found' });
        }

        // Resolve assignee by name (case-insensitive, within same org)
        const assigneeUser = await User.findOne({
            name: { $regex: new RegExp(`^${assigneeName}$`, 'i') },
            organizationId: issue.organization,
        }).select('_id name email');

        if (!assigneeUser) {
            return res.status(404).json({
                message: `User "${assigneeName}" not found in this organization`,
            });
        }

        // Update the issue assignee
        issue.assignee = assigneeUser._id;
        await issue.save();

        // Send in-app notification via Socket.io
        await notificationService.createNotification({
            user: assigneeUser._id,
            initiator: issue.reporter,
            type: 'assignment',
            message: `n8n auto-assigned you to high priority ${issue.type}: ${issue.key} — "${issue.title}"`,
            issue: issue._id,
        }, req.io);

        console.log(`[n8n] ✓ Auto-assigned issue ${issue.key} to ${assigneeUser.name}`);

        // Return the updated issue with populated fields
        const populated = await Issue.findById(issue._id)
            .populate('assignee', 'name avatar email')
            .populate('reporter', 'name avatar');

        res.json({
            message: `Issue ${issue.key} auto-assigned to ${assigneeUser.name} by n8n`,
            issue: populated,
            assignee: { id: assigneeUser._id, name: assigneeUser.name },
        });
    } catch (error) {
        console.error('[n8n] assignIssue error:', error);
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    createIssue,
    getIssues,
    getIssueById,
    updateIssue,
    deleteIssue,
    getIssueActivities,
    githubWebhook,
    uploadAttachments,
    addLink,
    removeLink,
    reorderIssues,
    assignIssue,
};
