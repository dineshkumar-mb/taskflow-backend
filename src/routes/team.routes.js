const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth.middleware');
const { requireTenantContext } = require('../security/tenantAccess');
const validate = require('../middleware/validate.middleware');
const { createTeamSchema, updateTeamSchema, memberActionSchema } = require('../validations/team.validation');
const {
    createTeam,
    getTeams,
    getTeamById,
    updateTeam,
    addTeamMember,
    removeTeamMember,
    deleteTeam
} = require('../controllers/team.controller');

router.use(protect);
router.use(requireTenantContext);

router.post('/', authorize('SuperAdmin', 'OrgOwner', 'Admin', 'ProjectManager'), validate(createTeamSchema), createTeam);
router.get('/', getTeams);
router.get('/:id', getTeamById);
router.put('/:id', authorize('SuperAdmin', 'OrgOwner', 'Admin', 'ProjectManager'), validate(updateTeamSchema), updateTeam);
router.post('/:id/members/add', authorize('SuperAdmin', 'OrgOwner', 'Admin', 'ProjectManager'), validate(memberActionSchema), addTeamMember);
router.post('/:id/members/remove', authorize('SuperAdmin', 'OrgOwner', 'Admin', 'ProjectManager'), validate(memberActionSchema), removeTeamMember);
router.delete('/:id', authorize('SuperAdmin', 'OrgOwner', 'Admin'), deleteTeam);

module.exports = router;
