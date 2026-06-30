const Organization = require('../src/models/Organization');
const Subscription = require('../src/models/Subscription');

const up = async () => {
    console.log('[Migration 002] Upgrading database to decoupled subscriptions...');
    
    const orgs = await Organization.find({});
    for (const org of orgs) {
        const subExists = await Subscription.findOne({ organization: org._id });
        if (!subExists) {
            await Subscription.create({
                organization: org._id,
                plan: org.plan || org.currentPlan || 'free',
                status: org.subscriptionStatus || 'active',
                paymentProvider: org.stripeSubscriptionId ? 'stripe' : (org.cashfreeSubscriptionId ? 'cashfree' : 'none'),
                paymentProviderId: org.stripeSubscriptionId || org.cashfreeSubscriptionId || null
            });
            console.log(`[Migration 002] Created Subscription for organization: ${org.name}`);
        }
    }

    console.log('[Migration 002] Completed successfully.');
};

const down = async () => {
    console.log('[Migration 002] Rollback not implemented.');
};

module.exports = { up, down };
