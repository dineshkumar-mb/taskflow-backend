const User = require('../models/User');
const Organization = require('../models/Organization');

const getMe = async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select('-password');
        res.json(user);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const getOrgUsers = async (req, res) => {
    try {
        const organizationId = req.user.organizationId;
        const users = await User.find({ organizationId }).select('name email avatar role');
        res.json(users);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Invite a member to organization by email
const inviteMember = async (req, res) => {
    try {
        const { email, role = 'Member' } = req.body;
        const organizationId = req.user.organizationId;

        // Check if user exists
        const userToInvite = await User.findOne({ email });
        if (!userToInvite) {
            return res.status(404).json({ message: 'No user found with that email. They must register first.' });
        }

        // Check already in org
        if (userToInvite.organizationId?.toString() === organizationId.toString()) {
            return res.status(400).json({ message: 'User is already in this organization.' });
        }

        // Add user to organization members
        await Organization.findByIdAndUpdate(organizationId, {
            $addToSet: { members: { user: userToInvite._id, role } },
        });

        // Update user's org
        userToInvite.organizationId = organizationId;
        userToInvite.role = role;
        await userToInvite.save();

        res.json({ message: `${userToInvite.name} has been added to your organization.` });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Remove a member from the organization
const removeMember = async (req, res) => {
    try {
        const { userId } = req.params;
        const organizationId = req.user.organizationId;

        // Can't remove yourself
        if (userId === req.user._id.toString()) {
            return res.status(400).json({ message: 'You cannot remove yourself from the organization.' });
        }

        await Organization.findByIdAndUpdate(organizationId, {
            $pull: { members: { user: userId } },
        });

        await User.findByIdAndUpdate(userId, { $unset: { organizationId: '' } });

        res.json({ message: 'Member removed from organization.' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const searchUsers = async (req, res) => {
    try {
        const { query } = req.query;
        if (!query || query.length < 2) {
            return res.json([]);
        }

        const users = await User.find({
            $or: [
                { name: { $regex: query, $options: 'i' } },
                { email: { $regex: query, $options: 'i' } }
            ]
        })
            .select('name email avatar')
            .limit(10);

        res.json(users);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getMe,
    getOrgUsers,
    inviteMember,
    removeMember,
    searchUsers,
};
