const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth.middleware');
const { createCheckoutSession, createPortalSession, getUsage, handleCashfreeWebhook } = require('../controllers/billing.controller');

router.post('/checkout', protect, createCheckoutSession);
router.post('/portal', protect, createPortalSession);
router.get('/usage', protect, getUsage);

router.post('/webhook/cashfree', handleCashfreeWebhook);
module.exports = router;
