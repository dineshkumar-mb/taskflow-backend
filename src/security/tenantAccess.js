const mongoose = require('mongoose');
const OrganizationMember = require('../models/OrganizationMember');
const Organization = require('../models/Organization');
const Project = require('../models/Project');
const Issue = require('../models/Issue');
const Meeting = require('../models/Meeting');
const Transcript = require('../models/Transcript');
const Role = require('../models/Role');

class TenantAccessError extends Error {
    constructor(message, statusCode = 403) {
        super(message);
        this.name = 'TenantAccessError';
        this.statusCode = statusCode;
    }
}

/**
 * Standard Role-to-Permissions Mapping for TaskFlow RBAC
 */
const DEFAULT_ROLE_PERMISSIONS = {
    SuperAdmin: ['*'],
    OrgOwner: ['*'],
    Owner: ['*'],
    Admin: [
        'project:create', 'project:read', 'project:update', 'project:delete',
        'issue:create', 'issue:read', 'issue:update', 'issue:delete',
        'sprint:create', 'sprint:update', 'sprint:delete',
        'meeting:create', 'meeting:read', 'meeting:update', 'meeting:start', 'meeting:end', 'meeting:generate_mom', 'meeting:confirm_mom',
        'member:invite', 'member:remove', 'member:update_role',
        'billing:read', 'billing:update',
        'organization:settings',
        'ai:execute', 'ai:admin',
        'automation:manage',
        'audit:read'
    ],
    ProjectManager: [
        'project:create', 'project:read', 'project:update',
        'issue:create', 'issue:read', 'issue:update', 'issue:delete',
        'sprint:create', 'sprint:update', 'sprint:delete',
        'meeting:create', 'meeting:read', 'meeting:update', 'meeting:start', 'meeting:end', 'meeting:generate_mom', 'meeting:confirm_mom',
        'billing:read',
        'ai:execute',
        'audit:read'
    ],
    'Project Manager': [
        'project:create', 'project:read', 'project:update',
        'issue:create', 'issue:read', 'issue:update', 'issue:delete',
        'sprint:create', 'sprint:update', 'sprint:delete',
        'meeting:create', 'meeting:read', 'meeting:update', 'meeting:start', 'meeting:end', 'meeting:generate_mom', 'meeting:confirm_mom',
        'billing:read',
        'ai:execute',
        'audit:read'
    ],
    Member: [
        'project:read',
        'issue:create', 'issue:read', 'issue:update',
        'meeting:create', 'meeting:read', 'meeting:start', 'meeting:end',
        'ai:execute'
    ],
    Viewer: [
        'project:read',
        'issue:read',
        'meeting:read'
    ]
};

/**
 * Resolves the authenticated user's effective role string
 */
const getEffectiveRole = (user) => {
    if (!user) return 'Viewer';
    if (user.roleName) return user.roleName;
    if (typeof user.role === 'string') return user.role;
    if (user.role && typeof user.role === 'object' && user.role.name) return user.role.name;
    return 'Member';
};

/**
 * Checks if a user has a specific permission
 */
const hasPermission = async (user, requiredPermission) => {
    if (!user) return false;
    const roleName = getEffectiveRole(user);

    // SuperAdmin and OrgOwner bypass all permission checks
    if (roleName === 'SuperAdmin' || roleName === 'OrgOwner' || roleName === 'Owner') {
        return true;
    }

    // 1. Check custom Role model permissions if user has an assigned Role object ID
    if (user.role && typeof user.role === 'object' && Array.isArray(user.role.permissions)) {
        if (user.role.permissions.includes('*') || user.role.permissions.includes(requiredPermission)) {
            return true;
        }
    } else if (user.role && mongoose.Types.ObjectId.isValid(user.role)) {
        try {
            const customRole = await Role.findById(user.role).lean();
            if (customRole && Array.isArray(customRole.permissions)) {
                if (customRole.permissions.includes('*') || customRole.permissions.includes(requiredPermission)) {
                    return true;
                }
            }
        } catch (_) {}
    }

    // 2. Fall back to standard defaults for role name
    const permissions = DEFAULT_ROLE_PERMISSIONS[roleName] || DEFAULT_ROLE_PERMISSIONS.Member;
    return permissions.includes('*') || permissions.includes(requiredPermission);
};

/**
 * Asserts that the user holds a specific permission, throwing 403 if not
 */
const assertPermission = async (user, requiredPermission) => {
    const allowed = await hasPermission(user, requiredPermission);
    if (!allowed) {
        const role = getEffectiveRole(user);
        throw new TenantAccessError(`Forbidden: User with role '${role}' lacks required permission '${requiredPermission}'`, 403);
    }
    return true;
};

