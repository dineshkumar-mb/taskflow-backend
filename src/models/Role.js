const mongoose = require('mongoose');

const roleSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
        },
        description: {
            type: String,
        },
        isSystem: {
            type: Boolean,
            default: false, // true for default roles like 'Admin', 'Member', which can't be deleted
        },
        permissions: [
            {
                type: String,
            }
        ],
        organization: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Organization',
            required: true,
        }
    },
    {
        timestamps: true,
    }
);

// Prevent duplicate role names within the same organization
roleSchema.index({ name: 1, organization: 1 }, { unique: true });

module.exports = mongoose.model('Role', roleSchema);
