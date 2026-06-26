const express = require('express');
const router = express.Router();
const { getRoles, createRole, updateRole, deleteRole } = require('../controllers/role.controller');
const { protect, requirePermission } = require('../middleware/auth.middleware');

router.use(protect);
// Only users with 'manage_users' or '*' can manage roles
router.use(requirePermission('manage_users'));

router.route('/')
    .get(getRoles)
    .post(createRole);

router.route('/:id')
    .put(updateRole)
    .delete(deleteRole);

module.exports = router;
