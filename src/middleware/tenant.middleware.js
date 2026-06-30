const OrganizationMember = require('../models/OrganizationMember');

const tenantMiddleware = async (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ message: 'Authentication required' });
    }
    
    // Extract orgId from user association, falling back to header for multi-workspace switches
    const orgId = req.headers['x-organization-id'] || req.user.organizationId;
    
    if (!orgId || orgId === 'undefined') {
        return res.status(400).json({ message: 'Active organization context required' });
    }
    
    // Verify membership to prevent cross-tenant spoofing
    try {
        const membership = await OrganizationMember.findOne({
            organization: orgId,
            user: req.user._id,
            status: 'active'
        });

        if (!membership) {
            return res.status(403).json({ message: 'Access denied: not a member of this organization or account suspended' });
        }
        
        req.organizationId = orgId.toString();
        req.userOrgRole = membership.role;
        next();
    } catch (error) {
        res.status(500).json({ message: 'Error checking tenant context', error: error.message });
    }
};

module.exports = tenantMiddleware;
