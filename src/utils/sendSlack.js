const fetch = require('node-fetch'); // Ensure node-fetch is available, or use global fetch in Node 18+

/**
 * Sends a rich message to a Slack channel using an Incoming Webhook and Block Kit.
 * @param {Object} issue - The issue object containing details.
 * @param {Object} assignee - The user assigned to the issue.
 * @param {Object} reporter - The user who created or assigned the issue.
 * @param {String} clientUrl - The base URL of the frontend to generate a clickable link.
 */
const sendSlackAssignment = async (issue, assignee, reporter, clientUrl) => {
    const webhookUrl = process.env.SLACK_WEBHOOK_URL;

    // Construct the absolute link to the issue board
    const issueLink = `${clientUrl}/project/${issue.project}/board`;

    // Define priority emojis
    const priorityEmojis = {
        critical: '🔴',
        high: '🟠',
        medium: '🟡',
        low: '🟢'
    };
    const priorityEmoji = priorityEmojis[issue.priority] || '⚪';
    const typeIcon = issue.type === 'bug' ? '🐛' : issue.type === 'story' ? '📘' : '📋';

    // Build the Block Kit message payload
    const payload = {
        blocks: [
            {
                type: 'header',
                text: {
                    type: 'plain_text',
                    text: `🆕 New Issue Assigned: ${issue.key}`,
                    emoji: true
                }
            },
            {
                type: 'section',
                text: {
                    type: 'mrkdwn',
                    text: `*Hi ${assignee.name || 'Team'},*\nYou have been assigned a new issue by *${reporter.name || 'the system'}*.`
                }
            },
            {
                type: 'divider'
            },
            {
                type: 'section',
                fields: [
                    {
                        type: 'mrkdwn',
                        text: `*Title:*\n${issue.title}`
                    },
                    {
                        type: 'mrkdwn',
                        text: `*Type:*\n${typeIcon} ${issue.type.toUpperCase()}`
                    },
                    {
                        type: 'mrkdwn',
                        text: `*Priority:*\n${priorityEmoji} ${issue.priority.toUpperCase()}`
                    },
                    {
                        type: 'mrkdwn',
                        text: `*Status:*\n${issue.status.toUpperCase()}`
                    }
                ]
            },
            {
                type: 'actions',
                elements: [
                    {
                        type: 'button',
                        text: {
                            type: 'plain_text',
                            text: 'View Issue in TaskFlow',
                            emoji: true
                        },
                        value: 'view_issue',
                        url: issueLink,
                        action_id: 'button-action'
                    }
                ]
            }
        ]
    };

    if (!webhookUrl) {
        console.log('\n[Slack Integration] Missing SLACK_WEBHOOK_URL. Would have sent:');
        console.log(JSON.stringify(payload, null, 2));
        return false;
    }

    try {
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            console.error(`[Slack Error] Failed to send message: ${response.statusText}`);
            return false;
        }

        console.log(`[Slack] Successfully sent assignment notification for ${issue.key}`);
        return true;
    } catch (error) {
        console.error('[Slack Error] Exception while sending message:', error.message);
        return false;
    }
};

module.exports = {
    sendSlackAssignment
};
