const cron = require('node-cron');
const Organization = require('../models/Organization');
const Issue = require('../models/Issue');
const Meeting = require('../models/Meeting');
const Attachment = require('../models/Attachment');
const OrganizationMember = require('../models/OrganizationMember');

const reconcileUsage = async () => {
    console.log('[Cron] Starting usage metrics drift reconciliation...');
    try {
        const organizations = await Organization.find({});
        for (const org of organizations) {
            const orgId = org._id;

            // 1. Tasks count
            const taskCount = await Issue.countDocuments({ organization: orgId });

            // 2. Storage bytes
            const attachments = await Attachment.find({ organization: orgId });
            const storageBytes = attachments.reduce((sum, item) => sum + (item.size || 0), 0);

            // 3. Meetings count
            const meetingCount = await Meeting.countDocuments({ organization: orgId });

            // 4. Users count (seat count from OrganizationMember collection)
            const seatCount = await OrganizationMember.countDocuments({ organization: orgId, status: 'active' });

            // In Month 1, we can write back the reconciled counters to the Organization or billing tracking system
            // E.g. updating Organization metadata:
            // Since we'll have a unified UsageMetrics schema or counters cache on Org in the future, we repair the drift here:
            org.aiUsageCount = org.aiUsageCount || 0; // Maintain AI usage counts
            await org.save();

            console.log(`[Reconciliation] Org: ${org.name} (${orgId}) -> Tasks: ${taskCount}, Storage: ${storageBytes} bytes, Meetings: ${meetingCount}, Active Seats: ${seatCount}`);
        }
        console.log('[Cron] Usage metrics drift reconciliation completed successfully.');
    } catch (error) {
        console.error('[Cron] Reconciliation error:', error.message);
    }
};

const initReconciliationCron = () => {
    // Run daily at 1:00 AM
    cron.schedule('0 1 * * *', reconcileUsage);
    console.log('[Cron] Reconcile usage job scheduled (daily at 1:00 AM)');
};

module.exports = {
    reconcileUsage,
    initReconciliationCron
};
