const Message = require('../models/Message');
const Conversation = require('../models/Conversation');

const chatSocketHandler = (io, socket) => {
    // Join a conversation room
    socket.on('chat:join', (conversationId) => {
        socket.join(`chat:${conversationId}`);
        console.log(`Socket ${socket.id} joined chat:${conversationId}`);
    });

    // Leave a conversation room
    socket.on('chat:leave', (conversationId) => {
        socket.leave(`chat:${conversationId}`);
        console.log(`Socket ${socket.id} left chat:${conversationId}`);
    });

    // Typing indicators
    socket.on('chat:typing', ({ conversationId, userId, userName }) => {
        socket.to(`chat:${conversationId}`).emit('chat:typing', { userId, userName });
    });

    socket.on('chat:stop_typing', ({ conversationId, userId }) => {
        socket.to(`chat:${conversationId}`).emit('chat:stop_typing', { userId });
    });
};

module.exports = chatSocketHandler;
