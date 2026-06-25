const express = require('express');
const router = express.Router();
const {
    getConversations,
    getOrCreateConversation,
    getMessages,
    sendMessage
} = require('../controllers/chat.controller');
const { protect } = require('../middleware/auth.middleware');

router.use(protect);

router.get('/conversations', getConversations);
router.post('/conversations', getOrCreateConversation);
router.get('/messages/:conversationId', getMessages);
router.post('/messages', sendMessage);

module.exports = router;
