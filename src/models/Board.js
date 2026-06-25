const mongoose = require('mongoose');

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

const Board = mongoose.model('Board', boardSchema);

module.exports = Board;
