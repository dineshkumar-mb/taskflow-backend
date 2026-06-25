const express = require('express');
const router = express.Router();
const { getMe, getOrgUsers, inviteMember, removeMember, searchUsers } = require('../controllers/user.controller');
const { protect, authorize } = require('../middleware/auth.middleware');

router.use(protect);

router.get('/me', getMe);
router.get('/', getOrgUsers);
router.get('/search', searchUsers);
router.post('/invite', authorize('OrgOwner', 'Admin'), inviteMember);
router.delete('/:userId', authorize('OrgOwner', 'Admin'), removeMember);

module.exports = router;
