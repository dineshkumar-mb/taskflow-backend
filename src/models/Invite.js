const mongoose = require('mongoose');

const inviteSchema = new mongoose.Schema(
    {
        email: {
            type: String,
            required: true,
        },
        organization: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Organization',
            required: true,
        },
        sender: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        role: {
            type: String,
            enum: ['Admin', 'Member', 'Viewer'],
            default: 'Member',
        },
        token: {
            type: String,
            required: true,
            unique: true,
        },
        status: {
            type: String,
            enum: ['pending', 'accepted', 'expired'],
            default: 'pending',
        },
        expiresAt: {
            type: Date,
            required: true,
        },
    },
    {
        timestamps: true,
    }
);

const Invite = mongoose.model('Invite', inviteSchema);

module.exports = Invite;
