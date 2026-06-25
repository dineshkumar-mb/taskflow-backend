/**
 * debug.routes.js
 * ----------------
 * Provides a diagnostic endpoint for verifying the n8n automation integration.
 * GET /api/debug/n8n — Returns webhook connectivity status and last execution details.
 */

const express = require('express');
const router = express.Router();
const { lastEmit } = require('../services/webhook.service');

const N8N_ISSUE_WEBHOOK = process.env.N8N_ISSUE_WEBHOOK;
const N8N_SPRINT_WEBHOOK = process.env.N8N_SPRINT_WEBHOOK;
const N8N_BILLING_WEBHOOK = process.env.N8N_BILLING_WEBHOOK;

/**
 * GET /api/debug/n8n
 * Returns the current state of the n8n integration.
 * Public endpoint (no auth required for monitoring tools).
 */
router.get('/n8n', (req, res) => {
    const webhookConfigured = !!(N8N_ISSUE_WEBHOOK && N8N_SPRINT_WEBHOOK);

    res.json({
        webhookConnected: webhookConfigured,
        lastWorkflowRun: lastEmit.status,         // 'success' | 'failed' | 'never'
        automationActive: webhookConfigured && lastEmit.status !== 'failed',
        lastEmit: {
            event: lastEmit.event,
            timestamp: lastEmit.timestamp,
            status: lastEmit.status,
            error: lastEmit.error,
        },
        webhookUrls: {
            issues: N8N_ISSUE_WEBHOOK || 'NOT CONFIGURED',
            sprints: N8N_SPRINT_WEBHOOK || 'NOT CONFIGURED',
            billing: N8N_BILLING_WEBHOOK || 'NOT CONFIGURED',
        },
        environment: process.env.NODE_ENV || 'development',
        timestamp: new Date().toISOString(),
    });
});

/**
 * GET /api/debug/health
 * Basic liveness probe for the backend API.
 */
router.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'TaskFlow Backend',
        timestamp: new Date().toISOString(),
        uptime: Math.floor(process.uptime()),
    });
});

module.exports = router;
