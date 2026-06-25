const express = require('express');
const router = express.Router();
const { createSprint, getSprints, updateSprint, startSprint, completeSprint } = require('../controllers/sprint.controller');
const { protect, authorize } = require('../middleware/auth.middleware');

router.use(protect);

const pmRoles = ['OrgOwner', 'Admin', 'Project Manager'];

router.route('/')
    .post(authorize(...pmRoles), createSprint);

router.route('/project/:projectId')
    .get(getSprints);

router.route('/:id')
    .put(authorize(...pmRoles), updateSprint);

router.route('/:id/start')
    .put(authorize(...pmRoles), startSprint);

router.route('/:id/complete')
    .put(authorize(...pmRoles), completeSprint);

module.exports = router;
