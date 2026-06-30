const mongoose = require('mongoose');
const softDeletePlugin = require('../utils/softDelete.plugin');

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
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
        updatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
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
        searchText: {
            type: String,
            index: true,
        }
    },
    {
        timestamps: true,
    }
);

projectSchema.index({ organization: 1 });

// Middleware to populate searchText for future search index
projectSchema.pre('save', function(next) {
    this.searchText = `${this.name} ${this.key} ${this.description || ''}`.trim().toLowerCase();
    next();
});

projectSchema.plugin(softDeletePlugin);

const Project = mongoose.model('Project', projectSchema);

module.exports = Project;

