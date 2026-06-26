const Organization = require('../models/Organization');

const checkAiUsageLimit = async (req, res, next) => {
    try {
        const organizationId = req.headers['x-organization-id'];

        // Ensure it exists and is a valid regex hex string for ObjectId
        if (!organizationId || organizationId === 'undefined' || !organizationId.match(/^[0-9a-fA-F]{24}$/)) {
            return res.status(400).json({ message: 'Valid Organization ID is required in headers' });
        }

        const organization = await Organization.findById(organizationId);
        if (!organization) {
            return res.status(404).json({ message: 'Organization not found' });
        }

        // track usage in organization (we might need a new field)
        const usageCount = organization.aiUsageCount || 0;

        const limits = {
            free: 5000, // Increased for transcription testing
            pro: 50000,
            team: 1000000 // Unlimited for now
        };

        const limit = limits[organization.plan] || 5000;

        if (usageCount >= limit) {
            return res.status(403).json({ message: `AI usage limit reached for ${organization.plan} plan.` });
        }

        // Increment usage
        organization.aiUsageCount = usageCount + 1;
        await organization.save();

        next();
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = checkAiUsageLimit;
