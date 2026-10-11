const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const {
    assertOrganizationAccess,
    assertPermission
} = require('../../src/security/tenantAccess');

test('Tenant Access & RBAC Enforcement Suite', async (t) => {
    const orgAId = new mongoose.Types.ObjectId().toString();
    const orgBId = new mongoose.Types.ObjectId().toString();
    const userA = { _id: new mongoose.Types.ObjectId().toString(), organizationId: orgAId, role: 'Member' };
    const userB = { _id: new mongoose.Types.ObjectId().toString(), organizationId: orgBId, role: 'Member' };
    const adminA = { _id: new mongoose.Types.ObjectId().toString(), organizationId: orgAId, role: 'Admin' };
    const superAdmin = { _id: new mongoose.Types.ObjectId().toString(), role: 'SuperAdmin' };

    await t.test('assertOrganizationAccess: allows user matching same organization', async () => {
        await assert.doesNotReject(async () => {
            await assertOrganizationAccess(userA, orgAId);
        });
    });

    await t.test('assertOrganizationAccess: blocks user from different organization with 403', async () => {
        await assert.rejects(
            async () => {
                await assertOrganizationAccess(userA, orgBId);
            },
            (err) => {
                assert.equal(err.statusCode || err.status, 403);
                assert.match(err.message, /Access denied/i);
                return true;
            }
        );
    });

    await t.test('assertOrganizationAccess: allows SuperAdmin cross-tenant access', async () => {
        await assert.doesNotReject(async () => {
            await assertOrganizationAccess(superAdmin, orgAId);
            await assertOrganizationAccess(superAdmin, orgBId);
        });
    });

    await t.test('assertPermission: allows Admin to create project but denies Member to delete project', async () => {
        await assert.doesNotReject(async () => {
            await assertPermission(adminA, 'project:create');
        });

        await assert.rejects(
            async () => {
                await assertPermission(userA, 'project:delete');
            },
            (err) => {
                assert.equal(err.statusCode || err.status, 403);
                return true;
            }
        );
    });

    await t.test('assertPermission: Viewer cannot create or modify issues', async () => {
        const viewer = { _id: new mongoose.Types.ObjectId().toString(), organizationId: orgAId, role: 'Viewer' };
        await assert.doesNotReject(async () => {
            await assertPermission(viewer, 'issue:read');
        });
        await assert.rejects(
            async () => {
                await assertPermission(viewer, 'issue:create');
            },
            (err) => {
                assert.equal(err.statusCode || err.status, 403);
                return true;
            }
        );
        await assert.rejects(
            async () => {
                await assertPermission(viewer, 'issue:update');
            },
            (err) => {
                assert.equal(err.statusCode || err.status, 403);
                return true;
            }
        );
    });
});
