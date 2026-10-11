const notificationService = require('../services/notification.service');

const getNotifications = async (req, res) => {
    try {
        const orgId = req.organizationId || req.user?.organizationId || req.user?.organization;
        const notifications = await notificationService.getUserNotifications(req.user._id, orgId);
        res.json(notifications);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const markAsRead = async (req, res) => {
    try {
        const orgId = req.organizationId || req.user?.organizationId || req.user?.organization;
        const notification = await notificationService.markAsRead(req.params.id, req.user._id, orgId);
        res.json(notification);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const markAllAsRead = async (req, res) => {
    try {
        const orgId = req.organizationId || req.user?.organizationId || req.user?.organization;
        await notificationService.markAllAsRead(req.user._id, orgId);
        res.json({ message: 'All notifications marked as read' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getNotifications,
    markAsRead,
    markAllAsRead
};
