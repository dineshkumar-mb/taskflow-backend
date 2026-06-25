const mongoose = require('mongoose');

const organizationSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
        },
        owner: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        members: [
            {
                user: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: 'User',
                },
                role: {
                    type: String,
                    enum: ['OrgOwner', 'Owner', 'Admin', 'Member', 'Viewer'],
                    default: 'Member',
                },
            },
        ],
        projects: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Project',
            },
        ],
        plan: {
            type: String,
            enum: ['free', 'pro', 'team'],
            default: 'free',
        },
        stripeCustomerId: String,
        stripeSubscriptionId: String,
        cashfreeCustomerId: String,
        cashfreeSubscriptionId: String,
        subscriptionStatus: {
            type: String,
            enum: ['active', 'past_due', 'canceled', 'incomplete', 'incomplete_expired', 'trialing', 'unpaid'],
            default: 'active', // Defaulting to active for free plan logic
        },
        aiUsageCount: {
            type: Number,
            default: 0
        },
    },
    {
        timestamps: true,
    }
);

const Organization = mongoose.model('Organization', organizationSchema);

module.exports = Organization;
