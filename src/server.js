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
    'http://localhost:5174',
    'https://taskflow-frontend-self.vercel.app'
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
const v1Router = require('./routes/v1.index');
app.use('/api/v1', v1Router);
app.use('/api', v1Router);

app.get('/', (req, res) => {
    res.send('API is running...');
});

// Socket.IO Connection
socketMainHandler(io);

// Initialize Cron Jobs
const initStandupCron = require('./cron/standup.cron');
initStandupCron();

const { initReconciliationCron } = require('./cron/reconcile.cron');
initReconciliationCron();

const PORT = process.env.PORT || 5000;

if (process.env.NODE_ENV !== 'production') {
    httpServer.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}

// Export the Express app for Vercel
module.exports = app;