/**
 * Extracts and strictly verifies the active organization context for the request.
 * Never blindly trusts req.body.organizationId or req.query.organizationId.
 */
const getActiveOrganizationId = async (req) => {
    if (!req.user) {
        throw new TenantAccessError('Authentication required to establish tenant context', 401);
    }

    // SuperAdmin can operate across tenants if explicit header or user context is supplied
    const effectiveRole = getEffectiveRole(req.user);
    let requestedOrgId = req.headers['x-organization-id'] || req.user.organizationId || req.user.organization;

    if (!requestedOrgId) {
        if (effectiveRole === 'SuperAdmin') {
            const fallbackOrg = await Organization.findOne();
            if (fallbackOrg) {
                requestedOrgId = fallbackOrg._id;
            }
        }
        if (!requestedOrgId) {
            throw new TenantAccessError('No active organization associated with user', 400);
        }
    }

    const orgIdStr = requestedOrgId.toString();

    if (effectiveRole === 'SuperAdmin') {
        req.organizationId = orgIdStr;
        return orgIdStr;
    }

    // Fast path: Check direct match against primary organization
    const primaryOrgId = (req.user.organizationId || req.user.organization)?.toString();
    if (primaryOrgId === orgIdStr) {
        req.organizationId = orgIdStr;
        return orgIdStr;
    }

    if (mongoose.connection.readyState !== 1) {
        throw new TenantAccessError('Access denied: You are not an active member of this organization', 403);
    }

    // Verify user is an active member of this organization
    const membership = await OrganizationMember.findOne({
        organization: orgIdStr,
        user: req.user._id,
        status: 'active'
    });

    if (!membership) {
        const org = await Organization.findOne({
            _id: orgIdStr,
            $or: [
                { owner: req.user._id },
                { 'members.user': req.user._id }
            ]
        });

        if (!org) {
            throw new TenantAccessError('Access denied: You are not an active member of this organization', 403);
        }
    }

    req.organizationId = orgIdStr;
    if (membership) {
        req.userOrgRole = membership.role;
    }
    return orgIdStr;
};

/**
 * Asserts that the authenticated user has access to the specified organization
 */
const assertOrganizationAccess = async (userOrReq, targetOrgId) => {
    const user = userOrReq.user || userOrReq;
    if (!user) throw new TenantAccessError('Authentication required', 401);

    const effectiveRole = getEffectiveRole(user);
    if (effectiveRole === 'SuperAdmin') return true;

    if (!targetOrgId) throw new TenantAccessError('Target organization ID required', 400);
    const targetStr = targetOrgId.toString();

    // Fast path: primary organization match
    const primaryOrgId = (user.organizationId || user.organization)?.toString();
    if (primaryOrgId === targetStr) return true;

    if (mongoose.connection.readyState !== 1) {
        throw new TenantAccessError('Access denied: User does not belong to this organization', 403);
    }

    // Check membership
    const membership = await OrganizationMember.findOne({
        organization: targetStr,
        user: user._id,
        status: 'active'
    });

    if (membership) return true;

    const org = await Organization.findOne({
        _id: targetStr,
        $or: [{ owner: user._id }, { 'members.user': user._id }]
    });

    if (!org) {
        throw new TenantAccessError('Access denied: User does not belong to this organization', 403);
    }
    return true;
};

/**
 * Asserts that a project exists, belongs to the active organization, and optionally checks user permissions
 */
const assertProjectAccess = async (reqOrUser, projectId, options = {}) => {
    const user = reqOrUser.user || reqOrUser;
    const orgId = reqOrUser.organizationId || user.organizationId || user.organization;

    if (!projectId || !mongoose.Types.ObjectId.isValid(projectId)) {
        throw new TenantAccessError('Invalid or missing project ID', 400);
    }

    // SuperAdmin can access any project
    const isSuperAdmin = getEffectiveRole(user) === 'SuperAdmin';
    const query = { _id: projectId };
    if (!isSuperAdmin) {
        if (!orgId) throw new TenantAccessError('Active organization context required', 400);
        query.organization = orgId;
    }

    const project = await Project.findOne(query)
        .populate('lead', 'name avatar email')
        .populate('members', 'name avatar email');

    if (!project) {
        throw new TenantAccessError('Project not found or not in your organization', 404);
    }

    // Verify permission if requested
    if (options.requiredPermission) {
        await assertPermission(user, options.requiredPermission);
    }

    return project;
};

/**
 * Asserts that an issue exists, belongs to the active organization, and matches optional project scoping
 */
