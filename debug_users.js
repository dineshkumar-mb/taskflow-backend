const mongoose = require('mongoose');
const User = require('./src/models/User');
const Organization = require('./src/models/Organization');
require('dotenv').config();

const debugUsers = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        const users = await User.find({});
        console.log('Users found:', users.length);

        users.forEach(user => {
            console.log(`User: ${user.name} (${user.email}) - OrgID: ${user.organizationId}`);
        });

        const orgs = await Organization.find({});
        console.log('Organizations found:', orgs.length);
        orgs.forEach(org => {
            console.log(`Org: ${org.name} - ID: ${org._id}`);
        });

        process.exit();
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
};

debugUsers();
