const Board = require('../models/Board');

const getBoards = async (projectId, organizationId) => {
    return await Board.find({ project: projectId, organization: organizationId });
};

const updateBoardColumns = async (boardId, organizationId, columns) => {
    const board = await Board.findOneAndUpdate(
        { _id: boardId, organization: organizationId },
        { columns },
        { new: true }
    );
    if (!board) throw new Error('Board not found or not in your organization');
    return board;
};

module.exports = {
    getBoards,
    updateBoardColumns,
};
