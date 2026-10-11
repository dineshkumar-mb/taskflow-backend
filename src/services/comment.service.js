const Comment = require('../models/Comment');
const User = require('../models/User');
const Issue = require('../models/Issue');
const OrganizationMember = require('../models/OrganizationMember');
const notificationService = require('./notification.service');

const getComments = async (issueId, organizationId = null) => {
    const query = { issue: issueId };
    if (organizationId) {
        query.organization = organizationId;
    }
    return await Comment.find(query)
        .populate('user', 'name avatar')
        .sort({ createdAt: 1 });
};

const createComment = async (userId, organizationId, issueId, content, io, parentComment = null) => {
    const comment = await Comment.create({
        content,
        issue: issueId,
        user: userId,
        organization: organizationId,
        parentComment,
    });

    // Extract @mentions strictly within the organization
    const mentionRegex = /@(\w+)/g;
    const matches = [...content.matchAll(mentionRegex)].map(m => m[1]);
    const mentionedUsers = new Set();

    if (matches.length > 0) {
        let memberUserIds = [];
        if (organizationId) {
            const orgMembers = await OrganizationMember.find({
                organization: organizationId,
                status: 'active'
            }).select('user').lean();
            memberUserIds = orgMembers.map(m => m.user);
        }

        for (const match of matches) {
            const userFilter = { name: { $regex: new RegExp(`^${match}`, 'i') } };
            if (memberUserIds.length > 0) {
                userFilter._id = { $in: memberUserIds };
            }

            const user = await User.findOne(userFilter);
            if (user && !mentionedUsers.has(user._id.toString())) {
                mentionedUsers.add(user._id.toString());
                const issueQuery = { _id: issueId };
                if (organizationId) issueQuery.organization = organizationId;
                const issue = await Issue.findOne(issueQuery);

                await notificationService.createNotification({
                    user: user._id,
                    initiator: userId,
                    organization: organizationId,
                    type: 'mention',
                    message: `mentioned you in ${issue ? issue.key : 'an issue'}`,
                    issue: issueId
                }, io);
            }
        }
    }

    return await Comment.findById(comment._id).populate('user', 'name avatar');
};

const deleteComment = async (commentId, userId, organizationId = null, userRole = 'Member') => {
    const query = { _id: commentId };
    if (organizationId) {
        query.organization = organizationId;
    }
    const comment = await Comment.findOne(query);
    if (!comment) throw new Error('Comment not found');

    const isAuthor = comment.user.toString() === userId.toString();
    const isAdmin = ['SuperAdmin', 'OrgOwner', 'Owner', 'Admin'].includes(userRole);
    if (!isAuthor && !isAdmin) {
        throw new Error('Not authorized to delete this comment');
    }
    await Comment.findByIdAndDelete(commentId);
};

module.exports = {
    getComments,
    createComment,
    deleteComment,
};
