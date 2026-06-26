const { GoogleGenerativeAI } = require('@google/generative-ai');
const Issue = require('../models/Issue');
const Project = require('../models/Project');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const generateStandup = async (projectId) => {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const yesterday = new Date(Date.now() - 86400000);
        
        // Issues completed yesterday
        const completed = await Issue.find({
            project: projectId,
            status: 'done',
            updatedAt: { $gte: yesterday }
        }).populate('assignee', 'name');

        // Issues currently in progress
        const inProgress = await Issue.find({
            project: projectId,
            status: 'in-progress'
        }).populate('assignee', 'name');

        // Potentially blocked issues (no update in 2+ days, in-progress or todo)
        const twoDaysAgo = new Date(Date.now() - 2 * 86400000);
        const blocked = await Issue.find({
            project: projectId,
            status: { $in: ['in-progress', 'todo'] },
            updatedAt: { $lte: twoDaysAgo }
        }).populate('assignee', 'name');

        const prompt = `
            Generate a concise daily standup summary for a software team.
            
            Completed yesterday: ${JSON.stringify(completed)}
            In progress today: ${JSON.stringify(inProgress)}
            Potentially blocked (no update 2+ days): ${JSON.stringify(blocked)}
            
            Format strictly as:
            ✅ Completed: [list]
            🔄 In Progress: [list]
            ⚠️ Needs Attention: [list]
            
            Keep it under 150 words. Mention assignee names. Do not use markdown headers (#).
        `;

        const result = await model.generateContent(prompt);
        return result.response.text();
    } catch (error) {
        console.error('Error generating standup:', error);
        return null;
    }
};

module.exports = {
    generateStandup
};
