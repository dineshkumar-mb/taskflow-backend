const Team = require('../models/Team');
const User = require('../models/User');

const createTeam = async (req, res) => {
    try {
        const { name, description, lead } = req.body;
        const organizationId = req.organizationId;

        const teamExists = await Team.findOne({ name, organization: organizationId });
        if (teamExists) {
            return res.status(400).json({ message: 'Team with this name already exists' });
        }

        const team = await Team.create({
            name,
            description,
            lead: lead || null,
            organization: organizationId,
            createdBy: req.user._id,
            updatedBy: req.user._id
        });

        res.status(201).json(team);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const getTeams = async (req, res) => {
    try {
        const teams = await Team.find({ organization: req.organizationId })
            .populate('lead', 'name email avatar')
            .populate('members', 'name email avatar');
        res.status(200).json(teams);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const getTeamById = async (req, res) => {
    try {
        const team = await Team.findOne({ _id: req.params.id, organization: req.organizationId })
            .populate('lead', 'name email avatar')
            .populate('members', 'name email avatar');
        if (!team) {
            return res.status(404).json({ message: 'Team not found' });
        }
        res.status(200).json(team);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const updateTeam = async (req, res) => {
    try {
        const team = await Team.findOne({ _id: req.params.id, organization: req.organizationId });
        if (!team) {
            return res.status(404).json({ message: 'Team not found' });
        }

        const { name, description, lead } = req.body;
        if (name) team.name = name;
        if (description !== undefined) team.description = description;
        if (lead !== undefined) team.lead = lead;
        
        team.updatedBy = req.user._id;
        await team.save();

        res.status(200).json(team);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const addTeamMember = async (req, res) => {
    try {
        const { userId } = req.body;
        const team = await Team.findOne({ _id: req.params.id, organization: req.organizationId });
        if (!team) {
            return res.status(404).json({ message: 'Team not found' });
        }

        const memberUser = await User.findOne({ _id: userId, organizationId: req.organizationId });
        if (!memberUser) {
            return res.status(404).json({ message: 'User not found in your organization' });
        }

        if (team.members.includes(userId)) {
            return res.status(400).json({ message: 'User is already a member of this team' });
        }

        // Add to team members
        team.members.push(userId);
        team.updatedBy = req.user._id;
        await team.save();

        // Bidirectional update on user
        await User.findByIdAndUpdate(userId, {
            $addToSet: { teams: team._id }
        });

        res.status(200).json({ message: 'Member added to team successfully', team });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const removeTeamMember = async (req, res) => {
    try {
        const { userId } = req.body;
        const team = await Team.findOne({ _id: req.params.id, organization: req.organizationId });
        if (!team) {
            return res.status(404).json({ message: 'Team not found' });
        }

        if (!team.members.includes(userId)) {
            return res.status(400).json({ message: 'User is not a member of this team' });
        }

        // Remove from team members
        team.members = team.members.filter(id => id.toString() !== userId);
        team.updatedBy = req.user._id;
        await team.save();

        // Bidirectional update on user
        await User.findByIdAndUpdate(userId, {
            $pull: { teams: team._id }
        });

        res.status(200).json({ message: 'Member removed from team successfully', team });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const deleteTeam = async (req, res) => {
    try {
        const team = await Team.findOne({ _id: req.params.id, organization: req.organizationId });
        if (!team) {
            return res.status(404).json({ message: 'Team not found' });
        }

        // Remove team reference from all members
        await User.updateMany(
            { _id: { $in: team.members } },
            { $pull: { teams: team._id } }
        );

        // Perform soft delete
        await team.softDelete(req.user._id);

        res.status(200).json({ message: 'Team soft-deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    createTeam,
    getTeams,
    getTeamById,
    updateTeam,
    addTeamMember,
    removeTeamMember,
    deleteTeam
};
