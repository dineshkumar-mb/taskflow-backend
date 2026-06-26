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
        const Organization = require('../models/Organization');
        const Role = require('../models/Role');
        
        user = await User.create({ name, email, password, roleName: 'OrgOwner' });

        const organization = await Organization.create({
            name: organizationName,
            owner: user._id,
            members: [{ user: user._id, role: 'OrgOwner' }]
        });

        // Create standard roles for the organization
        const orgOwnerRole = await Role.create({
            name: 'OrgOwner',
            description: 'Organization Owner with full access',
            isSystem: true,
            permissions: ['*'],
            organization: organization._id
        });

        await Role.create([
            { name: 'Admin', description: 'Administrator', isSystem: true, permissions: ['manage_users', 'manage_projects', 'manage_billing'], organization: organization._id },
            { name: 'Member', description: 'Regular member', isSystem: true, permissions: ['view_projects', 'edit_tasks'], organization: organization._id },
            { name: 'Viewer', description: 'Read-only access', isSystem: true, permissions: ['view_projects'], organization: organization._id },
            { name: 'Guest', description: 'External guest', isSystem: true, permissions: ['view_assigned_tasks'], organization: organization._id }
        ]);

        user.organizationId = organization._id;
        user.role = orgOwnerRole._id;
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
    const user = await User.findOne({ email }).populate('role');

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
