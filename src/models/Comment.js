const mongoose = require('mongoose');
const softDeletePlugin = require('../utils/softDelete.plugin');

const commentSchema = new mongoose.Schema(
    {
        content: {
            type: String,
            required: true,
        },
        issue: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Issue',
            required: true,
        },
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        organization: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Organization',
            required: true,
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
        updatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
        parentComment: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Comment',
            default: null,
        },
    },
    {
        timestamps: true,
    }
);

commentSchema.index({ organization: 1 });
commentSchema.index({ issue: 1, createdAt: 1 });

commentSchema.plugin(softDeletePlugin);

const Comment = mongoose.model('Comment', commentSchema);

module.exports = Comment;

