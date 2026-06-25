const stripeKey = process.env.STRIPE_SECRET_KEY;
const isStripeConfigured = stripeKey && stripeKey.startsWith('sk_');
const stripe = require('stripe')(isStripeConfigured ? stripeKey : 'sk_test_dummy_key');

const Organization = require('../models/Organization');
const Subscription = require('../models/Subscription');

const handleWebhook = async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        event = stripe.webhooks.constructEvent(
            req.body,
            sig,
            process.env.STRIPE_WEBHOOK_SECRET
        );
    } catch (err) {
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    const session = event.data.object;

    switch (event.type) {
        case 'checkout.session.completed':
            await handleCheckoutCompleted(session);
            break;
        case 'invoice.payment_succeeded':
            await handleSubscriptionUpdated(session.subscription);
            break;
        case 'customer.subscription.updated':
            await handleSubscriptionUpdated(session.id);
            break;
        case 'customer.subscription.deleted':
            await handleSubscriptionDeleted(session.id);
            break;
        default:
            console.log(`Unhandled event type ${event.type}`);
    }

    res.json({ received: true });
};

const handleCheckoutCompleted = async (session) => {
    const organizationId = session.metadata.organizationId;
    const subscriptionId = session.subscription;

    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const planId = subscription.items.data[0].price.id;

    // Determine plan type from price ID (placeholders for now)
    let plan = 'free';
    if (planId === process.env.STRIPE_PRO_PRICE_ID) plan = 'pro';
    if (planId === process.env.STRIPE_TEAM_PRICE_ID) plan = 'team';

    await Organization.findByIdAndUpdate(organizationId, {
        plan,
        stripeSubscriptionId: subscriptionId,
        subscriptionStatus: 'active'
    });

    await Subscription.findOneAndUpdate(
        { organization: organizationId },
        {
            plan,
            stripeSubscriptionId: subscriptionId,
            stripePriceId: planId,
            status: 'active',
            currentPeriodEnd: new Date(subscription.current_period_end * 1000),
            cancelAtPeriodEnd: subscription.cancel_at_period_end
        },
        { upsate: true, new: true }
    );
};

const handleSubscriptionUpdated = async (subscriptionId) => {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const organization = await Organization.findOne({ stripeSubscriptionId: subscriptionId });

    if (!organization) return;

    await Organization.findByIdAndUpdate(organization._id, {
        subscriptionStatus: subscription.status
    });

    await Subscription.findOneAndUpdate(
        { stripeSubscriptionId: subscriptionId },
        {
            status: subscription.status,
            currentPeriodEnd: new Date(subscription.current_period_end * 1000),
            cancelAtPeriodEnd: subscription.cancel_at_period_end
        }
    );
};

const handleSubscriptionDeleted = async (subscriptionId) => {
    const organization = await Organization.findOne({ stripeSubscriptionId: subscriptionId });
    if (organization) {
        await Organization.findByIdAndUpdate(organization._id, {
            plan: 'free',
            subscriptionStatus: 'canceled'
        });
    }

    await Subscription.findOneAndUpdate(
        { stripeSubscriptionId: subscriptionId },
        { status: 'canceled' }
    );
};

module.exports = { handleWebhook };
