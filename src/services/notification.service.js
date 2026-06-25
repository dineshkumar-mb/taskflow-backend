const Notification = require('../models/Notification');
const Issue = require('../models/Issue');
const sendEmail = require('../utils/sendEmail');
const { sendSlackAssignment } = require('../utils/sendSlack');
const getUserNotifications = async (userId) => {
    return await Notification.find({ user: userId })
        .populate('initiator', 'name avatar')
        .populate('issue', 'key title')
        .sort({ createdAt: -1 })
        .limit(50);
};

const markAsRead = async (notificationId, userId) => {
    return await Notification.findOneAndUpdate(
        { _id: notificationId, user: userId },
        { read: true },
        { new: true }
    );
};

const markAllAsRead = async (userId) => {
    await Notification.updateMany(
        { user: userId, read: false },
        { read: true }
    );
};

// Internal use function to create and emit
const createNotification = async (data, io) => {
    // Avoid notifying the initiator themselves
    if (String(data.user) === String(data.initiator)) return null;

    const notification = await Notification.create(data);
    const populated = await Notification.findById(notification._id)
        .populate('initiator', 'name avatar email')
        .populate('user', 'name email')
        .populate('issue', 'key title project type priority status');

    if (io) {
        io.to(`user:${data.user}`).emit('notification:new', populated);
    }

    // Trigger Email & Slack on issue assignments via AI or manual
    if (data.type === 'assignment' && populated.issue && populated.user) {
        const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
        const issueUrl = `${clientUrl}/project/${populated.issue.project}/board`;

        // 1. Send Rich Email
        const emailHTML = `
            <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
                <h2 style="color: #4CAF50;">You've been assigned an issue in TaskFlow!</h2>
                <p>Hello <b>${populated.user.name.split(' ')[0]}</b>,</p>
                <p><b>${populated.initiator.name || 'System Copilot'}</b> has assigned you to a new task.</p>
                <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;" />
                <h3 style="margin-bottom: 5px;">${populated.issue.key}: ${populated.issue.title}</h3>
                <p style="margin: 0; color: #555;">
                    <b>Type:</b> ${populated.issue.type.toUpperCase()} <br/>
                    <b>Priority:</b> ${populated.issue.priority.toUpperCase()} <br/>
                    <b>Status:</b> ${populated.issue.status.toUpperCase()}
                </p>
                <div style="margin-top: 30px; text-align: center;">
                    <a href="${issueUrl}" style="background-color: #4CAF50; color: white; text-decoration: none; padding: 12px 24px; border-radius: 4px; font-weight: bold;">View Issue Board</a>
                </div>
                <p style="margin-top: 30px; font-size: 12px; color: #aaa; text-align: center;">Powered by TaskFlow AI Copilot</p>
            </div>
        `;

        sendEmail({
            email: populated.user.email,
            subject: `[TaskFlow] You've been assigned to ${populated.issue.key}`,
            message: 'You have a new issue assigned to you.',
            html: emailHTML,
        }).catch(err => console.error('[Email Error] Failed to send assignment email:', err.message));

        // 2. Send WhatsApp Message
        sendWhatsAppAssignment(populated.issue, populated.user, populated.initiator, clientUrl)
            .catch(err => console.error('[WhatsApp Error] Unhandled exception:', err.message));
    }

    return populated;
};

module.exports = {
    getUserNotifications,
    markAsRead,
    markAllAsRead,
    createNotification
};
