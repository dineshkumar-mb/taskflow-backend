const express = require('express');
const router = express.Router();
const { getAuditLogs } = require('../controllers/audit.controller');
const { protect, authorize } = require('../middleware/auth.middleware');
const { requireTenantContext } = require('../security/tenantAccess');

router.use(protect);
router.use(requireTenantContext);
router.use(authorize('SuperAdmin', 'OrgOwner', 'Admin'));

router.route('/')
    .get(getAuditLogs);

module.exports = router;
