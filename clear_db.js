const mongoose = require('mongoose');
const User = require('./src/models/User');
const Organization = require('./src/models/Organization');
const Project = require('./src/models/Project');
const Board = require('./src/models/Board');
require('dotenv').config();

const clearDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        await User.deleteMany({});
        await Organization.deleteMany({});
        await Project.deleteMany({});
        await Board.deleteMany({});

        console.log('Database cleared successfully');
        process.exit();
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
};

clearDB();
