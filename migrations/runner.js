require('dotenv').config();
const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/taskflow');
        console.log(`[Migrations] Connected to MongoDB: ${conn.connection.host}`);
    } catch (error) {
        console.error(`[Migrations] Connection error: ${error.message}`);
        process.exit(1);
    }
};

const runMigrations = async () => {
    await connectDB();

    const migrations = [
        require('./001-add-organization'),
        require('./002-create-subscriptions'),
        require('./003-create-teams'),
        require('./004-create-attachments'),
        require('./005-add-indexes')
    ];

    console.log('[Migrations] Starting database migrations run...');
    for (let i = 0; i < migrations.length; i++) {
        try {
            await migrations[i].up();
        } catch (err) {
            console.error(`[Migrations] Migration ${i + 1} failed:`, err.message);
            process.exit(1);
        }
    }
    console.log('[Migrations] All database migrations completed successfully.');
    process.exit(0);
};

runMigrations();
