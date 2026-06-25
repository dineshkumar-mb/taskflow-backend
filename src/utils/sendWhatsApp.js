const twilio = require('twilio');

/**
 * Sends a rich message to a WhatsApp number using the Twilio API.
 * @param {Object} issue - The issue object containing details.
 * @param {Object} assignee - The user assigned to the issue.
 * @param {Object} reporter - The user who created or assigned the issue.
 * @param {String} clientUrl - The base URL of the frontend to generate a clickable link.
 */
const sendWhatsAppAssignment = async (issue, assignee, reporter, clientUrl) => {
    // We expect the user to have a phone number in DB, but for testing, we can fall back to an ENV variable
    const toPhoneNumber = assignee.phone || process.env.TEST_WHATSAPP_NUMBER || '+1234567890';

    // Validate Twilio config
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromPhoneNumber = process.env.TWILIO_WHATSAPP_NUMBER; // Usually 'whatsapp:+14155238886' for sandbox

    // Construct the absolute link to the issue board
    const issueLink = `${clientUrl}/project/${issue.project}/board`;

    // Format the WhatsApp message using Markdown-like syntax
    // WhatsApp supports: *bold*, _italics_, ~strikethrough~, and `code`
    const priorityEmoji = issue.priority === 'critical' ? '🔴' : issue.priority === 'high' ? '🟠' : issue.priority === 'medium' ? '🟡' : '🟢';
    const typeIcon = issue.type === 'bug' ? '🐛' : issue.type === 'story' ? '📘' : '📋';

    const messageBody =
        `🆕 *New Issue Assigned: ${issue.key}*\n\n` +
        `Hi *${assignee.name.split(' ')[0]}*,\n` +
        `You have been assigned a new issue by *${reporter.name || 'AI Copilot'}*.\n\n` +
        `*Title:* ${issue.title}\n` +
        `*Type:* ${typeIcon} ${issue.type.toUpperCase()}\n` +
        `*Priority:* ${priorityEmoji} ${issue.priority.toUpperCase()}\n` +
        `*Status:* ${issue.status.toUpperCase()}\n\n` +
        `🔗 *View Issue:*\n${issueLink}`;

    if (!accountSid || !authToken || !fromPhoneNumber) {
        console.log('\\n[WhatsApp Integration] Missing Twilio credentials. Would have sent this to "whatsapp:' + toPhoneNumber + '":');
        console.log('--------------------------------------------------');
        console.log(messageBody);
        console.log('--------------------------------------------------');
        return false;
    }

    try {
        const client = twilio(accountSid, authToken);
        const message = await client.messages.create({
            body: messageBody,
            from: fromPhoneNumber, // Must be formatted as 'whatsapp:+1...'
            to: `whatsapp:${toPhoneNumber}`
        });

        console.log(`[WhatsApp] Successfully sent assignment notification for ${issue.key} (SID: ${message.sid})`);
        return true;
    } catch (error) {
        console.error('[WhatsApp Error] Exception while sending message:', error.message);
        return false;
    }
};

module.exports = {
    sendWhatsAppAssignment
};
