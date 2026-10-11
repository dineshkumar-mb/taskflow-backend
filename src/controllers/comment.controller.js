const commentService = require('../services/comment.service');
const webhookService = require('../services/webhook.service');
const { assertIssueAccess, getActiveOrganizationId } = require('../security/tenantAccess');

const getComments = async (req, res) => {
    try {
        const { issueId } = req.query;
        if (!issueId) return res.status(400).json({ message: 'issueId is required' });

        const issue = await assertIssueAccess(req, issueId);
        const orgId = issue.organization || req.organizationId;

        const comments = await commentService.getComments(issueId, orgId);
        res.json(comments);
    } catch (error) {
        const statusCode = error.statusCode || (error.name === 'TenantAccessError' ? 403 : 500);
        res.status(statusCode).json({ message: error.message });
    }
};

const addComment = async (req, res) => {
    try {
        const { issueId, content, parentComment } = req.body;
        if (!issueId || !content) return res.status(400).json({ message: 'issueId and content are required' });

        const issue = await assertIssueAccess(req, issueId);
        const orgId = issue.organization || req.organizationId;

        const comment = await commentService.createComment(req.user._id, orgId, issueId, content, req.io, parentComment);
        res.status(201).json(comment);
        // n8n: fire-and-forget
        webhookService.emit('comment.added', {
            comment: {
                id: comment._id, content: comment.content,
                issueId, parentComment: parentComment || null,
            },
            organizationId: orgId,
            author: { id: req.user._id, email: req.user.email, name: req.user.name },
        });
    } catch (error) {
        const statusCode = error.statusCode || (error.name === 'TenantAccessError' ? 403 : 400);
        res.status(statusCode).json({ message: error.message });
    }
};

const deleteComment = async (req, res) => {
    try {
        const orgId = req.organizationId || await getActiveOrganizationId(req);
        await commentService.deleteComment(req.params.id, req.user._id, orgId, req.userOrgRole || req.user.roleName || req.user.role);
        res.json({ message: 'Comment deleted' });
    } catch (error) {
        const statusCode = error.statusCode || (error.name === 'TenantAccessError' ? 403 : 400);
        res.status(statusCode).json({ message: error.message });
    }
};

module.exports = {
    getComments,
    addComment,
    deleteComment,
};
