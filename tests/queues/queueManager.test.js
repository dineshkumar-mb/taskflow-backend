const test = require('node:test');
const assert = require('node:assert/strict');
const { enqueueJob, QUEUE_NAMES } = require('../../src/queues/queueManager');
const DistributedLock = require('../../src/security/distributedLock');

test('Queue Manager and Distributed Locking Suite', async (t) => {
    await t.test('enqueueJob: strictly rejects enqueuing without tenant context', async () => {
        await assert.rejects(
            async () => {
                await enqueueJob(QUEUE_NAMES.EMAIL, 'SEND_WELCOME', {
                    email: 'test@example.com'
                    // missing organizationId
                });
            },
            (err) => {
                assert.match(err.message, /Tenant context missing/i);
                return true;
            }
        );
    });

    await t.test('DistributedLock: acquires and releases lock with atomic token', async () => {
        const resource = 'test_resource_123';
        const lock1 = await DistributedLock.acquireLock(resource, 5000);
        assert.equal(lock1.acquired, true);
        assert.ok(lock1.lockToken);

        // Second attempt to acquire same resource while held must fail
        const lock2 = await DistributedLock.acquireLock(resource, 5000);
        assert.equal(lock2.acquired, false);
        assert.equal(lock2.lockToken, null);

        // Release with wrong token should not release lock
        const releasedWrong = await DistributedLock.releaseLock(resource, 'wrong-token-xyz');
        assert.equal(releasedWrong, false);

        // Release with correct token must succeed
        const releasedRight = await DistributedLock.releaseLock(resource, lock1.lockToken);
        assert.equal(releasedRight, true);

        // Now resource can be acquired again
        const lock3 = await DistributedLock.acquireLock(resource, 5000);
        assert.equal(lock3.acquired, true);
        await DistributedLock.releaseLock(resource, lock3.lockToken);
    });
});
