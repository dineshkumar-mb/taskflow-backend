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
        console.log('--- DATABASE DIAGNOSTICS ---');

        const users = await User.find({});
        console.log('\nUSERS:');
        users.forEach(u => console.log(`- ${u.name} (${u.email}) ID: ${u._id} ORG: ${u.organizationId}`));

        const orgs = await Organization.find({});
        console.log('\nORGANIZATIONS:');
        orgs.forEach(o => console.log(`- ${o.name} ID: ${o._id} MEMBERS: ${o.members.length}`));

        const projects = await Project.find({});
        console.log('\nPROJECTS:');
        projects.forEach(p => console.log(`- ${p.name} [${p.key}] ID: ${p._id} ORG: ${p.organization}`));

        mongoose.connection.close();
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

check();
