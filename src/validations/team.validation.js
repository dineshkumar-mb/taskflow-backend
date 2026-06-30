const { z } = require('zod');

// Regex for MongoDB ObjectId
const objectIdRegex = /^[0-9a-fA-F]{24}$/;

const createTeamSchema = z.object({
    name: z.string().min(2, 'Team name must be at least 2 characters'),
    description: z.string().max(500).optional(),
    lead: z.string().regex(objectIdRegex, 'Invalid Lead User ID format').optional(),
});

const updateTeamSchema = z.object({
    name: z.string().min(2, 'Team name must be at least 2 characters').optional(),
    description: z.string().max(500).optional(),
    lead: z.string().regex(objectIdRegex, 'Invalid Lead User ID format').optional(),
});

const memberActionSchema = z.object({
    userId: z.string().regex(objectIdRegex, 'Invalid User ID format'),
});

module.exports = {
    createTeamSchema,
    updateTeamSchema,
    memberActionSchema,
};
