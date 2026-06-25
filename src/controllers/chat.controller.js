const Conversation = require('../models/Conversation');
const Message = require('../models/Message');

// Get all conversations for the current user
const getConversations = async (req, res) => {
    try {
        const conversations = await Conversation.find({
            participants: { $in: [req.user._id] }
        })
            .populate('participants', 'name email avatar')
            .populate('lastMessage')
            .sort({ updatedAt: -1 });

        res.json(conversations);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Get or create a conversation between two users
const getOrCreateConversation = async (req, res) => {
    try {
        const { participantId } = req.body;
        const userId = req.user._id;

        if (String(userId) === String(participantId)) {
            return res.status(400).json({ message: "Cannot start conversation with yourself" });
        }

        // Find existing conversation with exact participants
        let conversation = await Conversation.findOne({
            participants: { $all: [userId, participantId], $size: 2 }
        }).populate('participants', 'name email avatar');

        if (!conversation) {
            conversation = await Conversation.create({
                participants: [userId, participantId]
            });
            conversation = await Conversation.findById(conversation._id).populate('participants', 'name email avatar');
        }

        res.json(conversation);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Get messages for a conversation
const getMessages = async (req, res) => {
    try {
        const { conversationId } = req.params;

        // Ensure user is part of the conversation
        const conversation = await Conversation.findOne({
            _id: conversationId,
            participants: { $in: [req.user._id] }
        });

        if (!conversation) {
            return res.status(403).json({ message: "Not authorized to view this conversation" });
        }

        const messages = await Message.find({ conversation: conversationId })
            .populate('sender', 'name avatar')
            .sort({ createdAt: 1 })
            .limit(100);

        res.json(messages);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Send a message
const sendMessage = async (req, res) => {
    try {
        const { conversationId, content } = req.body;
        const userId = req.user._id;

        const conversation = await Conversation.findOne({
            _id: conversationId,
            participants: { $in: [userId] }
        });

        if (!conversation) {
            return res.status(403).json({ message: "Not authorized to send messages to this conversation" });
        }

        const message = await Message.create({
            conversation: conversationId,
            sender: userId,
            content
        });

        // Update last message in conversation
        conversation.lastMessage = message._id;
        await conversation.save();

        const populatedMessage = await Message.findById(message._id).populate('sender', 'name avatar');

        // Note: Real-time emission handled by socket listener or controller if io is available
        if (req.io) {
            const recipientId = conversation.participants.find(p => String(p) !== String(userId));
            req.io.to(`user:${recipientId}`).emit('chat:message', populatedMessage);
        }

        res.status(201).json(populatedMessage);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getConversations,
    getOrCreateConversation,
    getMessages,
    sendMessage
};
