const express = require('express');
const router = express.Router();
const { getBoards, updateBoard } = require('../controllers/board.controller');
const { protect, authorize } = require('../middleware/auth.middleware');

router.use(protect);

router.get('/project/:projectId', getBoards);
router.put('/:id', authorize('OrgOwner', 'Admin', 'Project Manager'), updateBoard);

module.exports = router;
