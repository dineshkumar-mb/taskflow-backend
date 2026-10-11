const { assertProjectAccess, getActiveOrganizationId } = require('../security/tenantAccess');

const getBoards = async (req, res) => {
    try {
        const orgId = await getActiveOrganizationId(req);
        await assertProjectAccess(req, req.params.projectId);
        const boards = await boardService.getBoards(req.params.projectId, orgId);
        res.json(boards);
    } catch (error) {
        res.status(error.statusCode || 500).json({ message: error.message });
    }
};

const updateBoard = async (req, res) => {
    try {
        const orgId = await getActiveOrganizationId(req);
        const board = await boardService.updateBoardColumns(req.params.id, orgId, req.body.columns);
        res.json(board);
    } catch (error) {
        res.status(error.statusCode || 500).json({ message: error.message });
    }
};

module.exports = {
    getBoards,
    updateBoard,
};
