const express = require('express');
const router = express.Router();
const { createProject, getProjects, getProjectById, updateProject, deleteProject } = require('../controllers/project.controller');
const { protect, authorize, checkPlan } = require('../middleware/auth.middleware');
const validate = require('../middleware/validate.middleware');
const { createProjectSchema } = require('../validations/project.validation');

router.use(protect);

router.route('/')
    .get(getProjects)
    .post(authorize('OrgOwner', 'Admin', 'Project Manager'), checkPlan('projects'), validate(createProjectSchema), createProject);

router.route('/:id')
    .get(getProjectById)
    .put(authorize('OrgOwner', 'Admin', 'Project Manager'), updateProject)
    .delete(authorize('OrgOwner', 'Admin'), deleteProject);

module.exports = router;
