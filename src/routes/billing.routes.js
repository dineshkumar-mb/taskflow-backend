const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth.middleware');
const { requireTenantContext } = require('../security/tenantAccess');
const { createCheckoutSession, createPortalSession, verifyOrderPayment, getUsage, handleCashfreeWebhook, validateCoupon, getActiveCoupons, confirmPaymentLink } = require('../controllers/billing.controller');

// Cashfree Webhook endpoint (must accept raw body for cryptographic signature verification)
router.post(
    '/webhook/cashfree',
    express.json({
        verify: (req, res, buf) => {
            req.rawBody = buf.toString('utf8');
        }
    }),
    handleCashfreeWebhook
);

router.use(protect);
router.use(requireTenantContext);

router.post('/checkout', authorize('SuperAdmin', 'OrgOwner', 'Admin'), createCheckoutSession);
router.get('/verify-order/:orderId', verifyOrderPayment);
router.post('/confirm-payment-link', confirmPaymentLink);
router.post('/portal', authorize('SuperAdmin', 'OrgOwner', 'Admin'), createPortalSession);
router.get('/usage', getUsage);
router.post('/validate-coupon', validateCoupon);
router.get('/active-coupons', getActiveCoupons);

module.exports = router;

