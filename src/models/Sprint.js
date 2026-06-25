const mongoose = require('mongoose');

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
        board: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Board',
        },
    },
    {
        timestamps: true,
    }
);

const Sprint = mongoose.model('Sprint', sprintSchema);

module.exports = Sprint;
