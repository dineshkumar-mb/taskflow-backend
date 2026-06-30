const User = require('../src/models/User');
const Organization = require('../models/Organization');
const OrganizationMember = require('../models/OrganizationMember');

const up = async () => {
    console.log('[Migration 001] Upgrading database for multi-tenancy organization members...');
    
    // Find all users
    const users = await User.find({});
    for (const user of users) {
        let changed = false;
        
        // 1. Populate organization from organizationId if missing
        if (user.organizationId && !user.organization) {
            user.organization = user.organizationId;
            changed = true;
        }

        if (changed) {
            await user.save();
        }

        // 2. Ensure OrganizationMember entry exists
        if (user.organization) {
            const memberExists = await OrganizationMember.findOne({
                organization: user.organization,
                user: user._id
            });

            if (!memberExists) {
                await OrganizationMember.create({
                    organization: user.organization,
                    user: user._id,
                    role: user.roleName || 'Member',
                    status: 'active'
                });
                console.log(`[Migration 001] Created OrganizationMember for user ${user.email}`);
            }
        }
    }

    // 3. Migrate from Organization.members array to OrganizationMember collection
    const orgs = await Organization.find({});
    for (const org of orgs) {
        if (org.members && org.members.length > 0) {
            for (const member of org.members) {
                if (!member.user) continue;
                const memberExists = await OrganizationMember.findOne({
                    organization: org._id,
                    user: member.user
                });

                if (!memberExists) {
                    await OrganizationMember.create({
                        organization: org._id,
                        user: member.user,
                        role: member.role || 'Member',
                        status: 'active'
                    });
                    console.log(`[Migration 001] Created OrganizationMember from Org array for user ${member.user}`);
                }
            }
        }
    }

    console.log('[Migration 001] Completed successfully.');
};

const down = async () => {
    console.log('[Migration 001] Rollback not implemented.');
};

module.exports = { up, down };
