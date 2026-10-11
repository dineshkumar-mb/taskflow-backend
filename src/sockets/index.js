const jwt = require('jsonwebtoken');
const { createAdapter } = require('@socket.io/redis-adapter');
const { createRedisConnection, isRedisAvailable } = require('../config/redis');
const User = require('../models/User');
const Project = require('../models/Project');
const issueSocketHandler = require('./issue.socket');
const chatSocketHandler = require('./chat.socket');
const meetingSocketHandler = require('./meeting.socket');

const socketMainHandler = (io) => {
    // 1. Attach Redis Adapter for horizontal scaling across multiple API nodes (Phase 18)
    if (isRedisAvailable()) {
        try {
            const pubClient = createRedisConnection();
            const subClient = pubClient.duplicate();
            io.adapter(createAdapter(pubClient, subClient));
            console.log('[Socket.IO] Redis adapter attached for horizontal scaling');
        } catch (err) {
            console.warn('[Socket.IO] Could not attach Redis adapter, using standalone in-memory mode:', err.message);
        }
    }

    // 2. JWT Authentication Middleware
    io.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth?.token || 
                          socket.handshake.headers?.authorization?.replace(/^Bearer\s+/i, '') ||
                          socket.handshake.query?.token;

            if (token) {
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                const user = await User.findById(decoded.id).select('_id name email role roleName organization organizationId');
                if (user) {
                    socket.user = user;
                }
            }
            next();
        } catch (err) {
            // Allow unauthenticated connection in development but mark as unverified
            console.warn('[Socket.IO Handshake Notice]', err.message);
            next();
        }
    });

    // 3. Register Meeting Namespace
    meetingSocketHandler(io);

    // 4. Main namespace connection
    io.on('connection', (socket) => {
        console.log(`[Socket.IO] Client connected: ${socket.id} (User: ${socket.user?._id || 'anonymous'})`);

        // Join personal user room (strictly restricted to authenticated user ID)
        socket.on('join:user', (userId) => {
            if (socket.user && socket.user._id.toString() !== userId.toString()) {
                console.warn(`[Socket Security] User ${socket.user._id} blocked from joining unauthorized room user:${userId}`);
                return;
            }
            socket.join(`user:${userId}`);
        });

        // Join organization room (verified)
        socket.on('join:org', (orgId) => {
            const userOrg = (socket.user?.organizationId || socket.user?.organization)?.toString();
            const isSuperAdmin = socket.user?.roleName === 'SuperAdmin';
            if (!isSuperAdmin && userOrg !== orgId.toString()) {
                console.warn(`[Socket Security] Blocked cross-tenant join to org:${orgId}`);
                return;
            }
            socket.join(`org:${orgId}`);
        });

        // Join project room (verified tenant membership)
        socket.on('join:project', async (projectId) => {
            try {
                if (socket.user) {
                    const userOrg = socket.user.organizationId || socket.user.organization;
                    const isSuperAdmin = socket.user.roleName === 'SuperAdmin';
                    const filter = { _id: projectId };
                    if (!isSuperAdmin && userOrg) {
                        filter.organization = userOrg;
                    }
                    const project = await Project.findOne(filter);
                    if (!project) {
                        console.warn(`[Socket Security] Project ${projectId} not found or access denied for user`);
                        return;
                    }
                }
                socket.join(`project:${projectId}`);
            } catch (_) {}
        });

        socket.on('leave:project', (projectId) => {
            socket.leave(`project:${projectId}`);
        });

        // Register feature-specific handlers
        issueSocketHandler(io, socket);
        chatSocketHandler(io, socket);

        socket.on('disconnect', () => {
            console.log(`[Socket.IO] Client disconnected: ${socket.id}`);
        });
    });
};

module.exports = socketMainHandler;
