const { z } = require('zod');

const createOrganizationSchema = z.object({
    name: z.string().min(2, 'Organization name must be at least 2 characters'),
});

const updateOrganizationSchema = z.object({
    name: z.string().min(2, 'Organization name must be at least 2 characters').optional(),
    authStrategy: z.enum(['local', 'google', 'azure', 'okta']).optional(),
});

module.exports = {
    createOrganizationSchema,
    updateOrganizationSchema,
};
