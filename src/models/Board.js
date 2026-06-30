const mongoose = require('mongoose');
const softDeletePlugin = require('../utils/softDelete.plugin');

const boardSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
        },
        type: {
            type: String,
            enum: ['kanban', 'scrum'],
            required: true,
            default: 'kanban',
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
        columns: [
            {
                name: { type: String, required: true },
                status: { type: String, required: true }, // Maps to issue status
                position: { type: Number, required: true },
            },
        ],
    },
    {
        timestamps: true,
    }
);

boardSchema.index({ organization: 1 });
boardSchema.index({ organization: 1, project: 1 });

boardSchema.plugin(softDeletePlugin);

const Board = mongoose.model('Board', boardSchema);

module.exports = Board;

