const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
    let token;

    // 1. Check cookies for the new access token
    if (req.cookies.accessToken && req.cookies.accessToken !== 'none') {
        token = req.cookies.accessToken;
    }
    // 2. Fallback to Authorization header (for backward compatibility during migration)
    else if (
        req.headers.authorization &&
        req.headers.authorization.startsWith('Bearer')
    ) {
        token = req.headers.authorization.split(' ')[1];
    }

    if (token) {
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            // Notice we changed from decoded.userId to decoded.id to match the new getSignedJwtToken payload
            req.user = await User.findById(decoded.id || decoded.userId).select('-password');

            if (!req.user) {
                return res.status(401).json({ message: 'Not authorized, user not found' });
            }

            next();
        } catch (error) {
            console.error(error);
            res.status(401).json({ message: 'Not authorized, token failed' });
        }
    } else {
        res.status(401).json({ message: 'Not authorized, no token' });
    }
};

// Grant access to specific roles
const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ message: 'User not authenticated' });
        }
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                message: `User role ${req.user.role} is not authorized to access this route`
            });
        }
        next();
    };
};

// Restrict access based on subscription plan
const checkPlan = (feature) => {
    return async (req, res, next) => {
        if (!req.user || !req.user.organizationId) {
            return res.status(401).json({ message: 'User not associated with an organization' });
        }

        const Organization = require('../models/Organization');
        const Project = require('../models/Project');
        const organization = await Organization.findById(req.user.organizationId);

        if (!organization) {
            return res.status(404).json({ message: 'Organization not found' });
        }

        if (feature === 'projects') {
            const projectCount = await Project.countDocuments({ organization: req.user.organizationId });

            if (organization.plan === 'free' && projectCount >= 2) {
                return res.status(403).json({
                    message: 'Free plan limit reached. Please upgrade to create more projects.',
                    limitReached: true
                });
            }
        }

        // Add more feature restrictions here (e.g., members count, analytics access)

        next();
    };
};

const optionalAuth = async (req, res, next) => {
    let token;
    if (req.cookies.accessToken && req.cookies.accessToken !== 'none') {
        token = req.cookies.accessToken;
    } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }

    if (token) {
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            req.user = await User.findById(decoded.id || decoded.userId).select('-password');
        } catch (error) {
            // Ignore token errors for optional auth
        }
    }
    next();
};

const requirePermission = (permission) => {
    return async (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ message: 'User not authenticated' });
        }
        
        let hasPermission = false;
        
        if (req.user.role && req.user.role.permissions) {
            hasPermission = req.user.role.permissions.includes('*') || req.user.role.permissions.includes(permission);
        } else if (req.user.role) {
            const Role = require('../models/Role');
            const role = await Role.findById(req.user.role);
            if (role) {
                hasPermission = role.permissions.includes('*') || role.permissions.includes(permission);
            }
        }
        
        // Fallback for legacy admin roles
        if (!hasPermission && (typeof req.user.role === 'string' || !req.user.role)) {
            const adminRoles = ['SuperAdmin', 'OrgOwner', 'Admin'];
            if (adminRoles.includes(req.user.role) || adminRoles.includes(req.user.roleName)) {
                 hasPermission = true; 
            }
        }

        if (!hasPermission) {
            return res.status(403).json({
                message: `User lacks required permission: ${permission}`
            });
        }
        next();
    };
};

module.exports = { protect, authorize, checkPlan, optionalAuth, requirePermission };
