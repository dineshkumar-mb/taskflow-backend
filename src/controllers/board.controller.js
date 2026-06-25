const boardService = require('../services/board.service');

const getBoards = async (req, res) => {
    try {
        const boards = await boardService.getBoards(req.params.projectId);
        res.json(boards);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const updateBoard = async (req, res) => {
    try {
        const board = await boardService.updateBoardColumns(req.params.id, req.body.columns);
        res.json(board);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getBoards,
    updateBoard,
};
