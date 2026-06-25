const User = require('../models/User');
const Organization = require('../models/Organization');

const registerUser = async (data) => {
    const { name, email, password, organizationName } = data;

    const userExists = await User.findOne({ email });

    if (userExists) {
        throw new Error('User already exists');
    }

    // fallback for standalone MongoDB (no transactions)
    let user = null;
    try {
        user = await User.create({ name, email, password, role: 'OrgOwner' });

        const organization = await Organization.create({
            name: organizationName,
            owner: user._id,
            members: [{ user: user._id, role: 'OrgOwner' }]
        });

        user.organizationId = organization._id;
        await user.save();

        return user;
    } catch (error) {
        // Basic cleanup if user was created but org failed
        // Note: In production with ReplicaSet, transactions are preferred
        if (user) {
            await User.findByIdAndDelete(user._id);
        }
        throw error;
    }
};

const loginUser = async (email, password) => {
    const user = await User.findOne({ email });

    if (user && (await user.matchPassword(password))) {
        return user;
    } else {
        throw new Error('Invalid email or password');
    }
};

module.exports = {
    registerUser,
    loginUser,
};
