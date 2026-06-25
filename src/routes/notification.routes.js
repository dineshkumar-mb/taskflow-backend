const express = require('express');
const router = express.Router();
const { getNotifications, markAsRead, markAllAsRead } = require('../controllers/notification.controller');
const { protect } = require('../middleware/auth.middleware');

router.use(protect);

router.route('/')
    .get(getNotifications);

router.route('/read-all')
    .put(markAllAsRead);

router.route('/:id/read')
    .put(markAsRead);

module.exports = router;
