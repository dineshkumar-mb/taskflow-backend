const Comment = require('../models/Comment');
const User = require('../models/User');
const Issue = require('../models/Issue');
const notificationService = require('./notification.service');

const getComments = async (issueId) => {
    return await Comment.find({ issue: issueId })
        .populate('user', 'name avatar')
        .sort({ createdAt: 1 });
};

const createComment = async (userId, issueId, content, io, parentComment = null) => {
    const comment = await Comment.create({
        content,
        issue: issueId,
        user: userId,
        parentComment,
    });

    // Extract @mentions
    const mentionRegex = /@(\w+)/g;
    const matches = [...content.matchAll(mentionRegex)].map(m => m[1]);
    const mentionedUsers = new Set();

    for (const match of matches) {
        // Quick lookup by first name prefix 
        const user = await User.findOne({ name: { $regex: new RegExp(`^${match}`, 'i') } });
        if (user && !mentionedUsers.has(user._id.toString())) {
            mentionedUsers.add(user._id.toString());
            const issue = await Issue.findById(issueId);

            await notificationService.createNotification({
                user: user._id,
                initiator: userId,
                type: 'mention',
                message: `mentioned you in ${issue ? issue.key : 'an issue'}`,
                issue: issueId
            }, io);
        }
    }

    return await Comment.findById(comment._id).populate('user', 'name avatar');
};

const deleteComment = async (commentId, userId) => {
    const comment = await Comment.findById(commentId);
    if (!comment) throw new Error('Comment not found');
    if (comment.user.toString() !== userId.toString()) {
        throw new Error('Not authorized to delete this comment');
    }
    await Comment.findByIdAndDelete(commentId);
};

module.exports = {
    getComments,
    createComment,
    deleteComment,
};
