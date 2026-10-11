const express = require('express');
const router = express.Router();
const meetingController = require('../controllers/meeting.controller');
const { protect, authorize } = require('../middleware/auth.middleware');
const { requireTenantContext } = require('../security/tenantAccess');

router.use(protect);
router.use(requireTenantContext);

const activeMemberRoles = ['SuperAdmin', 'OrgOwner', 'Admin', 'Project Manager', 'Member'];

// Create (schedule) a new meeting
router.post('/', authorize(...activeMemberRoles), meetingController.createMeeting);

// Get all meetings globally for user
router.get('/', meetingController.getGlobalMeetings);

// Get meetings by project
router.get('/project/:projectId', meetingController.getMeetingsByProject);

// Get single meeting
router.get('/:meetingId', meetingController.getMeetingById);

// Update meeting (before it starts)
router.put('/:meetingId', authorize(...activeMemberRoles), meetingController.updateMeeting);

// Start meeting
router.post('/:meetingId/start', authorize(...activeMemberRoles), meetingController.startMeeting);

// End meeting
router.post('/:meetingId/end', authorize(...activeMemberRoles), meetingController.endMeeting);

// Generate MOM
router.post('/:meetingId/mom/generate', authorize(...activeMemberRoles), meetingController.generateMOM);

// Confirm and send MOM
router.post('/:meetingId/mom/confirm', authorize(...activeMemberRoles), meetingController.confirmAndSendMOM);

// Get transcript
router.get('/:meetingId/transcript', meetingController.getTranscript);

module.exports = router;
