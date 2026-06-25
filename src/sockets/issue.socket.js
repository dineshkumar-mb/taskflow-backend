const issueSocketHandler = (io, socket) => {
    socket.on('join:project', (projectId) => {
        socket.join(`project:${projectId}`);
        console.log(`Socket ${socket.id} joined project:${projectId}`);
    });

    socket.on('leave:project', (projectId) => {
        socket.leave(`project:${projectId}`);
        console.log(`Socket ${socket.id} left project:${projectId}`);
    });

    socket.on('issue:moved', ({ issueId, status, projectId }) => {
        // Broadcast to all OTHER clients in the project room
        socket.to(`project:${projectId}`).emit('issue:updated', { _id: issueId, status });
    });
};

module.exports = issueSocketHandler;
