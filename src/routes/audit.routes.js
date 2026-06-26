const express = require('express');
const router = express.Router();
const { getAuditLogs } = require('../controllers/audit.controller');
const { protect, requirePermission } = require('../middleware/auth.middleware');

router.use(protect);
// Require admin level permissions or wildcard
router.use(requirePermission('*'));

router.route('/')
    .get(getAuditLogs);

module.exports = router;
