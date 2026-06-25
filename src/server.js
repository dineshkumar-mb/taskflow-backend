require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const path = require('path');
const { createServer } = require('http');
const { Server } = require('socket.io');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const connectDB = require('./config/db');
const socketMainHandler = require('./sockets');

const app = express();
const httpServer = createServer(app);
const allowedOrigins = [
    process.env.CLIENT_URL,
    'http://localhost:5173',
    'http://localhost:5174'
].filter(Boolean);

const io = new Server(httpServer, {
    cors: {
        origin: allowedOrigins,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
        credentials: true,
    },
});

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000,
    message: { message: 'Too many requests from this IP, please try again after 15 minutes' },
});

// Middleware
app.use(cors({
    origin: allowedOrigins,
    credentials: true,
}));
app.use(helmet({
    crossOriginResourcePolicy: false,
}));
app.use(limiter);
// Stripe Webhook (Must use raw body)
const stripeKey = process.env.STRIPE_SECRET_KEY;
const isStripeConfigured = stripeKey && stripeKey.startsWith('sk_');
if (isStripeConfigured) {
    const { handleWebhook } = require('./controllers/webhook.controller');
    app.post('/api/webhook', express.raw({ type: 'application/json' }), handleWebhook);
}

app.use(express.json());
// app.use(mongoSanitize()); // Disabled due to Express 5 compatibility issue
app.use(cookieParser());
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));
app.use(morgan('dev'));

// Inject Socket.io
app.use((req, res, next) => {
    req.io = io;
    next();
});

// Database Connection
connectDB();

// Routes
const authRoutes = require('./routes/auth.routes');
const projectRoutes = require('./routes/project.routes');
const boardRoutes = require('./routes/board.routes');
const sprintRoutes = require('./routes/sprint.routes');
const issueRoutes = require('./routes/issue.routes');
const commentRoutes = require('./routes/comment.routes');
const userRoutes = require('./routes/user.routes');
const notificationRoutes = require('./routes/notification.routes');
const aiRoutes = require('./routes/ai.routes');
const chatRoutes = require('./routes/chat.routes');
const billingRoutes = require('./routes/billing.routes');
const inviteRoutes = require('./routes/invite.routes');
const analyticsRoutes = require('./routes/analytics.routes');
const debugRoutes = require('./routes/debug.routes');

app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/boards', boardRoutes);
app.use('/api/sprints', sprintRoutes);
app.use('/api/issues', issueRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/users', userRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/invites', inviteRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/debug', debugRoutes);

app.get('/', (req, res) => {
    res.send('API is running...');
});

// Socket.IO Connection
socketMainHandler(io);

const PORT = process.env.PORT || 5000;

if (process.env.NODE_ENV !== 'production') {
    httpServer.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}

// Export the Express app for Vercel
module.exports = app;
