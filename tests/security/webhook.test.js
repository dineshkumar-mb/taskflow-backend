const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { verifyGithubSignature } = require('../../src/controllers/github.webhook.controller');
const { verifyWebhookSignature } = require('../../src/services/cashfree.service');

test('Webhook Cryptographic Signature Verification Suite', async (t) => {
    const originalEnv = { ...process.env };

    t.after(() => {
        process.env = originalEnv;
    });

    await t.test('GitHub: validates correct HMAC SHA-256 signature', () => {
        const secret = 'gh_test_secret_12345';
        process.env.GITHUB_WEBHOOK_SECRET = secret;
        process.env.NODE_ENV = 'production';

        const payload = JSON.stringify({ action: 'ping' });
        const hmac = crypto.createHmac('sha256', secret);
        const validSignature = 'sha256=' + hmac.update(Buffer.from(payload)).digest('hex');

        const req = {
            headers: { 'x-hub-signature-256': validSignature },
            rawBody: Buffer.from(payload),
            body: { action: 'ping' }
        };

        const result = verifyGithubSignature(req);
        assert.equal(result, true);
    });

    await t.test('GitHub: rejects invalid or tampered signature', () => {
        const secret = 'gh_test_secret_12345';
        process.env.GITHUB_WEBHOOK_SECRET = secret;
        process.env.NODE_ENV = 'production';

        const payload = JSON.stringify({ action: 'ping' });
        const invalidSignature = 'sha256=abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';

        const req = {
            headers: { 'x-hub-signature-256': invalidSignature },
            rawBody: Buffer.from(payload),
            body: { action: 'ping' }
        };

        const result = verifyGithubSignature(req);
        assert.equal(result, false);
    });

    await t.test('GitHub: rejects missing signature header in production', () => {
        process.env.GITHUB_WEBHOOK_SECRET = 'gh_test_secret_12345';
        process.env.NODE_ENV = 'production';

        const req = {
            headers: {},
            rawBody: Buffer.from('{}'),
            body: {}
        };

        const result = verifyGithubSignature(req);
        assert.equal(result, false);
    });

    await t.test('Cashfree: rejects missing signature or secret', () => {
        const result = verifyWebhookSignature(null, '1710000000', '{"data":{}}');
        assert.equal(result, false);
    });
});
