const express = require('express');
const router = express.Router();
const { createIssue, getIssues, getIssueById, updateIssue, deleteIssue, getIssueActivities, githubWebhook, uploadAttachments, addLink, removeLink, reorderIssues, assignIssue } = require('../controllers/issue.controller');
const { protect, authorize } = require('../middleware/auth.middleware');
const upload = require('../middleware/upload.middleware');

// Public webhook route (In reality, verify GitHub signature instead of JWT)
router.post('/webhook/github', githubWebhook);

// n8n callback route (authenticated via x-n8n-secret header, not JWT)
router.put('/:id/assign', assignIssue);

router.use(protect);

router.route('/')
    .get(getIssues)
    .post(createIssue);

router.route('/:id')
    .get(getIssueById)
    .put(updateIssue)
    .delete(authorize('OrgOwner', 'Admin', 'Project Manager'), deleteIssue);

router.get('/:id/activities', getIssueActivities);

// Attachment upload
router.post('/:id/attachments', upload.array('files', 10), uploadAttachments);

// Linking
router.post('/reorder', reorderIssues);
router.post('/:id/links', addLink);
router.delete('/:id/links/:linkId', removeLink);

module.exports = router;
