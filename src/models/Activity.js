const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema(
    {
        issue: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Issue',
            // required: true, // Made optional for meeting events
        },
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        type: {
            type: String,
            enum: ['create', 'update', 'comment', 'meeting_scheduled', 'meeting_started', 'meeting_ended', 'mom_generated', 'mom_sent'],
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
        // NEW FIELDS FOR MEETING
        organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization' },
        projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
        meetingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Meeting' },
        metadata: {
            meetingTitle: String,
            transcriptSnippet: String,
            actionItemsCount: Number,
            attendeeCount: Number,
            duration: Number,
            momSummary: String
        }
    },
    {
        timestamps: true,
    }
);

activitySchema.index({ issue: 1, createdAt: -1 });
activitySchema.index({ organizationId: 1, projectId: 1, createdAt: -1 });
activitySchema.index({ meetingId: 1 });

const Activity = mongoose.model('Activity', activitySchema);
module.exports = Activity;
