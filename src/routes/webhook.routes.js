const express = require('express');
const router = express.Router();
const { handleGithubWebhook } = require('../controllers/github.webhook.controller');

// GitHub sends its own signature, so no JWT protection here
router.post('/github', express.json(), handleGithubWebhook);

module.exports = router;
