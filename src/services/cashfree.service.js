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
        organization.pendingPlan = plan; // Set as pending until verified webhook confirms payment
        await organization.save();

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

const createOrder = async (organizationId, userEmail, userPhone, userName, plan = 'pro', couponCode = null) => {
    const organization = await Organization.findById(organizationId);
    if (!organization) throw new Error('Organization not found');

    const planPrices = {
        pro: 199,
        team: 499
    };
    const basePrice = planPrices[plan] || 199;
    let finalPrice = basePrice;

    if (couponCode) {
        const Coupon = require('../models/Coupon');
        const coupon = await Coupon.findOne({ code: couponCode.toUpperCase() });
        if (coupon && coupon.isValid()) {
            if (coupon.discountType === 'percentage') {
                finalPrice = basePrice * (1 - coupon.discountValue / 100);
            } else if (coupon.discountType === 'flat') {
                finalPrice = Math.max(0, basePrice - coupon.discountValue);
            }
            finalPrice = Math.round(finalPrice);
        }
    }

    // Ensure order_id is valid alphanumeric, under 50 chars
    const shortOrgId = organizationId.toString().slice(-8);
    const orderId = `tf_${shortOrgId}_${Date.now()}`;
    const customerPhone = userPhone || '9999999999';

    const payload = {
        order_id: orderId,
        order_amount: finalPrice,
        order_currency: 'INR',
        customer_details: {
            customer_id: String(organizationId),
            customer_email: userEmail || 'billing@taskflow.com',
            customer_phone: customerPhone,
            customer_name: userName || 'TaskFlow User'
        },
        order_meta: {
            return_url: `${process.env.CLIENT_URL || 'http://localhost:5173'}/billing?order_id={order_id}`
        },
        order_note: `TaskFlow ${plan.toUpperCase()} Plan (${organization.name})`,
        order_tags: {
            plan,
            organization_id: String(organizationId)
        }
    };

    try {
        const response = await axios.post(`${CASHFREE_BASE_URL}/orders`, payload, { headers: getHeaders() });
        organization.pendingPlan = plan;
        organization.lastOrderId = orderId;
        await organization.save();

        return {
            order_id: response.data.order_id,
            payment_session_id: response.data.payment_session_id,
            order_status: response.data.order_status
        };
    } catch (error) {
        console.error('Cashfree Create Order Error:', error.response?.data || error.message);
        throw new Error(error.response?.data?.message || 'Failed to create Cashfree payment order.');
    }
};

const getOrder = async (orderId) => {
    try {
        const response = await axios.get(`${CASHFREE_BASE_URL}/orders/${orderId}`, { headers: getHeaders() });
        return response.data;
    } catch (error) {
        console.error('Cashfree Get Order Error:', error.response?.data || error.message);
        throw new Error(error.response?.data?.message || 'Failed to fetch order status.');
    }
};

const verifyWebhookSignature = (signature, timestamp, rawBody) => {
    if (!signature || !secretKey) return false;
    try {
        const signedPayload = timestamp ? `${timestamp}${rawBody}` : rawBody;
        const expectedSignature = crypto.createHmac('sha256', secretKey)
            .update(signedPayload)
            .digest('base64');
            
        const sigBuf = Buffer.from(signature);
        const expBuf = Buffer.from(expectedSignature);
        if (sigBuf.length !== expBuf.length) return false;
        return crypto.timingSafeEqual(sigBuf, expBuf);
    } catch (e) {
        console.error('Webhook signature verification exception:', e.message);
        return false;
    }
};

module.exports = {
    createOrder,
    getOrder,
    createSubscription,
    verifyWebhookSignature
};
