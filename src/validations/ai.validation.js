const { z } = require('zod');

const generateSummarySchema = z.object({
    title: z.string().min(1, 'Title is required'),
    description: z.string().optional(),
});

const estimatePointsSchema = z.object({
    title: z.string().min(1, 'Title is required'),
    description: z.string().optional(),
    type: z.string(),
    priority: z.string(),
});

const copilotChatSchema = z.object({
    message: z.string().min(1, 'Message is required'),
    projectId: z.string().optional().nullable(),
    conversationState: z.record(z.any()).optional(),
    history: z.array(z.object({
        role: z.string(),
        content: z.string()
    })).optional(),
});

module.exports = {
    generateSummarySchema,
    estimatePointsSchema,
    copilotChatSchema,
};
