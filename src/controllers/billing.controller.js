const cashfreeService = require('../services/cashfree.service');
const Organization = require('../models/Organization');
const Project = require('../models/Project');

const createCheckoutSession = async (req, res) => {
    try {
        const { plan, couponCode } = req.body;
        // Default to 'pro' if not provided for backward compatibility
        const selectedPlan = plan || 'pro';

        const result = await cashfreeService.createSubscription(
            req.user.organizationId,
            req.user.email,
            req.user.phone,
            req.user.name,
            selectedPlan,
            couponCode
        );
        res.json({ subscription_session_id: result.subscription_session_id });
    } catch (error) {
        console.error('Checkout Session Error:', error);
        res.status(500).json({ message: error.message });
    }
};

const createPortalSession = async (req, res) => {
    res.json({ url: `${process.env.CLIENT_URL}/billing?manage=true` });
};

const validateCoupon = async (req, res) => {
    try {
        const { code } = req.body;
        if (!code) {
            return res.status(400).json({ valid: false, message: 'Coupon code is required' });
        }

        const Coupon = require('../models/Coupon');
        const coupon = await Coupon.findOne({ code: code.toUpperCase() });

        if (!coupon || !coupon.isValid()) {
            return res.status(400).json({ valid: false, message: 'Invalid or expired coupon' });
        }

        res.json({
            valid: true,
            coupon: {
                code: coupon.code,
                discountType: coupon.discountType,
                discountValue: coupon.discountValue
            }
        });
    } catch (error) {
        console.error('Coupon validation error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// Returns all active, valid coupons for display on the user-facing checkout screen
const getActiveCoupons = async (req, res) => {
    try {
        const Coupon = require('../models/Coupon');
        const now = new Date();

        const coupons = await Coupon.find({
            active: true,
            $or: [
                { expiryDate: null },
                { expiryDate: { $gt: now } }
            ]
        }).select('code discountType discountValue expiryDate maxRedemptions redemptionsCount');

        // Filter out exhausted coupons
        const available = coupons.filter(c => 
            c.maxRedemptions === null || c.redemptionsCount < c.maxRedemptions
        ).map(c => ({
            code: c.code,
            discountType: c.discountType,
            discountValue: c.discountValue,
            expiryDate: c.expiryDate
        }));

        res.json(available);
    } catch (error) {
        console.error('Get active coupons error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

const handleCashfreeWebhook = async (req, res) => {
    try {
        const signature = req.headers['x-webhook-signature'];
        const rawBody = JSON.stringify(req.body);

        if (!signature || !cashfreeService.verifyWebhookSignature(signature, rawBody)) {
            return res.status(400).send('Invalid signature');
        }

        const { type, data } = req.body;

        if (type === 'SUBSCRIPTION_STATUS_CHANGED' && data?.subscription_details) {
            const status = data.subscription_details.subscription_status;
            const subId = data.subscription_details.subscription_id;

            if (status === 'ACTIVE') {
                const org = await Organization.findOne({ cashfreeSubscriptionId: subId });
                if (org) {
                    const planId = data.subscription_details.plan_details?.plan_id || '';
                    const planType = planId.includes('team') ? 'team' : 'pro';

                    org.plan = planType;
                    org.subscriptionStatus = 'ACTIVE';
                    await org.save();

                    const Subscription = require('../models/Subscription');
                    await Subscription.findOneAndUpdate(
                        { organization: org._id },
                        {
                            plan: planType,
                            status: 'ACTIVE',
                            paymentProvider: 'cashfree',
                            paymentProviderId: subId
                        },
                        { upsert: true, new: true }
                    );
                    console.log(`Upgraded org ${org._id} to ${planType.toUpperCase()} based on Cashfree webhook.`);
                }
            } else if (status === 'CANCELLED' || status === 'EXPIRED') {
                const org = await Organization.findOne({ cashfreeSubscriptionId: subId });
                if (org) {
                    org.plan = 'free';
                    org.subscriptionStatus = status;
                    await org.save();

                    const Subscription = require('../models/Subscription');
                    await Subscription.findOneAndUpdate(
                        { organization: org._id },
                        {
                            plan: 'free',
                            status: status === 'CANCELLED' ? 'CANCELLED' : 'canceled',
                            paymentProvider: 'cashfree',
                            paymentProviderId: subId
                        },
                        { upsert: true, new: true }
                    );
                    console.log(`Downgraded org ${org._id} to FREE based on Cashfree webhook.`);
                }
            }
        }

        res.status(200).send('Webhook handled successfully');
    } catch (error) {
        console.error('Webhook Error:', error);
        res.status(500).send(`Webhook Error: ${error.message}`);
    }
};

const getUsage = async (req, res) => {
    try {
        const organization = await Organization.findById(req.user.organizationId);
        const projectsCount = await Project.countDocuments({ organization: req.user.organizationId });

        const isPro = organization.plan === 'pro' || organization.plan === 'team';

        const usage = {
            plan: organization.plan,
            projects: {
                used: projectsCount,
                limit: isPro ? 'Unlimited' : 10
            },
            aiCopilot: {
                used: organization.aiUsageCount || 0,
                limit: isPro ? 'Unlimited' : 200
            },
            meetings: {
                used: 0, // Placeholder
                limit: isPro ? 'Unlimited' : 100
            }
        };

        res.json(usage);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    createCheckoutSession,
    createPortalSession,
    getUsage,
    handleCashfreeWebhook,
    validateCoupon,
    getActiveCoupons,
};

