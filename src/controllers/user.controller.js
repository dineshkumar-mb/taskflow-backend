const User = require('../models/User');
const Organization = require('../models/Organization');
const OrganizationMember = require('../models/OrganizationMember');

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

        // Add to OrganizationMember collection
        await OrganizationMember.findOneAndUpdate(
            { organization: organizationId, user: userToInvite._id },
            { role, status: 'active' },
            { upsert: true, new: true }
        );

        // Update user's org
        userToInvite.organizationId = organizationId;
        userToInvite.organization = organizationId;
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

        // Delete from OrganizationMember collection
        await OrganizationMember.findOneAndDelete({ organization: organizationId, user: userId });

        await User.findByIdAndUpdate(userId, { $unset: { organizationId: '', organization: '' } });

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

const switchWorkspace = async (req, res) => {
    try {
        const { organizationId } = req.body;
        if (!organizationId) {
            return res.status(400).json({ message: 'Organization ID is required' });
        }

        const membership = await OrganizationMember.findOne({
            organization: organizationId,
            user: req.user._id,
            status: 'active'
        });

        if (!membership) {
            return res.status(403).json({ message: 'You are not an active member of this organization' });
        }

        // Update user active workspace
        const user = await User.findById(req.user._id);
        user.organizationId = organizationId;
        user.organization = organizationId;
        await user.save();

        const generateToken = require('../utils/generateToken');
        const { accessToken } = generateToken(res, user);

        res.status(200).json({
            message: 'Workspace switched successfully',
            user: {
                _id: user._id,
                name: user.name,
                email: user.email,
                organizationId: user.organizationId,
                role: user.roleName || user.role,
                token: accessToken
            }
        });
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
    switchWorkspace,
};


