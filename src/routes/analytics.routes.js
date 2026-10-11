const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth.middleware');
const { requireTenantContext } = require('../security/tenantAccess');
const { getOrgStats, getProjectAnalytics } = require('../controllers/analytics.controller');

router.use(protect);
router.use(requireTenantContext);

router.get('/org', getOrgStats);
router.get('/project/:projectId', getProjectAnalytics);

module.exports = router;
