const stripeKey = process.env.STRIPE_SECRET_KEY;
const isStripeConfigured = stripeKey && stripeKey !== 'sk_test_...';
const stripe = require('stripe')(isStripeConfigured ? stripeKey : 'sk_test_dummy_key');
const Organization = require('../models/Organization');

const createCheckoutSession = async (organizationId, planPriceId) => {
    if (!isStripeConfigured) {
        // Fallback for missing Stripe configuration
        return { url: `${process.env.CLIENT_URL}/billing?success=true&mock=true` };
    }

    const organization = await Organization.findById(organizationId);
    if (!organization) throw new Error('Organization not found');

    let customerId = organization.stripeCustomerId;

    if (!customerId) {
        const customer = await stripe.customers.create({
            name: organization.name,
            metadata: { organizationId: organizationId.toString() },
        });
        customerId = customer.id;
        organization.stripeCustomerId = customerId;
        await organization.save();
    }

    const session = await stripe.checkout.sessions.create({
        customer: customerId,
        line_items: [{ price: planPriceId, quantity: 1 }],
        mode: 'subscription',
        automatic_payment_methods: { enabled: true },
        success_url: `${process.env.CLIENT_URL}/billing?success=true&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.CLIENT_URL}/billing?canceled=true`,
        metadata: { organizationId: organizationId.toString() },
    });

    return session;
};

const createPortalSession = async (organizationId) => {
    if (!isStripeConfigured) {
        return { url: `${process.env.CLIENT_URL}/billing?mock_portal=true` };
    }
    const organization = await Organization.findById(organizationId);
    if (!organization) {
        throw new Error('Organization not found');
    }

    let customerId = organization.stripeCustomerId;

    if (!customerId) {
        const customer = await stripe.customers.create({
            name: organization.name,
            metadata: { organizationId: organizationId.toString() },
        });
        customerId = customer.id;
        organization.stripeCustomerId = customerId;
        await organization.save();
    }

    const session = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: `${process.env.CLIENT_URL}/billing`,
    });

    return session;
};

module.exports = {
    createCheckoutSession,
    createPortalSession,
};
