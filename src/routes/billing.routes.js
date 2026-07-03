const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth.middleware');
const { createCheckoutSession, createPortalSession, getUsage, handleCashfreeWebhook, validateCoupon, getActiveCoupons } = require('../controllers/billing.controller');

router.post('/checkout', protect, createCheckoutSession);
router.post('/portal', protect, createPortalSession);
router.get('/usage', protect, getUsage);
router.post('/validate-coupon', protect, validateCoupon);
router.get('/active-coupons', protect, getActiveCoupons);

router.post('/webhook/cashfree', handleCashfreeWebhook);
module.exports = router;

