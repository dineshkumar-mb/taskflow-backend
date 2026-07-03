const axios = require('axios');
const crypto = require('crypto');
const Organization = require('../models/Organization');

const CASHFREE_BASE_URL = process.env.NODE_ENV === 'production' 
    ? 'https://api.cashfree.com/pg' 
    : 'https://sandbox.cashfree.com/pg';

const appId = process.env.CASHFREE_APP_ID || 'TEST_APP_ID';
const secretKey = process.env.CASHFREE_SECRET_KEY || 'TEST_SECRET_KEY';

const getHeaders = () => ({
    'x-client-id': appId,
    'x-client-secret': secretKey,
    'x-api-version': '2025-01-01',
    'Content-Type': 'application/json'
});

const ensurePlanExists = async (planId, planName, amount) => {
    const planPayload = {
        plan_id: planId,
        plan_name: planName,
        plan_type: 'PERIODIC',
        plan_currency: 'INR',
        plan_max_amount: Math.round(amount * 1.5),
        plan_recurring_amount: Math.round(amount),
        plan_intervals: 1,
        plan_interval_type: 'MONTH'
    };

    try {
        await axios.post(`${CASHFREE_BASE_URL}/plans`, planPayload, { headers: getHeaders() });
    } catch (error) {
        // If it already exists, Cashfree returns an error. We can safely ignore it.
        console.log('Plan check: ', error.response?.data?.message || error.message);
    }
};

const createSubscription = async (organizationId, userEmail, userPhone, userName, plan = 'pro', couponCode = null) => {
    const organization = await Organization.findById(organizationId);
    if (!organization) throw new Error('Organization not found');

    // Base price mapping
    const planPrices = {
        pro: 199,
        team: 499
    };
    const basePrice = planPrices[plan] || 199;
    let finalPrice = basePrice;
    let appliedCoupon = null;

    if (couponCode) {
        const Coupon = require('../models/Coupon');
        const coupon = await Coupon.findOne({ code: couponCode.toUpperCase() });
        if (coupon && coupon.isValid()) {
            appliedCoupon = coupon;
            if (coupon.discountType === 'percentage') {
                finalPrice = basePrice * (1 - coupon.discountValue / 100);
            } else if (coupon.discountType === 'flat') {
                finalPrice = Math.max(0, basePrice - coupon.discountValue);
            }
            finalPrice = Math.round(finalPrice);
        }
    }

    // Generate Plan ID
    let planId;
    let planName;
    if (appliedCoupon) {
        planId = `tf_${plan}_${appliedCoupon.code.toLowerCase()}`;
        planName = `TaskFlow ${plan.charAt(0).toUpperCase() + plan.slice(1)} (${appliedCoupon.code})`;
    } else {
        planId = `taskflow_${plan}_monthly`;
        planName = `TaskFlow ${plan.charAt(0).toUpperCase() + plan.slice(1)} Monthly`;
    }

    // Ensure plan exists on Cashfree
    await ensurePlanExists(planId, planName, finalPrice);

    const subscriptionId = `sub_${organizationId}_${Date.now()}`;
    const customerPhone = userPhone || '9999999999';

    const payload = {
        subscription_id: subscriptionId,
        customer_details: {
            customer_name: userName || 'TaskFlow User',
            customer_email: userEmail,
            customer_phone: customerPhone
        },
        plan_details: {
            plan_id: planId
        },
        subscription_meta: {
            return_url: `${process.env.CLIENT_URL}/billing?success=true&sub_id=${subscriptionId}`,
            notification_channel: ["EMAIL"]
        }
    };

    try {
        const response = await axios.post(`${CASHFREE_BASE_URL}/subscriptions`, payload, { headers: getHeaders() });
        
        organization.cashfreeSubscriptionId = subscriptionId;
        organization.cashfreePlanId = planId;
        organization.plan = plan; // Pre-emptively set selection
        await organization.save();

        // Increment redemption count if coupon was used
        if (appliedCoupon) {
            appliedCoupon.redemptionsCount += 1;
            await appliedCoupon.save();
        }

        return {
            subscriptionId: response.data.subscription_id,
            subscription_session_id: response.data.subscription_session_id,
            status: response.data.subscription_status
        };
    } catch (error) {
        console.error('Cashfree Subscription Error:', error.response?.data || error.message);
        throw new Error('Failed to create Cashfree Subscription. Check plan ID or API keys.');
    }
};

const verifyWebhookSignature = (signature, rawBody) => {
    const expectedSignature = crypto.createHmac('sha256', secretKey)
        .update(rawBody)
        .digest('base64');
        
    return signature === expectedSignature;
};

module.exports = {
    createSubscription,
    verifyWebhookSignature
};
