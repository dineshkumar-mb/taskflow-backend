const Meeting = require('../models/Meeting');

module.exports = (io) => {
  const meetingNamespace = io.of('/meeting-room');

  meetingNamespace.on('connection', (socket) => {
    console.log(`User connected to meeting room: ${socket.id}`);

    // Join a specific meeting room
    socket.on('join-meeting', async (data) => {
      const { meetingId, userId, userName } = data;
      socket.join(meetingId);

      // Broadcast user joined
      meetingNamespace.to(meetingId).emit('user-joined', {
        userId,
        userName,
        socketId: socket.id,
        timestamp: new Date()
      });

      // Update meeting attendees
      try {
        const meeting = await Meeting.findById(meetingId);
        if (meeting && !meeting.attendedIds.includes(userId)) {
          meeting.attendedIds.push(userId);
          await meeting.save();
        }
      } catch (error) {
        console.error('Error updating attendees:', error);
      }
    });

    // Handle transcript segment
    socket.on('transcript-segment', (data) => {
      const { meetingId, userId, userName, text, timestamp } = data;

      // Broadcast to all users in the meeting room
      meetingNamespace.to(meetingId).emit('new-transcript', {
        userId,
        userName,
        text,
        timestamp
      });
    });

    // User leaves meeting
    socket.on('leave-meeting', (data) => {
      const { meetingId, userId } = data;
      socket.leave(meetingId);

      meetingNamespace.to(meetingId).emit('user-left', {
        userId,
        timestamp: new Date()
      });
    });

    socket.on('disconnect', () => {
      console.log(`User disconnected from meeting room: ${socket.id}`);
    });
  });
};
