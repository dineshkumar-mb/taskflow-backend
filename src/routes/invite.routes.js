const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth.middleware');
const { sendInvite, acceptInvite } = require('../controllers/invite.controller');

router.post('/send', protect, authorize('OrgOwner', 'Admin'), sendInvite);
router.post('/accept', protect, acceptInvite);

module.exports = router;
