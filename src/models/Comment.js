const mongoose = require('mongoose');

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

commentSchema.index({ issue: 1, createdAt: 1 });

const Comment = mongoose.model('Comment', commentSchema);

module.exports = Comment;
