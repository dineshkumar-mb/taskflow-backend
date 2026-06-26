const cashfreeService = require('../services/cashfree.service');
const Organization = require('../models/Organization');
const Project = require('../models/Project');

const createCheckoutSession = async (req, res) => {
    try {
        const { planPriceId } = req.body;
        const result = await cashfreeService.createSubscription(
            req.user.organizationId,
            req.user.email,
            req.user.phone,
            req.user.name
        );
        res.json({ url: result.authLink });
    } catch (error) {
        console.error('Checkout Session Error:', error);
        res.status(500).json({ message: error.message });
    }
};

const createPortalSession = async (req, res) => {
    // Cashfree does not have a native portal session like Stripe.
    // If a user wants to manage their subscription, we usually redirect to Cashfree Subscription Management link 
    // or provide an internal UI calling Cashfree APIs.
    res.json({ url: `${process.env.CLIENT_URL}/billing?manage=true` });
};

const handleCashfreeWebhook = async (req, res) => {
    try {
        const signature = req.headers['x-webhook-signature'];
        const rawBody = JSON.stringify(req.body); // In Express, we need raw body for accurate signature. Assuming app.use(express.json()) is handled.

        if (!signature || !cashfreeService.verifyWebhookSignature(signature, rawBody)) {
            return res.status(400).send('Invalid signature');
        }

        const { event, subscription } = req.body;

        if (event === 'SUBSCRIPTION_ACTIVE') {
            const org = await Organization.findOne({ cashfreeSubscriptionId: subscription.subscriptionId });
            if (org) {
                org.plan = 'pro';
                org.subscriptionStatus = 'ACTIVE';
                await org.save();
                console.log(`Upgraded org ${org._id} to PRO based on Cashfree webhook.`);
            }
        } else if (event === 'SUBSCRIPTION_CANCELLED') {
            const org = await Organization.findOne({ cashfreeSubscriptionId: subscription.subscriptionId });
            if (org) {
                org.plan = 'free';
                org.subscriptionStatus = 'CANCELLED';
                await org.save();
                console.log(`Downgraded org ${org._id} to FREE based on Cashfree webhook.`);
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
};
