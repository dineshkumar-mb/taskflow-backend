const mongoose = require('mongoose');
require('dotenv').config({ path: '.env' });
const User = require('../src/models/User');

const makeAdmin = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        // Update all users to be OrgOwner for testing purposes
        const result = await User.updateMany({}, { $set: { roleName: 'OrgOwner' } });
        
        console.log(`Successfully upgraded ${result.modifiedCount} users to OrgOwner!`);
        
        // Also update any roles collection if needed
        const Role = require('../src/models/Role');
        const ownerRole = await Role.findOne({ name: 'OrgOwner' });
        
        if (ownerRole) {
             await User.updateMany({}, { $set: { role: ownerRole._id } });
             console.log(`Successfully linked Role ObjectId for users.`);
        }
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    }
};

makeAdmin();
