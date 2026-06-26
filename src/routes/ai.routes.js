const express = require('express');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });
const router = express.Router();
const {
    generateSummary,
    estimatePoints,
    createIssueFromPrompt,
    getSprintPlan,
    copilotChat,
    analyzeRisk
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
router.post('/analyze-risk', analyzeRisk);
router.post('/parse-search', require('../controllers/ai.controller').parseQuery);
router.post('/transcribe', upload.single('audio'), require('../controllers/ai.controller').transcribeAudio);

module.exports = router;
