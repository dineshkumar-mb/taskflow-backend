const crypto = require('crypto');
const Issue = require('../models/Issue');
const Project = require('../models/Project');

/**
 * Verifies X-Hub-Signature-256 header using timing-safe comparison
 */
const verifyGithubSignature = (req) => {
    const secret = process.env.GITHUB_WEBHOOK_SECRET;
    if (!secret) {
        if (process.env.NODE_ENV === 'production') {
            console.error('[GitHub Webhook Security] GITHUB_WEBHOOK_SECRET is not configured in production.');
            return false;
        }
        return true;
    }

    const signature = req.headers['x-hub-signature-256'];
    if (!signature) return false;

    const rawBody = req.rawBody || Buffer.from(JSON.stringify(req.body));
    const hmac = crypto.createHmac('sha256', secret);
    const digest = 'sha256=' + hmac.update(rawBody).digest('hex');

    if (signature.length !== digest.length) return false;
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
};

const handleGithubWebhook = async (req, res) => {
    try {
        // 1. Verify HMAC Signature
        if (!verifyGithubSignature(req)) {
            console.warn('[GitHub Webhook Security] Invalid or missing X-Hub-Signature-256');
            return res.status(401).json({ message: 'Invalid webhook signature' });
        }

        const eventType = req.headers['x-github-event'];
        
        if (eventType === 'ping') {
            return res.status(200).json({ message: 'pong' });
        }

        if (eventType !== 'pull_request') {
            return res.status(200).json({ message: 'Event ignored' });
        }

        const { action, pull_request } = req.body;

        if (action === 'closed' && pull_request && pull_request.merged) {
            const title = pull_request.title || '';
            const body = pull_request.body || '';
            
            // Extract issue keys like TSK-12, WEB-45
            const issueKeyRegex = /([A-Z]+)-(\d+)/g;
            const matches = [...title.matchAll(issueKeyRegex), ...body.matchAll(issueKeyRegex)];
            
            if (matches.length === 0) {
                return res.status(200).json({ message: 'No issue keys found in PR' });
            }

            // Group by project key prefix (e.g. 'TSK' -> ['TSK-12'])
            const keysByProjectPrefix = {};
            for (const match of matches) {
                const fullKey = match[0];
                const prefix = match[1];
                if (!keysByProjectPrefix[prefix]) {
                    keysByProjectPrefix[prefix] = new Set();
                }
                keysByProjectPrefix[prefix].add(fullKey);
            }

            let totalUpdated = 0;
            const updatedKeys = [];

            for (const [prefix, keysSet] of Object.entries(keysByProjectPrefix)) {
                const keysList = Array.from(keysSet);
                
                // Lookup projects matching the key prefix
                const projectFilter = { key: prefix };
                if (req.query.org) {
                    projectFilter.organization = req.query.org;
                }

                const projects = await Project.find(projectFilter).select('_id organization');
                for (const project of projects) {
                    const result = await Issue.updateMany(
                        {
                            project: project._id,
                            organization: project.organization,
                            key: { $in: keysList }
                        },
                        { $set: { status: 'done' } }
                    );
                    totalUpdated += result.modifiedCount;
                    updatedKeys.push(...keysList);
                }
            }

            console.log(`[GitHub Webhook] Merged PR updated ${totalUpdated} issues to done (Keys: ${updatedKeys.join(', ')})`);
            return res.status(200).json({ message: `Updated ${totalUpdated} issues to done`, keys: updatedKeys });
        }

        res.status(200).json({ message: 'PR action ignored' });
    } catch (error) {
        console.error('GitHub Webhook Error:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

module.exports = {
    handleGithubWebhook,
    verifyGithubSignature
};