const assertIssueAccess = async (reqOrUser, issueId, options = {}) => {
    const user = reqOrUser.user || reqOrUser;
    const orgId = reqOrUser.organizationId || user.organizationId || user.organization;

    if (!issueId || !mongoose.Types.ObjectId.isValid(issueId)) {
        throw new TenantAccessError('Invalid or missing issue ID', 400);
    }

    const isSuperAdmin = getEffectiveRole(user) === 'SuperAdmin';
    const query = { _id: issueId };
    if (!isSuperAdmin) {
        if (!orgId) throw new TenantAccessError('Active organization context required', 400);
        query.organization = orgId;
    }

    if (options.projectId) {
        query.project = options.projectId;
    }

    let q = Issue.findOne(query);
    if (options.populate) {
        q = q.populate('assignee', 'name avatar')
             .populate('reporter', 'name avatar')
             .populate('project', 'name key organization')
             .populate('sprint', 'name status');
    }

    const issue = await q;
    if (!issue) {
        throw new TenantAccessError('Issue not found in your organization', 404);
    }

    if (options.requiredPermission) {
        await assertPermission(user, options.requiredPermission);
    }

    return issue;
};

/**
 * Asserts that a meeting exists, belongs to the active organization, and optionally verifies participant status
 */
const assertMeetingAccess = async (reqOrUser, meetingId, options = {}) => {
    const user = reqOrUser.user || reqOrUser;
    const orgId = reqOrUser.organizationId || user.organizationId || user.organization;

    if (!meetingId || !mongoose.Types.ObjectId.isValid(meetingId)) {
        throw new TenantAccessError('Invalid or missing meeting ID', 400);
    }

    const isSuperAdmin = getEffectiveRole(user) === 'SuperAdmin';
    const query = { _id: meetingId };
    if (!isSuperAdmin) {
        if (!orgId) throw new TenantAccessError('Active organization context required', 400);
        query.$or = [{ organizationId: orgId }, { organization: orgId }];
    }

    let q = Meeting.findOne(query);
    if (options.populate) {
        q = q.populate('hostId', 'name email avatar')
             .populate('participantIds', 'name email avatar')
             .populate('projectId', 'name key organization');
    }

    const meeting = await q;
    if (!meeting) {
        throw new TenantAccessError('Meeting not found in your organization', 404);
    }

    if (options.requiredPermission) {
        await assertPermission(user, options.requiredPermission);
    }

    return meeting;
};

/**
 * Asserts that a transcript belongs to a valid meeting within the user's organization.
 * Resolves: transcript -> meeting -> organization -> user.
 */
const assertTranscriptAccess = async (reqOrUser, meetingId) => {
    // 1. First assert access to the parent meeting
    const meeting = await assertMeetingAccess(reqOrUser, meetingId);

    // 2. Fetch transcript matching meetingId
    const transcript = await Transcript.findOne({ meetingId: meeting._id });
    if (!transcript) {
        throw new TenantAccessError('Transcript not found for this meeting', 404);
    }

    return { meeting, transcript };
};

/**
 * Express middleware to enforce active tenant context on all downstream routes
 */
const requireTenantContext = async (req, res, next) => {
    try {
        await getActiveOrganizationId(req);
        next();
    } catch (err) {
        return res.status(err.statusCode || 403).json({
            success: false,
            message: err.message,
            code: 'TENANT_ACCESS_DENIED'
        });
    }
};

/**
 * Reusable Express middleware factory to require and assert tenant resource ownership
 */
const requireTenantResource = ({
    model,
    idParam = 'id',
    orgField = 'organization',
    attachAs = 'resource',
    requiredPermission
}) => {
    return async (req, res, next) => {
        try {
            const orgId = await getActiveOrganizationId(req);
            const resourceId = req.params[idParam];

            if (!resourceId || !mongoose.Types.ObjectId.isValid(resourceId)) {
                return res.status(400).json({ success: false, message: `Invalid resource identifier: ${idParam}` });
            }

            const isSuperAdmin = getEffectiveRole(req.user) === 'SuperAdmin';
            const query = { _id: resourceId };
            if (!isSuperAdmin) {
                query[orgField] = orgId;
            }

            const resource = await model.findOne(query);
            if (!resource) {
                return res.status(404).json({ success: false, message: 'Resource not found in your organization' });
            }

            if (requiredPermission) {
                await assertPermission(req.user, requiredPermission);
            }

            req[attachAs] = resource;
            next();
        } catch (err) {
            return res.status(err.statusCode || 403).json({
                success: false,
                message: err.message,
                code: 'RESOURCE_ACCESS_DENIED'
            });
        }
    };
};

module.exports = {
    TenantAccessError,
    DEFAULT_ROLE_PERMISSIONS,
    getEffectiveRole,
    hasPermission,
    assertPermission,
    getActiveOrganizationId,
    assertOrganizationAccess,
    assertProjectAccess,
    assertIssueAccess,
    assertMeetingAccess,
    assertTranscriptAccess,
    requireTenantContext,
    requireTenantResource,
};
