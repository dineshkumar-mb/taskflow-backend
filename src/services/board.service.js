const Board = require('../models/Board');

const getBoards = async (projectId) => {
    return await Board.find({ project: projectId });
};

const updateBoardColumns = async (boardId, columns) => {
    return await Board.findByIdAndUpdate(boardId, { columns }, { new: true });
};

module.exports = {
    getBoards,
    updateBoardColumns,
};
