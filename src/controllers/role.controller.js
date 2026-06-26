const Role = require('../models/Role');

// @desc    Get all roles for organization
// @route   GET /api/roles
// @access  Private
const getRoles = async (req, res) => {
    try {
        const roles = await Role.find({ organization: req.user.organizationId });
        res.status(200).json(roles);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Create a new role
// @route   POST /api/roles
// @access  Private
const createRole = async (req, res) => {
    try {
        const { name, description, permissions } = req.body;
        
        const roleExists = await Role.findOne({ name, organization: req.user.organizationId });
        if (roleExists) {
            return res.status(400).json({ message: 'Role with this name already exists' });
        }

        const role = await Role.create({
            name,
            description,
            permissions: permissions || [],
            organization: req.user.organizationId,
            isSystem: false,
        });

        res.status(201).json(role);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update a role
// @route   PUT /api/roles/:id
// @access  Private
const updateRole = async (req, res) => {
    try {
        const role = await Role.findById(req.params.id);

        if (!role || role.organization.toString() !== req.user.organizationId.toString()) {
            return res.status(404).json({ message: 'Role not found' });
        }

        if (role.isSystem) {
            return res.status(400).json({ message: 'System roles cannot be modified' });
        }

        role.name = req.body.name || role.name;
        role.description = req.body.description !== undefined ? req.body.description : role.description;
        role.permissions = req.body.permissions || role.permissions;

        await role.save();

        res.status(200).json(role);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Delete a role
// @route   DELETE /api/roles/:id
// @access  Private
const deleteRole = async (req, res) => {
    try {
        const role = await Role.findById(req.params.id);

        if (!role || role.organization.toString() !== req.user.organizationId.toString()) {
            return res.status(404).json({ message: 'Role not found' });
        }

        if (role.isSystem) {
            return res.status(400).json({ message: 'System roles cannot be deleted' });
        }

        // Optional: Check if users are still assigned to this role before deleting
        const User = require('../models/User');
        const usersWithRole = await User.countDocuments({ role: role._id });
        if (usersWithRole > 0) {
            return res.status(400).json({ message: `Cannot delete role. It is assigned to ${usersWithRole} users.` });
        }

        await Role.findByIdAndDelete(req.params.id);

        res.status(200).json({ message: 'Role removed' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getRoles,
    createRole,
    updateRole,
    deleteRole
};
