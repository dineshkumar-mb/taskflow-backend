const mongoose = require('mongoose');
const softDeletePlugin = require('../utils/softDelete.plugin');

const conversationSchema = new mongoose.Schema(
    {
        participants: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User',
                required: true,
            },
        ],
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
        lastMessage: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Message',
        },
    },
    {
        timestamps: true,
    }
);

conversationSchema.index({ organization: 1 });
conversationSchema.index({ participants: 1 });

conversationSchema.plugin(softDeletePlugin);

const Conversation = mongoose.model('Conversation', conversationSchema);

module.exports = Conversation;

