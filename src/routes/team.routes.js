const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth.middleware');
const tenantMiddleware = require('../middleware/tenant.middleware');
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
router.use(tenantMiddleware);

router.post('/', validate(createTeamSchema), createTeam);
router.get('/', getTeams);
router.get('/:id', getTeamById);
router.put('/:id', validate(updateTeamSchema), updateTeam);
router.post('/:id/members/add', validate(memberActionSchema), addTeamMember);
router.post('/:id/members/remove', validate(memberActionSchema), removeTeamMember);
router.delete('/:id', deleteTeam);

module.exports = router;
