const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema(
    {
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
        type: {
            type: String,
            enum: ['create', 'update', 'comment'],
            required: true,
        },
        field: {
            type: String, // e.g., 'status', 'assignee', 'priority'
        },
        oldValue: {
            type: String, // Or Mixed if you want to store objects, but String is safer for display
        },
        newValue: {
            type: String,
        },
        content: {
            type: String, // Used if type === 'comment'
        },
    },
    {
        timestamps: true,
    }
);

activitySchema.index({ issue: 1, createdAt: -1 });

const Activity = mongoose.model('Activity', activitySchema);
module.exports = Activity;
