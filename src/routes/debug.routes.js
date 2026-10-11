/**
 * debug.routes.js
 * ----------------
 * Provides a diagnostic endpoint for verifying the n8n automation integration.
 * GET /api/debug/n8n — Returns webhook connectivity status and last execution details.
 */

const express = require('express');
const router = express.Router();
const { lastEmit } = require('../services/webhook.service');
const { protect, authorize } = require('../middleware/auth.middleware');

const N8N_ISSUE_WEBHOOK = process.env.N8N_ISSUE_WEBHOOK;
const N8N_SPRINT_WEBHOOK = process.env.N8N_SPRINT_WEBHOOK;
const N8N_BILLING_WEBHOOK = process.env.N8N_BILLING_WEBHOOK;

/**
 * GET /api/debug/n8n
 * Diagnostic endpoint for n8n integration status.
 * Restricted to SuperAdmin and OrgOwner/Admin.
 */
router.get('/n8n', protect, authorize('SuperAdmin', 'OrgOwner', 'Admin'), (req, res) => {
    const webhookConfigured = !!(N8N_ISSUE_WEBHOOK && N8N_SPRINT_WEBHOOK);

    res.json({
        webhookConnected: webhookConfigured,
        lastWorkflowRun: lastEmit.status,         // 'success' | 'failed' | 'never'
        automationActive: webhookConfigured && lastEmit.status !== 'failed',
        lastEmit: {
            event: lastEmit.event,
            timestamp: lastEmit.timestamp,
            status: lastEmit.status,
            error: lastEmit.error ? (process.env.NODE_ENV === 'production' ? 'Execution failure' : lastEmit.error) : null,
        },
        webhooksConfigured: {
            issues: !!N8N_ISSUE_WEBHOOK,
            sprints: !!N8N_SPRINT_WEBHOOK,
            billing: !!N8N_BILLING_WEBHOOK,
        },
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
