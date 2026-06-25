const { Cashfree, CFEnvironment } = require('cashfree-pg');
const Organization = require('../models/Organization');

const cashfreeClient = new Cashfree();
cashfreeClient.XClientId = process.env.CASHFREE_APP_ID;
cashfreeClient.XClientSecret = process.env.CASHFREE_SECRET_KEY;
cashfreeClient.XEnvironment = process.env.CASHFREE_ENV === 'PRODUCTION'
    ? CFEnvironment.PRODUCTION
    : CFEnvironment.SANDBOX;

/**
 * Create a Cashfree Subscription/Payment Session
 * Note: Cashfree Subscriptions use a different flow than Stripe. 
 * For this implementation, we will use their Subscription API.
 */
const createSubscriptionSession = async (organizationId, plan) => {
    const organization = await Organization.findById(organizationId);
    if (!organization) throw new Error('Organization not found');

    // MOCK: In a real production app, you would create a Cashfree Subscription 
    // using their SDK's subscription methods. 
    // For now, we simulate the link generation.

    const amount = plan === 'pro' ? 999 : 499; // INR
    const orderId = `order_${organizationId}_${Date.now()}`;

    try {
        const request = {
            order_amount: amount,
            order_currency: "INR",
            order_id: orderId,
            customer_details: {
                customer_id: organizationId.toString(),
                customer_name: organization.name || "Customer",
                customer_email: "billing@example.com", // Should come from org owner
                customer_phone: "9999999999", // Placeholder for required field
            },
            order_meta: {
                return_url: `${process.env.CLIENT_URL}/billing?order_id={order_id}`,
                notify_url: `${process.env.BACKEND_URL || 'http://localhost:5001'}/api/billing/cashfree-webhook`,
            },
            order_note: `Subscription for ${plan} plan`,
        };

        const response = await cashfreeClient.PGCreateOrder("2023-08-01", request);
        return {
            payment_link: response.data.payment_session_id,
            order_id: response.data.order_id,
            // Cashfree usually uses a JS SDK on frontend with the session_id
            // but for simplicity, we return the data needed to initialize the SDK
            session_id: response.data.payment_session_id
        };
    } catch (error) {
        console.error('Cashfree Create Order Error:', error.response?.data || error.message);
        throw new Error('Failed to initialize Cashfree payment');
    }
};

module.exports = {
    createSubscriptionSession,
};
