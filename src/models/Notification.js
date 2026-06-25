const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
    {
        user: { // The recipient of the notification
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        type: {
            type: String,
            enum: ['mention', 'assignment', 'comment', 'system'],
            required: true,
        },
        message: {
            type: String,
            required: true,
        },
        issue: { // Optional: related issue
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Issue',
        },
        read: {
            type: Boolean,
            default: false,
        },
        initiator: { // Optional: who triggered it
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        }
    },
    {
        timestamps: true,
    }
);

notificationSchema.index({ user: 1, read: 1, createdAt: -1 });

const Notification = mongoose.model('Notification', notificationSchema);

module.exports = Notification;
