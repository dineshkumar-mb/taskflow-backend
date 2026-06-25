const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth.middleware');
const { createCheckoutSession, createPortalSession } = require('../controllers/billing.controller');

router.post('/checkout', protect, createCheckoutSession);
router.post('/portal', protect, createPortalSession);


module.exports = router;
