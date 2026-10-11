const express = require('express');
const router = express.Router();
const { handleGithubWebhook } = require('../controllers/github.webhook.controller');

// GitHub webhook with raw body capture for HMAC verification
router.post(
    '/github',
    express.json({
        verify: (req, res, buf) => {
            req.rawBody = buf;
        }
    }),
    handleGithubWebhook
);

module.exports = router;
