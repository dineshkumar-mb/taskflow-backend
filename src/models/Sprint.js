const mongoose = require('mongoose');
const softDeletePlugin = require('../utils/softDelete.plugin');

const sprintSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
        },
        goal: {
            type: String,
        },
        startDate: {
            type: Date,
        },
        endDate: {
            type: Date,
        },
        status: {
            type: String,
            enum: ['future', 'active', 'completed'],
            default: 'future',
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
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
        updatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
        board: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Board',
        },
    },
    {
        timestamps: true,
    }
);

sprintSchema.index({ organization: 1 });
sprintSchema.index({ project: 1, status: 1 });

sprintSchema.plugin(softDeletePlugin);

const Sprint = mongoose.model('Sprint', sprintSchema);

module.exports = Sprint;

