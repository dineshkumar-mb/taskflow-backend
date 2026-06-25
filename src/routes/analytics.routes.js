const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth.middleware');
const { getOrgStats, getProjectAnalytics } = require('../controllers/analytics.controller');

router.get('/org', protect, getOrgStats);
router.get('/project/:projectId', protect, getProjectAnalytics);

module.exports = router;
