const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
        },
        key: {
            type: String,
            required: true,
            uppercase: true,
        },
        organization: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Organization',
            required: true,
        },
        lead: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        members: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User',
            },
        ],
        description: {
            type: String,
        },
        avatar: {
            type: String,
        },
        issueCounter: {
            type: Number,
            default: 0,
        },
    },
    {
        timestamps: true,
    }
);

const Project = mongoose.model('Project', projectSchema);

module.exports = Project;
