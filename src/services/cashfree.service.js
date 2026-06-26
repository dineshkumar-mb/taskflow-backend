const axios = require('axios');
const crypto = require('crypto');
const Organization = require('../models/Organization');

const CASHFREE_API_URL = process.env.NODE_ENV === 'production' 
    ? 'https://api.cashfree.com/pg/subscriptions' 
    : 'https://sandbox.cashfree.com/pg/subscriptions';

const appId = process.env.CASHFREE_APP_ID || 'TEST_APP_ID';
const secretKey = process.env.CASHFREE_SECRET_KEY || 'TEST_SECRET_KEY';

const getHeaders = () => ({
    'x-client-id': appId,
    'x-client-secret': secretKey,
    'Content-Type': 'application/json'
});

const createSubscription = async (organizationId, userEmail, userPhone, userName) => {
    const organization = await Organization.findById(organizationId);
    if (!organization) throw new Error('Organization not found');

    const subscriptionId = `sub_${organizationId}_${Date.now()}`;
    const planId = process.env.CASHFREE_PLAN_ID || 'taskflow_pro_monthly';

    // Provide a dummy phone if not available since Cashfree requires it
    const customerPhone = userPhone || '9999999999';

    const payload = {
        subscriptionId: subscriptionId,
        planId: planId,
        customerName: userName || 'TaskFlow User',
        customerEmail: userEmail,
        customerPhone: customerPhone,
        returnUrl: `${process.env.CLIENT_URL}/billing?success=true&sub_id=${subscriptionId}`
    };

    try {
        const response = await axios.post(CASHFREE_API_URL, payload, { headers: getHeaders() });
        
        organization.cashfreeSubscriptionId = subscriptionId;
        organization.cashfreePlanId = planId;
        await organization.save();

        return {
            subscriptionId: response.data.subscription.subscriptionId,
            authLink: response.data.subscription.authLink,
            status: response.data.subscription.status
        };
    } catch (error) {
        console.error('Cashfree Subscription Error:', error.response?.data || error.message);
        throw new Error('Failed to create Cashfree Subscription. Check plan ID or API keys.');
    }
};

const verifyWebhookSignature = (signature, rawBody) => {
    // Cashfree sends signature in x-webhook-signature header
    const expectedSignature = crypto.createHmac('sha256', secretKey)
        .update(rawBody)
        .digest('base64');
        
    return signature === expectedSignature;
};

module.exports = {
    createSubscription,
    verifyWebhookSignature
};
