const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
    organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, unique: true, index: true },
    plan: { type: String, enum: ['free', 'starter', 'business', 'enterprise'], default: 'free' },
    status: { type: String, enum: ['active', 'past_due', 'canceled', 'ACTIVE', 'CANCELLED'], default: 'active' },
    startDate: { type: Date, default: Date.now },
    renewalDate: { type: Date },
    paymentProvider: { type: String, enum: ['stripe', 'cashfree', 'none'], default: 'none' },
    paymentProviderId: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('Subscription', subscriptionSchema);
