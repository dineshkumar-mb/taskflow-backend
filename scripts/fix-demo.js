const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../.env') });

const User = require('../src/models/User');
const Project = require('../src/models/Project');
const Organization = require('../src/models/Organization');

async function fix() {
    try {
        await mongoose.connect(process.env.MONGO_URI);

        // Find dinesh kumar
        const user = await User.findOne({ name: /dinesh/i });
        if (!user) {
            console.error('User dinesh kumar not found');
            process.exit(1);
        }
        console.log(`User found: ${user.name} (${user.email})`);

        // Find Demo Project
        const project = await Project.findOne({ key: 'DEMO' });
        if (!project) {
            console.error('Demo Project not found. Run seed-demo.js first.');
            process.exit(1);
        }

        // Update project org and lead
        project.organization = user.organizationId;
        project.lead = user._id;
        if (!project.members.includes(user._id)) {
            project.members.push(user._id);
        }
        await project.save();

        console.log(`Demo Project reassigned to Org: ${user.organizationId} and User: ${user._id}`);

        mongoose.connection.close();
        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

fix();
