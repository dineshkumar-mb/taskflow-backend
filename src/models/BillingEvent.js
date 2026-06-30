const mongoose = require('mongoose');

const billingEventSchema = new mongoose.Schema({
    organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    type: { type: String, enum: ['SUBSCRIPTION_CREATED', 'SUBSCRIPTION_RENEWED', 'PAYMENT_FAILED', 'PLAN_UPGRADED', 'PLAN_DOWNGRADED', 'REFUND'], required: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'INR' },
    provider: { type: String, required: true },
    providerEventId: { type: String },
    metadata: { type: Map, of: String }
}, { timestamps: true });

module.exports = mongoose.model('BillingEvent', billingEventSchema);
