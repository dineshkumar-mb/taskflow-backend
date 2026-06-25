const stripeService = require('../services/stripe.service');
const Organization = require('../models/Organization');

const createCheckoutSession = async (req, res) => {
    try {
        const { planPriceId } = req.body;
        // if (!planPriceId) return res.status(400).json({ message: 'planPriceId is required' });

        // Currently defaulting or picking from request if provided
        const session = await stripeService.createCheckoutSession(
            req.user.organizationId, 
            planPriceId || process.env.STRIPE_PRO_PRICE_ID
        );
        res.json({ url: session.url });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const createPortalSession = async (req, res) => {
    try {
        const session = await stripeService.createPortalSession(req.user.organizationId);
        res.json({ url: session.url });
    } catch (error) {
        console.error('Portal Session Error:', error);
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    createCheckoutSession,
    createPortalSession,
};
