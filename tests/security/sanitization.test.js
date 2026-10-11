const test = require('node:test');
const assert = require('node:assert/strict');
const sanitizeInput = require('../../src/middleware/sanitize.middleware');

test('NoSQL Injection Sanitization Suite', async (t) => {
    await t.test('strips $ operators from req.body', () => {
        const req = {
            body: {
                username: 'alice',
                password: { $gt: '' },
                nested: {
                    $where: 'sleep(1000)',
                    validKey: 'safe'
                }
            }
        };
        const res = {};
        let called = false;
        sanitizeInput(req, res, () => { called = true; });

        assert.equal(called, true);
        assert.equal(req.body.username, 'alice');
        assert.equal(req.body.password.$gt, undefined);
        assert.equal(req.body.nested.$where, undefined);
        assert.equal(req.body.nested.validKey, 'safe');
    });

    await t.test('strips dotted keys that attempt field traversal', () => {
        const req = {
            query: {
                'role.admin': true,
                cleanSearch: 'sprint'
            }
        };
        const res = {};
        let called = false;
        sanitizeInput(req, res, () => { called = true; });

        assert.equal(called, true);
        assert.equal(req.query['role.admin'], undefined);
        assert.equal(req.query.cleanSearch, 'sprint');
    });

    await t.test('safely handles null, arrays, and undefined properties', () => {
        const req = {
            body: null,
            params: { id: '65f123456789abcdef123456' },
            query: undefined
        };
        const res = {};
        let called = false;
        sanitizeInput(req, res, () => { called = true; });

        assert.equal(called, true);
        assert.equal(req.params.id, '65f123456789abcdef123456');
    });
});
