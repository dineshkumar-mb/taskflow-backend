const cashfreeService = require('../services/cashfree.service');
const Organization = require('../models/Organization');
const webhookService = require('../services/webhook.service');


const createCheckoutSession = async (req, res) => {
    try {
        const { plan } = req.body;
        if (!plan) return res.status(400).json({ message: 'Plan is required' });

        const session = await cashfreeService.createSubscriptionSession(req.user.organizationId, plan);
        res.json({
            sessionId: session.session_id,
            orderId: session.order_id
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const createPortalSession = async (req, res) => {
    try {
        res.json({ url: process.env.CLIENT_URL + '/billing?status=check' });
    } catch (error) {
        console.error('Portal Session Error:', error);
        res.status(500).json({ message: error.message });
    }
};

const handleCashfreeWebhook = async (req, res) => {
    try {
        const { order_id, order_status, order_amount } = req.body.data.order;

        if (order_status === 'PAID') {
            // Extract organization ID from order_id (using the format: order_{orgId}_{timestamp})
            const orgId = order_id.split('_')[1];
            const plan = order_amount > 500 ? 'pro' : 'team';
            await Organization.findByIdAndUpdate(orgId, {
                plan,
                subscriptionStatus: 'active'
            });
            console.log(`Cashfree Payment Success: ${orgId}`);
            // n8n: fire-and-forget
            webhookService.emit('payment.success', {
                payment: { orderId: order_id, amount: order_amount, status: order_status },
                organization: { id: orgId, plan },
            });
        }

        res.status(200).send('Webhook Received');
    } catch (error) {
        console.error('Cashfree Webhook Error:', error);
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    createCheckoutSession,
    createPortalSession,
    handleCashfreeWebhook,
};
