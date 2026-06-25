/**
 * webhook.service.js
 * -------------------
 * Centralized fire-and-forget outgoing webhook emitter for n8n integration.
 * Reads per-event webhook URLs from .env and posts event payloads silently.
 * Failures are logged but never bubble up to the caller.
 */

const axios = require('axios');

// Tracks the last webhook emit result — exposed via GET /api/debug/n8n
const lastEmit = {
    event: null,
    timestamp: null,
    status: 'never',  // 'success' | 'failed' | 'never'
    error: null,
};

// Map event → env variable → n8n webhook URL
const EVENT_URL_MAP = {
    // Issue events
    'issue.created': process.env.N8N_ISSUE_WEBHOOK,
    'issue.updated': process.env.N8N_ISSUE_WEBHOOK,
    'issue.deleted': process.env.N8N_ISSUE_WEBHOOK,

    // Sprint events
    'sprint.started': process.env.N8N_SPRINT_WEBHOOK,
    'sprint.completed': process.env.N8N_SPRINT_WEBHOOK,
    'sprint.created': process.env.N8N_SPRINT_WEBHOOK,

    // Comment events
    'comment.added': process.env.N8N_COMMENT_WEBHOOK,

    // Invite events
    'invite.sent': process.env.N8N_INVITE_WEBHOOK,
    'invite.accepted': process.env.N8N_INVITE_WEBHOOK,

    // Billing events
    'payment.success': process.env.N8N_BILLING_WEBHOOK,

    // AI events
    'ai.issue_created': process.env.N8N_AI_WEBHOOK,
};

/**
 * Emit an event to the corresponding n8n webhook.
 * This is fire-and-forget: it never throws or delays the caller.
 *
 * @param {string} event   - Event name, e.g. 'issue.created'
 * @param {object} payload - Any data to send to n8n
 */
async function emit(event, payload = {}) {
    const webhookUrl = EVENT_URL_MAP[event];

    if (!webhookUrl) {
        // No URL configured for this event — silently skip
        return;
    }

    const body = {
        event,
        timestamp: new Date().toISOString(),
        ...payload,
    };

    try {
        await axios.post(webhookUrl, body, {
            timeout: 3000, // 3s max — never block the main API response
            headers: { 'Content-Type': 'application/json' },
        });
        console.log(`[n8n] ✓ Webhook emitted: ${event}`);
        lastEmit.event = event;
        lastEmit.timestamp = new Date().toISOString();
        lastEmit.status = 'success';
        lastEmit.error = null;
    } catch (err) {
        // Silent fail — n8n being down should never break TaskFlow
        console.warn(`[n8n] ✗ Webhook failed for "${event}": ${err.message}`);
        lastEmit.event = event;
        lastEmit.timestamp = new Date().toISOString();
        lastEmit.status = 'failed';
        lastEmit.error = err.message;
    }
}

module.exports = { emit, lastEmit };
