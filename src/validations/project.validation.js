const { z } = require('zod');

const createProjectSchema = z.object({
    name: z.string().min(2, 'Project name is required'),
    key: z.string().min(2, 'Key must be at least 2 characters').max(10, 'Key max 10 chars'),
    description: z.string().optional(),
});

const updateProjectSchema = z.object({
    name: z.string().min(2).optional(),
    key: z.string().min(2).max(10).optional(),
    description: z.string().optional(),
});

module.exports = {
    createProjectSchema,
    updateProjectSchema,
};
