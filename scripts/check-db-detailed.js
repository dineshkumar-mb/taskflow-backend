const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../.env') });

const User = require('../src/models/User');
const Project = require('../src/models/Project');
const Organization = require('../src/models/Organization');

async function check() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('--- DETAILED DIAGNOSTICS ---');

        const users = await User.find({}).select('name email organizationId');
        console.log('\nUSERS:');
        users.forEach(u => console.log(JSON.stringify(u, null, 2)));

        const projects = await Project.find({}).select('name key organization lead members');
        console.log('\nPROJECTS:');
        projects.forEach(p => console.log(JSON.stringify(p, null, 2)));

        const orgs = await Organization.find({}).select('name members projects');
        console.log('\nORGS:');
        orgs.forEach(o => console.log(JSON.stringify(o, null, 2)));

        mongoose.connection.close();
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

check();
