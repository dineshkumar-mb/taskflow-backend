const cron = require('node-cron');
const standupService = require('../services/standup.service');
const Project = require('../models/Project');

const initStandupCron = () => {
    // Run at 9:00 AM every weekday (Monday through Friday)
    cron.schedule('0 9 * * 1-5', async () => {
        console.log('Running daily standup cron job...');
        try {
            const projects = await Project.find({});
            for (const project of projects) {
                const summary = await standupService.generateStandup(project._id);
                if (summary) {
                    console.log(`Standup for project ${project.name}:\n`, summary);
                    // In a production environment, this would be emailed or sent via socket.
                    // For now, we generate and log it to fulfill the feature requirements.
                }
            }
        } catch (error) {
            console.error('Error in standup cron job:', error);
        }
    });
};

module.exports = initStandupCron;
