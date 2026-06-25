const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../.env') });

const User = require('../src/models/User');
const Project = require('../src/models/Project');
const Organization = require('../src/models/Organization');

async function check() {
    try {
        await mongoose.connect(process.env.MONGO_URI);

        const data = {
            users: await User.find({}).select('name email organizationId'),
            projects: await Project.find({}).select('name key organization lead members'),
            organizations: await Organization.find({}).select('name members projects')
        };

        fs.writeFileSync(path.join(__dirname, 'db_state.json'), JSON.stringify(data, null, 2));
        console.log('Database state written to db_state.json');

        mongoose.connection.close();
        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

check();
