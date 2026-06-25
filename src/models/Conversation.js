const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema(
    {
        participants: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User',
                required: true,
            },
        ],
        lastMessage: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Message',
        },
    },
    {
        timestamps: true,
    }
);

// Index to quickly find conversations for a user
conversationSchema.index({ participants: 1 });

const Conversation = mongoose.model('Conversation', conversationSchema);

module.exports = Conversation;
