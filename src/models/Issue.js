const mongoose = require('mongoose');

const issueSchema = new mongoose.Schema(
    {
        key: {
            type: String, // e.g., WEB-1
        },
        title: {
            type: String,
            required: true,
        },
        description: {
            type: String,
        },
        type: {
            type: String,
            enum: ['epic', 'story', 'task', 'subtask', 'bug'],
            default: 'task',
        },
        status: {
            type: String,
            required: true,
            default: 'todo',
        },
        priority: {
            type: String,
            enum: ['low', 'medium', 'high', 'critical'],
            default: 'medium',
        },
        project: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Project',
            required: true,
        },
        organization: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Organization',
            required: true,
        },
        assignee: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
        reporter: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        sprint: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Sprint',
        },
        parentIssue: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Issue',
        },
        position: {
            type: Number,
            required: true,
            default: 0,
        },
        storyPoints: {
            type: Number,
        },
        dueDate: {
            type: Date,
        },
        commits: [
            {
                hash: String,
                message: String,
                url: String,
                author: String,
                date: Date,
            }
        ],
        labels: [
            {
                type: String,
            },
        ],
        attachments: [
            {
                type: String, // URLs to S3, Cloudinary
            },
        ],
        links: [
            {
                type: {
                    type: String,
                    enum: ['blocks', 'is-blocked-by', 'relates-to', 'duplicates', 'clones'],
                    required: true,
                },
                issue: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: 'Issue',
                    required: true,
                },
            },
        ],
    },
    {
        timestamps: true,
    }
);

// Indexes for performance optimization
issueSchema.index({ project: 1 }); // Quickly fetch all issues in a project
issueSchema.index({ project: 1, status: 1 }); // Used in Board column views
issueSchema.index({ sprint: 1 }); // Used for sprint filtering
issueSchema.index({ assignee: 1 }); // Workload queries
issueSchema.index({ key: 1 }, { unique: true }); // Fast key lookup

const Issue = mongoose.model('Issue', issueSchema);

module.exports = Issue;
