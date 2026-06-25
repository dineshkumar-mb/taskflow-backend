const commentService = require('../services/comment.service');
const webhookService = require('../services/webhook.service');

const getComments = async (req, res) => {
    try {
        const { issueId } = req.query;
        if (!issueId) return res.status(400).json({ message: 'issueId is required' });
        const comments = await commentService.getComments(issueId);
        res.json(comments);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const addComment = async (req, res) => {
    try {
        const { issueId, content, parentComment } = req.body;
        if (!issueId || !content) return res.status(400).json({ message: 'issueId and content are required' });
        const comment = await commentService.createComment(req.user._id, issueId, content, req.io, parentComment);
        res.status(201).json(comment);
        // n8n: fire-and-forget
        webhookService.emit('comment.added', {
            comment: {
                id: comment._id, content: comment.content,
                issueId, parentComment: parentComment || null,
            },
            author: { id: req.user._id, email: req.user.email, name: req.user.name },
        });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

const deleteComment = async (req, res) => {
    try {
        await commentService.deleteComment(req.params.id, req.user._id);
        res.json({ message: 'Comment deleted' });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

module.exports = {
    getComments,
    addComment,
    deleteComment,
};
