const express = require('express');
const router = express.Router();
const meetingController = require('../controllers/meeting.controller');
const { protect } = require('../middleware/auth.middleware');

// Create (schedule) a new meeting
router.post('/', protect, meetingController.createMeeting);

// Get all meetings globally for user
router.get('/', protect, meetingController.getGlobalMeetings);

// Get meetings by project
router.get('/project/:projectId', protect, meetingController.getMeetingsByProject);

// Get single meeting
router.get('/:meetingId', protect, meetingController.getMeetingById);

// Update meeting (before it starts)
router.put('/:meetingId', protect, meetingController.updateMeeting);

// Start meeting
router.post('/:meetingId/start', protect, meetingController.startMeeting);

// End meeting
router.post('/:meetingId/end', protect, meetingController.endMeeting);

// Generate MOM
router.post('/:meetingId/mom/generate', protect, meetingController.generateMOM);

// Confirm and send MOM
router.post('/:meetingId/mom/confirm', protect, meetingController.confirmAndSendMOM);

// Get transcript
router.get('/:meetingId/transcript', protect, meetingController.getTranscript);

module.exports = router;
