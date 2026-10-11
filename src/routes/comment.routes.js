const express = require('express');
const router = express.Router();
const { getComments, addComment, deleteComment } = require('../controllers/comment.controller');
const { protect } = require('../middleware/auth.middleware');
const { requireTenantContext } = require('../security/tenantAccess');

router.use(protect);
router.use(requireTenantContext);

router.route('/')
    .get(getComments)
    .post(addComment);

router.route('/:id')
    .delete(deleteComment);

module.exports = router;
