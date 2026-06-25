const issueSocketHandler = require('./issue.socket');
const chatSocketHandler = require('./chat.socket');
const meetingSocketHandler = require('./meeting.socket');

const socketMainHandler = (io) => {
    meetingSocketHandler(io);

    io.on('connection', (socket) => {
        console.log('User connected:', socket.id);

        // Join personal user room for notifications
        socket.on('join:user', (userId) => {
            socket.join(`user:${userId}`);
            console.log(`Socket ${socket.id} joined user:${userId}`);
        });

        // Register feature-specific handlers
        issueSocketHandler(io, socket);
        chatSocketHandler(io, socket);

        socket.on('disconnect', () => {
            console.log('User disconnected:', socket.id);
        });
    });
};

module.exports = socketMainHandler;
