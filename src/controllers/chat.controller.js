const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const User = require('../models/User');

// Get all conversations for the current user within their active organization
const getConversations = async (req, res) => {
    try {
        const organizationId = req.organizationId || req.user.organizationId || req.user.organization;
        const conversations = await Conversation.find({
            organization: organizationId,
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

// Get or create a conversation between two users in the same organization
const getOrCreateConversation = async (req, res) => {
    try {
        const { participantId } = req.body;
        const userId = req.user._id;
        const organizationId = req.organizationId || req.user.organizationId || req.user.organization;

        if (String(userId) === String(participantId)) {
            return res.status(400).json({ message: "Cannot start conversation with yourself" });
        }

        // Verify participant belongs to the same organization
        const partner = await User.findOne({
            _id: participantId,
            $or: [{ organizationId }, { organization: organizationId }]
        });

        if (!partner) {
            return res.status(404).json({ message: "User not found in your organization" });
        }

        // Find existing conversation with exact participants in this organization
        let conversation = await Conversation.findOne({
            organization: organizationId,
            participants: { $all: [userId, participantId], $size: 2 }
        }).populate('participants', 'name email avatar');

        if (!conversation) {
            conversation = await Conversation.create({
                organization: organizationId,
                participants: [userId, participantId],
                createdBy: userId
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
        const organizationId = req.organizationId || req.user.organizationId || req.user.organization;

        // Ensure conversation belongs to organization and user is a participant
        const conversation = await Conversation.findOne({
            _id: conversationId,
            organization: organizationId,
            participants: { $in: [req.user._id] }
        });

        if (!conversation) {
            return res.status(403).json({ message: "Not authorized to view this conversation" });
        }

        const messages = await Message.find({
            conversation: conversationId,
            organization: organizationId
        })
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
        const organizationId = req.organizationId || req.user.organizationId || req.user.organization;

        const conversation = await Conversation.findOne({
            _id: conversationId,
            organization: organizationId,
            participants: { $in: [userId] }
        });

        if (!conversation) {
            return res.status(403).json({ message: "Not authorized to send messages to this conversation" });
        }

        const message = await Message.create({
            conversation: conversationId,
            organization: organizationId,
            sender: userId,
            content,
            createdBy: userId
        });

        // Update last message in conversation
        conversation.lastMessage = message._id;
        await conversation.save();

        const populatedMessage = await Message.findById(message._id).populate('sender', 'name avatar');

        // Real-time emission to recipient
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
