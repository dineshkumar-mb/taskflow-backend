module.exports = {
    free: {
        maxUsers: 5,
        maxProjects: 2,
        maxTasks: 500,
        maxAiActions: 100,
        maxStorageBytes: 1024 * 1024 * 1024, // 1 GB
        maxMeetings: 10,
        features: {
            aiCopilot: true,
            meetings: true,
            wiki: false,
            automation: false
        }
    },
    starter: {
        maxUsers: 20,
        maxProjects: 20,
        maxTasks: 5000,
        maxAiActions: 1000,
        maxStorageBytes: 20 * 1024 * 1024 * 1024, // 20 GB
        maxMeetings: null, // Unlimited
        features: {
            aiCopilot: true,
            meetings: true,
            wiki: true,
            automation: false
        }
    },
    business: {
        maxUsers: 100,
        maxProjects: null,
        maxTasks: null,
        maxAiActions: 10000,
        maxStorageBytes: 100 * 1024 * 1024 * 1024, // 100 GB
        maxMeetings: null,
        features: {
            aiCopilot: true,
            meetings: true,
            wiki: true,
            automation: true
        }
    },
    enterprise: {
        maxUsers: null,
        maxProjects: null,
        maxTasks: null,
        maxAiActions: null,
        maxStorageBytes: null,
        maxMeetings: null,
        features: {
            aiCopilot: true,
            meetings: true,
            wiki: true,
            automation: true
        }
    }
};
