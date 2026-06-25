const express = require('express');
const router = express.Router();
const {
    generateSummary,
    estimatePoints,
    createIssueFromPrompt,
    getSprintPlan,
    copilotChat
} = require('../controllers/ai.controller');
const { protect } = require('../middleware/auth.middleware');
const checkAiUsageLimit = require('../middleware/aiUsage.middleware');

router.use(protect);
router.use(checkAiUsageLimit);

router.post('/summary', generateSummary);
router.post('/estimate', estimatePoints);
router.post('/create-issue', createIssueFromPrompt);
router.post('/sprint-plan', getSprintPlan);
router.post('/copilot', copilotChat);

module.exports = router;
