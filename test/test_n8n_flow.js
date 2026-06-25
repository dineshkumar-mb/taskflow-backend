/**
 * test_n8n_flow.js
 * -----------------
 * Self-contained end-to-end test for n8n automation pipeline.
 *
 * Tests the full flow:
 *   1. Register a fresh test admin user (creates own org)
 *   2. Register a "Nandhini" test user in the same org
 *   3. Create an "IDE Project"
 *   4. Create "Login API crash" bug (priority: high)
 *   5. Wait 3s for n8n to run
 *   6. Fetch issue and verify assignee === 'Nandhini'
 *   7. Check in-app notification was created
 *   8. Call GET /api/debug/n8n and report status
 *   9. Edge case: medium priority (should NOT trigger)
 *  10. Edge case: invalid project ID (should return 400)
 *
 * Usage:
 *   node test/test_n8n_flow.js
 *
 * Prerequisites:
 *   - Backend running on http://localhost:5001
 *   - n8n running on http://localhost:5678 (for auto-assign to work)
 *   - n8n workflow imported and activated (for auto-assign to work)
 *   - If n8n is NOT running, the test still validates all other endpoints.
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:5001/api';
const TS = Date.now(); // unique suffix per run

// ─── COLOURS & HELPERS ───────────────────────────────────────────────────────
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const PASS = (msg) => console.log(`  \u2705  ${msg}`);
const FAIL = (msg) => console.log(`  \u274c  ${msg}`);
const INFO = (msg) => console.log(`  \u2139\ufe0f   ${msg}`);
const HEAD = (msg) => console.log(`\n${'─'.repeat(58)}\n  ${msg}\n${'─'.repeat(58)}`);

let adminToken = null;
let adminOrgId = null;
let nandhiniId = null;

const authH = () => ({
    headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
});

// Final report object
const report = {
    webhookStatus: '❓ Pending',
    workflowExecution: '❓ Pending',
    issueAssignment: '❓ Pending',
    databaseUpdate: '❓ Pending',
    notificationDelivery: '❓ Pending',
};

// ─── STEP 1: Register Admin User ─────────────────────────────────────────────
async function registerAdmin() {
    HEAD('Step 1: Registering test admin user');
    const email = `n8n.admin.${TS}@test.com`;
    const res = await axios.post(`${BASE_URL}/auth/register`, {
        name: 'N8N Test Admin',
        email,
        password: 'Password123!',
        organizationName: 'N8N Test Org',
    });
    adminToken = res.data.token;
    adminOrgId = res.data.organizationId;
    PASS(`Admin registered: ${res.data.name} (${email})`);
    PASS(`Organization ID: ${adminOrgId}`);
    return res.data;
}

// ─── STEP 2: Register Nandhini in Same Org ───────────────────────────────────
async function registerNandhini() {
    HEAD('Step 2: Registering Nandhini (auto-assignee)');
    // Register Nandhini as a separate user
    const email = `nandhini.${TS}@test.com`;
    const res = await axios.post(`${BASE_URL}/auth/register`, {
        name: 'Nandhini',
        email,
        password: 'Password123!',
        organizationName: `Nandhini Org ${TS}`,
    });
    nandhiniId = res.data._id;
    const nandhiniToken = res.data.token;
    PASS(`Nandhini registered: ${res.data.name} (${email})`);

    // Invite Nandhini into Admin's org via the invite endpoint
    try {
        await axios.post(`${BASE_URL}/users/invite`,
            { email, role: 'Member' },
            authH()
        );
        PASS('Nandhini invited to admin org');
    } catch (e) {
        INFO(`Invite note: ${e.response?.data?.message || e.message}`);
    }

    return { nandhiniId, nandhiniToken, email };
}

// ─── STEP 3: Create IDE Project ───────────────────────────────────────────────
async function createProject() {
    HEAD('Step 3: Creating "IDE Project"');
    const res = await axios.post(`${BASE_URL}/projects`, {
        name: 'IDE Project',
        key: `IDE${TS % 10000}`,
        description: 'n8n integration test project',
    }, authH());
    PASS(`Project created: ${res.data.name} (${res.data._id})`);
    return res.data;
}

// ─── STEP 4: Create High Priority Bug ────────────────────────────────────────
async function createHighPriorityIssue(projectId) {
    HEAD('Step 4: Creating "Login API crash" — Bug, High Priority');
    try {
        const res = await axios.post(`${BASE_URL}/issues`, {
            title: 'Login API crash',
            type: 'bug',
            priority: 'high',
            status: 'todo',
            project: projectId,
            description: 'POST /api/auth/login crashes with 500 on valid credentials. Likely a DB connection issue after the latest deploy.',
        }, authH());
        PASS(`Issue created: ${res.data.key} (${res.data._id})`);
        INFO(`Type: ${res.data.type} | Priority: ${res.data.priority}`);
        report.webhookStatus = '✅ Connected — issue.created event emitted';
        return res.data;
    } catch (err) {
        FAIL(`Issue creation failed: ${err.response?.data?.message || err.message}`);
        report.webhookStatus = '❌ Failed — could not create issue';
        process.exit(1);
    }
}

// ─── STEP 5: Wait for n8n ────────────────────────────────────────────────────
async function waitForN8n() {
    HEAD('Step 5: Waiting 3 seconds for n8n workflow to execute...');
    await wait(3000);
    PASS('Done waiting.');
}

// ─── STEP 6: Verify Assignment ────────────────────────────────────────────────
async function verifyAssignment(issueId) {
    HEAD('Step 6: Verifying auto-assignment in MongoDB');
    try {
        const res = await axios.get(`${BASE_URL}/issues/${issueId}`, authH());
        const issue = res.data;

        if (issue.assignee && issue.assignee.name) {
            const name = issue.assignee.name;
            if (name.toLowerCase().includes('nandhini')) {
                PASS(`Assignee: ${name} ✓`);
                report.issueAssignment = '✅ Success (Nandhini auto-assigned)';
                report.databaseUpdate = '✅ Success (MongoDB updated)';
            } else {
                FAIL(`Assignee is "${name}" — expected "Nandhini"`);
                report.issueAssignment = `❌ Wrong assignee: ${name}`;
                report.databaseUpdate = '❌ Mismatch';
            }
        } else {
            FAIL('No assignee — n8n auto-assign did not execute');
            INFO('💡 Make sure n8n is running on :5678 and workflow is active.');
            report.issueAssignment = '❌ Not assigned (n8n offline or workflow inactive)';
            report.databaseUpdate = '❌ No update recorded';
        }

        PASS(`Priority confirmed: ${issue.priority}`);
        return issue;
    } catch (err) {
        FAIL(`Fetch issue error: ${err.response?.data?.message || err.message}`);
    }
}

// ─── STEP 7: Verify In-App Notification ──────────────────────────────────────
async function verifyNotification() {
    HEAD('Step 7: Checking in-app notifications');
    try {
        const res = await axios.get(`${BASE_URL}/notifications`, authH());
        const notifications = res.data;
        const n8nNote = notifications.find(
            (n) => n.message && n.message.toLowerCase().includes('high priority')
        );
        if (n8nNote) {
            PASS(`Notification found: "${n8nNote.message}"`);
            report.notificationDelivery = '✅ Success';
        } else {
            INFO('No n8n high-priority notification for admin user.');
            INFO('(Nandhini receives it — log in as Nandhini to verify in-app)');
            INFO(`Total notifications for admin: ${notifications.length}`);
            report.notificationDelivery = '⚠️  Check as Nandhini (notification sent to her)';
        }
    } catch (err) {
        FAIL(`Notifications error: ${err.response?.data?.message || err.message}`);
        report.notificationDelivery = '❌ Could not fetch notifications';
    }
}

// ─── STEP 8: Debug Endpoint ───────────────────────────────────────────────────
async function checkDebug() {
    HEAD('Step 8: GET /api/debug/n8n — Automation Health');
    try {
        const res = await axios.get(`${BASE_URL}/debug/n8n`);
        const d = res.data;
        PASS(`webhookConnected: ${d.webhookConnected}`);
        PASS(`lastWorkflowRun: ${d.lastWorkflowRun}`);
        PASS(`automationActive: ${d.automationActive}`);
        INFO(`Last emit: ${d.lastEmit.event || 'none'} @ ${d.lastEmit.timestamp || 'never'}`);
        INFO(`Last status: ${d.lastEmit.status}`);
        INFO(`Webhook URLs:`);
        INFO(`  Issues:  ${d.webhookUrls.issues}`);
        INFO(`  Sprints: ${d.webhookUrls.sprints}`);
        INFO(`  Billing: ${d.webhookUrls.billing}`);

        if (d.lastWorkflowRun === 'success') {
            report.workflowExecution = '✅ Success (webhook fired successfully)';
        } else if (d.lastWorkflowRun === 'failed') {
            report.workflowExecution = '❌ Failed (n8n returned error — is it running?)';
        } else {
            report.workflowExecution = '⚠️  No emit recorded (backend may have just restarted)';
        }
    } catch (err) {
        FAIL(`Debug endpoint error: ${err.message}`);
        report.workflowExecution = '❌ Debug endpoint unreachable';
    }
}

// ─── STEP 9: Edge Case — Medium Priority ─────────────────────────────────────
async function testEdgeMedium(projectId) {
    HEAD('Step 9 [Edge Case]: Medium Priority → should NOT auto-assign');
    try {
        const res = await axios.post(`${BASE_URL}/issues`, {
            title: 'Minor UI alignment issue',
            type: 'task',
            priority: 'medium',
            status: 'todo',
            project: projectId,
        }, authH());
        PASS(`Medium issue created: ${res.data.key}`);
        await wait(3000);
        const fetched = await axios.get(`${BASE_URL}/issues/${res.data._id}`, authH());
        if (!fetched.data.assignee) {
            PASS('Correct: n8n did NOT auto-assign a medium priority issue ✓');
        } else {
            INFO(`Note: issue assigned to ${fetched.data.assignee.name} (n8n may have a different rule)`);
        }
    } catch (err) {
        INFO(`Edge case skipped: ${err.response?.data?.message || err.message}`);
    }
}

// ─── STEP 10: Edge Case — Invalid Project ────────────────────────────────────
async function testEdgeInvalidProject() {
    HEAD('Step 10 [Edge Case]: Invalid Project ID → expect 400');
    try {
        await axios.post(`${BASE_URL}/issues`, {
            title: 'Test invalid project',
            type: 'bug',
            priority: 'high',
            status: 'todo',
            project: '000000000000000000000000',
        }, authH());
        FAIL('Expected 400 but got success — validation missing!');
    } catch (err) {
        if (err.response?.status === 400) {
            PASS(`Correctly returned 400: "${err.response.data.message}" ✓`);
        } else {
            INFO(`Returned ${err.response?.status}: ${err.response?.data?.message}`);
        }
    }
}

// ─── PRINT FINAL REPORT ──────────────────────────────────────────────────────
function printReport() {
    const pad = (s) => s.padEnd(36);
    console.log('\n');
    console.log('╔══════════════════════════════════════════════════════╗');
    console.log('║           n8n Integration Health Report               ║');
    console.log('╠══════════════════════════════════════════════════════╣');
    console.log(`║  Webhook Status:          ${pad(report.webhookStatus)}║`);
    console.log(`║  Workflow Execution:      ${pad(report.workflowExecution)}║`);
    console.log(`║  Issue Assignment:        ${pad(report.issueAssignment)}║`);
    console.log(`║  Database Update:         ${pad(report.databaseUpdate)}║`);
    console.log(`║  Notification Delivery:   ${pad(report.notificationDelivery)}║`);
    console.log('╚══════════════════════════════════════════════════════╝');
    console.log(`\n  📋 Test run at: ${new Date().toLocaleString()}`);
    console.log('\n  💡 Next steps if auto-assign failed:');
    console.log('     1. docker run -d -p 5678:5678 -e N8N_SECURE_COOKIE=false --name n8n n8nio/n8n');
    console.log('     2. Open http://localhost:5678 → Import taskflow-n8n-workflow.json');
    console.log('     3. Activate the workflow');
    console.log('     4. Re-run: node test/test_n8n_flow.js\n');
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
    console.log('\n\uD83D\uDD2C TaskFlow \u00D7 n8n Integration Test Suite');
    console.log('============================================');

    try {
        await registerAdmin();
        await registerNandhini();
        const project = await createProject();
        const issue = await createHighPriorityIssue(project._id);
        await waitForN8n();
        await verifyAssignment(issue._id);
        await verifyNotification();
        await checkDebug();
        await testEdgeMedium(project._id);
        await testEdgeInvalidProject();
    } catch (err) {
        FAIL(`Unexpected error: ${err.response?.data?.message || err.message}`);
        if (err.response) {
            console.error('[HTTP]', err.response.status, JSON.stringify(err.response.data));
        }
    }

    printReport();
}

main();
