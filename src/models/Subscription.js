const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema(
    {
        organization: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Organization',
            required: true,
        },
        plan: {
            type: String,
            enum: ['free', 'pro', 'team'],
            required: true,
        },
        stripeSubscriptionId: {
            type: String,
            required: true,
        },
        stripePriceId: {
            type: String,
            required: true,
        },
        status: {
            type: String,
            required: true,
        },
        currentPeriodEnd: {
            type: Date,
            required: true,
        },
        cancelAtPeriodEnd: {
            type: Boolean,
            default: false,
        },
    },
    {
        timestamps: true,
    }
);

const Subscription = mongoose.model('Subscription', subscriptionSchema);

module.exports = Subscription;
