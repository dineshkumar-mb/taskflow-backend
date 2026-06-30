const { z } = require('zod');

const createCheckoutSchema = z.object({
    planPriceId: z.string().min(1, 'Plan Price ID is required'),
});

const billingWebhookSchema = z.object({
    event: z.string(),
    subscription: z.object({
        subscriptionId: z.string(),
    }).optional(),
}).passthrough(); // allows other gateway metadata

module.exports = {
    createCheckoutSchema,
    billingWebhookSchema,
};
