const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth.middleware');
const { requireTenantContext } = require('../security/tenantAccess');
const { sendInvite, acceptInvite } = require('../controllers/invite.controller');

router.post('/send', protect, requireTenantContext, authorize('SuperAdmin', 'OrgOwner', 'Admin'), sendInvite);
router.post('/accept', protect, acceptInvite);

module.exports = router;
