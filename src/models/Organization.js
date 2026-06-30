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
            enum: ['free', 'starter', 'business', 'enterprise'],
            default: 'free',
        },
        currentPlan: {
            type: String,
            enum: ['free', 'starter', 'business', 'enterprise'],
            default: 'free',
        },
        authStrategy: {
            type: String,
            enum: ['local', 'google', 'azure', 'okta'],
            default: 'local'
        },
        stripeCustomerId: String,
        stripeSubscriptionId: String,
        cashfreeSubscriptionId: String,
        cashfreePlanId: String,
        subscriptionStatus: {
            type: String,
            enum: ['active', 'past_due', 'canceled', 'incomplete', 'incomplete_expired', 'trialing', 'unpaid', 'ACTIVE', 'ON_HOLD', 'CANCELLED'],
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
