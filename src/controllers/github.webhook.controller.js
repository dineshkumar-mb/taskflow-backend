const Issue = require('../models/Issue');

const handleGithubWebhook = async (req, res) => {
    try {
        const eventType = req.headers['x-github-event'];
        
        if (eventType === 'ping') {
            return res.status(200).json({ message: 'pong' });
        }

        if (eventType !== 'pull_request') {
            return res.status(200).json({ message: 'Event ignored' });
        }

        const { action, pull_request } = req.body;

        if (action === 'closed' && pull_request.merged) {
            const title = pull_request.title || '';
            const body = pull_request.body || '';
            
            // Extract issue keys like TSK-12, WEB-45
            const issueKeyRegex = /[A-Z]+-\d+/g;
            const keysInTitle = title.match(issueKeyRegex) || [];
            const keysInBody = body.match(issueKeyRegex) || [];
            
            const uniqueKeys = [...new Set([...keysInTitle, ...keysInBody])];

            if (uniqueKeys.length === 0) {
                return res.status(200).json({ message: 'No issue keys found in PR' });
            }

            // Update issues to 'done'
            const updatedIssues = await Issue.updateMany(
                { key: { $in: uniqueKeys } },
                { $set: { status: 'done' } }
            );

            console.log(`GitHub Webhook: Merged PR updated ${updatedIssues.modifiedCount} issues to done (Keys: ${uniqueKeys.join(', ')})`);
            return res.status(200).json({ message: `Updated ${updatedIssues.modifiedCount} issues to done`, keys: uniqueKeys });
        }

        res.status(200).json({ message: 'PR action ignored' });
    } catch (error) {
        console.error('GitHub Webhook Error:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

module.exports = {
    handleGithubWebhook
};
